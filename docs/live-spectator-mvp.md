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
- [ ] Firebase Storage client setup
- [ ] Storage rules for public media reads and admin uploads
- [ ] Admin `Add Moment` flow
- [ ] Upload image/video and publish metadata to Firestore
- [ ] Realtime Moments rail below the score
- [ ] Fullscreen story viewer
- [ ] Match timeline powered by the same Moments collection

### P1 — Spectator retention

- [ ] Track viewed Moment IDs locally
- [ ] Show new/unseen Moment state
- [ ] Tournament Home hierarchy: LIVE → Moments → Up Next → Latest Results → Standings preview
- [ ] Previous/upcoming match cards
- [ ] Bottom navigation: Home / Matches / Standings / Teams

### P2 — Polish

- [ ] Mobile responsive pass
- [ ] Skeleton loading states
- [ ] Minimal live/score/story transitions
- [ ] Persistent tournament QR
- [ ] Final visual consistency pass

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
