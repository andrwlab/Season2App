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
type EventType = "GOAL" | "SHOT" | "FOUL" | "YELLOW_CARD" | "RED_CARD";
type StoredEventType = EventType | "REVERSAL";

type PilotLastEvent = {
  eventId: string;
  type: StoredEventType;
  teamSide?: TeamSide;
  targetEventId?: string;
  targetEventType?: EventType;
  clientCreatedAt: number;
};

type PilotMatch = {
  tournamentId: string;
  matchId: string;
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  shotsHome: number;
  shotsAway: number;
  foulsHome: number;
  foulsAway: number;
  yellowHome: number;
  yellowAway: number;
  redHome: number;
  redAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: "FIRST_HALF" | "HALFTIME" | "SECOND_HALF" | "FULLTIME";
  lastEvent?: PilotLastEvent;
};

const getCounterField = (type: EventType, side: TeamSide) => {
  const suffix = side === "HOME" ? "Home" : "Away";
  switch (type) {
    case "GOAL":
      return `score${suffix}` as const;
    case "SHOT":
      return `shots${suffix}` as const;
    case "FOUL":
      return `fouls${suffix}` as const;
    case "YELLOW_CARD":
      return `yellow${suffix}` as const;
    case "RED_CARD":
      return `red${suffix}` as const;
  }
};

const getEventLabel = (type: StoredEventType) => {
  switch (type) {
    case "YELLOW_CARD":
      return "YELLOW";
    case "RED_CARD":
      return "RED";
    case "REVERSAL":
      return "REVERSAL";
    default:
      return type;
  }
};

const PilotScorer = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [homeName, setHomeName] = useState("Team A");
  const [awayName, setAwayName] = useState("Team B");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchRef = useMemo(() => doc(db, "pilotMatches", pilotMatchId), [pilotMatchId]);

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
        matchId,
        homeName: homeName.trim() || "Team A",
        awayName: awayName.trim() || "Team B",
        scoreHome: 0,
        scoreAway: 0,
        shotsHome: 0,
        shotsAway: 0,
        foulsHome: 0,
        foulsAway: 0,
        yellowHome: 0,
        yellowAway: 0,
        redHome: 0,
        redAway: 0,
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

  const recordEvent = async (type: EventType, teamSide: TeamSide) => {
    if (!match || busy) return;
    setBusy(true);
    setError(null);

    try {
      const eventRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      const lastEvent: PilotLastEvent = {
        eventId: eventRef.id,
        type,
        teamSide,
        clientCreatedAt,
      };

      batch.set(eventRef, {
        version: 1,
        eventId: eventRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        sport: "football",
        type,
        teamSide,
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      batch.update(matchRef, {
        [getCounterField(type, teamSide)]: increment(1),
        lastEvent,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      console.error(`Failed to record pilot ${type}`, err);
      setError(`${getEventLabel(type)} was not saved. Try again before continuing.`);
    } finally {
      setBusy(false);
    }
  };

  const undoLastEvent = async () => {
    if (!match?.lastEvent || match.lastEvent.type === "REVERSAL" || !match.lastEvent.teamSide || busy) return;

    const target = match.lastEvent;
    const targetType = target.type as EventType;
    const field = getCounterField(targetType, target.teamSide);
    const currentValue = Number(match[field] ?? 0);
    if (currentValue <= 0) return;

    setBusy(true);
    setError(null);
    try {
      const reversalRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      const reversal: PilotLastEvent = {
        eventId: reversalRef.id,
        type: "REVERSAL",
        targetEventId: target.eventId,
        targetEventType: targetType,
        teamSide: target.teamSide,
        clientCreatedAt,
      };

      batch.set(reversalRef, {
        version: 1,
        eventId: reversalRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        sport: "football",
        type: "REVERSAL",
        revertsEventId: target.eventId,
        revertsEventType: targetType,
        teamSide: target.teamSide,
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      batch.update(matchRef, {
        [field]: increment(-1),
        lastEvent: reversal,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (err) {
      console.error("Failed to undo pilot event", err);
      setError("Undo failed. Do not continue until the match state is correct.");
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
            <p className="mt-2 text-sm text-slate-400">Temporary football match, isolated from Season 2 players and rosters.</p>
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

  const canUndo = Boolean(match.lastEvent && match.lastEvent.type !== "REVERSAL");
  const lastLabel = !match.lastEvent
    ? "No events yet"
    : match.lastEvent.type === "REVERSAL"
      ? `${getEventLabel(match.lastEvent.targetEventType ?? "GOAL")} corrected`
      : `${getEventLabel(match.lastEvent.type)} · ${match.lastEvent.teamSide === "HOME" ? match.homeName : match.awayName}`;

  const TeamLane = ({ side }: { side: TeamSide }) => {
    const isHome = side === "HOME";
    const teamName = isHome ? match.homeName : match.awayName;
    const buttonBase = "w-full rounded-xl px-2 font-black active:scale-[0.98] disabled:opacity-50";

    return (
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="truncate px-1 text-center text-sm font-black">{teamName}</div>
        <button
          type="button"
          disabled={busy}
          onClick={() => recordEvent("GOAL", side)}
          className={`${buttonBase} min-h-20 ${isHome ? "bg-blue-600" : "bg-fuchsia-700"} text-lg text-white`}
        >
          GOAL +1
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => recordEvent("SHOT", side)} className={`${buttonBase} min-h-14 bg-slate-800 text-sm text-white`}>
            SHOT +
          </button>
          <button type="button" disabled={busy} onClick={() => recordEvent("FOUL", side)} className={`${buttonBase} min-h-14 bg-slate-800 text-sm text-white`}>
            FOUL +
          </button>
          <button type="button" disabled={busy} onClick={() => recordEvent("YELLOW_CARD", side)} className={`${buttonBase} min-h-14 bg-amber-300 text-xs text-slate-950`}>
            YELLOW
          </button>
          <button type="button" disabled={busy} onClick={() => recordEvent("RED_CARD", side)} className={`${buttonBase} min-h-14 bg-red-600 text-xs text-white`}>
            RED
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-lg space-y-3">
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
          <TeamLane side="HOME" />
          <TeamLane side="AWAY" />
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Shots</div><div className="mt-1 font-black">{match.shotsHome ?? 0}–{match.shotsAway ?? 0}</div></div>
          <div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Fouls</div><div className="mt-1 font-black">{match.foulsHome ?? 0}–{match.foulsAway ?? 0}</div></div>
          <div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Yellow</div><div className="mt-1 font-black">{match.yellowHome ?? 0}–{match.yellowAway ?? 0}</div></div>
          <div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Red</div><div className="mt-1 font-black">{match.redHome ?? 0}–{match.redAway ?? 0}</div></div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Last event</p>
          <p className="mt-1 font-bold">{lastLabel}</p>
          <button
            type="button"
            onClick={undoLastEvent}
            disabled={!canUndo || busy}
            className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {canUndo ? `UNDO ${getEventLabel(match.lastEvent!.type)}` : "NOTHING TO UNDO"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</div>
        )}
      </div>
    </div>
  );
};

export default PilotScorer;
