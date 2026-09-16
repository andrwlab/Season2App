export type AppRole = "admin" | "scorekeeper";

export const isAppRole = (role: unknown): role is AppRole =>
  role === "admin" || role === "scorekeeper";

export const canScoreMatches = (role: string | null | undefined) =>
  role === "admin" || role === "scorekeeper";

export const isAdminRole = (role: string | null | undefined) => role === "admin";
