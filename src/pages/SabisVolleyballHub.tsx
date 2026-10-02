import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { canScoreMatches } from "../auth/roles";
import { signInWithGoogle } from "../auth/googleSignIn";
import { auth } from "../firebase";

type Player = { id: string; name: string; grade: string; side: "women" | "men" };
type Match = {
  id: string; date: string; side: "women" | "men"; opponent: string;
  status: "scheduled" | "live" | "finished"; setsFor: number; setsAgainst: number;
  starters?: string[]; substitutions?: { out: string; in: string; set: number }[];
  stats?: Record<string, { attacks: number; blocks: number; assists: number; aces: number }>;
};
type BoardToken = { id: string; x: number; y: number };

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
const STORE = "sabis-volleyball-board-v1";
const initialTokens: BoardToken[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), x: [50, 26, 74, 26, 50, 74][i], y: [18, 38, 38, 68, 68, 68][i] }));

function MatchCard({ match, onChange }: { match: Match; onChange: (next: Match) => void }) {
  const [showSetup, setShowSetup] = useState(false);
  const [playerId, setPlayerId] = useState(PLAYERS.find((p) => p.side === match.side)?.id || "");
  const [outPlayerId, setOutPlayerId] = useState(match.starters?.[0] || "");
  const roster = PLAYERS.filter((p) => p.side === match.side);
  const selectedPlayer = roster.find((p) => p.id === playerId);
  const label = match.side === "women" ? "Harpy Eagles · Femenino" : "Harpy Eagles · Masculino";
  const stat = match.stats?.[playerId] || { attacks: 0, blocks: 0, assists: 0, aces: 0 };
  const addStat = (key: "attacks" | "blocks" | "assists" | "aces") => onChange({ ...match, stats: { ...match.stats, [playerId]: { ...stat, [key]: stat[key] + 1 } } });
  const toggleStarter = (id: string) => {
    const list = match.starters || [];
    onChange({ ...match, starters: list.includes(id) ? list.filter((v) => v !== id) : list.length < 6 ? [...list, id] : list });
  };
  const doSub = () => {
    const old = match.starters || [];
    const out = outPlayerId;
    if (!out || !old.includes(out) || old.includes(playerId)) return;
    onChange({ ...match, starters: old.map((id) => id === out ? playerId : id), substitutions: [...(match.substitutions || []), { out, in: playerId, set: 1 }] });
  };
  return <article className="he-match">
    <div className="he-match-top"><div><span className="he-kicker">{match.side === "women" ? "FEMENINO" : "MASCULINO"}</span><h3>{label} <span>vs</span> {match.opponent}</h3><p>2 de octubre de 2026 · Horario por confirmar</p></div><span className={`he-status ${match.status}`}>{match.status === "live" ? "EN VIVO" : match.status === "finished" ? "FINAL" : "PROGRAMADO"}</span></div>
    <div className="he-score"><b>{match.setsFor}</b><span>SETS</span><b>{match.setsAgainst}</b></div>
    <div className="he-actions"><button onClick={() => setShowSetup(!showSetup)}>{showSetup ? "Ocultar control" : "Alineación y estadísticas"}</button><button onClick={() => onChange({ ...match, status: match.status === "live" ? "finished" : "live" })}>{match.status === "live" ? "Finalizar" : "Iniciar partido"}</button></div>
    {showSetup && <div className="he-editor">
      <div className="he-lineup"><div><h4>Cuadro inicial <small>{(match.starters || []).length}/6</small></h4><p>Selecciona los seis titulares. La banca queda fuera del cuadro.</p></div><div className="he-roster">{roster.map((p) => <button key={p.id} className={(match.starters || []).includes(p.id) ? "selected" : ""} onClick={() => toggleStarter(p.id)}><span>{p.name}</span><small>{p.grade}</small></button>)}</div></div>
      <div className="he-score-tools"><h4>Marcador por sets</h4><div className="he-set-controls"><button onClick={() => onChange({ ...match, setsFor: Math.max(0, match.setsFor - 1) })}>−</button><b>{match.setsFor} : {match.setsAgainst}</b><button onClick={() => onChange({ ...match, setsFor: match.setsFor + 1 })}>+ SABIS</button><button onClick={() => onChange({ ...match, setsAgainst: match.setsAgainst + 1 })}>+ Rival</button><button onClick={() => onChange({ ...match, setsAgainst: Math.max(0, match.setsAgainst - 1) })}>−</button></div></div>
      <div className="he-score-tools"><h4>Registrar sustitución</h4><div className="he-stat-controls"><select aria-label="Jugador que sale" value={outPlayerId} onChange={(e) => setOutPlayerId(e.target.value)}><option value="">Sale…</option>{roster.filter((p) => (match.starters || []).includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.grade}</option>)}</select><select aria-label="Jugador que entra" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>{roster.filter((p) => !(match.starters || []).includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.grade}</option>)}</select><button onClick={doSub}>Guardar cambio</button></div>{(match.substitutions || []).length > 0 && <ul className="he-sub-list">{match.substitutions!.map((s, i) => <li key={`${s.out}-${i}`}>Set {s.set}: Entra {PLAYERS.find((p) => p.id === s.in)?.name} por {PLAYERS.find((p) => p.id === s.out)?.name}</li>)}</ul>}</div>
      <div className="he-score-tools"><h4>Estadísticas individuales · {selectedPlayer?.name}</h4><div className="he-stat-controls">{([["attacks","Ataques"],["blocks","Bloqueos"],["assists","Asistencias"],["aces","Aces"]] as const).map(([key,title]) => <button key={key} onClick={() => addStat(key)}>+ {title} ({stat[key]})</button>)}</div></div>
    </div>}
  </article>;
}

