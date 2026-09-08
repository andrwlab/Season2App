export type PilotPhase =
  | "FIRST_HALF"
  | "HALFTIME"
  | "SECOND_HALF"
  | "REGULATION_END"
  | "EXTRA_TIME_FIRST_HALF"
  | "EXTRA_TIME_HALFTIME"
  | "EXTRA_TIME_SECOND_HALF"
  | "EXTRA_TIME_END"
  | "PENALTIES"
  | "FULLTIME";

export type PilotClockStatus = "NOT_STARTED" | "RUNNING" | "PAUSED" | "ENDED";

export type PilotClockState = {
  phase: PilotPhase;
  clockStatus?: PilotClockStatus;
  phaseElapsedBaseMs?: number;
  runningSinceMs?: number | null;
  periodDurationMs?: number;
  extraTimePeriodDurationMs?: number;
  completedMatchClockMs?: number;
};

export const DEFAULT_PERIOD_DURATION_MS = 10 * 60 * 1000;
export const DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS = 5 * 60 * 1000;

export const getPhaseElapsedMs = (clock: PilotClockState, now = Date.now()) => {
  const base = Math.max(0, Number(clock.phaseElapsedBaseMs ?? 0));
  if (clock.clockStatus !== "RUNNING" || !clock.runningSinceMs) return base;
  return Math.max(0, base + (now - clock.runningSinceMs));
};

export const getPhaseOfficialStartMs = (clock: Pick<PilotClockState, "phase" | "periodDurationMs" | "extraTimePeriodDurationMs">) => {
  const periodDuration = Math.max(0, Number(clock.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS));
  const extraDuration = Math.max(0, Number(clock.extraTimePeriodDurationMs ?? DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS));

  switch (clock.phase) {
    case "FIRST_HALF":
    case "HALFTIME":
      return 0;
    case "SECOND_HALF":
    case "REGULATION_END":
      return periodDuration;
    case "EXTRA_TIME_FIRST_HALF":
    case "EXTRA_TIME_HALFTIME":
      return periodDuration * 2;
    case "EXTRA_TIME_SECOND_HALF":
    case "EXTRA_TIME_END":
      return periodDuration * 2 + extraDuration;
    case "PENALTIES":
      return periodDuration * 2;
    case "FULLTIME":
      return periodDuration;
  }
};

export const getPhaseNominalDurationMs = (clock: Pick<PilotClockState, "phase" | "periodDurationMs" | "extraTimePeriodDurationMs">) => {
  const periodDuration = Math.max(0, Number(clock.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS));
  const extraDuration = Math.max(0, Number(clock.extraTimePeriodDurationMs ?? DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS));

  switch (clock.phase) {
    case "FIRST_HALF":
    case "HALFTIME":
    case "SECOND_HALF":
    case "REGULATION_END":
      return periodDuration;
    case "EXTRA_TIME_FIRST_HALF":
    case "EXTRA_TIME_HALFTIME":
    case "EXTRA_TIME_SECOND_HALF":
    case "EXTRA_TIME_END":
      return extraDuration;
    default:
      return 0;
  }
};

export const getVisibleMatchMs = (clock: PilotClockState, now = Date.now()) => {
  if ((clock.phase === "PENALTIES" || clock.phase === "FULLTIME") && Number.isFinite(clock.completedMatchClockMs)) {
    return Math.max(0, Number(clock.completedMatchClockMs));
  }

  return getPhaseOfficialStartMs(clock) + getPhaseElapsedMs(clock, now);
};

export const getClockDisplayParts = (clock: PilotClockState, now = Date.now()) => {
  const visibleMs = getVisibleMatchMs(clock, now);
  const nominalDuration = getPhaseNominalDurationMs(clock);
  const phaseStart = getPhaseOfficialStartMs(clock);
  const elapsed = getPhaseElapsedMs(clock, now);

  if (nominalDuration > 0 && elapsed > nominalDuration) {
    return {
      mainMs: phaseStart + nominalDuration,
      addedMs: elapsed - nominalDuration,
      isAddedTime: true,
    };
  }

  return { mainMs: visibleMs, addedMs: 0, isAddedTime: false };
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
    case "REGULATION_END":
      return "REGULATION COMPLETE";
    case "EXTRA_TIME_FIRST_HALF":
      return "EXTRA TIME · 1ST HALF";
    case "EXTRA_TIME_HALFTIME":
      return "EXTRA TIME · HALFTIME";
    case "EXTRA_TIME_SECOND_HALF":
      return "EXTRA TIME · 2ND HALF";
    case "EXTRA_TIME_END":
      return "EXTRA TIME COMPLETE";
    case "PENALTIES":
      return "PENALTY SHOOTOUT";
    case "FULLTIME":
      return "FULL TIME";
  }
};
