import { useEffect, useState } from "react";
import { subscribeAllPlayerStats, subscribePlayerStats, subscribePlayers } from "../firebase/queries";

interface PlayerStat {
  name: string;
  attack: number;
  blocks: number;
  assists: number;
  service: number;
  type?: string;
  team?: string;
}

export function useAggregatedPlayerStats(seasonId?: string | null): PlayerStat[] {
  const [stats, setStats] = useState<PlayerStat[]>([]);

  useEffect(() => {
    const handleStats = (statsSnap: any[]) => {
      const totals: Record<string, PlayerStat> = {};
      statsSnap.forEach((stat: any) => {
        if (!totals[stat.playerId]) {
          totals[stat.playerId] = {
            name: stat.playerId,
            attack: 0,
            blocks: 0,
            assists: 0,
            service: 0,
          };
        }
        totals[stat.playerId].attack += stat.attack || 0;
        totals[stat.playerId].blocks += stat.blocks || 0;
        totals[stat.playerId].assists += stat.assists || 0;
        totals[stat.playerId].service += stat.service || 0;
      });
      subscribePlayers((players) => {
        const enriched = Object.entries(totals).map(([id, stat]) => {
          const playerInfo = players.find((p) => p.id === id);
          return {
            ...stat,
            name: playerInfo?.fullName || id,
            type: playerInfo?.type || "",
          };
        });
        setStats(enriched);
      });
    };

    const unsubStats = seasonId
      ? subscribePlayerStats(seasonId, handleStats)
      : subscribeAllPlayerStats(handleStats);
    return () => unsubStats();
  }, [seasonId]);

  return stats;
}
