import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useUserRole from "../hooks/useUserRole";
import { useSeason } from "../hooks/useSeason";
import { Match, Team, subscribeMatches, subscribeTeams } from "../firebase/queries";

const toDate = (dateISO?: string, timeHHmm?: string) =>
  dateISO ? new Date(`${dateISO}T${timeHHmm || "00:00"}:00`) : null;

const Schedule = () => {
  const { selectedSeasonId } = useSeason();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const role = useUserRole();

  useEffect(() => subscribeMatches(selectedSeasonId, setMatches), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const matchesByDate = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    matches.forEach((m) => {
      const key = m.dateISO || "Sin fecha";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });
    Object.values(grouped).forEach((group) => {
      group.sort((a, b) => {
        const da = toDate(a.dateISO, a.timeHHmm);
        const db = toDate(b.dateISO, b.timeHHmm);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [matches]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center text-strong">Calendario de Partidos</h2>
      <div className="space-y-6">
        {matchesByDate.length === 0 && (
          <p className="text-center text-muted">No hay partidos para esta temporada.</p>
        )}
        {matchesByDate.map(([dateISO, list]) => {
          const dateObj = toDate(dateISO);
          const dateLabel = dateObj
            ? dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "long" })
            : "Sin fecha";
          return (
            <div key={dateISO}>
              <h3 className="text-lg font-semibold mb-2">{dateLabel}</h3>
              <ul className="space-y-3">
                {list.map((item) => {
                  const dateObjItem = toDate(item.dateISO, item.timeHHmm);
                  const time = dateObjItem?.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const homeScore = item.scores?.home;
                  const awayScore = item.scores?.away;
                  const isPlayed = homeScore != null && awayScore != null;

                  return (
                    <li
                      key={item.id}
                      className="list-card p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-muted sm:w-1/4">{time || "--:--"}</span>

                        <div className="sm:w-2/4 text-center">
                          <Link to={`/matches/${item.id}`}>
                            <div className="font-semibold hover:underline">
                              {teamMap[item.homeTeamId] || item.homeTeamId} vs{" "}
                              {teamMap[item.awayTeamId] || item.awayTeamId}
                              {isPlayed && (
                                <span className="text-brand ml-2">
                                  ({homeScore} - {awayScore})
                                </span>
                              )}
                            </div>
                          </Link>
                          <div className="text-xs text-muted mt-1">
                            {item.status || "scheduled"}
                          </div>
                        </div>

                        <div className="sm:w-1/4 text-right mt-2 sm:mt-0 flex justify-end gap-3">
                          {(!isPlayed && (role === "admin" || role === "scorekeeper")) && (
                            <Link to={`/admin-match/${item.id}`} className="text-xs link-brand underline">
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
        })}
      </div>
    </div>
  );
};

export default Schedule;
