import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  FOOTBALL_2026_SCHEDULE,
  FOOTBALL_2026_TEAMS,
  FOOTBALL_2026_TOURNAMENT_ID,
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
  const home = FOOTBALL_2026_TEAMS.find((team) => team.teamId === scheduled.homeTeamId)!;
  const away = FOOTBALL_2026_TEAMS.find((team) => team.teamId === scheduled.awayTeamId)!;
  return {
    tournamentId: FOOTBALL_2026_TOURNAMENT_ID, matchId: scheduled.matchId, stage: "GROUP",
    matchday: scheduled.matchday, order: scheduled.order, homeTeamId: home.teamId, awayTeamId: away.teamId,
    homeName: home.name, awayName: away.name, homeLogoUrl: home.logoPath, awayLogoUrl: away.logoPath,
    homePlayers: cleanRoster(home.teamId), awayPlayers: cleanRoster(away.teamId),
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
  await tournamentRef.set({
    tournamentId: FOOTBALL_2026_TOURNAMENT_ID,
    name: "Fútbol 2026",
    sport: "football",
    format: "ROUND_ROBIN_SEMIS_FINAL",
    defaultHalfMinutes: 10,
    teams: FOOTBALL_2026_TEAMS,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  let written = 0;
  for (const scheduled of FOOTBALL_2026_SCHEDULE) {
    const matchRef = db.collection("pilotMatches").doc(`${FOOTBALL_2026_TOURNAMENT_ID}__${scheduled.matchId}`);
    const existing = await matchRef.get();
    if (existing.exists && !["READY", undefined].includes(existing.data()?.status)) {
      console.log(`[skip] ${scheduled.matchId} already started`);
      continue;
    }

    await matchRef.set(matchPayload(scheduled, existing.exists ? existing.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp()), { merge: true });
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

const restBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const restHeaders = () => ({ Authorization: `Bearer ${oauthAccessToken}`, "Content-Type": "application/json" });

async function restGet(path: string) {
  const response = await fetch(`${restBase}/${path}`, { headers: restHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<{ fields?: Record<string, { stringValue?: string; timestampValue?: string }> }>;
}

async function restPut(path: string, data: Record<string, unknown>) {
  const response = await fetch(`${restBase}/${path}`, { method: "PATCH", headers: restHeaders(), body: JSON.stringify(documentBody(data)) });
  if (!response.ok) throw new Error(`Firestore write failed (${response.status}): ${await response.text()}`);
}

async function mainRest() {
  const now = new Date();
  const tournamentPath = `pilotTournaments/${FOOTBALL_2026_TOURNAMENT_ID}`;
  const existingTournament = await restGet(tournamentPath);
  await restPut(tournamentPath, {
    tournamentId: FOOTBALL_2026_TOURNAMENT_ID, name: "Fútbol 2026", sport: "football",
    format: "ROUND_ROBIN_SEMIS_FINAL", defaultHalfMinutes: 10, teams: FOOTBALL_2026_TEAMS,
    createdAt: existingTournament?.fields?.createdAt?.timestampValue ? new Date(existingTournament.fields.createdAt.timestampValue) : now,
    updatedAt: now,
  });

  let written = 0;
  for (const scheduled of FOOTBALL_2026_SCHEDULE) {
    const path = `pilotMatches/${FOOTBALL_2026_TOURNAMENT_ID}__${scheduled.matchId}`;
    const existing = await restGet(path);
    const status = existing?.fields?.status?.stringValue;
    if (existing && status && status !== "READY") {
      console.log(`[skip] ${scheduled.matchId} already started`);
      continue;
    }
    const createdAt = existing?.fields?.createdAt?.timestampValue ? new Date(existing.fields.createdAt.timestampValue) : now;
    await restPut(path, matchPayload(scheduled, createdAt));
    written += 1;
  }
  console.log(`Football 2026 ready: ${FOOTBALL_2026_TEAMS.length} teams, ${written} matches written.`);
}

(oauthAccessToken ? mainRest() : mainAdmin()).catch((error) => {
  console.error("Football 2026 seed failed:", error);
  process.exit(1);
});
