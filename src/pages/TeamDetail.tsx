import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Player, Roster, Team, subscribePlayers, subscribeRosters, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import TeamLogo from "../components/TeamLogo";

const TeamDetail = () => {
  const { id } = useParams();
  const { selectedSeasonId } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribePlayers(setPlayers), []);

  const team = teams.find((t) => t.id === id);
  const roster = rosters.find((r) => r.teamId === id);

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const rosterPlayers = roster?.playerIds?.map((pid) => playerMap[pid]).filter(Boolean) || [];

  if (!team) {
    return (
      <div className="p-6 text-center text-muted">
        Equipo no encontrado.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <TeamLogo logoFile={team.logoFile} name={team.name} className="h-16 w-16" />
        <div>
          <h2 className="text-2xl font-bold">{team.name}</h2>
          <p className="text-sm text-muted">Temporada actual</p>
        </div>
      </div>

      <section className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Roster</h3>
        {rosterPlayers.length === 0 ? (
          <p className="text-sm text-muted">No hay jugadores asignados todavía.</p>
        ) : (
          <ul className="list-divider">
            {rosterPlayers.map((player) => (
              <li key={player.id} className="py-2 flex items-center justify-between">
                <span>{player.fullName || (player as any).name || player.id}</span>
                <Link to={`/players/${player.id}`} className="link-brand text-sm underline">
                  Ver perfil
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default TeamDetail;
