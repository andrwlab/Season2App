import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "webtorneitoapp";
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });

const db = getFirestore();
const matches = [
  { id: "harpy-2026-10-02-women", date: "2026-10-02", side: "women", opponent: "American School International" },
  { id: "harpy-2026-10-02-men", date: "2026-10-02", side: "men", opponent: "American School International" },
];

async function main() {
  let created = 0;
  for (const match of matches) {
    const ref = db.collection("sabisVolleyballMatches").doc(match.id);
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`[skip] ${match.id} already exists`);
      continue;
    }
    await ref.create({
      ...match,
      status: "scheduled",
      setsFor: 0,
      setsAgainst: 0,
      starters: [],
      substitutions: [],
      stats: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    created += 1;
    console.log(`[created] ${match.id}`);
  }
  console.log(`SABIS volleyball fixtures ready: ${created} created, ${matches.length - created} unchanged.`);
}

main().catch((error) => {
  console.error("Could not seed SABIS volleyball fixtures", error);
  process.exitCode = 1;
});
