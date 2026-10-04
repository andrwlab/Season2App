import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { canScoreMatches } from "../auth/roles";
import { signInWithGoogle } from "../auth/googleSignIn";
import { auth } from "../firebase";
import "../styles/sabis-volleyball.css";

type Player = { id: string; name: string; grade: string; side: "women" | "men" };
type Match = {
  id: string; date: string; side: "women" | "men"; opponent: string;
  status: "scheduled" | "live" | "finished"; setsFor: number; setsAgainst: number;
  starters?: string[]; substitutions?: { out: string; in: string; set: number }[];
  stats?: Record<string, { attacks: number; blocks: number; assists: number; aces: number }>;
};
type BoardToken = { id: string; x: number; y: number };
type SavedBoard = { id: string; name: string; side: "women" | "men"; tokens: BoardToken[]; preset?: "base" | "horizontal" | "custom"; players?: Record<string, string>; replacements?: Record<string, string> };

// Public labels deliberately contain only a first name, surname initial, and grade.
const PLAYERS: Player[] = [
  ["alexia-d","Alexia D.","7A","women"],["maria-p","Maria P.","7A","women"],["lia-r","Lia R.","7A","women"],["paola-l","Paola L.","7A","women"],
  ["kisbeth-c","Kisbeth C.","8A","women"],["melanie-v","Melanie V.","8A","women"],["inna-d","Inna D.","8A","women"],["arantza-n","Arantza N.","8A","women"],["luzarianis-p","Luzarianis P.","8A","women"],
  ["sarah-a","Sarah A.","9A","women"],["antonella-j","Antonella J.","9A","women"],["ximena-r","Ximena R.","9A","women"],["victoria-p","Victoria P.","9B","women"],["samantha-v","Samantha V.","9B","women"],["isabella-c","Isabella C.","10A","women"],
  ["edwin-c","Edwin C.","7A","men"],["jimmy-l","Jimmy L.","7A","men"],["hiram-c","Hiram C.","7A","men"],["sebastian-v","Sebastian V.","8A","men"],["ethan-l","Ethan L.","8A","men"],
  ["jorge-h","Jorge H.","9A","men"],["dhruvin-a","Dhruvin A.","9A","men"],["christopher-w","Christopher W.","9B","men"],["williams-l","Williams L.","9B","men"],["mario-z","Mario Z.","9B","men"],["kevin-l","Kevin L.","9B","men"],["brian-c","Brian C.","10A","men"],
].map(([id,name,grade,side]) => ({ id, name, grade, side: side as Player["side"] }));

const MATCHES = [
  { id: "harpy-2026-10-02-women", date: "2026-10-02", side: "women" as const, opponent: "American School International", status: "scheduled" as const, setsFor: 0, setsAgainst: 0 },
  { id: "harpy-2026-10-02-men", date: "2026-10-02", side: "men" as const, opponent: "American School International", status: "scheduled" as const, setsFor: 0, setsAgainst: 0 },
];
const STORE = "sabis-volleyball-board-v2";
// One team's half-court formation: front row 4–3–2, back row 5–6–1.
const initialTokens: BoardToken[] = [
  { id: "1", x: 74, y: 72 }, { id: "2", x: 74, y: 22 }, { id: "3", x: 50, y: 22 },
  { id: "4", x: 26, y: 22 }, { id: "5", x: 26, y: 72 }, { id: "6", x: 50, y: 72 },
];
const POSITIONS = [
  { id: "4", role: "Punta · delantero" }, { id: "3", role: "Central · delantero" }, { id: "2", role: "Opuesto · delantero" },
  { id: "5", role: "Punta · zaguero" }, { id: "6", role: "Líbero / central · zaguero" }, { id: "1", role: "Armador · zaguero" },
];

