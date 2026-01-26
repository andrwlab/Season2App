import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Player, Roster, Team, subscribePlayers, subscribeRosters, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";

const PlayerProfile = () => {
  const { id } = useParams();
  const { selectedSeasonId } = useSeason();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => subscribePlayers(setPlayers), []);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
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
    </div>
  );
};

export default PlayerProfile;
