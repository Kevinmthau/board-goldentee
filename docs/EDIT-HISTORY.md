# Edit history

## October 27, 2026 — Design intake

- Request: design a Golden Tee inspired game, then build a playable web version from the Studio starter.
- Created `docs/PLAN.md` with the proposed first hole and open design decisions.
- Person chose the physical Bloogs ring: slide back, then forward along direction arrows.
- Replaced the proposed Arcade robots with Save the Bloogs Ring, glyph 1.
- Person chose “Solo golf first.” Removed multiplayer and competitive AI from the first playable.
- Recorded that direction comes from the slide, because the ring has no visible facing.
- Proposed a classic behind-the-ball view and a complete par-3 hole for final design agreement.
- No game code has been written. No unit, browser, Board, or human play checks have run.

## October 27, 2026 — Begin playable build

- Person delegated the camera choice with “You choose the view.”
- Builder selected a classic behind-the-ball view.
- Copied the exact Studio starter and installed Save the Bloogs assets.
- Retained the vendored beta.8 SDK and minted the package identity.

## October 27, 2026 — Core milestone

- Added deterministic flight, rolling, terrain, putting, scoring, and a deliberate ring swing.
- Connected the core to the starter roster and input path.
- Core tests: 95 passed, 3 catalog-only skips; package passed.
- Browser title and ring placement inspected. Browser aspect ratio and simulation coordinates need correction in the next step.

## October 27, 2026 — Third-person golfer

- Person asked: “I want to see the golfer third person style.”
- Added a visible golfer beside the digital ball, with a backswing and follow-through.
- Kept the golfer in the course world; the physical ring remains a separate control.

## October 27, 2026 — Playable handover

- Completed the solo par-3, automatic clubs, bunker and rough, putting, penalties, score, rematch, and change-setup flow.
- Added the coastal perspective and camera follow, canonical animated ring lesson, synthesized audio, and platform round saves and personal best.
- Fixed browser canvas scaling and added a development-only ring proxy and placement controls.
- Protected pause/re-detection identity, deliberate swing commitment, startup saves, repeated help, and retained-ring rematches with regression checks.
- Moved guidance clear of the physical ring and kept the missing-art fallback at the in-play text floor.
- Verified 117 passing tests (3 catalog-only skips), production packaging, and an actual pointer-driven two-stroke birdie followed by rematch.
- Real Board sensing, device performance, speaker mix, roster changes, long-name layout, and uncoached human play remain open.

## October 27, 2026 — Closer camera and realistic graphics

- Person requested a closer view resembling the supplied Golden Tee arcade reference, then asked for more realistic graphics.
- Lowered and moved the address camera closer; increased golfer size by about 50%, retaining the digital ball above the ring lane and a wider camera during flight.
- Replaced the flat coastal background with generated photographic scenery; added cached natural turf, sand, detailed foliage, and soft shadows.
- Integrated four transparent realistic golfer poses, with the club attached to each pose's grip and the address shaft reaching the actual ball. Putting retains a compact stroke.
- Browser inspection confirmed close address, backswing, follow-through, flight transition, and putting. Final tests: 117 passed, 3 catalog-only skips. Final 15-file package passed TypeScript, Vite, and web-pack.

## October 27, 2026 — Natural swing animation

- Person requested a smoother, more natural golfer swing.
- Replaced wall-clock pose switching with active-time animation: anticipation, eased takeaway, accelerated downswing, and relaxed follow-through.
- Delayed ball simulation and the hit cue until club contact while preserving the once-committed shot in platform saves. Native pause freezes both motion and the remaining impact delay.
- Added focused animation timing tests and a boot regression that pauses during the downswing, verifies the ball stays at the tee, then launches after contact without another stroke.
- Added a fuller twelve-pose photographic sheet, aligned feet and head height, blended complete poses, a continuous club arc, and compact putting movement. Preserved the previous artwork in docs/art-reference.
- Added a development-only motion reviewer for checking intermediate frames. Browser checks cover takeaway, held backswing, contact, follow-through, and camera departure. Final test/package evidence is recorded in the acceptance ledger.
- Final browser QA also exposed a simulator fast-tap issue: down/up in one frame lost the touch-begin event in the SDK. Split lifecycle events into ordered simulator wire frames and added a real-SDK regression. Native input is unchanged. Final tests: 127 passed, 3 catalog-only skips.

## October 27, 2026 — Continuous swing without ghosting

- Person requested one continuous motion without ghosting between poses.
- Replaced the photo cross-fades with one articulated 3D golfer, shaded and composited once into the existing Canvas 2D course. Both hands and the rigid club follow continuous joint positions.
- Preserved the active-time swing clock, once-committed shot, exact impact delay, and pause behavior.
- Added graceful Canvas fallback for unavailable WebGL; geometry is allocated once and stationary poses are cached.
- Browser verification completed an iron, wedge, putt, three-stroke par, pause/resume, and retained-ring rematch. All 137 tests passed (3 catalog-only skips); the 14-file Board package passed. Full evidence is in the acceptance ledger.
