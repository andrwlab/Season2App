import { PilotClockState, PilotPhase, formatClock, getPhaseElapsedMs } from "./clock";

export const REGULATION_PLAYING_PHASES: PilotPhase[] = ["FIRST_HALF", "SECOND_HALF"];
export const EXTRA_TIME_PLAYING_PHASES: PilotPhase[] = ["EXTRA_TIME_FIRST_HALF", "EXTRA_TIME_SECOND_HALF"];
export const PLAYING_PHASES: PilotPhase[] = [...REGULATION_PLAYING_PHASES, ...EXTRA_TIME_PLAYING_PHASES];

export const isPlayingPhase = (phase: PilotPhase) => PLAYING_PHASES.includes(phase);

export const getOfficialPeriodEndMs = (
  phase: PilotPhase,
  periodDurationMs: number,
  extraTimePeriodDurationMs: number
) => {
  switch (phase) {
    case "FIRST_HALF":
    case "HALFTIME":
      return periodDurationMs;
    case "SECOND_HALF":
    case "REGULATION_END":
      return periodDurationMs * 2;
    case "EXTRA_TIME_FIRST_HALF":
    case "EXTRA_TIME_HALFTIME":
      return periodDurationMs * 2 + extraTimePeriodDurationMs;
    case "EXTRA_TIME_SECOND_HALF":
    case "EXTRA_TIME_END":
      return periodDurationMs * 2 + extraTimePeriodDurationMs * 2;
    case "PENALTIES":
    case "FULLTIME":
      return periodDurationMs * 2 + extraTimePeriodDurationMs * 2;
  }
};

export const getClockDisplayParts = (clock: PilotClockState, now = Date.now()) => {
  const regular = Math.max(0, Number(clock.periodDurationMs ?? 0));
  const extra = Math.max(0, Number(clock.extraTimePeriodDurationMs ?? 0));
  const elapsed = getPhaseElapsedMs(clock, now);

  let baseBefore = 0;
  let periodLength = regular;

  switch (clock.phase) {
    case "FIRST_HALF":
    case "HALFTIME":
      break;
    case "SECOND_HALF":
    case "REGULATION_END":
      baseBefore = regular;
      break;
    case "EXTRA_TIME_FIRST_HALF":
    case "EXTRA_TIME_HALFTIME":
      baseBefore = regular * 2;
      periodLength = extra;
      break;
    case "EXTRA_TIME_SECOND_HALF":
    case "EXTRA_TIME_END":
      baseBefore = regular * 2 + extra;
      periodLength = extra;
      break;
    case "PENALTIES":
    case "FULLTIME":
      return { primary: formatClock(baseBefore), added: null as string | null };
  }

  if (periodLength > 0 && elapsed > periodLength) {
    return {
      primary: formatClock(baseBefore + periodLength),
      added: `+ ${formatClock(elapsed - periodLength)}`,
    };
  }

  return { primary: formatClock(baseBefore + elapsed), added: null as string | null };
};

export const formatEventMinuteParts = (
  matchClockMs: number,
  phase: PilotPhase,
  periodDurationMs: number,
  extraTimePeriodDurationMs: number
) => {
  const officialEnd = getOfficialPeriodEndMs(phase, periodDurationMs, extraTimePeriodDurationMs);
  const minute = Math.max(1, Math.ceil(matchClockMs / 60000));

  if (officialEnd > 0 && matchClockMs > officialEnd) {
    const baseMinute = Math.max(1, Math.round(officialEnd / 60000));
    const addedMinute = Math.max(1, Math.ceil((matchClockMs - officialEnd) / 60000));
    return { base: `${baseMinute}`, added: `+${addedMinute}` };
  }

  return { base: `${minute}`, added: null as string | null };
};
