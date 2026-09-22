import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Link, NavLink, useParams } from "react-router-dom";
import PilotMomentsRail from "../components/PilotMomentsRail";
import { db } from "../firebase";
import useAudienceTracking from "../hooks/useAudienceTracking";
import { formatPhase, PilotPhase } from "../pilot/clock";
import { assetUrl, FOOTBALL_2026_TOURNAMENT_ID, normalizeFootballMatch, normalizeFootballTeam, PilotTeam } from "../pilot/footballTournament";

type TournamentSection = "home" | "matches" | "standings" | "stats" | "teams";
type Match = { matchId: string; tournamentId: string; homeName: string; awayName: string; homeLogoUrl?: string; awayLogoUrl?: string; scoreHome: number; scoreAway: number; status: "READY" | "LIVE" | "FULLTIME"; phase: PilotPhase; stage?: "GROUP" | "SEMIFINAL" | "FINAL"; matchday?: number; order?: number; tieId?: "SF1" | "SF2"; leg?: 1 | 2; homeTeamId?: string | null; awayTeamId?: string | null };
type Tournament = { tournamentId: string; name: string; sport: "football"; teams?: PilotTeam[] };
type Standing = { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };
type FootballEvent = { eventId?: string; type: string; status?: string; revertsEventId?: string; playerId?: string | null; playerName?: string | null; assistPlayerId?: string | null; assistPlayerName?: string | null };
type PlayerStat = { playerId: string; name: string; goals: number; assists: number; yellow: number; red: number };

const sections: Array<{ key: TournamentSection; label: string; path: string }> = [
  { key: "home", label: "Inicio", path: "" }, { key: "matches", label: "Partidos", path: "matches" },
  { key: "standings", label: "Tabla", path: "standings" }, { key: "stats", label: "Stats", path: "stats" },
  { key: "teams", label: "Equipos", path: "teams" },
];
const sectionTitles: Record<TournamentSection, [string, string]> = {
  home: ["Torneo en vivo", ""], matches: ["Calendario y resultados", "Partidos"],
  standings: ["Primera fase", "Tabla de posiciones"], stats: ["Rendimiento individual", "Estadísticas"],
  teams: ["Planteles del torneo", "Equipos"],
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "TM";
const TeamBadge = ({ name, logoUrl, small = false }: { name: string; logoUrl?: string; small?: boolean }) => {
  const size = small ? "h-10 w-10 text-xs" : "h-14 w-14 text-sm";
  return logoUrl
    ? <img src={assetUrl(logoUrl)} alt={`Escudo de ${name}`} className={`${size} mx-auto shrink-0 object-contain`} />
    : <div className={`mx-auto flex ${size} shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] font-black text-white/80`}>{initials(name)}</div>;
};
const NavIcon = ({ name }: { name: TournamentSection }) => {
  if (name === "home") return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>;
  if (name === "matches") return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
  if (name === "standings") return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/></svg>;
  if (name === "stats") return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H3v2a4 4 0 0 0 5 4M17 6h4v2a4 4 0 0 1-5 4"/></svg>;
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
};

const buildStandings = (completed: Match[], teamNames: string[]): Standing[] => {
  const table = new Map<string, Standing>();
  const ensure = (team: string) => { if (!table.has(team)) table.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }); return table.get(team)!; };
  teamNames.forEach(ensure);
  completed.forEach((match) => {
    const home = ensure(match.homeName), away = ensure(match.awayName);
    home.played++; away.played++; home.gf += match.scoreHome; home.ga += match.scoreAway; away.gf += match.scoreAway; away.ga += match.scoreHome;
    if (match.scoreHome > match.scoreAway) { home.won++; home.points += 3; away.lost++; }
    else if (match.scoreAway > match.scoreHome) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  });
  return [...table.values()].sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
};
const stageName = (match: Match) => match.stage === "FINAL" ? "Final" : match.stage === "SEMIFINAL" ? `Semifinal · ${match.leg === 1 ? "Ida" : "Vuelta"}` : match.matchday ? `Jornada ${match.matchday}` : "Primera fase";