export default function SabisVolleyballHub() {
  const auth = useAuth();
  const canEdit = canScoreMatches(auth?.role);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"partidos" | "plantel" | "pizarra">("partidos");
  const [side, setSide] = useState<"women" | "men">("women");
  const [tokens, setTokens] = useState<BoardToken[]>(() => { try { return JSON.parse(localStorage.getItem(STORE) || "null") || initialTokens; } catch { return initialTokens; } });
  const [boardName, setBoardName] = useState("Rotación inicial");
  const [savedBoard, setSavedBoard] = useState("");
  const [boards, setBoards] = useState<{ id: string; name: string; side: "women" | "men"; tokens: BoardToken[] }[]>([]);
  const [authError, setAuthError] = useState("");

  useEffect(() => onSnapshot(collection(db, "sabisVolleyballMatches"), (snap) => {
    setMatches(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Match)));
    setReady(true);
  }, (error) => { console.error("SABIS volleyball matches failed to load", error); setReady(true); }), []);
  useEffect(() => onSnapshot(query(collection(db, "sabisVolleyballBoards"), orderBy("updatedAt", "desc")), (snap) => {
    setBoards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; side: "women" | "men"; tokens: BoardToken[] })));
  }, (error) => console.warn("Could not load saved strategy boards", error)), []);

  const visibleMatches = useMemo(() => (matches.length ? matches : MATCHES).sort((a,b) => a.date.localeCompare(b.date)), [matches]);
  const updateMatch = async (match: Match) => {
    if (!canEdit) return;
    try { await setDoc(doc(db, "sabisVolleyballMatches", match.id), { ...match, updatedAt: serverTimestamp() }, { merge: true }); }
    catch (error) { console.error("Could not save volleyball match", error); window.alert("No se pudo guardar. Verifica tu acceso de administrador o scorekeeper."); }
  };
  const createFixtures = async () => {
    for (const fixture of MATCHES.filter((item) => !matches.some((match) => match.id === item.id))) await updateMatch(fixture);
  };
  const saveBoard = async () => {
    const payload = { name: boardName.trim() || "Diagrama", side, tokens, updatedAt: serverTimestamp() };
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
    {tab === "pizarra" && <section className="he-section"><div className="he-section-title"><div><span className="he-kicker">ESTRATEGIA</span><h2>Tablero magnético</h2></div><div className="he-switch"><button className={side === "women" ? "active" : ""} onClick={() => setSide("women")}>Femenino</button><button className={side === "men" ? "active" : ""} onClick={() => setSide("men")}>Masculino</button></div></div><div className="he-board-tools"><input value={boardName} onChange={(e) => setBoardName(e.target.value)} aria-label="Nombre del diagrama"/><button className="he-primary" onClick={saveBoard}>Guardar diagrama</button><button onClick={() => setTokens(initialTokens)}>Reiniciar</button>{savedBoard && <span>{savedBoard}</span>}</div>{boards.filter((b) => b.side === side).length > 0 && <div className="he-saved-boards"><b>Diagramas guardados</b>{boards.filter((b) => b.side === side).map((board) => <button key={board.id} onClick={() => { setTokens(board.tokens || initialTokens); setBoardName(board.name); setSavedBoard("Diagrama cargado"); }}>{board.name}</button>)}</div>}<div className="he-court"><div className="he-net"/><div className="he-center-line"/>{tokens.map((token, i) => <button key={token.id} className="he-token" style={{ left: `${token.x}%`, top: `${token.y}%` }} onPointerMove={(e) => e.buttons === 1 && moveToken(token.id,e)} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); moveToken(token.id,e); }} title="Arrastra para mover">{i + 1}</button>)}</div><p className="he-note">Arrastra los seis círculos para organizar la formación. Los diagramas se guardan como coordenadas y no requieren Firebase Storage/Blaze.</p></section>}
    <footer className="he-footer">SABIS COSTA VERDE <span>·</span> HARPY EAGLES</footer>
  </main>;
}

const styles = `
.he-saved-boards{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 14px;color:#aaa;font-size:12px}.he-saved-boards button{border:1px solid #444;background:#151619;color:#eee;border-radius:20px;padding:7px 12px;cursor:pointer}.he-auth{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.he-auth button{border:1px solid #ff6a16;border-radius:30px;background:#ff6a1615;color:#ff9a58;padding:10px 13px;font-size:12px;font-weight:850;cursor:pointer}.he-auth>span{font-size:9px;color:#ff9a58;letter-spacing:.1em;font-weight:900}.he-auth small{max-width:200px;text-align:right;color:#ff9a58;font-size:10px}
`;
