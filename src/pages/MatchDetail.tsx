import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import useUserRole from "../hooks/useUserRole";
import { Player, Team, subscribePlayers, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import TeamLogo from "../components/TeamLogo";

interface MatchDoc {
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

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribePlayers(setPlayers), []);

  const teamById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );
  const playerMap = useMemo(
    () =>
      Object.fromEntries(
        players.map((p) => [p.id, p.fullName || (p as any).name || p.id])
      ),
    [players]
  );

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-center text-strong">Match Details</h2>

      <div className="card glass glass--hover p-5 md:p-6">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6">
            <div className="flex items-center justify-center md:justify-end gap-3 text-center md:text-right">
              <TeamLogo
                logoFile={homeTeam?.logoFile}
                name={homeName}
                className="h-16 w-16 md:h-20 md:w-20 rounded-full object-contain"
              />
              <div>
                <div className="text-lg md:text-xl font-semibold">{homeName}</div>
                <div className="text-xs text-muted uppercase tracking-[0.18em]">Home</div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.22em] text-muted mb-2">
                {statusLabel}
              </div>
              <div className="text-4xl md:text-5xl font-extrabold text-strong leading-none">
                {isPlayed ? `${scoreHome} - ${scoreAway}` : "vs"}
              </div>
              <div className="text-sm text-muted mt-2">{date}</div>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-3 text-center md:text-left">
              <div>
                <div className="text-lg md:text-xl font-semibold">{awayName}</div>
                <div className="text-xs text-muted uppercase tracking-[0.18em]">Away</div>
              </div>
              <TeamLogo
                logoFile={awayTeam?.logoFile}
                name={awayName}
                className="h-16 w-16 md:h-20 md:w-20 rounded-full object-contain"
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

      <div className="card glass glass--hover p-4 md:p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-bold">Player Statistics</h3>
          {!match.playersStats || Object.keys(match.playersStats).length === 0 ? (
            <span className="text-xs text-muted uppercase tracking-[0.2em]">
              No stats yet
            </span>
          ) : null}
        </div>

        {match.playersStats && Object.keys(match.playersStats).length > 0 ? (
          <div className="glass glass--strong tableWrap overflow-x-auto">
            <table className="table table-auto w-full text-sm text-left">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted">
                    Player
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted">
                    Attacks
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted">
                    Blocks
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted">
                    Assists
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted">
                    Serves
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(match.playersStats).map(([playerId, stats]) => (
                  <tr key={playerId} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">
                      {playerMap[playerId] || playerId}
                    </td>
                    <td className="px-4 py-3">{stats?.attack ?? 0}</td>
                    <td className="px-4 py-3">{stats?.blocks ?? 0}</td>
                    <td className="px-4 py-3">{stats?.assists ?? 0}</td>
                    <td className="px-4 py-3">{stats?.service ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-sm">No stats recorded.</p>
        )}
      </div>
    </div>
  );
};

export default MatchDetail;
