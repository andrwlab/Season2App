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
    <div className="p-6 max-w-5xl mx-auto">
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
                  const statusLabel = item.status || (isPlayed ? "completed" : "scheduled");
                  const scoreLabel = isPlayed ? `${homeScore} - ${awayScore}` : "vs";

                  return (
                    <li key={item.id} className="list-card glass glass--hover p-4 md:p-5">
                      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[110px_1fr_auto] sm:items-center sm:gap-4">
                        <div className="text-sm text-muted sm:text-base sm:font-semibold">
                          {time || "--:--"}
                        </div>

                        <Link to={`/matches/${item.id}`} className="block hover:opacity-95 transition-opacity">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <div className="flex items-center justify-end gap-3 text-right">
                              <div className="min-w-0">
                                <div className="font-semibold text-base md:text-lg truncate">{homeName}</div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Home</div>
                              </div>
                              <TeamLogo
                                logoFile={homeTeam?.logoFile}
                                name={homeName}
                                className="h-12 w-12 md:h-14 md:w-14 rounded-full object-contain"
                              />
                            </div>

                            <div className="text-center px-2">
                              <div
                                className={`text-2xl md:text-3xl font-extrabold leading-none ${
                                  isPlayed ? "text-brand" : "text-strong"
                                }`}
                              >
                                {scoreLabel}
                              </div>
                              <div className="text-[11px] uppercase tracking-[0.22em] text-muted mt-1">
                                {statusLabel}
                              </div>
                            </div>

                            <div className="flex items-center justify-start gap-3 text-left">
                              <TeamLogo
                                logoFile={awayTeam?.logoFile}
                                name={awayName}
                                className="h-12 w-12 md:h-14 md:w-14 rounded-full object-contain"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-base md:text-lg truncate">{awayName}</div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Away</div>
                              </div>
                            </div>
                          </div>
                        </Link>

                        <div className="flex justify-end">
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
