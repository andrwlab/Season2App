import {
  FOOTBALL_2026_SCHEDULE,
  FOOTBALL_2026_TEAMS,
  FOOTBALL_2026_TOURNAMENT_ID,
  normalizeFootballTeam,
  PilotTeam,
} from "../src/pilot/footballTournament";

type FirestoreValue = Record<string, unknown>;
type FirestoreDocument = { fields?: Record<string, FirestoreValue> };

const projectId = process.env.FIREBASE_PROJECT_ID || "webtorneitoapp";
const accessToken = process.env.FIREBASE_OAUTH_ACCESS_TOKEN;
const targetTournamentId = process.env.TARGET_TOURNAMENT_ID || "football-2026-test";
const targetTournamentName = process.env.TARGET_TOURNAMENT_NAME || "Champions League · Pruebas";
const restBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

if (!accessToken) throw new Error("FIREBASE_OAUTH_ACCESS_TOKEN is required.");
if (targetTournamentId === FOOTBALL_2026_TOURNAMENT_ID) throw new Error("The test tournament ID must differ from the live tournament ID.");

const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

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

const decodeDocument = (document: FirestoreDocument) =>
  Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, fromFirestoreValue(value)]));

const bodyFor = (data: Record<string, unknown>) => ({
  fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])),
});

const getDocument = async (path: string) => {
  const response = await fetch(`${restBase}/${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<FirestoreDocument>;
};

const createDocument = async (path: string, data: Record<string, unknown>) => {
  const response = await fetch(`${restBase}/${path}`, { method: "PATCH", headers, body: JSON.stringify(bodyFor(data)) });
  if (!response.ok) throw new Error(`Firestore write failed (${response.status}): ${await response.text()}`);
};

const rosterFor = (team: PilotTeam) => team.players.map(({ playerId, name, fullName }) => ({ playerId, name, fullName }));

const main = async () => {
  if (await getDocument(`pilotTournaments/${targetTournamentId}`)) {
    throw new Error(`Test tournament ${targetTournamentId} already exists; refusing to overwrite it.`);
  }

  const sourceDocument = await getDocument(`pilotTournaments/${FOOTBALL_2026_TOURNAMENT_ID}`);
  const sourceData = sourceDocument ? decodeDocument(sourceDocument) : null;
  const sourceTeams = Array.isArray(sourceData?.teams) ? sourceData.teams as PilotTeam[] : FOOTBALL_2026_TEAMS;
  const teams = sourceTeams.map(normalizeFootballTeam);
  const now = new Date();
  const halfMinutes = Number(sourceData?.defaultHalfMinutes ?? 10);

  await createDocument(`pilotTournaments/${targetTournamentId}`, {
    tournamentId: targetTournamentId,
    name: targetTournamentName,
    sport: "football",
    format: "ROUND_ROBIN_SEMIS_FINAL",
    knockoutTieBreak: "EXTRA_TIME_THEN_PENALTIES_IN_SECOND_LEG",
    defaultHalfMinutes: halfMinutes,
    teams,
    isTest: true,
    sourceTournamentId: FOOTBALL_2026_TOURNAMENT_ID,
    createdAt: now,
    updatedAt: now,
  });

  for (const scheduled of FOOTBALL_2026_SCHEDULE) {
    const home = teams.find((team) => team.teamId === scheduled.homeTeamId);
    const away = teams.find((team) => team.teamId === scheduled.awayTeamId);
    const pendingName = scheduled.stage === "FINAL" ? "Winner of semifinal" : "To be confirmed";
    await createDocument(`pilotMatches/${targetTournamentId}__${scheduled.matchId}`, {
      tournamentId: targetTournamentId,
      matchId: scheduled.matchId,
      stage: scheduled.stage,
      matchday: scheduled.matchday ?? null,
      order: scheduled.order,
      tieId: scheduled.tieId ?? null,
      leg: scheduled.leg ?? null,
      homeTeamId: home?.teamId ?? null,
      awayTeamId: away?.teamId ?? null,
      homeName: home?.name ?? pendingName,
      awayName: away?.name ?? pendingName,
      homeLogoUrl: home?.logoPath ?? null,
      awayLogoUrl: away?.logoPath ?? null,
      homePlayers: home ? rosterFor(home) : [],
      awayPlayers: away ? rosterFor(away) : [],
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
      periodDurationMs: halfMinutes * 60 * 1000,
      lineupsConfirmed: false,
      homeStarterIds: [],
      awayStarterIds: [],
      currentHomePlayerIds: [],
      currentAwayPlayerIds: [],
      substitutionCountHome: 0,
      substitutionCountAway: 0,
      lastEvent: null,
      lastSubstitution: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`Created ${targetTournamentName} (${targetTournamentId}) with ${teams.length} teams and ${FOOTBALL_2026_SCHEDULE.length} reset matches.`);
};

main().catch((error) => {
  console.error("Tournament duplication failed:", error);
  process.exit(1);
});
