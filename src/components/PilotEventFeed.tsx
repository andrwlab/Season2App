import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

type TeamSide = "HOME" | "AWAY";
type EventType = "GOAL" | "SHOT" | "FOUL" | "YELLOW_CARD" | "RED_CARD";
type PilotEvent = {
  eventId: string;
  type: EventType | "REVERSAL" | "MATCH_START" | "CLOCK_PAUSE" | "CLOCK_RESUME" | "HALFTIME" | "SECOND_HALF_START" | "FULLTIME";
  teamSide?: TeamSide;
  matchClockMs?: number;
  clientCreatedAt?: number;
  revertsEventId?: string;
  status?: string;
};

const visibleTypes = new Set<EventType>(["GOAL", "SHOT", "FOUL", "YELLOW_CARD", "RED_CARD"]);

const labelFor = (type: EventType) => {
  switch (type) {
    case "GOAL": return "Goal";
    case "SHOT": return "Shot";
    case "FOUL": return "Foul";
    case "YELLOW_CARD": return "Yellow card";
    case "RED_CARD": return "Red card";
  }
};

const iconFor = (type: EventType) => {
  switch (type) {
    case "GOAL": return "⚽";
    case "SHOT": return "🎯";
    case "FOUL": return "⚠️";
    case "YELLOW_CARD": return "🟨";
    case "RED_CARD": return "🟥";
  }
};

// Football convention requested for this MVP: 0:01–1:00 = 1', 1:01–2:00 = 2', etc.
const displayMinute = (matchClockMs = 0) => Math.max(1, Math.ceil(matchClockMs / 60000));

const PilotEventFeed = ({ pilotMatchId, homeName, awayName }: { pilotMatchId: string; homeName: string; awayName: string }) => {
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
      .filter((event): event is PilotEvent & { type: EventType } => visibleTypes.has(event.type as EventType))
      .filter((event) => event.status !== "HIDDEN" && !revertedIds.has(event.eventId))
      .sort((a, b) => (b.clientCreatedAt ?? 0) - (a.clientCreatedAt ?? 0));
  }, [events]);

  return (
    <div className="border-t border-white/[0.07] bg-black/20 px-5 py-4 sm:px-7">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/30">Match feed</p>
        <span className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-red-300">Live</span>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="text-sm font-bold text-white/65">Waiting for the first event</p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {visibleEvents.map((event) => {
            const type = event.type as EventType;
            const teamName = event.teamSide === "HOME" ? homeName : event.teamSide === "AWAY" ? awayName : "";
            return (
              <div key={event.eventId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="w-9 shrink-0 text-sm font-black tabular-nums text-white/80">{displayMinute(event.matchClockMs)}'</span>
                <span className="text-base" aria-hidden="true">{iconFor(type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white/90">{labelFor(type)}{teamName ? ` · ${teamName}` : ""}</p>
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
