import type { Timestamp } from "firebase/firestore";

export type PilotMomentType =
  | "GOAL"
  | "HIGHLIGHT"
  | "PHOTO"
  | "MATCH_START"
  | "HALFTIME"
  | "MATCH_END"
  | "AWARD"
  | "OTHER";

export type PilotMomentMediaType = "IMAGE" | "VIDEO";
export type PilotMomentStatus = "PUBLISHED" | "HIDDEN";

export type PilotMoment = {
  version: 1;
  momentId: string;
  tournamentId: string;
  matchId: string;
  pilotMatchId: string;
  type: PilotMomentType;
  title: string;
  caption?: string;
  playerId?: string;
  playerName?: string;
  teamSide?: "HOME" | "AWAY";
  matchClockMs?: number;
  mediaType?: PilotMomentMediaType;
  mediaUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  featured?: boolean;
  status: PilotMomentStatus;
  clientCreatedAt: number;
  createdAt?: Timestamp;
};

export const PILOT_MOMENTS_COLLECTION = "pilotMoments";

export const momentTypeLabel = (type: PilotMomentType) => {
  switch (type) {
    case "MATCH_START":
      return "MATCH START";
    case "MATCH_END":
      return "FULL TIME";
    default:
      return type.replaceAll("_", " ");
  }
};

export const formatMomentMinute = (matchClockMs?: number) => {
  if (typeof matchClockMs !== "number") return "";
  const minute = Math.max(0, Math.floor(matchClockMs / 60000));
  return `${minute}’`;
};
