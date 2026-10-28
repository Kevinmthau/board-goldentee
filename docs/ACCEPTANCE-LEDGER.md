# Acceptance ledger: Golden Tee

## October 27, 2026 — Design and starter preparation

- Asked for: a Golden Tee inspired web game from Studio starter, with design questions along the way.
- Agreed: solo, Bloogs ring back-then-forward swing, direction arrows; view delegated to builder.
- appId: e087aaee-903b-43a2-b2b9-bbd4189601b2.
- Piece set: save-the-bloogs, Ring glyph 1.
- Source: starter, platform, SDK input guide, and piece inventory inspected.
- Unit: not run yet.
- Package: initial unchanged starter packed successfully with the correct model.
- Browser: NOT TESTED yet.
- Board: NOT TESTED.
- Human: NOT TESTED.

## October 27, 2026 — Playable solo par-3 and third-person golfer

- Requested change: “I want to see the golfer third person style.”
- Delivered: visible golfer at address with backswing, strike, and follow-through; camera follows the ball and reframes the golfer at the next lie. Bloogs ring movement controls the shot, with fixed direction arrows.
- Source evidence: reviewed Canvas rendering, cached scenery, text floors, fixed teaching area, SDK contact identity, platform state/audio integration, and retained package IDs. Browser simulator code is excluded from the package.
- Unit evidence: `npm test` — 120 tests, 117 passed, 0 failed, 3 skipped. Skips require the plugin's full piece catalog, which is not shipped in this game. Coverage includes deliberate swing, jitter, wrong glyphs, duplicate instances, tracking gaps, three pause epochs, terrain and cup physics, penalties, saves, complete hole, rematch, and canceled selector.
- Build evidence: `npm run pack` — TypeScript and Vite passed; 12-file `golden-tee.webapp.zip` includes Save the Bloogs model and the platform layer. appId and packageId are unchanged.
- Browser evidence: at `http://localhost:5173/`, used the visible simulator toolbar and pointer drags to place the ring, swing at varied powers, approach, putt, and finish in two strokes. Rematch returned to zero strokes with the ring retained. Help/back and pause/resume were exercised. Address, held backswing, follow-through, ball flight, next lie, and result were visually inspected.
- Screenshot evidence: `docs/screenshots/third-person-ready.png`, `third-person-backswing.png`, and `birdie-result.png`. Earlier `course-before-golfer.png` records the replaced view.
- Final reload: no new browser console warnings or errors; the absent optional font configuration falls back cleanly to the bundled font.
- Board evidence: NOT TESTED. Real sensing and occlusion, performance, native platform saves, roster changes, and speaker mix need a device pass. Long-name layout needs a focused check.
- Human evidence: NOT TESTED. No uncoached first swing or physical power-control feedback yet.
- Acceptance: browser-playable prototype; native and human acceptance remain open.

## October 27, 2026 — Closer camera and realistic graphics

- Asked for: closer Golden Tee-style camera using the supplied arcade screenshot as framing reference, followed by more realistic graphics.
- Delivered: lower, closer address camera (17.2 distance / 6.34 height) and a larger foreground golfer; slightly closer putting view; wider camera during flight. Four realistic transparent golfer poses, photographic coast, natural turf material, detailed foliage, and soft cached shadows.
- Source: generated images load once; turf is baked to 256×256; terrain and shadows are cached; original procedural fallbacks remain. No per-frame filters, shadowBlur, or pixel reads. The Board model, contact handling, roster, rules, IDs, saves, and controls are unchanged.
- Unit: `npm test` — 117 passed, 0 failed, 3 catalog-only skips. No new tests were added for this visual change.
- Package: `npm run pack` passed TypeScript, Vite, and web-pack. All 15 shipped files are recorded in the asset manifest, including three original built-in imagegen assets and their exact prompts.
- Browser: inspected address and held backswing; performed forward swings and saw the follow-through before the camera followed the ball. Putting views at 24 and 43 feet kept golfer, ball, cup, distance, and fixed ring cues readable. Saved `realistic-close-address.png`, `realistic-close-backswing.png`, and `realistic-close-putting.png` as evidence. Final reload and shot produced no new console warnings or errors.
- Board/Human: NOT TESTED. Native performance and physical play feel still require the checks already open in the build checklist.

## October 27, 2026 — Smoother, natural swing

