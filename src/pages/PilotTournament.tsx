import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import PilotMomentsRail from "../components/PilotMomentsRail";
import { db } from "../firebase";
import useAudienceTracking from "../hooks/useAudienceTracking";
import { formatPhase, PilotPhase } from "../pilot/clock";
import { assetUrl, PilotTeam } from "../pilot/footballTournament";

type PilotMatchSummary = {
  matchId: string;
  tournamentId: string;
  homeName: string;
  awayName: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  scoreHome: number;
  scoreAway: number;
  status: "READY" | "LIVE" | "FULLTIME";
  phase: PilotPhase;
  stage?: "GROUP" | "SEMIFINAL" | "FINAL";
  matchday?: number;
  order?: number;
  tieId?: "SF1" | "SF2";
  leg?: 1 | 2;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
};

type PilotTournamentSummary = {
  tournamentId: string;
  name: string;
  sport: "football";
  defaultHalfMinutes?: number;
  teams?: PilotTeam[];
};

type StandingRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
};

type FootballEvent = { eventId?: string; type: string; status?: string; revertsEventId?: string; playerId?: string | null; playerName?: string | null; assistPlayerId?: string | null; assistPlayerName?: string | null };
type PlayerStat = { playerId: string; name: string; goals: number; assists: number; yellow: number; red: number };

const teamInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "TM";

const TeamBadge = ({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string; size?: "sm" | "md" }) => {
  const dimension = size === "sm" ? "h-10 w-10 text-xs" : "h-14 w-14 text-sm";

  if (logoUrl) {
    return (
      <img src={assetUrl(logoUrl)} alt={`${name} logo`} className={`${dimension} shrink-0 object-contain`} />
    );
  }

  return (
    <div className={`flex ${dimension} shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] font-black text-white/80`}>
      {teamInitials(name)}
    </div>
  );
};

const buildStandings = (completedMatches: PilotMatchSummary[], teamNames: string[] = []): StandingRow[] => {
  const table = new Map<string, StandingRow>();

  const ensure = (team: string) => {
    if (!table.has(team)) {
      table.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 });
    }
    return table.get(team)!;
  };

  teamNames.forEach(ensure);

  completedMatches.forEach((match) => {
    const home = ensure(match.homeName);
    const away = ensure(match.awayName);

    home.played += 1;
    away.played += 1;
    home.gf += match.scoreHome;
    home.ga += match.scoreAway;
    away.gf += match.scoreAway;
    away.ga += match.scoreHome;

    if (match.scoreHome > match.scoreAway) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.scoreAway > match.scoreHome) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
};

