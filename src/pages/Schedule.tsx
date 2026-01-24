import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import useUserRole from '../hooks/useUserRole';


const Schedule = () => {
  const [matches, setMatches] = useState([]);
  const role = useUserRole();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
      const matchData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      setMatches(matchData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">Calendario de Partidos</h2>
      <ul className="space-y-4">
        {matches.map((item) => {
          const dateObj = new Date(item.date);
          const date = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
          const time = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const isPlayed = item.scoreA != null && item.scoreB != null;

          return (
            <li
              key={item.id}
              className="list-card p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                {/* Fecha */}
                <span className="text-sm text-muted sm:w-1/4">{date}</span>

                {/* Partido + resultado */}
                <div className="sm:w-2/4 text-center">
                <Link to={`/matches/${item.id}`}>
                    <div className="font-semibold hover:underline">
                    {item.teamA} vs {item.teamB}
                    {isPlayed && (
                        <span className="link-primary ml-2">
                        ({item.scoreA} - {item.scoreB})
                        </span>
                    )}
                    </div>
                </Link>
                <div className="text-xs text-muted mt-1">{item.format}</div>
                </div>

                {/* Hora + botón */}
                <div className="sm:w-1/4 text-right mt-2 sm:mt-0 flex justify-end gap-3">
                <span className="text-sm text-muted">{time}</span>
                {(!isPlayed && (role === 'admin' || role === 'scorekeeper')) && (
                    <Link
                    to={`/admin-match/${item.id}`}
                    className="link-primary text-xs underline"
                    >
                    Editar
                    </Link>
                )}
                </div>

              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Schedule;
