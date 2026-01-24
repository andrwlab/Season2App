import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface PlayerStat {
  name: string;
  attack: number;
  blocks: number;
  service: number;
  type?: string; // estudiante o profesor
  team?: string;
}

export function useAggregatedPlayerStats(): PlayerStat[] {
  const [stats, setStats] = useState<PlayerStat[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matches'), async (snapshot) => {
      const aggregated: Record<string, PlayerStat> = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const playerStats = data.playersStats || {};

        Object.entries(playerStats).forEach(([name, stat]: any) => {
          if (!aggregated[name]) {
            aggregated[name] = {
              name,
              attack: 0,
              blocks: 0,
              service: 0,
            };
          }

          aggregated[name].attack += stat.attack || 0;
          aggregated[name].blocks += stat.blocks || 0;
          aggregated[name].service += stat.service || 0;
        });
      });

      // Para agregar team y type, puedes hacer una consulta a `players`
      const playersSnapshot = await onSnapshot(collection(db, 'players'), (playerSnap) => {
        const players = playerSnap.docs.map(doc => doc.data());
        const enrichedStats = Object.values(aggregated).map(stat => {
          const playerInfo = players.find(p => p.name === stat.name);
          return {
            ...stat,
            type: playerInfo?.type || '',
            team: playerInfo?.team || ''
          };
        });
        setStats(enrichedStats);
      });
    });

    return () => unsubscribe();
  }, []);

  return stats;
}
