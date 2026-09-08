export type PilotPlayer = {
  playerId: string;
  name: string;
};

const slugifyPlayerName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";

export const parseRosterText = (text: string, side: "HOME" | "AWAY"): PilotPlayer[] => {
  const seen = new Map<string, number>();
  return text
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const base = slugifyPlayerName(name);
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return {
        playerId: `${side.toLowerCase()}-${base}${count > 1 ? `-${count}` : ""}`,
        name,
      };
    });
};

export const rosterToText = (players?: PilotPlayer[]) =>
  (players ?? []).map((player) => player.name).join("\n");
