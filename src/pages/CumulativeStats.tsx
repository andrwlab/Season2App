import React, { useMemo, useState } from "react";
import { useAggregatedPlayerStats } from "../hooks/useAggregatedPlayerStats";
import { useSeason } from "../hooks/useSeason";

const isSeason1Name = (name?: string | null) => {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return normalized.includes("season 1") || normalized.includes("temporada 1") || normalized === "s1";
};

type SortKey = "total" | "attack" | "blocks" | "assists" | "service";

const CumulativeStats = () => {
  const { seasons, selectedSeasonId } = useSeason();

  const seasonIdForCumulative = useMemo(() => {
    const activeNonSeason1 = seasons.find((s) => s.isActive && !isSeason1Name(s.name));
    if (activeNonSeason1) return activeNonSeason1.id;
    const anyNonSeason1 = seasons.find((s) => !isSeason1Name(s.name));
    if (anyNonSeason1) return anyNonSeason1.id;
    return selectedSeasonId ?? null;
  }, [seasons, selectedSeasonId]);

  const stats = useAggregatedPlayerStats(seasonIdForCumulative, true);
  const [sortKey, setSortKey] = useState<SortKey>("total");

  const sorted = useMemo(() => {
    const copy = stats.filter((p) => {
      const total = p.attack + p.blocks + p.assists + p.service;
      return total > 0;
    });
    return copy.sort((a, b) => {
      const totalA = a.attack + a.blocks + a.assists + a.service;
      const totalB = b.attack + b.blocks + b.assists + b.service;
      const valA = sortKey === "total" ? totalA : a[sortKey];
      const valB = sortKey === "total" ? totalB : b[sortKey];
      return valB - valA;
    });
  }, [stats, sortKey]);

  const Arrow = ({ field }: { field: SortKey }) => (sortKey === field ? " ↓" : "");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center text-strong">Cumulative Player Stats</h2>

      <div className="glass glass--strong tableWrap overflow-x-auto">
        <table className="table table-auto w-full text-sm text-left">
          <thead>
            <tr>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => setSortKey("attack")}>
                Attacks{Arrow({ field: "attack" })}
              </th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => setSortKey("blocks")}>
                Blocks{Arrow({ field: "blocks" })}
              </th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => setSortKey("assists")}>
                Assists{Arrow({ field: "assists" })}
              </th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => setSortKey("service")}>
                Serves{Arrow({ field: "service" })}
              </th>
              <th className="px-4 py-2 cursor-pointer" onClick={() => setSortKey("total")}>
                Total{Arrow({ field: "total" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted" colSpan={6}>
                  No players to show.
                </td>
              </tr>
            )}
            {sorted.map((player) => {
              const total = player.attack + player.blocks + player.assists + player.service;
              return (
                <tr key={player.name}>
                  <td className="px-4 py-2">{player.name}</td>
                  <td className="px-4 py-2">{player.attack}</td>
                  <td className="px-4 py-2">{player.blocks}</td>
                  <td className="px-4 py-2">{player.assists}</td>
                  <td className="px-4 py-2">{player.service}</td>
                  <td className="px-4 py-2 font-bold text-strong">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CumulativeStats;
