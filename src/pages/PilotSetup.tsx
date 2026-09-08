import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { parseRosterText, PilotPlayer, rosterToText } from "../pilot/players";

const clampMinutes = (value: number) => Math.min(90, Math.max(1, Number(value) || 10));

type PilotTournamentDoc = {
  tournamentId: string;
  name: string;
  sport: "football";
  defaultHalfMinutes: number;
};

type PilotMatchSummary = {
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
  clockStatus?: "NOT_STARTED" | "RUNNING" | "PAUSED" | "ENDED";
  periodDurationMs?: number;
};

const PilotSetup = () => {
  const { tournamentId = "pilot0" } = useParams();
  const auth = getAuth();
  const authState = useAuth();
  const user = authState?.user ?? null;
  const role = authState?.role ?? null;
  const authLoading = authState?.loading ?? true;
  const tournamentRef = useMemo(() => doc(db, "pilotTournaments", tournamentId), [tournamentId]);

  const [tournament, setTournament] = useState<PilotTournamentDoc | null>(null);
  const [matches, setMatches] = useState<PilotMatchSummary[]>([]);
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || role !== "admin") return undefined;

    const unsubscribeTournament = onSnapshot(tournamentRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as PilotTournamentDoc;
      setTournament(data);
      setName(data.name || tournamentId);
      setDefaultHalfMinutes(data.defaultHalfMinutes || 10);
      setHalfMinutes(data.defaultHalfMinutes || 10);
    });

    const matchesQuery = query(collection(db, "pilotMatches"), where("tournamentId", "==", tournamentId));
    const unsubscribeMatches = onSnapshot(matchesQuery, (snap) => {
      const next = snap.docs
        .map((item) => item.data() as PilotMatchSummary)
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
  }, [authLoading, role, tournamentId, tournamentRef, user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Pilot setup sign-in failed", err);
      const code = err?.code as string | undefined;
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
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
      setError("Could not create the match. This page requires an admin account.");
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (item: PilotMatchSummary) => {
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

  const deleteMatch = async (item: PilotMatchSummary) => {
    const confirmed = window.confirm(`Delete ${item.matchId}: ${item.homeName} vs ${item.awayName}? This also removes its live event and moment metadata.`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const pilotMatchId = `${tournamentId}__${item.matchId}`;
      const [eventsSnapshot, momentsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "pilotEvents"), where("pilotMatchId", "==", pilotMatchId))),
        getDocs(query(collection(db, "pilotMoments"), where("pilotMatchId", "==", pilotMatchId))),
      ]);

      const refs = [
        doc(db, "pilotMatches", pilotMatchId),
        ...eventsSnapshot.docs.map((eventDoc) => eventDoc.ref),
        ...momentsSnapshot.docs.map((momentDoc) => momentDoc.ref),
      ];

      for (let index = 0; index < refs.length; index += 450) {
        const batch = writeBatch(db);
        refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      if (editingMatchId === item.matchId) setEditingMatchId(null);
      setMessage(`${item.matchId} deleted.`);
    } catch (err) {
      console.error("Pilot match deletion failed", err);
      setError("Could not delete the match.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Pilot 0 · Setup</p><p className="mt-4 text-sm text-slate-400">Checking admin session…</p></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <main className="mx-auto max-w-md space-y-5">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Pilot 0 · Admin</p><h1 className="mt-2 text-3xl font-black">Tournament Setup</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Sign in here to configure this tournament.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><button onClick={login} className="w-full rounded-xl bg-cyan-300 px-4 py-4 font-black text-slate-950">SIGN IN WITH GOOGLE</button>{authError && <p className="mt-3 text-sm font-semibold text-red-300">{authError}</p>}</div>
          <div className="grid grid-cols-2 gap-2"><Link to="/pilot" className="rounded-xl bg-slate-800 px-3 py-3 text-center text-xs font-black">ALL TOURNAMENTS</Link><Link to={`/live/${tournamentId}`} className="rounded-xl bg-cyan-300/10 px-3 py-3 text-center text-xs font-black text-cyan-200">PUBLIC HUB</Link></div>
        </main>
      </div>
    );
  }

  if (role !== "admin") {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><main className="mx-auto max-w-md rounded-3xl border border-red-400/20 bg-red-500/[0.06] p-6 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">Pilot 0 · Access blocked</p><h1 className="mt-3 text-2xl font-black">Admin account required</h1><p className="mt-2 text-sm text-slate-400">Signed in as {user.email || user.displayName || "this account"}, but this account is not an admin.</p><button onClick={logout} className="mt-5 w-full rounded-xl bg-slate-800 px-4 py-3 font-black">SIGN OUT</button></main></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Pilot 0 · Setup</p><h1 className="mt-2 text-3xl font-black">{tournament?.name || name || tournamentId}</h1><p className="mt-1 text-sm text-slate-500">{tournamentId}</p></div><button onClick={logout} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-400">SIGN OUT</button></div>
          <div className="grid grid-cols-2 gap-2 sm:flex"><Link to="/pilot" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-xs font-black text-slate-300">← ALL TOURNAMENTS</Link><Link to={`/live/${tournamentId}`} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-center text-xs font-black text-cyan-200">PUBLIC HUB →</Link></div>
        </header>

        <form onSubmit={saveTournament} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tournament</p><p className="mt-1 text-sm text-slate-500">Settings for this tournament only.</p></div>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Display name</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Default minutes per half</span><div className="grid grid-cols-[48px_1fr_48px] gap-2"><button type="button" onClick={() => setDefaultHalfMinutes((v) => clampMinutes(v - 1))} className="rounded-xl bg-slate-800 text-xl font-black">−</button><input type="number" min={1} max={90} value={defaultHalfMinutes} onChange={(e) => setDefaultHalfMinutes(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-lg font-black outline-none focus:border-cyan-400" /><button type="button" onClick={() => setDefaultHalfMinutes((v) => clampMinutes(v + 1))} className="rounded-xl bg-slate-800 text-xl font-black">+</button></div></label>
          <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-50">SAVE TOURNAMENT SETTINGS</button>
        </form>

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
                        <button type="button" disabled={busy} onClick={() => saveMatchEdit(item)} className="w-full rounded-xl bg-cyan-300 px-3 py-3 font-black text-slate-950 disabled:opacity-40">SAVE MATCH</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{item.matchId} · {item.status}</p><p className="mt-1 truncate font-black">{item.homeName} vs {item.awayName}</p><p className="mt-1 text-xs text-slate-500">{Math.round((item.periodDurationMs || 600000) / 60000)} min per half · {item.scoreHome ?? 0}–{item.scoreAway ?? 0}</p><p className="mt-1 text-xs font-semibold text-cyan-200/70">{item.homePlayers?.length ?? 0} + {item.awayPlayers?.length ?? 0} players</p></div><div className="flex shrink-0 gap-2"><Link to={`/scorer/${tournamentId}/${item.matchId}`} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black">SCORER</Link><Link to={`/live/${tournamentId}/match/${item.matchId}`} className="rounded-lg bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-200">LIVE</Link></div></div>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3"><button type="button" onClick={() => beginEdit(item)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300">EDIT</button><button type="button" disabled={busy} onClick={() => deleteMatch(item)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 disabled:opacity-40">DELETE</button></div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default PilotSetup;
