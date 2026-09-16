# Season2App — Tournament Operations Internal Tool

Season2App is a real-time tournament management tool built for a school volleyball tournament. It helps manage teams, rosters, schedules, match results, player statistics, standings and cumulative performance across seasons.

## Problem
The tournament workflow involved manual tracking of fixtures, results, standings and player stats, which created delays, duplicated work and limited visibility for students and staff.

## Solution
I built a web app that centralizes tournament operations and provides real-time visibility for teams, matches, standings and player performance.

## Key Features
- Team and roster management
- Match schedule and match detail views
- Result and player stat entry
- Role-based admin/scorekeeper access
- Firebase-backed real-time data
- Cumulative player statistics across seasons
- Public-facing leaderboard and standings

## Tech Stack
React, TypeScript, Vite, Firebase Auth, Firestore, Tailwind CSS, Chart.js.

## Access roles

- `admin`: manages tournaments, settings, rosters, analytics, matches and scoring.
- `scorekeeper`: opens existing tournaments, creates/edits matches and operates the live scorer. It cannot change tournament settings, view audience analytics or delete matches.

To activate a scorekeeper, have the person sign in once, copy the UID shown on the blocked-access screen (or from Firebase Authentication), then run with Firebase Admin credentials available:

```bash
npm run set:user-role -- <firebase-uid> scorekeeper
```

The app listens for role changes in real time, so access is enabled without requiring another sign-in.



This public demo uses fictional team and participant identities. It contains no personal information from the original tournament.
