import React, { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { PilotTeam } from "../pilot/footballTournament";

type Match = {
  matchId: string;
  stage?: "GROUP" | "SEMIFINAL" | "FINAL";
  tieId?: "SF1" | "SF2";
  leg?: 1 | 2;
  status: "READY" | "LIVE" | "FULLTIME";
};

type Props = { tournamentId: string; teams: PilotTeam[]; matches: Match[]; suggestedSeeds: string[] };

const roster = (team: PilotTeam) => team.players.map(({ playerId, name, fullName }) => ({ playerId, name, fullName }));

const PilotFootballBracketControl = ({ tournamentId, teams, matches, suggestedSeeds }: Props) => {
  const [seeds, setSeeds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setSeeds(suggestedSeeds.length === 4 ? suggestedSeeds : teams.map((team) => team.teamId)), [suggestedSeeds, teams]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.teamId, team])), [teams]);
  const semiMatches = matches.filter((match) => match.stage === "SEMIFINAL");
  const locked = semiMatches.some((match) => match.status !== "READY");

  const setSeed = (index: number, teamId: string) => setSeeds((current) => current.map((item, itemIndex) => itemIndex === index ? teamId : item));

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

  return <section className="space-y-4 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Knockout control</p><p className="mt-1 text-sm text-slate-400">Confirm the group order before assigning the two-legged semifinals. This remains editable only before any semifinal kicks off.</p></div>
    <div className="grid gap-2 sm:grid-cols-2">{["1st", "2nd", "3rd", "4th"].map((label, index) => <label key={label} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"><span className="block text-[0.65rem] font-black uppercase tracking-wider text-slate-500">{label} in group</span><select value={seeds[index] ?? ""} onChange={(event) => setSeed(index, event.target.value)} disabled={locked || busy} className="mt-1 w-full bg-transparent text-sm font-black outline-none"><option value="">Choose team</option>{teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}</select></label>)}</div>
    <button type="button" disabled={locked || busy || semiMatches.length !== 4} onClick={configureSemifinals} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{locked ? "SEMIFINALS LOCKED AFTER KICKOFF" : "CONFIRM SEMIFINALS"}</button>
    {notice && <p className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm font-semibold text-slate-300">{notice}</p>}
  </section>;
};

export default PilotFootballBracketControl;
