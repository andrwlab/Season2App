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

const buildDate = (dateISO?: string, timeHHmm?: string) => {
  if (!dateISO) return null;
  return new Date(`${dateISO}T${timeHHmm || "00:00"}:00`);
};

const Home = () => {
  const { selectedSeasonId } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [teamSortKey, setTeamSortKey] = useState<
    "attack" | "blocks" | "service" | null
  >(null);

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribeMatches(selectedSeasonId, setMatches), [selectedSeasonId]);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribePlayerStats(selectedSeasonId, setPlayerStats), [selectedSeasonId]);
  useEffect(() => subscribePlayers(setPlayers), []);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const playerTeamMap = useMemo(() => {
    const map: Record<string, string> = {};
    rosters.forEach((r) => {
      r.playerIds?.forEach((pid) => {
        if (!map[pid]) map[pid] = r.teamId;
      });
    });
    return map;
  }, [rosters]);

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
  }, [matches]);

  const playerTotals = useMemo(() => {
    const totals: Record<string, { attack: number; blocks: number; service: number }> = {};
    playerStats.forEach((stat) => {
      if (!totals[stat.playerId]) {
        totals[stat.playerId] = { attack: 0, blocks: 0, service: 0 };
      }
      totals[stat.playerId].attack += stat.attack || 0;
      totals[stat.playerId].blocks += stat.blocks || 0;
      totals[stat.playerId].service += stat.service || 0;
    });
    return totals;
  }, [playerStats]);

  const teamStats = useMemo(() => {
    const totals: Record<string, { attack: number; blocks: number; service: number }> = {};
    Object.entries(playerTotals).forEach(([playerId, stats]) => {
      const teamId = playerTeamMap[playerId];
      if (!teamId) return;
      if (!totals[teamId]) totals[teamId] = { attack: 0, blocks: 0, service: 0 };
      totals[teamId].attack += stats.attack;
      totals[teamId].blocks += stats.blocks;
      totals[teamId].service += stats.service;
    });
    return totals;
  }, [playerTotals, playerTeamMap]);

  const getTeamName = (teamId?: string) => {
    if (!teamId) return "Equipo";
    return teamMap[teamId]?.name || teamId;
  };

  const bestTeam = (key: "attack" | "blocks" | "service") => {
    const entries = Object.entries(teamStats);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1][key] > a[1][key] ? b : a));
  };

  return (
    <div className="p-6 space-y-10">
      <section className="hero text-center px-6 py-8 sm:py-10">
        <h1 className="hero-title text-4xl sm:text-5xl font-extrabold mb-2">
          ¡Bienvenido al Torneo!
        </h1>
        <p className="hero-subtitle text-lg">
          Sigue las estadísticas, el calendario y el avance en tiempo real.
        </p>
      </section>

      <section>
        <Link to="/schedule">
          <h2 className="section-title text-xl font-semibold mb-4 hover:underline transition-colors">
            Próximos Partidos
          </h2>
        </Link>
        {upcomingMatches.length === 0 ? (
          <p className="text-muted text-sm">No hay partidos programados.</p>
        ) : (
          <ul className="space-y-2 text-sm text-body">
            {upcomingMatches.map((match) => {
              const date = buildDate(match.dateISO, match.timeHHmm);
              return (
                <li
                  key={match.id}
                  className="list-card p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-strong">
                      {getTeamName(match.homeTeamId)} vs {getTeamName(match.awayTeamId)}
                    </div>
                    <div className="text-xs text-muted">
                      {date?.toLocaleDateString("es-ES", { day: "numeric", month: "long" })} •{" "}
                      {date?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-xs text-muted italic">{match.status || "scheduled"}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title text-xl font-semibold mb-4">Equipos Participantes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map((team) => (
            <Link to={`/teams/${team.id}`} key={team.id}>
              <div className="team-card p-4 hover:scale-[1.02] transition-transform">
                <div className="flex items-center justify-center mb-2">
                  <TeamLogo logoFile={team.logoFile} name={team.name} className="h-14 w-14" />
                </div>
                <h3 className="text-center font-bold text-lg">{team.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Link to="/leaderboard">
          <h2 className="section-title text-xl font-semibold mb-4 hover:underline transition-colors">
            Tabla de Posiciones
          </h2>
        </Link>
        <div className="table-wrap overflow-x-auto">
          <table className="table table-auto w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Equipo</th>
                <th className="px-4 py-2">G</th>
                <th className="px-4 py-2">P</th>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { stat: "Ataques", icon: "🏐", key: "attack" as const },
            { stat: "Bloqueos", icon: "🛡️", key: "blocks" as const },
            { stat: "Servicios", icon: "🎯", key: "service" as const },
          ].map(({ stat, icon, key }) => {
            const leaderId = Object.entries(playerTotals).sort((a, b) => b[1][key] - a[1][key])[0]?.[0];
            const leaderStats = leaderId ? playerTotals[leaderId] : null;
            const leader = leaderId ? playerMap[leaderId] : null;
            return (
              <div key={stat} className="card p-4">
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
                ) : (
                  <div className="stat-muted text-center text-sm italic">Sin datos</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold mt-10 mb-4">Equipos Destacados</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {(["attack", "blocks", "service"] as const).map((key) => {
            const best = bestTeam(key);
            return (
              <div key={key} className="card p-4 flex flex-col items-center">
                <div className="text-3xl">{key === "attack" ? "🏐" : key === "blocks" ? "🛡️" : "🎯"}</div>
                <h4 className="stat-title text-center mt-1">
                  {key === "attack" ? "Ataques" : key === "blocks" ? "Bloqueos" : "Servicios"}
                </h4>
                <p className="text-body">{best ? getTeamName(best[0]) : "—"}</p>
                <p className="stat-value text-lg">{best ? best[1][key] : 0} pts</p>
              </div>
            );
          })}
        </div>

        <h2 className="section-title text-xl font-semibold mb-4">Estadísticas por Equipo</h2>
        <div className="table-wrap overflow-x-auto">
          <table className="table table-auto w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2">Equipo</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("attack")}>
                  Ataques ⇅
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("blocks")}>
                  Bloqueos ⇅
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => setTeamSortKey("service")}>
                  Servicios ⇅
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
