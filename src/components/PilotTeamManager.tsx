import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { assetUrl, PilotTeam } from "../pilot/footballTournament";

type Props = {
  tournamentId: string;
  teams: PilotTeam[];
};

const cloneTeams = (teams: PilotTeam[]) => teams.map((team) => ({
  ...team,
  players: team.players.map((player) => ({ ...player })),
}));

const PilotTeamManager = ({ tournamentId, teams }: Props) => {
  const [draft, setDraft] = useState<PilotTeam[]>(() => cloneTeams(teams));
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(cloneTeams(teams)), [teams]);

  const selectedPlayer = useMemo(() => {
    for (const team of draft) {
      const player = team.players.find((item) => item.playerId === selectedPlayerId);
      if (player) return { player, team };
    }
    return null;
  }, [draft, selectedPlayerId]);

  const persistTeams = async (nextTeams: PilotTeam[], successMessage: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const matchesSnapshot = await getDocs(query(collection(db, "pilotMatches"), where("tournamentId", "==", tournamentId)));
      const batch = writeBatch(db);
      batch.set(doc(db, "pilotTournaments", tournamentId), { teams: nextTeams, updatedAt: serverTimestamp() }, { merge: true });

      matchesSnapshot.docs.forEach((matchDoc) => {
        const data = matchDoc.data();
        if (data.status !== "READY" && data.clockStatus !== "NOT_STARTED") return;
        const home = nextTeams.find((team) => team.teamId === data.homeTeamId);
        const away = nextTeams.find((team) => team.teamId === data.awayTeamId);
        if (!home || !away) return;
        batch.update(matchDoc.ref, {
          homeName: home.name,
          awayName: away.name,
          homeLogoUrl: home.logoPath,
          awayLogoUrl: away.logoPath,
          homePlayers: home.players.map(({ playerId, name, fullName, suspended, suspensionReason }) => ({ playerId, name, fullName, suspended, suspensionReason })),
          awayPlayers: away.players.map(({ playerId, name, fullName, suspended, suspensionReason }) => ({ playerId, name, fullName, suspended, suspensionReason })),
          homeStarterIds: [],
          awayStarterIds: [],
          currentHomePlayerIds: [],
          currentAwayPlayerIds: [],
          lineupsConfirmed: false,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setDraft(cloneTeams(nextTeams));
      setMessage(successMessage);
    } catch (err) {
      console.error("Failed to update football teams", err);
      setError("Could not update the teams. No future match was changed.");
    } finally {
      setBusy(false);
    }
  };

  const updatePlayer = (teamId: string, playerId: string, field: "name" | "fullName" | "suspended" | "suspensionReason", value: string | boolean) => {
    setDraft((current) => current.map((team) => team.teamId !== teamId ? team : {
      ...team,
      players: team.players.map((player) => player.playerId === playerId ? { ...player, [field]: value } : player),
    }));
  };

  const saveCorrections = async () => {
    const normalized = draft.map((team) => ({
      ...team,
      players: team.players.map((player) => ({ ...player, name: player.name.trim(), fullName: player.fullName.trim() })),
    }));
    if (normalized.some((team) => team.players.some((player) => !player.name || !player.fullName))) {
      setError("Display name and full name cannot be empty.");
      return;
    }
    await persistTeams(normalized, "Player corrections saved and future matches synchronized.");
  };

  const transferPlayer = async () => {
    if (!selectedPlayer || !targetTeamId || selectedPlayer.team.teamId === targetTeamId) {
      setError("Choose a player and a different destination team.");
      return;
    }
    const next = cloneTeams(draft).map((team) => {
      if (team.teamId === selectedPlayer.team.teamId) {
        return { ...team, players: team.players.filter((player) => player.playerId !== selectedPlayer.player.playerId) };
      }
      if (team.teamId === targetTeamId) {
        return { ...team, players: [...team.players, { ...selectedPlayer.player }] };
      }
      return team;
    });
    const destination = next.find((team) => team.teamId === targetTeamId)?.name ?? "destination team";
    await persistTeams(next, `${selectedPlayer.player.name} moved to ${destination}.`);
    setSelectedPlayerId("");
    setTargetTeamId("");
  };

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Teams & rosters</p><p className="mt-1 text-sm text-slate-500">Corrections and transfers update every match that has not started. Finished or live matches keep their historical roster.</p></div>

      <div className="grid gap-3 sm:grid-cols-2">
        {draft.map((team) => <div key={team.teamId} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3"><div className="mb-3 flex items-center gap-3"><img src={assetUrl(team.logoPath)} alt="" className="h-12 w-12 object-contain" /><div><p className="font-black">{team.name}</p><p className="text-xs text-slate-500">{team.players.length} players</p></div></div><div className="space-y-2">{team.players.map((player) => <div key={player.playerId} className={`rounded-xl border p-2 ${player.suspended ? "border-red-400/30 bg-red-500/[0.06]" : "border-white/[0.07] bg-white/[0.03]"}`}><input aria-label={`Display name for ${player.fullName}`} value={player.name} onChange={(event) => updatePlayer(team.teamId, player.playerId, "name", event.target.value)} className="w-full bg-transparent text-sm font-black outline-none focus:text-cyan-200" /><input aria-label={`Full name for ${player.name}`} value={player.fullName} onChange={(event) => updatePlayer(team.teamId, player.playerId, "fullName", event.target.value)} className="mt-1 w-full bg-transparent text-xs text-slate-500 outline-none focus:text-slate-200" /><label className="mt-2 flex items-center gap-2 text-xs font-bold text-red-200"><input type="checkbox" checked={player.suspended === true} onChange={(event) => updatePlayer(team.teamId, player.playerId, "suspended", event.target.checked)} /> 🟥 Suspendido</label>{player.suspended && <input aria-label={`Suspension reason for ${player.name}`} value={player.suspensionReason || ""} placeholder="Suspensión por quizzes" onChange={(event) => updatePlayer(team.teamId, player.playerId, "suspensionReason", event.target.value)} className="mt-2 w-full rounded-lg border border-red-400/20 bg-red-500/[0.06] px-2 py-1 text-xs text-red-100 outline-none placeholder:text-red-200/45" />}</div>)}</div></div>)}
      </div>

      <button type="button" disabled={busy} onClick={saveCorrections} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">SAVE NAME CORRECTIONS</button>

      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Transfer player</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold"><option value="">Choose player</option>{draft.map((team) => <optgroup key={team.teamId} label={team.name}>{team.players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name} · {team.shortName}</option>)}</optgroup>)}</select><select value={targetTeamId} onChange={(event) => setTargetTeamId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold"><option value="">Destination team</option>{draft.filter((team) => team.teamId !== selectedPlayer?.team.teamId).map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}</select></div><button type="button" disabled={busy || !selectedPlayerId || !targetTeamId} onClick={transferPlayer} className="mt-2 w-full rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">MOVE PLAYER</button></div>

      {(message || error) && <p className={`rounded-xl border p-3 text-sm font-semibold ${error ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || message}</p>}
    </section>
  );
};

export default PilotTeamManager;
