import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Team, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import TeamLogo from "../components/TeamLogo";

const Teams = () => {
  const { selectedSeasonId } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

  return (
    <div className="p-6 grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
      {teams.length === 0 && (
        <p className="text-sm text-muted col-span-full">No teams for this season.</p>
      )}
      {teams.map((team) => (
        <Link key={team.id} to={`/teams/${team.id}`}>
          <div className="team-card p-4 flex flex-col items-center">
            <TeamLogo logoFile={team.logoFile} name={team.name} className="h-16 w-16 mb-2" />
            <h2 className="text-xl font-bold mb-1">{team.name}</h2>
            <p className="text-sm text-muted">View roster</p>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default Teams;
