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
import {
  DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS,
  DEFAULT_PERIOD_DURATION_MS,
  formatClock,
  formatPhase,
  getClockDisplayParts,
  getPhaseElapsedMs,
  getVisibleMatchMs,
  PilotClockStatus,
  PilotPhase,
} from "../pilot/clock";
import { PilotPlayer, sortPilotPlayers } from "../pilot/players";

type TeamSide = "HOME" | "AWAY";
type MatchEventType = "GOAL" | "SHOT" | "FOUL" | "YELLOW_CARD" | "RED_CARD";
type PenaltyEventType = "PENALTY_GOAL" | "PENALTY_MISS";
type ScoringEventType = MatchEventType | PenaltyEventType;
type StoredEventType = ScoringEventType | "REVERSAL";
type StateEventType =
  | "MATCH_START"
  | "CLOCK_PAUSE"
  | "CLOCK_RESUME"
  | "HALFTIME"
  | "SECOND_HALF_START"
  | "REGULATION_END"
  | "EXTRA_TIME_START"
  | "EXTRA_TIME_HALFTIME"
  | "EXTRA_TIME_SECOND_HALF_START"
  | "EXTRA_TIME_END"
  | "PENALTIES_START"
  | "FULLTIME";

type PilotLastEvent = {
  eventId: string;
  type: StoredEventType;
  teamSide?: TeamSide;
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  targetEventId?: string;
  targetEventType?: ScoringEventType;
  clientCreatedAt: number;
};

type PilotLastSubstitution = {
  eventId: string;
  teamSide: TeamSide;
  playerOutId: string;
  playerOutName: string;
  playerInId: string;
  playerInName: string;
  previousPlayerIds: string[];
  clientCreatedAt: number;
};

type PilotMatch = {
  tournamentId: string;
  matchId: string;
  homeName: string;
  awayName: string;
  homePlayers?: PilotPlayer[];
  awayPlayers?: PilotPlayer[];
  homeStarterIds?: string[];
  awayStarterIds?: string[];
  currentHomePlayerIds?: string[];
  currentAwayPlayerIds?: string[];
  lineupsConfirmed?: boolean;
  substitutionCountHome?: number;
  substitutionCountAway?: number;
  lastSubstitution?: PilotLastSubstitution | null;
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
  penaltyHome?: number;
  penaltyAway?: number;
  penaltyAttemptsHome?: number;
  penaltyAttemptsAway?: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: PilotPhase;
  clockStatus?: PilotClockStatus;
  phaseElapsedBaseMs?: number;
  runningSinceMs?: number | null;
  periodDurationMs?: number;
  extraTimePeriodDurationMs?: number;
  completedMatchClockMs?: number;
  lastEvent?: PilotLastEvent | null;
};

type PendingEvent = {
  type: MatchEventType;
  teamSide: TeamSide;
  capturedAt: number;
  capturedPhase: PilotPhase;
  capturedMatchClockMs: number;
};

type PendingSubstitution = {
  teamSide: TeamSide;
  capturedAt: number;
  capturedPhase: PilotPhase;
  capturedMatchClockMs: number;
};

const getCounterField = (type: MatchEventType, side: TeamSide) => {
  const suffix = side === "HOME" ? "Home" : "Away";
  switch (type) {
    case "GOAL": return `score${suffix}` as const;
    case "SHOT": return `shots${suffix}` as const;
    case "FOUL": return `fouls${suffix}` as const;
    case "YELLOW_CARD": return `yellow${suffix}` as const;
    case "RED_CARD": return `red${suffix}` as const;
  }
};

const getShotsField = (side: TeamSide) => side === "HOME" ? "shotsHome" as const : "shotsAway" as const;

const getEventLabel = (type: StoredEventType) => {
  switch (type) {
    case "YELLOW_CARD": return "YELLOW";
    case "RED_CARD": return "RED";
    case "PENALTY_GOAL": return "PENALTY GOAL";
    case "PENALTY_MISS": return "PENALTY MISS";
    case "REVERSAL": return "REVERSAL";
    default: return type;
  }
};

const isTimedPhase = (phase: PilotPhase) =>
  phase === "FIRST_HALF" ||
  phase === "SECOND_HALF" ||
  phase === "EXTRA_TIME_FIRST_HALF" ||
  phase === "EXTRA_TIME_SECOND_HALF";

