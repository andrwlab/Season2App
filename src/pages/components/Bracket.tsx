// src/components/Bracket.tsx
import React from 'react';

interface MatchInfo {
  teamA: string;
  teamB: string;
  date: string;   // ISO string
  format?: string;
}

interface BracketProps {
  semi1: MatchInfo;
  semi2: MatchInfo;
  third: MatchInfo;
  final: MatchInfo;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${date} • ${time}`;
};

const Bracket: React.FC<BracketProps> = ({ semi1, semi2, third, final }) => (
  <div className="grid grid-cols-3 gap-x-4 items-center my-8">
    {/* Semifinales */}
    <div className="flex flex-col gap-6">
      <div className="card p-3 text-center">
        <div className="font-semibold">{semi1.teamA}</div>
        <div className="text-xs text-muted">{formatDate(semi1.date)}</div>
      </div>
      <div className="card p-3 text-center">
        <div className="font-semibold">{semi1.teamB}</div>
        <div className="text-xs text-muted">{formatDate(semi1.date)}</div>
      </div>
    </div>

    {/* Conector izquierdo → final */}
    <div className="relative h-full">
      <div className="absolute w-1 bg-divider top-1/4 bottom-1/4 left-0"></div>
      <div className="absolute w-1 bg-divider top-1/4 left-0 right-1/2"></div>
    </div>

    {/* Final */}
    <div className="card bg-brand p-4 text-center text-strong">
      <div className="font-semibold">{final.teamA} vs {final.teamB}</div>
      <div className="text-xs">{formatDate(final.date)}</div>
    </div>

    {/* Conector derecho ← final */}
    <div className="relative h-full">
      <div className="absolute w-1 bg-divider top-1/4 bottom-1/4 right-0"></div>
      <div className="absolute w-1 bg-divider top-1/4 right-0 left-1/2"></div>
    </div>

    {/* Semifinales 2 */}
    <div className="flex flex-col gap-6">
      <div className="card p-3 text-center">
        <div className="font-semibold">{semi2.teamA}</div>
        <div className="text-xs text-muted">{formatDate(semi2.date)}</div>
      </div>
      <div className="card p-3 text-center">
        <div className="font-semibold">{semi2.teamB}</div>
        <div className="text-xs text-muted">{formatDate(semi2.date)}</div>
      </div>
    </div>

    {/* Tercer Puesto abajo */}
    <div className="col-span-3 mt-8">
    <h4 className="text-center font-semibold mb-2">Third Place</h4>
      <div className="card bg-surface-3 p-4 text-center text-strong">
        <div className="font-semibold">{third.teamA} vs {third.teamB}</div>
        <div className="text-xs">{formatDate(third.date)}</div>
      </div>
    </div>
  </div>
);

export default Bracket;
