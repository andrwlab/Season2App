import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  FOOTBALL_2026_SCHEDULE,
  FOOTBALL_2026_TEAMS,
  FOOTBALL_2026_TOURNAMENT_ID,
  normalizeFootballMatch,
  normalizeFootballTeam,
  PilotTeam,
} from "../src/pilot/footballTournament";

const projectId = process.env.FIREBASE_PROJECT_ID || "webtorneitoapp";
const oauthAccessToken = process.env.FIREBASE_OAUTH_ACCESS_TOKEN;

if (!oauthAccessToken && !getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = oauthAccessToken ? null : getFirestore();

const cleanRoster = (teamId: string) => {
  const team = FOOTBALL_2026_TEAMS.find((item) => item.teamId === teamId);
  if (!team) throw new Error(`Unknown team: ${teamId}`);
  return team.players.map(({ playerId, name, fullName }) => ({ playerId, name, fullName }));
};

const matchPayload = (scheduled: (typeof FOOTBALL_2026_SCHEDULE)[number], createdAt: unknown) => {
  const home = FOOTBALL_2026_TEAMS.find((team) => team.teamId === scheduled.homeTeamId);
  const away = FOOTBALL_2026_TEAMS.find((team) => team.teamId === scheduled.awayTeamId);
  const pendingName = scheduled.stage === "FINAL" ? "Winner of semifinal" : "To be confirmed";
  return {
    tournamentId: FOOTBALL_2026_TOURNAMENT_ID, matchId: scheduled.matchId, stage: scheduled.stage,
    matchday: scheduled.matchday ?? null, order: scheduled.order, tieId: scheduled.tieId ?? null, leg: scheduled.leg ?? null,
    homeTeamId: home?.teamId ?? null, awayTeamId: away?.teamId ?? null,
    homeName: home?.name ?? pendingName, awayName: away?.name ?? pendingName,
    homeLogoUrl: home?.logoPath ?? null, awayLogoUrl: away?.logoPath ?? null,
    homePlayers: home ? cleanRoster(home.teamId) : [], awayPlayers: away ? cleanRoster(away.teamId) : [],
    scoreHome: 0, scoreAway: 0, shotsHome: 0, shotsAway: 0, foulsHome: 0, foulsAway: 0,
    yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0, penaltyHome: 0, penaltyAway: 0,
    penaltyAttemptsHome: 0, penaltyAttemptsAway: 0, status: "READY", phase: "FIRST_HALF",
    clockStatus: "NOT_STARTED", phaseElapsedBaseMs: 0, runningSinceMs: null, periodDurationMs: 10 * 60 * 1000,
    lineupsConfirmed: false, homeStarterIds: [], awayStarterIds: [], currentHomePlayerIds: [], currentAwayPlayerIds: [],
    substitutionCountHome: 0, substitutionCountAway: 0, lastEvent: null, lastSubstitution: null,
    createdAt, updatedAt: new Date(),
  };
};

async function mainAdmin() {
  if (!db) throw new Error("Firestore Admin client unavailable.");
  const tournamentRef = db.collection("pilotTournaments").doc(FOOTBALL_2026_TOURNAMENT_ID);
  const existingTournament = await tournamentRef.get();
  const existingTeams = existingTournament.data()?.teams;
  const tournamentTeams = Array.isArray(existingTeams)
    ? existingTeams.map((team) => normalizeFootballTeam(team as PilotTeam))
    : FOOTBALL_2026_TEAMS;
  await tournamentRef.set({
    tournamentId: FOOTBALL_2026_TOURNAMENT_ID,
    name: "Champions League",
    sport: "football",
    format: "ROUND_ROBIN_SEMIS_FINAL",
    knockoutTieBreak: "EXTRA_TIME_THEN_PENALTIES_IN_SECOND_LEG",
    defaultHalfMinutes: 10,
    teams: tournamentTeams,
    updatedAt: FieldValue.serverTimestamp(),
    ...(!existingTournament.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
  }, { merge: true });

  let written = 0;
  for (const scheduled of FOOTBALL_2026_SCHEDULE) {
    const matchRef = db.collection("pilotMatches").doc(`${FOOTBALL_2026_TOURNAMENT_ID}__${scheduled.matchId}`);
    const existing = await matchRef.get();
    if (existing.exists) {
      const current = existing.data() as ReturnType<typeof matchPayload>;
      const normalized = normalizeFootballMatch(current);
      const affected = [current.homeTeamId, current.awayTeamId].some((teamId) => teamId === "slovan-bratislava" || teamId === "paris-saint-germain");
      if (affected) await matchRef.set({
        homeName: normalized.homeName,
        awayName: normalized.awayName,
        homeLogoUrl: normalized.homeLogoUrl,
        awayLogoUrl: normalized.awayLogoUrl,
        homePlayers: normalized.homePlayers,
        awayPlayers: normalized.awayPlayers,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`[skip] ${scheduled.matchId} already exists`);
      continue;
    }

    await matchRef.set(matchPayload(scheduled, FieldValue.serverTimestamp()), { merge: true });
    written += 1;
  }

  console.log(`Football 2026 ready: ${FOOTBALL_2026_TEAMS.length} teams, ${written} matches written.`);
}

type FirestoreValue = Record<string, unknown>;
const toFirestoreValue = (value: unknown): FirestoreValue => {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)])) } };
  throw new Error(`Unsupported Firestore value: ${typeof value}`);
};

