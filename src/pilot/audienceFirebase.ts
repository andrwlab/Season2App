import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { app } from "../firebase";

// A named Firebase app has its own auth persistence. A spectator heartbeat
// must never replace the Google session used by the scorer in another tab.
const audienceApp = initializeApp(app.options, "spectator-audience");
const audienceAuth = getAuth(audienceApp);
export const audienceDb = initializeFirestore(audienceApp, { ignoreUndefinedProperties: true });

let pendingAuth: Promise<string> | null = null;

export const getAudienceAuthUid = (): Promise<string> => {
  if (!pendingAuth) {
    pendingAuth = audienceAuth.authStateReady()
      .then(async () => {
        const user = audienceAuth.currentUser ?? (await signInAnonymously(audienceAuth)).user;
        return user.uid;
      })
      .finally(() => { pendingAuth = null; });
  }
  return pendingAuth;
};
