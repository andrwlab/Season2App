import { PilotPlayer } from "./players";

export type PilotRosterPlayer = PilotPlayer & {
  fullName: string;
};

export type PilotTeam = {
  teamId: string;
  name: string;
  shortName: string;
  logoPath: string;
  players: PilotRosterPlayer[];
};

export type PilotScheduledMatch = {
  matchId: string;
  stage: "GROUP" | "SEMIFINAL" | "FINAL";
  matchday?: number;
  order: number;
  homeTeamId?: string;
  awayTeamId?: string;
  tieId?: "SF1" | "SF2";
  leg?: 1 | 2;
};

const playerIdFor = (fullName: string) =>
  `football-${fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

const player = (fullName: string, name: string): PilotRosterPlayer => ({
  playerId: playerIdFor(fullName),
  fullName,
  name,
});

const MR_CASTILLO = player("Mr. Castillo", "Mr. Castillo");

export const FOOTBALL_2026_TOURNAMENT_ID = "football-2026";

// A saved date (including null for unconfirmed) overrides the initial calendar.
export const footballMatchDate = (match: { tournamentId: string; scheduledDate?: string | null; matchday?: number; stage?: string; leg?: number }) => {
  if (match.scheduledDate !== undefined) return match.scheduledDate;
  if (match.tournamentId !== FOOTBALL_2026_TOURNAMENT_ID) return null;
  if (match.stage === "FINAL") return "2026-11-13";
  if (match.stage === "SEMIFINAL") return match.leg === 1 ? "2026-10-23" : match.leg === 2 ? "2026-11-06" : null;
  return ({ 1: "2026-09-25", 2: "2026-10-09", 3: "2026-10-16" } as Record<number, string>)[match.matchday ?? 0] ?? null;
};

export const FOOTBALL_2026_TEAMS: PilotTeam[] = [
  {
    teamId: "real-madrid",
    name: "Real Madrid C.F.",
    shortName: "Real Madrid",
    logoPath: "logos/football/real-madrid.png",
    players: [
      player("Rafael Romero", "Rafael"),
      player("Rocco Lockee", "Rocco"),
      player("Miguel Concepción", "Miguel"),
      player("Iann Araúz", "Iann"),
      player("Wilson Chen", "Wilson"),
      player("Héctor Fu Chen", "Héctor F."),
      player("Jackson Zhu", "Jackson"),
      player("Gabriel Chen de León", "Gabriel"),
      player("Mr. Solís", "Mr. Solís"),
      player("James De Gracia", "James"),
      player("Joel Pérez", "Joel"),
    ],
  },
  {
    teamId: "fc-barcelona",
    name: "F.C. Barcelona",
    shortName: "Barcelona",
    logoPath: "logos/football/fc-barcelona.png",
    players: [
      player("Edward Qiu", "Edward"),
      player("Ellis He", "Ellis"),
      player("José Bertorelli", "José B."),
      player("Juan Bonilla", "Juan"),
      player("Brian Chen", "Brian"),
      player("Williams Luo", "Williams"),
      player("Jaime Gibss", "Jaime"),
      player("Ian Espino", "Ian"),
      player("Mr. Marmolejo", "Mr. Marmolejo"),
      player("Héctor Chen", "Héctor C."),
      player("José Pimentel", "José P."),
    ],
  },
  {
    teamId: "slovan-bratislava",
    name: "Manchester City",
    shortName: "Man City",
    logoPath: "logos/football/manchester-city.png",
    players: [
      player("Mr. Pérez", "Mr. Pérez"),
      player("Johan Ching", "Johan"),
      player("Dylan Sanjur", "Dylan S."),
      player("Rian Ahir Ahir", "Rian"),
      player("Dylan Dely", "Dylan D."),
      player("Antonio Zhu", "Antonio"),
      player("Winston Chen", "Winston"),
      player("Henrique Arenas", "Henrique"),
      player("Eduardo Gudiño", "Eduardo"),
      player("Adrian Fernández", "Adrian"),
      player("Dylan Rodríguez", "Dylan R."),
      MR_CASTILLO,
    ],
  },
  {
    teamId: "paris-saint-germain",
    name: "Paris Saint-Germain",
    shortName: "PSG",
    logoPath: "logos/football/paris-saint-germain.png",
    players: [
      player("Ethan de León", "Ethan"),
      player("Douglas Dewesse", "Douglas"),
      player("John Kenneth", "John"),
      player("Diego Pimentel", "Diego"),
      player("William Qiu", "William"),
      player("Mr. Tam", "Mr. Tam"),
      player("Mr. Gómez", "Mr. Gómez"),
      player("Adriam Rodríguez", "Adriam"),
      player("Edwin Chen", "Edwin"),
      player("Nicolás Pérez", "Nicolás"),
      player("Daniel De León", "Daniel"),
      player("Lucas Spencer", "Lucas"),
    ],
  },
];

export const FOOTBALL_2026_SCHEDULE: PilotScheduledMatch[] = [
  { matchId: "group-01", stage: "GROUP", matchday: 1, order: 1, homeTeamId: "real-madrid", awayTeamId: "fc-barcelona" },
  { matchId: "group-02", stage: "GROUP", matchday: 1, order: 2, homeTeamId: "paris-saint-germain", awayTeamId: "slovan-bratislava" },
  { matchId: "group-03", stage: "GROUP", matchday: 2, order: 1, homeTeamId: "paris-saint-germain", awayTeamId: "real-madrid" },
  { matchId: "group-04", stage: "GROUP", matchday: 2, order: 2, homeTeamId: "slovan-bratislava", awayTeamId: "fc-barcelona" },
  { matchId: "group-05", stage: "GROUP", matchday: 3, order: 1, homeTeamId: "real-madrid", awayTeamId: "slovan-bratislava" },
  { matchId: "group-06", stage: "GROUP", matchday: 3, order: 2, homeTeamId: "fc-barcelona", awayTeamId: "paris-saint-germain" },
  { matchId: "semi-1-leg-1", stage: "SEMIFINAL", tieId: "SF1", leg: 1, order: 1 },
  { matchId: "semi-2-leg-1", stage: "SEMIFINAL", tieId: "SF2", leg: 1, order: 2 },
  { matchId: "semi-1-leg-2", stage: "SEMIFINAL", tieId: "SF1", leg: 2, order: 3 },
  { matchId: "semi-2-leg-2", stage: "SEMIFINAL", tieId: "SF2", leg: 2, order: 4 },
  { matchId: "final", stage: "FINAL", order: 5 },
];

export const normalizeFootballTeam = (team: PilotTeam): PilotTeam => {
  const playersWithoutCastillo = team.players.filter((item) => item.playerId !== MR_CASTILLO.playerId);
  if (team.teamId === "slovan-bratislava") {
    return {
      ...team,
      name: "Manchester City",
      shortName: "Man City",
      logoPath: "logos/football/manchester-city.png",
      players: [...playersWithoutCastillo, MR_CASTILLO],
    };
  }
  if (team.teamId === "paris-saint-germain") return { ...team, players: playersWithoutCastillo };
  return team;
};

type MatchRosterPlayer = { playerId: string; name: string; fullName?: string; suspended?: boolean; suspensionReason?: string };

const normalizeMatchRoster = (players: MatchRosterPlayer[], teamId?: string | null, teamName?: string) => {
  const withoutCastillo = players.filter((item) => item.playerId !== MR_CASTILLO.playerId);
  const isManchesterCity = teamId === "slovan-bratislava" || teamName === "ŠK Slovan Bratislava" || teamName === "Manchester City";
  return isManchesterCity ? [...withoutCastillo, MR_CASTILLO] : withoutCastillo;
};

export const normalizeFootballMatch = <T extends {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeName: string;
  awayName: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  homePlayers?: MatchRosterPlayer[];
  awayPlayers?: MatchRosterPlayer[];
}>(match: T): T => ({
  ...match,
  ...(match.homeTeamId === "slovan-bratislava" || match.homeName === "ŠK Slovan Bratislava"
    ? { homeName: "Manchester City", homeLogoUrl: "logos/football/manchester-city.png" }
    : {}),
  ...(match.awayTeamId === "slovan-bratislava" || match.awayName === "ŠK Slovan Bratislava"
    ? { awayName: "Manchester City", awayLogoUrl: "logos/football/manchester-city.png" }
    : {}),
  ...(match.homePlayers ? { homePlayers: normalizeMatchRoster(match.homePlayers, match.homeTeamId, match.homeName) } : {}),
  ...(match.awayPlayers ? { awayPlayers: normalizeMatchRoster(match.awayPlayers, match.awayTeamId, match.awayName) } : {}),
});

export const assetUrl = (path?: string) => {
  if (!path) return undefined;
  if (/^(https?:)?\//.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
};
