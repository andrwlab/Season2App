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

type JsonRosterMap =
  | Record<string, string[]>
  | { teams: { teamId?: string; teamName?: string; players: string[] }[] };

const normalizeName = (name: string) => {
  let cleaned = name.trim();
  // Remove trailing grade tokens like "8A", "11th", "10", "9B"
  cleaned = cleaned.replace(/\s+\d{1,2}(?:st|nd|rd|th)?[A-Za-z]?$/i, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

const detectType = (name: string) => {
  return name.trim().toLowerCase().startsWith("mr.") ? "teacher" : "student";
};

const parseCsvLike = (raw: string) => {
  const map: Record<string, string[]> = {};
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [team, player] = line.split(",").map((s) => s.trim());
      if (!team || !player) return;
      if (!map[team]) map[team] = [];
      map[team].push(player);
    });
  return map;
};

const loadInput = async (): Promise<JsonRosterMap> => {
  if (!inputFile) {
    throw new Error("ROSTER_FILE env var is required.");
  }
  const raw = await readFile(path.resolve(inputFile), "utf-8");
  if (inputFile.endsWith(".json")) {
    return JSON.parse(raw) as JsonRosterMap;
  }
  return parseCsvLike(raw);
};

async function main() {
  const input = await loadInput();

  const teamsSnap = await db.collection("teams").where("seasonId", "==", seasonId).get();
  const teamById = new Map<string, string>();
  const teamByName = new Map<string, string>();
  teamsSnap.forEach((doc) => {
    const data = doc.data();
    const id = doc.id;
    teamById.set(id, id);
    if (data.name) teamByName.set(String(data.name).toLowerCase(), id);
    if (data.slug) teamByName.set(String(data.slug).toLowerCase(), id);
  });

  const playersSnap = await db.collection("players").get();
  const playerByName = new Map<string, string>();
  playersSnap.forEach((doc) => {
    const data = doc.data() as any;
    const name = data.fullName || data.name;
    if (name) playerByName.set(normalizeName(String(name)).toLowerCase(), doc.id);
  });

  const rosterEntries: { teamId: string; players: string[] }[] = [];

  if ("teams" in input) {
    input.teams.forEach((team) => {
      const teamId = team.teamId || teamByName.get(String(team.teamName || "").toLowerCase());
      if (!teamId) {
        console.warn(`Team not found: ${team.teamId || team.teamName}`);
        return;
      }
      rosterEntries.push({ teamId, players: team.players || [] });
    });
  } else {
    Object.entries(input).forEach(([key, players]) => {
      const teamId = teamById.get(key) || teamByName.get(key.toLowerCase());
      if (!teamId) {
        console.warn(`Team not found: ${key}`);
        return;
      }
      rosterEntries.push({ teamId, players });
    });
  }

  for (const entry of rosterEntries) {
    const playerIds: string[] = [];
    for (const rawName of entry.players) {
      const normalized = normalizeName(rawName);
      const key = normalized.toLowerCase();
      let playerId = playerByName.get(key);
      if (!playerId) {
        const docRef = db.collection("players").doc();
        const type = detectType(rawName);
        await docRef.set({
          fullName: normalized,
          type,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        playerId = docRef.id;
        playerByName.set(key, playerId);
      }
      playerIds.push(playerId);
    }

    const rosterId = `${seasonId}_${entry.teamId}`;
    await db
      .collection("rosters")
      .doc(rosterId)
      .set(
        {
          seasonId,
          teamId: entry.teamId,
          playerIds: Array.from(new Set(playerIds)),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    console.log(`Roster upserted: ${entry.teamId} (${playerIds.length})`);
  }

  console.log("Roster import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
