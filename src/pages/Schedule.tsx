import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useUserRole from "../hooks/useUserRole";
import { useSeason } from "../hooks/useSeason";
import { Match, Team, subscribeMatches, subscribeTeams } from "../firebase/queries";
import TeamLogo from "../components/TeamLogo";

const toDate = (dateISO?: string, timeHHmm?: string) =>
  dateISO ? new Date(`${dateISO}T${timeHHmm || "00:00"}:00`) : null;

type SetScore = { home: number; away: number };
type MatchWithSets = Match & { setScores?: SetScore[] };

const normalizeSetScores = (setScores?: Array<{ home?: number; away?: number }>) => {
  if (!Array.isArray(setScores)) return [];
  return setScores
    .map((set) => ({
      home: typeof set?.home === "number" ? set.home : Number.parseInt(String(set?.home ?? ""), 10),
      away: typeof set?.away === "number" ? set.away : Number.parseInt(String(set?.away ?? ""), 10),
    }))
    .filter((set) => Number.isFinite(set.home) && Number.isFinite(set.away));
};

const Schedule = () => {
  const { selectedSeasonId } = useSeason();
  const [matches, setMatches] = useState<MatchWithSets[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const role = useUserRole();
  const sectionRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const didScroll = React.useRef(false);

  useEffect(
    () => subscribeMatches(selectedSeasonId, (data) => setMatches(data as MatchWithSets[])),
    [selectedSeasonId]
  );
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

  const scrollTargetDate = useMemo(() => {
    if (!matchesByDate.length) return null;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let lastPast: string | null = null;
    matchesByDate.forEach(([dateISO]) => {
      if (!dateISO || dateISO === "No date") return;
      const dateValue = new Date(`${dateISO}T00:00:00`);
      if (Number.isNaN(dateValue.getTime())) return;
      if (dateValue <= todayStart) lastPast = dateISO;
    });
    if (lastPast) return lastPast;
    const firstDated = matchesByDate.find(([dateISO]) => dateISO && dateISO !== "No date");
    return firstDated ? firstDated[0] : matchesByDate[0][0];
  }, [matchesByDate]);

  useEffect(() => {
    if (didScroll.current) return;
    if (!scrollTargetDate) return;
    const target = sectionRefs.current[scrollTargetDate];
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "start" });
    didScroll.current = true;
  }, [scrollTargetDate]);

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
            <div
              key={dateISO}
              ref={(el) => {
                sectionRefs.current[dateISO] = el;
              }}
              style={{ scrollMarginTop: "120px" }}
            >
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
                  const scoreLabel = isPlayed ? `${homeScore} - ${awayScore}` : "VS";
                  const setScores = normalizeSetScores(item.setScores);

                  return (
                    <li key={item.id} className="list-card glass glass--hover p-4 md:p-5">
                      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[110px_1fr_auto] sm:items-center sm:gap-4">
                        <div className="text-sm text-muted sm:text-base sm:font-semibold self-start sm:self-auto">
                          {time || "--:--"}
                        </div>

                        <Link to={`/matches/${item.id}`} className="block hover:opacity-95 transition-opacity">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                            <div className="flex items-center justify-end gap-3 text-right">
                              <div className="min-w-0 hidden sm:block">
                                <div className="font-semibold text-base md:text-lg truncate">{homeName}</div>
                                <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Home</div>
                              </div>
                              <TeamLogo
                                logoFile={homeTeam?.logoFile}
                                name={homeName}
                                className="h-16 w-16 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-full object-contain"
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
                              {setScores.length > 0 && (
                                <div className="mt-2 flex flex-wrap justify-center gap-2 text-[10px] text-muted">
                                  {setScores.map((set, index) => (
                                    <span
                                      key={`${item.id}-set-${index}`}
                                      className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5"
                                    >
                                      Set {index + 1} {set.home}-{set.away}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-start gap-3 text-left">
                              <TeamLogo
                                logoFile={awayTeam?.logoFile}
                                name={awayName}
                                className="h-16 w-16 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-full object-contain"
                              />
                              <div className="min-w-0 hidden sm:block">
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
