export type PilotPhase = "FIRST_HALF" | "HALFTIME" | "SECOND_HALF" | "FULLTIME";
export type PilotClockStatus = "NOT_STARTED" | "RUNNING" | "PAUSED" | "ENDED";

export type PilotClockState = {
  phase: PilotPhase;
  clockStatus?: PilotClockStatus;
  phaseElapsedBaseMs?: number;
  runningSinceMs?: number | null;
  periodDurationMs?: number;
};

export const DEFAULT_PERIOD_DURATION_MS = 10 * 60 * 1000;

export const getPhaseElapsedMs = (clock: PilotClockState, now = Date.now()) => {
  const base = Math.max(0, Number(clock.phaseElapsedBaseMs ?? 0));
  if (clock.clockStatus !== "RUNNING" || !clock.runningSinceMs) return base;
  return Math.max(0, base + (now - clock.runningSinceMs));
};

export const getVisibleMatchMs = (clock: PilotClockState, now = Date.now()) => {
  const phaseElapsed = getPhaseElapsedMs(clock, now);
  const periodDuration = Math.max(0, Number(clock.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS));

  if (clock.phase === "SECOND_HALF" || clock.phase === "FULLTIME") {
    return periodDuration + phaseElapsed;
  }

  return phaseElapsed;
};

export const formatClock = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const formatPhase = (phase: PilotPhase) => {
  switch (phase) {
    case "FIRST_HALF":
      return "1ST HALF";
    case "HALFTIME":
      return "HALFTIME";
    case "SECOND_HALF":
      return "2ND HALF";
    case "FULLTIME":
      return "FULL TIME";
  }
};
