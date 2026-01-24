import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const usePlayerStats = () => {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'players'), (snapshot) => {
      const playerList = snapshot.docs.map(doc => doc.data());

      onSnapshot(collection(db, 'matches'), (matchSnap) => {
        const matchData = matchSnap.docs.map(doc => doc.data());

        // Sumar estadísticas por jugador
        const statsMap = {};

        matchData.forEach(match => {
          const stats = match.playersStats || {};
          for (const name in stats) {
            if (!statsMap[name]) {
              statsMap[name] = { attack: 0, blocks: 0, service: 0 };
            }
            statsMap[name].attack += stats[name]?.attack || 0;
            statsMap[name].blocks += stats[name]?.blocks || 0;
            statsMap[name].service += stats[name]?.service || 0;
          }
        });

        // Asociar stats a cada jugador
        const combined = playerList.map(p => ({
          ...p,
          ...statsMap[p.name] || { attack: 0, blocks: 0, service: 0 }
        }));

        setPlayers(combined);
      });
    });

    return () => unsubscribe();
  }, []);

  return players;
};
