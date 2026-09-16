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

export const FOOTBALL_2026_TOURNAMENT_ID = "football-2026";

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
    name: "ŠK Slovan Bratislava",
    shortName: "Slovan",
    logoPath: "logos/football/slovan-bratislava.png",
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
      player("Mr. Castillo", "Mr. Castillo"),
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

export const assetUrl = (path?: string) => {
  if (!path) return undefined;
  if (/^(https?:)?\//.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
};
