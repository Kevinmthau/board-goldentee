# Build checklist: Golden Tee

## Design and starter
- [x] Person chose the Bloogs ring, back-then-forward swing, and solo play.
- [x] Person delegated the view; builder chose behind-the-ball perspective.
- [x] Exact Studio starter copied, vendored SDK retained, and dependencies installed.
- [x] Save the Bloogs model and canonical piece assets installed with the supplied script.
- [x] Package identity minted and initial starter pack passed.

## First playable
- [x] Place the ring at the bottom edge and enter play as the roster player.
- [x] Back-then-forward swing commits one shot; speed controls power and path controls direction.
- [x] Ball flies, lands, rolls, and rests; terrain changes the outcome.
- [x] Putt into the cup; strokes, par, penalties, and stroke limit follow the plan.
- [x] Result waits for Rematch or Change setup; rematch works with the ring left down.
- [x] Core tests (95 pass, 3 catalog-only skips), pack, and initial browser title/placement check passed.

## Board and teaching
- [x] Ring identity survives tracking gaps and three pause/resume cycles without a second splash or shot.
- [x] Stationary holds, moves, rotations, lifts, duplicate glyphs, and wrong-piece input covered by tests.
- [x] Canonical ring art, direction arrows, optional animated help, and a visible response to misplaced pieces.
- [x] No game art follows the moving physical ring; fixed teaching and HUD clear the intended swing lane in the browser. Native footprint clearance remains a Board check.
- [ ] Roster refresh, selector, long player names, and solo current-profile path verified.
  - Solo profile, retained seat, and canceled selector are covered by the boot walk. Native roster changes and long-name layout remain open.
- [x] Saves and best score use BoardPlatform.state; audio uses gameAudio.
- [x] Text floors, touch targets, and safe insets inspected in source and through the browser journey; missing-art fallback is also 48 px.

- [x] Third-person golfer visible at address, animated on backswing and follow-through, then framed at the next lie.

## Final verification
- [x] npm test and npm run pack pass for final build (117 passed, 3 catalog-only skips).
- [x] Browser: title, placement, different swing powers, putting, result, rematch, help, and pause. Actual two-stroke birdie completed with pointer drags.
- [ ] Board: real sensing, performance, platform saves, and audio levels. NOT TESTED.
- [ ] Human: uncoached first swing and power control. NOT TESTED.

## Closer camera and realism pass
- [x] Lower and bring in the address camera; keep the ball and ring lane separate.
- [x] Realistic golfer, photographic coastal sky, textured turf, natural trees, and soft shadows integrated.
- [x] Browser: new address view, backswing, flight transition, and putting visually verified.
- [x] Final tests and package pass; generated art provenance and package inventory updated.

## Natural swing animation
- [x] Continuous active-time tempo, earlier takeaway, exact ball/sound impact, and held finish.
- [x] Unit and boot checks cover frame-rate independence, no pose snap on early strike, one impact, and menu pause during downswing.
- [x] Aligned whole-pose interpolation and club arc visually checked through takeaway, impact, finish, and putting.
- [x] Final browser evidence, tests, and package recorded (127 passed, 3 catalog-only skips).

## Continuous solid swing
- [x] Replace photographic pose blends with one opaque articulated golfer and rigid club.
- [x] Verify planted feet, connected hands, continuous joints, exact contact, and WebGL fallback.
- [x] Inspect intermediate poses, full swing, putting, and pause in the browser.
- [x] Run final tests and pack; update provenance and handover evidence (137 passed, 3 catalog-only skips; 14-file package).
- [ ] Board: native GPU performance and physical swing feel remain untested.

## Native installation
- [x] Current package installed and launched through Board Connect; title screen and 3D golfer confirmed in a native screenshot.
- [ ] Complete the remaining Board sensing, performance, native platform, and human play checks above.