function MatchCard({ match, onChange }: { match: Match; onChange: (next: Match) => void }) {
  const [showSetup, setShowSetup] = useState(false);
  const [playerId, setPlayerId] = useState(PLAYERS.filter((p) => p.side === match.side).sort((a, b) => a.name.localeCompare(b.name, "es"))[0]?.id || "");
  const [subInPlayerId, setSubInPlayerId] = useState("");
  const [outPlayerId, setOutPlayerId] = useState(match.starters?.[0] || "");
  const roster = PLAYERS.filter((p) => p.side === match.side).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  const starters = match.starters || [];
  const starterPlayers = roster.filter((p) => starters.includes(p.id));
  const benchPlayers = roster.filter((p) => !starters.includes(p.id));
  const selectedOutId = starterPlayers.some((p) => p.id === outPlayerId) ? outPlayerId : starterPlayers[0]?.id || "";
  const selectedInId = benchPlayers.some((p) => p.id === subInPlayerId) ? subInPlayerId : benchPlayers[0]?.id || "";
  const selectedPlayer = roster.find((p) => p.id === playerId);
  const label = match.side === "women" ? "Harpy Eagles · Femenino" : "Harpy Eagles · Masculino";
  const stat = match.stats?.[playerId] || { attacks: 0, blocks: 0, assists: 0, aces: 0 };
  const addStat = (key: "attacks" | "blocks" | "assists" | "aces") => onChange({ ...match, stats: { ...match.stats, [playerId]: { ...stat, [key]: stat[key] + 1 } } });
  const toggleStarter = (id: string) => {
    const list = match.starters || [];
    onChange({ ...match, starters: list.includes(id) ? list.filter((v) => v !== id) : list.length < 6 ? [...list, id] : list });
  };
  const doSub = () => {
    const old = starters;
    const out = selectedOutId;
    const incoming = selectedInId;
    if (!out || !incoming || !old.includes(out) || old.includes(incoming)) return;
    onChange({ ...match, starters: old.map((id) => id === out ? incoming : id), substitutions: [...(match.substitutions || []), { out, in: incoming, set: 1 }] });
  };
  return <article className="he-match">
    <div className="he-match-top"><div><span className="he-kicker">{match.side === "women" ? "FEMENINO" : "MASCULINO"}</span><h3>{label} <span>vs</span> {match.opponent}</h3><p>2 de octubre de 2026 · Horario por confirmar</p></div><span className={`he-status ${match.status}`}>{match.status === "live" ? "EN VIVO" : match.status === "finished" ? "FINAL" : "PROGRAMADO"}</span></div>
    <div className="he-score"><b>{match.setsFor}</b><span>SETS</span><b>{match.setsAgainst}</b></div>
    <div className="he-actions"><button onClick={() => setShowSetup(!showSetup)}>{showSetup ? "Ocultar control" : "Alineación y estadísticas"}</button><button onClick={() => onChange({ ...match, status: match.status === "live" ? "finished" : "live" })}>{match.status === "live" ? "Finalizar" : "Iniciar partido"}</button></div>
    {showSetup && <div className="he-editor">
      <div className="he-lineup"><div className="he-lineup-heading"><div><h4>Cuadro inicial <small>{starters.length}/6</small></h4><p>Toca los nombres para elegir o quitar titulares. Lista ordenada A–Z; máximo seis.</p></div><span className={`he-lineup-progress ${starters.length === 6 ? "complete" : ""}`}>{starters.length === 6 ? "Cuadro completo" : `Faltan ${6 - starters.length}`}</span></div><div className="he-roster">{roster.map((p) => { const index = starters.indexOf(p.id); return <button type="button" key={p.id} className={index >= 0 ? "selected" : ""} aria-pressed={index >= 0} onClick={() => toggleStarter(p.id)}><span>{p.name}</span><small>{index >= 0 ? `Titular ${index + 1}` : p.grade}</small></button>; })}</div></div>
      <div className="he-score-tools"><h4>Marcador por sets</h4><div className="he-set-controls"><button onClick={() => onChange({ ...match, setsFor: Math.max(0, match.setsFor - 1) })}>−</button><b>{match.setsFor} : {match.setsAgainst}</b><button onClick={() => onChange({ ...match, setsFor: match.setsFor + 1 })}>+ SABIS</button><button onClick={() => onChange({ ...match, setsAgainst: match.setsAgainst + 1 })}>+ Rival</button><button onClick={() => onChange({ ...match, setsAgainst: Math.max(0, match.setsAgainst - 1) })}>−</button></div></div>
      <div className="he-score-tools"><h4>Registrar sustitución</h4><p className="he-help">Elige quién sale de las titulares y quién entra desde la banca.</p><div className="he-stat-controls"><select aria-label="Jugador que sale" value={selectedOutId} onChange={(e) => setOutPlayerId(e.target.value)}><option value="">Sale…</option>{starterPlayers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.grade}</option>)}</select><select aria-label="Jugador que entra" value={selectedInId} onChange={(e) => setSubInPlayerId(e.target.value)}><option value="">Entra…</option>{benchPlayers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.grade}</option>)}</select><button disabled={!selectedOutId || !selectedInId} onClick={doSub}>Guardar cambio</button></div>{(match.substitutions || []).length > 0 && <ul className="he-sub-list">{match.substitutions!.map((s, i) => <li key={`${s.out}-${i}`}>Set {s.set}: Entra {PLAYERS.find((p) => p.id === s.in)?.name} por {PLAYERS.find((p) => p.id === s.out)?.name}</li>)}</ul>}</div>
      <div className="he-score-tools"><div className="he-stat-heading"><div><h4>Registrar estadística</h4><p className="he-help">Selecciona cualquier jugadora o jugador del plantel, titulares o banca, y luego suma la acción.</p></div><span className="he-selected-player">{selectedPlayer?.name || "Elige un jugador"}</span></div><div className="he-stat-roster" role="list" aria-label="Plantel en orden alfabético">{roster.map((p) => <button type="button" role="listitem" key={p.id} className={playerId === p.id ? "selected" : ""} aria-pressed={playerId === p.id} onClick={() => setPlayerId(p.id)}><span>{p.name}</span><small>{starters.length === 0 ? "Plantel" : starters.includes(p.id) ? "Titular" : "Banca"}</small></button>)}</div><div className="he-stat-controls">{([["attacks","Ataques"],["blocks","Bloqueos"],["assists","Asistencias"],["aces","Aces"]] as const).map(([key,title]) => <button key={key} onClick={() => addStat(key)} disabled={!selectedPlayer}>+ {title} ({stat[key]})</button>)}</div></div>
    </div>}
  </article>;
}