- Asked for: smoother and more natural golfer swing animation.
- Delivered: a fuller photographic pose sequence with aligned soles/head height and whole-pose interpolation, a continuous club arc, earlier takeaway anticipation, a faster downswing and eased held finish. Putting uses a small pendulum motion. The same original character, closer camera, and ring gesture remain.
- Contact: a stroke commits only once; ball simulation and the hit cue wait 140 ms for iron/wedge contact or 160 ms for putter contact. Only the portion of a crossing frame after contact advances the ball. The camera eases away after contact.
- Pause: all swing timing uses active dt. The boot regression pauses during a downswing, checks the saved ball stays at its lie, resumes to contact, and verifies only one stroke was counted. A committed shot still saves its launch velocity for restoration.
- Unit: `npm test` — 130 total, 127 passed, 0 failed, 3 full-catalog skips. Nine added animation checks cover continuity, exact impact, one-shot events, frame-rate independence, early strike, cancel, finish, reset, invalid dt, and a bounded long frame. A real-SDK regression covers a fast finger tap completed before one simulator frame.
- Browser: inspected the development motion sequence and live game; performed a held backswing, iron forward swing, camera transition, and compact putt, completing a two-stroke birdie. The character retains complete anatomy through the selected intermediate poses. Evidence: `docs/screenshots/swing-sequence.png` and `smooth-swing-backswing.png`.
- Simulator: fixed same-frame pointer down/up coalescing that could drop a quick tap. Verified quick taps on How to play and Back after reload. This changes only the development host; native contacts are unchanged.
- Package: final TypeScript/Vite/platform/web-pack build passed with stable appId/packageId and 15 files. The new built-in imagegen artwork and exact prompt are recorded in the asset manifest. The previous sheet and development reviewer are not packaged.
- Board/Human: NOT TESTED. Device performance, audio mix, and physical swing feel remain open; browser motion does not establish these.

## October 27, 2026 — Continuous swing without pose ghosting

- Asked for: “one continuous motion without the ghosting between poses.”
- Delivered: one opaque articulated 3D golfer with continuous joint motion and a rigid club. The hands share the shaft, the lead foot stays planted, and the trailing heel rises into the finish. Coral polo, navy trousers, cream cap, closer framing, and the existing photographic course remain. The golfer is now shaded geometry rather than photographic keyframes.
- Rendering evidence: a reusable 768×768 WebGL 1 surface clears color and depth before each changed pose, draws opaque geometry, and composites once into the 1920×1080 Canvas 2D course. Stationary poses and geometry are cached. No pose images, cross-fades, motion blur, pixel reads, or new runtime dependency. A continuous Canvas fallback handles absent or failed GPU initialization.
- Timing: existing 140/160 ms contact, ball/audio release, active-time pause behavior, and once-committed shot are unchanged.
- Unit: `npm test` — 140 total, 137 passed, 0 failed, 3 full-catalog skips. Six rig checks cover limb/shaft lengths, attached hands, contact, continuous joint trajectories, stable anatomical frames, planted toes/lead foot, and heel lift. Four renderer checks cover missing WebGL, null context, context creation exceptions, and shader setup exceptions, including no repeated failing initialization. Existing boot/timing regressions continue to pass.
- Browser: inspected address and intermediate/full backswing and follow-through poses in the development reviewer, then used actual pointer drags in the game for an iron, wedge, and compact putt. Completed a three-stroke par. Paused and resumed with an unfinished backswing without adding a stroke, then made a fresh stroke. Rematch retained the ring and returned to zero strokes.
- Evidence: `docs/screenshots/solid-swing-sequence.png`, `solid-swing-backswing.png`, `solid-swing-ready.png`, and `solid-swing-par.png`. Final reload and ring placement produced no new browser console warnings or errors; preview is left at the tee, ready to swing.
- Package: TypeScript, Vite, platform build, and web-pack passed; 14 files with the existing appId/packageId and unchanged Board model. Removed the unused photographic motion sheet from the shipped package and preserved it under docs/art-reference.
- Board/Human: NOT TESTED. The added offscreen GPU rendering still needs native performance verification, along with the existing sensing/audio/physical-feel checks.

## October 27, 2026 — Installed on Board