const documentBody = (data: Record<string, unknown>) => ({
  fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])),
});

const fromFirestoreValue = (value?: FirestoreValue): unknown => {
  if (!value) return undefined;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return ((value.arrayValue as { values?: FirestoreValue[] }).values ?? []).map(fromFirestoreValue);
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, FirestoreValue> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([key, item]) => [key, fromFirestoreValue(item)]));
  }
  return undefined;
};

const fromDocument = (document: { fields?: Record<string, FirestoreValue> }) =>
  Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]));

const restBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const restHeaders = () => ({ Authorization: `Bearer ${oauthAccessToken}`, "Content-Type": "application/json" });

async function restGet(path: string) {
  const response = await fetch(`${restBase}/${path}`, { headers: restHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<{ fields?: Record<string, FirestoreValue> }>;
}

async function restPut(path: string, data: Record<string, unknown>, mergeFields?: string[]) {
  const mask = mergeFields?.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
  const url = `${restBase}/${path}${mask ? `?${mask}` : ""}`;
  const response = await fetch(url, { method: "PATCH", headers: restHeaders(), body: JSON.stringify(documentBody(data)) });
  if (!response.ok) throw new Error(`Firestore write failed (${response.status}): ${await response.text()}`);
}

async function mainRest() {
  const now = new Date();
  const tournamentPath = `pilotTournaments/${FOOTBALL_2026_TOURNAMENT_ID}`;
  const existingTournament = await restGet(tournamentPath);
  const existingTournamentData = existingTournament ? fromDocument(existingTournament) : null;
  const existingTeams = existingTournamentData?.teams;
  const tournamentTeams = Array.isArray(existingTeams)
    ? existingTeams.map((team) => normalizeFootballTeam(team as PilotTeam))
    : FOOTBALL_2026_TEAMS;
  const tournamentData = {
    tournamentId: FOOTBALL_2026_TOURNAMENT_ID, name: "Champions League", sport: "football",
    format: "ROUND_ROBIN_SEMIS_FINAL", knockoutTieBreak: "EXTRA_TIME_THEN_PENALTIES_IN_SECOND_LEG", defaultHalfMinutes: 10,
    teams: tournamentTeams,
    ...(!existingTournament ? { createdAt: now } : {}),
    updatedAt: now,
  };
  await restPut(tournamentPath, tournamentData, existingTournament ? Object.keys(tournamentData) : undefined);

  let written = 0;
  for (const scheduled of FOOTBALL_2026_SCHEDULE) {
    const path = `pilotMatches/${FOOTBALL_2026_TOURNAMENT_ID}__${scheduled.matchId}`;
    const existing = await restGet(path);
    if (existing) {
      const current = fromDocument(existing) as ReturnType<typeof matchPayload>;
      const normalized = normalizeFootballMatch(current);
      const affected = [current.homeTeamId, current.awayTeamId].some((teamId) => teamId === "slovan-bratislava" || teamId === "paris-saint-germain");
      if (affected) {
        const teamUpdate = {
          homeName: normalized.homeName,
          awayName: normalized.awayName,
          homeLogoUrl: normalized.homeLogoUrl,
          awayLogoUrl: normalized.awayLogoUrl,
          homePlayers: normalized.homePlayers,
          awayPlayers: normalized.awayPlayers,
          updatedAt: now,
        };
        await restPut(path, teamUpdate, Object.keys(teamUpdate));
      }
      console.log(`[skip] ${scheduled.matchId} already exists`);
      continue;
    }
    await restPut(path, matchPayload(scheduled, now));
    written += 1;
  }
  console.log(`Football 2026 ready: ${FOOTBALL_2026_TEAMS.length} teams, ${written} matches written.`);
}

(oauthAccessToken ? mainRest() : mainAdmin()).catch((error) => {
  console.error("Football 2026 seed failed:", error);
  process.exit(1);
});
