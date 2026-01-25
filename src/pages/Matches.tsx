import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { useSeason } from "../hooks/useSeason";
import { Match, Team, subscribeMatches, subscribeTeams } from "../firebase/queries";
import { Link } from "react-router-dom";

const Matches = () => {
  const { user, role } = useAuth();
  const { selectedSeasonId } = useSeason();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [formData, setFormData] = useState({
    homeTeamId: "",
    awayTeamId: "",
    dateISO: "",
    timeHHmm: "",
  });

  useEffect(() => subscribeMatches(selectedSeasonId, setMatches), [selectedSeasonId]);
  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;

    const newMatch = {
      seasonId: selectedSeasonId,
      dateISO: formData.dateISO,
      timeHHmm: formData.timeHHmm,
      homeTeamId: formData.homeTeamId,
      awayTeamId: formData.awayTeamId,
      status: "scheduled",
      scores: { home: null, away: null },
    };

    try {
      await addDoc(collection(db, "matches"), newMatch);
      setFormData({ homeTeamId: "", awayTeamId: "", dateISO: "", timeHHmm: "" });
    } catch (error) {
      console.error("Error al guardar el partido:", error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Partidos</h2>
      {!selectedSeasonId && (
        <p className="text-sm text-muted mb-4">Selecciona una temporada para ver los partidos.</p>
      )}

      {user && role === "admin" && (
        <>
          <h3 className="text-xl font-semibold mb-2">Registrar nuevo partido</h3>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mb-6">
            <div className="flex gap-4">
              <select
                name="homeTeamId"
                value={formData.homeTeamId}
                onChange={handleChange}
                className="input-field w-1/2 px-3 py-2"
                required
              >
                <option value="">Equipo local</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                name="awayTeamId"
                value={formData.awayTeamId}
                onChange={handleChange}
                className="input-field w-1/2 px-3 py-2"
                required
              >
                <option value="">Equipo visitante</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <input
                type="date"
                name="dateISO"
                value={formData.dateISO}
                onChange={handleChange}
                className="input-field w-1/2 px-3 py-2"
                required
              />
              <input
                type="time"
                name="timeHHmm"
                value={formData.timeHHmm}
                onChange={handleChange}
                className="input-field w-1/2 px-3 py-2"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary px-4 py-2">
              Guardar
            </button>
          </form>
        </>
      )}

      <h3 className="text-xl font-semibold mb-2">Partidos registrados</h3>
      <ul className="space-y-2">
        {matches.map((match) => (
          <li key={match.id} className="list-card px-4 py-2 flex justify-between items-center">
            <span>
              <strong>{match.dateISO}</strong>: {teamMap[match.homeTeamId] || match.homeTeamId} vs{" "}
              {teamMap[match.awayTeamId] || match.awayTeamId}
            </span>
            {(role === "admin" || role === "scorekeeper") && (
              <Link to={`/admin-match/${match.id}`} className="text-sm link-brand hover:underline ml-4">
                Editar
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Matches;
