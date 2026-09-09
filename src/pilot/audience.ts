import { logEvent } from "firebase/analytics";
import { signInAnonymously } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { analyticsPromise, auth, db } from "../firebase";

export type AudienceScope = "TOURNAMENT" | "MATCH";

export type AudienceContext = {
  tournamentId: string;
  matchId?: string;
  scope: AudienceScope;
};

const VISITOR_ID_KEY = "livescore:audience:visitor-id:v1";
const SESSION_ID_KEY = "livescore:audience:session-id:v1";
const SOURCE_KEY = "livescore:audience:source:v1";

const randomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const safeStorageGet = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (storage: Storage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing/storage restrictions should not break the spectator view.
  }
};

export const getAudienceVisitorId = () => {
  if (typeof window === "undefined") return "server";
  const existing = safeStorageGet(window.localStorage, VISITOR_ID_KEY);
  if (existing) return existing;
  const visitorId = randomId();
  safeStorageSet(window.localStorage, VISITOR_ID_KEY, visitorId);
  return visitorId;
};

export const getAudienceSessionId = () => {
  if (typeof window === "undefined") return "server";
  const existing = safeStorageGet(window.sessionStorage, SESSION_ID_KEY);
  if (existing) return existing;
  const sessionId = randomId();
  safeStorageSet(window.sessionStorage, SESSION_ID_KEY, sessionId);
  return sessionId;
};

export const getAudienceSource = () => {
  if (typeof window === "undefined") return "direct";

  const fromQuery = new URLSearchParams(window.location.search).get("src")?.trim().toLowerCase();
  if (fromQuery) {
    const normalized = fromQuery.slice(0, 40);
    safeStorageSet(window.sessionStorage, SOURCE_KEY, normalized);
    return normalized;
  }

  return safeStorageGet(window.sessionStorage, SOURCE_KEY) || "direct";
};

const ensureAudienceAuth = async () => {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
};

const scopeKeyFor = ({ tournamentId, matchId, scope }: AudienceContext) => {
  const raw = scope === "MATCH" ? `${tournamentId}__${matchId || "unknown"}` : `${tournamentId}__hub`;
  return encodeURIComponent(raw);
};

export const recordAudienceHeartbeat = async (
  context: AudienceContext,
  identity: { visitorId: string; sessionId: string; source: string },
  minuteBucket = Math.floor(Date.now() / 60000)
) => {
  const user = await ensureAudienceAuth();
  const clientSeenAt = Date.now();
  const scopeKey = scopeKeyFor(context);
  const heartbeatId = `${scopeKey}__${user.uid}__${minuteBucket}`;

  await setDoc(
    doc(db, "pilotAudienceHeartbeats", heartbeatId),
    {
      version: 1,
      authUid: user.uid,
      visitorId: identity.visitorId,
      sessionId: identity.sessionId,
      scope: context.scope,
      tournamentId: context.tournamentId,
      matchId: context.matchId ?? null,
      source: identity.source,
      minuteBucket,
      clientSeenAt,
      serverSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const logGaEvent = async (name: string, params: Record<string, string | number>) => {
  const analytics = await analyticsPromise;
  if (!analytics) return;
  logEvent(analytics, name, params);
};

export const logAudienceOpen = async (context: AudienceContext, source: string) => {
  await logGaEvent(context.scope === "MATCH" ? "match_open" : "tournament_open", {
    tournament_id: context.tournamentId,
    match_id: context.matchId ?? "hub",
    traffic_source: source,
  });
};

export const logAudienceHeartbeat = async (context: AudienceContext, source: string) => {
  await logGaEvent("audience_heartbeat", {
    tournament_id: context.tournamentId,
    match_id: context.matchId ?? "hub",
    audience_scope: context.scope.toLowerCase(),
    traffic_source: source,
  });
};
