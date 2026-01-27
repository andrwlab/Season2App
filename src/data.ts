// src/data.ts

export type Season1TeamName = "Team Blue" | "Team Red" | "Team Pink" | "Team Black";

export type Season1PlayerStat = {
  name: string;
  team: Season1TeamName;
  attack: number;
  blocks: number;
  assists: number;
  service: number;
  total: number;
};

export const season1TeamColors: Record<Season1TeamName, string> = {
  "Team Blue": "#1d4ed8",
  "Team Red": "#dc2626",
  "Team Pink": "#ec4899",
  "Team Black": "#111827",
};

export const season1Players: Season1PlayerStat[] = [
  { name: "Rocco Lokee", team: "Team Blue", attack: 23, blocks: 5, assists: 0, service: 3, total: 31 },
  { name: "Mr. Hall", team: "Team Red", attack: 24, blocks: 1, assists: 0, service: 6, total: 31 },
  { name: "Lucas Wu", team: "Team Pink", attack: 18, blocks: 2, assists: 0, service: 4, total: 24 },
  { name: "Wilson Chen", team: "Team Black", attack: 9, blocks: 6, assists: 0, service: 5, total: 20 },
  { name: "Mr. Torres", team: "Team Pink", attack: 10, blocks: 0, assists: 0, service: 3, total: 13 },
  { name: "Mr. Solis", team: "Team Blue", attack: 7, blocks: 0, assists: 0, service: 5, total: 12 },
  { name: "Edgar Justavino", team: "Team Red", attack: 6, blocks: 0, assists: 0, service: 5, total: 11 },
  { name: "James De Gracia", team: "Team Blue", attack: 4, blocks: 2, assists: 0, service: 2, total: 8 },
  { name: "Willy Hou", team: "Team Red", attack: 4, blocks: 1, assists: 0, service: 2, total: 7 },
  { name: "Ferran Ponton", team: "Team Pink", attack: 4, blocks: 0, assists: 0, service: 0, total: 4 },
  { name: "Joel Pérez", team: "Team Black", attack: 2, blocks: 0, assists: 0, service: 2, total: 4 },
  { name: "Mr. Marmolejo", team: "Team Black", attack: 2, blocks: 0, assists: 0, service: 1, total: 3 },
  { name: "Mrs. Almanza", team: "Team Red", attack: 1, blocks: 0, assists: 0, service: 2, total: 3 },
  { name: "Rafael Romero", team: "Team Pink", attack: 2, blocks: 1, assists: 0, service: 0, total: 3 },
  { name: "Lauren Tapia", team: "Team Red", attack: 0, blocks: 0, assists: 0, service: 2, total: 2 },
  { name: "Mr. Pérez", team: "Team Pink", attack: 1, blocks: 0, assists: 0, service: 1, total: 2 },
  { name: "Mario Zhong", team: "Team Blue", attack: 0, blocks: 0, assists: 0, service: 2, total: 2 },
  { name: "Anny Deng", team: "Team Pink", attack: 0, blocks: 0, assists: 0, service: 2, total: 2 },
  { name: "William Chen", team: "Team Blue", attack: 2, blocks: 0, assists: 0, service: 0, total: 2 },
  { name: "Mr. Aguilera", team: "Team Blue", attack: 0, blocks: 0, assists: 0, service: 1, total: 1 },
  { name: "Dhruvin Ahir", team: "Team Blue", attack: 0, blocks: 0, assists: 0, service: 1, total: 1 },
  { name: "Mr. Vergara", team: "Team Black", attack: 1, blocks: 0, assists: 0, service: 0, total: 1 },
  { name: "Michell Qiu", team: "Team Pink", attack: 0, blocks: 0, assists: 0, service: 1, total: 1 },
  { name: "Mavielis Castillero", team: "Team Blue", attack: 0, blocks: 0, assists: 0, service: 1, total: 1 },
  { name: "Héctor Chen", team: "Team Black", attack: 0, blocks: 0, assists: 0, service: 1, total: 1 },
];

export const season1PlayerByName = Object.fromEntries(
  season1Players.map((p) => [p.name, p])
) as Record<string, Season1PlayerStat>;

export const season1Teams = Object.entries(
  season1Players.reduce((acc, player) => {
    if (!acc[player.team]) {
      acc[player.team] = { name: player.team, playerCount: 0 };
    }
    acc[player.team].playerCount += 1;
    return acc;
  }, {} as Record<Season1TeamName, { name: Season1TeamName; playerCount: number }>)
).map(([, value]) => value);
  
