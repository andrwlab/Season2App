import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Match, Team, subscribeMatches, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";

type Standing = {
  teamId: string;
  w: number;
  l: number;
  pf: number;
  pc: number;
};

const toDate = (m: any) =>
  m.dateISO ? new Date(`${m.dateISO}T${m.timeHHmm || "00:00"}:00`) : new Date(m.date || "");

const Leaderboard = () => {
  const { selectedSeasonId } = useSeason();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => subscribeMatches(selectedSeasonId, setMatches), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const standings = useMemo(() => {
    const map: Record<string, Standing> = {};
    teams.forEach((t) => {
      map[t.id] = { teamId: t.id, w: 0, l: 0, pf: 0, pc: 0 };
    });
    matches.forEach((m: any) => {
      const homeId = m.homeTeamId || m.teamA;
      const awayId = m.awayTeamId || m.teamB;
      const homeScore = m.scores?.home ?? m.scoreA;
      const awayScore = m.scores?.away ?? m.scoreB;
      if (homeScore == null || awayScore == null) return;
      if (!map[homeId]) map[homeId] = { teamId: homeId, w: 0, l: 0, pf: 0, pc: 0 };
      if (!map[awayId]) map[awayId] = { teamId: awayId, w: 0, l: 0, pf: 0, pc: 0 };
      map[homeId].pf += homeScore;
      map[homeId].pc += awayScore;
      map[awayId].pf += awayScore;
      map[awayId].pc += homeScore;
      if (homeScore > awayScore) {
        map[homeId].w += 1;
        map[awayId].l += 1;
      } else if (awayScore > homeScore) {
        map[awayId].w += 1;
        map[homeId].l += 1;
      }
    });
    return Object.values(map).sort((a, b) => {
      if (b.w !== a.w) return b.w - a.w;
      const diffA = a.pf - a.pc;
      const diffB = b.pf - b.pc;
      if (diffB !== diffA) return diffB - diffA;
      return b.pf - a.pf;
    });
  }, [matches]);

  const phaseMatches = useMemo(() => {
    const byPhase: Record<string, Match[]> = { semifinal: [], third: [], final: [] };
    (matches as any[]).forEach((m) => {
      if (m.phase && byPhase[m.phase]) byPhase[m.phase].push(m as any);
    });
    Object.values(byPhase).forEach((group) =>
      group.sort((a: any, b: any) => toDate(a).getTime() - toDate(b).getTime())
    );
    return byPhase;
  }, [matches]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">
      <section>
        <h2 className="text-2xl font-bold mb-4">Standings</h2>
        <div className="table-wrap overflow-x-auto">
        <table className="table table-auto w-full text-sm text-left">
          <thead>
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">W</th>
              <th className="px-3 py-2">L</th>
              <th className="px-3 py-2">PF</th>
              <th className="px-3 py-2">PA</th>
              <th className="px-3 py-2">+/-</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId}>
                <td className="px-3 py-2"><span className="badge">{i + 1}</span></td>
                <td className="px-3 py-2 text-strong">{teamMap[s.teamId] || s.teamId}</td>
                <td className="px-3 py-2">{s.w}</td>
                <td className="px-3 py-2">{s.l}</td>
                <td className="px-3 py-2">{s.pf}</td>
                <td className="px-3 py-2">{s.pc}</td>
                <td className="px-3 py-2">{s.pf - s.pc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {(phaseMatches.semifinal.length ||
        phaseMatches.third.length ||
        phaseMatches.final.length) && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Knockout Stage</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Semifinals</h3>
              <ul className="space-y-2">
                {phaseMatches.semifinal.map((m: any) => {
                  const d = toDate(m);
                  return (
                    <li key={m.id} className="list-card p-3 flex justify-between">
                      <span>
                        {teamMap[m.homeTeamId] || m.teamA} vs {teamMap[m.awayTeamId] || m.teamB}
                      </span>
                      <span className="text-sm text-muted">
                        {d.toLocaleDateString("en-US", { day: "numeric", month: "long" })} •{" "}
                        {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Third Place</h3>
              {phaseMatches.third.map((m: any) => {
                const d = toDate(m);
                return (
                  <div key={m.id} className="list-card p-3 flex justify-between">
                    <span>Loser SF1 vs Loser SF2</span>
                    <span className="text-sm text-muted">
                      {d.toLocaleDateString("en-US", { day: "numeric", month: "long" })} •{" "}
                      {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Final</h3>
              {phaseMatches.final.map((m: any) => {
                const d = toDate(m);
                return (
                  <div key={m.id} className="list-card p-3 flex justify-between">
                    <span>Winner SF1 vs Winner SF2</span>
                    <span className="text-sm text-muted">
                      {d.toLocaleDateString("en-US", { day: "numeric", month: "long" })} •{" "}
                      {d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="text-center">
        <Link to="/schedule" className="link-brand underline">
          View full schedule
        </Link>
      </div>
    </div>
  );
};

export default Leaderboard;
