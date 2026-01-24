import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Season, subscribeSeasons } from "../firebase/queries";

type SeasonContextValue = {
  seasons: Season[];
  selectedSeasonId: string | null;
  selectedSeason: Season | null;
  setSelectedSeasonId: (id: string) => void;
  isLoading: boolean;
};

const SeasonContext = createContext<SeasonContextValue | null>(null);
const STORAGE_KEY = "seasonId";

export const SeasonProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<string | null>(
    null
  );

  useEffect(() => {
    return subscribeSeasons(setSeasons);
  }, []);

  useEffect(() => {
    if (!seasons.length) return;
    const active = seasons.find((s) => s.isActive) || seasons[0];
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedValid = seasons.find((s) => s.id === stored);
    const next = storedValid?.id || active.id;
    setSelectedSeasonIdState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, [seasons]);

  const setSelectedSeasonId = (id: string) => {
    setSelectedSeasonIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === selectedSeasonId) || null,
    [seasons, selectedSeasonId]
  );

  return (
    <SeasonContext.Provider
      value={{
        seasons,
        selectedSeasonId,
        selectedSeason,
        setSelectedSeasonId,
        isLoading: seasons.length === 0,
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    throw new Error("useSeason must be used within SeasonProvider");
  }
  return ctx;
};