export default function SabisVolleyballHub() {
  const auth = useAuth();
  const canEdit = canScoreMatches(auth?.role);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"partidos" | "plantel" | "pizarra">("partidos");
  const [boardView, setBoardView] = useState<"formation" | "lineup">("formation");
  const [side, setSide] = useState<"women" | "men">("women");
  const [assignmentMode, setAssignmentMode] = useState<"players" | "replacements">("players");
  const [selectedLineupPlayer, setSelectedLineupPlayer] = useState("");
  const [formationPreset, setFormationPreset] = useState<"base" | "horizontal" | "custom">("base");
  const [tokens, setTokens] = useState<BoardToken[]>(() => { try { return JSON.parse(localStorage.getItem(STORE) || "null") || initialTokens; } catch { return initialTokens; } });
  const [boardName, setBoardName] = useState("Rotación inicial");
  const [savedBoard, setSavedBoard] = useState("");
  const [lineups, setLineups] = useState<Record<"women" | "men", { players: Record<string, string>; replacements: Record<string, string> }>>({ women: { players: {}, replacements: {} }, men: { players: {}, replacements: {} } });
  const [boards, setBoards] = useState<SavedBoard[]>([]);
  const [authError, setAuthError] = useState("");

  useEffect(() => setSelectedLineupPlayer(""), [side]);

  useEffect(() => onSnapshot(collection(db, "sabisVolleyballMatches"), (snap) => {
    setMatches(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Match)));
    setReady(true);
  }, (error) => { console.error("SABIS volleyball matches failed to load", error); setReady(true); }), []);
  useEffect(() => onSnapshot(query(collection(db, "sabisVolleyballBoards"), orderBy("updatedAt", "desc")), (snap) => {
    setBoards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedBoard)));
  }, (error) => console.warn("Could not load saved strategy boards", error)), []);

  const visibleMatches = useMemo(() => (matches.length ? matches : MATCHES).sort((a,b) => a.date.localeCompare(b.date)), [matches]);
  const positionPlayers = lineups[side].players;
  const positionReplacements = lineups[side].replacements;
  const sideRoster = useMemo(() => PLAYERS.filter((player) => player.side === side).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })), [side]);
  const useFormationPreset = (preset: "base" | "horizontal") => {
    setFormationPreset(preset);
    setTokens(preset === "base" ? initialTokens : ["4", "3", "2", "5", "6", "1"].map((id, index) => ({ id, x: 13 + index * 14.8, y: 51 })));
    setSavedBoard(preset === "base" ? "Formación base cargada" : "Línea horizontal cargada");
  };
  const assignLineupPlayer = (positionId: string, playerId: string) => {
    if (!playerId) return;
    setLineups((previous) => {
      const current = previous[side];
      if (assignmentMode === "replacements") {
        if (Object.values(current.players).includes(playerId)) return previous;
        const replacements = Object.fromEntries(Object.entries(current.replacements).filter(([key, value]) => key !== positionId && value !== playerId));
        return { ...previous, [side]: { ...current, replacements: { ...replacements, [positionId]: playerId } } };
      }
      const players = { ...current.players };
      const previousPosition = Object.entries(players).find(([, value]) => value === playerId)?.[0];
      const displacedPlayer = players[positionId];
      players[positionId] = playerId;
      if (previousPosition && previousPosition !== positionId) {
        if (displacedPlayer) players[previousPosition] = displacedPlayer;
        else delete players[previousPosition];
      }
      const replacements = Object.fromEntries(Object.entries(current.replacements).filter(([, value]) => value !== playerId));
      return { ...previous, [side]: { ...current, players, replacements } };
    });
    setSelectedLineupPlayer("");
  };
  const updateMatch = async (match: Match) => {
    if (!canEdit) return;
    try { await setDoc(doc(db, "sabisVolleyballMatches", match.id), { ...match, updatedAt: serverTimestamp() }, { merge: true }); }
    catch (error) { console.error("Could not save volleyball match", error); window.alert("No se pudo guardar. Verifica tu acceso de administrador o scorekeeper."); }
  };
  const createFixtures = async () => {
    for (const fixture of MATCHES.filter((item) => !matches.some((match) => match.id === item.id))) await updateMatch(fixture);
  };
  const saveBoard = async () => {
    const payload = { name: boardName.trim() || "Diagrama", side, tokens, preset: formationPreset, players: positionPlayers, replacements: positionReplacements, updatedAt: serverTimestamp() };
    if (canEdit) {
      try { await setDoc(doc(db, "sabisVolleyballBoards", `${side}-${Date.now()}`), payload); setSavedBoard("Guardado en el hub"); }
      catch { setSavedBoard("No se pudo guardar en la nube; quedó en este dispositivo"); localStorage.setItem(STORE, JSON.stringify(tokens)); }
    } else { localStorage.setItem(STORE, JSON.stringify(tokens)); setSavedBoard("Guardado en este dispositivo"); }
  };
  const moveToken = (id: string, event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(6, ((event.clientY - rect.top) / rect.height) * 100));
    setTokens((prev) => prev.map((t) => t.id === id ? { ...t, x, y } : t));
    setFormationPreset("custom");
  };
  const login = async () => {
    setAuthError("");
    try { await signInWithGoogle(auth); }
    catch { setAuthError("No se pudo iniciar sesión. Intenta de nuevo en Safari o Chrome."); }
  };

  return <main className="harpy-page">
    <style>{styles}</style>
    <header className="he-header"><Link to="/" className="he-back">← <span>Livescore</span></Link><div className="he-brand"><span className="he-mark">HE</span><div><p>SABIS COSTA VERDE</p><h1>Harpy Eagles</h1><small>VOLEIBOL · TEMPORADA 2026–27</small></div></div><div className="he-auth">{canEdit ? <span>STAFF · EDICIÓN ACTIVA</span> : <button onClick={login}>Acceso de staff</button>}{authError && <small>{authError}</small>}</div></header>
    <nav className="he-tabs" aria-label="Secciones">{([["partidos","Partidos"],["plantel","Plantel"],["pizarra","Pizarra"]] as const).map(([id,label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === "partidos" && <section className="he-section"><div className="he-section-title"><div><span className="he-kicker">SABIS vs AMERICAN SCHOOL</span><h2>Partidos</h2></div>{canEdit && MATCHES.some((item) => !matches.some((match) => match.id === item.id)) && <button className="he-primary" onClick={createFixtures}>Crear partidos faltantes</button>}</div>{!ready ? <p className="he-empty">Cargando partidos…</p> : <div className="he-match-list">{visibleMatches.map((m) => <MatchCard key={m.id} match={m} onChange={updateMatch} />)}</div>}<p className="he-note">Las estadísticas de este hub se guardan en colecciones independientes y no se mezclan con otros torneos.</p></section>}
    {tab === "plantel" && <section className="he-section"><div className="he-section-title"><div><span className="he-kicker">JUGADORAS Y JUGADORES</span><h2>Plantel</h2></div><div className="he-switch"><button className={side === "women" ? "active" : ""} onClick={() => setSide("women")}>Femenino</button><button className={side === "men" ? "active" : ""} onClick={() => setSide("men")}>Masculino</button></div></div><div className="he-roster-grid">{PLAYERS.filter((p) => p.side === side).map((p) => <article className="he-player" key={p.id}><span>{p.name}</span><small>{p.grade}</small></article>)}</div><p className="he-note">Los apellidos completos no se muestran. El grado ayuda a distinguir nombres repetidos.</p></section>}
    {tab === "pizarra" && <section className="he-section">
      <div className="he-section-title"><div><span className="he-kicker">ESTRATEGIA</span><h2>Tablero magnético</h2></div><div className="he-switch"><button className={side === "women" ? "active" : ""} onClick={() => setSide("women")}>Femenino</button><button className={side === "men" ? "active" : ""} onClick={() => setSide("men")}>Masculino</button></div></div>
      <div className="he-board-tools"><select value={formationPreset} onChange={(e) => e.target.value !== "custom" && useFormationPreset(e.target.value as "base" | "horizontal")} aria-label="Formación predeterminada"><option value="base">Base · 4–3–2 / 5–6–1</option><option value="horizontal">Línea horizontal</option><option value="custom" disabled>Personalizada</option></select><input value={boardName} onChange={(e) => setBoardName(e.target.value)} aria-label="Nombre del diagrama"/><button className="he-primary" onClick={saveBoard}>Guardar diagrama</button><button onClick={() => useFormationPreset("base")}>Reiniciar</button>{savedBoard && <span>{savedBoard}</span>}</div>
      <div className="he-board-tabs"><button className={boardView === "formation" ? "active" : ""} onClick={() => setBoardView("formation")}>Formación</button><button className={boardView === "lineup" ? "active" : ""} onClick={() => setBoardView("lineup")}>Jugadores y reemplazos</button></div>
      {boards.filter((b) => b.side === side).length > 0 && <div className="he-saved-boards"><b>Diagramas guardados</b>{boards.filter((b) => b.side === side).map((board) => <button key={board.id} onClick={() => { setTokens(board.tokens || initialTokens); setFormationPreset(board.preset || "custom"); setLineups((prev) => ({ ...prev, [side]: { players: board.players || {}, replacements: board.replacements || {} } })); setBoardName(board.name); setSavedBoard("Diagrama cargado"); }}>{board.name}</button>)}</div>}
      {boardView === "formation" ? <><div className="he-court"><div className="he-playing-surface"><div className="he-court-border"/><div className="he-attack-line he-attack-front"/><div className="he-net"/></div>{tokens.map((token) => <button key={token.id} className="he-token" style={{ left: `${token.x}%`, top: `${token.y}%` }} onPointerMove={(e) => e.buttons === 1 && moveToken(token.id,e)} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); moveToken(token.id,e); }} title={`Posición ${token.id}`}>{token.id}</button>)}</div><p className="he-note">La red marca el frente: 4–3–2 adelante y 5–6–1 detrás de la línea de ataque. Arrastra los círculos para plantear la jugada.</p></> : <div className="he-lineup-workspace">
        <div className="he-lineup-court-wrap"><div className="he-lineup-hint">Arrastra un nombre a una posición o selecciónalo y luego toca el círculo.</div><div className="he-court"><div className="he-playing-surface"><div className="he-court-border"/><div className="he-attack-line he-attack-front"/><div className="he-net"/></div>{tokens.map((token) => { const assignedId = assignmentMode === "players" ? positionPlayers[token.id] : positionReplacements[token.id]; const assigned = sideRoster.find((player) => player.id === assignedId); const replacement = sideRoster.find((player) => player.id === positionReplacements[token.id]); const position = POSITIONS.find((item) => item.id === token.id); return <button type="button" key={token.id} className={`he-token he-lineup-token ${selectedLineupPlayer && assignmentMode === "players" ? "drop-ready" : ""}`} style={{ left: `${token.x}%`, top: `${token.y}%` }} onClick={() => selectedLineupPlayer && assignLineupPlayer(token.id, selectedLineupPlayer)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); assignLineupPlayer(token.id, e.dataTransfer.getData("text/player-id")); }} title={`${position?.role || "Posición"} ${token.id}`}><b>{token.id}</b><span>{assigned?.name || (assignmentMode === "players" ? "Añadir" : "Reemplazo")}</span>{assignmentMode === "players" && replacement && <small>↳ {replacement.name}</small>}</button>; })}</div><div className="he-lineup-roles">{POSITIONS.map((position) => <span key={position.id}><b>{position.id}</b> {position.role}</span>)}</div></div>
        <aside className="he-lineup-roster"><div className="he-assignment-switch"><button className={assignmentMode === "players" ? "active" : ""} onClick={() => { setAssignmentMode("players"); setSelectedLineupPlayer(""); }}>Titulares</button><button className={assignmentMode === "replacements" ? "active" : ""} onClick={() => { setAssignmentMode("replacements"); setSelectedLineupPlayer(""); }}>Reemplazos</button></div><h3>{assignmentMode === "players" ? "Plantel · titulares" : "Plantel · reemplazos"}</h3><p>{assignmentMode === "players" ? `${Object.keys(positionPlayers).length}/6 posiciones ocupadas` : "Asigna un relevo a cada posición"}</p><div className="he-player-drag-list">{sideRoster.map((player) => { const assignedPosition = Object.entries(assignmentMode === "players" ? positionPlayers : positionReplacements).find(([, id]) => id === player.id)?.[0]; const isSelected = selectedLineupPlayer === player.id; const unavailable = assignmentMode === "replacements" && Object.values(positionPlayers).includes(player.id); return <button type="button" draggable={!unavailable} disabled={unavailable} onDragStart={(e) => { e.dataTransfer.setData("text/player-id", player.id); e.dataTransfer.effectAllowed = "move"; setSelectedLineupPlayer(player.id); }} onClick={() => setSelectedLineupPlayer(isSelected ? "" : player.id)} className={`he-player-drag ${isSelected ? "selected" : ""}`} key={player.id} aria-pressed={isSelected}><span><b>{player.name}</b><small>{player.grade}</small></span><em>{unavailable ? "Ya titular" : assignedPosition ? `${assignmentMode === "players" ? "Pos." : "Relevo"} ${assignedPosition}` : "Arrastra"}</em></button>; })}</div><p className="he-note">Al soltar sobre una posición ocupada, las titulares intercambian puestos. En teléfono, toca primero a la jugadora o jugador y después el círculo.</p></aside>
      </div>}
      <p className="he-note">Los diagramas guardan la formación y las asignaciones de titulares/reemplazos en datos independientes, sin subir imágenes.</p>
    </section>}
    <footer className="he-footer">SABIS COSTA VERDE <span>·</span> HARPY EAGLES</footer>
  </main>;
}

const styles = `
.he-saved-boards{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 14px;color:#aaa;font-size:12px}.he-saved-boards button{border:1px solid #444;background:#151619;color:#eee;border-radius:20px;padding:7px 12px;cursor:pointer}.he-auth{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.he-auth button{border:1px solid #ff6a16;border-radius:30px;background:#ff6a1615;color:#ff9a58;padding:10px 13px;font-size:12px;font-weight:850;cursor:pointer}.he-auth>span{font-size:9px;color:#ff9a58;letter-spacing:.1em;font-weight:900}.he-auth small{max-width:200px;text-align:right;color:#ff9a58;font-size:10px}
`;
