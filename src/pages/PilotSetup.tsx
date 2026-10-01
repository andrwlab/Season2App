import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { signInWithGoogle } from "../auth/googleSignIn";
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { canScoreMatches, isAdminRole } from "../auth/roles";
import { getFirebaseErrorCode } from "../auth/errors";
import PilotAudienceAnalytics from "../components/PilotAudienceAnalytics";
import PilotTeamManager from "../components/PilotTeamManager";
import PilotFootballBracketControl from "../components/PilotFootballBracketControl";
import { db } from "../firebase";
import { FOOTBALL_2026_TOURNAMENT_ID, footballMatchDate, normalizeFootballMatch, normalizeFootballTeam, PilotTeam } from "../pilot/footballTournament";
import { parseRosterText, PilotPlayer, rosterToText } from "../pilot/players";

const clampMinutes = (value: number) => Math.min(90, Math.max(1, Number(value) || 10));

type PilotTournamentDoc = {
  tournamentId: string;
  name: string;
  sport: "football";
  defaultHalfMinutes: number;
  teams?: PilotTeam[];
};

type PilotMatchSummary = {
  matchday?: number;
  scheduledDate?: string | null;
  matchId: string;
  tournamentId: string;
  homeName: string;
  awayName: string;
  homePlayers?: PilotPlayer[];
  awayPlayers?: PilotPlayer[];
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: string;
  stage?: "GROUP" | "SEMIFINAL" | "FINAL";
  tieId?: "SF1" | "SF2";
  leg?: 1 | 2;
  clockStatus?: "NOT_STARTED" | "RUNNING" | "PAUSED" | "ENDED";
  periodDurationMs?: number;
};

type DestructiveMatchAction = {
  kind: "RESET" | "DELETE";
  match: PilotMatchSummary;
  confirmationCode: string;
};
type AdminView = "overview" | "matches" | "teams" | "settings";

const createConfirmationCode = () => {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
};
const formatAdminDate = (date: string | null) => date
  ? new Date(`${date}T12:00:00Z`).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  : "Fecha por confirmar";

