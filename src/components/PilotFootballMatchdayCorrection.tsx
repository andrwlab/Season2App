import React, { useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { FOOTBALL_2026_TEAMS, normalizeFootballTeam, playerIdFor, PilotTeam } from "../pilot/footballTournament";

type EventRecord = {
  ref: ReturnType<typeof doc>;
  eventId: string;
  type: string;
  teamSide?: "HOME" | "AWAY";
  playerId?: string | null;
  playerName?: string | null;
  matchClockMs?: number;
  status?: string;
  revertsEventId?: string;
  [key: string]: unknown;
};

const rosterNames: Record<string, { home: string[]; homeStarters: string[]; away: string[]; awayStarters: string[] }> = {
  "group-01": {
    home: ["Miguel Concepción", "Mr. Solís", "Rocco Lockee", "Joel Pérez", "James De Gracia", "Iann Araúz", "Rafael Romero", "Wilson Chen", "Héctor Fu Chen", "Gabriel Chen de León", "Mr. Castillo"],
    homeStarters: ["Miguel Concepción", "Mr. Solís", "Rocco Lockee", "Joel Pérez", "James De Gracia", "Iann Araúz", "Rafael Romero"],
    away: ["Héctor Chen", "Juan Bonilla", "Brian Chen", "Ian Espino", "Edward Qiu", "Mr. Marmolejo", "Jaime Gibbs", "Williams Luo", "José Pimentel"],
    awayStarters: ["Héctor Chen", "Juan Bonilla", "Brian Chen", "Ian Espino", "Edward Qiu", "Mr. Marmolejo", "Jaime Gibbs"],
  },
  "group-02": {
    home: ["Douglas Dewesse", "Ethan de León", "Edwin Chen", "Mr. Gómez", "Adriam Rodríguez", "Daniel De León", "Mr. Tam", "Diego Pimentel", "William Qiu", "Nicolás Pérez"],
    homeStarters: ["Douglas Dewesse", "Ethan de León", "Edwin Chen", "Mr. Gómez", "Adriam Rodríguez", "Daniel De León", "Mr. Tam"],
    away: ["Mr. Pérez", "Adrián Fernández", "Henrique Arenas", "Dylan Sanjur", "Eduardo Gudiño", "Johan Ching", "Dylan Dely", "Winston Chen", "Hyatt Navarro", "Antonio Zhu"],
    awayStarters: ["Mr. Pérez", "Adrián Fernández", "Henrique Arenas", "Dylan Sanjur", "Eduardo Gudiño", "Johan Ching", "Dylan Dely"],
  },
};

const asPilotRoster = (team: PilotTeam, names: string[]) => {
  const normalized = normalizeFootballTeam(team);
  const canonicalTeam = FOOTBALL_2026_TEAMS.find((item) => item.teamId === team.teamId);
  const canonicalPlayers = canonicalTeam ? normalizeFootballTeam(canonicalTeam).players : [];
  return names.map((fullName) => {
    const player = normalized.players.find((item) => item.fullName === fullName)
      ?? canonicalPlayers.find((item) => item.fullName === fullName);
    if (!player) throw new Error(`No se encontró ${fullName} en la plantilla de ${team.name}.`);
    return { playerId: player.playerId, name: player.name, fullName: player.fullName, suspended: player.suspended ?? false, suspensionReason: player.suspensionReason ?? "" };
  });
};

const sortedByClock = (events: EventRecord[]) => [...events].sort((a, b) => Number(a.matchClockMs ?? 0) - Number(b.matchClockMs ?? 0));

const PilotFootballMatchdayCorrection = ({ tournamentId, matchId, pilotMatchId }: { tournamentId: string; matchId: string; pilotMatchId: string }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const correction = tournamentId === "football-2026" ? rosterNames[matchId] : undefined;
  if (!correction) return null;

  const applyCorrections = async () => {
    if (!window.confirm("Aplicar alineaciones corregidas y ajustar goleadores, asistencias y la amarilla indicada? No se modificarán los minutos/reloj del partido.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const tournamentRef = doc(db, "pilotTournaments", tournamentId);
      const [tournamentSnapshot, eventSnapshot] = await Promise.all([
        getDoc(tournamentRef),
        getDocs(query(collection(db, "pilotEvents"), where("pilotMatchId", "==", pilotMatchId))),
      ]);
      const matchRef = doc(db, "pilotMatches", pilotMatchId);
      const matchSnapshot = await getDoc(matchRef);
      if (!matchSnapshot.exists()) throw new Error("No se encontró el partido guardado.");

      const homeTeamId = matchId === "group-01" ? "real-madrid" : "paris-saint-germain";
      const awayTeamId = matchId === "group-01" ? "fc-barcelona" : "slovan-bratislava";
      const sourceTeams = (tournamentSnapshot.data()?.teams as PilotTeam[] | undefined) ?? FOOTBALL_2026_TEAMS;
      const homeTeam = sourceTeams.find((team) => team.teamId === homeTeamId) ?? FOOTBALL_2026_TEAMS.find((team) => team.teamId === homeTeamId)!;
      const awayTeam = sourceTeams.find((team) => team.teamId === awayTeamId) ?? FOOTBALL_2026_TEAMS.find((team) => team.teamId === awayTeamId)!;
      const homePlayers = asPilotRoster(homeTeam, correction.home);
      const awayPlayers = asPilotRoster(awayTeam, correction.away);
      const homeStarterIds = correction.homeStarters.map((name) => homePlayers.find((player) => player.fullName === name)!.playerId);
      const awayStarterIds = correction.awayStarters.map((name) => awayPlayers.find((player) => player.fullName === name)!.playerId);

      const rawEvents = eventSnapshot.docs.map((snapshot) => ({ ref: snapshot.ref, eventId: snapshot.id, ...snapshot.data() } as EventRecord));
      const reversed = new Set(rawEvents.filter((event) => event.type === "REVERSAL" && event.revertsEventId).map((event) => event.revertsEventId));
      const active = rawEvents.filter((event) => event.type !== "REVERSAL" && event.status !== "HIDDEN" && event.status !== "REVERSED" && !reversed.has(event.eventId));
      const goalsFor = (side: "HOME" | "AWAY") => sortedByClock(active.filter((event) => event.teamSide === side && (event.type === "GOAL" || event.type === "PENALTY_GOAL")));
      const batch = writeBatch(db);

      const nextTeams = sourceTeams.map((team) => ({ ...team, players: [...team.players] }));
      const realMadrid = nextTeams.find((team) => team.teamId === "real-madrid");
      const manCity = nextTeams.find((team) => team.teamId === "slovan-bratislava");
      if (realMadrid && manCity) {
        const castillo = manCity.players.find((player) => player.playerId === playerIdFor("Mr. Castillo")) ?? FOOTBALL_2026_TEAMS.find((team) => team.teamId === "real-madrid")!.players.find((player) => player.playerId === playerIdFor("Mr. Castillo"));
        manCity.players = manCity.players.filter((player) => player.playerId !== playerIdFor("Mr. Castillo"));
        if (castillo && !realMadrid.players.some((player) => player.playerId === castillo.playerId)) realMadrid.players.push(castillo);
        batch.set(tournamentRef, { teams: nextTeams, updatedAt: serverTimestamp() }, { merge: true });
      }

      batch.update(matchRef, {
        homePlayers, awayPlayers, homeStarterIds, awayStarterIds,
        lineupsConfirmed: true, correctedLineupsByAdmin: true, updatedAt: serverTimestamp(),
      });

      const correctionMark = { correctedByAdmin: true, correctedAt: serverTimestamp() };
      if (matchId === "group-01") {
        const fcbGoals = goalsFor("AWAY");
        if (fcbGoals.length < 2) throw new Error("No se encontraron los dos goles activos del Barcelona; no se aplicó ningún cambio.");
        const marmolejoId = playerIdFor("Mr. Marmolejo");
        fcbGoals.slice(0, 2).forEach((event, index) => batch.update(event.ref, {
          playerId: marmolejoId, playerName: "Mr. Marmolejo",
          assistPlayerId: playerIdFor(index === 0 ? "Jaime Gibss" : "Edward Qiu"),
          assistPlayerName: index === 0 ? "Jaime" : "Edward", ...correctionMark,
        }));

        const rmGoals = goalsFor("HOME");
        const solisGoal = rmGoals.find((event) => event.playerId === playerIdFor("Mr. Solís") || /sol[ií]s/i.test(event.playerName ?? ""));
        if (!solisGoal || rmGoals.length < 2) throw new Error("No se identificó con seguridad el gol de Mr. Solís; no se aplicó ningún cambio.");
        batch.update(solisGoal.ref, { playerId: playerIdFor("Mr. Solís"), playerName: "Mr. Solís", assistPlayerId: playerIdFor("James De Gracia"), assistPlayerName: "James", ...correctionMark });

        const yellowJuan = active.filter((event) => event.type === "YELLOW_CARD" && event.teamSide === "AWAY" && (event.playerId === playerIdFor("Juan Bonilla") || /^Juan\b/i.test(event.playerName ?? ""))).sort((a, b) => Number(b.matchClockMs ?? 0) - Number(a.matchClockMs ?? 0));
        const matchData = matchSnapshot.data();
        if (yellowJuan.length > 1) {
          batch.update(yellowJuan[0].ref, { status: "HIDDEN", correctionReason: "Duplicate yellow card removed per verified match report", ...correctionMark });
          batch.update(matchRef, { yellowAway: Math.max(0, Number(matchData.yellowAway ?? 0) - 1), updatedAt: serverTimestamp() });
        }
      } else {
        const psgGoals = goalsFor("HOME");
        if (!psgGoals.length) throw new Error("No se encontró el gol activo del PSG; no se aplicó ningún cambio.");
        batch.update(psgGoals[0].ref, { playerId: playerIdFor("Mr. Tam"), playerName: "Mr. Tam", assistPlayerId: playerIdFor("Ethan de León"), assistPlayerName: "Ethan", ...correctionMark });
        const cityGoals = goalsFor("AWAY");
        if (cityGoals.length < 2) throw new Error("No se encontraron los dos goles activos del City; no se aplicó ningún cambio.");
        batch.update(cityGoals[0].ref, { playerId: playerIdFor("Henrique Arenas"), playerName: "Dylan Dely", assistPlayerId: playerIdFor("Eduardo Gudiño"), assistPlayerName: "Eduardo", ...correctionMark });
        batch.update(cityGoals[1].ref, { playerId: playerIdFor("Antonio Zhu"), playerName: "Hyatt", assistPlayerId: playerIdFor("Adrian Fernández"), assistPlayerName: "Adrián", ...correctionMark });
      }

      await batch.commit();
      setMessage("Correcciones guardadas. El reloj y los minutos históricos no se modificaron.");
    } catch (cause) {
      console.error("Failed to apply matchday-one corrections", cause);
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar las correcciones.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto mt-4 max-w-lg rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-200">Corrección jornada 1 · Admin</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">Actualiza plantillas y titulares del partido, asigna goleadores/asistencias según el reporte y corrige la amarilla duplicada de Juan. Conserva los minutos registrados; Edwin por Diego queda pendiente.</p>
      <button type="button" disabled={busy} onClick={() => void applyCorrections()} className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "GUARDANDO…" : "APLICAR CORRECCIONES VERIFICADAS"}</button>
      {message && <p className="mt-2 text-xs font-bold text-emerald-200">{message}</p>}
      {error && <p className="mt-2 text-xs font-bold text-red-300">{error}</p>}
    </section>
  );
};

export default PilotFootballMatchdayCorrection;
