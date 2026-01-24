import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { useSeason } from "../hooks/useSeason";
import { Player, Roster, Team, subscribePlayers, subscribeRosters, subscribeTeams } from "../firebase/queries";

const AdminRosters = () => {
  const { user, role } = useAuth();
  const { selectedSeasonId } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [targetTeam, setTargetTeam] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  useEffect(() => subscribeTeams(selectedSeasonId, setTeams), [selectedSeasonId]);
  useEffect(() => subscribeRosters(selectedSeasonId, setRosters), [selectedSeasonId]);
  useEffect(() => subscribePlayers(setPlayers), []);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams]
  );
  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const rosterByTeam = useMemo(() => {
    const map: Record<string, Roster> = {};
    rosters.forEach((r) => {
      map[r.teamId] = r;
    });
    return map;
  }, [rosters]);

  const getRosterDocId = (teamId: string) => {
    const existing = rosters.find((r) => r.teamId === teamId);
    return existing?.id || `${selectedSeasonId}_${teamId}`;
  };

  const movePlayer = async (playerId: string, fromTeamId: string) => {
    if (!selectedSeasonId) return;
    const toTeamId = targetTeam[playerId];
    if (!toTeamId || toTeamId === fromTeamId) return;

    const fromRoster = rosterByTeam[fromTeamId] || {
      id: getRosterDocId(fromTeamId),
      seasonId: selectedSeasonId,
      teamId: fromTeamId,
      playerIds: [],
    };
    const toRoster = rosterByTeam[toTeamId] || {
      id: getRosterDocId(toTeamId),
      seasonId: selectedSeasonId,
      teamId: toTeamId,
      playerIds: [],
    };

    const nextFrom = (fromRoster.playerIds || []).filter((id) => id !== playerId);
    const nextTo = Array.from(new Set([...(toRoster.playerIds || []), playerId]));

    const batch = writeBatch(db);
    batch.set(
      doc(db, "rosters", fromRoster.id),
      { seasonId: selectedSeasonId, teamId: fromTeamId, playerIds: nextFrom, updatedAt: serverTimestamp() },
      { merge: true }
    );
    batch.set(
      doc(db, "rosters", toRoster.id),
      { seasonId: selectedSeasonId, teamId: toTeamId, playerIds: nextTo, updatedAt: serverTimestamp() },
      { merge: true }
    );
    batch.set(
      doc(collection(db, "trades")),
      {
        seasonId: selectedSeasonId,
        playerId,
        fromTeamId,
        toTeamId,
        note: note || "",
        timestamp: serverTimestamp(),
      }
    );

    await batch.commit();
    setTargetTeam((prev) => ({ ...prev, [playerId]: "" }));
  };

  if (!user || role !== "admin") {
    return <p className="p-6 text-center text-gray-500">Acceso restringido.</p>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Rosters (Admin)</h2>
      <div className="bg-white p-4 rounded shadow">
        <label className="block text-sm font-medium mb-2">Nota de trade (opcional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          placeholder="Ej: cambio por ausencia"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.map((team) => {
          const roster = rosterByTeam[team.id];
          const rosterPlayers =
            roster?.playerIds?.map((pid) => playerMap[pid]).filter(Boolean) || [];
          return (
            <div key={team.id} className="bg-white rounded shadow p-4">
              <h3 className="text-lg font-semibold mb-3">{team.name}</h3>
              {rosterPlayers.length === 0 ? (
                <p className="text-sm text-gray-500">Sin jugadores.</p>
              ) : (
                <ul className="space-y-3">
                  {rosterPlayers.map((player) => (
                    <li key={player.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{player.fullName || (player as any).name || player.id}</span>
                      <div className="flex items-center gap-2">
                        <select
                          className="border px-2 py-1 rounded text-sm"
                          value={targetTeam[player.id] || ""}
                          onChange={(e) =>
                            setTargetTeam((prev) => ({ ...prev, [player.id]: e.target.value }))
                          }
                        >
                          <option value="">Mover a...</option>
                          {teams
                            .filter((t) => t.id !== team.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                        <button
                          className="bg-primary text-white px-2 py-1 rounded text-sm"
                          onClick={() => movePlayer(player.id, team.id)}
                          disabled={!targetTeam[player.id]}
                        >
                          Mover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminRosters;
