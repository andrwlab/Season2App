import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { DEFAULT_PERIOD_DURATION_MS, PilotClockStatus } from "../pilot/clock";
import PilotScorer from "./PilotScorer";

const clampMinutes = (value: number) => Math.min(90, Math.max(1, Math.round(Number(value) || 10)));

const PilotScorerSurface = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const matchRef = useMemo(() => doc(db, "pilotMatches", pilotMatchId), [pilotMatchId]);

  const [exists, setExists] = useState(false);
  const [clockStatus, setClockStatus] = useState<PilotClockStatus>("NOT_STARTED");
  const [minutes, setMinutes] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(matchRef, (snap) => {
      if (!snap.exists()) {
        setExists(false);
        return;
      }

      setExists(true);
      const data = snap.data();
      const nextClockStatus = (data.clockStatus ?? "NOT_STARTED") as PilotClockStatus;
      setClockStatus(nextClockStatus);

      if (nextClockStatus === "NOT_STARTED") {
        const storedMinutes = Math.round(
          Number(data.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS) / 60000
        );
        setMinutes(clampMinutes(storedMinutes));
      }
    });
  }, [matchRef]);

  const saveMinutes = async (nextValue: number) => {
    if (!exists || clockStatus !== "NOT_STARTED") return;
    const safeValue = clampMinutes(nextValue);
    setMinutes(safeValue);
    setSaving(true);
    setSaveError(null);

    try {
      await updateDoc(matchRef, {
        periodDurationMs: safeValue * 60 * 1000,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update Pilot 0 half duration", error);
      setSaveError("Could not save the half duration.");
    } finally {
      setSaving(false);
    }
  };

  const showSetup = exists && clockStatus === "NOT_STARTED";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showSetup && (
        <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto max-w-lg rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">Minutes per half</p>
                <p className="mt-1 text-xs text-slate-400">Default: 10 minutes. Editable only before kickoff.</p>
              </div>
              {saving && <span className="text-[0.65rem] font-bold uppercase text-slate-500">Saving…</span>}
            </div>

            <div className="mt-3 grid grid-cols-[56px_1fr_56px] gap-2">
              <button
                type="button"
                disabled={saving || minutes <= 1}
                onClick={() => saveMinutes(minutes - 1)}
                className="rounded-xl border border-white/10 bg-slate-800 text-2xl font-black disabled:opacity-30"
                aria-label="Decrease minutes per half"
              >
                −
              </button>

              <input
                type="number"
                min={1}
                max={90}
                inputMode="numeric"
                value={minutes}
                onChange={(event) => setMinutes(clampMinutes(Number(event.target.value)))}
                onBlur={() => saveMinutes(minutes)}
                className="min-h-14 rounded-xl border border-white/10 bg-slate-900 px-3 text-center text-2xl font-black text-white outline-none focus:border-cyan-300"
                aria-label="Minutes per half"
              />

              <button
                type="button"
                disabled={saving || minutes >= 90}
                onClick={() => saveMinutes(minutes + 1)}
                className="rounded-xl border border-white/10 bg-slate-800 text-2xl font-black disabled:opacity-30"
                aria-label="Increase minutes per half"
              >
                +
              </button>
            </div>

            <p className="mt-2 text-center text-xs font-semibold text-slate-400">
              The 2nd half will start at {String(minutes).padStart(2, "0")}:00.
            </p>
            {saveError && <p className="mt-2 text-center text-xs font-semibold text-red-300">{saveError}</p>}
          </div>
        </div>
      )}

      <PilotScorer />
    </div>
  );
};

export default PilotScorerSurface;
