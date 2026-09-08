import React, { useEffect, useMemo, useState } from "react";
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

const typeShortLabel = (moment: PilotMoment) => {
  if (moment.type === "HIGHLIGHT") return "HIGHLIGHT";
  if (moment.type === "MATCH_START") return "START";
  if (moment.type === "MATCH_END") return "FINAL";
  return momentTypeLabel(moment.type);
};

const PilotMomentsRail = ({ pilotMatchId }: Props) => {
  const [moments, setMoments] = useState<PilotMoment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      },
      (err) => {
        console.error("Pilot moments snapshot failed", err);
        setLoading(false);
      }
    );
  }, [pilotMatchId]);

  const selectedMoment = useMemo(
    () => (selectedIndex === null ? null : moments[selectedIndex] ?? null),
    [moments, selectedIndex]
  );

  useEffect(() => {
    if (selectedIndex !== null && !moments[selectedIndex]) {
      setSelectedIndex(null);
    }
  }, [moments, selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowRight") setSelectedIndex((current) => current === null ? null : Math.min(moments.length - 1, current + 1));
      if (event.key === "ArrowLeft") setSelectedIndex((current) => current === null ? null : Math.max(0, current - 1));
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedIndex, moments.length]);

  if (loading) {
    return (
      <section className="mt-5">
        <div className="mb-3 h-5 w-24 animate-pulse rounded bg-white/10" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 w-20 shrink-0 animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </section>
    );
  }

  if (moments.length === 0) return null;

  return (
    <>
      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-base font-black tracking-tight">Moments</h2>
            <p className="mt-0.5 text-xs text-white/35">Photos, goals and highlights from this match</p>
          </div>
          <span className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/30">{moments.length} live</span>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {moments.map((moment, index) => {
            const minute = formatMomentMinute(moment.matchClockMs);
            return (
              <button
                key={moment.momentId}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="w-[5.4rem] shrink-0 text-left active:scale-[0.98]"
              >
                <div className="relative h-28 overflow-hidden rounded-2xl border border-white/10 bg-[#151515]">
                  {moment.mediaUrl && moment.mediaType === "IMAGE" ? (
                    <img src={moment.mediaUrl} alt={moment.title} className="h-full w-full object-cover" />
                  ) : moment.mediaUrl && moment.mediaType === "VIDEO" ? (
                    <video src={moment.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs font-black uppercase tracking-wider text-white/55">
                      {typeShortLabel(moment)}
                    </div>
                  )}

                  <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.58rem] font-black uppercase tracking-wide text-white">
                    {minute || typeShortLabel(moment)}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-bold leading-tight text-white/85">{moment.title}</p>
              </button>
            );
          })}
        </div>
      </section>

      {selectedMoment && selectedIndex !== null && (
        <div className="fixed inset-0 z-[80] bg-black text-white">
          <div className="mx-auto flex min-h-screen max-w-lg flex-col">
            <div className="flex gap-1 px-3 pb-2 pt-3">
              {moments.map((moment, index) => (
                <div key={moment.momentId} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div className={`h-full bg-white ${index <= selectedIndex ? "w-full" : "w-0"}`} />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-2">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/45">
                  {formatMomentMinute(selectedMoment.matchClockMs) || momentTypeLabel(selectedMoment.type)}
                </p>
                <p className="mt-0.5 truncate text-sm font-black">{selectedMoment.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-bold"
                aria-label="Close story viewer"
              >
                ×
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#090909]">
              {selectedMoment.mediaUrl && selectedMoment.mediaType === "IMAGE" && (
                <img src={selectedMoment.mediaUrl} alt={selectedMoment.title} className="max-h-full w-full object-contain" />
              )}

              {selectedMoment.mediaUrl && selectedMoment.mediaType === "VIDEO" && (
                <video
                  key={selectedMoment.momentId}
                  src={selectedMoment.mediaUrl}
                  autoPlay
                  playsInline
                  controls
                  className="max-h-full w-full object-contain"
                />
              )}

              {!selectedMoment.mediaUrl && (
                <div className="px-8 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">{momentTypeLabel(selectedMoment.type)}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-tight">{selectedMoment.title}</h3>
                </div>
              )}

              {selectedIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(selectedIndex - 1)}
                  className="absolute inset-y-0 left-0 w-1/4"
                  aria-label="Previous moment"
                />
              )}
              {selectedIndex < moments.length - 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(selectedIndex + 1)}
                  className="absolute inset-y-0 right-0 w-1/4"
                  aria-label="Next moment"
                />
              )}
            </div>

            <div className="border-t border-white/10 px-5 pb-6 pt-4">
              <div className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/45">
                <span>{momentTypeLabel(selectedMoment.type)}</span>
                {selectedMoment.playerName && <><span>•</span><span>{selectedMoment.playerName}</span></>}
              </div>
              {selectedMoment.caption && <p className="mt-2 text-sm leading-relaxed text-white/75">{selectedMoment.caption}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PilotMomentsRail;