const PilotScorer = () => {
  const { tournamentId = "pilot0", matchId = "match-001" } = useParams();
  const pilotMatchId = `${tournamentId}__${matchId}`;
  const [match, setMatch] = useState<PilotMatch | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [homeName, setHomeName] = useState("Team A");
  const [awayName, setAwayName] = useState("Team B");
  const [halfMinutes, setHalfMinutes] = useState(10);
  const [extraTimeMinutes, setExtraTimeMinutes] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pendingEvent, setPendingEvent] = useState<PendingEvent | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [assistPlayerId, setAssistPlayerId] = useState("");
  const [homeStarterIds, setHomeStarterIds] = useState<string[]>([]);
  const [awayStarterIds, setAwayStarterIds] = useState<string[]>([]);
  const [pendingSubstitution, setPendingSubstitution] = useState<PendingSubstitution | null>(null);
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");

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

  useEffect(() => {
    if (!match || match.status !== "READY") return;
    setHomeStarterIds(match.homeStarterIds ?? []);
    setAwayStarterIds(match.awayStarterIds ?? []);
  }, [match, pilotMatchId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const createPilotMatch = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const safeHalfMinutes = Math.min(90, Math.max(1, Number(halfMinutes) || 10));
      await setDoc(matchRef, {
        tournamentId,
        matchId,
        homeName: homeName.trim() || "Team A",
        awayName: awayName.trim() || "Team B",
        homePlayers: [],
        awayPlayers: [],
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
        penaltyHome: 0,
        penaltyAway: 0,
        penaltyAttemptsHome: 0,
        penaltyAttemptsAway: 0,
        status: "READY",
        phase: "FIRST_HALF",
        clockStatus: "NOT_STARTED",
        phaseElapsedBaseMs: 0,
        runningSinceMs: null,
        periodDurationMs: safeHalfMinutes * 60 * 1000,
        extraTimePeriodDurationMs: DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to create pilot match", err);
      setError("Could not create the match. Make sure you have admin or scorekeeper access.");
    } finally {
      setBusy(false);
    }
  };

  const clockParts = match ? getClockDisplayParts(match, now) : { mainMs: 0, addedMs: 0, isAddedTime: false };
  const clockStatus: PilotClockStatus = match?.clockStatus ?? "NOT_STARTED";
  const periodDurationMs = match?.periodDurationMs ?? DEFAULT_PERIOD_DURATION_MS;
  const extraTimePeriodDurationMs = match?.extraTimePeriodDurationMs ?? DEFAULT_EXTRA_TIME_PERIOD_DURATION_MS;
  const canRecordLiveEvent = Boolean(match && clockStatus === "RUNNING" && isTimedPhase(match.phase));

  const rosterForSide = (side: TeamSide) => sortPilotPlayers(side === "HOME" ? match?.homePlayers : match?.awayPlayers);
  const teamNameForSide = (side: TeamSide) => side === "HOME" ? match?.homeName ?? "Home" : match?.awayName ?? "Away";

  const openEventComposer = (type: MatchEventType, teamSide: TeamSide) => {
    if (!match || !canRecordLiveEvent || busy) return;
    const capturedAt = Date.now();
    setPendingEvent({
      type,
      teamSide,
      capturedAt,
      capturedPhase: match.phase,
      capturedMatchClockMs: getVisibleMatchMs(match, capturedAt),
    });
    setSelectedPlayerId("");
    setAssistPlayerId("");
  };

  const recordEvent = async (
    pending: PendingEvent,
    player?: PilotPlayer,
    assistPlayer?: PilotPlayer
  ) => {
    if (!match || busy) return;
    const { type, teamSide } = pending;
    setBusy(true);
    setError(null);

    try {
      const eventRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      // The event belongs to the instant the stat button was tapped. Player and
      // assist selection can take several seconds and must not move its minute.
      const clientCreatedAt = pending.capturedAt;
      const matchClockMs = pending.capturedMatchClockMs;
      const lastEvent: PilotLastEvent = {
        eventId: eventRef.id,
        type,
        teamSide,
        playerId: player?.playerId,
        playerName: player?.name,
        assistPlayerId: type === "GOAL" ? assistPlayer?.playerId : undefined,
        assistPlayerName: type === "GOAL" ? assistPlayer?.name : undefined,
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
        playerId: player?.playerId ?? null,
        playerName: player?.name ?? null,
        assistPlayerId: type === "GOAL" ? assistPlayer?.playerId ?? null : null,
        assistPlayerName: type === "GOAL" ? assistPlayer?.name ?? null : null,
        phase: pending.capturedPhase,
        matchClockMs,
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      const updates: Record<string, unknown> = {
        [getCounterField(type, teamSide)]: increment(1),
        lastEvent,
        updatedAt: serverTimestamp(),
      };
      if (type === "GOAL") updates[getShotsField(teamSide)] = increment(1);

      batch.update(matchRef, updates);
      await batch.commit();
      setPendingEvent(null);
      setSelectedPlayerId("");
      setAssistPlayerId("");
    } catch (err) {
      console.error(`Failed to record pilot ${type}`, err);
      setError(`${getEventLabel(type)} was not saved. Try again before continuing.`);
    } finally {
      setBusy(false);
    }
  };

  const savePendingEvent = async () => {
    if (!pendingEvent) return;
    const roster = rosterForSide(pendingEvent.teamSide);
    const player = roster.find((item) => item.playerId === selectedPlayerId);
    const assist = pendingEvent.type === "GOAL" ? roster.find((item) => item.playerId === assistPlayerId) : undefined;
    await recordEvent(pendingEvent, player, assist);
  };

  const toggleStarter = (side: TeamSide, playerId: string) => {
    const setter = side === "HOME" ? setHomeStarterIds : setAwayStarterIds;
    setter((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]);
  };

  const saveLineups = async () => {
    if (!match || busy || match.status !== "READY") return;
    const homeRosterIds = new Set((match.homePlayers ?? []).map((player) => player.playerId));
    const awayRosterIds = new Set((match.awayPlayers ?? []).map((player) => player.playerId));
    const hasRosters = homeRosterIds.size > 0 || awayRosterIds.size > 0;
    if (hasRosters && (homeStarterIds.length === 0 || awayStarterIds.length === 0)) {
      setError("Choose the starters for both teams before saving the lineups.");
      return;
    }
    if (homeStarterIds.some((id) => !homeRosterIds.has(id)) || awayStarterIds.some((id) => !awayRosterIds.has(id))) {
      setError("A selected starter is no longer on that roster. Review and save the lineups again.");
      return;
    }
    if (homeStarterIds.length !== awayStarterIds.length) {
      setError("Both teams must start with the same number of players.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setDoc(matchRef, {
        homeStarterIds,
        awayStarterIds,
        currentHomePlayerIds: homeStarterIds,
        currentAwayPlayerIds: awayStarterIds,
        lineupsConfirmed: true,
        substitutionCountHome: 0,
        substitutionCountAway: 0,
        lastSubstitution: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error("Failed to save lineups", err);
      setError("The lineups were not saved. Try again before kickoff.");
    } finally {
      setBusy(false);
    }
  };

  const openSubstitutionComposer = (teamSide: TeamSide) => {
    if (!match || busy || match.status !== "LIVE" || match.phase === "PENALTIES" || match.phase === "FULLTIME") return;
    const capturedAt = Date.now();
    setPendingSubstitution({
      teamSide,
      capturedAt,
      capturedPhase: match.phase,
      capturedMatchClockMs: getVisibleMatchMs(match, capturedAt),
    });
    setPlayerOutId("");
    setPlayerInId("");
  };

  const saveSubstitution = async () => {
    if (!match || !pendingSubstitution || busy) return;
    const { teamSide, capturedAt, capturedPhase, capturedMatchClockMs } = pendingSubstitution;
    const roster = rosterForSide(teamSide);
    const currentKey = teamSide === "HOME" ? "currentHomePlayerIds" : "currentAwayPlayerIds";
    const countKey = teamSide === "HOME" ? "substitutionCountHome" : "substitutionCountAway";
    const currentIds = [...(match[currentKey] ?? [])];
    const playerOut = roster.find((player) => player.playerId === playerOutId);
    const playerIn = roster.find((player) => player.playerId === playerInId);
    if (!playerOut || !playerIn || !currentIds.includes(playerOut.playerId) || currentIds.includes(playerIn.playerId)) {
      setError("Choose one player on the field and one player from the bench.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const eventRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const nextIds = currentIds.map((id) => id === playerOut.playerId ? playerIn.playerId : id);
      const lastSubstitution: PilotLastSubstitution = {
        eventId: eventRef.id,
        teamSide,
        playerOutId: playerOut.playerId,
        playerOutName: playerOut.name,
        playerInId: playerIn.playerId,
        playerInName: playerIn.name,
        previousPlayerIds: currentIds,
        clientCreatedAt: capturedAt,
      };

      batch.set(eventRef, {
        version: 1,
        eventId: eventRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        sport: "football",
        type: "SUBSTITUTION",
        teamSide,
        playerOutId: playerOut.playerId,
        playerOutName: playerOut.name,
        playerInId: playerIn.playerId,
        playerInName: playerIn.name,
        phase: capturedPhase,
        matchClockMs: capturedMatchClockMs,
        clientCreatedAt: capturedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });
      batch.update(matchRef, {
        [currentKey]: nextIds,
        [countKey]: increment(1),
        lastSubstitution,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setPendingSubstitution(null);
      setPlayerOutId("");
      setPlayerInId("");
    } catch (err) {
      console.error("Failed to save substitution", err);
      setError("The substitution was not saved. Try again before continuing.");
    } finally {
      setBusy(false);
    }
  };

  const undoLastSubstitution = async () => {
    if (!match?.lastSubstitution || busy) return;
    const target = match.lastSubstitution;
    const currentKey = target.teamSide === "HOME" ? "currentHomePlayerIds" : "currentAwayPlayerIds";
    const countKey = target.teamSide === "HOME" ? "substitutionCountHome" : "substitutionCountAway";
    setBusy(true);
    setError(null);
    try {
      const reversalRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      batch.set(reversalRef, {
        version: 1,
        eventId: reversalRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        sport: "football",
        type: "REVERSAL",
        revertsEventId: target.eventId,
        revertsEventType: "SUBSTITUTION",
        teamSide: target.teamSide,
        phase: match.phase,
        matchClockMs: getVisibleMatchMs(match, clientCreatedAt),
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });
      batch.update(matchRef, {
        [currentKey]: target.previousPlayerIds,
        [countKey]: increment(-1),
        lastSubstitution: null,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to undo substitution", err);
      setError("The substitution could not be undone.");
    } finally {
      setBusy(false);
    }
  };

  const recordPenalty = async (type: PenaltyEventType, teamSide: TeamSide) => {
    if (!match || busy || match.phase !== "PENALTIES") return;
    setBusy(true);
    setError(null);

    try {
      const eventRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      const suffix = teamSide === "HOME" ? "Home" : "Away";
      const attemptNumber = Number(match[`penaltyAttempts${suffix}` as "penaltyAttemptsHome" | "penaltyAttemptsAway"] ?? 0) + 1;
      const lastEvent: PilotLastEvent = { eventId: eventRef.id, type, teamSide, clientCreatedAt };

      batch.set(eventRef, {
        version: 1,
        eventId: eventRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        sport: "football",
        type,
        teamSide,
        phase: "PENALTIES",
        penaltyAttempt: attemptNumber,
        matchClockMs: match.completedMatchClockMs ?? getVisibleMatchMs(match, clientCreatedAt),
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      const updates: Record<string, unknown> = {
        [`penaltyAttempts${suffix}`]: increment(1),
        lastEvent,
        updatedAt: serverTimestamp(),
      };
      if (type === "PENALTY_GOAL") updates[`penalty${suffix}`] = increment(1);
      batch.update(matchRef, updates);
      await batch.commit();
    } catch (err) {
      console.error(`Failed to record ${type}`, err);
      setError("Penalty was not saved. Try again before continuing.");
    } finally {
      setBusy(false);
    }
  };

  const writeStateEvent = async (
    type: StateEventType,
    updates: Record<string, unknown>,
    eventPhase: PilotPhase,
    matchClockMs: number
  ) => {
    if (!match || busy) return;
    setBusy(true);
    setError(null);

    try {
      const eventRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();

      batch.set(eventRef, {
        version: 1,
        eventId: eventRef.id,
        tournamentId,
        matchId,
        pilotMatchId,
        sport: "football",
        type,
        phase: eventPhase,
        matchClockMs,
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      batch.update(matchRef, { ...updates, updatedAt: serverTimestamp() });
      await batch.commit();
    } catch (err) {
      console.error(`Failed to record pilot ${type}`, err);
      setError(`${type.replaceAll("_", " ")} failed. Do not continue until the match state is correct.`);
    } finally {
      setBusy(false);
    }
  };

  const startMatch = async () => {
    if (!match || clockStatus !== "NOT_STARTED") return;
    const hasRosters = (match.homePlayers?.length ?? 0) > 0 || (match.awayPlayers?.length ?? 0) > 0;
    if (hasRosters && !match.lineupsConfirmed) {
      setError("Save both starting lineups before kickoff.");
      return;
    }
    const actionTime = Date.now();
    await writeStateEvent("MATCH_START", {
      status: "LIVE",
      phase: "FIRST_HALF",
      clockStatus: "RUNNING",
      phaseElapsedBaseMs: 0,
      runningSinceMs: actionTime,
      periodDurationMs,
      currentHomePlayerIds: match.homeStarterIds ?? [],
      currentAwayPlayerIds: match.awayStarterIds ?? [],
    }, "FIRST_HALF", 0);
  };

  const pauseClock = async () => {
    if (!match || clockStatus !== "RUNNING") return;
    const actionTime = Date.now();
    const phaseElapsedBaseMs = getPhaseElapsedMs(match, actionTime);
    await writeStateEvent("CLOCK_PAUSE", { clockStatus: "PAUSED", phaseElapsedBaseMs, runningSinceMs: null }, match.phase, getVisibleMatchMs(match, actionTime));
  };

  const resumeClock = async () => {
    if (!match || clockStatus !== "PAUSED" || !isTimedPhase(match.phase)) return;
    const actionTime = Date.now();
    await writeStateEvent("CLOCK_RESUME", { clockStatus: "RUNNING", runningSinceMs: actionTime }, match.phase, getVisibleMatchMs(match, actionTime));
  };

  const endFirstHalf = async () => {
    if (!match || match.phase !== "FIRST_HALF") return;
    const actionTime = Date.now();
    const phaseElapsedBaseMs = getPhaseElapsedMs(match, actionTime);
    await writeStateEvent("HALFTIME", { phase: "HALFTIME", clockStatus: "PAUSED", phaseElapsedBaseMs, runningSinceMs: null, lastEvent: null }, "FIRST_HALF", getVisibleMatchMs(match, actionTime));
  };

  const startSecondHalf = async () => {
    if (!match || match.phase !== "HALFTIME") return;
    const actionTime = Date.now();
    await writeStateEvent("SECOND_HALF_START", { status: "LIVE", phase: "SECOND_HALF", clockStatus: "RUNNING", phaseElapsedBaseMs: 0, runningSinceMs: actionTime, lastEvent: null }, "SECOND_HALF", periodDurationMs);
  };

  const endRegulation = async () => {
    if (!match || match.phase !== "SECOND_HALF") return;
    const actionTime = Date.now();
    const phaseElapsedBaseMs = getPhaseElapsedMs(match, actionTime);
    const matchClockMs = getVisibleMatchMs(match, actionTime);
    await writeStateEvent("REGULATION_END", { phase: "REGULATION_END", clockStatus: "PAUSED", phaseElapsedBaseMs, runningSinceMs: null, completedMatchClockMs: matchClockMs, lastEvent: null }, "REGULATION_END", matchClockMs);
  };

  const startExtraTime = async () => {
    if (!match || match.phase !== "REGULATION_END") return;
    const safeMinutes = Math.min(45, Math.max(1, Number(extraTimeMinutes) || 5));
    const actionTime = Date.now();
    await writeStateEvent("EXTRA_TIME_START", { status: "LIVE", phase: "EXTRA_TIME_FIRST_HALF", clockStatus: "RUNNING", phaseElapsedBaseMs: 0, runningSinceMs: actionTime, extraTimePeriodDurationMs: safeMinutes * 60 * 1000, completedMatchClockMs: null, lastEvent: null }, "EXTRA_TIME_FIRST_HALF", periodDurationMs * 2);
  };

  const endExtraTimeFirstHalf = async () => {
    if (!match || match.phase !== "EXTRA_TIME_FIRST_HALF") return;
    const actionTime = Date.now();
    const phaseElapsedBaseMs = getPhaseElapsedMs(match, actionTime);
    await writeStateEvent("EXTRA_TIME_HALFTIME", { phase: "EXTRA_TIME_HALFTIME", clockStatus: "PAUSED", phaseElapsedBaseMs, runningSinceMs: null, lastEvent: null }, "EXTRA_TIME_HALFTIME", getVisibleMatchMs(match, actionTime));
  };

  const startExtraTimeSecondHalf = async () => {
    if (!match || match.phase !== "EXTRA_TIME_HALFTIME") return;
    const actionTime = Date.now();
    await writeStateEvent("EXTRA_TIME_SECOND_HALF_START", { phase: "EXTRA_TIME_SECOND_HALF", clockStatus: "RUNNING", phaseElapsedBaseMs: 0, runningSinceMs: actionTime, lastEvent: null }, "EXTRA_TIME_SECOND_HALF", periodDurationMs * 2 + extraTimePeriodDurationMs);
  };

  const endExtraTime = async () => {
    if (!match || match.phase !== "EXTRA_TIME_SECOND_HALF") return;
    const actionTime = Date.now();
    const phaseElapsedBaseMs = getPhaseElapsedMs(match, actionTime);
    const matchClockMs = getVisibleMatchMs(match, actionTime);
    await writeStateEvent("EXTRA_TIME_END", { phase: "EXTRA_TIME_END", clockStatus: "PAUSED", phaseElapsedBaseMs, runningSinceMs: null, completedMatchClockMs: matchClockMs, lastEvent: null }, "EXTRA_TIME_END", matchClockMs);
  };

  const startPenalties = async () => {
    if (!match || (match.phase !== "REGULATION_END" && match.phase !== "EXTRA_TIME_END")) return;
    const actionTime = Date.now();
    const completedMatchClockMs = getVisibleMatchMs(match, actionTime);
    await writeStateEvent("PENALTIES_START", { status: "LIVE", phase: "PENALTIES", clockStatus: "PAUSED", runningSinceMs: null, completedMatchClockMs, penaltyHome: match.penaltyHome ?? 0, penaltyAway: match.penaltyAway ?? 0, penaltyAttemptsHome: match.penaltyAttemptsHome ?? 0, penaltyAttemptsAway: match.penaltyAttemptsAway ?? 0, lastEvent: null }, "PENALTIES", completedMatchClockMs);
  };

  const finishMatch = async () => {
    if (!match || !["REGULATION_END", "EXTRA_TIME_END", "PENALTIES"].includes(match.phase)) return;
    const actionTime = Date.now();
    const completedMatchClockMs = match.completedMatchClockMs ?? getVisibleMatchMs(match, actionTime);
    await writeStateEvent("FULLTIME", { status: "FULLTIME", phase: "FULLTIME", clockStatus: "ENDED", runningSinceMs: null, completedMatchClockMs, lastEvent: null }, "FULLTIME", completedMatchClockMs);
  };

  const undoLastEvent = async () => {
    if (!match?.lastEvent || match.lastEvent.type === "REVERSAL" || !match.lastEvent.teamSide || busy) return;

    const target = match.lastEvent;
    const targetType = target.type as ScoringEventType;
    const suffix = target.teamSide === "HOME" ? "Home" : "Away";
    const updates: Record<string, unknown> = {};

    if (targetType === "PENALTY_GOAL" || targetType === "PENALTY_MISS") {
      const attemptsKey = `penaltyAttempts${suffix}` as "penaltyAttemptsHome" | "penaltyAttemptsAway";
      const scoreKey = `penalty${suffix}` as "penaltyHome" | "penaltyAway";
      const attempts = Number(match[attemptsKey] ?? 0);
      if (attempts <= 0) return;
      updates[attemptsKey] = increment(-1);
      if (targetType === "PENALTY_GOAL") {
        const scored = Number(match[scoreKey] ?? 0);
        if (scored <= 0) return;
        updates[scoreKey] = increment(-1);
      }
    } else {
      const field = getCounterField(targetType as MatchEventType, target.teamSide);
      const currentValue = Number(match[field] ?? 0);
      if (currentValue <= 0) return;
      updates[field] = increment(-1);
      if (targetType === "GOAL") {
        const shotsField = getShotsField(target.teamSide);
        const currentShots = Number(match[shotsField] ?? 0);
        if (currentShots > 0) updates[shotsField] = increment(-1);
      }
    }

    setBusy(true);
    setError(null);
    try {
      const reversalRef = doc(collection(db, "pilotEvents"));
      const batch = writeBatch(db);
      const clientCreatedAt = Date.now();
      const reversal: PilotLastEvent = { eventId: reversalRef.id, type: "REVERSAL", targetEventId: target.eventId, targetEventType: targetType, teamSide: target.teamSide, clientCreatedAt };

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
        phase: match.phase,
        matchClockMs: getVisibleMatchMs(match, clientCreatedAt),
        clientCreatedAt,
        serverReceivedAt: serverTimestamp(),
        status: "ACTIVE",
      });

      batch.update(matchRef, { ...updates, lastEvent: reversal, updatedAt: serverTimestamp() });
      await batch.commit();
    } catch (err) {
      console.error("Failed to undo pilot event", err);
      setError("Undo failed. Do not continue until the match state is correct.");
    } finally {
      setBusy(false);
    }
  };

  if (exists === null) return <div className="p-6 text-center text-muted">Loading Pilot 0...</div>;

  if (!exists) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-md">
          <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Pilot 0</p><h1 className="mt-2 text-3xl font-black">Create live match</h1><p className="mt-2 text-sm text-slate-400">Temporary football match, isolated from Season 2 players and rosters.</p></div>
          <form onSubmit={createPilotMatch} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Home</span><input value={homeName} onChange={(e) => setHomeName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-cyan-400" /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Away</span><input value={awayName} onChange={(e) => setAwayName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-cyan-400" /></label>
            <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Minutes per half</span><input type="number" min={1} max={90} value={halfMinutes} onChange={(e) => setHalfMinutes(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-cyan-400" /></label>
            {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-4 text-base font-black text-slate-950 disabled:opacity-50">{busy ? "Creating..." : "CREATE PILOT MATCH"}</button>
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
      : `${getEventLabel(match.lastEvent.type)}${match.lastEvent.playerName ? ` · ${match.lastEvent.playerName}` : ""} · ${match.lastEvent.teamSide === "HOME" ? match.homeName : match.awayName}`;

  const TeamLane = ({ side }: { side: TeamSide }) => {
    const isHome = side === "HOME";
    const teamName = isHome ? match.homeName : match.awayName;
    const buttonBase = "w-full rounded-xl px-2 font-black active:scale-[0.98] disabled:opacity-30";

    return (
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="truncate px-1 text-center text-sm font-black">{teamName}</div>
        <button type="button" disabled={busy || !canRecordLiveEvent} onClick={() => openEventComposer("GOAL", side)} className={`${buttonBase} min-h-20 ${isHome ? "bg-blue-600" : "bg-fuchsia-700"} text-lg text-white`}>GOAL + SHOT</button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || !canRecordLiveEvent} onClick={() => openEventComposer("SHOT", side)} className={`${buttonBase} min-h-14 bg-slate-800 text-sm text-white`}>SHOT +</button>
          <button type="button" disabled={busy || !canRecordLiveEvent} onClick={() => openEventComposer("FOUL", side)} className={`${buttonBase} min-h-14 bg-slate-800 text-sm text-white`}>FOUL +</button>
          <button type="button" disabled={busy || !canRecordLiveEvent} onClick={() => openEventComposer("YELLOW_CARD", side)} className={`${buttonBase} min-h-14 bg-amber-300 text-xs text-slate-950`}>YELLOW</button>
          <button type="button" disabled={busy || !canRecordLiveEvent} onClick={() => openEventComposer("RED_CARD", side)} className={`${buttonBase} min-h-14 bg-red-600 text-xs text-white`}>RED</button>
        </div>
      </div>
    );
  };

  const PenaltyLane = ({ side }: { side: TeamSide }) => {
    const isHome = side === "HOME";
    const teamName = isHome ? match.homeName : match.awayName;
    const scored = isHome ? match.penaltyHome ?? 0 : match.penaltyAway ?? 0;
    const attempts = isHome ? match.penaltyAttemptsHome ?? 0 : match.penaltyAttemptsAway ?? 0;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="text-center"><p className="truncate text-sm font-black">{teamName}</p><p className="mt-1 text-xs font-semibold text-slate-500">{scored} scored · {attempts} taken</p></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => recordPenalty("PENALTY_GOAL", side)} className="min-h-16 rounded-xl bg-emerald-400 px-2 font-black text-slate-950 active:scale-[0.98] disabled:opacity-40">GOAL</button><button type="button" disabled={busy} onClick={() => recordPenalty("PENALTY_MISS", side)} className="min-h-16 rounded-xl bg-slate-800 px-2 font-black text-white active:scale-[0.98] disabled:opacity-40">MISS</button></div>
      </div>
    );
  };

  const stateAction = (() => {
    if (clockStatus === "NOT_STARTED") return { label: "START MATCH", action: startMatch, className: "bg-emerald-400 text-slate-950" };
    if (match.phase === "FIRST_HALF") return { label: "END 1ST HALF", action: endFirstHalf, className: "bg-slate-100 text-slate-950" };
    if (match.phase === "HALFTIME") return { label: "START 2ND HALF", action: startSecondHalf, className: "bg-emerald-400 text-slate-950" };
    if (match.phase === "SECOND_HALF") return { label: "END REGULATION", action: endRegulation, className: "bg-red-500 text-white" };
    if (match.phase === "EXTRA_TIME_FIRST_HALF") return { label: "END ET 1ST HALF", action: endExtraTimeFirstHalf, className: "bg-slate-100 text-slate-950" };
    if (match.phase === "EXTRA_TIME_HALFTIME") return { label: "START ET 2ND HALF", action: startExtraTimeSecondHalf, className: "bg-emerald-400 text-slate-950" };
    if (match.phase === "EXTRA_TIME_SECOND_HALF") return { label: "END EXTRA TIME", action: endExtraTime, className: "bg-red-500 text-white" };
    return null;
  })();

  const showDecision = match.phase === "REGULATION_END" || match.phase === "EXTRA_TIME_END";
  const pendingFullRoster = pendingEvent ? rosterForSide(pendingEvent.teamSide) : [];
  const pendingCurrentIds = pendingEvent
    ? (pendingEvent.teamSide === "HOME" ? match.currentHomePlayerIds : match.currentAwayPlayerIds) ?? []
    : [];
  const pendingRoster = pendingCurrentIds.length > 0
    ? pendingFullRoster.filter((player) => pendingCurrentIds.includes(player.playerId))
    : pendingFullRoster;
  const selectedPlayer = pendingRoster.find((item) => item.playerId === selectedPlayerId);
  const substitutionRoster = pendingSubstitution ? rosterForSide(pendingSubstitution.teamSide) : [];
  const substitutionCurrentIds = pendingSubstitution
    ? (pendingSubstitution.teamSide === "HOME" ? match.currentHomePlayerIds : match.currentAwayPlayerIds) ?? []
    : [];
  const substitutionOnField = substitutionRoster.filter((player) => substitutionCurrentIds.includes(player.playerId));
  const substitutionBench = substitutionRoster.filter((player) => !substitutionCurrentIds.includes(player.playerId));

  const LineupPicker = ({ side }: { side: TeamSide }) => {
    const roster = rosterForSide(side);
    const selectedIds = side === "HOME" ? homeStarterIds : awayStarterIds;
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="truncate text-sm font-black">{teamNameForSide(side)}</p><span className="text-xs font-bold text-cyan-300">{selectedIds.length} starters</span></div>
        {roster.length === 0 ? <p className="text-xs text-slate-500">No roster loaded.</p> : <div className="grid grid-cols-2 gap-2">{roster.map((player) => {
          const selected = selectedIds.includes(player.playerId);
          return <button key={player.playerId} type="button" onClick={() => toggleStarter(side, player.playerId)} className={`rounded-lg border px-2 py-2 text-left text-xs font-bold ${selected ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400"}`}>{player.name}</button>;
        })}</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-lg space-y-3">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Pilot 0 · Match Control</p><p className="mt-1 text-xs text-slate-500">{tournamentId} / {matchId}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${match.phase === "FULLTIME" ? "border-slate-500/30 bg-slate-500/10 text-slate-300" : match.phase === "PENALTIES" ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : clockStatus === "RUNNING" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>{match.phase === "FULLTIME" ? "FULL TIME" : match.phase === "PENALTIES" ? "PENALTIES" : clockStatus}</span></div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div><p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">{formatPhase(match.phase)}</p>{match.phase === "PENALTIES" ? <p className="mt-1 text-xl font-black text-cyan-300">Shootout</p> : <p className="mt-1 font-mono text-3xl font-black text-white"><span className={clockParts.isAddedTime ? "text-slate-200" : "text-cyan-300"}>{formatClock(clockParts.mainMs)}</span>{clockParts.isAddedTime && <span className="ml-2 text-cyan-300">+ {formatClock(clockParts.addedMs)}</span>}</p>}</div>{isTimedPhase(match.phase) && clockStatus !== "NOT_STARTED" && <button type="button" disabled={busy} onClick={clockStatus === "RUNNING" ? pauseClock : resumeClock} className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-black disabled:opacity-40">{clockStatus === "RUNNING" ? "PAUSE CLOCK" : "RESUME CLOCK"}</button>}</div>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div className="truncate text-sm font-black">{match.homeName}</div><div><div className="text-5xl font-black tracking-tight">{match.scoreHome}–{match.scoreAway}</div>{(match.phase === "PENALTIES" || (match.penaltyAttemptsHome ?? 0) + (match.penaltyAttemptsAway ?? 0) > 0) && <div className="mt-1 text-sm font-black text-cyan-300">PEN {match.penaltyHome ?? 0}–{match.penaltyAway ?? 0}</div>}</div><div className="truncate text-sm font-black">{match.awayName}</div></div>
        </div>

        {match.status === "READY" && ((match.homePlayers?.length ?? 0) > 0 || (match.awayPlayers?.length ?? 0) > 0) && <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3"><div className="mb-3"><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">Starting lineups</p><p className="mt-1 text-xs text-slate-400">Select the players who will begin on the field. The number is defined by this selection until the tournament rule is confirmed.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><LineupPicker side="HOME" /><LineupPicker side="AWAY" /></div><button type="button" disabled={busy} onClick={saveLineups} className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{match.lineupsConfirmed ? "UPDATE LINEUPS" : "SAVE LINEUPS"}</button>{match.lineupsConfirmed && <p className="mt-2 text-center text-xs font-bold text-emerald-300">Lineups ready for kickoff.</p>}</div>}

        {!canRecordLiveEvent && isTimedPhase(match.phase) && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center text-xs font-semibold text-amber-100">Live event buttons are locked until the match clock is running.</div>}

        {match.phase === "PENALTIES" ? <div className="grid grid-cols-2 gap-3"><PenaltyLane side="HOME" /><PenaltyLane side="AWAY" /></div> : <div className="grid grid-cols-2 gap-3"><TeamLane side="HOME" /><TeamLane side="AWAY" /></div>}

        {match.status === "LIVE" && match.phase !== "PENALTIES" && <div className="grid grid-cols-2 gap-3"><button type="button" disabled={busy || (match.currentHomePlayerIds?.length ?? 0) === 0} onClick={() => openSubstitutionComposer("HOME")} className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm font-black text-cyan-100 disabled:opacity-30">SUB · {match.homeName}<span className="mt-1 block text-[0.65rem] text-cyan-200/60">{match.substitutionCountHome ?? 0} recorded</span></button><button type="button" disabled={busy || (match.currentAwayPlayerIds?.length ?? 0) === 0} onClick={() => openSubstitutionComposer("AWAY")} className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm font-black text-cyan-100 disabled:opacity-30">SUB · {match.awayName}<span className="mt-1 block text-[0.65rem] text-cyan-200/60">{match.substitutionCountAway ?? 0} recorded</span></button></div>}

        {match.lastSubstitution && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Last substitution</p><p className="mt-1 text-sm font-bold"><span className="text-emerald-300">IN {match.lastSubstitution.playerInName}</span><span className="mx-2 text-slate-600">·</span><span className="text-red-300">OUT {match.lastSubstitution.playerOutName}</span></p><button type="button" disabled={busy} onClick={undoLastSubstitution} className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-200 disabled:opacity-30">UNDO SUBSTITUTION</button></div>}

        {match.phase !== "PENALTIES" && <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center"><div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Shots</div><div className="mt-1 font-black">{match.shotsHome ?? 0}–{match.shotsAway ?? 0}</div></div><div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Fouls</div><div className="mt-1 font-black">{match.foulsHome ?? 0}–{match.foulsAway ?? 0}</div></div><div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Yellow</div><div className="mt-1 font-black">{match.yellowHome ?? 0}–{match.yellowAway ?? 0}</div></div><div><div className="text-[0.6rem] font-bold uppercase text-slate-500">Red</div><div className="mt-1 font-black">{match.redHome ?? 0}–{match.redAway ?? 0}</div></div></div>}

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-500">Last reversible event</p><p className="mt-1 font-bold">{lastLabel}</p><button type="button" onClick={undoLastEvent} disabled={!canUndo || busy} className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-30">{canUndo ? `UNDO ${getEventLabel(match.lastEvent!.type)}` : "NOTHING TO UNDO"}</button></div>

        {stateAction && <button type="button" disabled={busy} onClick={stateAction.action} className={`w-full rounded-2xl px-4 py-4 text-base font-black active:scale-[0.99] disabled:opacity-50 ${stateAction.className}`}>{stateAction.label}</button>}

        {showDecision && <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4"><p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">What happens next?</p><div className="mt-3 space-y-2"><button type="button" disabled={busy} onClick={finishMatch} className="w-full rounded-xl bg-slate-100 px-4 py-3 font-black text-slate-950 disabled:opacity-40">END MATCH</button>{match.phase === "REGULATION_END" && <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Extra-time minutes per half</label><div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><input type="number" min={1} max={45} inputMode="numeric" value={extraTimeMinutes} onChange={(event) => setExtraTimeMinutes(Math.min(45, Math.max(1, Number(event.target.value) || 1)))} className="min-h-12 rounded-xl border border-white/10 bg-slate-950 px-3 text-center text-lg font-black outline-none focus:border-cyan-300" /><button type="button" disabled={busy} onClick={startExtraTime} className="rounded-xl bg-cyan-300 px-4 font-black text-slate-950 disabled:opacity-40">EXTRA TIME</button></div></div>}<button type="button" disabled={busy} onClick={startPenalties} className="w-full rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">PENALTIES</button></div></div>}

        {match.phase === "PENALTIES" && <button type="button" disabled={busy} onClick={finishMatch} className="w-full rounded-2xl bg-red-500 px-4 py-4 text-base font-black text-white active:scale-[0.99] disabled:opacity-50">END SHOOTOUT</button>}
        {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</div>}
      </div>

      {pendingEvent && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-lg items-end sm:items-center">
            <div className="w-full rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-cyan-300">Record event</p><h2 className="mt-1 text-2xl font-black">{getEventLabel(pendingEvent.type)} · {teamNameForSide(pendingEvent.teamSide)}</h2><p className="mt-1 text-xs font-semibold text-cyan-200/80">Time captured at {formatClock(pendingEvent.capturedMatchClockMs)}</p>{pendingEvent.type === "GOAL" && <p className="mt-1 text-xs font-semibold text-slate-400">A goal automatically adds +1 shot.</p>}</div><button type="button" onClick={() => setPendingEvent(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl">×</button></div>

              <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Player</p>{pendingRoster.length === 0 ? <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">No roster loaded. You can save this as a team event, or add players from Tournament Setup before kickoff.</div> : <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1"><button type="button" onClick={() => { setSelectedPlayerId(""); setAssistPlayerId(""); }} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${selectedPlayerId === "" ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>Team event / unknown</button>{pendingRoster.map((player) => <button key={player.playerId} type="button" onClick={() => { setSelectedPlayerId(player.playerId); if (assistPlayerId === player.playerId) setAssistPlayerId(""); }} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${selectedPlayerId === player.playerId ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>{player.name}</button>)}</div>}</div>

              {pendingEvent.type === "GOAL" && pendingRoster.length > 0 && (
                <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Assist <span className="normal-case tracking-normal text-slate-600">(optional)</span></p><select value={assistPlayerId} onChange={(event) => setAssistPlayerId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-300"><option value="">No assist / none recorded</option>{pendingRoster.filter((player) => player.playerId !== selectedPlayer?.playerId).map((player) => <option key={player.playerId} value={player.playerId}>{player.name}</option>)}</select></div>
              )}

              <div className="mt-5 grid grid-cols-[1fr_2fr] gap-2"><button type="button" onClick={() => setPendingEvent(null)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-black text-slate-300">CANCEL</button><button type="button" disabled={busy} onClick={savePendingEvent} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{busy ? "SAVING…" : `SAVE ${getEventLabel(pendingEvent.type)}`}</button></div>
            </div>
          </div>
        </div>
      )}

      {pendingSubstitution && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full max-w-lg items-end sm:items-center">
            <div className="w-full rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-cyan-300">Substitution</p><h2 className="mt-1 text-2xl font-black">{teamNameForSide(pendingSubstitution.teamSide)}</h2><p className="mt-1 text-xs font-semibold text-cyan-200/80">Time captured at {formatClock(pendingSubstitution.capturedMatchClockMs)}</p></div><button type="button" onClick={() => setPendingSubstitution(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl">×</button></div>
              <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-red-300">Player out · on field</p><div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">{substitutionOnField.map((player) => <button key={player.playerId} type="button" onClick={() => setPlayerOutId(player.playerId)} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${playerOutId === player.playerId ? "border-red-300 bg-red-400/15 text-red-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>{player.name}</button>)}</div></div>
              <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Player in · bench</p><div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">{substitutionBench.map((player) => <button key={player.playerId} type="button" onClick={() => setPlayerInId(player.playerId)} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${playerInId === player.playerId ? "border-emerald-300 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>{player.name}</button>)}</div></div>
              <div className="mt-5 grid grid-cols-[1fr_2fr] gap-2"><button type="button" onClick={() => setPendingSubstitution(null)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-black text-slate-300">CANCEL</button><button type="button" disabled={busy || !playerOutId || !playerInId} onClick={saveSubstitution} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{busy ? "SAVING…" : "SAVE SUBSTITUTION"}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PilotScorer;
