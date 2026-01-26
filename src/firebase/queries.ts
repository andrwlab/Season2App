import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export type Season = {
  id: string;
  name: string;
  startDate: string;
  isActive: boolean;
};

export type Team = {
  id: string;
  seasonId: string;
  name: string;
  slug: string;
  logoFile?: string;
};

export type Match = {
  id: string;
  seasonId: string;
  dateISO: string;
  timeHHmm?: string;
  homeTeamId: string;
  awayTeamId: string;
  status?: "scheduled" | "completed" | "canceled";
  scores?: { home: number | null; away: number | null };
};

export type Roster = {
  id: string;
  seasonId: string;
  teamId: string;
  playerIds: string[];
  updatedAt?: unknown;
};

export type Player = {
  id: string;
  fullName: string;
  type?: "teacher" | "student";
  photoUrl?: string;
};

export type PlayerStat = {
  id: string;
  seasonId: string;
  matchId: string;
  playerId: string;
  attack?: number;
  blocks?: number;
  assists?: number;
  service?: number;
};

export function subscribeSeasons(
  cb: (data: Season[]) => void
): () => void {
  return onSnapshot(collection(db, "seasons"), (snap) => {
    const seasons = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Season, "id">),
    }));
    cb(seasons);
  });
}

export function subscribeTeams(
  seasonId: string | null | undefined,
  cb: (data: Team[]) => void
): () => void {
  if (!seasonId) return () => {};
  const q = query(collection(db, "teams"), where("seasonId", "==", seasonId));
  return onSnapshot(q, (snap) => {
    const teams = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Team, "id">),
    }));
    cb(teams);
  });
}

export function subscribeMatches(
  seasonId: string | null | undefined,
  cb: (data: Match[]) => void
): () => void {
  if (!seasonId) return () => {};
  const q = query(collection(db, "matches"), where("seasonId", "==", seasonId));
  return onSnapshot(q, (snap) => {
    const matches = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Match, "id">),
    }));
    cb(matches);
  });
}

export function subscribeRosters(
  seasonId: string | null | undefined,
  cb: (data: Roster[]) => void
): () => void {
  if (!seasonId) return () => {};
  const q = query(collection(db, "rosters"), where("seasonId", "==", seasonId));
  return onSnapshot(q, (snap) => {
    const rosters = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Roster, "id">),
    }));
    cb(rosters);
  });
}

export function subscribePlayers(cb: (data: Player[]) => void): () => void {
  return onSnapshot(collection(db, "players"), (snap) => {
    const players = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Player, "id">),
    }));
    cb(players);
  });
}

export function subscribePlayerStats(
  seasonId: string | null | undefined,
  cb: (data: PlayerStat[]) => void
): () => void {
  if (!seasonId) return () => {};
  const q = query(
    collection(db, "playerStats"),
    where("seasonId", "==", seasonId)
  );
  return onSnapshot(q, (snap) => {
    const stats = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PlayerStat, "id">),
    }));
    cb(stats);
  });
}
