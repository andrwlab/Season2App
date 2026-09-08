import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";
import { formatPhase, PilotPhase } from "../pilot/clock";

type PilotMatchSummary = {
  matchId: string;
  tournamentId: string;
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: PilotPhase;
};

type PilotTournamentSummary = {
  tournamentId: string;
  name: string;
  sport: "football";
  defaultHalfMinutes?: number;
};

const PilotTournament = () => {
  const { tournamentId = "pilot0" } = useParams();
  const [matches, setMatches] = useState<PilotMatchSummary[]>([]);
  const [tournament, setTournament] = useState<PilotTournamentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tournamentRef = doc(db, "pilotTournaments", tournamentId);
    const unsubscribeTournament = onSnapshot(tournamentRef, (snap) => {
      setTournament(snap.exists() ? (snap.data() as PilotTournamentSummary) : null);
    });

    const q = query(collection(db, "pilotMatches"), where("tournamentId", "==", tournamentId));
    const unsubscribeMatches = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((item) => item.data() as PilotMatchSummary)
          .sort((a, b) => a.matchId.localeCompare(b.matchId, undefined, { numeric: true }));
        setMatches(next);
        setLoading(false);
      },
      (err) => {
        console.error("Pilot tournament hub snapshot failed", err);
        setError("Tournament data is temporarily unavailable.");
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTournament();
      unsubscribeMatches();
    };
  }, [tournamentId]);

  const liveMatches = matches.filter((match) => match.status === "LIVE" && match.phase !== "FULLTIME");
  const previousMatches = matches.filter((match) => match.status === "FULLTIME" || match.phase === "FULLTIME").reverse();
  const upcomingMatches = matches.filter((match) => match.status === "READY");

  const hubUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  const qrUrl = hubUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(hubUrl)}`
    : "";

  if (loading) {
    return <div className="min-h-screen bg-slate-950 p-8 text-center text-slate-400">Loading tournament...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-slate-950 p-8 text-center font-semibold text-red-300">{error}</div>;
  }

  const displayName = tournament?.name || tournamentId;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <main className="mx-auto max-w-lg space-y-6">
        <header>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-cyan-300">Pilot 0 · Tournament Live</p>
          <h1 className="mt-2 text-3xl font-black">{displayName}</h1>
          {displayName !== tournamentId && <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-600">{tournamentId}</p>}
          <p className="mt-2 text-sm text-slate-400">Live scores, recent results and upcoming matches in one public link.</p>
        </header>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Live now</h2>
            {liveMatches.length > 0 && <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[0.65rem] font-black text-red-200">LIVE</span>}
          </div>

          {liveMatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">No match is live right now.</div>
          ) : (
            <div className="space-y-3">
              {liveMatches.map((match) => (
                <Link key={match.matchId} to={`/live/${tournamentId}/match/${match.matchId}`} className="block rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5 active:scale-[0.99]">
                  <div className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-[0.16em] text-cyan-200">
                    <span>{match.matchId}</span>
                    <span>{formatPhase(match.phase)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <div className="truncate font-black">{match.homeName}</div>
                    <div className="text-4xl font-black">{match.scoreHome}–{match.scoreAway}</div>
                    <div className="truncate font-black">{match.awayName}</div>
                  </div>
                  <div className="mt-4 text-center text-xs font-black text-cyan-200">OPEN LIVE MATCH →</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Previous results</h2>
          {previousMatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">No completed matches yet.</div>
          ) : (
            <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {previousMatches.map((match) => (
                <Link key={match.matchId} to={`/live/${tournamentId}/match/${match.matchId}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 text-sm">
                  <span className="truncate font-bold">{match.homeName}</span>
                  <span className="text-xl font-black">{match.scoreHome}–{match.scoreAway}</span>
                  <span className="truncate text-right font-bold">{match.awayName}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Upcoming</h2>
          {upcomingMatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">No upcoming matches configured.</div>
          ) : (
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Link key={match.matchId} to={`/live/${tournamentId}/match/${match.matchId}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <span className="truncate font-bold">{match.homeName}</span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">vs</span>
                  <span className="truncate text-right font-bold">{match.awayName}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {qrUrl && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Tournament QR</h2>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
              <img src={qrUrl} alt={`QR for ${displayName} live tournament hub`} width={220} height={220} className="h-44 w-44 sm:h-52 sm:w-52" />
            </div>
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-slate-500">This QR always opens the tournament hub, not one specific match.</p>
          </section>
        )}
      </main>
    </div>
  );
};

export default PilotTournament;
