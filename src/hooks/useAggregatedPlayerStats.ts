import { useEffect, useState } from "react";
import { subscribePlayerStats, subscribePlayers } from "../firebase/queries";

interface PlayerStat {
  name: string;
  attack: number;
  blocks: number;
  service: number;
  type?: string;
  team?: string;
}

export function useAggregatedPlayerStats(seasonId?: string | null): PlayerStat[] {
  const [stats, setStats] = useState<PlayerStat[]>([]);

  useEffect(() => {
    const totals: Record<string, PlayerStat> = {};
    const unsubStats = subscribePlayerStats(seasonId, (statsSnap: any[]) => {
      statsSnap.forEach((stat: any) => {
        if (!totals[stat.playerId]) {
          totals[stat.playerId] = {
            name: stat.playerId,
            attack: 0,
            blocks: 0,
            service: 0,
          };
        }
        totals[stat.playerId].attack += stat.attack || 0;
        totals[stat.playerId].blocks += stat.blocks || 0;
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
    });
    return () => unsubStats();
  }, [seasonId]);

  return stats;
}
