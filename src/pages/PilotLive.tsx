import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";
import { formatClock, formatPhase, getVisibleMatchMs, PilotClockStatus, PilotPhase } from "../pilot/clock";

type PilotLastEvent = {
  eventId: string;
  type: "GOAL" | "SHOT" | "FOUL" | "YELLOW_CARD" | "RED_CARD" | "REVERSAL";
  teamSide?: "HOME" | "AWAY";
  targetEventType?: "GOAL" | "SHOT" | "FOUL" | "YELLOW_CARD" | "RED_CARD";
  clientCreatedAt: number;
};

type PilotMatch = {
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
  status: "READY" | "LIVE" | "FULLTIME";
  phase: PilotPhase;
  clockStatus?: PilotClockStatus;
  phaseElapsedBaseMs?: number;
  runningSinceMs?: number | null;
  periodDurationMs?: number;
  lastEvent?: PilotLastEvent;
};

type PilotTournament = {
  tournamentId: string;
  name: string;
};

const eventLabel = (type: PilotLastEvent["type"]) => {
  switch (type) {
    case "YELLOW_CARD":
      return "YELLOW CARD";
    case "RED_CARD":
      return "RED CARD";
    case "REVERSAL":
      return "CORRECTION";
    default:
      return type;
  }
};

const teamInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "TM";

