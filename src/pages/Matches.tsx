import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';

const Matches = () => {
  const { user, role } = useAuth();
  const [games, setGames] = useState([]);
  const [formData, setFormData] = useState({
    teamA: '',
    teamB: '',
    scoreA: '',
    scoreB: '',
    date: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
      const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(matchesData);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newMatch = {
      teamA: formData.teamA,
      teamB: formData.teamB,
      scoreA: parseInt(formData.scoreA),
      scoreB: parseInt(formData.scoreB),
      date: formData.date
    };

    try {
      await addDoc(collection(db, 'matches'), newMatch);
      setFormData({ teamA: '', teamB: '', scoreA: '', scoreB: '', date: '' });
    } catch (error) {
      console.error("Error al guardar el partido:", error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Partidos</h2>

      {user && role === 'admin' && (
        <>
          <h3 className="text-xl font-semibold mb-2">Registrar nuevo partido</h3>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mb-6">
            <div className="flex gap-4">
              <input type="text" name="teamA" value={formData.teamA} onChange={handleChange} placeholder="Equipo A" className="w-1/2 border px-3 py-2 rounded" required />
              <input type="text" name="teamB" value={formData.teamB} onChange={handleChange} placeholder="Equipo B" className="w-1/2 border px-3 py-2 rounded" required />
            </div>
            <div className="flex gap-4">
              <input type="number" name="scoreA" value={formData.scoreA} onChange={handleChange} placeholder="Puntos A" className="w-1/2 border px-3 py-2 rounded" required />
              <input type="number" name="scoreB" value={formData.scoreB} onChange={handleChange} placeholder="Puntos B" className="w-1/2 border px-3 py-2 rounded" required />
            </div>
            <input type="text" name="date" value={formData.date} onChange={handleChange} placeholder="Fecha (ej. 2 de mayo)" className="w-full border px-3 py-2 rounded" required />
            <button type="submit" className="bg-primary text-white px-4 py-2 rounded">Guardar</button>
          </form>
        </>
      )}

      <h3 className="text-xl font-semibold mb-2">Partidos registrados</h3>
      <ul className="space-y-2">
        {games.map((match) => (
            <li key={match.id} className="border px-4 py-2 rounded shadow-sm flex justify-between items-center">
            <span>
                <strong>{match.date}</strong>: {match.teamA} {match.scoreA} - {match.scoreB} {match.teamB}
            </span>
            {(role === 'admin' || role === 'scorekeeper') && (
                <a
                href={`/admin-match/${match.id}`}
                className="text-sm text-blue-600 hover:underline ml-4"
                >
                Editar
                </a>
            )}
            </li>
        ))}
</ul>

    </div>
  );
};

export default Matches;
