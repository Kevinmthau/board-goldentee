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
