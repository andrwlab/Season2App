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

const DRY_RUN = (process.env.DRY_RUN || "1") !== "0";

const normalizeName = (name: string) => {
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s+\d{1,2}(?:st|nd|rd|th)?[A-Za-z]?$/i, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.toLowerCase();
};

type PlayerDoc = {
  id: string;
  fullName?: string;
  name?: string;
  type?: string;
  photoUrl?: string;
};

async function main() {
  const playersSnap = await db.collection("players").get();
  const groups = new Map<string, PlayerDoc[]>();

  playersSnap.forEach((doc) => {
    const data = doc.data() as any;
    const name = data.fullName || data.name;
    if (!name) return;
    const key = normalizeName(String(name));
    const entry: PlayerDoc = {
      id: doc.id,
      fullName: data.fullName,
      name: data.name,
      type: data.type,
      photoUrl: data.photoUrl,
    };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  });

  const duplicates = Array.from(groups.entries()).filter(([, list]) => list.length > 1);
  if (duplicates.length === 0) {
    console.log("No duplicate player names found.");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate name groups.`);

  for (const [nameKey, list] of duplicates) {
    const keep = list.find((p) => p.fullName) || list[0];
    const toRemove = list.filter((p) => p.id !== keep.id);
    console.log(`- ${nameKey}: keep ${keep.id}, remove ${toRemove.map((p) => p.id).join(", ")}`);

    for (const dup of toRemove) {
      const rosterSnap = await db
        .collection("rosters")
        .where("playerIds", "array-contains", dup.id)
        .get();
      for (const rosterDoc of rosterSnap.docs) {
        const data = rosterDoc.data() as any;
        const nextIds = Array.from(
          new Set((data.playerIds || []).map((id: string) => (id === dup.id ? keep.id : id)))
        );
        if (DRY_RUN) {
          console.log(`[dry-run] update roster ${rosterDoc.id} -> ${dup.id} => ${keep.id}`);
        } else {
          await rosterDoc.ref.update({ playerIds: nextIds });
        }
      }

      const statsSnap = await db.collection("playerStats").where("playerId", "==", dup.id).get();
      for (const statDoc of statsSnap.docs) {
        if (DRY_RUN) {
          console.log(`[dry-run] update playerStats ${statDoc.id} -> ${dup.id} => ${keep.id}`);
        } else {
          await statDoc.ref.update({ playerId: keep.id });
        }
      }

      const tradesSnap = await db.collection("trades").where("playerId", "==", dup.id).get();
      for (const tradeDoc of tradesSnap.docs) {
        if (DRY_RUN) {
          console.log(`[dry-run] update trades ${tradeDoc.id} -> ${dup.id} => ${keep.id}`);
        } else {
          await tradeDoc.ref.update({ playerId: keep.id });
        }
      }

      if (DRY_RUN) {
        console.log(`[dry-run] delete player ${dup.id}`);
      } else {
        await db.collection("players").doc(dup.id).delete();
      }
    }
  }

  console.log(DRY_RUN ? "Dry run complete." : "Deduplication complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
