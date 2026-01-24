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

const collectionsToTag = ["teams", "matches", "rosters", "playerStats"];
const seasonId = "s1";
const seasonName = process.env.S1_NAME || "Season 1";
const seasonStartDate = process.env.S1_START_DATE || "2025-01-01";

async function tagCollection(collectionName: string) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`[${collectionName}] no docs found`);
    return;
  }

  let batch = db.batch();
  let batchCount = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.seasonId) continue;

    batch.update(doc.ref, {
      seasonId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batchCount += 1;
    updated += 1;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`[${collectionName}] updated ${updated} docs`);
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
  for (const name of collectionsToTag) {
    await tagCollection(name);
  }
  console.log("Season 1 migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
