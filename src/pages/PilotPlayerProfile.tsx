import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";
import { assetUrl, normalizeFootballMatch, normalizeFootballTeam, PilotTeam } from "../pilot/footballTournament";

type Match = {
  matchId: string;
  homeName: string;
  awayName: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  homeStarterIds?: string[];
  awayStarterIds?: string[];
};

type FootballEvent = {
  eventId?: string;
  matchId: string;
  type: string;
  status?: string;
  revertsEventId?: string;
  playerId?: string | null;
  playerName?: string | null;
  assistPlayerId?: string | null;
  playerInId?: string | null;
  playerOutId?: string | null;
};

type Tournament = { tournamentId: string; name: string; teams?: PilotTeam[] };

const PilotPlayerProfile = () => {
  const { tournamentId = "football-2026", playerId = "" } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<FootballEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stopTournament = onSnapshot(doc(db, "pilotTournaments", tournamentId), (snapshot) => {
      setTournament(snapshot.exists() ? { ...(snapshot.data() as Tournament), teams: (snapshot.data() as Tournament).teams?.map(normalizeFootballTeam) } : null);
      setLoading(false);
    }, () => { setError("No se pudo cargar el perfil."); setLoading(false); });
    const stopMatches = onSnapshot(query(collection(db, "pilotMatches"), where("tournamentId", "==", tournamentId)), (snapshot) => {
      setMatches(snapshot.docs.map((item) => normalizeFootballMatch(item.data() as Match)));
    });
    const stopEvents = onSnapshot(query(collection(db, "pilotEvents"), where("tournamentId", "==", tournamentId)), (snapshot) => {
      setEvents(snapshot.docs.map((item) => item.data() as FootballEvent));
    });
    return () => { stopTournament(); stopMatches(); stopEvents(); };
  }, [tournamentId]);

  const team = tournament?.teams?.find((candidate) => candidate.players.some((player) => player.playerId === playerId));
  const player = team?.players.find((candidate) => candidate.playerId === playerId);
  const reversedEventIds = useMemo(() => new Set(events.filter((event) => event.type === "REVERSAL" && event.revertsEventId).map((event) => event.revertsEventId)), [events]);
  const activeEvents = useMemo(() => events.filter((event) => event.type !== "REVERSAL" && event.status !== "REVERSED" && !reversedEventIds.has(event.eventId)), [events, reversedEventIds]);
  const playerEvents = useMemo(() => activeEvents.filter((event) => event.playerId === playerId || event.assistPlayerId === playerId || event.playerInId === playerId || event.playerOutId === playerId), [activeEvents, playerId]);
  const stats = useMemo(() => ({
    goals: activeEvents.filter((event) => event.playerId === playerId && (event.type === "GOAL" || event.type === "PENALTY_GOAL")).length,
    assists: activeEvents.filter((event) => event.assistPlayerId === playerId && event.type === "GOAL").length,
    yellow: activeEvents.filter((event) => event.playerId === playerId && event.type === "YELLOW_CARD").length,
    red: activeEvents.filter((event) => event.playerId === playerId && event.type === "RED_CARD").length,
    starts: matches.filter((match) => match.homeStarterIds?.includes(playerId) || match.awayStarterIds?.includes(playerId)).length,
    substitutions: activeEvents.filter((event) => event.type === "SUBSTITUTION" && (event.playerInId === playerId || event.playerOutId === playerId)).length,
  }), [activeEvents, matches, playerId]);
  const matchHistory = useMemo(() => {
    const eventMatchIds = new Set(playerEvents.map((event) => event.matchId));
    return matches.filter((match) => eventMatchIds.has(match.matchId) || match.homeStarterIds?.includes(playerId) || match.awayStarterIds?.includes(playerId));
  }, [matches, playerEvents, playerId]);

  useEffect(() => {
    if (!player) return;
    const previousTitle = document.title;
    document.title = `${player.name} | ${tournament?.name || "Champions League"}`;
    return () => { document.title = previousTitle; };
  }, [player, tournament?.name]);

  if (loading) return <div className="champions-shell min-h-[100dvh] p-6 text-white"><div className="mx-auto h-96 max-w-3xl animate-pulse rounded-[2rem] bg-white/[0.05]" /></div>;
  if (!player || !team) return <div className="champions-shell min-h-[100dvh] px-5 pt-[max(env(safe-area-inset-top),2rem)] text-center text-white"><Link to={`/live/${tournamentId}/teams`} className="text-sm font-black text-cyan-200">← Equipos</Link><h1 className="mt-10 text-3xl font-black">Jugador no encontrado</h1></div>;

  return (
    <div className="champions-shell min-h-[100dvh] text-white">
      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-6 sm:pt-8">
        <header className="flex items-center justify-between gap-3">
          <Link to={`/live/${tournamentId}/teams`} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-xl" aria-label="Volver a equipos">←</Link>
          <p className="min-w-0 truncate text-xs font-black uppercase tracking-[0.16em] text-white/40">{tournament?.name || "Champions League"}</p>
          <div className="h-11 w-11" aria-hidden="true" />
        </header>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#111111] p-6 text-center sm:p-8">
          <div className="champions-player-avatar relative mx-auto h-36 w-36 sm:h-44 sm:w-44" aria-label={`Silueta de perfil de ${player.fullName}`}>
            <img src={assetUrl("champions-league-eagle-logo-web.png")} alt="" className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain opacity-[0.09]" />
            <svg viewBox="0 0 160 160" className="relative z-10 h-full w-full" aria-hidden="true">
              <defs><linearGradient id="profile-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="0.48" stopColor="#8fc7ff"/><stop offset="1" stopColor="#355c9a"/></linearGradient></defs>
              <circle cx="80" cy="57" r="29" fill="url(#profile-silver)" opacity="0.94"/>
              <path d="M27 139c4-34 23-51 53-51s49 17 53 51" fill="url(#profile-silver)" opacity="0.94"/>
            </svg>
            <img src={assetUrl(team.logoPath)} alt={`Escudo de ${team.name}`} className="absolute -bottom-1 -right-1 h-14 w-14 rounded-full bg-[#071027] p-1.5 object-contain ring-2 ring-cyan-200/20" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-cyan-300/75">{team.name}</p>
          <h1 className="champions-wordmark mt-2 text-4xl font-black tracking-tight sm:text-5xl">{player.name}</h1>
          <p className="mt-2 text-sm font-semibold text-white/40">{player.fullName}</p>

          {error && <p className="mt-4 text-sm font-semibold text-red-300">{error}</p>}
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[["Goles", stats.goals], ["Asist.", stats.assists], ["Titular", stats.starts], ["Cambios", stats.substitutions], ["Amarillas", stats.yellow], ["Rojas", stats.red]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#101010] px-2 py-4 text-center"><p className="text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-white/35">{label}</p></div>)}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Partidos del jugador</h2><span className="text-xs font-bold text-white/35">{matchHistory.length}</span></div>
          {matchHistory.length ? <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#101010]">{matchHistory.map((match, index) => <Link key={match.matchId} to={`/live/${tournamentId}/match/${match.matchId}`} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 text-sm ${index ? "border-t border-white/[0.06]" : ""}`}><span className="truncate font-bold">{match.homeName}</span><span className="font-black tabular-nums">{match.status === "READY" ? "vs" : `${match.scoreHome}–${match.scoreAway}`}</span><span className="truncate text-right font-bold">{match.awayName}</span></Link>)}</div> : <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">Todavía no hay apariciones registradas.</div>}
        </section>
      </main>
    </div>
  );
};

export default PilotPlayerProfile;
