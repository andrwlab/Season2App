// src/pages/AdminMatch.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { usePlayers } from '../hooks/usePlayers';
import useUserRole from '../hooks/useUserRole';

const AdminMatch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [formData, setFormData] = useState({});
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [error, setError] = useState('');
  const role = useUserRole();
  const players = usePlayers();

  useEffect(() => {
    const fetchMatch = async () => {
      if (!id) return;
      const ref = doc(db, 'matches', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setMatch(data);
        setScoreA(data.scoreA ?? '');
        setScoreB(data.scoreB ?? '');
        setFormData(data.playersStats || {});
      }
    };
    fetchMatch();
  }, [id]);

  const handleStatChange = (playerName, stat, value) => {
    setFormData((prev) => ({
      ...prev,
      [playerName]: {
        ...prev[playerName],
        [stat]: parseInt(value) || 0,
      },
    }));
  };

  const validateForm = () => {
    const scoreAVal = parseInt(scoreA);
    const scoreBVal = parseInt(scoreB);

    if (isNaN(scoreAVal) || isNaN(scoreBVal)) {
      return 'Debes ingresar un marcador válido para ambos equipos.';
    }

    if (!Object.keys(formData).some((name) =>
      formData[name]?.attack || formData[name]?.blocks || formData[name]?.service
    )) {
      return 'Debes ingresar al menos una estadística para algún jugador.';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await updateDoc(doc(db, 'matches', id), {
        scoreA: parseInt(scoreA),
        scoreB: parseInt(scoreB),
        playersStats: formData,
      });
      navigate(`/matches/${id}`);
    } catch (err) {
      setError('Ocurrió un error al guardar. Intenta nuevamente.');
    }
  };

  if (!match || role !== 'admin') return <p className="text-center mt-10">Cargando o sin permiso...</p>;

  const uniquePlayers = players.reduce((acc, player) => {
    if (!acc.find((p) => p.name === player.name)) acc.push(player);
    return acc;
  }, []);

  const teamAPlayers = uniquePlayers.filter((p) => p.team === match.teamA);
  const teamBPlayers = uniquePlayers.filter((p) => p.team === match.teamB);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center text-primary mb-4">Registrar Resultado</h2>
      <div className="bg-white p-4 shadow rounded">
        <p className="text-center font-medium mb-2">{match.teamA} vs {match.teamB}</p>

        {error && <p className="text-red-600 text-center mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-4 justify-center mb-6">
            <input
              type="number"
              className="border px-3 py-2 rounded w-24 text-center"
              placeholder={match.teamA}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              required
            />
            <span className="text-xl font-bold">-</span>
            <input
              type="number"
              className="border px-3 py-2 rounded w-24 text-center"
              placeholder={match.teamB}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[{ team: match.teamA, players: teamAPlayers }, { team: match.teamB, players: teamBPlayers }].map(({ team, players }) => (
              <div key={team}>
                <h3 className="text-lg font-semibold mb-2">{team}</h3>
                {players.map((player) => (
                  <div key={player.name} className="mb-2">
                    <p className="font-medium">{player.name}</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="🏐"
                        className="border px-2 py-1 w-1/3"
                        value={formData[player.name]?.attack || ''}
                        onChange={(e) => handleStatChange(player.name, 'attack', e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🛡️"
                        className="border px-2 py-1 w-1/3"
                        value={formData[player.name]?.blocks || ''}
                        onChange={(e) => handleStatChange(player.name, 'blocks', e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🎯"
                        className="border px-2 py-1 w-1/3"
                        value={formData[player.name]?.service || ''}
                        onChange={(e) => handleStatChange(player.name, 'service', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button type="submit" className="mt-6 bg-primary text-white px-6 py-2 rounded hover:bg-blue-700">
            Guardar Resultado
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminMatch;
