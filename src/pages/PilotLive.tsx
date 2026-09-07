import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase";

type PilotLastEvent = {
  eventId: string;
  type: "GOAL" | "REVERSAL";
  teamSide?: "HOME" | "AWAY";
  clientCreatedAt: number;
};

type PilotMatch = {
  tournamentId: string;
  matchId: string;
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: "FIRST_HALF" | "HALFTIME" | "SECOND_HALF" | "FULLTIME";
  lastEvent?: PilotLastEvent;
};

const PilotLive = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const lastEventLabel = !match.lastEvent
    ? "Waiting for the first event"
    : match.lastEvent.type === "GOAL"
      ? `GOAL · ${match.lastEvent.teamSide === "HOME" ? match.homeName : match.awayName}`
      : "Score corrected";

  const phaseLabel = match.phase.replaceAll("_", " ");

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <main className="mx-auto max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Live Score · Pilot 0</p>
            <p className="mt-1 text-xs text-slate-500">{tournamentId}</p>
          </div>
          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200">LIVE</span>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
          <div className="px-5 pb-6 pt-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{phaseLabel}</p>

            <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
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

          <div className="border-t border-white/10 bg-black/20 px-5 py-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Latest update</p>
            <p className="mt-1 text-sm font-bold text-slate-100">{lastEventLabel}</p>
          </div>
        </section>

        <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-relaxed text-slate-500">
          This is the first live-data pilot. Keep this page open while the scorer updates the match.
        </p>
      </main>
    </div>
  );
};

export default PilotLive;
