import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import useUserRole from "../hooks/useUserRole";
import { Player, Roster, Team, subscribePlayers, subscribeRosters, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";

const AdminMatch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedSeasonId } = useSeason();
  const [match, setMatch] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [error, setError] = useState("");
  const role = useUserRole();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchMatch = async () => {
      if (!id) return;
      const ref = doc(db, "matches", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setMatch(data);
        setScoreA(data.scores?.home ?? data.scoreA ?? "");
        setScoreB(data.scores?.away ?? data.scoreB ?? "");
        setFormData(data.playersStats || {});
      }
    };
    fetchMatch();
  }, [id]);

  useEffect(() => subscribePlayers(setPlayers), []);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

  const handleStatChange = (playerId: string, stat: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [stat]: parseInt(value) || 0,
      },
    }));
  };

  const validateForm = () => {
    const scoreAVal = parseInt(scoreA as string);
    const scoreBVal = parseInt(scoreB as string);

    if (isNaN(scoreAVal) || isNaN(scoreBVal)) {
      return "Debes ingresar un marcador válido para ambos equipos.";
    }

    if (
      !Object.keys(formData).some(
        (playerId) =>
          formData[playerId]?.attack ||
          formData[playerId]?.blocks ||
          formData[playerId]?.service
      )
    ) {
      return "Debes ingresar al menos una estadística para algún jugador.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await updateDoc(doc(db, "matches", id as string), {
        scores: { home: parseInt(scoreA as string), away: parseInt(scoreB as string) },
        status: "completed",
        playersStats: formData,
      });
      navigate(`/matches/${id}`);
    } catch (err) {
      setError("Ocurrió un error al guardar. Intenta nuevamente.");
    }
  };

  if (!match || role !== "admin") return <p className="text-center mt-10">Cargando o sin permiso...</p>;

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const teamAId = match.homeTeamId || match.teamA;
  const teamBId = match.awayTeamId || match.teamB;
  const teamAName = teamMap[teamAId] || teamAId;
  const teamBName = teamMap[teamBId] || teamBId;

  const teamAPlayerIds = rosters.find((r) => r.teamId === teamAId)?.playerIds || [];
  const teamBPlayerIds = rosters.find((r) => r.teamId === teamBId)?.playerIds || [];
  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );
  const teamAPlayers = teamAPlayerIds.map((id) => playersById[id]).filter(Boolean);
  const teamBPlayers = teamBPlayerIds.map((id) => playersById[id]).filter(Boolean);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center text-primary mb-4">Registrar Resultado</h2>
      <div className="bg-white p-4 shadow rounded">
        <p className="text-center font-medium mb-2">{teamAName} vs {teamBName}</p>

        {error && <p className="text-red-600 text-center mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-4 justify-center mb-6">
            <input
              type="number"
              className="border px-3 py-2 rounded w-24 text-center"
              placeholder={teamAName}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              required
            />
            <span className="text-xl font-bold">-</span>
            <input
              type="number"
              className="border px-3 py-2 rounded w-24 text-center"
              placeholder={teamBName}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { team: teamAName, players: teamAPlayers },
              { team: teamBName, players: teamBPlayers },
            ].map(({ team, players }) => (
              <div key={team}>
                <h3 className="text-lg font-semibold mb-2">{team}</h3>
                {players.map((player) => (
                  <div key={player.id} className="mb-2">
                    <p className="font-medium">{player.fullName || (player as any).name || player.id}</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="🏐"
                        className="border px-2 py-1 w-1/3"
                        value={formData[player.id]?.attack || ""}
                        onChange={(e) => handleStatChange(player.id, "attack", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🛡️"
                        className="border px-2 py-1 w-1/3"
                        value={formData[player.id]?.blocks || ""}
                        onChange={(e) => handleStatChange(player.id, "blocks", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🎯"
                        className="border px-2 py-1 w-1/3"
                        value={formData[player.id]?.service || ""}
                        onChange={(e) => handleStatChange(player.id, "service", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button type="submit" className="mt-6 bg-primary text-white px-6 py-2 rounded hover:bg-blue-700">
            Guardar Resultado
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminMatch;
