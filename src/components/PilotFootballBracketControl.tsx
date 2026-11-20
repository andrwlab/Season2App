import React, { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { PilotTeam } from "../pilot/footballTournament";

type Match = {
  matchId: string;
  stage?: "GROUP" | "SEMIFINAL" | "THIRD_PLACE" | "FINAL";
  tieId?: "SF1" | "SF2";
  leg?: 1 | 2;
  status: "READY" | "LIVE" | "FULLTIME";
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  scoreHome?: number;
  scoreAway?: number;
  penaltyHome?: number;
  penaltyAway?: number;
};

type Props = { tournamentId: string; teams: PilotTeam[]; matches: Match[]; suggestedSeeds: string[] };

const roster = (team: PilotTeam) => team.players.map(({ playerId, name, fullName, suspended, suspensionReason }) => ({ playerId, name, fullName, suspended, suspensionReason }));

const PilotFootballBracketControl = ({ tournamentId, teams, matches, suggestedSeeds }: Props) => {
  const [seeds, setSeeds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setSeeds(suggestedSeeds.length === 4 ? suggestedSeeds : teams.map((team) => team.teamId)), [suggestedSeeds, teams]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.teamId, team])), [teams]);
  const semiMatches = matches.filter((match) => match.stage === "SEMIFINAL");
  const locked = semiMatches.some((match) => match.status !== "READY");
  const thirdPlaceMatch = matches.find((match) => match.stage === "THIRD_PLACE");
  const finalMatch = matches.find((match) => match.stage === "FINAL");

  const winnerFor = (tieId: "SF1" | "SF2") => {
    const tie = semiMatches.filter((match) => match.tieId === tieId);
    if (tie.length !== 2 || tie.some((match) => match.status !== "FULLTIME")) return null;
    const ids = Array.from(new Set(tie.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean))) as string[];
    if (ids.length !== 2) return null;
    const totals = new Map(ids.map((id) => [id, 0]));
    tie.forEach((match) => {
      if (match.homeTeamId) totals.set(match.homeTeamId, (totals.get(match.homeTeamId) ?? 0) + (match.scoreHome ?? 0));
      if (match.awayTeamId) totals.set(match.awayTeamId, (totals.get(match.awayTeamId) ?? 0) + (match.scoreAway ?? 0));
    });
    if (totals.get(ids[0]) !== totals.get(ids[1])) return (totals.get(ids[0])! > totals.get(ids[1])! ? ids[0] : ids[1]);
    const secondLeg = tie.find((match) => match.leg === 2);
    if (!secondLeg || (secondLeg.penaltyHome ?? 0) === (secondLeg.penaltyAway ?? 0)) return null;
    return (secondLeg.penaltyHome ?? 0) > (secondLeg.penaltyAway ?? 0) ? secondLeg.homeTeamId : secondLeg.awayTeamId;
  };

  const setSeed = (index: number, teamId: string) => setSeeds((current) => current.map((item, itemIndex) => itemIndex === index ? teamId : item));

  const loserFor = (tieId: "SF1" | "SF2") => {
    const winner = winnerFor(tieId);
    if (!winner) return null;
    const ids = Array.from(new Set(semiMatches.filter((match) => match.tieId === tieId).flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean))) as string[];
    return ids.find((id) => id !== winner) ?? null;
  };

  const configureSemifinals = async () => {
    if (new Set(seeds).size !== 4 || seeds.some((id) => !teamById.has(id))) {
      setNotice("Choose each team once before confirming the semifinal seeds.");
      return;
    }
    const first = teamById.get(seeds[0])!;
    const second = teamById.get(seeds[1])!;
    const third = teamById.get(seeds[2])!;
    const fourth = teamById.get(seeds[3])!;
    const pairings: Record<string, [PilotTeam, PilotTeam]> = {
      "SF1:1": [fourth, first], "SF1:2": [first, fourth],
      "SF2:1": [third, second], "SF2:2": [second, third],
    };
    setBusy(true); setNotice(null);
    try {
      const batch = writeBatch(db);
      semiMatches.forEach((match) => {
        const pairing = pairings[`${match.tieId}:${match.leg}`];
        if (!pairing) return;
        const [home, away] = pairing;
        batch.update(doc(db, "pilotMatches", `${tournamentId}__${match.matchId}`), {
          homeTeamId: home.teamId, awayTeamId: away.teamId, homeName: home.name, awayName: away.name,
          homeLogoUrl: home.logoPath, awayLogoUrl: away.logoPath, homePlayers: roster(home), awayPlayers: roster(away),
          homeStarterIds: [], awayStarterIds: [], currentHomePlayerIds: [], currentAwayPlayerIds: [], lineupsConfirmed: false,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setNotice("Semifinals configured: 1st vs 4th and 2nd vs 3rd, both over two legs.");
    } catch (error) {
      console.error("Could not configure football semifinals", error);
      setNotice("Could not save the semifinal configuration.");
    } finally { setBusy(false); }
  };

  const configurePlacementMatches = async () => {
    const firstWinner = winnerFor("SF1");
    const secondWinner = winnerFor("SF2");
    const firstLoser = loserFor("SF1");
    const secondLoser = loserFor("SF2");
    const finalHome = firstWinner ? teamById.get(firstWinner) : null;
    const finalAway = secondWinner ? teamById.get(secondWinner) : null;
    const thirdHome = firstLoser ? teamById.get(firstLoser) : null;
    const thirdAway = secondLoser ? teamById.get(secondLoser) : null;
    if (!finalHome || !finalAway || !thirdHome || !thirdAway || !finalMatch || !thirdPlaceMatch || finalMatch.status !== "READY" || thirdPlaceMatch.status !== "READY") { setNotice("Finish both semi-final second legs, including penalties if needed, before preparing the third-place match and final."); return; }
    setBusy(true); setNotice(null);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "pilotMatches", `${tournamentId}__${thirdPlaceMatch.matchId}`), {
        homeTeamId: thirdHome.teamId, awayTeamId: thirdAway.teamId, homeName: thirdHome.name, awayName: thirdAway.name,
        homeLogoUrl: thirdHome.logoPath, awayLogoUrl: thirdAway.logoPath, homePlayers: roster(thirdHome), awayPlayers: roster(thirdAway),
        homeStarterIds: [], awayStarterIds: [], currentHomePlayerIds: [], currentAwayPlayerIds: [], lineupsConfirmed: false,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, "pilotMatches", `${tournamentId}__${finalMatch.matchId}`), {
        homeTeamId: finalHome.teamId, awayTeamId: finalAway.teamId, homeName: finalHome.name, awayName: finalAway.name,
        homeLogoUrl: finalHome.logoPath, awayLogoUrl: finalAway.logoPath, homePlayers: roster(finalHome), awayPlayers: roster(finalAway),
        homeStarterIds: [], awayStarterIds: [], currentHomePlayerIds: [], currentAwayPlayerIds: [], lineupsConfirmed: false,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setNotice(`Third place: ${thirdHome.name} vs ${thirdAway.name}. Final: ${finalHome.name} vs ${finalAway.name}.`);
    } catch (error) { console.error("Could not configure placement matches", error); setNotice("Could not prepare the third-place match and final."); } finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Knockout control</p><p className="mt-1 text-sm text-slate-400">Confirm the group order before assigning the two-legged semifinals. Tied aggregate: extra time, then penalties in leg two.</p></div>
    <div className="grid gap-2 sm:grid-cols-2">{["1st", "2nd", "3rd", "4th"].map((label, index) => <label key={label} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"><span className="block text-[0.65rem] font-black uppercase tracking-wider text-slate-500">{label} in group</span><select value={seeds[index] ?? ""} onChange={(event) => setSeed(index, event.target.value)} disabled={locked || busy} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="">Choose team</option>{teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}</select></label>)}</div>
    <button type="button" disabled={locked || busy || semiMatches.length !== 4} onClick={configureSemifinals} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{locked ? "SEMIFINALS LOCKED AFTER KICKOFF" : "CONFIRM SEMIFINALS"}</button>
    <button type="button" disabled={busy || !winnerFor("SF1") || !winnerFor("SF2") || !loserFor("SF1") || !loserFor("SF2") || thirdPlaceMatch?.status !== "READY" || finalMatch?.status !== "READY"} onClick={configurePlacementMatches} className="w-full rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 font-black text-amber-100 disabled:opacity-40">PREPARE THIRD PLACE AND FINAL</button>
    {notice && <p className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm font-semibold text-slate-300">{notice}</p>}
  </section>;
};

export default PilotFootballBracketControl;
