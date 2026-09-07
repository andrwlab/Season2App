import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

type TeamSide = "HOME" | "AWAY";

type PilotLastEvent = {
  eventId: string;
  type: "GOAL" | "REVERSAL";
  teamSide?: TeamSide;
  targetEventId?: string;
  clientCreatedAt: number;
};

type PilotMatch = {
  tournamentId: string;
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: "FIRST_HALF" | "HALFTIME" | "SECOND_HALF" | "FULLTIME";
  lastEvent?: PilotLastEvent;
};

const PilotScorer = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [homeName, setHomeName] = useState("Team A");
  const [awayName, setAwayName] = useState("Team B");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchRef = useMemo(
    () => doc(db, "liveTournaments", tournamentId, "matches", matchId),
    [matchId, tournamentId]
  );

  useEffect(() => {
    return onSnapshot(
      matchRef,
      (snap) => {
        setExists(snap.exists());
        setMatch(snap.exists() ? (snap.data() as PilotMatch) : null);
      },
      (err) => {
        console.error("Pilot scorer snapshot failed", err);
        setError("Could not load the pilot match.");
      }
    );
  }, [matchRef]);

  const createPilotMatch = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setDoc(matchRef, {
        tournamentId,
        homeName: homeName.trim() || "Team A",
        awayName: awayName.trim() || "Team B",
        scoreHome: 0,
        scoreAway: 0,
        status: "LIVE",
        phase: "FIRST_HALF",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to create pilot match", err);
      setError("Could not create the match. Make sure you are signed in as admin.");
    } finally {
      setBusy(false);
    }
  };

  const addGoal = async (teamSide: TeamSide) => {
    if (!match || busy) return;
    setBusy(true);
    setError(null);
    try {
      const eventRef = doc(collection(matchRef, "events"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      const lastEvent: PilotLastEvent = {
        eventId: eventRef.id,
        type: "GOAL",
        teamSide,
        clientCreatedAt,
      };

      batch.set(eventRef, {
        version: 1,
        eventId: eventRef.id,
        tournamentId,
        matchId,
        sport: "football",
        type: "GOAL",
        teamSide,
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      batch.update(matchRef, {
        [teamSide === "HOME" ? "scoreHome" : "scoreAway"]: increment(1),
        lastEvent,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      console.error("Failed to record pilot goal", err);
      setError("Goal was not saved. Try again before continuing.");
    } finally {
      setBusy(false);
    }
  };

  const undoLastGoal = async () => {
    if (!match?.lastEvent || match.lastEvent.type !== "GOAL" || busy) return;
    const target = match.lastEvent;
    const currentScore = target.teamSide === "HOME" ? match.scoreHome : match.scoreAway;
    if (!target.teamSide || currentScore <= 0) return;

    setBusy(true);
    setError(null);
    try {
      const reversalRef = doc(collection(matchRef, "events"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      const reversal: PilotLastEvent = {
        eventId: reversalRef.id,
        type: "REVERSAL",
        targetEventId: target.eventId,
        teamSide: target.teamSide,
        clientCreatedAt,
      };

      batch.set(reversalRef, {
        version: 1,
        eventId: reversalRef.id,
        tournamentId,
        matchId,
        sport: "football",
        type: "REVERSAL",
        revertsEventId: target.eventId,
        teamSide: target.teamSide,
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      batch.update(matchRef, {
        [target.teamSide === "HOME" ? "scoreHome" : "scoreAway"]: increment(-1),
        lastEvent: reversal,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      console.error("Failed to undo pilot goal", err);
      setError("Undo failed. Do not continue until the score is correct.");
    } finally {
      setBusy(false);
    }
  };

  if (exists === null) {
    return <div className="p-6 text-center text-muted">Loading Pilot 0...</div>;
  }

  if (!exists) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Pilot 0</p>
            <h1 className="mt-2 text-3xl font-black">Create live match</h1>
            <p className="mt-2 text-sm text-slate-400">This is a temporary match isolated from the Season 2 player database.</p>
          </div>

          <form onSubmit={createPilotMatch} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Home</span>
              <input
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-cyan-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Away</span>
              <input
                value={awayName}
                onChange={(e) => setAwayName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-cyan-400"
              />
            </label>
            {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-cyan-300 px-4 py-4 text-base font-black text-slate-950 disabled:opacity-50"
            >
              {busy ? "Creating..." : "CREATE PILOT MATCH"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const canUndo = match.lastEvent?.type === "GOAL";
  const lastLabel = match.lastEvent
    ? match.lastEvent.type === "GOAL"
      ? `GOAL · ${match.lastEvent.teamSide === "HOME" ? match.homeName : match.awayName}`
      : "REVERSAL · last goal corrected"
    : "No events yet";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Pilot 0 · Match Control</p>
            <p className="mt-1 text-xs text-slate-500">{tournamentId} / {matchId}</p>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">LIVE</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="truncate text-sm font-black">{match.homeName}</div>
            <div className="text-5xl font-black tracking-tight">{match.scoreHome}–{match.scoreAway}</div>
            <div className="truncate text-sm font-black">{match.awayName}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => addGoal("HOME")}
            className="min-h-28 rounded-2xl bg-blue-600 px-3 text-xl font-black shadow-lg shadow-blue-950/30 active:scale-[0.98] disabled:opacity-50"
          >
            GOAL +1
            <span className="mt-2 block text-xs font-bold opacity-80">{match.homeName}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => addGoal("AWAY")}
            className="min-h-28 rounded-2xl bg-fuchsia-700 px-3 text-xl font-black shadow-lg shadow-fuchsia-950/30 active:scale-[0.98] disabled:opacity-50"
          >
            GOAL +1
            <span className="mt-2 block text-xs font-bold opacity-80">{match.awayName}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Last event</p>
          <p className="mt-1 font-bold">{lastLabel}</p>
          <button
            type="button"
            onClick={undoLastGoal}
            disabled={!canUndo || busy}
            className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-4 font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {canUndo ? "UNDO LAST GOAL" : "NOTHING TO UNDO"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</div>
        )}

        <p className="px-2 text-center text-xs leading-relaxed text-slate-500">
          Pilot 0 only: Goal → Firestore event + live score → public spectator view.
        </p>
      </div>
    </div>
  );
};

export default PilotScorer;
