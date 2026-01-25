// src/data.ts

export const teams = [
    { name: 'Equipo A', logo: '🅰️', color: 'team-card team-card--a', players: 12 },
    { name: 'Equipo B', logo: '🅱️', color: 'team-card team-card--b', players: 12 },
    { name: 'Equipo C', logo: '🅾️', color: 'team-card team-card--c', players: 12 },
    { name: 'Equipo D', logo: '🆎', color: 'team-card team-card--d', players: 12 },
  ];
  
  export const players = [
    { name: 'Carlos López', team: 'Equipo A', attack: 12, blocks: 5, service: 8 },
    { name: 'María Pérez', team: 'Equipo B', attack: 9, blocks: 3, service: 10 },
    { name: 'Lucía García', team: 'Equipo C', attack: 15, blocks: 2, service: 6 },
    { name: 'Andrés Ruiz', team: 'Equipo D', attack: 8, blocks: 6, service: 7 },
  ];
  
  export const schedule = [
    { date: '2025-05-02T15:30:00', match: 'Equipo A vs Equipo B', format: '1 set de 25 pts' },
    { date: '2025-05-02T16:00:00', match: 'Equipo C vs Equipo D', format: '1 set de 25 pts' },
    { date: '2025-05-09T15:30:00', match: 'Equipo A vs Equipo C', format: '1 set de 25 pts' },
    { date: '2025-05-09T16:00:00', match: 'Equipo B vs Equipo D', format: '1 set de 25 pts' },
    { date: '2025-05-16T15:30:00', match: 'Equipo A vs Equipo D', format: '1 set de 25 pts' },
    { date: '2025-05-16T16:00:00', match: 'Equipo B vs Equipo C', format: '1 set de 25 pts' },
    { date: '2025-05-23T15:30:00', match: 'Semifinal 1', format: '3 sets de 15 pts' },
    { date: '2025-05-23T16:00:00', match: 'Semifinal 2', format: '3 sets de 15 pts' },
    { date: '2025-05-30T15:30:00', match: 'Tercer Puesto', format: '3 sets de 10 pts' },
    { date: '2025-05-30T16:00:00', match: 'Final', format: '3 sets de 15 pts' },
  ];
  
