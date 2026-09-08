import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS,
  DEFAULT_PERIOD_DURATION_MS,
  getPhaseNominalDurationMs,
  getPhaseOfficialStartMs,
  PilotPhase,
} from "../pilot/clock";

type TeamSide = "HOME" | "AWAY";
type MatchEventType = "GOAL" | "SHOT" | "FOUL" | "YELLOW_CARD" | "RED_CARD";
type PenaltyEventType = "PENALTY_GOAL" | "PENALTY_MISS";
type VisibleEventType = MatchEventType | PenaltyEventType;

type PilotEvent = {
  eventId: string;
  type: VisibleEventType | "REVERSAL" | "MATCH_START" | "CLOCK_PAUSE" | "CLOCK_RESUME" | "HALFTIME" | "SECOND_HALF_START" | "REGULATION_END" | "EXTRA_TIME_START" | "EXTRA_TIME_HALFTIME" | "EXTRA_TIME_SECOND_HALF_START" | "EXTRA_TIME_END" | "PENALTIES_START" | "FULLTIME";
  teamSide?: TeamSide;
  playerId?: string | null;
  playerName?: string | null;
  assistPlayerId?: string | null;
  assistPlayerName?: string | null;
  phase?: PilotPhase;
  matchClockMs?: number;
  clientCreatedAt?: number;
  revertsEventId?: string;
  status?: string;
};

const visibleTypes = new Set<VisibleEventType>([
  "GOAL",
  "SHOT",
  "FOUL",
  "YELLOW_CARD",
  "RED_CARD",
  "PENALTY_GOAL",
  "PENALTY_MISS",
]);

const labelFor = (type: VisibleEventType) => {
  switch (type) {
    case "GOAL": return "Goal";
    case "SHOT": return "Shot";
    case "FOUL": return "Foul";
    case "YELLOW_CARD": return "Yellow card";
    case "RED_CARD": return "Red card";
    case "PENALTY_GOAL": return "Penalty scored";
    case "PENALTY_MISS": return "Penalty missed";
  }
};

const iconFor = (type: VisibleEventType) => {
  switch (type) {
    case "GOAL": return "⚽";
    case "SHOT": return "🎯";
    case "FOUL": return "⚠️";
    case "YELLOW_CARD": return "🟨";
    case "RED_CARD": return "🟥";
    case "PENALTY_GOAL": return "✅";
    case "PENALTY_MISS": return "❌";
  }
};

type MinuteParts = { base: string; added?: string; penalty?: boolean };

const minutePartsFor = (
  event: PilotEvent,
  periodDurationMs: number,
  extraTimePeriodDurationMs: number
): MinuteParts => {
  if (event.type === "PENALTY_GOAL" || event.type === "PENALTY_MISS") return { base: "PEN", penalty: true };

  const matchClockMs = Math.max(0, Number(event.matchClockMs ?? 0));
  const phase = event.phase;
  if (!phase) return { base: String(Math.max(1, Math.ceil(matchClockMs / 60000))) };

  const clockShape = { phase, periodDurationMs, extraTimePeriodDurationMs };
  const nominalDuration = getPhaseNominalDurationMs(clockShape);
  const officialStart = getPhaseOfficialStartMs(clockShape);
  const officialEnd = officialStart + nominalDuration;

  if (nominalDuration > 0 && matchClockMs > officialEnd) {
    const baseMinute = Math.round(officialEnd / 60000);
    const addedMinute = Math.max(1, Math.ceil((matchClockMs - officialEnd) / 60000));
    return { base: String(baseMinute), added: `+${addedMinute}` };
  }

  return { base: String(Math.max(1, Math.ceil(matchClockMs / 60000))) };
};

const PilotEventFeed = ({
  pilotMatchId,
  homeName,
  awayName,
  periodDurationMs = DEFAULT_PERIOD_DURATION_MS,
  extraTimePeriodDurationMs = DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS,
}: {
  pilotMatchId: string;
  homeName: string;
  awayName: string;
  periodDurationMs?: number;
  extraTimePeriodDurationMs?: number;
}) => {
  const [events, setEvents] = useState<PilotEvent[]>([]);

  useEffect(() => {
    const q = query(collection(db, "pilotEvents"), where("pilotMatchId", "==", pilotMatchId));
    return onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map((item) => item.data() as PilotEvent));
    }, (error) => console.error("Pilot event feed snapshot failed", error));
  }, [pilotMatchId]);

  const visibleEvents = useMemo(() => {
    const revertedIds = new Set(
      events.filter((event) => event.type === "REVERSAL" && event.revertsEventId).map((event) => event.revertsEventId as string)
    );

    return events
      .filter((event): event is PilotEvent & { type: VisibleEventType } => visibleTypes.has(event.type as VisibleEventType))
      .filter((event) => event.status !== "HIDDEN" && !revertedIds.has(event.eventId))
      .sort((a, b) => (b.clientCreatedAt ?? 0) - (a.clientCreatedAt ?? 0));
  }, [events]);

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-[#101010] px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Match feed</p>
        <span className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-red-300">Live</span>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="text-sm font-bold text-white/65">Waiting for the first event</p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {visibleEvents.map((event) => {
            const type = event.type as VisibleEventType;
            const teamName = event.teamSide === "HOME" ? homeName : event.teamSide === "AWAY" ? awayName : "";
            const minute = minutePartsFor(event, periodDurationMs, extraTimePeriodDurationMs);
            const subject = event.playerName || teamName;
            return (
              <div key={event.eventId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="w-14 shrink-0 pt-0.5 text-sm font-black tabular-nums text-white/80">
                  {minute.base}{minute.penalty ? "" : "'"}
                  {minute.added && <span className="ml-0.5 text-cyan-300">{minute.added}'</span>}
                </span>
                <span className="pt-0.5 text-base" aria-hidden="true">{iconFor(type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/90">{labelFor(type)}{subject ? ` · ${subject}` : ""}{event.playerName && teamName ? <span className="font-semibold text-white/45"> · {teamName}</span> : null}</p>
                  {type === "GOAL" && event.assistPlayerName && <p className="mt-1 text-xs font-semibold text-cyan-200/70">Assist · {event.assistPlayerName}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PilotEventFeed;
