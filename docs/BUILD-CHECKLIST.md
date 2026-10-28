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

## Public repository
- [x] Commit the complete golf project and preserve its game-specific history in a standalone public repository.
- [x] Push `main` and verify public visibility and the remote tree against the local game subtree.
- [x] Document clone/run commands, asset provenance, and the original checkout's subtree publishing path.


## Sports pieces and portrait revision — October 27, 2026

This section supersedes the earlier ring and onscreen-golfer implementation checks.

- [x] Sports model, all eight glyphs, canonical art, footprints, and verified model hash.
- [x] Physical Sports player replaces the ring and digital golfer. The requested attached club is the only graphic following the piece.
- [x] Rotation-driven backswing, reversal strike, jitter guard, angular wrap, both directions, and one-shot commitment.
- [x] Club selector: 7 iron, 9 iron, wedge, putter. Full 7 iron reaches the 150-yard green.
- [x] Portrait course, short-edge controls, rigid native coordinate mapping, and safe physical-piece space.
- [x] Updated browser simulator, portrait help, club animation, and fixed aim controls.
- [x] Final npm test: 167 passed, 3 catalog-only skips. Final npm run pack: 18 files, Sports model only.
- [x] Automated full-hole journey: restore, club selection, approach, putt, birdie, rematch, and canceled selector.
- [x] Pause/rebind tests preserve the ball, discard unfinished intent, and avoid a second shot or splash.
- [x] Browser: title, help, address, club selection, full backswing, strike, flight, putting, result, and rematch inspected.
- [x] Native Board: Sports package installed and launched; initial portrait course and club controls verified by screenshot.
- [x] Native Board: football detection, facing changes, ready address, and two rotation-to-shot events observed in logs.
- [ ] Native Board: corrected placement/turn tolerance, all Sports shapes, physical club alignment, pause, saves/audio, and sustained performance.
- [ ] Human: comfortable turn range, uncoached first swing, reliable power control, and short putting feel.


## Attached club and native input correction — October 27, 2026

- [x] Club appears only with a detected Sports piece and disappears on lift.
- [x] Grip attaches to the actual footprint's center front; shaft length scales to piece width across all eight Sports glyphs.
- [x] Stable initial facing calibrates the address; return to the ball commits once and launches immediately.
- [x] Follow-up camera correction: placement, translation, and rotation leave the address camera, terrain, and resting ball fixed; verified in browser and automated rendering checks.
- [x] Tests cover arbitrary initial facing, return-to-address contact, footprint geometry, no-piece rendering, and the complete hole.
- [x] Browser: attachment, proportional size, and no club after lift inspected.
- [x] Native: attached-club build installed and ready address observed; physical shots logged at 80% and 9% power.
- [x] Final native-tolerance and fixed-camera corrections: 178 tests pass, 3 catalog skips; 18-file package installed and launched, with current bundle confirmed in native logs.
- [ ] Native: repeat turns after widened placement and center-drift correction, with no unintended resets.
- [ ] Human: confirm the club's physical connection and size, full-swing comfort, and short-putt control.

## Absent-piece character removal — October 27, 2026

- [x] Remove the character placeholder from play, title, and setup; preserve text guidance and the optional help lesson.
- [x] Browser: place and lift the piece; no club or replacement character remains, and the course stays fixed.
- [x] Native logs: five further hits (91%, 48%, 17%, 100%, 64%), cup capture, and rematch in the fixed-camera build, with no canceled armed swing in that sequence.
- [x] Run tests and pack; install and launch the updated package; confirm the new bundle in native logs.
- [x] Native: two further 100% swings in the no-character build each launch once and finish in the cup; lifting during flight does not interrupt the ball.

## Sports publication — October 27, 2026

- [x] Remove temporary native diagnostics and refresh the README evidence.
- [x] Final verification: 178 tests pass, 3 catalog-only skips; production package builds.

## Correctness review — October 27, 2026

- [x] Review input, lifecycle, physics, save validation, rendering, and UI; run existing tests and the production build.
- [x] Reproduce three defects with isolated automated probes and record them in the acceptance ledger.
- [x] Make slow return swings work across input sample rates; add regression coverage.
- [x] Make landing and scoring consistent across uneven frame durations; add regression coverage.
- [x] Keep one rendering loop through pause/resume before a pending frame executes; add regression coverage.
- [x] Verify old-save compatibility and fractional-step save/restore continuity.
- [x] Re-review the fixes independently; no further actionable findings in the changed code.
- [x] Final automated checks: 190 pass, three catalog-only skips; TypeScript, Vite, and 18-file package pass.
- [x] Browser: piece placement, full swing, pause/resume during roll, short putt, birdie, and retained-piece rematch.
- [ ] Board: validate these corrections with native input, pause, saves, and sustained play.

## Three holes and six clubs — October 27, 2026

- [x] Record the requested par 4, par 5, hazards, driver, and 5 iron in the plan.
- [x] Give the driver a larger rounded head and longer shaft; keep all club attachments outside each Sports footprint.
- [x] Verify driver and 5-iron geometry and disappearance on lift across all eight Sports pieces (7 focused tests pass).
- [x] Update help for the longer clubs, three-hole round, and water penalty.
- [x] Verify all three holes, playable routes, water carries, penalties, sand, and recommended club distances.
- [x] Verify Next hole, accumulated scoring, final scorecard, rematch, and the ten-stroke limit on each hole.
- [x] Verify old saves on hole 1 and new saves on holes 2 and 3.
- [x] Run the complete test suite and pack the final three-hole build.
- [x] Browser: inspect all six club controls, all three courses, hazards, hole transitions, and final results.
- [ ] Board: play the new courses and check the larger driver attachment on the glass.
- [ ] Human: confirm useful club distances, readable hazards, and comfortable three-hole pacing.

- [x] Actual-font layout checks cover six club buttons, both new hole names, scorecards, round totals, help, and hazard cues.
- [x] Keep the default piece and observed football turn playable while reserving clearance for the expanded controls.

- [x] Native: install and launch the three-hole package on KT's Board; confirm current bundle and all six club controls.
