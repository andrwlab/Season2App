// src/pages/MatchDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserRole from '../hooks/useUserRole';

interface PlayerStats {
  attack: number;
  blocks: number;
  service: number;
}

interface Match {
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  date: string;
  format: string;
  playersStats: { [playerName: string]: PlayerStats };
}

const MatchDetail = () => {
  const { id } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const role = useUserRole();

  useEffect(() => {
    const fetchMatch = async () => {
      if (!id) return;
      const ref = doc(db, 'matches', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setMatch(data as Match);
      }
    };

    fetchMatch();
  }, [id]);

  if (!match) return <p className="text-center mt-10 text-muted">Cargando partido...</p>;

  const date = new Date(match.date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-4">Detalles del Partido</h2>
      <div className="card p-4">
        <div className="text-center font-semibold text-lg mb-1">
          {match.teamA} vs {match.teamB}
        </div>
        <div className="text-center text-muted text-sm mb-4">{date} • {match.format}</div>

        {match.scoreA != null && match.scoreB != null ? (
          <div className="text-center text-xl font-bold text-success mb-4">
            Resultado: {match.scoreA} - {match.scoreB}
          </div>
        ) : (
          <div className="text-center text-sm text-muted italic mb-4">Aún sin resultado</div>
        )}

        {role === 'admin' || role === 'scorekeeper' ? (
          <div className="text-center mb-4">
            <Link to={`/admin-match/${id}`}>
              <button className="btn-primary px-4 py-2">
                Editar Partido
              </button>
            </Link>
          </div>
        ) : null}

        <h3 className="text-md font-bold mb-2">Estadísticas por jugador:</h3>
        {match.playersStats && Object.keys(match.playersStats).length > 0 ? (
          <div className="table-wrap overflow-x-auto">
            <table className="table-base table-auto text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">Jugador</th>
                <th className="px-4 py-2">Ataques</th>
                <th className="px-4 py-2">Bloqueos</th>
                <th className="px-4 py-2">Servicios</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(match.playersStats).map(([name, stats]) => (
                <tr key={name}>
                  <td className="px-4 py-2">{name}</td>
                  <td className="px-4 py-2">{stats?.attack ?? 0}</td>
                  <td className="px-4 py-2">{stats?.blocks ?? 0}</td>
                  <td className="px-4 py-2">{stats?.service ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-muted text-sm">No hay estadísticas registradas.</p>
        )}
      </div>
    </div>
  );
};

export default MatchDetail;
