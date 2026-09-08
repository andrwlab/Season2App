import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";

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
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: "FIRST_HALF" | "HALFTIME" | "SECOND_HALF" | "FULLTIME";
  periodDurationMs?: number;
};

const PilotSetup = () => {
  const { tournamentId = "pilot0" } = useParams();
  const tournamentRef = useMemo(() => doc(db, "pilotTournaments", tournamentId), [tournamentId]);

  const [tournament, setTournament] = useState<PilotTournamentDoc | null>(null);
  const [matches, setMatches] = useState<PilotMatchSummary[]>([]);
  const [name, setName] = useState("Micro Football Tournament");
  const [defaultHalfMinutes, setDefaultHalfMinutes] = useState(10);
  const [matchId, setMatchId] = useState("match-001");
  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [halfMinutes, setHalfMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      const nextNumber = next.length + 1;
      setMatchId(`match-${String(nextNumber).padStart(3, "0")}`);
    });

    return () => {
      unsubscribeTournament();
      unsubscribeMatches();
    };
  }, [tournamentId, tournamentRef]);

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
      setError("Could not save tournament settings. Make sure you are signed in as admin.");
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

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const safeMinutes = clampMinutes(halfMinutes);
      const pilotMatchId = `${tournamentId}__${cleanMatchId}`;
      await setDoc(doc(db, "pilotMatches", pilotMatchId), {
        tournamentId,
        matchId: cleanMatchId,
        homeName: cleanHome,
        awayName: cleanAway,
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
      setHalfMinutes(tournament?.defaultHalfMinutes || defaultHalfMinutes || 10);
      setMessage(`${cleanMatchId} created.`);
    } catch (err) {
      console.error("Pilot match creation failed", err);
      setError("Could not create the match. Make sure you are signed in as admin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Pilot 0 · Setup</p>
            <h1 className="mt-2 text-3xl font-black">{tournament?.name || name || tournamentId}</h1>
            <p className="mt-1 text-sm text-slate-500">{tournamentId}</p>
          </div>
          <Link to={`/live/${tournamentId}`} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200">
            OPEN PUBLIC HUB →
          </Link>
        </header>

        <form onSubmit={saveTournament} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tournament</p>
            <p className="mt-1 text-sm text-slate-500">Pilot-only configuration. This does not touch Season 2 teams or players.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Default minutes per half</span>
            <div className="grid grid-cols-[48px_1fr_48px] gap-2">
              <button type="button" onClick={() => setDefaultHalfMinutes((v) => clampMinutes(v - 1))} className="rounded-xl bg-slate-800 text-xl font-black">−</button>
              <input type="number" min={1} max={90} value={defaultHalfMinutes} onChange={(e) => setDefaultHalfMinutes(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-lg font-black outline-none focus:border-cyan-400" />
              <button type="button" onClick={() => setDefaultHalfMinutes((v) => clampMinutes(v + 1))} className="rounded-xl bg-slate-800 text-xl font-black">+</button>
            </div>
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-50">
            SAVE TOURNAMENT SETTINGS
          </button>
        </form>

        <form onSubmit={createMatch} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Add match</p>
            <p className="mt-1 text-sm text-slate-500">Create only the matches needed for this micro tournament.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Match ID</span>
            <input value={matchId} onChange={(e) => setMatchId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Home</span>
              <input value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="Team A" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Away</span>
              <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="Team B" className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-base outline-none focus:border-cyan-400" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Minutes per half</span>
            <div className="grid grid-cols-[48px_1fr_48px] gap-2">
              <button type="button" onClick={() => setHalfMinutes((v) => clampMinutes(v - 1))} className="rounded-xl bg-slate-800 text-xl font-black">−</button>
              <input type="number" min={1} max={90} value={halfMinutes} onChange={(e) => setHalfMinutes(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-center text-lg font-black outline-none focus:border-cyan-400" />
              <button type="button" onClick={() => setHalfMinutes((v) => clampMinutes(v + 1))} className="rounded-xl bg-slate-800 text-xl font-black">+</button>
            </div>
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-50">
            CREATE MATCH
          </button>
        </form>

        {(message || error) && (
          <div className={`rounded-xl border p-3 text-sm font-semibold ${error ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>
            {error || message}
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Configured matches</h2>
            <span className="text-xs font-bold text-slate-500">{matches.length}</span>
          </div>
          {matches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">No matches yet.</div>
          ) : (
            <div className="space-y-2">
              {matches.map((item) => (
                <div key={item.matchId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{item.matchId} · {item.status}</p>
                      <p className="mt-1 truncate font-black">{item.homeName} vs {item.awayName}</p>
                      <p className="mt-1 text-xs text-slate-500">{Math.round((item.periodDurationMs || 600000) / 60000)} min per half</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link to={`/scorer/${tournamentId}/${item.matchId}`} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black">SCORER</Link>
                      <Link to={`/live/${tournamentId}/match/${item.matchId}`} className="rounded-lg bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-200">LIVE</Link>
                    </div>
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

export default PilotSetup;
