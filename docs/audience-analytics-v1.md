# Audience Analytics V1

## Goal
Measure spectator adoption without requiring a spectator account, login, email, name, phone number, or password.

The public experience remains:

**QR → Tournament Hub → Match → Live data**

Audience measurement runs silently in the background.

## Architecture
Audience Analytics V1 combines three layers:

1. **GA4** for page/session/engagement analytics and traffic acquisition.
2. **Anonymous local IDs** for stable browser-level visitor/session estimates without collecting identity data.
3. **Firestore heartbeat documents every 60 seconds while the page is visible** for live audience estimates and concurrent-viewer calculations.

### Anonymous identifiers
- `visitorId`: random UUID persisted in `localStorage`.
- `sessionId`: random UUID persisted in `sessionStorage`.
- No fingerprinting.
- No spectator profile.
- No name, email, phone number, password, school, age, or player identity is collected by this feature.

### Firebase Anonymous Authentication
Firestore heartbeat writes are protected with Firebase Anonymous Authentication.

The spectator does **not** see a login or registration screen. Firebase silently assigns an internal anonymous `uid` to the browser so Firestore rules can verify that the client owns its heartbeat writes.

This anonymous auth UID is security plumbing, not a spectator account experience.

## Events
GA4 events:
- `tournament_open`
- `match_open`
- `audience_heartbeat`

Common parameters:
- `tournament_id`
- `match_id`
- `traffic_source`
- `audience_scope` for heartbeat events

## Firestore
Collection:

`pilotAudienceHeartbeats`

One deterministic heartbeat document is written per authenticated browser + audience scope + minute bucket. Duplicate heartbeats in the same minute overwrite the same document rather than inflating the count.

Fields:
- `version`
- `authUid`
- `visitorId`
- `sessionId`
- `scope`: `TOURNAMENT` or `MATCH`
- `tournamentId`
- `matchId`
- `source`
- `minuteBucket`
- `clientSeenAt`
- `serverSeenAt`

Heartbeats only fire while `document.visibilityState === "visible"`.

## Admin metrics
The tournament dashboard calculates:
- Watching now (90-second active window)
- Unique visitors
- Unique match viewers
- Peak concurrent viewers by minute
- Repeat viewers
- Average tracked viewer-minutes
- Viewers + peak concurrency by match
- Top traffic sources

These are anonymous browser/device-level estimates, not verified human identities.

## QR attribution
Tournament QR codes now point to:

`/live/{tournamentId}?src=qr`

The `src` value is persisted for the browser session so navigation from the hub into a match keeps the original acquisition source.

Other campaign links can use the same convention, e.g.:
- `?src=whatsapp`
- `?src=instagram`
- `?src=school_screen`

## Manual setup required before production heartbeat tracking works
### 1. Enable Firebase Anonymous Authentication
Firebase Console → Authentication → Sign-in method → Anonymous → Enable.

No spectator UI changes are required after enabling it.

### 2. Deploy the updated Firestore rules
The GitHub Pages workflow only deploys the frontend. It does **not** deploy Firestore rules.

From a trusted Firebase CLI environment:

```bash
firebase deploy --only firestore:rules
```

Do not expose Firebase Admin credentials in the frontend or repository.

### 3. Verify GA4
The Firebase web config already contains measurement ID:

`G-3FGSQNXL5N`

After deployment, verify `tournament_open`, `match_open`, and `audience_heartbeat` in GA4 Realtime/DebugView.

## Cost discipline
For the pilot, one visible spectator produces at most one Firestore heartbeat write per minute per active scope.

Example: 100 viewers × 60 minutes ≈ 6,000 heartbeat writes for one hour of match viewing.

This design intentionally avoids 5–10 second heartbeats and avoids writing a separate event plus presence document every minute.

## Interpretation caveats
- One person using two browsers/devices can count twice.
- Two people sharing one phone count once.
- Clearing browser storage can create a new anonymous visitor ID.
- Ad blockers may block GA4 while Firestore heartbeat tracking still works.
- Firebase Anonymous Authentication must be enabled or heartbeat writes will fail; GA4 can still work independently.

For MVP validation, this is sufficient fidelity to evaluate audience demand without adding spectator registration friction.
