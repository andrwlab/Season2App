// src/hooks/usePlayers.ts
import { useEffect, useState } from 'react';
import { subscribePlayers } from '../firebase/queries';

export const usePlayers = () => {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    return subscribePlayers((data) => {
      setPlayers(data);
    });
  }, []);

  return players;
};
