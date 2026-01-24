// src/pages/Leaderboard.tsx
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

interface Match {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  date: string;
  format: string;
  phase: 'group' | 'semifinal' | 'third' | 'final';
}

interface Standing {
  team: string;
  w: number;
  l: number;
  pf: number;  // puntos a favor
  pc: number;  // puntos en contra
}

const Leaderboard = () => {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'matches'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMatches(data);
    });
    return () => unsub();
  }, []);

  // 1) Filtrar solo fase de grupos
  const groupMatches = matches.filter(m => m.phase === 'group');

  // 2) Calcular standings usando solo esos partidos
  const standingsMap: Record<string, Standing> = {};
  groupMatches.forEach(({ teamA, teamB, scoreA, scoreB }) => {
    if (!standingsMap[teamA]) standingsMap[teamA] = { team: teamA, w: 0, l: 0, pf: 0, pc: 0 };
    if (!standingsMap[teamB]) standingsMap[teamB] = { team: teamB, w: 0, l: 0, pf: 0, pc: 0 };

    // Acumular puntos a favor/en contra
    standingsMap[teamA].pf += scoreA;
    standingsMap[teamA].pc += scoreB;
    standingsMap[teamB].pf += scoreB;
    standingsMap[teamB].pc += scoreA;

    // Asignar victoria/derrota
    if (scoreA > scoreB) {
      standingsMap[teamA].w++;
      standingsMap[teamB].l++;          // <–– aquí incrementas derrotas a B
    }
    else if (scoreB > scoreA) {
      standingsMap[teamB].w++;
      standingsMap[teamA].l++;          // <–– y aquí derrotas a A
    }
  });

  // 3) Pasar a array y ordenar: G desc, diff desc, PF desc
  const standings = Object.values(standingsMap).sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    const diffA = a.pf - a.pc;
    const diffB = b.pf - b.pc;
    if (diffB !== diffA) return diffB - diffA;
    return b.pf - a.pf;
  });

  // 4) Fase eliminatoria
  const semiFinals = matches
    .filter(m => m.phase === 'semifinal')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const thirdPlace = matches
    .filter(m => m.phase === 'third')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const finalMatch = matches
    .filter(m => m.phase === 'final')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">

      {/* Tabla de Posiciones */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Tabla de Posiciones</h2>
        <div className="table-wrap overflow-x-auto">
          <table className="table-base table-auto text-sm text-left">
          <thead>
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Equipo</th>
              <th className="px-3 py-2">G</th>
              <th className="px-3 py-2">P</th>
              <th className="px-3 py-2">PF</th>
              <th className="px-3 py-2">PC</th>
              <th className="px-3 py-2">+/-</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.team}>
                <td className="px-3 py-2">
                  {i === 0 ? <span className="badge">#{i + 1}</span> : i + 1}
                </td>
                <td className="px-3 py-2">{s.team}</td>
                <td className="px-3 py-2">{s.w}</td>
                <td className="px-3 py-2">{s.l}</td>
                <td className="px-3 py-2">{s.pf}</td>
                <td className="px-3 py-2">{s.pc}</td>
                <td className="px-3 py-2">{s.pf - s.pc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {/* Fase Eliminatoria */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Fase Eliminatoria</h2>

        <div className="space-y-6">

          {/* Semifinales */}
          <div>
            <h3 className="font-semibold mb-2">Semifinales</h3>
            <ul className="space-y-2">
              {semiFinals.map(m => {
                const d = new Date(m.date);
                return (
                  <li key={m.id} className="list-card p-3 flex justify-between">
                    <span>{m.teamA} vs {m.teamB}</span>
                    <span className="text-sm text-muted">
                      {d.toLocaleDateString('es-ES',{day:'numeric',month:'long'})} •{' '}
                      {d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Tercer Puesto */}
          <div>
            <h3 className="font-semibold mb-2">Tercer Puesto</h3>
            {thirdPlace.map(m => {
              const d = new Date(m.date);
              return (
                <div key={m.id} className="list-card p-3 flex justify-between">
                  <span>Perdedor SF1 vs Perdedor SF2</span>
                  <span className="text-sm text-muted">
                    {d.toLocaleDateString('es-ES',{day:'numeric',month:'long'})} •{' '}
                    {d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Final */}
          <div>
            <h3 className="font-semibold mb-2">Final</h3>
            {finalMatch.map(m => {
              const d = new Date(m.date);
              return (
                <div key={m.id} className="list-card p-3 flex justify-between">
                  <span>Ganador SF1 vs Ganador SF2</span>
                  <span className="text-sm text-muted">
                    {d.toLocaleDateString('es-ES',{day:'numeric',month:'long'})} •{' '}
                    {d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Enlace al calendario */}
      <div className="text-center">
        <Link to="/schedule" className="link-primary underline">
          Ver calendario completo
        </Link>
      </div>
    </div>
  );
};

export default Leaderboard;
