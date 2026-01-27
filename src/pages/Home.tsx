import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Match,
  Player,
  PlayerStat,
  Roster,
  Team,
  subscribeMatches,
  subscribePlayers,
  subscribePlayerStats,
  subscribeRosters,
  subscribeTeams,
} from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import TeamLogo from "../components/TeamLogo";
import { season1Players, season1TeamColors, season1Teams } from "../data";
import heroBanner from "../assets/banners/LogoBannSeason2.png";

const buildDate = (dateISO?: string, timeHHmm?: string) => {
  if (!dateISO) return null;
  return new Date(`${dateISO}T${timeHHmm || "00:00"}:00`);
};

const isSeason1Name = (name?: string | null) => {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return normalized.includes("season 1") || normalized.includes("temporada 1") || normalized === "s1";
};

const Home = () => {
  const { selectedSeasonId, selectedSeason } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [teamSortKey, setTeamSortKey] = useState<
    "attack" | "blocks" | "assists" | "service" | null
  >(null);

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribeMatches(selectedSeasonId, setMatches), [selectedSeasonId]);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribePlayerStats(selectedSeasonId, setPlayerStats), [selectedSeasonId]);
  useEffect(() => subscribePlayers(setPlayers), []);

  const isSeason1 = isSeason1Name(selectedSeason?.name);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const nameToPlayerId = useMemo(
    () => Object.fromEntries(players.map((p) => [p.fullName, p.id])),
    [players]
  );

  const playerTeamMap = useMemo(() => {
    if (isSeason1) {
      const map: Record<string, string> = {};
      season1Players.forEach((p) => {
        const id = nameToPlayerId[p.name] || `season1:${p.name}`;
        map[id] = p.team;
      });
      return map;
    }
    const map: Record<string, string> = {};
    rosters.forEach((r) => {
      r.playerIds?.forEach((pid) => {
        if (!map[pid]) map[pid] = r.teamId;
      });
    });
    return map;
  }, [isSeason1, nameToPlayerId, rosters]);

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    return matches
      .filter((m) => {
        const d = buildDate(m.dateISO, m.timeHHmm);
        return d && d > now;
      })
      .sort((a, b) => {
        const da = buildDate(a.dateISO, a.timeHHmm);
        const db = buildDate(b.dateISO, b.timeHHmm);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      })
      .slice(0, 3);
  }, [matches]);

  const standings = useMemo(() => {
    if (isSeason1) return [];
    const map: Record<string, { teamId: string; w: number; l: number }> = {};
    matches.forEach((m) => {
      const homeScore = m.scores?.home;
      const awayScore = m.scores?.away;
      if (homeScore == null || awayScore == null) return;
      if (!map[m.homeTeamId]) map[m.homeTeamId] = { teamId: m.homeTeamId, w: 0, l: 0 };
      if (!map[m.awayTeamId]) map[m.awayTeamId] = { teamId: m.awayTeamId, w: 0, l: 0 };
      if (homeScore > awayScore) {
        map[m.homeTeamId].w += 1;
        map[m.awayTeamId].l += 1;
      } else if (awayScore > homeScore) {
        map[m.awayTeamId].w += 1;
        map[m.homeTeamId].l += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.w - a.w);
  }, [isSeason1, matches]);

  const playerTotals = useMemo(() => {
    if (isSeason1) {
      const totals: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
      season1Players.forEach((p) => {
        const id = nameToPlayerId[p.name] || `season1:${p.name}`;
        totals[id] = {
          attack: p.attack,
          blocks: p.blocks,
          assists: p.assists,
          service: p.service,
        };
      });
      return totals;
    }
    const totals: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    playerStats.forEach((stat) => {
      if (!totals[stat.playerId]) {
        totals[stat.playerId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      }
      totals[stat.playerId].attack += stat.attack || 0;
      totals[stat.playerId].blocks += stat.blocks || 0;
      totals[stat.playerId].assists += stat.assists || 0;
      totals[stat.playerId].service += stat.service || 0;
    });
    return totals;
  }, [isSeason1, nameToPlayerId, playerStats]);

  const teamStats = useMemo(() => {
    if (isSeason1) {
      const totals: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
      season1Players.forEach((p) => {
        if (!totals[p.team]) totals[p.team] = { attack: 0, blocks: 0, assists: 0, service: 0 };
        totals[p.team].attack += p.attack;
        totals[p.team].blocks += p.blocks;
        totals[p.team].assists += p.assists;
        totals[p.team].service += p.service;
      });
      return totals;
    }
    const totals: Record<string, { attack: number; blocks: number; assists: number; service: number }> = {};
    Object.entries(playerTotals).forEach(([playerId, stats]) => {
      const teamId = playerTeamMap[playerId];
      if (!teamId) return;
      if (!totals[teamId]) totals[teamId] = { attack: 0, blocks: 0, assists: 0, service: 0 };
      totals[teamId].attack += stats.attack;
      totals[teamId].blocks += stats.blocks;
      totals[teamId].assists += stats.assists;
      totals[teamId].service += stats.service;
    });
    return totals;
  }, [isSeason1, playerTotals, playerTeamMap]);

  const getTeamName = (teamId?: string) => {
    if (!teamId) return "Team";
    if (isSeason1) return teamId;
    return teamMap[teamId]?.name || teamId;
  };

  const bestTeam = (key: "attack" | "blocks" | "assists" | "service") => {
    const entries = Object.entries(teamStats);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1][key] > a[1][key] ? b : a));
  };

  return (
    <div className="p-6 space-y-10">
      <section className="hero hero--banner text-center">
        <div className="hero-banner">
          <img
            src={heroBanner}
            alt="Season 2 banner"
            className="hero-banner__img"
            loading="lazy"
          />
        </div>
      </section>

      <section>
        <Link to="/schedule">
          <h2 className="section-title text-xl font-semibold mb-4 hover:underline transition-colors">
            Upcoming Matches
          </h2>
        </Link>
        {upcomingMatches.length === 0 ? (
          <p className="text-muted text-sm">No scheduled matches.</p>
        ) : (
          <ul className="space-y-2 text-sm text-body">
            {upcomingMatches.map((match) => {
              const date = buildDate(match.dateISO, match.timeHHmm);
              return (
                <li
                  key={match.id}
                  className="list-card glass glass--hover p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-strong">
                      {getTeamName(match.homeTeamId)} vs {getTeamName(match.awayTeamId)}
                    </div>
                    <div className="text-xs text-muted">
                      {date?.toLocaleDateString("en-US", { day: "numeric", month: "long" })} •{" "}
                      {date?.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-xs text-muted italic">
                    {match.status || "Single set of 25 points"}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title text-xl font-semibold mb-4">Participating Teams</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(isSeason1 ? season1Teams : teams).map((team) => {
            const key = isSeason1 ? team.name : team.id;
            const content = (
              <div
                className="team-card glass glass--hover p-4 hover:scale-[1.02] transition-transform"
                style={
                  isSeason1
                    ? {
                        backgroundColor: season1TeamColors[team.name],
                        borderColor: "rgba(255,255,255,0.15)",
                      }
                    : undefined
                }
              >
                {isSeason1 ? (
                  <h3 className="text-center font-bold text-lg text-white">{team.name}</h3>
                ) : (
                  <>
                    <div className="flex items-center justify-center mb-2">
                      <TeamLogo logoFile={team.logoFile} name={team.name} className="h-14 w-14" />
                    </div>
                    <h3 className="text-center font-bold text-lg">{team.name}</h3>
                  </>
                )}
              </div>
            );

            if (isSeason1) {
              return (
                <div key={key}>
                  {content}
                </div>
              );
            }

            return (
              <Link to={`/teams/${team.id}`} key={key}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <Link to="/leaderboard">
          <h2 className="section-title text-xl font-semibold mb-4 hover:underline transition-colors">
            Standings
          </h2>
        </Link>
        <div className="glass glass--strong tableWrap overflow-x-auto">
          <table className="table table-auto w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2">W</th>
                <th className="px-4 py-2">L</th>
              </tr>
            </thead>
            <tbody>
              {standings.slice(0, 4).map((team, idx) => (
                <tr key={team.teamId}>
                  <td className="px-4 py-2"><span className="badge">{idx + 1}</span></td>
                  <td className="px-4 py-2 font-medium text-strong">{getTeamName(team.teamId)}</td>
                  <td className="px-4 py-2">{team.w}</td>
                  <td className="px-4 py-2">{team.l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title text-xl font-semibold mb-4">StatPadders MVP Race</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { stat: "Attacks", icon: "🏐", key: "attack" as const },
          { stat: "Blocks", icon: "🛡️", key: "blocks" as const },
          { stat: "Assists", icon: "🤝", key: "assists" as const },
          { stat: "Serves", icon: "🎯", key: "service" as const },
        ].map(({ stat, icon, key }) => {
          const leaderId = Object.entries(playerTotals).sort((a, b) => b[1][key] - a[1][key])[0]?.[0];
          const leaderStats = leaderId ? playerTotals[leaderId] : null;
          const leader = leaderId ? playerMap[leaderId] : null;
          const season1LeaderName = isSeason1
            ? season1Players.find((p) => (nameToPlayerId[p.name] || `season1:${p.name}`) === leaderId)?.name
            : null;
          return (
            <div key={stat} className="card glass glass--hover p-4">
              <div className="text-center text-3xl mb-2">{icon}</div>
              <div className="stat-title text-center">{stat}</div>
              {leader && leaderStats ? (
                  <>
                    <div className="stat-muted text-center text-sm mt-1">
                      {leader.fullName || (leader as any).name || leaderId}
                    </div>
                    <div className="stat-value text-center text-lg">
                      {leaderStats[key]} pts
                    </div>
                  </>
                ) : isSeason1 && leaderStats ? (
                  <>
                    <div className="stat-muted text-center text-sm mt-1">
                      {season1LeaderName || leaderId}
                    </div>
                    <div className="stat-value text-center text-lg">
                      {leaderStats[key]} pts
                    </div>
                  </>
                ) : (
                  <div className="stat-muted text-center text-sm italic">No data</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold mt-10 mb-4">Featured Teams</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {(["attack", "blocks", "assists", "service"] as const).map((key) => {
            const best = bestTeam(key);
            return (
              <div key={key} className="card glass glass--hover p-4 flex flex-col items-center">
                <div className="text-3xl">
                  {key === "attack" ? "🏐" : key === "blocks" ? "🛡️" : key === "assists" ? "🤝" : "🎯"}
                </div>
                <h4 className="stat-title text-center mt-1">
                  {key === "attack" ? "Attacks" : key === "blocks" ? "Blocks" : key === "assists" ? "Assists" : "Serves"}
                </h4>
                <p className="text-body">{best ? getTeamName(best[0]) : "—"}</p>
                <p className="stat-value text-lg">{best ? best[1][key] : 0} pts</p>
              </div>
            );
          })}
        </div>

        <h2 className="section-title text-xl font-semibold mb-4">Team Statistics</h2>
        <div className="glass glass--strong tableWrap overflow-x-auto">
          <table className="table table-auto w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("attack")}>
                  Attacks ⇅
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("blocks")}>
                  Blocks ⇅
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("assists")}>
                  Assists ⇅
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("service")}>
                  Serves ⇅
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(teamStats)
                .sort(([, a], [, b]) => {
                  if (!teamSortKey) return 0;
                  return b[teamSortKey] - a[teamSortKey];
                })
                .map(([teamId, stats]) => (
                  <tr key={teamId}>
                    <td className="px-4 py-2 font-medium text-strong">{getTeamName(teamId)}</td>
                    <td className="px-4 py-2">{stats.attack}</td>
                    <td className="px-4 py-2">{stats.blocks}</td>
                    <td className="px-4 py-2">{stats.assists}</td>
                    <td className="px-4 py-2">{stats.service}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Home;