const PilotSetup = () => {
  const { tournamentId = "pilot0" } = useParams();
  const auth = getAuth();
  const authState = useAuth();
  const user = authState?.user ?? null;
  const role = authState?.role ?? null;
  const authLoading = authState?.loading ?? true;
  const canOperate = canScoreMatches(role);
  const isAdmin = isAdminRole(role);
  const tournamentRef = useMemo(() => doc(db, "pilotTournaments", tournamentId), [tournamentId]);

  const [tournament, setTournament] = useState<PilotTournamentDoc | null>(null);
  const [matches, setMatches] = useState<PilotMatchSummary[]>([]);
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [name, setName] = useState("Micro Football Tournament");
  const [defaultHalfMinutes, setDefaultHalfMinutes] = useState(10);
  const [matchId, setMatchId] = useState("match-001");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [homeRosterText, setHomeRosterText] = useState("");
  const [awayRosterText, setAwayRosterText] = useState("");
  const [halfMinutes, setHalfMinutes] = useState(10);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editHome, setEditHome] = useState("");
  const [editAway, setEditAway] = useState("");
  const [editHomeRosterText, setEditHomeRosterText] = useState("");
  const [editAwayRosterText, setEditAwayRosterText] = useState("");
  const [editMinutes, setEditMinutes] = useState(10);
  const [editDate, setEditDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveMatchAction | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const upcomingMatches = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return matches
    .filter((item) => {
      if (item.status === "LIVE") return true;
      const date = footballMatchDate(item);
      return item.status === "READY" && (!date || date >= today);
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "LIVE" ? -1 : b.status === "LIVE" ? 1 : 0;
      const aDate = footballMatchDate(a);
      const bDate = footballMatchDate(b);
      if (aDate && bDate) return aDate.localeCompare(bDate);
      if (aDate) return -1;
      if (bDate) return 1;
      return a.matchId.localeCompare(b.matchId, undefined, { numeric: true });
    })
    .slice(0, 2);
  }, [matches]);

  useEffect(() => {
    if (authLoading || !user || !canOperate) return undefined;

    const unsubscribeTournament = onSnapshot(tournamentRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as PilotTournamentDoc;
      const normalizedTeams = data.teams?.map(normalizeFootballTeam);
      setTournament({ ...data, teams: normalizedTeams });
      // Persist the roster correction for the active tournament as well as
      // normalizing it in the UI, so new matches use the corrected identities.
      if (isAdmin && data.teams && normalizedTeams && JSON.stringify(data.teams) !== JSON.stringify(normalizedTeams)) {
        void setDoc(tournamentRef, { teams: normalizedTeams, updatedAt: serverTimestamp() }, { merge: true }).catch((error) => {
          console.error("Failed to persist football roster correction", error);
        });
      }
      setName(tournamentId === FOOTBALL_2026_TOURNAMENT_ID ? "Champions League" : data.name || tournamentId);
      setDefaultHalfMinutes(data.defaultHalfMinutes || 10);
      setHalfMinutes(data.defaultHalfMinutes || 10);
    });

    const matchesQuery = query(collection(db, "pilotMatches"), where("tournamentId", "==", tournamentId));
    const unsubscribeMatches = onSnapshot(matchesQuery, (snap) => {
      const next = snap.docs
        .map((item) => normalizeFootballMatch(item.data() as PilotMatchSummary))
        .sort((a, b) => a.matchId.localeCompare(b.matchId, undefined, { numeric: true }));
      setMatches(next);
      const usedNumbers = new Set(next.map((item) => Number(item.matchId.match(/(\d+)$/)?.[1] ?? 0)));
      let nextNumber = 1;
      while (usedNumbers.has(nextNumber)) nextNumber += 1;
      setMatchId(`match-${String(nextNumber).padStart(3, "0")}`);
    });

    return () => {
      unsubscribeTournament();
      unsubscribeMatches();
    };
  }, [authLoading, canOperate, isAdmin, tournamentId, tournamentRef, user]);

  const login = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle(auth);
    } catch (err: unknown) {
      console.error("Pilot setup sign-in failed", err);
      const code = getFirebaseErrorCode(err);
      if (code === "auth/popup-blocked") {
        setAuthError("Allow pop-ups for this site, then tap Sign in again.");
        return;
      }
      if (code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in was closed before it finished.");
        return;
      }
      if (code === "auth/unauthorized-domain") {
        setAuthError(`Google sign-in is not enabled for ${window.location.hostname}.`);
        return;
      }
      setAuthError("Could not sign in. Try again, or open this page in Safari/Chrome.");
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const saveTournament = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const safeMinutes = clampMinutes(defaultHalfMinutes);
      await setDoc(
        tournamentRef,
        {
          tournamentId,
          name: name.trim() || tournamentId,
          sport: "football",
          defaultHalfMinutes: safeMinutes,
          updatedAt: serverTimestamp(),
          ...(tournament ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
      setDefaultHalfMinutes(safeMinutes);
      setHalfMinutes(safeMinutes);
      setMessage("Tournament settings saved.");
    } catch (err) {
      console.error("Pilot tournament setup failed", err);
      setError("Could not save tournament settings. This page requires an admin account.");
    } finally {
      setBusy(false);
    }
  };

  const createMatch = async (event: FormEvent) => {
    event.preventDefault();
    const cleanMatchId = matchId.trim();
    const cleanHome = homeName.trim();
    const cleanAway = awayName.trim();
    if (!cleanMatchId || !cleanHome || !cleanAway) {
      setError("Match ID, Home and Away are required.");
      return;
    }
    if (matches.some((item) => item.matchId === cleanMatchId)) {
      setError("That Match ID already exists. Edit the existing match or use another ID.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const safeMinutes = clampMinutes(halfMinutes);
      const pilotMatchId = `${tournamentId}__${cleanMatchId}`;
      const homePlayers = parseRosterText(homeRosterText, "HOME");
      const awayPlayers = parseRosterText(awayRosterText, "AWAY");
      await setDoc(doc(db, "pilotMatches", pilotMatchId), {
        tournamentId,
        matchId: cleanMatchId,
        homeName: cleanHome,
        awayName: cleanAway,
        homePlayers,
        awayPlayers,
        scoreHome: 0,
        scoreAway: 0,
        shotsHome: 0,
        shotsAway: 0,
        foulsHome: 0,
        foulsAway: 0,
        yellowHome: 0,
        yellowAway: 0,
        redHome: 0,
        redAway: 0,
        penaltyHome: 0,
        penaltyAway: 0,
        penaltyAttemptsHome: 0,
        penaltyAttemptsAway: 0,
        status: "READY",
        phase: "FIRST_HALF",
        clockStatus: "NOT_STARTED",
        phaseElapsedBaseMs: 0,
        runningSinceMs: null,
        periodDurationMs: safeMinutes * 60 * 1000,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setHomeName("");
      setAwayName("");
      setHomeRosterText("");
      setAwayRosterText("");
      setHalfMinutes(tournament?.defaultHalfMinutes || defaultHalfMinutes || 10);
      setMessage(`${cleanMatchId} created with ${homePlayers.length + awayPlayers.length} players.`);
    } catch (err) {
      console.error("Pilot match creation failed", err);
      setError("Could not create the match. This page requires admin or scorekeeper access.");
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (item: PilotMatchSummary) => {
    setEditDate(footballMatchDate(item) || "");
    setEditingMatchId(item.matchId);
    setEditHome(item.homeName);
    setEditAway(item.awayName);
    setEditHomeRosterText(rosterToText(item.homePlayers));
    setEditAwayRosterText(rosterToText(item.awayPlayers));
    setEditMinutes(Math.round((item.periodDurationMs || 600000) / 60000));
    setError(null);
    setMessage(null);
  };

  const saveMatchEdit = async (item: PilotMatchSummary) => {
    const cleanHome = editHome.trim();
    const cleanAway = editAway.trim();
    if (!cleanHome || !cleanAway) {
      setError("Home and Away names are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updates: Record<string, unknown> = {
        scheduledDate: editDate || null,
        homeName: cleanHome,
        awayName: cleanAway,
        updatedAt: serverTimestamp(),
      };
      if ((item.clockStatus ?? "NOT_STARTED") === "NOT_STARTED") {
        updates.periodDurationMs = clampMinutes(editMinutes) * 60 * 1000;
        updates.homePlayers = parseRosterText(editHomeRosterText, "HOME");
        updates.awayPlayers = parseRosterText(editAwayRosterText, "AWAY");
      }
      await updateDoc(doc(db, "pilotMatches", `${tournamentId}__${item.matchId}`), updates);
      setEditingMatchId(null);
      setMessage(`${item.matchId} updated.`);
    } catch (err) {
      console.error("Pilot match edit failed", err);
      setError("Could not update the match.");
    } finally {
      setBusy(false);
    }
  };

  const openDestructiveAction = (kind: DestructiveMatchAction["kind"], match: PilotMatchSummary) => {
    setDestructiveAction({ kind, match, confirmationCode: createConfirmationCode() });
    setConfirmationInput("");
    setError(null);
    setMessage(null);
  };

  const closeDestructiveAction = () => {
    if (busy) return;
    setDestructiveAction(null);
    setConfirmationInput("");
  };

  const getRelatedMatchData = async (pilotMatchId: string) => {
    const [eventsSnapshot, momentsSnapshot] = await Promise.all([
      getDocs(query(collection(db, "pilotEvents"), where("pilotMatchId", "==", pilotMatchId))),
      getDocs(query(collection(db, "pilotMoments"), where("pilotMatchId", "==", pilotMatchId))),
    ]);
    return { eventsSnapshot, momentsSnapshot };
  };

  const deleteDocuments = async (refs: Array<ReturnType<typeof doc>>) => {
    for (let index = 0; index < refs.length; index += 450) {
      const batch = writeBatch(db);
      refs.slice(index, index + 450).forEach((documentRef) => batch.delete(documentRef));
      await batch.commit();
    }
  };

  const resetMatch = async (item: PilotMatchSummary) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const pilotMatchId = `${tournamentId}__${item.matchId}`;
      const { eventsSnapshot, momentsSnapshot } = await getRelatedMatchData(pilotMatchId);
      await deleteDocuments([
        ...eventsSnapshot.docs.map((eventDoc) => eventDoc.ref),
        ...momentsSnapshot.docs.map((momentDoc) => momentDoc.ref),
      ]);
      await updateDoc(doc(db, "pilotMatches", pilotMatchId), {
        scoreHome: 0,
        scoreAway: 0,
        shotsHome: 0,
        shotsAway: 0,
        foulsHome: 0,
        foulsAway: 0,
        yellowHome: 0,
        yellowAway: 0,
        redHome: 0,
        redAway: 0,
        penaltyHome: 0,
        penaltyAway: 0,
        penaltyAttemptsHome: 0,
        penaltyAttemptsAway: 0,
        status: "READY",
        phase: "FIRST_HALF",
        clockStatus: "NOT_STARTED",
        phaseElapsedBaseMs: 0,
        runningSinceMs: null,
        completedMatchClockMs: null,
        lineupsConfirmed: false,
        homeStarterIds: [],
        awayStarterIds: [],
        currentHomePlayerIds: [],
        currentAwayPlayerIds: [],
        substitutionCountHome: 0,
        substitutionCountAway: 0,
        lastEvent: null,
        lastSubstitution: null,
        updatedAt: serverTimestamp(),
      });

      setDestructiveAction(null);
      setConfirmationInput("");
      setMessage(`${item.homeName} vs ${item.awayName} reset. The match is ready to start again.`);
    } catch (err) {
      console.error("Pilot match reset failed", err);
      setError("Could not finish resetting the match. Refresh and try again before continuing.");
    } finally {
      setBusy(false);
    }
  };

  const deleteMatch = async (item: PilotMatchSummary) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const pilotMatchId = `${tournamentId}__${item.matchId}`;
      const { eventsSnapshot, momentsSnapshot } = await getRelatedMatchData(pilotMatchId);
      await deleteDocuments([
        ...eventsSnapshot.docs.map((eventDoc) => eventDoc.ref),
        ...momentsSnapshot.docs.map((momentDoc) => momentDoc.ref),
        doc(db, "pilotMatches", pilotMatchId),
      ]);

      if (editingMatchId === item.matchId) setEditingMatchId(null);
      setDestructiveAction(null);
      setConfirmationInput("");
      setMessage(`${item.homeName} vs ${item.awayName} deleted.`);
    } catch (err) {
      console.error("Pilot match deletion failed", err);
      setError("Could not delete the match.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDestructiveAction = async () => {
    if (!destructiveAction || confirmationInput !== destructiveAction.confirmationCode || busy) return;
    if (destructiveAction.kind === "RESET") await resetMatch(destructiveAction.match);
    else await deleteMatch(destructiveAction.match);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Pilot 0 · Setup</p><p className="mt-4 text-sm text-slate-400">Checking tournament access…</p></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <main className="mx-auto max-w-md space-y-5">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Pilot 0 · Control</p><h1 className="mt-2 text-3xl font-black">Tournament Setup</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Sign in here to create matches and keep score.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><button onClick={login} className="w-full rounded-xl bg-cyan-300 px-4 py-4 font-black text-slate-950">SIGN IN WITH GOOGLE</button>{authError && <p className="mt-3 text-sm font-semibold text-red-300">{authError}</p>}</div>
          <div className="grid grid-cols-2 gap-2"><Link to="/pilot" className="rounded-xl bg-slate-800 px-3 py-3 text-center text-xs font-black">ALL TOURNAMENTS</Link><Link to={`/live/${tournamentId}`} className="rounded-xl bg-cyan-300/10 px-3 py-3 text-center text-xs font-black text-cyan-200">PUBLIC HUB</Link></div>
        </main>
      </div>
    );
  }

  if (!canOperate) {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><main className="mx-auto max-w-md rounded-3xl border border-red-400/20 bg-red-500/[0.06] p-6 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Pilot 0 · Access blocked</p><h1 className="mt-3 text-2xl font-black">Scorekeeper access required</h1><p className="mt-2 text-sm text-slate-400">Signed in as {user.email || user.displayName || "this account"}. Ask an administrator to assign the scorekeeper role.</p><p className="mt-3 break-all font-mono text-[0.65rem] text-slate-500">UID: {user.uid}</p><button onClick={logout} className="mt-5 w-full rounded-xl bg-slate-800 px-4 py-3 font-black">SIGN OUT</button></main></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Pilot 0 · {isAdmin ? "Setup" : "Scorekeeper"}</p><h1 className="mt-2 text-3xl font-black">{tournament?.name || name || tournamentId}</h1><p className="mt-1 text-sm text-slate-500">{tournamentId}</p></div><button onClick={logout} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-400">SIGN OUT</button></div>
          <div className="grid grid-cols-2 gap-2 sm:flex"><Link to="/pilot" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-xs font-black text-slate-300">← ALL TOURNAMENTS</Link><Link to={`/live/${tournamentId}`} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-center text-xs font-black text-cyan-200">PUBLIC HUB →</Link></div>
        </header>

        <nav aria-label="Tournament management" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["overview", "Inicio"], ["matches", "Partidos"],
            ...(isAdmin ? [["teams", "Equipos"], ["settings", "Configuración"]] : []),
          ] as Array<[AdminView, string]>).map(([view, label]) => <button key={view} type="button" onClick={() => setActiveView(view)} aria-current={activeView === view ? "page" : undefined} className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-black transition ${activeView === view ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07]"}`}>{label}</button>)}
        </nav>

        {activeView === "overview" && <section className="space-y-3">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">Panel del torneo</p><h2 className="mt-1 text-xl font-black">Próximos partidos</h2></div><button type="button" onClick={() => setActiveView("matches")} className="text-xs font-black text-cyan-200">Ver todos →</button></div>
          {upcomingMatches.length ? <div className="space-y-3">{upcomingMatches.map((item) => <article key={item.matchId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-wider ${item.status === "LIVE" ? "bg-red-400/15 text-red-200" : "bg-cyan-300/10 text-cyan-200"}`}>{item.status === "LIVE" ? "En vivo" : "Próximo"}</span><span className="text-xs font-semibold text-slate-400">{formatAdminDate(footballMatchDate(item))}</span></div>
            <h3 className="mt-3 text-base font-black">{item.homeName} <span className="text-white/30">vs</span> {item.awayName}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2"><Link to={`/scorer/${tournamentId}/${item.matchId}`} className="rounded-xl bg-cyan-300 px-3 py-3 text-center text-xs font-black text-slate-950">Abrir marcador</Link><Link to={`/live/${tournamentId}/match/${item.matchId}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-xs font-black text-slate-200">Ver partido</Link></div>
          </article>)}</div> : <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">No hay partidos pendientes. Entra en Partidos para crear o editar encuentros.</div>}
        </section>}

        {activeView === "settings" && isAdmin && <div className="space-y-5">
        <PilotAudienceAnalytics tournamentId={tournamentId} />
        <form onSubmit={saveTournament} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tournament</p><p className="mt-1 text-sm text-slate-500">Settings for this tournament only.</p></div>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Display name</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Default minutes per half</span><div className="grid grid-cols-[48px_1fr_48px] gap-2"><button type="button" onClick={() => setDefaultHalfMinutes((v) => clampMinutes(v - 1))} className="rounded-xl bg-slate-800 text-xl font-black">−</button><input type="number" min={1} max={90} value={defaultHalfMinutes} onChange={(e) => setDefaultHalfMinutes(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-lg font-black outline-none focus:border-cyan-400" /><button type="button" onClick={() => setDefaultHalfMinutes((v) => clampMinutes(v + 1))} className="rounded-xl bg-slate-800 text-xl font-black">+</button></div></label>
          <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-50">SAVE TOURNAMENT SETTINGS</button>
        </form>

        {tournament?.sport === "football" && (tournament?.teams?.length ?? 0) === 4 && <PilotFootballBracketControl
          tournamentId={tournamentId}
          teams={tournament!.teams!}
          matches={matches}
          suggestedSeeds={tournament!.teams!.map((team) => team.teamId)}
        />}
        </div>}

        {activeView === "teams" && isAdmin && (tournament?.teams?.length ?? 0) > 0 && <PilotTeamManager tournamentId={tournamentId} teams={tournament!.teams!} />}

        {activeView === "matches" && <>
        <form onSubmit={createMatch} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Add match</p><p className="mt-1 text-sm text-slate-500">Create a match and paste each roster with one player per line.</p></div>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Match ID</span><input value={matchId} onChange={(e) => setMatchId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Home</span><input value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="Team A" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" /></label><label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Home roster</span><textarea rows={8} value={homeRosterText} onChange={(e) => setHomeRosterText(e.target.value)} placeholder={'Player 1\nPlayer 2\nPlayer 3'} className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-400" /></label></div>
            <div className="space-y-2"><label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Away</span><input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="Team B" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" /></label><label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Away roster</span><textarea rows={8} value={awayRosterText} onChange={(e) => setAwayRosterText(e.target.value)} placeholder={'Player 1\nPlayer 2\nPlayer 3'} className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-400" /></label></div>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Minutes per half</span><div className="grid grid-cols-[48px_1fr_48px] gap-2"><button type="button" onClick={() => setHalfMinutes((v) => clampMinutes(v - 1))} className="rounded-xl bg-slate-800 text-xl font-black">−</button><input type="number" min={1} max={90} value={halfMinutes} onChange={(e) => setHalfMinutes(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-lg font-black outline-none focus:border-cyan-400" /><button type="button" onClick={() => setHalfMinutes((v) => clampMinutes(v + 1))} className="rounded-xl bg-slate-800 text-xl font-black">+</button></div></label>
          <button disabled={busy} className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-50">CREATE MATCH</button>
        </form>

        {(message || error) && <div className={`rounded-xl border p-3 text-sm font-semibold ${error ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || message}</div>}

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Configured matches</h2><span className="text-xs font-bold text-slate-500">{matches.length}</span></div>
          {matches.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">No matches yet.</div> : (
            <div className="space-y-3">
              {matches.map((item) => {
                const isEditing = editingMatchId === item.matchId;
                const canEditPregame = (item.clockStatus ?? "NOT_STARTED") === "NOT_STARTED";
                return (
                  <div key={item.matchId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">Edit {item.matchId}</p><button type="button" onClick={() => setEditingMatchId(null)} className="text-xs font-black text-slate-500">CANCEL</button></div>
                        <div className="grid gap-2 sm:grid-cols-2"><input value={editHome} onChange={(e) => setEditHome(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 outline-none focus:border-cyan-300" /><input value={editAway} onChange={(e) => setEditAway(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 outline-none focus:border-cyan-300" /></div>
                        <div className="grid gap-2 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-bold text-slate-500">Home roster {canEditPregame ? "" : "(locked after kickoff)"}</span><textarea rows={7} disabled={!canEditPregame} value={editHomeRosterText} onChange={(e) => setEditHomeRosterText(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm leading-6 disabled:opacity-40" /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">Away roster {canEditPregame ? "" : "(locked after kickoff)"}</span><textarea rows={7} disabled={!canEditPregame} value={editAwayRosterText} onChange={(e) => setEditAwayRosterText(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm leading-6 disabled:opacity-40" /></label></div>
                        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Minutes per half {canEditPregame ? "" : "(locked after kickoff)"}</span><input type="number" min={1} max={90} disabled={!canEditPregame} value={editMinutes} onChange={(e) => setEditMinutes(clampMinutes(Number(e.target.value)))} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-center font-black disabled:opacity-40" /></label>
                        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-300">Fecha del partido (opcional)</span><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"/><span className="mt-1 block text-xs text-slate-400">Si queda vacía, el calendario mostrará «Fecha por confirmar».</span></label>
                        <button type="button" disabled={busy} onClick={() => saveMatchEdit(item)} className="w-full rounded-xl bg-cyan-300 px-3 py-3 font-black text-slate-950 disabled:opacity-40">SAVE MATCH</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{item.matchId} · {item.status}</p><p className="mt-1 truncate font-black">{item.homeName} vs {item.awayName}</p><p className="mt-1 text-xs text-slate-500">{Math.round((item.periodDurationMs || 600000) / 60000)} min per half · {item.scoreHome ?? 0}–{item.scoreAway ?? 0}</p><p className="mt-1 text-xs font-semibold text-cyan-200/70">{item.homePlayers?.length ?? 0} + {item.awayPlayers?.length ?? 0} players</p></div><div className="flex shrink-0 gap-2"><Link to={`/scorer/${tournamentId}/${item.matchId}`} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black">SCORER</Link><Link to={`/live/${tournamentId}/match/${item.matchId}`} className="rounded-lg bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-200">LIVE</Link></div></div>
                        <div className={`mt-3 grid gap-2 border-t border-white/5 pt-3 ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}><button type="button" onClick={() => beginEdit(item)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300">EDIT</button>{isAdmin && <button type="button" disabled={busy} onClick={() => openDestructiveAction("RESET", item)} className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-200 disabled:opacity-40">RESET</button>}{isAdmin && <button type="button" disabled={busy} onClick={() => openDestructiveAction("DELETE", item)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 disabled:opacity-40">DELETE</button>}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </>}
      </main>
      {destructiveAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="destructive-action-title">
          <div className={`w-full max-w-md rounded-3xl border p-5 shadow-2xl ${destructiveAction.kind === "DELETE" ? "border-red-400/30 bg-slate-950" : "border-amber-300/30 bg-slate-950"}`}>
            <p className={`text-[0.65rem] font-black uppercase tracking-[0.22em] ${destructiveAction.kind === "DELETE" ? "text-red-300" : "text-amber-200"}`}>Protected action · Step 2 of 2</p>
            <h2 id="destructive-action-title" className="mt-2 text-2xl font-black">{destructiveAction.kind === "DELETE" ? "Delete match?" : "Reset match?"}</h2>
            <p className="mt-2 text-sm font-bold text-white">{destructiveAction.match.homeName} vs {destructiveAction.match.awayName}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{destructiveAction.kind === "DELETE" ? "The match, its result, events and moments will be permanently removed." : "The matchup and rosters will remain, but its result, clock, lineups, events, substitutions and moments will be cleared."}</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Copy these numbers</p>
              <p className="mt-2 select-all font-mono text-4xl font-black tracking-[0.2em] text-white" aria-label={`Confirmation code ${destructiveAction.confirmationCode}`}>{destructiveAction.confirmationCode}</p>
            </div>
            <label className="mt-4 block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Enter the six digits</span><input autoFocus autoComplete="off" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={confirmationInput} onChange={(event) => setConfirmationInput(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.2em] outline-none focus:border-cyan-300" /></label>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={busy} onClick={closeDestructiveAction} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-black text-slate-300 disabled:opacity-40">CANCEL</button><button type="button" disabled={busy || confirmationInput !== destructiveAction.confirmationCode} onClick={confirmDestructiveAction} className={`rounded-xl px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30 ${destructiveAction.kind === "DELETE" ? "bg-red-300" : "bg-amber-300"}`}>{busy ? "WORKING…" : destructiveAction.kind === "DELETE" ? "DELETE FOREVER" : "RESET MATCH"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PilotSetup;
