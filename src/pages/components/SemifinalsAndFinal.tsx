import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const SemifinalsAndFinal = ({ standings }) => {
  const [dates, setDates] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'matchDates'), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => data[doc.id] = doc.data());
      setDates(data);
    });
    return () => unsubscribe();
  }, []);

  if (standings.length < 4) return null;
  const [s1, s2, s3, s4] = standings;

  const renderDate = (id) => {
    const match = dates[id];
    return match ? (
      <div className="text-xs text-white text-center">
        {match.date}<br />{match.time}
      </div>
    ) : null;
  };

  return (
    <div className="mt-10 relative p-6 bg-gradient-to-b from-gray-900 to-black text-white rounded-xl shadow-xl overflow-x-auto">
      <h3 className="text-3xl font-bold text-center mb-12">Fase Eliminatoria</h3>
      <div className="relative w-full max-w-[1000px] mx-auto h-[450px] px-4 sm:px-6 lg:px-8 overflow-x-auto">
        {/* Bracket lines (SVG) */}
        <svg className="absolute top-0 left-0 w-full h-full z-0" viewBox="0 0 1000 450">
          {/* Semifinal Left */}
          <line x1="100" y1="75" x2="200" y2="75" stroke="white" strokeWidth="3" />
          <line x1="100" y1="325" x2="200" y2="325" stroke="white" strokeWidth="3" />
          <line x1="200" y1="75" x2="200" y2="200" stroke="white" strokeWidth="3" />
          <line x1="200" y1="325" x2="200" y2="200" stroke="white" strokeWidth="3" />
          <line x1="200" y1="200" x2="400" y2="200" stroke="white" strokeWidth="3" />
          {/* Semifinal Right */}
          <line x1="900" y1="75" x2="800" y2="75" stroke="white" strokeWidth="3" />
          <line x1="900" y1="325" x2="800" y2="325" stroke="white" strokeWidth="3" />
          <line x1="800" y1="75" x2="800" y2="200" stroke="white" strokeWidth="3" />
          <line x1="800" y1="325" x2="800" y2="200" stroke="white" strokeWidth="3" />
          <line x1="800" y1="200" x2="600" y2="200" stroke="white" strokeWidth="3" />
          {/* Final */}
          <line x1="400" y1="200" x2="460" y2="200" stroke="gold" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="600" y1="200" x2="540" y2="200" stroke="gold" strokeWidth="2" strokeDasharray="4 4" />
        </svg>

        {/* Semifinal Left */}
        <div className="absolute top-[60px] left-[20px] z-10">
          <div className="bg-white text-black px-4 py-2 rounded-full shadow font-semibold">
            {s1.team}
          </div>
          {renderDate('semifinal1')}
        </div>
        <div className="absolute bottom-[60px] left-[20px] z-10">
          <div className="bg-white text-black px-4 py-2 rounded-full shadow font-semibold">
            {s4.team}
          </div>
          {renderDate('semifinal2')}
        </div>

        {/* Semifinal Right */}
        <div className="absolute top-[60px] right-[20px] z-10">
          <div className="bg-white text-black px-4 py-2 rounded-full shadow font-semibold">
            {s2.team}
          </div>
          {renderDate('semifinal1')}
        </div>
        <div className="absolute bottom-[60px] right-[20px] z-10">
          <div className="bg-white text-black px-4 py-2 rounded-full shadow font-semibold">
            {s3.team}
          </div>
          {renderDate('semifinal2')}
        </div>

        {/* Final */}
        <div className="absolute top-[170px] left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-yellow-500 text-black px-6 py-3 rounded-full shadow-xl text-center font-bold border-4 border-white">
            Ganador S1 vs S2
          </div>
          {renderDate('final')}
        </div>

        {/* Trofeo */}
        <div className="absolute top-[100px] left-1/2 transform -translate-x-1/2 z-0 opacity-50">
          🏆
        </div>

        {/* Tercer puesto */}
        <div className="absolute top-[370px] left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-gray-800 text-white px-6 py-2 rounded shadow text-center">
            Perdedor S1 vs Perdedor S2
          </div>
          {renderDate('third')}
        </div>
      </div>
    </div>
  );
};

export default SemifinalsAndFinal;
