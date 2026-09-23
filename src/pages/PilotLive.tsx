import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PilotEventFeed from "../components/PilotEventFeed";
import PilotMatchTimeline from "../components/PilotMatchTimeline";
import PilotMomentsRail from "../components/PilotMomentsRail";
import { db } from "../firebase";
import { assetUrl, FOOTBALL_2026_TOURNAMENT_ID, footballMatchDate, normalizeFootballMatch } from "../pilot/footballTournament";
import useAudienceTracking from "../hooks/useAudienceTracking";
import {
  DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS,
  DEFAULT_PERIOD_DURATION_MS,
  formatClock,
  formatPhase,
  getClockDisplayParts,
  PilotClockStatus,
  PilotPhase,
} from "../pilot/clock";

type PilotMatch = {
  scheduledDate?: string | null;
  stage?: string;
  leg?: number;
  matchday?: number;
  homePlayers?: { playerId: string; name: string }[];
  awayPlayers?: { playerId: string; name: string }[];
  homeStarterIds?: string[];
  awayStarterIds?: string[];
  lineupsConfirmed?: boolean;
  tournamentId: string;
  matchId: string;
  homeName: string;
  awayName: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  scoreHome: number;
  scoreAway: number;
  shotsHome?: number;
  shotsAway?: number;
  foulsHome?: number;
  foulsAway?: number;
  yellowHome?: number;
  yellowAway?: number;
  redHome?: number;
  redAway?: number;
  penaltyHome?: number;
  penaltyAway?: number;
  penaltyAttemptsHome?: number;
  penaltyAttemptsAway?: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: PilotPhase;
  clockStatus?: PilotClockStatus;
  phaseElapsedBaseMs?: number;
  runningSinceMs?: number | null;
  periodDurationMs?: number;
  extraTimePeriodDurationMs?: number;
  completedMatchClockMs?: number;
};

type PilotTournament = { tournamentId: string; name: string };

const teamInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "TM";

const TeamMark = ({ name, logoUrl }: { name: string; logoUrl?: string }) => {
  if (logoUrl) {
    return <img src={assetUrl(logoUrl)} alt={`${name} logo`} className="mx-auto h-16 w-16 object-contain min-[400px]:h-20 min-[400px]:w-20 sm:h-24 sm:w-24" />;
  }
  return <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-lg font-black tracking-tight text-white min-[400px]:h-20 min-[400px]:w-20 min-[400px]:text-xl sm:h-24 sm:w-24 sm:text-2xl">{teamInitials(name)}</div>;
};

const isTimedPhase = (phase: PilotPhase) =>
  phase === "FIRST_HALF" || phase === "SECOND_HALF" || phase === "EXTRA_TIME_FIRST_HALF" || phase === "EXTRA_TIME_SECOND_HALF";

const statusFor = (phase: PilotPhase, clockStatus: PilotClockStatus) => {
  if (phase === "FULLTIME") return "FINAL";
  if (phase === "PENALTIES") return "PENALTIES";
  if (phase === "HALFTIME") return "HALFTIME";
  if (phase === "EXTRA_TIME_HALFTIME") return "ET HALF";
  if (phase === "REGULATION_END") return "REG END";
  if (phase === "EXTRA_TIME_END") return "ET END";
  if (clockStatus === "NOT_STARTED") return "READY";
  if (clockStatus === "PAUSED") return "PAUSED";
  return "LIVE";
};

