# Season2App

## Roster Import (before Friday)

1) Set admin credentials (local only, never commit keys):
```
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export FIREBASE_PROJECT_ID="your-project-id"
```

2) Provide a roster input file (JSON or CSV-like).

JSON map (teamId/slug -> players):
```
{
  "red-flame-dragons": ["Ana Perez 8A", "Mr. Juan Gomez", "Luis Soto 10th"],
  "black-wolves": ["Camila Ruiz 11B", "Mr. Carlos Lima"]
}
```

JSON array:
```
{
  "teams": [
    { "teamId": "red-flame-dragons", "players": ["Ana Perez 8A", "Mr. Juan Gomez"] },
    { "teamName": "Black Wolves", "players": ["Camila Ruiz 11B"] }
  ]
}
```

CSV-like (one per line):
```
red-flame-dragons,Ana Perez 8A
red-flame-dragons,Mr. Juan Gomez
black-wolves,Camila Ruiz 11B
```

3) Run the importer:
```
SEASON_ID="s2" ROSTER_FILE="/abs/path/to/roster.json" npm run import:roster
```

Notes
- Trailing grade tokens like `8A`, `11th`, `10` are removed during normalization.
- Names starting with `Mr.` are saved as type `teacher`, otherwise `student`.
- Players are global; existing players (same normalized name) are reused.
- Rosters are upserted as `{seasonId, teamId, playerIds, updatedAt}`.