const Fixture = ({ match, tournamentId }: { match: Match; tournamentId: string }) => (
  <Link to={`/live/${tournamentId}/match/${match.matchId}`} aria-label={`${match.homeName} contra ${match.awayName}`} className="grid min-h-28 grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-3 rounded-3xl border border-white/[0.08] bg-[#101010] px-5 py-4 transition-transform active:scale-[0.99] sm:min-h-36 sm:px-6">
    <span className="col-span-3 text-center text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-300/75">{stageName(match)}</span>
    <div className="flex min-w-0 items-center justify-center gap-2 text-center sm:justify-start sm:text-left">
      <TeamBadge name={match.homeName} logoUrl={match.homeLogoUrl}/>
      <span className="hidden text-base font-black leading-tight sm:line-clamp-2">{match.homeName}</span>
    </div>
    <span className="text-[0.65rem] font-black uppercase text-white/25">vs</span>
    <div className="flex min-w-0 items-center justify-center gap-2 text-center sm:justify-end sm:text-right">
      <span className="hidden text-base font-black leading-tight sm:line-clamp-2">{match.awayName}</span>
      <TeamBadge name={match.awayName} logoUrl={match.awayLogoUrl}/>
    </div>
  </Link>
);
const Result = ({ match, tournamentId, divided = false }: { match: Match; tournamentId: string; divided?: boolean }) => <Link to={`/live/${tournamentId}/match/${match.matchId}`} className={`block px-4 py-4 ${divided ? "border-t border-white/[0.06]" : ""}`}><p className="mb-2 text-center text-[0.55rem] font-black uppercase tracking-[0.12em] text-white/30">{stageName(match)}</p><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><span className="truncate text-sm font-bold">{match.homeName}</span><span className="text-xl font-black tabular-nums">{match.scoreHome}–{match.scoreAway}</span><span className="truncate text-right text-sm font-bold">{match.awayName}</span></div></Link>;