- Asked for: “install on the board.”
- Package verified: all 14 archive files match the current dist build byte-for-byte; appId and packageId match board.config.json.
- Device: `board-connect status` reported `ready: true`. `board-connect install golden-tee.webapp.zip --launch` confirmed installation and launch of e087aaee-903b-43a2-b2b9-bbd4189601b2.
- Native startup evidence: `docs/screenshots/board-first-launch.png` shows the title screen, course, rendered 3D golfer, and Bloogs ring instruction on the Board at 1920×1080. Startup logs report platform state ready, no-save. The only warnings are 404s for the optional game-font.json and favicon.ico; no game exception is reported.
- Scope: installation, launch, and initial native rendering are verified. Physical ring sensing, sustained animation performance, native pause/saves/audio, and an uncoached human playthrough remain open.

## October 27, 2026 — Public repository handover

- Asked for: “commit and push all changes and create a public github repo.”
- Delivered: https://github.com/Kevinmthau/board-goldentee with public visibility and default branch `main`. Game-specific history is preserved; the repository root contains the complete golf project.
- Verification: GitHub repository metadata confirms PUBLIC/main. The pushed commit matches the locally split branch, and the remote root tree matches the local game's subtree. Source, docs, art, screenshots, vendor SDK, package lockfile, Board configuration, and tests are included. Generated dist, dependencies, and the install ZIP remain ignored.
- Publication check: tracked current files, historical game blobs, and the vendored SDK archive were checked for obvious credentials/private keys and oversized files; none were found.
- Validation: game code and the installed package are unchanged from the preceding verified build (137 tests passed, 3 catalog-only skips). This handover adds publication documentation and README improvements; no new runtime test pass was required.


## October 27, 2026 — Sports rotation, club choice, and portrait

- Asked for: Sports pieces replacing the golfer and Bloogs ring, backward-facing windup and reverse-twist strike, selectable clubs, 7-iron range, and portrait play.
- Delivered: all eight Sports glyphs control one solo golfer. The physical piece replaces the rendered person. The club remains at the digital ball. A larger turn increases power; reversing commits one shot.
- Source: verified Sports model SHA-256 `4d75343e149b72f8410cad10f518c64791634ae6e6932880088a34c164026ad9`. Facing comes from pieceFootprint, then a rigid portrait rotation. Native input and framebuffer retain 1920×1080 units. App and package identity are unchanged.
- Clubs: explicit 7 iron, 9 iron, wedge, and putter. Measured full shots reach approximately 150, 124, and 59 yards; a full putt reaches approximately 37 yards on a green. A fresh lie recommends a club, and the player can override it.
- Unit: `npm test` — 170 total, 167 passed, 0 failed, 3 full-catalog skips. Includes nineteen twist/lifecycle tests, five portrait mapping tests, club distance and save checks, seven browser-simulator checks, and three course timing checks.
- Integration: the actual main module completes saved-run restoration, club selection, 2-degree aim, a full 7-iron approach, short putt, birdie, retained-piece rematch, and canceled player selector. Pause during the downswing freezes impact; three further pause cycles do not add a stroke. No test-only gameplay hooks.
- Browser: inspected title, portrait help, Sports placement, 9-iron and 7-iron selection, analog windup, reversal strike, flight, green/putting view, result, and rematch. A straight full 7 iron completed a hole in one. The final browser build completed a 2-degree approach and 34% putt for a two-stroke birdie, then rematched. No browser warnings or errors were recorded. Pausing an unfinished backswing restored zero strokes and required a fresh address.
- Layout fixes from review: moved the power percentage clear of the ball; put club distances inside the buttons; moved the swing cue above them. The center of the physical player area is clear, including the tennis player's larger footprint.
- Evidence: `docs/screenshots/sports-portrait-ready.png`, `sports-portrait-backswing.png`, `sports-portrait-help.png`, `sports-portrait-putting.png`, and `sports-portrait-birdie.png`. Browser screenshots include a simulator-only Sports proxy. No such proxy ships on Board.
- Package: TypeScript, Vite, platform, and web-pack pass. All eighteen archive files match dist byte-for-byte. Sports model.tflite is the only model; simulator and old golfer renderer are excluded from the runtime bundle.
- Rubric: browser gates pass for cold start, first action, complete loop, golf identity, readable controls, and piece-area clearance. Visual review scores: request fidelity 9/10; gameplay clarity 8/10; asset coverage 8/10; visible feedback 8/10; browser stability 8/10. These do not establish hardware performance or physical feel.
- Native: NOT TESTED for this revision. Check Sports detection and face direction, left short-edge reach, pause redetection, saves, audio levels, and sustained frame rate. Previous ring-build installation evidence does not apply.
- Human: NOT TESTED. Confirm whether a 150-degree full backswing is comfortable, the reverse motion is obvious, and small turns make predictable putts. Very long profile names still need a layout check.