const PilotLive = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const matchTabs = [{ key: "summary", label: "Resumen" }, { key: "events", label: "Jugadas" }, { key: "stats", label: "Estadísticas" }, { key: "lineups", label: "Alineaciones" }];
  const activeTab = matchTabs.some((tab) => tab.key === searchParams.get("tab")) ? searchParams.get("tab")! : "summary";
  const selectTab = (key: string) => setSearchParams((previous) => { const next = new URLSearchParams(previous); next.set("tab", key); return next; }, { replace: true });
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [tournament, setTournament] = useState<PilotTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useAudienceTracking({ tournamentId, matchId, scope: "MATCH" });

  const matchRef = useMemo(() => doc(db, "pilotMatches", pilotMatchId), [pilotMatchId]);
  const tournamentRef = useMemo(() => doc(db, "pilotTournaments", tournamentId), [tournamentId]);

  useEffect(() => {
    const unsubscribeMatch = onSnapshot(matchRef, (snap) => {
      setMatch(snap.exists() ? normalizeFootballMatch(snap.data() as PilotMatch) : null);
      setLoading(false);
    }, (err) => {
      console.error("Pilot live snapshot failed", err);
      setError("Live match is temporarily unavailable.");
      setLoading(false);
    });
    const unsubscribeTournament = onSnapshot(tournamentRef,
      (snap) => setTournament(snap.exists() ? (snap.data() as PilotTournament) : null),
      (err) => console.error("Pilot tournament snapshot failed", err)
    );
    return () => { unsubscribeMatch(); unsubscribeTournament(); };
  }, [matchRef, tournamentRef]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const name = tournamentId === FOOTBALL_2026_TOURNAMENT_ID ? "Champions League" : tournament?.name || tournamentId;
    const previousTitle = document.title;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousThemeColor = themeColor?.content;
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = assetUrl("champions-league-eagle-logo-web.png") || "";
    favicon.dataset.championsFavicon = "true";
    document.head.appendChild(favicon);
    document.title = match ? `${match.homeName} vs ${match.awayName} | ${name}` : `Partido | ${name}`;
    if (themeColor) themeColor.content = "#06145f";
    return () => {
      document.title = previousTitle;
      if (themeColor && previousThemeColor) themeColor.content = previousThemeColor;
      favicon.remove();
    };
  }, [match, tournament?.name, tournamentId]);

  if (loading) return <div className="champions-shell min-h-[100dvh] px-4 pb-8 pt-[max(env(safe-area-inset-top),1.25rem)] text-white"><div className="mx-auto max-w-3xl animate-pulse space-y-5"><div className="h-8 w-40 rounded-lg bg-white/10" /><div className="h-[420px] rounded-[2rem] bg-white/[0.05]" /><div className="h-40 rounded-3xl bg-white/[0.05]" /></div></div>;
  if (error) return <div className="champions-shell min-h-[100dvh] px-6 pb-8 pt-[max(env(safe-area-inset-top),2rem)] text-center font-semibold text-red-300">{error}</div>;
  if (!match) return <div className="champions-shell min-h-[100dvh] px-5 pb-10 pt-[max(env(safe-area-inset-top),2.5rem)] text-white"><div className="mx-auto max-w-md text-center"><Link to={`/live/${tournamentId}`} className="text-sm font-bold text-white/60">← Tournament</Link><h1 className="mt-8 text-3xl font-black tracking-tight">Match not live yet</h1><p className="mt-3 text-sm leading-relaxed text-white/45">The scorer has not created this match yet. This page will become available as soon as the match is ready.</p></div></div>;

  const clockStatus = match.clockStatus ?? "NOT_STARTED";
  const clockParts = getClockDisplayParts(match, now);
  const statusLabel = statusFor(match.phase, clockStatus);
  const isLive = statusLabel === "LIVE";
  const statusClass = match.phase === "FULLTIME"
    ? "bg-white/10 text-white/70"
    : match.phase === "PENALTIES"
      ? "bg-cyan-300/[0.12] text-cyan-200"
      : match.phase === "HALFTIME" || match.phase === "EXTRA_TIME_HALFTIME" || match.phase === "REGULATION_END" || match.phase === "EXTRA_TIME_END" || clockStatus === "PAUSED" || clockStatus === "NOT_STARTED"
        ? "bg-amber-400/10 text-amber-200"
        : "bg-red-500/[0.12] text-red-300";

  const stats = [
    ["Remates", match.shotsHome ?? 0, match.shotsAway ?? 0],
    ["Faltas", match.foulsHome ?? 0, match.foulsAway ?? 0],
    ["Amarillas", match.yellowHome ?? 0, match.yellowAway ?? 0],
    ["Rojas", match.redHome ?? 0, match.redAway ?? 0],
  ] as const;
  const tournamentName = tournamentId === FOOTBALL_2026_TOURNAMENT_ID ? "Champions League" : tournament?.name || tournamentId;
  const hasPenalties = (match.penaltyAttemptsHome ?? 0) + (match.penaltyAttemptsAway ?? 0) > 0 || match.phase === "PENALTIES";
  const periodDurationMs = match.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS;
  const extraTimePeriodDurationMs = match.extraTimePeriodDurationMs ?? DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS;
  const tournamentHubUrl = typeof window === "undefined"
    ? ""
    : `${window.location.origin}${window.location.pathname.split("/live/")[0]}/live/${encodeURIComponent(tournamentId)}`;
  const tournamentQrTargetUrl = tournamentHubUrl ? `${tournamentHubUrl}?src=qr` : "";
  const tournamentQrUrl = tournamentQrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(tournamentQrTargetUrl)}`
    : "";
  return (
    <div className="champions-shell min-h-[100dvh] text-white">
      <main className="relative z-10 mx-auto max-w-3xl px-3 pb-[max(env(safe-area-inset-bottom),3rem)] pt-[max(env(safe-area-inset-top),1rem)] min-[430px]:px-4 sm:px-6 sm:pt-6">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <Link to={`/live/${tournamentId}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-xl text-white/80 transition active:scale-95" aria-label="Back to tournament">←</Link>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center"><img src={assetUrl("champions-league-eagle-logo-web.png")} alt="" className="h-12 w-12 shrink-0 object-contain"/><div className="min-w-0"><p className="champions-wordmark truncate text-sm font-black tracking-tight">{tournamentName}</p><p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white/35">{match.matchId}</p></div></div>
          <div className="h-10 w-10" aria-hidden="true" />
        </header>

        {tournamentQrUrl && (
          <Link to={`/live/${tournamentId}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#101010] p-3 active:scale-[0.99]" aria-label="Open tournament home">
            <div className="shrink-0 rounded-xl bg-white p-1.5">
              <img src={tournamentQrUrl} alt={`QR code for ${tournamentName} tournament home`} className="h-20 w-20" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-cyan-300">Tournament QR</p>
              <p className="mt-1 text-sm font-black">Scan to open {tournamentName}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Same QR as the tournament home. It opens the tournament hub, not this individual match.</p>
            </div>
            <span className="text-xl text-white/25">›</span>
          </Link>
        )}

        <section className="champions-match-stage mt-4 overflow-hidden rounded-[2rem] border border-white/[0.1]">
          <div className="px-5 pb-8 pt-5 sm:px-7">
            <div className="flex items-center justify-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.12em] ${statusClass}`}>{isLive && <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-400" />}{statusLabel}</span></div>
            <div className="mt-4 text-center">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/35">{formatPhase(match.phase)}</p>
              {match.phase === "PENALTIES" ? (
                <p className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-cyan-300">Shootout in progress</p>
              ) : (
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-white/70">
                  <span>{formatClock(clockParts.mainMs)}</span>
                  {clockParts.isAddedTime && <span className="ml-1.5 font-black text-cyan-300">+ {formatClock(clockParts.addedMs)}</span>}
                </p>
              )}
            </div>

            <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-start gap-1 min-[400px]:gap-3 sm:gap-5">
              <div className="min-w-0 text-center"><TeamMark name={match.homeName} logoUrl={match.homeLogoUrl} /><p className="mt-4 line-clamp-2 min-h-10 text-sm font-black leading-tight sm:text-base">{match.homeName}</p><p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Home</p></div>
              <div key={`${match.scoreHome}-${match.scoreAway}-${match.penaltyHome ?? 0}-${match.penaltyAway ?? 0}`} className="score-pop flex min-w-[6.5rem] flex-col items-center justify-center pt-4 min-[400px]:min-w-[8.5rem] sm:min-w-[10rem] sm:pt-5">
                <div className="flex items-center justify-center"><span className="text-[3.4rem] font-black leading-none tracking-[-0.08em] tabular-nums min-[400px]:text-[4.5rem] sm:text-[5.5rem]">{match.scoreHome}</span><span className="mx-1 pb-1 text-2xl font-light text-white/20 min-[400px]:mx-2 min-[400px]:text-3xl sm:mx-3">–</span><span className="text-[3.4rem] font-black leading-none tracking-[-0.08em] tabular-nums min-[400px]:text-[4.5rem] sm:text-[5.5rem]">{match.scoreAway}</span></div>
                {hasPenalties && <div className="mt-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs font-black text-cyan-200">PEN {match.penaltyHome ?? 0}–{match.penaltyAway ?? 0}</div>}
              </div>
              <div className="min-w-0 text-center"><TeamMark name={match.awayName} logoUrl={match.awayLogoUrl} /><p className="mt-4 line-clamp-2 min-h-10 text-sm font-black leading-tight sm:text-base">{match.awayName}</p><p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Away</p></div>
            </div>
          </div>
        </section>

        <div role="tablist" aria-label="Información del partido" className="mt-5 grid grid-cols-4 gap-1 rounded-2xl bg-slate-950/80 p-1">
          {matchTabs.map((tab, index) => <button key={tab.key} id={`match-tab-${tab.key}`} role="tab" type="button" aria-selected={activeTab === tab.key} aria-controls={`match-panel-${tab.key}`} tabIndex={activeTab === tab.key ? 0 : -1} onClick={() => selectTab(tab.key)} onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % matchTabs.length;
            else if (event.key === "ArrowLeft") next = (index + matchTabs.length - 1) % matchTabs.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = matchTabs.length - 1;
            else return;
            event.preventDefault(); selectTab(matchTabs[next].key); document.getElementById(`match-tab-${matchTabs[next].key}`)?.focus();
          }} className={`min-h-12 rounded-xl px-1 text-[0.65rem] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 sm:text-sm ${activeTab === tab.key ? "bg-cyan-300/15 text-cyan-100" : "text-slate-300"}`}>{tab.label}</button>)}
        </div>
        <div role="tabpanel" id={`match-panel-${activeTab}`} aria-labelledby={`match-tab-${activeTab}`} tabIndex={0}>
        {activeTab === "summary" && <>
          <section className="champions-match-panel mt-5 rounded-3xl border border-white/10 p-5">
            <h2 className="font-black">Resumen del partido</h2>
            <p className="mt-2 text-sm text-blue-100">{(() => { const date = footballMatchDate(match); return date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "Fecha por confirmar"; })()}</p>
            <p className="mt-2 text-sm text-slate-300">{match.phase === "FULLTIME" ? "Partido finalizado. Consulta las jugadas y estadísticas." : match.status === "READY" ? "El encuentro aún no ha comenzado. Consulta las alineaciones antes del inicio." : "Sigue las jugadas y estadísticas en sus pestañas."}</p>
          </section>
          <PilotMomentsRail pilotMatchId={pilotMatchId} />
          <PilotMatchTimeline pilotMatchId={pilotMatchId} />
        </>}
        {activeTab === "stats" && <section className="champions-match-panel mt-5 rounded-3xl border border-white/[0.09] px-5 py-5">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-base font-black tracking-tight">Estadísticas del partido</h2><span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/30">{match.phase === "FULLTIME" ? "Final" : isTimedPhase(match.phase) ? "En vivo" : "Partido"}</span></div>
          <div className="space-y-4">{stats.map(([label, home, away]) => <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4"><span className="text-right text-base font-black tabular-nums">{home}</span><span className="min-w-24 text-center text-xs font-semibold text-white/40">{label}</span><span className="text-left text-base font-black tabular-nums">{away}</span></div>)}</div>
        </section>}

        {activeTab === "events" && <section className="champions-match-panel mt-5 overflow-hidden rounded-3xl border border-white/[0.09]">
          <PilotEventFeed pilotMatchId={pilotMatchId} homeName={match.homeName} awayName={match.awayName} periodDurationMs={periodDurationMs} extraTimePeriodDurationMs={extraTimePeriodDurationMs} />
        </section>}
        {activeTab === "lineups" && <section className="mt-5 space-y-4">
          <h2 className="font-black">Alineaciones iniciales</h2>
          {!match.lineupsConfirmed && <p className="text-sm text-blue-100">Titulares pendientes de confirmación. Se muestra la plantilla disponible.</p>}
          <div className="grid gap-4 sm:grid-cols-2">{[
            { name: match.homeName, players: match.homePlayers ?? [], starters: match.homeStarterIds ?? [] },
            { name: match.awayName, players: match.awayPlayers ?? [], starters: match.awayStarterIds ?? [] },
          ].map((team, index) => <div key={index} className="champions-match-panel rounded-3xl border border-white/10 p-4">
            <h3 className="font-black">{team.name}</h3>
            {team.players.length === 0 && <p className="mt-3 text-sm text-slate-300">Plantilla por confirmar.</p>}
            {(match.lineupsConfirmed ? ["Titulares", "Suplentes"] : ["Plantilla"]).map((group) => <div key={group} className="mt-4"><h4 className="text-xs font-bold text-cyan-200">{group}</h4><ul className="mt-2 space-y-1">{team.players.filter((player) => group === "Plantilla" || (group === "Titulares") === team.starters.includes(player.playerId)).map((player) => <li key={player.playerId}><Link className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-white/10" to={`/live/${tournamentId}/player/${player.playerId}`}>{player.name}</Link></li>)}</ul></div>)}
          </div>)}</div>
        </section>}
        </div>
      </main>
    </div>
  );
};

export default PilotLive;
