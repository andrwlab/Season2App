import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  PILOT_MOMENTS_COLLECTION,
  PilotMoment,
  formatMomentMinute,
  momentTypeLabel,
} from "../pilot/moments";

type Props = {
  pilotMatchId: string;
};

const iconForMoment = (moment: PilotMoment) => {
  switch (moment.type) {
    case "GOAL":
      return "⚽";
    case "HIGHLIGHT":
      return "▶";
    case "PHOTO":
      return "▣";
    case "MATCH_START":
      return "●";
    case "HALFTIME":
      return "Ⅱ";
    case "MATCH_END":
      return "■";
    case "AWARD":
      return "★";
    default:
      return "•";
  }
};

const PilotMatchTimeline = ({ pilotMatchId }: Props) => {
  const [moments, setMoments] = useState<PilotMoment[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, PILOT_MOMENTS_COLLECTION),
      where("pilotMatchId", "==", pilotMatchId)
    );

    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((item) => item.data() as PilotMoment)
          .filter((moment) => moment.status === "PUBLISHED")
          .sort((a, b) => b.clientCreatedAt - a.clientCreatedAt);
        setMoments(next);
      },
      (err) => console.error("Pilot timeline snapshot failed", err)
    );
  }, [pilotMatchId]);

  if (moments.length === 0) return null;

  return (
    <section className="mt-5 rounded-3xl border border-white/[0.07] bg-[#101010] px-5 py-5">
      <div className="mb-5">
        <h2 className="text-base font-black tracking-tight">Match timeline</h2>
        <p className="mt-0.5 text-xs text-white/35">The story of the match as it happens</p>
      </div>

      <div className="space-y-0">
        {moments.map((moment, index) => {
          const minute = formatMomentMinute(moment.matchClockMs);
          const isLast = index === moments.length - 1;

          return (
            <article key={moment.momentId} className="grid grid-cols-[3rem_1.75rem_1fr] gap-2">
              <div className="pt-0.5 text-right text-xs font-black tabular-nums text-white/45">
                {minute || "—"}
              </div>

              <div className="relative flex justify-center">
                <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1a] text-xs font-black text-white/80">
                  {iconForMoment(moment)}
                </div>
                {!isLast && <div className="absolute bottom-0 top-7 w-px bg-white/[0.08]" />}
              </div>

              <div className={`${isLast ? "pb-0" : "pb-5"} min-w-0`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                    {momentTypeLabel(moment.type)}
                  </span>
                  {moment.playerName && <span className="text-sm font-black text-white/90">{moment.playerName}</span>}
                </div>

                <p className="mt-1 text-sm font-bold leading-snug text-white/85">{moment.title}</p>

                {moment.caption && (
                  <p className="mt-1.5 text-xs leading-relaxed text-white/45">{moment.caption}</p>
                )}

                {moment.mediaUrl && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20">
                    {moment.mediaType === "IMAGE" ? (
                      <img src={moment.mediaUrl} alt={moment.title} className="max-h-56 w-full object-cover" />
                    ) : (
                      <video src={moment.mediaUrl} controls playsInline preload="metadata" className="max-h-64 w-full object-cover" />
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PilotMatchTimeline;
