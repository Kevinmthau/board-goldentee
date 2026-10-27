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
