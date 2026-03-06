import { useEffect, useMemo, useState } from "react";
import {
  Player,
  subscribeAllPlayerStats,
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
  options?: {
    includeSeason1?: boolean;
    excludeSeasonId?: string | null;
    season1Ids?: string[];
  }
): PlayerStat[] {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [statsSnap, setStatsSnap] = useState<any[]>([]);
  const includeSeason1 = options?.includeSeason1 ?? false;
  const excludeSeasonId = options?.excludeSeasonId ?? null;
  const season1Ids = options?.season1Ids ?? [];

  useEffect(() => {
    return subscribePlayers(setPlayers);
  }, []);

  useEffect(() => {
    if (seasonId === undefined) {
      setStatsSnap([]);
      return () => {};
    }
    if (seasonId === null) {
      return subscribeAllPlayerStats(setStatsSnap);
    }
    return subscribePlayerStats(seasonId, setStatsSnap);
  }, [seasonId]);

  const nameToPlayerId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.fullName, p.id])),
    [players]
  );

  useEffect(() => {
    const totalsById: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    const season1IdSet = new Set(season1Ids);
    const season1PlayerIdsInDb = new Set<string>();
    statsSnap.forEach((stat: any) => {
      if (season1IdSet.size && season1IdSet.has(stat.seasonId)) {
        season1PlayerIdsInDb.add(stat.playerId);
      }
      if (excludeSeasonId && stat.seasonId === excludeSeasonId) return;
      if (!totalsById[stat.playerId]) {
        totalsById[stat.playerId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      }
      totalsById[stat.playerId].attack += stat.attack || 0;
      totalsById[stat.playerId].blocks += stat.blocks || 0;
      totalsById[stat.playerId].assists += stat.assists || 0;
      totalsById[stat.playerId].service += stat.service || 0;
    });

    const season1NameById: Record<string, string> = {};
    const shouldIncludeSeason1 =
      includeSeason1 && (!excludeSeasonId || !season1IdSet.has(excludeSeasonId));
    if (shouldIncludeSeason1) {
      season1Players.forEach((p) => {
        const id = nameToPlayerId[p.name] || `season1:${p.name}`;
        if (season1PlayerIdsInDb.has(id)) return;
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
  }, [
    excludeSeasonId,
    includeSeason1,
    nameToPlayerId,
    players,
    season1Ids,
    statsSnap,
  ]);

  return stats;
}
