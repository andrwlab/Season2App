import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

type Listener<T> = (data: T[]) => void;

type SharedEntry<T> = {
  listeners: Set<Listener<T>>;
  unsubscribe: () => void;
  data?: T[];
};

const sharedSubscriptions = new Map<string, SharedEntry<unknown>>();

function sharedSubscribe<T>(
  key: string,
  start: (emit: (data: T[]) => void) => () => void,
  cb: Listener<T>
): () => void {
  let entry = sharedSubscriptions.get(key) as SharedEntry<T> | undefined;

  if (!entry) {
    const listeners = new Set<Listener<T>>();
    entry = { listeners, unsubscribe: () => {} };
    sharedSubscriptions.set(key, entry);
    entry.unsubscribe = start((data) => {
      const current = sharedSubscriptions.get(key) as SharedEntry<T> | undefined;
      if (!current) return;
      current.data = data;
      current.listeners.forEach((listener) => listener(data));
    });
  }

  entry.listeners.add(cb);

  if (entry.data) {
    cb(entry.data);
  }

  return () => {
    const current = sharedSubscriptions.get(key) as SharedEntry<T> | undefined;
    if (!current) return;
    current.listeners.delete(cb);
    if (current.listeners.size === 0) {
      current.unsubscribe();
      sharedSubscriptions.delete(key);
    }
  };
}

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
  status?: "scheduled" | "live" | "finished" | "completed" | "canceled";
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
  updatedAt?: unknown;
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  return 0;
};

const normalizeId = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value.id === "string") return value.id;
  if (typeof value === "number") return String(value);
  return "";
};

const dedupePlayerStats = (stats: PlayerStat[]) => {
  const map = new Map<string, PlayerStat>();
  stats.forEach((stat) => {
    const matchId = normalizeId(stat.matchId);
    const playerId = normalizeId(stat.playerId);
    if (!matchId || !playerId) return;
    const key = `${matchId}:${playerId}`;
    const normalizedStat = { ...stat, matchId, playerId };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, normalizedStat);
      return;
    }
    const existingUpdated = toMillis((existing as any).updatedAt);
    const nextUpdated = toMillis((stat as any).updatedAt);
    if (nextUpdated >= existingUpdated) {
      map.set(key, normalizedStat);
    }
  });
  return Array.from(map.values());
};

export function subscribeSeasons(
  cb: (data: Season[]) => void
): () => void {
  return sharedSubscribe<Season>("seasons", (emit) => {
    return onSnapshot(collection(db, "seasons"), (snap) => {
      const seasons = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Season, "id">),
      }));
      emit(seasons);
    });
  }, cb);
}

export function subscribeTeams(
  seasonId: string | null | undefined,
  cb: (data: Team[]) => void
): () => void {
  if (!seasonId) return () => {};
  const key = `teams:${seasonId}`;
  return sharedSubscribe<Team>(key, (emit) => {
    const q = query(collection(db, "teams"), where("seasonId", "==", seasonId));
    return onSnapshot(q, (snap) => {
      const teams = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Team, "id">),
      }));
      emit(teams);
    });
  }, cb);
}

export function subscribeMatches(
  seasonId: string | null | undefined,
  cb: (data: Match[]) => void
): () => void {
  if (!seasonId) return () => {};
  const key = `matches:${seasonId}`;
  return sharedSubscribe<Match>(key, (emit) => {
    const q = query(collection(db, "matches"), where("seasonId", "==", seasonId));
    return onSnapshot(q, (snap) => {
      const matches = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Match, "id">),
      }));
      emit(matches);
    });
  }, cb);
}

export function subscribeRosters(
  seasonId: string | null | undefined,
  cb: (data: Roster[]) => void
): () => void {
  if (!seasonId) return () => {};
  const key = `rosters:${seasonId}`;
  return sharedSubscribe<Roster>(key, (emit) => {
    const q = query(collection(db, "rosters"), where("seasonId", "==", seasonId));
    return onSnapshot(q, (snap) => {
      const rosters = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Roster, "id">),
      }));
      emit(rosters);
    });
  }, cb);
}

export function subscribePlayers(cb: (data: Player[]) => void): () => void {
  return sharedSubscribe<Player>("players", (emit) => {
    return onSnapshot(collection(db, "players"), (snap) => {
      const players = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Player, "id">),
      }));
      emit(players);
    });
  }, cb);
}

export function subscribePlayerStats(
  seasonId: string | null | undefined,
  cb: (data: PlayerStat[]) => void
): () => void {
  if (!seasonId) return () => {};
  const key = `playerStats:${seasonId}`;
  return sharedSubscribe<PlayerStat>(key, (emit) => {
    const q = query(
      collection(db, "playerStats"),
      where("seasonId", "==", seasonId)
    );
    return onSnapshot(q, (snap) => {
      const stats = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<PlayerStat, "id">),
      }));
      emit(dedupePlayerStats(stats));
    });
  }, cb);
}

export function subscribeAllPlayerStats(
  cb: (data: PlayerStat[]) => void
): () => void {
  return sharedSubscribe<PlayerStat>("playerStats:all", (emit) => {
    return onSnapshot(collection(db, "playerStats"), (snap) => {
      const stats = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<PlayerStat, "id">),
      }));
      emit(dedupePlayerStats(stats));
    });
  }, cb);
}
