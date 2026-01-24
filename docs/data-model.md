# Data Model (Multi-season)

All operational data is scoped by `seasonId`. Players are global.

## seasons
- Collection: `seasons`
- Doc ID: `s1`, `s2`, etc.
- Fields:
  - `name` (string)
  - `startDate` (string, ISO date)
  - `isActive` (boolean)

## players (global)
- Collection: `players`
- Fields:
  - `fullName` (string)
  - `type` ("teacher" | "student")

## teams
- Collection: `teams`
- Fields:
  - `seasonId` (string)
  - `name` (string)
  - `slug` (string)
  - `logoFile` (string)

## matches
- Collection: `matches`
- Fields:
  - `seasonId` (string)
  - `dateISO` (string, ISO date)
  - `timeHHmm` (string, 24h time)
  - `homeTeamId` (string)
  - `awayTeamId` (string)
  - `status` ("scheduled" | "completed" | "canceled")
  - `scores` (object: `{ home, away }`)

## rosters
- Collection: `rosters`
- Fields:
  - `seasonId` (string)
  - `teamId` (string)
  - `playerIds` (string[])
  - `updatedAt` (timestamp)

## playerStats (optional)
- Collection: `playerStats`
- Fields:
  - `seasonId` (string)
  - `matchId` (string)
  - `playerId` (string)
  - stats fields as needed

## Notes
- All queries for seasonal data must filter by `seasonId`.
- Players remain global identities across seasons.
