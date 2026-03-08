import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Player, Roster, Team, subscribePlayers, subscribeRosters, subscribeTeams } from "../firebase/queries";
import { useSeason } from "../hooks/useSeason";
import { useAuth } from "../AuthContext";

type SetScoreInput = { home: string; away: string };
type SetScore = { home: number; away: number };

const createEmptySetScores = (): SetScoreInput[] => [
  { home: "", away: "" },
  { home: "", away: "" },
  { home: "", away: "" },
];

const parseSetScores = (sets: SetScoreInput[]) => {
  const parsed: SetScore[] = [];
  const wins = { home: 0, away: 0 };
  let sawGap = false;

  for (let i = 0; i < sets.length; i += 1) {
    const homeRaw = sets[i].home.trim();
    const awayRaw = sets[i].away.trim();
    const hasHome = homeRaw !== "";
    const hasAway = awayRaw !== "";

    if (!hasHome && !hasAway) {
      if (parsed.length > 0) sawGap = true;
      continue;
    }

    if (!hasHome || !hasAway) {
      return { error: `Enter both scores for set ${i + 1}.`, parsed, wins };
    }

    const homeVal = Number.parseInt(homeRaw, 10);
    const awayVal = Number.parseInt(awayRaw, 10);

    if (Number.isNaN(homeVal) || Number.isNaN(awayVal) || homeVal < 0 || awayVal < 0) {
      return { error: `Set ${i + 1} needs valid non-negative scores.`, parsed, wins };
    }

    if (sawGap) {
      return { error: "Fill set scores in order without skipping a set.", parsed, wins };
    }

    if (homeVal === awayVal) {
      return { error: `Set ${i + 1} cannot be tied.`, parsed, wins };
    }

    parsed.push({ home: homeVal, away: awayVal });
    if (homeVal > awayVal) {
      wins.home += 1;
    } else {
      wins.away += 1;
    }
  }

  return { parsed, wins };
};

