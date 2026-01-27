import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import TeamLogo from "../components/TeamLogo";

const TeamDetail = () => {
  const { id } = useParams();
  const { selectedSeasonId } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribePlayers(setPlayers), []);
  useEffect(() => subscribePlayerStats(selectedSeasonId, setPlayerStats), [selectedSeasonId]);

  const team = teams.find((t) => t.id === id);
  const roster = rosters.find((r) => r.teamId === id);

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const rosterPlayers = roster?.playerIds?.map((pid) => playerMap[pid]).filter(Boolean) || [];
  const rosterPlayerIds = roster?.playerIds || [];
  const rosterIdSet = useMemo(() => new Set(rosterPlayerIds), [rosterPlayerIds]);

  const totalsByPlayer = useMemo(() => {
    const map: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    rosterPlayerIds.forEach((pid) => {
      map[pid] = { attack: 0, blocks: 0, assists: 0, service: 0 };
    });
    playerStats.forEach((stat) => {
      if (!rosterIdSet.has(stat.playerId)) return;
      if (!map[stat.playerId]) {
        map[stat.playerId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      }
      map[stat.playerId].attack += stat.attack || 0;
      map[stat.playerId].blocks += stat.blocks || 0;
      map[stat.playerId].assists += stat.assists || 0;
      map[stat.playerId].service += stat.service || 0;
    });
    return map;
  }, [playerStats, rosterIdSet, rosterPlayerIds]);

  const hasAnyStats = useMemo(() => {
    return playerStats.some(
      (stat) =>
        rosterIdSet.has(stat.playerId) &&
        (stat.attack || stat.blocks || stat.assists || stat.service)
    );
  }, [playerStats, rosterIdSet]);

  const getLeader = (key: "attack" | "blocks" | "assists" | "service") => {
    let leaderId: string | null = null;
    let leaderValue = -1;
    rosterPlayerIds.forEach((pid) => {
      const value = totalsByPlayer[pid]?.[key] ?? 0;
      if (value > leaderValue) {
        leaderValue = value;
        leaderId = pid;
      }
    });
    return { playerId: leaderId, value: leaderValue };
  };

  const leaderCards = [
    { key: "attack" as const, label: "Attacks", icon: "🏐" },
    { key: "blocks" as const, label: "Blocks", icon: "🛡️" },
    { key: "assists" as const, label: "Assists", icon: "🤝" },
    { key: "service" as const, label: "Serves", icon: "🎯" },
  ].map((item) => {
    const leader = getLeader(item.key);
    const player = leader.playerId ? playerMap[leader.playerId] : null;
    const playerName = player?.fullName || (player as any)?.name || leader.playerId || "—";
    return { ...item, leaderValue: leader.value, playerName };
  });

  if (!team) {
    return (
      <div className="p-6 text-center text-muted">
        Team not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <TeamLogo logoFile={team.logoFile} name={team.name} className="h-16 w-16" />
        <div>
          <h2 className="text-2xl font-bold">{team.name}</h2>
          <p className="text-sm text-muted">Current season</p>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        <div className="card glass glass--hover p-4">
          <h3 className="text-lg font-semibold mb-3">Roster</h3>
          {rosterPlayers.length === 0 ? (
            <p className="text-sm text-muted">No players assigned yet.</p>
          ) : (
            <ul className="list-divider">
              {rosterPlayers.map((player) => (
                <li key={player.id} className="py-2 flex items-center justify-between">
                  <span>{player.fullName || (player as any).name || player.id}</span>
                  <Link to={`/players/${player.id}`} className="link-brand text-sm underline">
                    View profile
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Team Leaders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {leaderCards.map((card) => (
              <div key={card.key} className="card p-4 flex items-center gap-3">
                <div className="text-2xl">{card.icon}</div>
                <div className="min-w-0">
                  <div className="stat-title">{card.label}</div>
                  {hasAnyStats ? (
                    <>
                      <div className="stat-value text-lg">{card.leaderValue}</div>
                      <div className="stat-muted text-xs truncate">{card.playerName}</div>
                    </>
                  ) : (
                    <div className="stat-muted text-sm">No data</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default TeamDetail;
