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
  const { seasons } = useSeason();

  const season1Ids = useMemo(
    () => seasons.filter((s) => isSeason1Name(s.name)).map((s) => s.id),
    [seasons]
  );

  const stats = useAggregatedPlayerStats(null, {
    includeSeason1: true,
    season1Ids,
  });
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

      <div className="glass glass--strong tableWrap">
        <div className="tableScroll">
          <table className="table table-auto w-full text-sm text-left">
          <thead>
            <tr>
              <th className="px-2 py-2 sm:px-4">Player</th>
              <th className="px-2 py-2 cursor-pointer sm:hidden" onClick={() => setSortKey("total")}>
                Total{Arrow({ field: "total" })}
              </th>
              <th className="px-2 py-2 cursor-pointer sm:hidden" onClick={() => setSortKey("attack")}>
                Att{Arrow({ field: "attack" })}
              </th>
              <th className="px-2 py-2 cursor-pointer sm:hidden" onClick={() => setSortKey("blocks")}>
                Blk{Arrow({ field: "blocks" })}
              </th>
              <th className="px-2 py-2 cursor-pointer sm:hidden" onClick={() => setSortKey("assists")}>
                Ast{Arrow({ field: "assists" })}
              </th>
              <th className="px-2 py-2 cursor-pointer sm:hidden" onClick={() => setSortKey("service")}>
                Srv{Arrow({ field: "service" })}
              </th>
              <th className="hidden px-4 py-2 cursor-pointer sm:table-cell" onClick={() => setSortKey("attack")}>
                Attacks{Arrow({ field: "attack" })}
              </th>
              <th className="hidden px-4 py-2 cursor-pointer sm:table-cell" onClick={() => setSortKey("blocks")}>
                Blocks{Arrow({ field: "blocks" })}
              </th>
              <th className="hidden px-4 py-2 cursor-pointer sm:table-cell" onClick={() => setSortKey("assists")}>
                Assists{Arrow({ field: "assists" })}
              </th>
              <th className="hidden px-4 py-2 cursor-pointer sm:table-cell" onClick={() => setSortKey("service")}>
                Serves{Arrow({ field: "service" })}
              </th>
              <th className="hidden px-4 py-2 cursor-pointer sm:table-cell" onClick={() => setSortKey("total")}>
                Total{Arrow({ field: "total" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td className="px-2 py-6 text-center text-muted sm:hidden" colSpan={6}>
                  No players to show.
                </td>
                <td className="hidden px-4 py-6 text-center text-muted sm:table-cell" colSpan={6}>
                  No players to show.
                </td>
              </tr>
            )}
            {sorted.map((player) => {
              const total = player.attack + player.blocks + player.assists + player.service;
              return (
                <tr key={player.name}>
                  <td className="px-2 py-2 sm:px-4">{player.name}</td>
                  <td className="px-2 py-2 font-bold text-strong sm:hidden">{total}</td>
                  <td className="px-2 py-2 sm:hidden">{player.attack}</td>
                  <td className="px-2 py-2 sm:hidden">{player.blocks}</td>
                  <td className="px-2 py-2 sm:hidden">{player.assists}</td>
                  <td className="px-2 py-2 sm:hidden">{player.service}</td>
                  <td className="hidden px-4 py-2 sm:table-cell">{player.attack}</td>
                  <td className="hidden px-4 py-2 sm:table-cell">{player.blocks}</td>
                  <td className="hidden px-4 py-2 sm:table-cell">{player.assists}</td>
                  <td className="hidden px-4 py-2 sm:table-cell">{player.service}</td>
                  <td className="hidden px-4 py-2 font-bold text-strong sm:table-cell">{total}</td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CumulativeStats;
