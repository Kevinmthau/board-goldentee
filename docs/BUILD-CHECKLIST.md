# Build checklist: Golden Tee

## Design and starter
- [x] Person chose the Bloogs ring, back-then-forward swing, and solo play.
- [x] Person delegated the view; builder chose behind-the-ball perspective.
- [x] Exact Studio starter copied, vendored SDK retained, and dependencies installed.
- [x] Save the Bloogs model and canonical piece assets installed with the supplied script.
- [x] Package identity minted and initial starter pack passed.

## First playable
- [ ] Place the ring at the bottom edge and enter play as the roster player.
- [ ] Back-then-forward swing commits one shot; speed controls power and path controls direction.
- [ ] Ball flies, lands, rolls, and rests; terrain changes the outcome.
- [ ] Putt into the cup; strokes, par, penalties, and stroke limit follow the plan.
- [ ] Result waits for Rematch or Change setup; rematch works with the ring left down.
- [ ] Tests and pack pass for the core loop, followed by a browser visual check.

## Board and teaching
- [ ] Ring identity survives tracking gaps and three pause/resume cycles without a second splash or shot.
- [ ] Stationary holds, moves, rotations, lifts, duplicate glyphs, and wrong-piece input covered by tests.
- [ ] Canonical ring art, direction arrows, optional animated help, and a visible response to misplaced pieces.
- [ ] No game art follows the moving physical ring; real footprint clears teaching and HUD.
- [ ] Roster refresh, selector, long player names, and solo current-profile path verified.
- [ ] Saves and best score use BoardPlatform.state; audio uses gameAudio.
- [ ] Text floors, touch targets, and safe insets inspected through the complete journey.

## Final verification
- [ ] npm test and npm run pack pass for final build.
- [ ] Browser: title, placement, slow/fast swing, putting, result, rematch, help, and pause.
- [ ] Board: real sensing, performance, platform saves, and audio levels. NOT TESTED.
- [ ] Human: uncoached first swing and power control. NOT TESTED.
