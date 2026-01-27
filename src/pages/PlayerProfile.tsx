import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Player,
  PlayerStat,
  Roster,
  Team,
  subscribeAllPlayerStats,
  subscribePlayers,
  subscribePlayerStats,
  subscribeRosters,
  subscribeTeams,
} from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import { season1PlayerByName } from "../data";

const PlayerProfile = () => {
  const { id } = useParams();
  const { selectedSeasonId } = useSeason();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasonStats, setSeasonStats] = useState<PlayerStat[]>([]);
  const [allStats, setAllStats] = useState<PlayerStat[]>([]);

  useEffect(() => subscribePlayers(setPlayers), []);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribePlayerStats(selectedSeasonId, setSeasonStats), [selectedSeasonId]);
  useEffect(() => subscribeAllPlayerStats(setAllStats), []);

  const player = players.find((p) => p.id === id);
  const playerTeamId = useMemo(() => {
    for (const roster of rosters) {
      if (roster.playerIds?.includes(id || "")) return roster.teamId;
    }
    return null;
  }, [rosters, id]);
  const team = teams.find((t) => t.id === playerTeamId);

  if (!player) {
    return (
      <div className="p-6 text-center text-muted">
        Player not found.
      </div>
    );
  }

  const displayName = player.fullName || (player as any).name || player.id;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const typeLabel =
    player.type === "teacher"
      ? "Teacher"
      : player.type === "student"
      ? "Student"
      : player.type === "profesor"
      ? "Teacher"
      : player.type === "estudiante"
      ? "Student"
      : "—";

  const seasonTotals = useMemo(() => {
    const totals = { attack: 0, blocks: 0, assists: 0, service: 0 };
    if (!id) return totals;
    seasonStats.forEach((stat) => {
      if (stat.playerId !== id) return;
      totals.attack += stat.attack || 0;
      totals.blocks += stat.blocks || 0;
      totals.assists += stat.assists || 0;
      totals.service += stat.service || 0;
    });
    return totals;
  }, [id, seasonStats]);

  const cumulativeTotals = useMemo(() => {
    const totals = { attack: 0, blocks: 0, assists: 0, service: 0 };
    if (!id) return totals;
    allStats.forEach((stat) => {
      if (stat.playerId !== id) return;
      totals.attack += stat.attack || 0;
      totals.blocks += stat.blocks || 0;
      totals.assists += stat.assists || 0;
      totals.service += stat.service || 0;
    });
    const season1 = season1PlayerByName[displayName];
    if (season1) {
      totals.attack += season1.attack || 0;
      totals.blocks += season1.blocks || 0;
      totals.assists += season1.assists || 0;
      totals.service += season1.service || 0;
    }
    return totals;
  }, [allStats, displayName, id]);

  const hasSeasonData = useMemo(() => {
    if (!id) return false;
    return seasonStats.some(
      (stat) =>
        stat.playerId === id &&
        (stat.attack || stat.blocks || stat.assists || stat.service)
    );
  }, [id, seasonStats]);

  const hasCumulativeData = useMemo(() => {
    const season1 = season1PlayerByName[displayName];
    if (season1 && (season1.attack || season1.blocks || season1.assists || season1.service)) {
      return true;
    }
    if (!id) return false;
    return allStats.some(
      (stat) =>
        stat.playerId === id &&
        (stat.attack || stat.blocks || stat.assists || stat.service)
    );
  }, [allStats, displayName, id]);

  const StatCard = ({
    icon,
    label,
    value,
    muted,
  }: {
    icon: string;
    label: string;
    value: string | number;
    muted?: string;
  }) => (
    <div className="card p-4 flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div className="min-w-0">
        <div className="stat-title">{label}</div>
        <div className="stat-value text-lg">{value}</div>
        {muted && <div className="stat-muted text-xs">{muted}</div>}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={displayName}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="avatar-fallback h-20 w-20 rounded-full flex items-center justify-center text-2xl">
            {initials}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{displayName}</h2>
          <p className="text-sm text-muted">{typeLabel}</p>
          <p className="text-sm text-muted">
            {team ? `Team: ${team.name}` : "No team assigned"}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Current Season Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="🏐" label="Attacks" value={hasSeasonData ? seasonTotals.attack : "No data"} />
          <StatCard icon="🛡️" label="Blocks" value={hasSeasonData ? seasonTotals.blocks : "No data"} />
          <StatCard icon="🤝" label="Assists" value={hasSeasonData ? seasonTotals.assists : "No data"} />
          <StatCard icon="🎯" label="Serves" value={hasSeasonData ? seasonTotals.service : "No data"} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Cumulative Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="🏐" label="Attacks" value={hasCumulativeData ? cumulativeTotals.attack : "No data"} />
          <StatCard icon="🛡️" label="Blocks" value={hasCumulativeData ? cumulativeTotals.blocks : "No data"} />
          <StatCard icon="🤝" label="Assists" value={hasCumulativeData ? cumulativeTotals.assists : "No data"} />
          <StatCard icon="🎯" label="Serves" value={hasCumulativeData ? cumulativeTotals.service : "No data"} />
        </div>
      </section>
    </div>
  );
};

export default PlayerProfile;
