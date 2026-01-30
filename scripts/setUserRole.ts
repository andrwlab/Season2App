import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const uid = process.env.USER_UID || process.argv[2];
const role = process.env.USER_ROLE || process.argv[3] || "scorekeeper";

if (!uid) {
  console.error("Usage: USER_UID=<uid> [USER_ROLE=scorekeeper] tsx scripts/setUserRole.ts");
  process.exit(1);
}

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

async function main() {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const prevRole = snap.exists ? snap.data()?.role : undefined;

  await ref.set(
    {
      role,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`[users/${uid}] role ${prevRole ?? "(none)"} -> ${role}`);
}

main().catch((error) => {
  console.error("Failed to update user role:", error);
  process.exit(1);
});
