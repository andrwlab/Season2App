import { useEffect, useState } from "react";
import { subscribePlayerStats } from "../firebase/queries";

export const usePlayerStats = (seasonId?: string | null) => {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    return subscribePlayerStats(seasonId, (data) => setStats(data));
  }, [seasonId]);

  return stats;
};
