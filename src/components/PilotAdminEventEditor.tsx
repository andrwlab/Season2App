import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { displayFootballPlayerName } from "../pilot/footballTournament";
import { PilotPlayer, sortPilotPlayers } from "../pilot/players";

type EditableEvent = {
  eventId: string;
  type: string;
  teamSide?: "HOME" | "AWAY";
  playerId?: string | null;
  playerName?: string | null;
  assistPlayerId?: string | null;
  assistPlayerName?: string | null;
  status?: string;
};

type Props = {
  pilotMatchId: string;
  homePlayers?: PilotPlayer[];
  awayPlayers?: PilotPlayer[];
};

const editableTypes = new Set(["GOAL", "SHOT", "FOUL", "YELLOW_CARD", "RED_CARD", "PENALTY_GOAL"]);

const PilotAdminEventEditor = ({ pilotMatchId, homePlayers, awayPlayers }: Props) => {
  const [events, setEvents] = useState<EditableEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => onSnapshot(
    query(collection(db, "pilotEvents"), where("pilotMatchId", "==", pilotMatchId)),
    (snapshot) => setEvents(snapshot.docs
      .map((item) => item.data() as EditableEvent)
      .filter((event) => editableTypes.has(event.type) && event.status !== "HIDDEN")
      .sort((a, b) => a.eventId.localeCompare(b.eventId))),
    (error) => console.error("Admin event editor snapshot failed", error)
  ), [pilotMatchId]);

  const playersFor = (side?: "HOME" | "AWAY") => sortPilotPlayers(side === "HOME" ? homePlayers : awayPlayers);

  const saveEvent = async (event: EditableEvent, playerId: string, assistId = "") => {
    const players = playersFor(event.teamSide);
    const player = players.find((item) => item.playerId === playerId);
    const assist = players.find((item) => item.playerId === assistId);
    setBusyId(event.eventId);
    setMessage(null);
    try {
      await updateDoc(doc(db, "pilotEvents", event.eventId), {
        playerId: player?.playerId ?? null,
        playerName: player?.name ?? null,
        assistPlayerId: event.type === "GOAL" ? assist?.playerId ?? null : null,
        assistPlayerName: event.type === "GOAL" ? assist?.name ?? null : null,
        correctedByAdmin: true,
        correctedAt: serverTimestamp(),
      });
      setMessage("Corrección guardada.");
    } catch (error) {
      console.error("Failed to correct football event", error);
      setMessage("No se pudo guardar la corrección.");
    } finally {
      setBusyId(null);
    }
  };

  if (!events.length) return null;

  return (
    <section className="mx-auto mt-4 max-w-lg rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-amber-200">Correcciones de administrador</p>
      <p className="mt-1 text-xs text-slate-400">Edita el jugador responsable de una jugada histórica. Este panel solo aparece para administradores.</p>
      <div className="mt-3 space-y-2">
        {events.map((event) => {
          const players = playersFor(event.teamSide);
          const disabled = busyId === event.eventId;
          return (
            <div key={`${event.eventId}-${event.playerId ?? "none"}-${event.assistPlayerId ?? "none"}`} className="rounded-xl border border-white/10 bg-slate-950/40 p-2">
              <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-400">{event.type.replaceAll("_", " ")} · {displayFootballPlayerName(event.playerId, event.playerName) || "Sin jugador"}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select defaultValue={event.playerId ?? ""} onChange={(e) => void saveEvent(event, e.target.value, event.assistPlayerId ?? "")} disabled={disabled} className="min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs font-bold text-white" aria-label="Jugador de la jugada">
                  <option value="">Sin jugador</option>
                  {players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name}</option>)}
                </select>
                {event.type === "GOAL" && <select defaultValue={event.assistPlayerId ?? ""} onChange={(e) => void saveEvent(event, event.playerId ?? "", e.target.value)} disabled={disabled} className="min-w-0 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-xs font-bold text-white" aria-label="Asistencia">
                  <option value="">Sin asistencia</option>
                  {players.map((player) => <option key={player.playerId} value={player.playerId}>{player.name}</option>)}
                </select>}
              </div>
            </div>
          );
        })}
      </div>
      {message && <p className="mt-2 text-xs font-bold text-amber-100">{message}</p>}
    </section>
  );
};

export default PilotAdminEventEditor;
