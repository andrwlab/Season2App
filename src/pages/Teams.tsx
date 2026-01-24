import React from 'react';

const Teams = () => {
  const teams = [
    { name: 'Equipo A', players: 9, logo: '🅰️' },
    { name: 'Equipo B', players: 9, logo: '🅱️' },
    { name: 'Equipo C', players: 9, logo: '🅾️' },
    { name: 'Equipo D', players: 9, logo: '🆎' },
  ];

  return (
    <div className="p-6 grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
      {teams.map((team, index) => (
        <div
          key={index}
          className="team-card p-4 flex flex-col items-center"
        >
          <div className="text-5xl mb-2">{team.logo}</div>
          <h2 className="text-xl font-bold mb-1">{team.name}</h2>
          <p className="text-muted">{team.players} jugadores</p>
        </div>
      ))}
    </div>
  );
};

export default Teams;