const PilotTournament = () => {
  const { tournamentId = "pilot0", section: routeSection } = useParams();
  const activeSection: TournamentSection = sections.some((item) => item.key === routeSection) ? routeSection as TournamentSection : "home";
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [events, setEvents] = useState<FootballEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useAudienceTracking({ tournamentId, scope: "TOURNAMENT" });

  useEffect(() => {
    const stopTournament = onSnapshot(doc(db, "pilotTournaments", tournamentId), (snap) => {
      if (!snap.exists()) return setTournament(null);
      const data = snap.data() as Tournament;
      setTournament({ ...data, teams: data.teams?.map(normalizeFootballTeam) });
    });
    const stopMatches = onSnapshot(query(collection(db, "pilotMatches"), where("tournamentId", "==", tournamentId)), (snap) => { setMatches(snap.docs.map((item) => normalizeFootballMatch(item.data() as Match)).sort((a, b) => a.matchId.localeCompare(b.matchId, undefined, { numeric: true }))); setLoading(false); }, (snapshotError) => { console.error(snapshotError); setError("Los datos del torneo no están disponibles por el momento."); setLoading(false); });
    const stopEvents = onSnapshot(query(collection(db, "pilotEvents"), where("tournamentId", "==", tournamentId)), (snap) => setEvents(snap.docs.map((item) => item.data() as FootballEvent)));
    return () => { stopTournament(); stopMatches(); stopEvents(); };
  }, [tournamentId]);

  const live = matches.filter((match) => match.status === "LIVE" && match.phase !== "FULLTIME");
  const results = matches.filter((match) => match.status === "FULLTIME" || match.phase === "FULLTIME").reverse();
  const upcoming = matches.filter((match) => match.status === "READY" && match.homeTeamId && match.awayTeamId).sort((a, b) => (a.matchday ?? 99) - (b.matchday ?? 99) || (a.order ?? 99) - (b.order ?? 99));
  const momentMatch = live[0] ?? results[0] ?? null;
  const teams = useMemo(() => tournament?.teams ?? [], [tournament?.teams]);
  const fallbackTeams = useMemo(() => [...new Set(matches.flatMap((match) => [match.homeName, match.awayName]))].filter((name) => name !== "To be confirmed").sort(), [matches]);
  const standings = useMemo(() => buildStandings(results.filter((match) => !match.stage || match.stage === "GROUP"), teams.map((team) => team.name)), [results, teams]);
  const knockouts = useMemo(() => matches.filter((match) => match.stage === "SEMIFINAL" || match.stage === "FINAL"), [matches]);
  const semifinalTies = useMemo(() => (["SF1", "SF2"] as const).map((tieId) => knockouts.filter((match) => match.tieId === tieId).sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0))), [knockouts]);
  const finalMatch = knockouts.find((match) => match.stage === "FINAL");
  const playerStats = useMemo(() => {
    const stats = new Map<string, PlayerStat>();
    const ensure = (id?: string | null, name?: string | null) => { if (!id || !name) return null; if (!stats.has(id)) stats.set(id, { playerId: id, name, goals: 0, assists: 0, yellow: 0, red: 0 }); return stats.get(id)!; };
    const reversed = new Set(events.filter((event) => event.type === "REVERSAL" && event.revertsEventId).map((event) => event.revertsEventId));
    events.filter((event) => event.type !== "REVERSAL" && event.status !== "REVERSED" && !reversed.has(event.eventId)).forEach((event) => { const player = ensure(event.playerId, event.playerName); if (player && (event.type === "GOAL" || event.type === "PENALTY_GOAL")) player.goals++; if (player && event.type === "YELLOW_CARD") player.yellow++; if (player && event.type === "RED_CARD") player.red++; const assister = ensure(event.assistPlayerId, event.assistPlayerName); if (assister && event.type === "GOAL") assister.assists++; });
    return [...stats.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
  }, [events]);
  const displayName = tournamentId === FOOTBALL_2026_TOURNAMENT_ID ? "Champions League" : tournament?.name || tournamentId;
  const homePath = typeof window === "undefined" ? "" : window.location.pathname.replace(/\/(matches|standings|stats|teams)\/?$/, "");
  const qrUrl = homePath ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(`${window.location.origin}${homePath}?src=qr`)}` : "";
  const toSection = (section: Exclude<TournamentSection, "home">) => `/live/${tournamentId}/${section}`;

  useEffect(() => {
    const pageName = activeSection === "home" ? "En vivo" : sectionTitles[activeSection][1];
    const previousTitle = document.title;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousThemeColor = themeColor?.content;
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = assetUrl("champions-league-eagle-logo-web.png") || "";
    favicon.dataset.championsFavicon = "true";
    document.head.appendChild(favicon);
    document.title = `${pageName} | ${displayName}`;
    if (themeColor) themeColor.content = "#020817";
    return () => {
      document.title = previousTitle;
      if (themeColor && previousThemeColor) themeColor.content = previousThemeColor;
      favicon.remove();
    };
  }, [activeSection, displayName]);

  if (loading) return <div className="champions-shell min-h-[100dvh] px-4 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)] text-white"><main className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-20 rounded-2xl bg-white/[0.05]"/><div className="h-64 rounded-[2rem] bg-white/[0.05]"/><div className="h-32 rounded-3xl bg-white/[0.05]"/></main></div>;
  if (error) return <div className="champions-shell min-h-[100dvh] px-6 pb-8 pt-[max(env(safe-area-inset-top),2rem)] text-center font-semibold text-red-300">{error}</div>;

  const [eyebrow, heading] = sectionTitles[activeSection];
  const matchUrl = (match: Match) => `/live/${tournamentId}/match/${match.matchId}`;

  return <div className="champions-shell min-h-[100dvh] text-white">
    <main className="relative z-10 mx-auto max-w-5xl px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),1.25rem)] min-[430px]:px-4 sm:px-6 sm:pb-32 md:pt-[max(env(safe-area-inset-top),2rem)] lg:px-8">
      <header className="pb-4 sm:pb-6">
        <div className="flex items-center gap-3">
          <img src={assetUrl("champions-league-eagle-logo-web.png")} alt="Logo de SABIS Champions League" className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_0_18px_rgba(87,150,255,0.28)] min-[430px]:h-24 min-[430px]:w-24 md:h-28 md:w-28" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-blue-200/65 min-[430px]:text-[0.62rem] min-[430px]:tracking-[0.24em] md:text-xs">{eyebrow}</p>
            <h1 className="champions-wordmark mt-1 truncate text-2xl font-black tracking-[-0.035em] min-[430px]:text-3xl md:text-4xl lg:text-5xl">{heading || displayName}</h1>
            {activeSection !== "home" && <p className="mt-1 truncate text-[0.65rem] font-bold uppercase tracking-[0.13em] text-white/35 sm:text-xs">{displayName}</p>}
          </div>
          {live.length > 0 && <Link to={matchUrl(live[0])} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500/[0.12] px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-red-300"><span className="h-1.5 w-1.5 rounded-full bg-red-400"/>En vivo</Link>}
        </div>
      </header>

      {activeSection === "home" && <>
        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black">Ahora</h2>{live.length > 1 && <span className="text-xs font-bold text-white/35">{live.length} partidos</span>}</div>
          {live.length === 0 ? <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5"><p className="text-sm font-black">No hay partidos en vivo</p><p className="mt-1 text-xs leading-relaxed text-white/40">Cuando comience un encuentro, el marcador y sus jugadas aparecerán aquí.</p></div> : <div className="grid gap-3 lg:grid-cols-2">{live.map((match) => <Link key={match.matchId} to={matchUrl(match)} aria-label={`Partido en vivo: ${match.homeName} contra ${match.awayName}`} className="block overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#111111] active:scale-[0.99]"><div className="flex items-center justify-between px-5 pt-4 text-[0.65rem] font-black uppercase tracking-[0.13em] text-white/35"><span>{formatPhase(match.phase)}</span><span className="text-red-300">En vivo</span></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-6 text-center min-[430px]:gap-3 min-[430px]:px-5"><div className="min-w-0"><TeamBadge name={match.homeName} logoUrl={match.homeLogoUrl}/><p className="mt-3 hidden text-sm font-black sm:line-clamp-2">{match.homeName}</p></div><div className="min-w-[6.5rem] text-4xl font-black tracking-[-0.08em] tabular-nums min-[430px]:min-w-[7.5rem] min-[430px]:text-5xl">{match.scoreHome}<span className="mx-2 text-2xl font-light text-white/20">–</span>{match.scoreAway}</div><div className="min-w-0"><TeamBadge name={match.awayName} logoUrl={match.awayLogoUrl}/><p className="mt-3 hidden text-sm font-black sm:line-clamp-2">{match.awayName}</p></div></div><div className="border-t border-white/[0.06] px-5 py-3 text-center text-xs font-black text-cyan-200">Seguir partido →</div></Link>)}</div>}
        </section>
        {momentMatch && <PilotMomentsRail pilotMatchId={`${tournamentId}__${momentMatch.matchId}`}/>}
        <section className="pt-7"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black">Lo próximo</h2><Link to={toSection("matches")} className="text-xs font-black text-cyan-200">Ver calendario →</Link></div>{upcoming[0] ? <Fixture match={upcoming[0]} tournamentId={tournamentId}/> : <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">No hay próximos partidos confirmados.</div>}</section>
        <section className="grid grid-cols-2 gap-2 pt-7">
          <Link to={toSection("standings")} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-4"><p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-white/35">Líder</p><p className="mt-2 truncate text-sm font-black">{standings[0]?.team ?? "Por definir"}</p><p className="mt-1 text-xs text-white/40">{standings[0]?.played ? `${standings[0].points} puntos` : "Aún sin partidos"}</p><p className="mt-4 text-xs font-black text-cyan-200">Ver tabla →</p></Link>
          <Link to={toSection("stats")} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-4"><p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-white/35">Goleador</p><p className="mt-2 truncate text-sm font-black">{playerStats[0]?.name ?? "Por definir"}</p><p className="mt-1 text-xs text-white/40">{playerStats[0] ? `${playerStats[0].goals} goles` : "Aún sin estadísticas"}</p><p className="mt-4 text-xs font-black text-cyan-200">Ver estadísticas →</p></Link>
        </section>
        {results[0] && <section className="pt-7"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black">Último resultado</h2><Link to={toSection("matches")} className="text-xs font-black text-cyan-200">Ver todos →</Link></div><div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101010]"><Result match={results[0]} tournamentId={tournamentId}/></div></section>}
        {qrUrl && <details className="mt-8 rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-center"><summary className="cursor-pointer list-none text-sm font-black text-cyan-200">Compartir torneo</summary><p className="mt-2 text-xs text-white/35">Escanea este código para abrir el torneo.</p><div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3"><img src={qrUrl} alt={`QR del torneo ${displayName}`} width="220" height="220" className="h-40 w-40"/></div></details>}
      </>}

      {activeSection === "matches" && <>
        <section className="pt-5"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black sm:text-lg">Próximos partidos</h2><span className="text-xs font-bold text-white/30">{upcoming.length} pendientes</span></div>{upcoming.length ? <div className="grid gap-3 md:grid-cols-2">{upcoming.map((match) => <Fixture key={match.matchId} match={match} tournamentId={tournamentId}/>)}</div> : <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">No hay próximos partidos confirmados.</div>}</section>
        <section className="pt-7"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black">Resultados</h2><span className="text-xs font-bold text-white/30">Finalizados</span></div>{results.length ? <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#101010]">{results.map((match, index) => <Result key={match.matchId} match={match} tournamentId={tournamentId} divided={index > 0}/>)}</div> : <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">Todavía no hay resultados.</div>}</section>
        {knockouts.length > 0 && <section className="pt-7"><div className="mb-3 px-1"><h2 className="text-base font-black">Fase eliminatoria</h2><p className="mt-1 text-xs text-white/35">Semifinales de ida y vuelta; tiempo extra y penales solo en la vuelta.</p></div><div className="space-y-3"><div className="grid gap-2 sm:grid-cols-2">{semifinalTies.map((tie, index) => { const completed = tie.filter((match) => match.status === "FULLTIME"); const names = [...new Set(tie.flatMap((match) => [match.homeName, match.awayName]))].filter((name) => name !== "To be confirmed"); return <div key={index} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-4"><p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-cyan-300/70">Semifinal {index + 1}</p><p className="mt-2 truncate text-sm font-black">{names.length === 2 ? `${names[0]} vs ${names[1]}` : "Cruce por definir"}</p><p className="mt-2 text-xs font-bold text-white/40">{completed.length}/2 partidos jugados</p><div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">{tie.map((match) => <Link key={match.matchId} to={matchUrl(match)} className="flex justify-between text-xs font-semibold text-white/55"><span>{match.leg === 1 ? "Ida" : "Vuelta"}</span><span>{match.status === "FULLTIME" ? `${match.scoreHome}–${match.scoreAway}` : "Ver partido →"}</span></Link>)}</div></div>; })}</div>{finalMatch && <Link to={matchUrl(finalMatch)} className="block rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-center"><p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-amber-200">Final</p><p className="mt-2 text-sm font-black">{finalMatch.homeName} <span className="text-white/30">vs</span> {finalMatch.awayName}</p></Link>}</div></section>}
      </>}

      {activeSection === "standings" && <section className="pt-5"><div className="mb-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-4"><p className="text-sm font-black text-cyan-100">Todos avanzan a semifinales</p><p className="mt-1 text-xs text-white/45">La posición define los cruces: 1.º vs 4.º y 2.º vs 3.º.</p></div>{standings.length ? <div className="overflow-x-auto rounded-3xl border border-white/[0.07] bg-[#101010]"><div className="min-w-[31rem]"><div className="grid grid-cols-[2rem_1fr_repeat(7,2.2rem)] gap-1 border-b border-white/[0.06] px-4 py-3 text-[0.56rem] font-black uppercase text-white/30"><span>#</span><span>Equipo</span><span className="text-center">PJ</span><span className="text-center">G</span><span className="text-center">E</span><span className="text-center">P</span><span className="text-center">GF</span><span className="text-center">DG</span><span className="text-right">Pts</span></div>{standings.map((row, index) => <div key={row.team} className={`grid grid-cols-[2rem_1fr_repeat(7,2.2rem)] items-center gap-1 px-4 py-4 text-sm ${index ? "border-t border-white/[0.05]" : ""}`}><span className="font-black text-white/35">{index + 1}</span><span className="truncate font-black">{row.team}</span><span className="text-center text-white/55">{row.played}</span><span className="text-center text-white/55">{row.won}</span><span className="text-center text-white/55">{row.drawn}</span><span className="text-center text-white/55">{row.lost}</span><span className="text-center text-white/55">{row.gf}</span><span className="text-center text-white/55">{row.gf - row.ga}</span><span className="text-right font-black">{row.points}</span></div>)}</div></div> : <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">La tabla aparecerá cuando finalice el primer partido.</div>}</section>}

      {activeSection === "stats" && <section className="pt-5">
        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-[#101010] p-4">
          <p className="text-sm font-black">Estadísticas de fútbol</p>
          <p className="mt-1 text-xs text-white/40">Estos datos pertenecen exclusivamente a Champions League y no se mezclan con voleibol.</p>
        </div>
        {playerStats.length ? <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#101010]">
          <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3rem] gap-2 border-b border-white/[0.06] px-4 py-3 text-[0.6rem] font-black uppercase text-white/25"><span>#</span><span>Jugador</span><span className="text-center">G</span><span className="text-center">A</span><span className="text-center">Tarj.</span></div>
          {playerStats.map((player, index) => <Link key={player.playerId} to={`/live/${tournamentId}/player/${player.playerId}`} className={`grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3rem] items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-white/[0.03] ${index ? "border-t border-white/[0.05]" : ""}`}><span className="font-black text-white/30">{index + 1}</span><span className="truncate font-black">{player.name}</span><span className="text-center font-black">{player.goals}</span><span className="text-center text-cyan-200">{player.assists}</span><span className="text-center text-xs">{player.yellow ? `🟨${player.yellow}` : ""}{player.red ? ` 🟥${player.red}` : ""}</span></Link>)}
        </div> : <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">Las estadísticas aparecerán con la primera jugada registrada.</div>}
      </section>}

      {activeSection === "teams" && <section className="pt-5">{teams.length ? <div className="grid gap-3 lg:grid-cols-2 lg:items-start">{teams.map((team) => <details key={team.teamId} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-4"><summary className="flex cursor-pointer list-none items-center gap-3"><TeamBadge name={team.name} logoUrl={team.logoPath} small/><span className="min-w-0 flex-1 truncate text-sm font-black">{team.name}</span><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[0.65rem] font-bold text-white/40">{team.players.length} jugadores</span><span className="text-white/30">⌄</span></summary><div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-4 min-[390px]:grid-cols-2">{team.players.map((player) => <Link key={player.playerId} to={`/live/${tournamentId}/player/${player.playerId}`} className="rounded-xl bg-white/[0.04] px-3 py-2 transition-colors hover:bg-white/[0.08]"><p className="text-sm font-black">{player.name}</p><p className="truncate text-[0.65rem] text-white/35">{player.fullName}</p><p className="mt-2 text-[0.6rem] font-black uppercase tracking-wider text-cyan-200/70">Ver perfil →</p></Link>)}</div></details>)}</div> : <div className="grid gap-2 md:grid-cols-2">{fallbackTeams.map((team) => <div key={team} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#101010] p-4"><TeamBadge name={team} small/><span className="truncate text-sm font-black">{team}</span></div>)}</div>}</section>}
    </main>

    <nav aria-label="Navegación del torneo" className="champions-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-2 backdrop-blur-xl sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:rounded-2xl sm:border sm:px-3 lg:bottom-6">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 sm:gap-2">{sections.map((item) => <NavLink key={item.key} to={item.key === "home" ? `/live/${tournamentId}` : `/live/${tournamentId}/${item.path}`} end={item.key === "home"} className={({ isActive }) => `flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.58rem] font-black transition-colors sm:py-2.5 sm:text-xs ${isActive ? "bg-cyan-300/[0.12] text-cyan-100" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"}`}><NavIcon name={item.key}/><span className="truncate">{item.label}</span></NavLink>)}</div>
    </nav>
  </div>;
};

export default PilotTournament;
