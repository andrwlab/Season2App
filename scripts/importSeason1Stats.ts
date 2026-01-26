import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import path from "node:path";
import xlsx from "xlsx";

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
const statsFile = process.env.STATS_FILE || "estadisticas_torneo.xlsx";
const matchId = process.env.S1_STATS_MATCH_ID || "s1_totals";

type StatRow = {
  Jugador?: string;
  Equipo?: string;
  Ataques?: number;
  Bloqueos?: number;
  Servicios?: number;
  Total?: number;
};

const normalizeName = (name: string) => {
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s+\d{1,2}(?:st|nd|rd|th)?[A-Za-z]?$/i, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

const detectType = (name: string) => {
  const lower = name.trim().toLowerCase();
  return lower.startsWith("mr.") || lower.startsWith("mrs.") ? "teacher" : "student";
};

function readStats(filePath: string): StatRow[] {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  return xlsx.utils.sheet_to_json<StatRow>(ws, { defval: "" });
}

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

async function main() {
  await ensureSeasonDoc();

  const filePath = path.resolve(statsFile);
  const rows = readStats(filePath).filter((r) => r.Jugador && r.Equipo);
  if (!rows.length) {
    throw new Error("No rows found in stats file.");
  }

  const playersSnap = await db.collection("players").get();
  const playerByName = new Map<string, string>();
  playersSnap.forEach((doc) => {
    const data = doc.data() as any;
    const name = data.fullName || data.name;
    if (name) playerByName.set(normalizeName(String(name)).toLowerCase(), doc.id);
  });

  const teamsSnap = await db.collection("teams").where("seasonId", "==", seasonId).get();
  const teamByName = new Map<string, string>();
  teamsSnap.forEach((doc) => {
    const data = doc.data() as any;
    const name = data.name ? String(data.name).toLowerCase() : "";
    const slug = data.slug ? String(data.slug).toLowerCase() : "";
    if (name) teamByName.set(name, doc.id);
    if (slug) teamByName.set(slug, doc.id);
  });

  const rosterMap = new Map<string, Set<string>>();
  let createdStats = 0;

  for (const row of rows) {
    const rawName = String(row.Jugador || "").trim();
    const teamName = String(row.Equipo || "").trim();
    if (!rawName || !teamName) continue;

    const normalized = normalizeName(rawName);
    const key = normalized.toLowerCase();
    let playerId = playerByName.get(key);
    if (!playerId) {
      const docRef = db.collection("players").doc();
      await docRef.set({
        fullName: normalized,
        type: detectType(rawName),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      playerId = docRef.id;
      playerByName.set(key, playerId);
    }

    const teamId = teamByName.get(teamName.toLowerCase());
    if (!teamId) {
      console.warn(`Team not found for row: "${teamName}"`);
      continue;
    }

    const attack = Number(row.Ataques || 0);
    const blocks = Number(row.Bloqueos || 0);
    const service = Number(row.Servicios || 0);

    const statId = `${seasonId}_${playerId}`;
    await db.collection("playerStats").doc(statId).set(
      {
        seasonId,
        matchId,
        playerId,
        attack,
        blocks,
        service,
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
  console.log("Season 1 stats import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
