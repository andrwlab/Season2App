import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import PilotMomentComposer from "../components/PilotMomentComposer";
import { db } from "../firebase";
import {
  DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS,
  DEFAULT_PERIOD_DURATION_MS,
  getVisibleMatchMs,
  PilotClockState,
  PilotClockStatus,
} from "../pilot/clock";
import PilotScorer from "./PilotScorer";

const clampMinutes = (value: number) => Math.min(90, Math.max(1, Math.round(Number(value) || 10)));

type MomentMatchState = PilotClockState & { homeName: string; awayName: string };

const PilotScorerSurface = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const matchRef = useMemo(() => doc(db, "pilotMatches", pilotMatchId), [pilotMatchId]);

  const [exists, setExists] = useState(false);
  const [clockStatus, setClockStatus] = useState<PilotClockStatus>("NOT_STARTED");
  const [momentMatch, setMomentMatch] = useState<MomentMatchState | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMomentComposer, setShowMomentComposer] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    return onSnapshot(matchRef, (snap) => {
      if (!snap.exists()) {
        setExists(false);
        setMomentMatch(null);
        return;
      }

      setExists(true);
      const data = snap.data();
      const nextClockStatus = (data.clockStatus ?? "NOT_STARTED") as PilotClockStatus;
      setClockStatus(nextClockStatus);
      setMomentMatch({
        homeName: String(data.homeName ?? "Home"),
        awayName: String(data.awayName ?? "Away"),
        phase: data.phase,
        clockStatus: nextClockStatus,
        phaseElapsedBaseMs: Number(data.phaseElapsedBaseMs ?? 0),
        runningSinceMs: data.runningSinceMs ?? null,
        periodDurationMs: Number(data.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS),
        extraTimePeriodDurationMs: Number(data.extraTimePeriodDurationMs ?? DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS),
        completedMatchClockMs: data.completedMatchClockMs == null ? undefined : Number(data.completedMatchClockMs),
      });

      if (nextClockStatus === "NOT_STARTED") {
        const storedMinutes = Math.round(Number(data.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS) / 60000);
        setMinutes(clampMinutes(storedMinutes));
      }
    });
  }, [matchRef]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const saveMinutes = async (nextValue: number) => {
    if (!exists || clockStatus !== "NOT_STARTED") return;
    const safeValue = clampMinutes(nextValue);
    setMinutes(safeValue);
    setSaving(true);
    setSaveError(null);

    try {
      await updateDoc(matchRef, { periodDurationMs: safeValue * 60 * 1000, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error("Failed to update Pilot 0 half duration", error);
      setSaveError("Could not save the half duration.");
    } finally {
      setSaving(false);
    }
  };

  const showSetup = exists && clockStatus === "NOT_STARTED";
  const visibleMatchMs = momentMatch ? getVisibleMatchMs(momentMatch, now) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 px-3 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <Link to={`/pilot/${tournamentId}`} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-200 active:scale-[0.98]">
            ← TOURNAMENT DASHBOARD
          </Link>
          <Link to={`/live/${tournamentId}/match/${matchId}`} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-300 active:scale-[0.98]">
            PUBLIC VIEW
          </Link>
        </div>
      </div>

      {showSetup && (
        <div className="px-3 pt-3">
          <div className="mx-auto max-w-lg rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">Minutes per half</p><p className="mt-1 text-xs text-slate-400">Default: 10 minutes. Editable only before kickoff.</p></div>
              {saving && <span className="text-[0.65rem] font-bold uppercase text-slate-500">Saving…</span>}
            </div>
            <div className="mt-3 grid grid-cols-[56px_1fr_56px] gap-2">
              <button type="button" disabled={saving || minutes <= 1} onClick={() => saveMinutes(minutes - 1)} className="rounded-xl border border-white/10 bg-slate-800 text-2xl font-black disabled:opacity-30" aria-label="Decrease minutes per half">−</button>
              <input type="number" min={1} max={90} inputMode="numeric" value={minutes} onChange={(event) => setMinutes(clampMinutes(Number(event.target.value)))} onBlur={() => saveMinutes(minutes)} className="min-h-14 rounded-xl border border-white/10 bg-slate-900 px-3 text-center text-2xl font-black text-white outline-none focus:border-cyan-300" aria-label="Minutes per half" />
              <button type="button" disabled={saving || minutes >= 90} onClick={() => saveMinutes(minutes + 1)} className="rounded-xl border border-white/10 bg-slate-800 text-2xl font-black disabled:opacity-30" aria-label="Increase minutes per half">+</button>
            </div>
            <p className="mt-2 text-center text-xs font-semibold text-slate-400">The 2nd half will start at {String(minutes).padStart(2, "0")}:00.</p>
            {saveError && <p className="mt-2 text-center text-xs font-semibold text-red-300">{saveError}</p>}
          </div>
        </div>
      )}

      <PilotScorer />

      {exists && momentMatch && <button type="button" onClick={() => setShowMomentComposer(true)} className="fixed bottom-4 right-4 z-40 rounded-full bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-2xl shadow-black/40 active:scale-[0.98]">+ MOMENT</button>}

      {showMomentComposer && momentMatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm">
          <div className="mx-auto max-w-lg">
            <div className="mb-3 flex items-center justify-between">
              <div><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">Spectator feed</p><p className="mt-1 text-xs text-slate-400">{momentMatch.homeName} vs {momentMatch.awayName}</p></div>
              <button type="button" onClick={() => setShowMomentComposer(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white" aria-label="Close moment composer">×</button>
            </div>
            <PilotMomentComposer tournamentId={tournamentId} matchId={matchId} pilotMatchId={pilotMatchId} matchClockMs={visibleMatchMs} homeName={momentMatch.homeName} awayName={momentMatch.awayName} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PilotScorerSurface;
