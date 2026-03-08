import { useEffect, useMemo, useState } from "react";
import {
  Player,
  subscribeAllPlayerStats,
  subscribePlayerStats,
  subscribePlayers,
} from "../firebase/queries";
import { season1Players } from "../data";

const normalizeName = (value?: string | null) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
};

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

  const normalizedPlayers = useMemo(
    () =>
      players.map((p) => {
        const displayName = p.fullName || (p as any).name || "";
        return {
          id: p.id,
          name: displayName,
          normalized: normalizeName(displayName),
          type: p.type,
        };
      }),
    [players]
  );

  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const nameToPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    normalizedPlayers.forEach((player) => {
      if (!player.normalized) return;
      if (!map[player.normalized]) map[player.normalized] = player.id;
    });
    return map;
  }, [normalizedPlayers]);

  useEffect(() => {
    const totalsById: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    const fallbackNameById: Record<string, string> = {};
    const season1IdSet = new Set(season1Ids);
    const season1PlayerIdsInDb = new Set<string>();

    const resolvePlayerId = (rawId: any) => {
      if (!rawId) return "";
      const asString = typeof rawId === "string" ? rawId : rawId.id;
      if (!asString) return "";
      const normalized = normalizeName(asString);
      return nameToPlayerId[normalized] || asString;
    };

    statsSnap.forEach((stat: any) => {
      const resolvedPlayerId = resolvePlayerId(stat.playerId);
      if (!resolvedPlayerId) return;
      if (stat.playerName && !fallbackNameById[resolvedPlayerId]) {
        fallbackNameById[resolvedPlayerId] = stat.playerName;
      }
      if (season1IdSet.size && season1IdSet.has(stat.seasonId)) {
        season1PlayerIdsInDb.add(resolvedPlayerId);
      }
      if (excludeSeasonId && stat.seasonId === excludeSeasonId) return;
      if (!totalsById[resolvedPlayerId]) {
        totalsById[resolvedPlayerId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      }
      totalsById[resolvedPlayerId].attack += stat.attack || 0;
      totalsById[resolvedPlayerId].blocks += stat.blocks || 0;
      totalsById[resolvedPlayerId].assists += stat.assists || 0;
      totalsById[resolvedPlayerId].service += stat.service || 0;
    });

    const season1NameById: Record<string, string> = {};
    const shouldIncludeSeason1 =
      includeSeason1 && (!excludeSeasonId || !season1IdSet.has(excludeSeasonId));
    if (shouldIncludeSeason1) {
      season1Players.forEach((p) => {
        const normalized = normalizeName(p.name);
        let resolvedId = normalized ? nameToPlayerId[normalized] : undefined;
        if (!resolvedId && normalized) {
          const matches = normalizedPlayers.filter(
            (player) => player.normalized && player.normalized.includes(normalized)
          );
          if (matches.length === 1) resolvedId = matches[0].id;
        }
        const id = resolvedId || `season1:${p.name}`;
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
      const playerInfo = playersById[id];
      return {
        name:
          playerInfo?.fullName ||
          (playerInfo as any)?.name ||
          fallbackNameById[id] ||
          season1NameById[id] ||
          id,
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
    normalizedPlayers,
    players,
    playersById,
    season1Ids,
    statsSnap,
  ]);

  return stats;
}