## October 27, 2026 — Sports build installed on Board

- Asked for: install this version so the person can try the Sports pieces.
- Package: verified all eighteen archive files against dist. Confirmed the Sports model hash and unchanged app/package identity.
- Device: Board Connect reported ready. Installation and launch succeeded for `e087aaee-903b-43a2-b2b9-bbd4189601b2`.
- Native rendering: `docs/screenshots/sports-portrait-board-launch.png` shows the portrait course, four club buttons, Sports placement prompt, and zero-stroke tee state. The game faces the left short edge.
- Startup logs: platform state reported restored and the current `index-C3bYvPfS.js` audio context started running. No game exception appeared. The optional game-font.json and favicon returned the existing 404 warnings.
- Scope: installation, launch, and native initial rendering are verified. Physical Sports sensing, comfortable twist range, sustained frame rate, and a complete human playthrough remain open.


## October 27, 2026 — Native Sports debugging and attached club

- Asked for: watch Board logs during Sports swings; show the club only with the physical piece, attach it to the center front, and size it naturally.
- Diagnosis: the native football glyph 6 appeared at portrait (301,1233), facing 41 degrees. It was detected correctly but rejected by the hidden placement and fixed-facing gates. Subsequent logs also showed a small movement crossing the placement boundary and a turning piece exceeding the old 48 px translation limit.
- Delivered: a footprint-derived center-front club, scaled to 1.25 piece widths for irons and 1.1 for the putter. No detected piece means no club. The settled initial facing becomes the address, and returning through that angle launches the ball immediately. A temporary neutral-club-head camera alignment was superseded by the follow-up request below.
- Rule resolution: the person's explicit attached-club request overrides the generic moving-piece-decoration rule for this club only. There is no accompanying halo, outline, trail, or rendered golfer.
- Initial automated evidence: `npm test` — 179 total, 176 passed, 0 failed, 3 full-catalog skips. Includes all-eight-footprint attachment/scale checks, arbitrary-facing and return-to-address input, immediate contact, portrait transforms, simulator, and complete-hole integration. The subsequent native-tolerance correction needs a fresh pass below.
- Initial package/device evidence: the attached-club build `index-BaSMCQ8V.js` packed with eighteen files and launched successfully through Board Connect with unchanged app/package identity and Sports model.
- Browser evidence: visually inspected the attached club and its proportional size; lifting the simulator piece removed the club. Browser observation does not establish physical overlap on glass.
- Native evidence: at 21:01:40 the football bound as owner 1 and reached `stage:ready` at facing 41 degrees. At 21:02:16.542 owner 9 committed one shot at 80% power; at 21:02:52.824 owner 17 committed one at 9%. These establish physical detection, angle changes, ready state, and rotation-to-shot events.
- Evidence limits: owner 19 later reached backswing power and reset when its center moved beyond the old translation guard. The two successful commits do not establish reliable power control, full 7-iron reach on hardware, or a completed native hole. Broader placement and realistic turning-drift tolerance are being corrected from this evidence.
- Screenshot: `docs/screenshots/sports-attached-board.png` records native rendering of this revision. Physical pieces themselves are not part of the framebuffer capture.
- Follow-up request: the camera must not move when placing or turning the piece. Removed piece-derived projection offsets: only the attached club moves; ball-following camera motion begins after a hit.
- Final automated evidence: `npm test` — 181 total, 178 passed, 0 failed, 3 full-catalog skips. Camera regression checks the unchanged ball position and cached terrain through placement, a 60-degree turn with 40 px translation, and lift. Native-motion replay preserves the logged football backswing through 89 px of drift; a separately labelled synthetic return commits once, while sliding alone cannot arm and movement beyond 120 px cancels.
- Final browser evidence: placement, a 100% backswing, and lift leave the course and resting ball fixed. The club follows the piece and disappears on lift. Evidence: `sports-attached-ready.png`, `sports-attached-backswing.png`, and `sports-attached-lifted.png` in `docs/screenshots`.
- Final package/device evidence: `npm run pack` passed; 18-file package with bundle `index-Cjdf_Yg2.js` and platform build `b26be5e006bb5894`. Installed and launched successfully. At 21:04:35 native logs confirmed this bundle running in the title/ready state. Sports model and app/package identities remain unchanged.
- Open: repeat native turns without reset, physical center-front alignment/scale, all Sports shapes, full-swing and putting comfort, native pause/saves/audio, sustained frame rate, and uncoached human play. Temporary geometry-only diagnostics remain enabled for the active playtest; remove them before publication.

