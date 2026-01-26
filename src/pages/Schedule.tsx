import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useUserRole from "../hooks/useUserRole";
import { useSeason } from "../hooks/useSeason";
import { Match, Team, subscribeMatches, subscribeTeams } from "../firebase/queries";
import TeamLogo from "../components/TeamLogo";

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
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );

  const matchesByDate = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    matches.forEach((m) => {
      const key = m.dateISO || "No date";
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
      <h2 className="text-3xl font-bold mb-6 text-center text-strong">Match Schedule</h2>
      <div className="space-y-6">
        {matchesByDate.length === 0 && (
          <p className="text-center text-muted">No matches for this season.</p>
        )}
        {matchesByDate.map(([dateISO, list]) => {
          const dateObj = toDate(dateISO);
          const dateLabel = dateObj
            ? dateObj.toLocaleDateString("en-US", { day: "numeric", month: "long" })
            : "No date";
          return (
            <div key={dateISO}>
              <h3 className="text-lg font-semibold mb-2">{dateLabel}</h3>
              <ul className="space-y-3">
                {list.map((item) => {
                  const dateObjItem = toDate(item.dateISO, item.timeHHmm);
                  const time = dateObjItem?.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const homeScore = item.scores?.home;
                  const awayScore = item.scores?.away;
                  const isPlayed = homeScore != null && awayScore != null;
                  const homeTeam = teamMap[item.homeTeamId];
                  const awayTeam = teamMap[item.awayTeamId];
                  const homeName = homeTeam?.name || item.homeTeamId;
                  const awayName = awayTeam?.name || item.awayTeamId;

                  return (
                    <li
                      key={item.id}
                      className="list-card p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-muted sm:w-1/4">{time || "--:--"}</span>

                        <div className="sm:w-2/4 text-center">
                          <Link to={`/matches/${item.id}`}>
                            <div className="font-semibold hover:underline flex items-center justify-center gap-3">
                              <span className="flex items-center gap-2">
                                <TeamLogo
                                  logoFile={homeTeam?.logoFile}
                                  name={homeName}
                                  className="h-7 w-7 rounded-full object-contain"
                                />
                                <span>{homeName}</span>
                              </span>
                              <span className="text-sm text-muted">vs</span>
                              <span className="flex items-center gap-2">
                                <TeamLogo
                                  logoFile={awayTeam?.logoFile}
                                  name={awayName}
                                  className="h-7 w-7 rounded-full object-contain"
                                />
                                <span>{awayName}</span>
                              </span>
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
                              Edit
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