const TeamMark = ({ name, logoUrl }: { name: string; logoUrl?: string }) => {
  if (logoUrl) {
    return (
      <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white sm:h-24 sm:w-24">
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain p-2" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xl font-black tracking-tight text-white sm:h-24 sm:w-24 sm:text-2xl">
      {teamInitials(name)}
    </div>
  );
};

const PilotLive = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [tournament, setTournament] = useState<PilotTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const matchRef = useMemo(() => doc(db, "pilotMatches", pilotMatchId), [pilotMatchId]);
  const tournamentRef = useMemo(() => doc(db, "pilotTournaments", tournamentId), [tournamentId]);

  useEffect(() => {
    const unsubscribeMatch = onSnapshot(
      matchRef,
      (snap) => {
        setMatch(snap.exists() ? (snap.data() as PilotMatch) : null);
        setLoading(false);
      },
      (err) => {
        console.error("Pilot live snapshot failed", err);
        setError("Live match is temporarily unavailable.");
        setLoading(false);
      }
    );

    const unsubscribeTournament = onSnapshot(
      tournamentRef,
      (snap) => setTournament(snap.exists() ? (snap.data() as PilotTournament) : null),
      (err) => console.error("Pilot tournament snapshot failed", err)
    );

    return () => {
      unsubscribeMatch();
      unsubscribeTournament();
    };
  }, [matchRef, tournamentRef]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] px-4 py-6 text-white">
        <div className="mx-auto max-w-lg animate-pulse space-y-5">
          <div className="h-8 w-40 rounded-lg bg-white/10" />
          <div className="h-[420px] rounded-[2rem] bg-white/[0.05]" />
          <div className="h-40 rounded-3xl bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-[#070707] p-8 text-center font-semibold text-red-300">{error}</div>;
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-[#070707] px-5 py-10 text-white">
        <div className="mx-auto max-w-md text-center">
          <Link to={`/live/${tournamentId}`} className="text-sm font-bold text-white/60">
            ← Tournament
          </Link>
          <h1 className="mt-8 text-3xl font-black tracking-tight">Match not live yet</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            The scorer has not created this match yet. This page will become available as soon as the match is ready.
          </p>
        </div>
      </div>
    );
  }

  const visibleMatchMs = getVisibleMatchMs(match, now);
  const clockStatus = match.clockStatus ?? "NOT_STARTED";
  const lastEventLabel = !match.lastEvent
    ? match.status === "READY"
      ? "Waiting for kickoff"
      : "Waiting for the first event"
    : match.lastEvent.type === "REVERSAL"
      ? `${eventLabel(match.lastEvent.targetEventType ?? "GOAL")} corrected`
      : `${eventLabel(match.lastEvent.type)} · ${match.lastEvent.teamSide === "HOME" ? match.homeName : match.awayName}`;

  const statusLabel = match.phase === "FULLTIME"
    ? "FINAL"
    : match.phase === "HALFTIME"
      ? "HALFTIME"
      : clockStatus === "NOT_STARTED"
        ? "READY"
        : clockStatus === "PAUSED"
          ? "PAUSED"
          : "LIVE";

  const isLive = statusLabel === "LIVE";
  const statusClass = match.phase === "FULLTIME"
    ? "bg-white/10 text-white/70"
    : match.phase === "HALFTIME" || clockStatus === "PAUSED" || clockStatus === "NOT_STARTED"
      ? "bg-amber-400/10 text-amber-200"
      : "bg-red-500/12 text-red-300";

  const stats = [
    ["Shots", match.shotsHome ?? 0, match.shotsAway ?? 0],
    ["Fouls", match.foulsHome ?? 0, match.foulsAway ?? 0],
    ["Yellow cards", match.yellowHome ?? 0, match.yellowAway ?? 0],
    ["Red cards", match.redHome ?? 0, match.redAway ?? 0],
  ] as const;

  const tournamentName = tournament?.name || tournamentId;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <main className="mx-auto max-w-lg px-4 pb-12 pt-4 sm:pt-6">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <Link
            to={`/live/${tournamentId}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-xl text-white/80 transition active:scale-95"
            aria-label="Back to tournament"
          >
            ←
          </Link>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-black tracking-tight">{tournamentName}</p>
            <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/35">{match.matchId}</p>
          </div>

          <div className="h-10 w-10" aria-hidden="true" />
        </header>

        <section className="mt-4 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#111111]">
          <div className="px-5 pb-8 pt-5 sm:px-7">
            <div className="flex items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.12em] ${statusClass}`}>
                {isLive && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                {statusLabel}
              </span>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/35">{formatPhase(match.phase)}</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-white/70">{formatClock(visibleMatchMs)}</p>
            </div>

            <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5">
              <div className="min-w-0 text-center">
                <TeamMark name={match.homeName} logoUrl={match.homeLogoUrl} />
                <p className="mt-4 line-clamp-2 min-h-10 text-sm font-black leading-tight sm:text-base">{match.homeName}</p>
                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Home</p>
              </div>

              <div className="flex min-w-[8.5rem] items-center justify-center pt-4 sm:min-w-[10rem] sm:pt-5">
                <span className="text-[4.5rem] font-black leading-none tracking-[-0.08em] tabular-nums sm:text-[5.5rem]">{match.scoreHome}</span>
                <span className="mx-2 pb-1 text-3xl font-light text-white/20 sm:mx-3">–</span>
                <span className="text-[4.5rem] font-black leading-none tracking-[-0.08em] tabular-nums sm:text-[5.5rem]">{match.scoreAway}</span>
              </div>

              <div className="min-w-0 text-center">
                <TeamMark name={match.awayName} logoUrl={match.awayLogoUrl} />
                <p className="mt-4 line-clamp-2 min-h-10 text-sm font-black leading-tight sm:text-base">{match.awayName}</p>
                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Away</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07] bg-black/20 px-5 py-4 sm:px-7">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Latest update</p>
                <p className="mt-1 truncate text-sm font-bold text-white/85">{lastEventLabel}</p>
              </div>
              {isLive && <span className="shrink-0 text-[0.65rem] font-black uppercase tracking-[0.14em] text-red-300">Live</span>}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/[0.07] bg-[#101010] px-5 py-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-black tracking-tight">Match stats</h2>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/30">Live</span>
          </div>

          <div className="space-y-4">
            {stats.map(([label, home, away]) => (
              <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <span className="text-right text-base font-black tabular-nums">{home}</span>
                <span className="min-w-24 text-center text-xs font-semibold text-white/40">{label}</span>
                <span className="text-left text-base font-black tabular-nums">{away}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PilotLive;
