import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();

const seasonId = "s1";
const seasonName = process.env.S1_NAME || "Season 1";
const seasonStartDate = process.env.S1_START_DATE || "2025-01-01";
const matchId = process.env.S1_STATS_MATCH_ID || "s1_totals";

const teams = [
  { name: "Team Blue", slug: "team-blue" },
  { name: "Team Red", slug: "team-red" },
  { name: "Team Pink", slug: "team-pink" },
  { name: "Team Black", slug: "team-black" },
];

const stats = [
  { player: "Rocco Lokee", team: "Team Blue", attack: 23, blocks: 5, serves: 3 },
  { player: "Mr. Hall", team: "Team Red", attack: 24, blocks: 1, serves: 6 },
  { player: "Lucas Wu", team: "Team Pink", attack: 18, blocks: 2, serves: 4 },
  { player: "Wilson Chen", team: "Team Black", attack: 9, blocks: 6, serves: 5 },
  { player: "Mr. Torres", team: "Team Pink", attack: 10, blocks: 0, serves: 3 },
  { player: "Mr. Solis", team: "Team Blue", attack: 7, blocks: 0, serves: 5 },
  { player: "Edgar Justavino", team: "Team Red", attack: 6, blocks: 0, serves: 5 },
  { player: "James De Gracia", team: "Team Blue", attack: 4, blocks: 2, serves: 2 },
  { player: "Willy Hou", team: "Team Red", attack: 4, blocks: 1, serves: 2 },
  { player: "Ferran Ponton", team: "Team Pink", attack: 4, blocks: 0, serves: 0 },
  { player: "Joel Pérez", team: "Team Black", attack: 2, blocks: 0, serves: 2 },
  { player: "Mr. Marmolejo", team: "Team Black", attack: 2, blocks: 0, serves: 1 },
  { player: "Mrs. Almanza", team: "Team Red", attack: 1, blocks: 0, serves: 2 },
  { player: "Rafael Romero", team: "Team Pink", attack: 2, blocks: 1, serves: 0 },
  { player: "Lauren Tapia", team: "Team Red", attack: 0, blocks: 0, serves: 2 },
  { player: "Mr. Pérez", team: "Team Pink", attack: 1, blocks: 0, serves: 1 },
  { player: "Mario Zhong", team: "Team Blue", attack: 0, blocks: 0, serves: 2 },
  { player: "Anny Deng", team: "Team Pink", attack: 0, blocks: 0, serves: 2 },
  { player: "William Chen", team: "Team Blue", attack: 2, blocks: 0, serves: 0 },
  { player: "Mr. Aguilera", team: "Team Blue", attack: 0, blocks: 0, serves: 1 },
  { player: "Dhruvin Ahir", team: "Team Blue", attack: 0, blocks: 0, serves: 1 },
  { player: "Mr. Vergara", team: "Team Black", attack: 1, blocks: 0, serves: 0 },
  { player: "Michell Qiu", team: "Team Pink", attack: 0, blocks: 0, serves: 1 },
  { player: "Mavielis Castillero", team: "Team Blue", attack: 0, blocks: 0, serves: 1 },
  { player: "Héctor Chen", team: "Team Black", attack: 0, blocks: 0, serves: 1 },
];

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

const detectType = (name: string) => {
  const lower = name.trim().toLowerCase();
  return lower.startsWith("mr.") || lower.startsWith("mrs.") ? "teacher" : "student";
};

async function ensureSeasonDoc() {
  const seasonRef = db.collection("seasons").doc(seasonId);
  await seasonRef.set(
    {
      name: seasonName,
      startDate: seasonStartDate,
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`[seasons/${seasonId}] ensured`);
}

async function ensureTeams() {
  const teamByName = new Map<string, string>();
  for (const team of teams) {
    const teamId = `${seasonId}_${team.slug}`;
    await db
      .collection("teams")
      .doc(teamId)
      .set(
        {
          seasonId,
          name: team.name,
          slug: team.slug,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    teamByName.set(team.name.toLowerCase(), teamId);
  }
  return teamByName;
}

async function loadPlayersByName() {
  const playersSnap = await db.collection("players").get();
  const playerByName = new Map<string, string>();
  playersSnap.forEach((doc) => {
    const data = doc.data() as any;
    const name = data.fullName || data.name;
    if (name) playerByName.set(normalizeName(String(name)).toLowerCase(), doc.id);
  });
  return playerByName;
}

async function main() {
  await ensureSeasonDoc();
  const teamByName = await ensureTeams();
  const playerByName = await loadPlayersByName();

  const rosterMap = new Map<string, Set<string>>();
  let createdStats = 0;

  for (const row of stats) {
    const normalized = normalizeName(row.player);
    const key = normalized.toLowerCase();
    let playerId = playerByName.get(key);
    if (!playerId) {
      const docRef = db.collection("players").doc();
      await docRef.set({
        fullName: normalized,
        type: detectType(row.player),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      playerId = docRef.id;
      playerByName.set(key, playerId);
    }

    const teamId = teamByName.get(row.team.toLowerCase());
    if (!teamId) {
      console.warn(`Team not found for row: "${row.team}"`);
      continue;
    }

    const statId = `${seasonId}_${playerId}`;
    await db.collection("playerStats").doc(statId).set(
      {
        seasonId,
        matchId,
        playerId,
        attack: row.attack,
        blocks: row.blocks,
        assists: 0,
        service: row.serves,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    createdStats += 1;

    if (!rosterMap.has(teamId)) rosterMap.set(teamId, new Set());
    rosterMap.get(teamId)?.add(playerId);
  }

  for (const [teamId, playerIds] of rosterMap.entries()) {
    const rosterId = `${seasonId}_${teamId}`;
    await db
      .collection("rosters")
      .doc(rosterId)
      .set(
        {
          seasonId,
          teamId,
          playerIds: Array.from(playerIds),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  console.log(`[playerStats] upserted ${createdStats} docs`);
  console.log(`[rosters] upserted ${rosterMap.size} docs`);
  console.log("Season 1 totals import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