## October 27, 2026 — Further native swings and no character on lift

- Asked for: watch more Sports swings and stop showing the character when the physical piece is picked up.
- Delivered: removed the absent-piece illustration from play, title, and setup. Optional help still illustrates the control. No changes to swing interpretation or camera behavior.
- Native play evidence: `index-Cjdf_Yg2.js` logged five accepted hits at 91%, 48%, 17%, 100%, and 64% between 21:13:21 and 21:14:13. It reached `phase:holed` at 21:14:15.655 and returned to play/ready for a rematch at 21:14:18.614. No armed backswing canceled in that sequence; a roughly 145 px reposition before swinging correctly exceeded the 120 px drift guard.
- Browser: placed and lifted the simulated Sports piece. The course remained fixed and both club and character were absent after lift. Evidence: `docs/screenshots/sports-no-character-lift.png`.
- Automated: 181 total tests, 178 passed, 0 failed, 3 catalog skips. Build and 18-file package passed.
- Device: installed and launched bundle `index-C8-x7YC7.js`, platform build `378b8232f1780570`. Native logs confirmed this bundle at 21:15:13 with no piece present. App/package identity and Sports model are unchanged.
- Post-install play: football owner 1 reached 100% backswing and committed exactly one shot at 21:15:44.333. Flight progressed to rolling, lift was detected at 21:15:49.088, and the ball was holed at 21:15:50.803. The person then opened Change setup. Screenshot `sports-no-character-board.png` captures the attached club during the native address; the physical piece itself is not in framebuffer captures.
- Second post-install round: football owner 20 committed a 100% shot at 21:16:14.371, then lifted during flight at 21:16:15.909. The ball continued through rolling and holed at 21:16:20.843. Neither of the two full-power swings reset or double-fired. The earlier setup placement briefly crossed the outer x940 boundary, then rebound at x900 without a shot.
- Limits: the successful native sequence verifies actual swings and cup capture, not comfortable physical scale, every Sports shape, native pause/saves/audio, sustained performance, or uncoached teaching. Temporary geometry diagnostics remain available for this playtest.

## October 27, 2026 — Publication preparation

- Asked for: commit and push all changes to the existing game repository.
- Removed temporary native geometry diagnostics as required by the device-debug workflow. No gameplay, camera, input thresholds, assets, or package identity changed in this cleanup.
- Verification: `npm test` — 181 total, 178 passed, 0 failed, 3 catalog skips. `npm run pack` passed with 18 files, bundle `index-DB2vOyzY.js`, platform build `d6c05ace441382a6`. The preceding installed playtest build remains on Board; this logging-only cleanup was build-tested locally.
- Scope: source, tests, Sports model/art/footprints, simulator, documentation, and screenshots are included. Scratch logs, dependencies, build output, and the install ZIP remain outside Git.

## October 27, 2026 — Bugs and correctness review

- Asked for: review the app for bugs and correctness issues.
- Source: reviewed the current game, input controller, runtime, seating, save validation, physics, rendering, simulator, and related tests. No gameplay or asset files changed.
- Existing automated checks: `npm test` passed with 178 passes, zero failures, and three full-catalog skips. `npm run build` passed TypeScript and Vite.
- Confirmed P2, slow returns: `src/piece-control.ts:290` counts a return sample only when its reverse movement exceeds 0.5 degrees. An isolated controller probe used a 60-degree backswing and a 30-degree-per-second return. At 20/30 Hz it committed; at 60/120 Hz it reached address without a shot. This speed exceeds the configured 25-degree-per-second minimum. Measure accumulated reverse movement and add sample-rate coverage.
- Confirmed P2, scoring depends on frame timing: `src/rules.ts:148–154` keeps the position beyond the exact ground crossing before reducing velocity. A straight 7-iron shot at power 0.997 holes at 59/61 FPS but stops at z=148.9906503333 at 60 FPS. At power 0.9977, fixed 60 FPS misses; alternating `1/60 - 0.001` and `1/60 + 0.001` seconds holes. Resolve ground contact within the step or use a persistent fixed-step accumulator. Add uneven-frame coverage.
- Confirmed P2, duplicate rendering loops: `src/main.ts:258–259` schedules a new frame on resume without canceling an earlier pending frame. A probe booted the real main module with a queue that retained every animation-frame callback. Pause and resume before executing the pending callback increased callbacks per frame from one to two; a second cycle increased them to three. Each duplicate continued scheduling itself. Track and cancel the pending frame. The current boot test stores only one callback and cannot detect this.
- Coverage gaps: actual native sample rates and pause scheduling, native save/profile behavior, sustained rendering performance, and long-name layout remain unverified. Malformed saves can contain inconsistent phase/stroke combinations; normal gameplay does not produce the inspected examples.
- Evidence level: source, existing tests, production build, and isolated automated reproductions. No new browser, Board, or human playtest. No package installation or publication. Findings remain open.

