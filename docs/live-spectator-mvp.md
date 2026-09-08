# LiveScore Spectator MVP

## Product direction

**Apple Sports for live information + NBA App for audiovisual emotion.**

Primary spectator loop:

**Tournament QR → tournament hub → live match → live score → moments → fullscreen story viewer → timeline → return for new content.**

## Definition of done

The MVP is successful when an organizer can:

1. Open the scorer/admin surface on one phone.
2. Update the score and see it appear in real time on the spectator phone.
3. Upload a photo or video as a Moment.
4. See that Moment appear without refreshing the spectator page.
5. Open it fullscreen and move between Moments.
6. Return to the match and continue following the live score.

## Priority order

### P0 — Must work

- [x] Public tournament route (`/live/:tournamentId`)
- [x] Public match route (`/live/:tournamentId/match/:matchId`)
- [x] Firestore realtime score subscription
- [x] Live Score Hero redesign — mobile-first, score is the visual hero
- [x] Moment data model
- [x] Firebase Storage client setup
- [x] Storage rules for public media reads and admin uploads
- [x] Admin `Add Moment` flow
- [x] Upload image/video and publish metadata to Firestore
- [x] Realtime Moments rail below the score
- [x] Fullscreen story viewer
- [x] Match timeline powered by the same Moments collection

### P1 — Spectator retention

- [x] Track viewed Moment IDs locally
- [x] Show new/unseen Moment state
- [x] Tournament Home hierarchy: LIVE → Moments → Up Next → Latest Results → Standings preview
- [x] Previous/upcoming match cards
- [x] Bottom navigation: Home / Matches / Standings / Teams

### P2 — Polish

- [x] Mobile responsive pass
- [x] Skeleton loading states on live match view
- [x] Minimal live/score/story transitions
- [x] Persistent tournament QR
- [x] Final visual consistency pass

## Explicitly out of scope for this 48-hour MVP

- AI-generated content
- automatic highlight detection
- video editing
- rendered overlays
- music
- automatic reels
- push notifications
- spectator accounts
- chat/comments/likes
- advanced statistics
- full player profiles
- fantasy/rankings
- livestreaming
- camera integration

## Metrics to instrument later

- QR scans
- unique spectators
- Moment opens
- Moments opened per spectator
- repeat visits
- Moment Open Rate = spectators opening at least one Moment / total spectators

## Current implementation state

P0, P1 and P2 implementation are complete in `feature/live-spectator-mvp`.

GitHub Actions production builds pass after the spectator retention and mobile-polish changes.

### Remaining release validation

These are release steps, not missing application features:

- [ ] Deploy `storage.rules` to Firebase Storage.
- [ ] Run the two-phone acceptance test:
  - scorer phone updates score;
  - spectator phone receives score in realtime;
  - scorer phone publishes an image/video Moment;
  - spectator phone receives it without refresh;
  - Moment opens fullscreen and navigation works;
  - returning to the match preserves the live experience;
  - reopening the page shows viewed vs new Moments correctly.
- [ ] Merge `feature/live-spectator-mvp` into `main` only after the acceptance test passes.
