import { useEffect, useMemo, useState } from "react";
import {
  Player,
  subscribePlayerStats,
  subscribePlayers,
} from "../firebase/queries";
import { season1Players } from "../data";

interface PlayerStat {
  name: string;
  attack: number;
  blocks: number;
  assists: number;
  service: number;
  type?: string;
  team?: string;
}

export function useAggregatedPlayerStats(
  seasonId?: string | null,
  includeSeason1 = false
): PlayerStat[] {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [statsSnap, setStatsSnap] = useState<any[]>([]);

  useEffect(() => {
    return subscribePlayers(setPlayers);
  }, []);

  useEffect(() => {
    if (!seasonId) {
      setStatsSnap([]);
      return () => {};
    }
    return subscribePlayerStats(seasonId, setStatsSnap);
  }, [seasonId]);

  const nameToPlayerId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.fullName, p.id])),
    [players]
  );

  useEffect(() => {
    const totalsById: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    statsSnap.forEach((stat: any) => {
      if (!totalsById[stat.playerId]) {
        totalsById[stat.playerId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      }
      totalsById[stat.playerId].attack += stat.attack || 0;
      totalsById[stat.playerId].blocks += stat.blocks || 0;
      totalsById[stat.playerId].assists += stat.assists || 0;
      totalsById[stat.playerId].service += stat.service || 0;
    });

    const season1NameById: Record<string, string> = {};
    if (includeSeason1) {
      season1Players.forEach((p) => {
        const id = nameToPlayerId[p.name] || `season1:${p.name}`;
        season1NameById[id] = p.name;
        if (!totalsById[id]) {
          totalsById[id] = { attack: 0, blocks: 0, assists: 0, service: 0 };
        }
        totalsById[id].attack += p.attack;
        totalsById[id].blocks += p.blocks;
        totalsById[id].assists += p.assists;
        totalsById[id].service += p.service;
      });
    }

    const enriched = Object.entries(totalsById).map(([id, totals]) => {
      const playerInfo = players.find((p) => p.id === id);
      return {
        name: playerInfo?.fullName || season1NameById[id] || id,
        attack: totals.attack,
        blocks: totals.blocks,
        assists: totals.assists,
        service: totals.service,
        type: playerInfo?.type || "",
      };
    });

    setStats(enriched);
  }, [nameToPlayerId, players, seasonId, statsSnap]);

  return stats;
}