const AdminMatch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedSeasonId } = useSeason();
  const [match, setMatch] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [setScores, setSetScores] = useState<SetScoreInput[]>(createEmptySetScores);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState<string>("");
  const { role, loading: authLoading } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchMatch = async () => {
      if (!id) return;
      setLoadError("");
      try {
        const ref = doc(db, "matches", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setLoadError("Match not found.");
          return;
        }
        const data = snap.data() as any;
        setMatch(data);
        setScoreA(data.scores?.home ?? data.scoreA ?? "");
        setScoreB(data.scores?.away ?? data.scoreB ?? "");
        const rawSetScores = Array.isArray(data.setScores) ? data.setScores : [];
        const nextSetScores = createEmptySetScores().map((set, index) => {
          const entry = rawSetScores[index];
          if (!entry) return set;
          return {
            home: entry.home != null ? String(entry.home) : "",
            away: entry.away != null ? String(entry.away) : "",
          };
        });
        setSetScores(nextSetScores);
        setFormData(data.playersStats || {});
      } catch (err) {
        console.error("Failed to load match", err);
        setLoadError("Failed to load match. Check console for details.");
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

  const isBestOfThree =
    match?.phase === "semifinal" || match?.status === "Semifinals" || match?.bestOf === 3;

  const resolveScores = () => {
    if (isBestOfThree) {
      const { parsed, wins, error: setErrorMessage } = parseSetScores(setScores);
      if (setErrorMessage) {
        return { error: setErrorMessage };
      }
      if (wins.home > 2 || wins.away > 2) {
        return { error: "Best of 3 only allows up to 2 set wins." };
      }
      if (wins.home !== 2 && wins.away !== 2) {
        return { error: "Best of 3 requires a team to win 2 sets." };
      }
      return { scores: wins, setScores: parsed };
    }

    const scoreAVal = Number.parseInt(scoreA as string, 10);
    const scoreBVal = Number.parseInt(scoreB as string, 10);

    if (Number.isNaN(scoreAVal) || Number.isNaN(scoreBVal)) {
      return { error: "You must enter a valid score for both teams." };
    }

    if (scoreAVal < 0 || scoreBVal < 0) {
      return { error: "Scores must be zero or higher." };
    }

    return { scores: { home: scoreAVal, away: scoreBVal } };
  };

  const validateForm = () => {
    const scorePayload = resolveScores();
    if (scorePayload.error) {
      return scorePayload.error;
    }

    if (
      !Object.keys(formData).some(
        (playerId) =>
          formData[playerId]?.attack ||
          formData[playerId]?.blocks ||
          formData[playerId]?.assists ||
          formData[playerId]?.service
      )
    ) {
      return "You must enter at least one stat for a player.";
    }

    return null;
  };

  const handleSetScoreChange = (index: number, side: "home" | "away", value: string) => {
    setSetScores((prev) =>
      prev.map((set, idx) => (idx === index ? { ...set, [side]: value } : set))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const scorePayload = resolveScores();
    if (scorePayload.error) {
      setError(scorePayload.error);
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const seasonIdForStats = match.seasonId || selectedSeasonId;
      const matchId = id;
      const matchRef = doc(db, "matches", matchId);
      const closeAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      const statusValue =
        match?.phase === "semifinal" || match?.status === "Semifinals" ? "Semifinals" : "finished";
      const matchUpdate: Record<string, any> = {
        scores: scorePayload.scores,
        status: statusValue,
        playersStats: formData,
        endedAt: serverTimestamp(),
        fanVoteEnabled: true,
        fanVoteCloseAt: closeAt,
      };
      if (scorePayload.setScores) {
        matchUpdate.setScores = scorePayload.setScores;
        matchUpdate.bestOf = 3;
      }
      if (seasonIdForStats) {
        matchUpdate.seasonId = seasonIdForStats;
      }
      await updateDoc(matchRef, matchUpdate);

      if (seasonIdForStats) {
        const batch = writeBatch(db);
        const statEntries = Object.entries(formData)
          .map(([playerId, stats]) => {
            const playerInfo = playersById[playerId];
            const playerName = playerInfo?.fullName || (playerInfo as any)?.name;
            const attack = stats?.attack || 0;
            const blocks = stats?.blocks || 0;
            const assists = stats?.assists || 0;
            const service = stats?.service || 0;
            const hasAnyStat = attack || blocks || assists || service;
            if (!hasAnyStat) return null;
            const data: Record<string, unknown> = {
              seasonId: seasonIdForStats,
              matchId,
              playerId,
              attack,
              blocks,
              assists,
              service,
              updatedAt: serverTimestamp(),
            };
            if (playerName) data.playerName = playerName;
            return { id: `${matchId}__${playerId}`, data };
          })
          .filter(Boolean) as Array<{ id: string; data: Record<string, unknown> }>;
        const newStatIds = new Set(statEntries.map((entry) => entry.id));
        const existingStatsSnap = await getDocs(
          query(collection(db, "playerStats"), where("matchId", "==", matchId))
        );
        existingStatsSnap.forEach((statDoc) => {
          if (!newStatIds.has(statDoc.id)) {
            batch.delete(statDoc.ref);
          }
        });

        statEntries.forEach((entry) => {
          const statRef = doc(db, "playerStats", entry.id);
          batch.set(statRef, entry.data);
        });

        await batch.commit();
      }
      navigate(`/matches/${id}`);
    } catch (err) {
      setError("An error occurred while saving. Please try again.");
    }
  };

  const handleDeleteMatch = async () => {
    if (!id || role !== "admin") return;
    const confirmed = window.confirm(
      "Delete this match? This will remove the score and all recorded stats."
    );
    if (!confirmed) return;

    try {
      const batch = writeBatch(db);
      const existingStatsSnap = await getDocs(
        query(collection(db, "playerStats"), where("matchId", "==", id))
      );
      existingStatsSnap.forEach((statDoc) => batch.delete(statDoc.ref));
      batch.delete(doc(db, "matches", id));
      await batch.commit();
      navigate("/schedule");
    } catch (err) {
      console.error("Failed to delete match", err);
      setError("Failed to delete match. Please try again.");
    }
  };

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );
  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const canEditMatch = role === "admin" || role === "scorekeeper";
  if (authLoading || !match || !canEditMatch || loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card glass glass--hover p-4">
          <p className="text-center font-semibold text-strong">
            {loadError || "Loading or no permission..."}
          </p>
          <div className="mt-3 text-xs text-muted space-y-1">
            <p>role: {role ?? "(null)"}</p>
            <p>authLoading: {String(authLoading)}</p>
            <p>matchLoaded: {String(Boolean(match))}</p>
            <p>selectedSeasonId: {selectedSeasonId ?? "(null)"}</p>
            <p>teams: {teams.length}</p>
            <p>rosters: {rosters.length}</p>
            <p>players: {players.length}</p>
            {match?.seasonId && selectedSeasonId && match.seasonId !== selectedSeasonId && (
              <p className="text-warning">
                Match season ({match.seasonId}) != selected season ({selectedSeasonId})
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const teamAId = match.homeTeamId || match.teamA;
  const teamBId = match.awayTeamId || match.teamB;
  const teamAName = teamMap[teamAId] || teamAId;
  const teamBName = teamMap[teamBId] || teamBId;
  const setWinsPreview = parseSetScores(setScores).wins;

  const teamAPlayerIds = rosters.find((r) => r.teamId === teamAId)?.playerIds || [];
  const teamBPlayerIds = rosters.find((r) => r.teamId === teamBId)?.playerIds || [];
  const teamAPlayers = teamAPlayerIds.map((id) => playersById[id]).filter(Boolean);
  const teamBPlayers = teamBPlayerIds.map((id) => playersById[id]).filter(Boolean);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center text-strong mb-4">Record Result</h2>
      <div className="card glass glass--hover p-4">
        <p className="text-center font-medium mb-2">{teamAName} vs {teamBName}</p>

        {error && <p className="text-danger text-center mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          {isBestOfThree ? (
            <div className="mb-6 space-y-3">
              <div className="text-center text-sm font-semibold text-strong">
                Best of 3 sets
              </div>
              {setScores.map((set, index) => (
                <div key={`set-${index}`} className="flex items-center justify-center gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted w-16 text-right">
                    Set {index + 1}
                  </span>
                  <input
                    type="number"
                    className="input-field px-3 py-2 w-24 text-center"
                    placeholder={teamAName}
                    min={0}
                    value={set.home}
                    onChange={(e) => handleSetScoreChange(index, "home", e.target.value)}
                  />
                  <span className="text-xl font-bold">-</span>
                  <input
                    type="number"
                    className="input-field px-3 py-2 w-24 text-center"
                    placeholder={teamBName}
                    min={0}
                    value={set.away}
                    onChange={(e) => handleSetScoreChange(index, "away", e.target.value)}
                  />
                </div>
              ))}
              <div className="text-xs text-muted text-center">
                Sets won: {setWinsPreview.home} - {setWinsPreview.away}
              </div>
            </div>
          ) : (
            <div className="flex gap-4 justify-center mb-6">
              <input
                type="number"
                className="input-field px-3 py-2 w-24 text-center"
                placeholder={teamAName}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                min={0}
                required
              />
              <span className="text-xl font-bold">-</span>
              <input
                type="number"
                className="input-field px-3 py-2 w-24 text-center"
                placeholder={teamBName}
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                min={0}
                required
              />
            </div>
          )}

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
                        className="input-field px-2 py-1 w-1/4"
                        value={formData[player.id]?.attack || ""}
                        onChange={(e) => handleStatChange(player.id, "attack", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🛡️"
                        className="input-field px-2 py-1 w-1/4"
                        value={formData[player.id]?.blocks || ""}
                        onChange={(e) => handleStatChange(player.id, "blocks", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🤝"
                        className="input-field px-2 py-1 w-1/4"
                        value={formData[player.id]?.assists || ""}
                        onChange={(e) => handleStatChange(player.id, "assists", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="🎯"
                        className="input-field px-2 py-1 w-1/4"
                        value={formData[player.id]?.service || ""}
                        onChange={(e) => handleStatChange(player.id, "service", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <button type="submit" className="btn btn-primary px-6 py-2">
              Save Result
            </button>
            {role === "admin" && (
              <button
                type="button"
                onClick={handleDeleteMatch}
                className="btn btn-danger px-6 py-2"
              >
                Delete Match
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminMatch;
