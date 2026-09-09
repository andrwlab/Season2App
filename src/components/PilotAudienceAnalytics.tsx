import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

type AudienceHeartbeat = {
  visitorId: string;
  sessionId: string;
  scope: "TOURNAMENT" | "MATCH";
  tournamentId: string;
  matchId?: string | null;
  source?: string;
  minuteBucket: number;
  clientSeenAt?: number;
};

const ACTIVE_WINDOW_MS = 90_000;

const PilotAudienceAnalytics = ({ tournamentId }: { tournamentId: string }) => {
  const [heartbeats, setHeartbeats] = useState<AudienceHeartbeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const q = query(collection(db, "pilotAudienceHeartbeats"), where("tournamentId", "==", tournamentId));
    return onSnapshot(
      q,
      (snapshot) => {
        setHeartbeats(snapshot.docs.map((item) => item.data() as AudienceHeartbeat));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Audience analytics snapshot failed", err);
        setError("Audience analytics are not available yet.");
        setLoading(false);
      }
    );
  }, [tournamentId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    const allVisitors = new Set<string>();
    const matchVisitors = new Set<string>();
    const activeVisitors = new Set<string>();
    const minuteVisitors = new Map<number, Set<string>>();
    const visitorSessions = new Map<string, Set<string>>();
    const sourceVisitors = new Map<string, Set<string>>();
    const matchStats = new Map<string, { visitors: Set<string>; minuteVisitors: Map<number, Set<string>> }>();
    const activeMinuteKeys = new Set<string>();

    heartbeats.forEach((heartbeat) => {
      if (!heartbeat.visitorId || !Number.isFinite(heartbeat.minuteBucket)) return;
      allVisitors.add(heartbeat.visitorId);
      if (heartbeat.scope === "MATCH") matchVisitors.add(heartbeat.visitorId);

      const seenAt = heartbeat.clientSeenAt ?? heartbeat.minuteBucket * 60_000;
      if (seenAt >= now - ACTIVE_WINDOW_MS) activeVisitors.add(heartbeat.visitorId);

      if (!minuteVisitors.has(heartbeat.minuteBucket)) minuteVisitors.set(heartbeat.minuteBucket, new Set());
      minuteVisitors.get(heartbeat.minuteBucket)!.add(heartbeat.visitorId);

      const sessionSet = visitorSessions.get(heartbeat.visitorId) ?? new Set<string>();
      if (heartbeat.sessionId) sessionSet.add(heartbeat.sessionId);
      visitorSessions.set(heartbeat.visitorId, sessionSet);

      const source = heartbeat.source || "direct";
      const sourceSet = sourceVisitors.get(source) ?? new Set<string>();
      sourceSet.add(heartbeat.visitorId);
      sourceVisitors.set(source, sourceSet);

      const scopeKey = heartbeat.scope === "MATCH" ? heartbeat.matchId || "unknown" : "hub";
      activeMinuteKeys.add(`${heartbeat.visitorId}:${scopeKey}:${heartbeat.minuteBucket}`);

      if (heartbeat.scope === "MATCH" && heartbeat.matchId) {
        const row = matchStats.get(heartbeat.matchId) ?? { visitors: new Set<string>(), minuteVisitors: new Map<number, Set<string>>() };
        row.visitors.add(heartbeat.visitorId);
        if (!row.minuteVisitors.has(heartbeat.minuteBucket)) row.minuteVisitors.set(heartbeat.minuteBucket, new Set());
        row.minuteVisitors.get(heartbeat.minuteBucket)!.add(heartbeat.visitorId);
        matchStats.set(heartbeat.matchId, row);
      }
    });

    const peakConcurrent = Math.max(0, ...Array.from(minuteVisitors.values()).map((set) => set.size));
    const repeatVisitors = Array.from(visitorSessions.values()).filter((sessions) => sessions.size > 1).length;
    const averageTrackedMinutes = allVisitors.size > 0 ? activeMinuteKeys.size / allVisitors.size : 0;

    const sources = Array.from(sourceVisitors.entries())
      .map(([source, visitors]) => ({ source, visitors: visitors.size }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 4);

    const matches = Array.from(matchStats.entries())
      .map(([matchId, row]) => ({
        matchId,
        viewers: row.visitors.size,
        peak: Math.max(0, ...Array.from(row.minuteVisitors.values()).map((set) => set.size)),
      }))
      .sort((a, b) => b.viewers - a.viewers);

    return {
      uniqueVisitors: allVisitors.size,
      uniqueMatchViewers: matchVisitors.size,
      activeNow: activeVisitors.size,
      peakConcurrent,
      repeatVisitors,
      trackedMinutes: activeMinuteKeys.size,
      averageTrackedMinutes,
      sources,
      matches,
    };
  }, [heartbeats, now]);

  if (loading) {
    return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-500">Loading audience analytics…</div>;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Audience Analytics · V1</p>
          <p className="mt-1 text-sm text-slate-500">Anonymous device-level audience estimates. No spectator account required.</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-emerald-300">60s heartbeat</span>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">{error} Enable Firebase Anonymous Authentication and deploy the updated Firestore rules before the pilot.</div>
      ) : heartbeats.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-500">No audience data yet. The first public spectator visit will create the first anonymous heartbeat.</div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Watching now" value={metrics.activeNow} />
            <Metric label="Unique visitors" value={metrics.uniqueVisitors} />
            <Metric label="Match viewers" value={metrics.uniqueMatchViewers} />
            <Metric label="Peak concurrent" value={metrics.peakConcurrent} />
            <Metric label="Repeat viewers" value={metrics.repeatVisitors} />
            <Metric label="Avg tracked min" value={metrics.averageTrackedMinutes.toFixed(1)} />
          </div>

          {metrics.matches.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">By match</p><span className="text-xs text-slate-600">{metrics.trackedMinutes} tracked viewer-minutes</span></div>
              <div className="space-y-2">
                {metrics.matches.map((match) => (
                  <div key={match.matchId} className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl bg-slate-950/50 px-3 py-2.5 text-sm">
                    <span className="truncate font-bold text-slate-200">{match.matchId}</span>
                    <span className="text-slate-400">{match.viewers} viewers</span>
                    <span className="font-black text-cyan-300">peak {match.peak}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metrics.sources.length > 0 && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Top sources</p>
              <div className="flex flex-wrap gap-2">
                {metrics.sources.map((source) => <span key={source.source} className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs font-bold text-slate-300">{source.source} · {source.visitors}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black tabular-nums text-white">{value}</p>
  </div>
);

export default PilotAudienceAnalytics;