const PilotTournament = () => {
  const { tournamentId = "pilot0" } = useParams();
  const [matches, setMatches] = useState<PilotMatchSummary[]>([]);
  const [tournament, setTournament] = useState<PilotTournamentSummary | null>(null);
  const [footballEvents, setFootballEvents] = useState<FootballEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useAudienceTracking({ tournamentId, scope: "TOURNAMENT" });

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
    const eventsQuery = query(collection(db, "pilotEvents"), where("tournamentId", "==", tournamentId));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snap) => setFootballEvents(snap.docs.map((item) => item.data() as FootballEvent)));

    return () => {
      unsubscribeTournament();
      unsubscribeMatches();
      unsubscribeEvents();
    };
  }, [tournamentId]);

  const liveMatches = matches.filter((match) => match.status === "LIVE" && match.phase !== "FULLTIME");
  const previousMatches = matches.filter((match) => match.status === "FULLTIME" || match.phase === "FULLTIME").reverse();
  const upcomingMatches = matches
    .filter((match) => match.status === "READY" && match.homeTeamId && match.awayTeamId)
    .sort((a, b) => (a.matchday ?? 99) - (b.matchday ?? 99) || (a.order ?? 99) - (b.order ?? 99));
  const momentMatch = liveMatches[0] ?? previousMatches[0] ?? null;
  const fallbackTeams = useMemo(() => {
    const names = new Set<string>();
    matches.forEach((match) => {
      names.add(match.homeName);
      names.add(match.awayName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [matches]);
  const tournamentTeams = useMemo(() => tournament?.teams ?? [], [tournament?.teams]);
  const standings = useMemo(
    () => buildStandings(previousMatches.filter((match) => !match.stage || match.stage === "GROUP"), tournamentTeams.map((team) => team.name)),
    [previousMatches, tournamentTeams]
  );
  const knockoutMatches = useMemo(() => matches.filter((match) => match.stage === "SEMIFINAL" || match.stage === "FINAL"), [matches]);
  const semifinalTies = useMemo(() => (["SF1", "SF2"] as const).map((tieId) => knockoutMatches.filter((match) => match.tieId === tieId).sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0))), [knockoutMatches]);
  const finalMatch = knockoutMatches.find((match) => match.stage === "FINAL");
  const playerStats = useMemo(() => {
    const stats = new Map<string, PlayerStat>();
    const ensure = (id?: string | null, name?: string | null) => {
      if (!id || !name) return null;
      if (!stats.has(id)) stats.set(id, { playerId: id, name, goals: 0, assists: 0, yellow: 0, red: 0 });
      return stats.get(id)!;
    };
    const reversed = new Set(footballEvents.filter((event) => event.type === "REVERSAL" && event.revertsEventId).map((event) => event.revertsEventId));
    footballEvents.filter((event) => event.type !== "REVERSAL" && event.status !== "REVERSED" && !reversed.has(event.eventId)).forEach((event) => {
      const player = ensure(event.playerId, event.playerName);
      if (player && (event.type === "GOAL" || event.type === "PENALTY_GOAL")) player.goals += 1;
      if (player && event.type === "YELLOW_CARD") player.yellow += 1;
      if (player && event.type === "RED_CARD") player.red += 1;
      const assister = ensure(event.assistPlayerId, event.assistPlayerName);
      if (assister && event.type === "GOAL") assister.assists += 1;
    });
    return Array.from(stats.values()).sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
  }, [footballEvents]);

  const hubUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  const qrTargetUrl = hubUrl ? `${hubUrl}?src=qr` : "";
  const qrUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(qrTargetUrl)}`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] px-4 py-6 text-white">
        <main className="mx-auto max-w-lg animate-pulse space-y-5">
          <div className="h-20 rounded-2xl bg-white/[0.05]" />
          <div className="h-64 rounded-[2rem] bg-white/[0.05]" />
          <div className="h-32 rounded-3xl bg-white/[0.05]" />
        </main>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-[#070707] p-8 text-center font-semibold text-red-300">{error}</div>;
  }

  const displayName = tournament?.name || tournamentId;

  return (
    <div id="home" className="min-h-screen bg-[#070707] text-white">
      <main className="mx-auto max-w-lg px-4 pb-28 pt-5">
        <header className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/35">Tournament live</p>
              <h1 className="mt-1 truncate text-3xl font-black tracking-[-0.035em]">{displayName}</h1>
            </div>
            {liveMatches.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-500/[0.12] px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Live
              </span>
            )}
          </div>
        </header>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-base font-black tracking-tight">Live now</h2>
            {liveMatches.length > 1 && <span className="text-xs font-bold text-white/35">{liveMatches.length} matches</span>}
          </div>

          {liveMatches.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/45">
              No match is live right now.
            </div>
          ) : (
            <div className="space-y-3">
              {liveMatches.map((match) => (
                <Link
                  key={match.matchId}
                  to={`/live/${tournamentId}/match/${match.matchId}`}
                  className="block overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#111111] active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between px-5 pt-4 text-[0.65rem] font-black uppercase tracking-[0.13em] text-white/35">
                    <span>{formatPhase(match.phase)}</span>
                    <span className="text-red-300">Live</span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-6 text-center">
                    <div className="min-w-0">
                      <TeamBadge name={match.homeName} logoUrl={match.homeLogoUrl} />
                      <p className="mt-3 truncate text-sm font-black">{match.homeName}</p>
                    </div>

                    <div className="min-w-[7.5rem] text-5xl font-black tracking-[-0.08em] tabular-nums">
                      {match.scoreHome}<span className="mx-2 text-2xl font-light text-white/20">–</span>{match.scoreAway}
                    </div>

                    <div className="min-w-0">
                      <TeamBadge name={match.awayName} logoUrl={match.awayLogoUrl} />
                      <p className="mt-3 truncate text-sm font-black">{match.awayName}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] px-5 py-3 text-center text-xs font-black text-white/65">
                    Follow live →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {momentMatch && <PilotMomentsRail pilotMatchId={`${tournamentId}__${momentMatch.matchId}`} />}

        <section id="matches" className="scroll-mt-6 pt-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-base font-black tracking-tight">Up next</h2>
            <span className="text-xs font-bold text-white/30">Matches</span>
          </div>

          {upcomingMatches.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">No upcoming matches configured.</div>
          ) : (
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Link
                  key={match.matchId}
                  to={`/live/${tournamentId}/match/${match.matchId}`}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#101010] px-4 py-4"
                >
                  {match.matchday && <span className="col-span-3 -mb-1 text-center text-[0.58rem] font-black uppercase tracking-[0.14em] text-cyan-300/70">Matchday {match.matchday}</span>}
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamBadge name={match.homeName} logoUrl={match.homeLogoUrl} size="sm" />
                    <span className="truncate text-sm font-black">{match.homeName}</span>
                  </div>
                  <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/25">vs</span>
                  <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                    <span className="truncate text-sm font-black">{match.awayName}</span>
                    <TeamBadge name={match.awayName} logoUrl={match.awayLogoUrl} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mb-3 mt-7 flex items-center justify-between px-1">
            <h2 className="text-base font-black tracking-tight">Latest results</h2>
            <span className="text-xs font-bold text-white/30">Final</span>
          </div>

          {previousMatches.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">No completed matches yet.</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#101010]">
              {previousMatches.slice(0, 4).map((match, index) => (
                <Link
                  key={match.matchId}
                  to={`/live/${tournamentId}/match/${match.matchId}`}
                  className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 ${index > 0 ? "border-t border-white/[0.06]" : ""}`}
                >
                  <span className="truncate text-sm font-bold">{match.homeName}</span>
                  <span className="text-xl font-black tabular-nums">{match.scoreHome}–{match.scoreAway}</span>
                  <span className="truncate text-right text-sm font-bold">{match.awayName}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="standings" className="scroll-mt-6 pt-7">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-base font-black tracking-tight">Standings</h2>
            <span className="text-xs font-bold text-white/30">Top teams</span>
          </div>

          {standings.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">Standings will appear after the first completed match.</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#101010]">
              <div className="grid grid-cols-[2rem_1fr_2rem_2rem_2rem] gap-2 border-b border-white/[0.06] px-4 py-3 text-[0.6rem] font-black uppercase tracking-[0.1em] text-white/25">
                <span>#</span><span>Team</span><span className="text-center">P</span><span className="text-center">GD</span><span className="text-right">Pts</span>
              </div>
              {standings.slice(0, 6).map((row, index) => (
                <div key={row.team} className={`grid grid-cols-[2rem_1fr_2rem_2rem_2rem] items-center gap-2 px-4 py-3 text-sm ${index > 0 ? "border-t border-white/[0.05]" : ""}`}>
                  <span className="font-black text-white/35">{index + 1}</span>
                  <span className="truncate font-black">{row.team}</span>
                  <span className="text-center text-white/55">{row.played}</span>
                  <span className="text-center text-white/55">{row.gf - row.ga}</span>
                  <span className="text-right font-black">{row.points}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {knockoutMatches.length > 0 && <section className="scroll-mt-6 pt-7">
          <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black tracking-tight">Knockout stage</h2><span className="text-xs font-bold text-white/30">Semi-finals · Final</span></div>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">{semifinalTies.map((tie, index) => {
              const completed = tie.filter((match) => match.status === "FULLTIME");
              const teamIds = Array.from(new Set(tie.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean))) as string[];
              const aggregate = new Map(teamIds.map((teamId) => [teamId, 0]));
              completed.forEach((match) => {
                if (match.homeTeamId) aggregate.set(match.homeTeamId, (aggregate.get(match.homeTeamId) ?? 0) + match.scoreHome);
                if (match.awayTeamId) aggregate.set(match.awayTeamId, (aggregate.get(match.awayTeamId) ?? 0) + match.scoreAway);
              });
              const first = tie[0];
              const second = tie[1];
              const teamsSet = Array.from(new Set(tie.flatMap((match) => [match.homeName, match.awayName]))).filter((name) => name !== "To be confirmed");
              return <div key={`SF${index + 1}`} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-4">
                <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-cyan-300/70">Semi-final {index + 1} · two legs</p>
                <p className="mt-2 truncate text-sm font-black">{teamsSet.length === 2 ? `${teamsSet[0]} vs ${teamsSet[1]}` : "Group positions to be confirmed"}</p>
                <p className="mt-2 text-xs font-bold text-white/40">Aggregate {completed.length && teamIds.length === 2 ? `${aggregate.get(teamIds[0])}–${aggregate.get(teamIds[1])}` : "—"} · {completed.length}/2 played</p>
                <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">{[first, second].filter(Boolean).map((match) => <Link key={match.matchId} to={`/live/${tournamentId}/match/${match.matchId}`} className="flex items-center justify-between text-xs font-semibold text-white/55"><span>Leg {match.leg}</span><span className="truncate px-2">{match.homeName} – {match.awayName}</span><span>{match.status === "FULLTIME" ? `${match.scoreHome}–${match.scoreAway}` : "vs"}</span></Link>)}</div>
              </div>;
            })}</div>
            {finalMatch && <Link to={`/live/${tournamentId}/match/${finalMatch.matchId}`} className="block rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-center"><p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-amber-200">Final</p><p className="mt-2 text-sm font-black">{finalMatch.homeName} <span className="text-white/30">vs</span> {finalMatch.awayName}</p>{finalMatch.status === "FULLTIME" && <p className="mt-2 text-lg font-black">{finalMatch.scoreHome}–{finalMatch.scoreAway}</p>}</Link>}
          </div>
        </section>}

        {tournament?.sport === "football" && <section className="scroll-mt-6 pt-7">
          <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-black tracking-tight">Player stats</h2><span className="text-xs font-bold text-white/30">Football only</span></div>
          {playerStats.length === 0 ? <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">Player statistics will appear with the first recorded event.</div> : <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#101010]"><div className="grid grid-cols-[1fr_2.5rem_2.5rem_2.5rem] gap-2 border-b border-white/[0.06] px-4 py-3 text-[0.6rem] font-black uppercase tracking-[0.1em] text-white/25"><span>Player</span><span className="text-center">G</span><span className="text-center">A</span><span className="text-center">Cards</span></div>{playerStats.slice(0, 10).map((player, index) => <div key={player.playerId} className={`grid grid-cols-[1fr_2.5rem_2.5rem_2.5rem] items-center gap-2 px-4 py-3 text-sm ${index ? "border-t border-white/[0.05]" : ""}`}><span className="truncate font-black">{player.name}</span><span className="text-center font-black">{player.goals}</span><span className="text-center text-cyan-200">{player.assists}</span><span className="text-center text-xs">{player.yellow > 0 && <span>🟨{player.yellow}</span>}{player.red > 0 && <span> 🟥{player.red}</span>}</span></div>)}</div>}
        </section>}

        <section id="teams" className="scroll-mt-6 pt-7">
          <div className="mb-3 px-1">
            <h2 className="text-base font-black tracking-tight">Teams</h2>
          </div>
          {tournamentTeams.length === 0 && fallbackTeams.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-sm text-white/40">Teams will appear when matches are configured.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tournamentTeams.length > 0 ? tournamentTeams.map((team) => (
                <details key={team.teamId} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-3 open:col-span-2">
                  <summary className="flex cursor-pointer list-none items-center gap-3"><TeamBadge name={team.name} logoUrl={team.logoPath} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-black">{team.name}</span><span className="text-xs font-bold text-white/30">{team.players.length}</span></summary>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">{team.players.map((player) => <div key={player.playerId} className="rounded-lg bg-white/[0.04] px-3 py-2"><p className="text-sm font-black">{player.name}</p><p className="truncate text-[0.65rem] text-white/35">{player.fullName}</p></div>)}</div>
                </details>
              )) : fallbackTeams.map((team) => (
                <div key={team} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#101010] p-3"><TeamBadge name={team} size="sm" /><span className="min-w-0 truncate text-sm font-black">{team}</span></div>
              ))}
            </div>
          )}
        </section>

        {qrUrl && (
          <section className="mt-8 rounded-3xl border border-white/[0.07] bg-[#101010] p-5 text-center">
            <h2 className="text-sm font-black">Share tournament</h2>
            <p className="mt-1 text-xs text-white/35">One QR for the entire live tournament experience.</p>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3">
              <img src={qrUrl} alt={`QR for ${displayName} live tournament hub`} width={220} height={220} className="h-40 w-40" />
            </div>
          </section>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0b0b0b]/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          <a href="#home" className="rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-black text-white">Home</a>
          <a href="#matches" className="rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-bold text-white/45">Matches</a>
          <a href="#standings" className="rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-bold text-white/45">Standings</a>
          <a href="#teams" className="rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-bold text-white/45">Teams</a>
        </div>
      </nav>
    </div>
  );
};

export default PilotTournament;
