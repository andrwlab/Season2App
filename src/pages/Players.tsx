import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Player,
  PlayerStat,
  Roster,
  Team,
  subscribePlayers,
  subscribePlayerStats,
  subscribeRosters,
  subscribeTeams,
} from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import { season1Players } from "../data";

const isSeason1Name = (name?: string | null) => {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return normalized.includes("season 1") || normalized.includes("temporada 1") || normalized === "s1";
};

const Players = () => {
  const { selectedSeasonId, selectedSeason } = useSeason();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filter, setFilter] = useState<"all" | "student" | "teacher">("all");
  const [sortKey, setSortKey] = useState<"total" | "attack" | "blocks" | "assists" | "service">("total");

  useEffect(() => subscribePlayers(setPlayers), []);
  useEffect(() => subscribePlayerStats(selectedSeasonId, setPlayerStats), [selectedSeasonId]);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

  const isSeason1 = isSeason1Name(selectedSeason?.name);

  const nameToPlayerId = useMemo(() => {
    return Object.fromEntries(players.map((p) => [p.fullName, p.id]));
  }, [players]);

  const season1PlayersForTable = useMemo(() => {
    if (!isSeason1) return players;
    return season1Players.map((s1) => {
      const existingId = nameToPlayerId[s1.name];
      if (existingId) {
        const existing = players.find((p) => p.id === existingId);
        if (existing) return existing;
      }
      return {
        id: `season1:${s1.name}`,
        fullName: s1.name,
        type: undefined,
      } as Player;
    });
  }, [isSeason1, nameToPlayerId, players]);

  const teamMap = useMemo(() => {
    if (isSeason1) {
      const map: Record<string, string> = {};
      season1Players.forEach((p) => {
        map[p.team] = p.team;
      });
      return map;
    }
    return Object.fromEntries(teams.map((t) => [t.id, t.name]));
  }, [isSeason1, teams]);

  const playerTeamMap = useMemo(() => {
    if (isSeason1) {
      const map: Record<string, string> = {};
      season1Players.forEach((p) => {
        const id = nameToPlayerId[p.name] || `season1:${p.name}`;
        map[id] = p.team;
      });
      return map;
    }
    const map: Record<string, string> = {};
    rosters.forEach((r) => {
      r.playerIds?.forEach((pid) => {
        if (!map[pid]) map[pid] = r.teamId;
      });
    });
    return map;
  }, [isSeason1, nameToPlayerId, rosters]);

  const totals = useMemo(() => {
    if (isSeason1) {
      const map: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
      season1Players.forEach((p) => {
        const id = nameToPlayerId[p.name] || `season1:${p.name}`;
        map[id] = {
          attack: p.attack,
          blocks: p.blocks,
          assists: p.assists,
          service: p.service,
        };
      });
      return map;
    }
    const map: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    playerStats.forEach((stat) => {
      if (!map[stat.playerId]) map[stat.playerId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      map[stat.playerId].attack += stat.attack || 0;
      map[stat.playerId].blocks += stat.blocks || 0;
      map[stat.playerId].assists += stat.assists || 0;
      map[stat.playerId].service += stat.service || 0;
    });
    return map;
  }, [isSeason1, nameToPlayerId, playerStats]);

  const normalizeType = (type?: string) => {
    if (!type) return "";
    if (type === "profesor") return "teacher";
    if (type === "estudiante") return "student";
    return type;
  };

  const filtered = season1PlayersForTable.filter((p) => {
    if (!isSeason1 && !playerTeamMap[p.id]) return false;
    const type = normalizeType(p.type as string);
    if (filter === "student") return type === "student";
    if (filter === "teacher") return type === "teacher";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aStats = totals[a.id] || { attack: 0, blocks: 0, assists: 0, service: 0 };
    const bStats = totals[b.id] || { attack: 0, blocks: 0, assists: 0, service: 0 };
    const valA =
      sortKey === "total"
        ? aStats.attack + aStats.blocks + aStats.assists + aStats.service
        : aStats[sortKey];
    const valB =
      sortKey === "total"
        ? bStats.attack + bStats.blocks + bStats.assists + bStats.service
        : bStats[sortKey];
    return valB - valA;
  });

  const Arrow = ({ field }: { field: typeof sortKey }) => (sortKey === field ? " ↓" : "");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center text-strong">Player Statistics</h2>

      <div className="flex gap-4 justify-center mb-6">
        {(["all", "student", "teacher"] as const).map((f) => (
          <button
            key={f}
            className={`tab px-4 py-2 ${filter === f ? "tab--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "student" ? "Students" : "Teachers"}
          </button>
        ))}
      </div>

      <div className="glass glass--strong tableWrap">
        <div className="tableScroll">
          <table className="table table-auto w-full text-sm text-left">
          <thead>
            <tr>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2">Team</th>
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
                <td className="px-4 py-6 text-center text-muted" colSpan={7}>
                  No players to show.
                </td>
              </tr>
            )}
            {sorted.map((player) => {
              const stats = totals[player.id] || { attack: 0, blocks: 0, assists: 0, service: 0 };
              const total = stats.attack + stats.blocks + stats.assists + stats.service;
              const teamId = playerTeamMap[player.id];
              return (
                <tr key={player.id}>
                  <td className="px-4 py-2">
                    <Link to={`/players/${player.id}`} className="player-name">
                      {player.fullName || (player as any).name || player.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{teamId ? teamMap[teamId] || teamId : "No team"}</td>
                  <td className="px-4 py-2">{stats.attack}</td>
                  <td className="px-4 py-2">{stats.blocks}</td>
                  <td className="px-4 py-2">{stats.assists}</td>
                  <td className="px-4 py-2">{stats.service}</td>
                  <td className="px-4 py-2 font-bold text-strong">{total}</td>
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

export default Players;
