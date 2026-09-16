import React, { FormEvent, useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { signInWithGoogle } from "../auth/googleSignIn";
import { collection, onSnapshot, serverTimestamp, setDoc, doc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { canScoreMatches, isAdminRole } from "../auth/roles";
import { getFirebaseErrorCode } from "../auth/errors";
import { db } from "../firebase";

const clampMinutes = (value: number) => Math.min(90, Math.max(1, Math.round(Number(value) || 10)));
const cleanTournamentId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

type TournamentSummary = {
  tournamentId: string;
  name: string;
  sport?: string;
  defaultHalfMinutes?: number;
};

const PilotAdminHome = () => {
  const auth = getAuth();
  const navigate = useNavigate();
  const authState = useAuth();
  const user = authState?.user ?? null;
  const role = authState?.role ?? null;
  const authLoading = authState?.loading ?? true;
  const canOperate = canScoreMatches(role);
  const isAdmin = isAdminRole(role);

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [name, setName] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [halfMinutes, setHalfMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || user.isAnonymous || !canOperate) return undefined;
    return onSnapshot(collection(db, "pilotTournaments"), (snapshot) => {
      const next = snapshot.docs
        .map((item) => item.data() as TournamentSummary)
        .filter((item) => item.tournamentId)
        .sort((a, b) => (a.name || a.tournamentId).localeCompare(b.name || b.tournamentId));
      setTournaments(next);
    }, (err) => {
      console.error("Tournament manager snapshot failed", err);
      setError("Could not load tournaments.");
    });
  }, [authLoading, canOperate, user]);

  const login = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle(auth);
    } catch (err: unknown) {
      const code = getFirebaseErrorCode(err);
      if (code === "auth/popup-blocked") {
        setAuthError("Allow pop-ups for this site, then tap Sign in again.");
        return;
      }
      if (code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in was closed before it finished.");
        return;
      }
      setAuthError("Could not sign in. Try again in Safari/Chrome.");
    }
  };

  const createTournament = async (event: FormEvent) => {
    event.preventDefault();
    const id = cleanTournamentId(tournamentId || name);
    const displayName = name.trim();
    if (!id || !displayName) {
      setError("Tournament name and ID are required.");
      return;
    }
    if (tournaments.some((item) => item.tournamentId === id)) {
      setError("That tournament ID already exists. Open it below or choose another ID.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const safeMinutes = clampMinutes(halfMinutes);
      await setDoc(doc(db, "pilotTournaments", id), {
        tournamentId: id,
        name: displayName,
        sport: "football",
        defaultHalfMinutes: safeMinutes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate(`/pilot/${id}`);
    } catch (err) {
      console.error("Tournament creation failed", err);
      setError("Could not create the tournament.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 px-4 py-10 text-center text-sm text-slate-400">Checking tournament access…</div>;
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <main className="mx-auto max-w-md space-y-5">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Tournament Control</p><h1 className="mt-2 text-3xl font-black">Your tournaments</h1><p className="mt-2 text-sm text-slate-400">Sign in, choose a tournament, then create or score its matches.</p></div>
          <button onClick={login} className="w-full rounded-xl bg-cyan-300 px-4 py-4 font-black text-slate-950">SIGN IN WITH GOOGLE</button>
          {authError && <p className="text-sm font-semibold text-red-300">{authError}</p>}
        </main>
      </div>
    );
  }

  if (!canOperate) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <main className="mx-auto max-w-md rounded-3xl border border-red-400/20 bg-red-500/[0.06] p-6 text-center">
          <h1 className="text-2xl font-black">Tournament access required</h1>
          <p className="mt-2 text-sm text-slate-400">Signed in as {user.email || user.displayName || "this account"}. Ask an administrator to assign the scorekeeper role.</p>
          <p className="mt-3 break-all font-mono text-[0.65rem] text-slate-500">UID: {user.uid}</p>
          <button onClick={() => signOut(auth)} className="mt-5 w-full rounded-xl bg-slate-800 px-4 py-3 font-black">SIGN OUT</button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div><p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Tournament Control</p><h1 className="mt-2 text-3xl font-black">Your tournaments</h1><p className="mt-1 text-sm text-slate-500">{isAdmin ? "Create a tournament or open one dashboard." : "Open a tournament to create matches and keep score."}</p><p className="mt-2 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-cyan-200">{isAdmin ? "Administrator" : "Scorekeeper"}</p></div>
          <button onClick={() => signOut(auth)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-400">SIGN OUT</button>
        </header>

        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{isAdmin ? "Admin home" : "Scorekeeper home"}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Save this page. From here you can reach each tournament, create matches and open every scoring screen.</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">andrwlab.github.io/Season2App/pilot</p>
        </div>

        {isAdmin && <form onSubmit={createTournament} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">New tournament</p><p className="mt-1 text-sm text-slate-500">Create it here. You will be taken directly to its dashboard.</p></div>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Tournament name</span><input value={name} onChange={(e) => { setName(e.target.value); if (!tournamentId) setTournamentId(cleanTournamentId(e.target.value)); }} placeholder="Copa K Cantera" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300" /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Tournament ID</span><input value={tournamentId} onChange={(e) => setTournamentId(cleanTournamentId(e.target.value))} placeholder="copa-k-cantera" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-mono outline-none focus:border-cyan-300" /><span className="mt-1 block text-xs text-slate-500">This becomes the permanent public/QR identifier.</span></label>
          <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Default minutes per half</span><input type="number" min={1} max={90} value={halfMinutes} onChange={(e) => setHalfMinutes(clampMinutes(Number(e.target.value)))} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-lg font-black outline-none focus:border-cyan-300" /></label>
          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-50">{busy ? "CREATING…" : "CREATE TOURNAMENT"}</button>
        </form>}

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tournaments</h2><span className="text-xs font-bold text-slate-500">{tournaments.length}</span></div>
          {tournaments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">No tournaments configured yet.</div>
          ) : (
            <div className="space-y-3">
              {tournaments.map((item) => (
                <div key={item.tournamentId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="min-w-0"><p className="font-black">{item.name || item.tournamentId}</p><p className="mt-1 truncate font-mono text-xs text-slate-500">{item.tournamentId}</p><p className="mt-1 text-xs text-slate-500">{item.defaultHalfMinutes || 10} min per half</p></div>
                  <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
                    <Link to={`/pilot/${item.tournamentId}`} className="rounded-xl bg-cyan-300 px-3 py-3 text-center text-xs font-black text-slate-950">OPEN DASHBOARD</Link>
                    <Link to={`/live/${item.tournamentId}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-xs font-black text-slate-300">PUBLIC VIEW</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default PilotAdminHome;
