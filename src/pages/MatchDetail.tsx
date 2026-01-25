import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import useUserRole from "../hooks/useUserRole";
import { Player, Team, subscribePlayers, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";

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
  playersStats?: Record<string, { attack?: number; blocks?: number; service?: number }>;
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

  if (!match) return <p className="text-center mt-10">Cargando partido...</p>;

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );
  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.fullName])),
    [players]
  );

  const dateValue = match.dateISO
    ? new Date(`${match.dateISO}T${match.timeHHmm || "00:00"}:00`)
    : new Date(match.date || "");
  const date = dateValue.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  const homeName = teamMap[match.homeTeamId || ""] || match.teamA || "Equipo A";
  const awayName = teamMap[match.awayTeamId || ""] || match.teamB || "Equipo B";
  const scoreHome = match.scores?.home ?? match.scoreA;
  const scoreAway = match.scores?.away ?? match.scoreB;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center text-strong mb-4">Detalles del Partido</h2>
      <div className="card p-4">
        <div className="text-center font-semibold text-lg mb-1">
          {homeName} vs {awayName}
        </div>
        <div className="text-center text-muted text-sm mb-4">
          {date} • {match.status || "scheduled"}
        </div>

        {scoreHome != null && scoreAway != null ? (
          <div className="text-center text-xl font-bold text-success mb-4">
            Resultado: {scoreHome} - {scoreAway}
          </div>
        ) : (
          <div className="text-center text-sm text-muted italic mb-4">Aún sin resultado</div>
        )}

        {role === "admin" || role === "scorekeeper" ? (
          <div className="text-center mb-4">
            <Link to={`/admin-match/${id}`}>
              <button className="btn btn-primary px-4 py-2">
                Editar Partido
              </button>
            </Link>
          </div>
        ) : null}

        <h3 className="text-md font-bold mb-2">Estadísticas por jugador:</h3>
        {match.playersStats && Object.keys(match.playersStats).length > 0 ? (
          <div className="table-wrap overflow-x-auto">
            <table className="table table-auto w-full text-sm text-left">
              <thead>
                <tr>
                  <th className="px-4 py-2">Jugador</th>
                  <th className="px-4 py-2">Ataques</th>
                  <th className="px-4 py-2">Bloqueos</th>
                  <th className="px-4 py-2">Servicios</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(match.playersStats).map(([playerId, stats]) => (
                  <tr key={playerId}>
                    <td className="px-4 py-2">{playerMap[playerId] || playerId}</td>
                    <td className="px-4 py-2">{stats?.attack ?? 0}</td>
                    <td className="px-4 py-2">{stats?.blocks ?? 0}</td>
                    <td className="px-4 py-2">{stats?.service ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-sm">No hay estadísticas registradas.</p>
        )}
      </div>
    </div>
  );
};

export default MatchDetail;