## October 27, 2026 — Correctness fixes and repeat review

- Asked for: fix all three findings, add regression tests, and review again until clear.
- Input: qualify return samples by angular speed, preserving the two-sample guard. A new matrix covers 20/30/60/120 Hz, both directions, 40/60-degree backswings, and 26/30/90-degree-per-second returns. Below-minimum returns and one jump followed by slow drift do not strike.
- Physics: retain fractional active time between fixed 1/120-second steps. Landing, terrain, cup, and boundary decisions now use the same simulation steps across render rates. Completion clears unused time. Version-1 saves without the new field migrate to zero; valid fractional time survives JSON save/restore in flight and rolling.
- Lifecycle: cancel the pending animation frame on pause and schedule through one guarded function. Paused boot schedules nothing. Duplicate resume notifications preserve the active gesture. The first resumed frame excludes paused wall time.
- Regression evidence: the slow-return, near-cup scoring, and rapid pause/resume tests each failed the original implementation before its fix. The boot mock now keeps every pending callback and reproduces browser cancellation behavior.
- Final automated: `npm test` reports 193 total, 190 passed, zero failures, and three unchanged full-catalog skips. Twelve added tests/subtests cover the corrections and adjacent boundaries. The full restore, club selection, approach, putt, result, and rematch journey still passes.
- Repeat review: each fix received source review after implementation. Independent physics review compared 192 combinations of lie, club, aim, and power across fixed timing, irregular timing, and JSON restore; final states matched exactly. No further actionable findings remained in the changed code.
- Browser: the current local build accepted placement, a 99% 7-iron swing, pause/resume during rolling, and a 20% putt. It finished with a two-stroke birdie, then rematched with the piece retained. Evidence: `docs/screenshots/correctness-fixes-birdie.png`.
- Package: `npm run pack` passed TypeScript, Vite, and web-pack. Verified all 18 archive files against dist. Bundle `index-BzE_yp0q.js`, platform build `6a85e77fcfe43daa`. Sports model SHA-256 remains `4d75343e149b72f8410cad10f518c64791634ae6e6932880088a34c164026ad9`; app and package identities are unchanged.
- Board and human: NOT TESTED for this correction. No installation or publication. Existing native platform, all-piece, sustained-performance, and uncoached-teaching checks remain open.

## October 27, 2026 — Correctness publication

- Asked for: commit and push all changes to the game repository.
- Scope: reviewed fixes, twelve regression tests/subtests, project documentation, browser screenshot, and the generated Codex environment file. Build output, dependencies, and the install ZIP remain ignored.
- Validation: the preceding 190-test pass, package verification, browser playthrough, and independent re-review cover the unchanged game code. Final diff and publication checks found no blockers.
- Destination: `https://github.com/Kevinmthau/board-goldentee`, branch `main`, through the existing game-subtree publishing workflow. Native installation is outside this request.

## October 27, 2026 — Three holes, hazards, driver, and 5 iron

