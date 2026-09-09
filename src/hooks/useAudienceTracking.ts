import { useEffect } from "react";
import {
  AudienceContext,
  getAudienceSessionId,
  getAudienceSource,
  getAudienceVisitorId,
  logAudienceHeartbeat,
  logAudienceOpen,
  recordAudienceHeartbeat,
} from "../pilot/audience";

const HEARTBEAT_MS = 60_000;

const useAudienceTracking = (context: AudienceContext) => {
  const { tournamentId, matchId, scope } = context;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    let lastHeartbeatMinute: number | null = null;
    const identity = {
      visitorId: getAudienceVisitorId(),
      sessionId: getAudienceSessionId(),
      source: getAudienceSource(),
    };
    const stableContext: AudienceContext = { tournamentId, matchId, scope };

    logAudienceOpen(stableContext, identity.source).catch((error) => {
      console.warn("GA4 audience open event failed", error);
    });

    const heartbeat = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const minuteBucket = Math.floor(Date.now() / HEARTBEAT_MS);
      if (lastHeartbeatMinute === minuteBucket) return;
      lastHeartbeatMinute = minuteBucket;

      recordAudienceHeartbeat(stableContext, identity, minuteBucket).catch((error) => {
        console.warn("Audience heartbeat failed", error);
      });
      logAudienceHeartbeat(stableContext, identity.source).catch((error) => {
        console.warn("GA4 audience heartbeat failed", error);
      });
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [matchId, scope, tournamentId]);
};

export default useAudienceTracking;
