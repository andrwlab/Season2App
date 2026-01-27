import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

const seasonId = process.env.SEASON_ID || "s2";
const inputFile = process.env.ROSTER_FILE || "";
const pruneStats = (process.env.PRUNE_STATS || "true").toLowerCase() !== "false";

type JsonRosterMap = Record<string, string[]>;

type PlayerDoc = {
  id: string;
  fullName?: string;
  name?: string;
  type?: string;
};

const normalizeName = (name: string) => {
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s+\d{1,2}(?:st|nd|rd|th)?[A-Za-z]?$/i, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

const stripDiacritics = (value: string) => {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const normalizeKey = (name: string) => {
  return stripDiacritics(normalizeName(name)).toLowerCase();
};

const detectType = (name: string) => {
  return name.trim().toLowerCase().startsWith("mr.") ? "teacher" : "student";
};

const loadInput = async (): Promise<JsonRosterMap> => {
  if (!inputFile) {
    throw new Error("ROSTER_FILE env var is required.");
  }
  const raw = await readFile(path.resolve(inputFile), "utf-8");
  return JSON.parse(raw) as JsonRosterMap;
};

async function ensureTeamsExist(teamIds: string[]) {
  const missing: string[] = [];
  await Promise.all(
    teamIds.map(async (teamId) => {
      const ref = db.collection("teams").doc(teamId);
      const snap = await ref.get();
      if (!snap.exists) missing.push(teamId);
    })
  );
  if (missing.length) {
    throw new Error(`Missing team docs: ${missing.join(", ")}`);
  }
}

async function loadPlayers() {
  const playersSnap = await db.collection("players").get();
  const playerByName = new Map<string, PlayerDoc>();
  playersSnap.forEach((doc) => {
    const data = doc.data() as PlayerDoc;
    const name = data.fullName || data.name;
    if (!name) return;
    playerByName.set(normalizeKey(String(name)), {
      id: doc.id,
      ...data,
    });
  });
  return playerByName;
}

async function upsertPlayersAndRosters(roster: JsonRosterMap) {
  const playerByName = await loadPlayers();
  const allowedPlayerIds = new Set<string>();

  for (const [teamId, names] of Object.entries(roster)) {
    const playerIds: string[] = [];

    for (const rawName of names) {
      const normalized = normalizeName(rawName);
      const key = normalizeKey(rawName);
      const existing = playerByName.get(key);

      if (existing?.id) {
        playerIds.push(existing.id);
        allowedPlayerIds.add(existing.id);
        continue;
      }

      const docRef = db.collection("players").doc();
      const type = detectType(rawName);
      await docRef.set({
        fullName: normalized,
        type,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      playerByName.set(key, { id: docRef.id, fullName: normalized, type });
      playerIds.push(docRef.id);
      allowedPlayerIds.add(docRef.id);
    }

    const rosterId = `${seasonId}_${teamId}`;
    await db
      .collection("rosters")
      .doc(rosterId)
      .set(
        {
          seasonId,
          teamId,
          playerIds: Array.from(new Set(playerIds)),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    console.log(`Roster upserted: ${teamId} (${playerIds.length})`);
  }

  return allowedPlayerIds;
}

async function pruneSeasonStats(allowedPlayerIds: Set<string>) {
  const statsSnap = await db
    .collection("playerStats")
    .where("seasonId", "==", seasonId)
    .get();

  const toDelete = statsSnap.docs.filter((doc) => {
    const data = doc.data() as { playerId?: string };
    const playerId = data.playerId;
    return !playerId || !allowedPlayerIds.has(playerId);
  });

  if (toDelete.length === 0) {
    console.log("No season stats to prune.");
    return;
  }

  let deleted = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of toDelete) {
    batch.delete(doc.ref);
    batchCount += 1;

    if (batchCount === 400) {
      await batch.commit();
      deleted += batchCount;
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    deleted += batchCount;
  }

  console.log(`Pruned ${deleted} playerStats docs for season ${seasonId}.`);
}

async function main() {
  const roster = await loadInput();
  const teamIds = Object.keys(roster);

  if (teamIds.length === 0) {
    throw new Error("Roster input is empty.");
  }

  await ensureTeamsExist(teamIds);
  const allowedPlayerIds = await upsertPlayersAndRosters(roster);

  if (pruneStats) {
    await pruneSeasonStats(allowedPlayerIds);
  } else {
    console.log("PRUNE_STATS=false, skipping playerStats pruning.");
  }

  console.log("Season roster sync complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