- Asked for: two additional holes, a par 4 and par 5 with hazards, plus clubs including a driver and 5 iron.
- Delivered: Lagoon Bend, a 340-yard par 4, and Pelican Reach, a 510-yard par 5. Both have water and sand hazards. The original 150-yard par 3 remains first.
- Round flow: three holes, total par 12, an explicit Next hole choice, per-hole scores, accumulated totals, and a final Rematch or Change setup choice. Each hole retains the ten-stroke cap.
- Clubs: driver approximately 250 yards and 5 iron approximately 185 yards. Existing 7 iron, 9 iron, wedge, and putter remain selectable. The driver has a rounded head and longer attached shaft.
- Source review: hazards share the renderer's hole geometry. Water applies only on ground contact; recovery adds one penalty and restores the preceding safe lie. Sand takes precedence where bunkers cut into greens. Terrain caches change with the hole.
- Save review: existing version-1 single-hole saves migrate to hole 1. New saves retain the current hole, preceding scores, ball state, and fractional physics step. Three-hole best scores use a separate progress key; old single-hole records remain intact.
- Existing work preserved: imported the current golf branch and its uncommitted slow-return, fixed-step physics, and pause-loop fixes into this initially older worktree. No primary-checkout edits were made.
- Automated evidence: `npm test` — 211 total, 208 passed, zero failures, three full-catalog skips. Coverage includes all three completed holes through real main-module contacts, explicit advancement, all clubs, rematch, water/sand, old and new saves, and inconsistent-save rejection. Regression checks retain the observed football position and turning drift.
- Layout evidence: actual Kabel font measurements fit the six controls, hole names, help, hazard cue, totals, and scorecard columns. Reserved placement space clears the new controls; power appears as a fixed percentage beside the default piece.
- Browser evidence: inspected title, help, six-club layout, all three tee views, and the longer-hole camera. A real pointer-driven full 5-iron shot on the par 5 landed in water, returned to the tee, and showed two strokes including the penalty. A full driver carried the lake and rested 259.1 yards from the cup with one stroke. No errors appeared in the ordinary game preview.
- Browser result evidence: developer-only validated save fixtures showed the second-hole scorecard, Next hole entering the par 5, the 12-stroke/par-12 final scorecard, and Rematch returning to hole 1. These fixture views do not claim a manual full-round playthrough; the full round is covered by the automated contact journey.
- Evidence images: `docs/screenshots/three-hole-par4-tee.png`, `three-hole-water-recovery.png`, `three-hole-par5-carry.png`, `three-hole-scorecard.png`, and `three-hole-round-result.png`.
- Build evidence: TypeScript, Vite, and `npm run pack` pass. The 18-file package uses `index-BwgBIobr.js`, platform build `04ce0759370c492b`, the unchanged Sports model, and unchanged app/package IDs. Developer fixtures and browser simulator are excluded.
- Package SHA-256: `fdb86a9948b525e71a62053cc7991131d8985ad5f97ca671a086d583c70d87b3`.
- Board: this revision was not installed or played on hardware. Human checks remain open for physical driver clearance, hazard readability at the table, club feel, and three-hole pacing.


## October 27, 2026 — Install the three-hole build on KT's Board

- Asked for: install the new holes and clubs on the person's Board for playtesting.
- Installed and launched the previously verified package through Board Connect on KT's Board. Existing app/package IDs were retained; no app removal or save deletion occurred.
- Package: SHA-256 `fdb86a9948b525e71a62053cc7991131d8985ad5f97ca671a086d583c70d87b3`, 18 files, bundle `index-BwgBIobr.js`. Package inspection confirms both new hole definitions, driver, and 5 iron, with no developer fixture or browser simulator.
- Native startup: platform state became ready at 21:32:00; the new bundle reported running audio at 21:32:01. Logs included optional favicon and game-font.json 404 warnings; the bundled Kabel font rendered correctly.
- Native screenshot: `docs/screenshots/three-hole-board-installed.png` shows hole 1/3, par 3, zero strokes, and all six club controls. The game is waiting for a Sports piece.
- Evidence limit: installation, launch, current bundle, and native rendering are verified. New-hole play, physical driver clearance, hazard readability, and round pacing still require the person's playtest.


## October 27, 2026 — Three-hole merge and publication

- Asked for: merge, commit, and push the completed new holes and clubs.
- Integration: combine the three-hole work with the published correctness branch. Preserve the preceding fixes, regressions, review records, and browser screenshot.
- Destination: `https://github.com/Kevinmthau/board-goldentee`, branch `main`, through the established golf-subtree workflow.
- Pre-merge evidence: 208 tests passed, three catalog-only skips, browser checks passed, and the verified package is installed on KT's Board.
- Merged automated evidence: 211 tests total, 208 passed, zero failures, three catalog-only skips. TypeScript and Vite pass. The generated `index-BwgBIobr.js` matches the installed build; source and tests are unchanged from the verified three-hole revision.
- Remote-tree verification: pending.
