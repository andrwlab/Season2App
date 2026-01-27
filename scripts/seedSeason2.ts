import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const seasonId = "s2";
const seasonName = process.env.S2_NAME || "Season 2";
const seasonStartDate = process.env.S2_START_DATE || "2026-01-30";

const teams = [
  { id: "red-flame-dragons", name: "Red Flame Dragons", logoFile: "redflamedragons.png" },
  { id: "black-wolves", name: "Black Wolves", logoFile: "blackwolves.png" },
  { id: "white-sharks", name: "White Sharks", logoFile: "whitesharks.png" },
  { id: "yellow-lions", name: "The Roaring Yellow Lions", logoFile: "yellowlions.png" },
  { id: "green-vipers", name: "Green Vipers", logoFile: "greenvipers.png" },
  { id: "blue-raptors", name: "Blue Raptors", logoFile: "blueraptors.png" }
];

type ScheduleMatch = {
  time: string;
  home: string;
  away: string;
};

type ScheduleDate = {
  dateISO: string;
  matches: ScheduleMatch[];
};

type SchedulePayload = {
  dates: ScheduleDate[];
};

function resolveSchedulePath() {
  if (process.env.SEASON2_SCHEDULE) return process.env.SEASON2_SCHEDULE;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, "season2-schedule.json");
}

async function loadSchedule(): Promise<SchedulePayload> {
  const schedulePath = resolveSchedulePath();
  const raw = await readFile(schedulePath, "utf-8");
  return JSON.parse(raw) as SchedulePayload;
}

async function seedSeasonDoc() {
  await db.collection("seasons").doc(seasonId).set(
    {
      name: seasonName,
      startDate: seasonStartDate,
      isActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`[seasons/${seasonId}] ensured`);
}

async function seedTeams() {
  const batch = db.batch();
  for (const team of teams) {
    const ref = db.collection("teams").doc(team.id);
    batch.set(
      ref,
      {
        seasonId,
        name: team.name,
        slug: team.id,
        logoFile: team.logoFile,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
  console.log(`[teams] upserted ${teams.length} docs`);
}

async function seedMatches() {
  const schedule = await loadSchedule();
  if (!schedule.dates?.length) {
    throw new Error("Schedule JSON is empty.");
  }

  let created = 0;
  for (const day of schedule.dates) {
    for (const match of day.matches) {
      const matchRef = db.collection("matches").doc();
      await matchRef.set(
        {
          seasonId,
          dateISO: day.dateISO,
          timeHHmm: match.time,
          homeTeamId: match.home,
          awayTeamId: match.away,
          status: "scheduled",
          scores: { home: null, away: null },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      created += 1;
    }
  }
  console.log(`[matches] created ${created} docs`);
}

async function main() {
  await seedSeasonDoc();
  await seedTeams();
  await seedMatches();
  console.log("Season 2 seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
