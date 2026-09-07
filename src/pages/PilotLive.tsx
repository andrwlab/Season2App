import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "react-router-dom";
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

const PilotLive = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const matchRef = useMemo(() => doc(db, "pilotMatches", pilotMatchId), [pilotMatchId]);

  useEffect(() => {
    return onSnapshot(
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
  }, [matchRef]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 p-8 text-center text-slate-400">Loading live match...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-slate-950 p-8 text-center font-semibold text-red-300">{error}</div>;
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-md text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Pilot 0</p>
          <h1 className="mt-3 text-3xl font-black">Match not live yet</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">The scorer has not created this match yet. Keep this page open and refresh once the match is ready.</p>
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

  const statusClass = match.phase === "FULLTIME"
    ? "border-slate-400/30 bg-slate-400/10 text-slate-200"
    : match.phase === "HALFTIME" || clockStatus === "PAUSED" || clockStatus === "NOT_STARTED"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-red-400/30 bg-red-500/10 text-red-200";

  const stats = [
    ["Shots", match.shotsHome ?? 0, match.shotsAway ?? 0],
    ["Fouls", match.foulsHome ?? 0, match.foulsAway ?? 0],
    ["Yellow", match.yellowHome ?? 0, match.yellowAway ?? 0],
    ["Red", match.redHome ?? 0, match.redAway ?? 0],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Live Score · Pilot 0</p>
            <p className="mt-1 text-xs text-slate-500">{tournamentId}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass}`}>{statusLabel}</span>
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
          <div className="px-5 pb-6 pt-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{formatPhase(match.phase)}</p>
            <p className="mt-2 font-mono text-2xl font-black text-cyan-300">{formatClock(visibleMatchMs)}</p>

            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="min-w-0">
                <p className="truncate text-base font-black sm:text-lg">{match.homeName}</p>
                <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-500">Home</p>
              </div>

              <div className="text-6xl font-black tracking-[-0.08em] sm:text-7xl">
                {match.scoreHome}<span className="mx-2 text-slate-600">–</span>{match.scoreAway}
              </div>

              <div className="min-w-0">
                <p className="truncate text-base font-black sm:text-lg">{match.awayName}</p>
                <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-500">Away</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] border-t border-white/10 bg-black/10 px-5 py-4 text-center">
            <div className="space-y-3 text-right">
              {stats.map(([label, home]) => <div key={label} className="font-black">{home}</div>)}
            </div>
            <div className="space-y-3 px-7 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-500">
              {stats.map(([label]) => <div key={label}>{label}</div>)}
            </div>
            <div className="space-y-3 text-left">
              {stats.map(([label, , away]) => <div key={label} className="font-black">{away}</div>)}
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/20 px-5 py-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Latest update</p>
            <p className="mt-1 text-sm font-bold text-slate-100">{lastEventLabel}</p>
          </div>
        </section>

        <p className="mx-auto mt-5 max-w-sm text-center text-xs leading-relaxed text-slate-500">
          Public Pilot 0 live view. No login or installation required.
        </p>
      </main>
    </div>
  );
};

export default PilotLive;
