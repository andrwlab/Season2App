import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useSeason } from "../../hooks/useSeason";

const SemifinalsAndFinal = ({ standings }) => {
  const { selectedSeasonId } = useSeason();
  const [dates, setDates] = useState({});

  useEffect(() => {
    if (!selectedSeasonId) return;
    const q = query(
      collection(db, "matchDates"),
      where("seasonId", "==", selectedSeasonId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = {};
      snapshot.forEach((doc) => (data[doc.id] = doc.data()));
      setDates(data);
    });
    return () => unsubscribe();
  }, [selectedSeasonId]);

  if (standings.length < 4) return null;
  const [s1, s2, s3, s4] = standings;

  const renderDate = (id) => {
    const match = dates[id];
    return match ? (
      <div className="text-xs text-muted text-center">
        {match.date}<br />{match.time}
      </div>
    ) : null;
  };

  return (
    <div className="mt-10 relative p-6 bg-surface-3 text-strong rounded-xl shadow-strong overflow-x-auto">
      <h3 className="text-3xl font-bold text-center mb-12">Knockout Stage</h3>
      <div className="relative w-full max-w-[1000px] mx-auto h-[450px] px-4 sm:px-6 lg:px-8 overflow-x-auto">
        {/* Bracket lines (SVG) */}
        <svg className="absolute top-0 left-0 w-full h-full z-0" viewBox="0 0 1000 450">
          {/* Semifinal Left */}
          <line x1="100" y1="75" x2="200" y2="75" stroke="var(--text)" strokeWidth="3" />
          <line x1="100" y1="325" x2="200" y2="325" stroke="var(--text)" strokeWidth="3" />
          <line x1="200" y1="75" x2="200" y2="200" stroke="var(--text)" strokeWidth="3" />
          <line x1="200" y1="325" x2="200" y2="200" stroke="var(--text)" strokeWidth="3" />
          <line x1="200" y1="200" x2="400" y2="200" stroke="var(--text)" strokeWidth="3" />
          {/* Semifinal Right */}
          <line x1="900" y1="75" x2="800" y2="75" stroke="var(--text)" strokeWidth="3" />
          <line x1="900" y1="325" x2="800" y2="325" stroke="var(--text)" strokeWidth="3" />
          <line x1="800" y1="75" x2="800" y2="200" stroke="var(--text)" strokeWidth="3" />
          <line x1="800" y1="325" x2="800" y2="200" stroke="var(--text)" strokeWidth="3" />
          <line x1="800" y1="200" x2="600" y2="200" stroke="var(--text)" strokeWidth="3" />
          {/* Final */}
          <line x1="400" y1="200" x2="460" y2="200" stroke="var(--brand-2)" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="600" y1="200" x2="540" y2="200" stroke="var(--brand-2)" strokeWidth="2" strokeDasharray="4 4" />
        </svg>

        {/* Semifinal Left */}
        <div className="absolute top-[60px] left-[20px] z-10">
          <div className="card glass glass--hover px-4 py-2 rounded-full shadow-soft font-semibold text-strong">
            {s1.team}
          </div>
          {renderDate('semifinal1')}
        </div>
        <div className="absolute bottom-[60px] left-[20px] z-10">
          <div className="card glass glass--hover px-4 py-2 rounded-full shadow-soft font-semibold text-strong">
            {s4.team}
          </div>
          {renderDate('semifinal2')}
        </div>

        {/* Semifinal Right */}
        <div className="absolute top-[60px] right-[20px] z-10">
          <div className="card glass glass--hover px-4 py-2 rounded-full shadow-soft font-semibold text-strong">
            {s2.team}
          </div>
          {renderDate('semifinal1')}
        </div>
        <div className="absolute bottom-[60px] right-[20px] z-10">
          <div className="card glass glass--hover px-4 py-2 rounded-full shadow-soft font-semibold text-strong">
            {s3.team}
          </div>
          {renderDate('semifinal2')}
        </div>

        {/* Final */}
        <div className="absolute top-[170px] left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-brand text-strong px-6 py-3 rounded-full shadow-strong text-center font-bold border border-2">
            Winner S1 vs S2
          </div>
          {renderDate('final')}
        </div>

        {/* Trofeo */}
        <div className="absolute top-[100px] left-1/2 transform -translate-x-1/2 z-0 opacity-50">
          🏆
        </div>

        {/* Tercer puesto */}
        <div className="absolute top-[370px] left-1/2 transform -translate-x-1/2 z-20">
          <div className="card glass glass--strong text-strong px-6 py-2 rounded shadow-soft text-center">
            Loser S1 vs Loser S2
          </div>
          {renderDate('third')}
        </div>
      </div>
    </div>
  );
};

export default SemifinalsAndFinal;
