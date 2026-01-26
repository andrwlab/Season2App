import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
const batchSize = 500;

async function clearMatches() {
  let deleted = 0;

  while (true) {
    const snapshot = await db
      .collection("matches")
      .where("seasonId", "==", seasonId)
      .limit(batchSize)
      .get();

    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }

  console.log(`[matches] deleted ${deleted} docs for season ${seasonId}`);
}

clearMatches().catch((err) => {
  console.error(err);
  process.exit(1);
});
