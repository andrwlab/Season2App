import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import useUserRole from "../hooks/useUserRole";
import { Player, Roster, Team, subscribePlayers, subscribeRosters, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import TeamLogo from "../components/TeamLogo";

interface MatchDoc {
  seasonId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  teamA?: string;
  teamB?: string;
  scores?: { home: number | null; away: number | null };
  scoreA?: number | null;
  scoreB?: number | null;
  dateISO?: string;
  timeHHmm?: string;
  date?: string;
  status?: string;
  playersStats?: Record<string, { attack?: number; blocks?: number; assists?: number; service?: number }>;
}

const MatchDetail = () => {
  const { id } = useParams();
  const { selectedSeasonId } = useSeason();
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const role = useUserRole();

  useEffect(() => {
    const fetchMatch = async () => {
      if (!id) return;
      const ref = doc(db, "matches", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setMatch(data as MatchDoc);
      }
    };
    fetchMatch();
  }, [id]);

  const seasonIdForMatch = match?.seasonId || selectedSeasonId;

  useEffect(() => subscribeTeams(seasonIdForMatch, setTeams), [seasonIdForMatch]);
  useEffect(() => subscribeRosters(seasonIdForMatch, setRosters), [seasonIdForMatch]);
  useEffect(() => subscribePlayers(setPlayers), []);
  useEffect(() => {
    if (
      import.meta.env.DEV &&
      match?.seasonId &&
      selectedSeasonId &&
      match.seasonId !== selectedSeasonId
    ) {
      console.warn(
        `Match season (${match.seasonId}) differs from selected season (${selectedSeasonId}). Using match season for rosters/teams.`
      );
    }
  }, [match?.seasonId, selectedSeasonId]);

  const teamById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );
  const playerMap = useMemo(() => {
    const map: Record<string, string> = {};
    players.forEach((p) => {
      const name = p.fullName || (p as any).name || p.id;
      map[p.id] = name;
      if (name) {
        map[name] = name;
        map[name.toLowerCase()] = name;
      }
    });
    return map;
  }, [players]);

  const rosterTeamByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    rosters.forEach((r) => {
      r.playerIds?.forEach((pid) => {
        if (!map[pid]) map[pid] = r.teamId;
      });
    });
    return map;
  }, [rosters]);

  const rosterTeamByPlayerKey = useMemo(() => {
    const map: Record<string, string> = {};
    const addKey = (key: string | undefined, teamId: string) => {
      if (!key) return;
      const trimmed = key.trim();
      if (!trimmed) return;
      if (!map[trimmed]) map[trimmed] = teamId;
      const lower = trimmed.toLowerCase();
      if (!map[lower]) map[lower] = teamId;
    };

    Object.entries(rosterTeamByPlayerId).forEach(([playerId, teamId]) => {
      addKey(playerId, teamId);
      const name = playerMap[playerId];
      if (name) addKey(name, teamId);
    });

    players.forEach((p) => {
      const teamId = rosterTeamByPlayerId[p.id];
      if (!teamId) return;
      addKey(p.fullName || (p as any).name, teamId);
    });

    return map;
  }, [playerMap, players, rosterTeamByPlayerId]);

  if (!match) return <p className="text-center mt-10">Loading match...</p>;

  const dateValue = match.dateISO
    ? new Date(`${match.dateISO}T${match.timeHHmm || "00:00"}:00`)
    : new Date(match.date || "");
  const date = dateValue.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
  });

  const homeTeamId = match.homeTeamId || "";
  const awayTeamId = match.awayTeamId || "";
  const homeTeam = teamById[homeTeamId];
  const awayTeam = teamById[awayTeamId];

  const homeName = homeTeam?.name || match.teamA || match.homeTeamId || "Team A";
  const awayName = awayTeam?.name || match.teamB || match.awayTeamId || "Team B";
  const scoreHome = match.scores?.home ?? match.scoreA;
  const scoreAway = match.scores?.away ?? match.scoreB;
  const isPlayed = scoreHome != null && scoreAway != null;
  const statusLabel = match.status || (isPlayed ? "completed" : "scheduled");
  const resolveTeamId = (playerKey: string) => {
    const trimmed = playerKey.trim();
    return rosterTeamByPlayerKey[trimmed] || rosterTeamByPlayerKey[trimmed.toLowerCase()];
  };

  const statsEntries = Object.entries(match.playersStats || {});
  const homeStats = statsEntries.filter(
    ([playerKey]) => resolveTeamId(playerKey) === homeTeamId
  );
  const awayStats = statsEntries.filter(
    ([playerKey]) => resolveTeamId(playerKey) === awayTeamId
  );
  const unassignedStats = statsEntries.filter(([playerKey]) => {
    const teamId = resolveTeamId(playerKey);
    return teamId !== homeTeamId && teamId !== awayTeamId;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-center text-strong">Match Details</h2>

      <div className="card glass glass--hover p-5 md:p-6">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:gap-6">
            <div className="flex flex-col md:flex-row items-center md:justify-end gap-2 md:gap-3 text-center md:text-right">
              <TeamLogo
                logoFile={homeTeam?.logoFile}
                name={homeName}
                className="h-20 w-20 sm:h-24 sm:w-24 md:h-20 md:w-20 rounded-full object-contain"
              />
              <div>
                <div className="text-base sm:text-lg md:text-xl font-semibold">{homeName}</div>
                <div className="text-[0.65rem] sm:text-xs text-muted uppercase tracking-[0.2em] md:tracking-[0.18em]">
                  Home
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.22em] text-muted mb-2">
                {statusLabel}
              </div>
              <div className="text-4xl md:text-5xl font-extrabold text-strong leading-none">
                {isPlayed ? `${scoreHome} - ${scoreAway}` : "VS"}
              </div>
              <div className="text-sm text-muted mt-2">{date}</div>
            </div>

            <div className="flex flex-col md:flex-row items-center md:justify-start gap-2 md:gap-3 text-center md:text-left">
              <div className="order-2 md:order-1">
                <div className="text-base sm:text-lg md:text-xl font-semibold">{awayName}</div>
                <div className="text-[0.65rem] sm:text-xs text-muted uppercase tracking-[0.2em] md:tracking-[0.18em]">
                  Visit
                </div>
              </div>
              <TeamLogo
                logoFile={awayTeam?.logoFile}
                name={awayName}
                className="h-20 w-20 sm:h-24 sm:w-24 md:h-20 md:w-20 rounded-full object-contain order-1 md:order-2"
              />
            </div>
          </div>

          {(role === "admin" || role === "scorekeeper") && (
            <div className="text-center">
              <Link to={`/admin-match/${id}`}>
                <button className="btn btn-primary px-6 py-2">Edit Match</button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-bold">Player Statistics</h3>
          <div className="flex flex-col items-end gap-1">
            {!match.playersStats || Object.keys(match.playersStats).length === 0 ? (
              <span className="text-xs text-muted uppercase tracking-[0.2em]">
                No stats yet
              </span>
            ) : null}
            {unassignedStats.length > 0 ? (
              <span className="text-xs text-warning uppercase tracking-[0.16em]">
                Some players are unassigned
              </span>
            ) : null}
          </div>
        </div>

        {match.playersStats && Object.keys(match.playersStats).length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[{ label: homeName, entries: homeStats }, { label: awayName, entries: awayStats }].map(
              ({ label, entries }) => (
                <div key={label} className="card glass glass--hover p-4">
                  <h4 className="text-md font-semibold mb-3">{label}</h4>
                  {entries.length > 0 ? (
                    <div className="glass glass--strong tableWrap overflow-x-auto">
                      <table className="table table-auto w-full text-sm text-left">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                              Player
                            </th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                              Att
                            </th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                              Blk
                            </th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                              Ast
                            </th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                              Srv
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(([playerId, stats]) => (
                            <tr key={playerId} className="border-t border-white/5 hover:bg-white/5">
                              <td className="px-3 py-2 font-medium">
                                {playerMap[playerId] || playerId}
                              </td>
                              <td className="px-3 py-2">{stats?.attack ?? 0}</td>
                              <td className="px-3 py-2">{stats?.blocks ?? 0}</td>
                              <td className="px-3 py-2">{stats?.assists ?? 0}</td>
                              <td className="px-3 py-2">{stats?.service ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No stats recorded for this team.</p>
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">No stats recorded.</p>
        )}

        {unassignedStats.length > 0 && (
          <div className="card glass glass--hover p-4">
            <h4 className="text-md font-semibold mb-3">Unassigned Players</h4>
            <p className="text-xs text-muted mb-3">
              Tip: assign these players to a team roster so they show under Home/Away.
            </p>
            <div className="glass glass--strong tableWrap overflow-x-auto">
              <table className="table table-auto w-full text-sm text-left">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                      Player
                    </th>
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                      Att
                    </th>
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                      Blk
                    </th>
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                      Ast
                    </th>
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted">
                      Srv
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedStats.map(([playerId, stats]) => (
                    <tr key={playerId} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2 font-medium">{playerMap[playerId] || playerId}</td>
                      <td className="px-3 py-2">{stats?.attack ?? 0}</td>
                      <td className="px-3 py-2">{stats?.blocks ?? 0}</td>
                      <td className="px-3 py-2">{stats?.assists ?? 0}</td>
                      <td className="px-3 py-2">{stats?.service ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchDetail;
