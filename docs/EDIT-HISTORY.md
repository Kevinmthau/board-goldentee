# Edit history: Tee Time

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

## October 27, 2026 — Install on Board

- Person requested installation on the Board.
- Installed and launched the verified current package using Board Connect. Confirmed native title rendering and recorded the screenshot/startup logs in the acceptance ledger. No game code or package identity changed.

## October 27, 2026 — Public GitHub repository

- Person requested committing and pushing all changes and creating a public GitHub repository.
- Published the golf project at https://github.com/Kevinmthau/board-goldentee on `main`, preserving the game-specific commit history with `git subtree split`. The public repository has the game files at its root.
- Updated the README with a screenshot, clone/run instructions, current validation, and the asset-provenance link.
- In the original parent checkout, remote `golden-tee` targets the public repository and `codex/golden-tee-public` tracks its `main`. Future publication from that parent checkout uses `git subtree push --prefix=board-goldentee golden-tee main` after committing game changes. A standalone clone uses ordinary Git commits and pushes.


## October 27, 2026 — Sports players, twist swing, clubs, and portrait

- Person requested Sports pieces instead of the golfer and Bloogs ring, a turn-back/reverse swing, club selection, a reachable par 3 with a 7 iron, and portrait play.
- Replaced the bundled set with Sports, using the supplied setup script. Verified the model hash and retained the app/package identity.
- Accept all eight Sports players. Physical facing controls the club backswing; a deliberate reversal strikes once. The golfer and ring no longer render.
- Added four club choices and separate aim arrows. Full-shot distances are approximately 150, 125, and 60 yards; the putter reaches 111 feet on a green.
- Rotated the logical portrait course toward the left short edge of the native canvas. Native input coordinates keep their original units.
- Rebuilt help and the browser simulator for Sports rotation. Moved the power readout and swing cues clear of the ball and largest piece footprint.
- Preserved save compatibility, roster ownership, pause epochs, and explicit result choices. Updated tests, plan, checklist, asset provenance, and README.
- Verification and remaining native/human checks are recorded in the acceptance ledger.


## October 27, 2026 — Install Sports revision

- Person requested installation on Board to try the Sports pieces.
- Verified the existing package, installed it, and launched it through Board Connect.
- Captured native portrait rendering and reviewed startup logs. No game code or package identity changed.


## October 27, 2026 — Native Sports playtest and attached club

- Person reported that Sports swings were not working and requested live Board log inspection. The club should appear only when the piece is down, attach to its center front, and fit its size.
- Native logs identified a football player at portrait (301,1233), facing 41 degrees. Detection worked, but the hidden placement rectangle and fixed address angle rejected the piece.
- Added a footprint-derived club attached to the actual piece front. Iron shafts are 1.25 piece widths long, putter shafts 1.1 widths. Lifting removes the club; the physical player is the only golfer.
- Calibrate the initial stable facing and strike on returning to that angle. Removed the artificial delay between the physical return and ball launch.
- Person then clarified that placing or turning the piece must not move the camera. Removed the temporary neutral-club-head camera alignment: the address camera and resting ball stay fixed, only the attached club moves, and the camera follows the ball after a hit.
- Moved club choices below the swing area and widened open-grass placement. Native logs subsequently confirmed a ready address and shots at 80% and 9% power, but also showed ordinary turn drift exceeding the old translation guard; this prompted a further tolerance correction.
- Browser checks confirmed visible attachment, scale, and no club after lift. Automated, package, and final native evidence is recorded in the acceptance ledger; physical feel remains a human check.

## October 27, 2026 — Clear the course when a piece is lifted

- Person requested further live Board log review and no character graphic when picking up the Sports piece.
- Removed the absent-piece character from play, title, and setup. Text placement guidance remains; canonical art is used only in help and the browser's present-piece proxy.
- Browser place/lift verification shows neither a club nor replacement character after lift. The fixed camera and swing logic are unchanged.
- Tests pass (178 passed, 3 catalog-only skips). Packed, installed, and launched the correction; current bundle confirmed in native logs. Five native hits, a completed hole, and rematch were observed in the preceding fixed-camera build.

## October 27, 2026 — Publish Sports revision

- Person requested committing and pushing all changes.
- Removed temporary contact-geometry logging before publication; retained gameplay behavior and the playtest evidence in this document set.
- Updated README to the verified Sports behavior and current screenshot. Tests pass (178 passed, 3 catalog skips), and the final publication package builds successfully.
- Publish the committed game subtree to the existing `golden-tee` remote's `main`, keeping game files at the root of the standalone repository.

## October 27, 2026 — Bugs and correctness review

- Person requested a review of app bugs and correctness issues.
- Reviewed input, physics, scoring, saves, seating, lifecycle, rendering, and existing coverage. Existing tests and the production build pass.
- Isolated probes confirmed sample-rate-dependent slow swings, frame-timing-dependent scoring, and duplicate rendering loops after pause/resume before a pending frame executes.
- Recorded reproduction steps and suggested corrections in the acceptance ledger. Added open items to the plan and checklist. No gameplay, test, or asset files changed.

## October 27, 2026 — Fix review findings and add regressions

- Person requested all three fixes, regression tests, and repeated review until clear.
- Removed the per-event slow-swing threshold, made physics advance in persistent fixed steps, and restricted rendering to one scheduled callback through pause/resume.
- Preserved fractional physics time in saves and migrated older version-1 runs. Added regression coverage for the reported failures and adjacent input, save, and lifecycle boundaries.
- All 190 tests pass, with three unchanged catalog skips. Independent re-review found no further actionable issues in the changes. Browser play completed a birdie and rematch; the 18-file package passes verification.
- Updated the plan, checklist, asset inventory, README, and acceptance ledger. The correction is local and has not been installed on Board or published.

## October 27, 2026 — Publish correctness fixes

- Person requested committing and pushing all changes.
- Include the three fixes, regression tests, review documentation, browser evidence, and generated Codex environment configuration.
- Publish the game subtree to the existing `golden-tee` remote's `main`. Keep the app and package identities unchanged.

## October 27, 2026 — Two more holes and longer clubs

- Person requested two additional holes, a par 4 and a par 5 with hazards, plus clubs including a driver and 5 iron.
- Retain the 150-yard par 3. Add a 340-yard par 4 and a 510-yard par 5 with water and bunkers.
- Builder chose a three-hole round with total par 12. Each result waits for Next hole; the final scorecard offers Rematch or Change setup.
- Extend club selection to six clubs. The driver has a larger rounded head; the 5 iron has a longer metal shaft.
- Water adds one penalty and returns the ball to its previous lie. Airborne shots can carry it.
- Preserve existing one-hole saves as hole 1, with round progress retained in new saves.
- Focused physical-club tests pass (7 tests). Full-suite, browser, package, and native evidence belong in the acceptance ledger.

Integration review aligned sand rendering with bunker physics where hazards cut into greens. The six-club layout preserves the observed football placement and turn while keeping physical footprints clear of touch controls. Power remains a fixed percentage beside the piece. Existing local fixes for slow swings, frame timing, and pause/resume were preserved.

## October 27, 2026 — Install three-hole build

The person requested installation on their Board. Installed and launched the verified package on KT's Board, then confirmed the bundle in logs and the six clubs in a native screenshot. No gameplay code or package identity changed. Physical play remains for the person.


## October 27, 2026 — Merge and publish the three-hole revision

- Person requested merging, committing, and pushing the completed changes.
- Merge the published correctness fixes with the three-hole work, preserving source behavior, regression tests, review history, and screenshots.
- Publish the golf subtree to the existing `golden-tee` remote's `main`. Build output, dependencies, and the install ZIP remain outside Git.
- Merged validation: 208 tests pass, with three catalog-only skips. The production build matches the installed `index-BwgBIobr.js` bundle. The push to `board-goldentee/main` succeeded; its root tree matches the merged golf subtree. The primary working checkout contains the merged changes.

## October 28, 2026 — Less twist for full power

- Person requested less rotation to reach 100% power.
- Reduce the full backswing from 150 to 90 degrees. Keep the shortest valid shot near 7% power and retain existing gesture guards.
- Update controller and full-round contact checks for quarter-turn shots, partial power, overshoot, and controlled putting.
- Automated checks pass: 208 passed, zero failures, three catalog-only skips. The 18-file Board package builds successfully.
- Updated the plan, control notes, checklist, asset inventory, and acceptance ledger. The revision remains local and has not been installed on Board.

## October 28, 2026 — Install the shorter twist

- Person requested installation on their Board.
- Installed and launched the verified 90-degree package through Board Connect, retaining the app and package identities.
- Verified platform startup and the native title screen. Physical swing comfort remains for the person's playtest.

## October 28, 2026 — Fix Tee Off

- Person reported that Tee Off did not work on the installed build.
- Found a visible button that silently rejected a detected Sports piece outside the swing area. Reproduced both controller and screen failures.
- Explicit confirmation now binds the observed piece and enters play. Swing guards still require legal placement and a settled address.
- Added regression coverage for the rejected tap, outside swing attempts, repositioning the same piece, and a fresh shot.
- All 209 tests pass, with three catalog-only skips. Built, installed, and launched the correction on Board; physical tap confirmation remains open.

## October 28, 2026 — Commit and publish the control fixes

- Person requested committing and pushing all changes.
- Include the shorter full-power twist, Tee Off correction, regression tests, documentation, and native installation screenshot.
- Publish the game subtree to the existing `golden-tee` remote's `main` branch. Generated build output, dependencies, and install packages remain ignored.

## October 28, 2026 — Wind, normal scorecard, and nine holes

- Request: add wind, replace scoring with a traditional golf scorecard, and add six holes for nine holes totaling par 36.
- The initial worktree lacked the golf directory. Advanced this clean checkout to the latest control-fix revision on `codex/golf-wind-nine-holes`.
- Preserve the shorter full-power twist, Tee Off correction, original three holes, saved scores, package identity, and Sports model.
- Implement steady airborne wind, a camera-relative direction indicator, six coastal holes, and a nine-column scorecard.
- Keep prior three-hole best scores separate from nine-hole totals. Verification follows in the acceptance ledger.
- Completed 225 passing automated checks, browser shot/result/card verification, independent review, and the 18-file package.
- Moved result controls below the default piece and fixed a return loop when switching between help and scorecard.
- This revision has not been installed on Board. Native and human checks remain open.

## October 28, 2026 — Install the nine-hole version

- Request: install the new version on the person's Board.
- Installed and launched the previously verified package through Board Connect, preserving app identity and saved data.
- Confirmed platform startup and the native nine-hole/par-36 title screen. Physical play remains unverified.

## October 28, 2026 — Commit and publish the nine-hole version

- Request: commit and push all changes.
- Include the nine-hole/par-36 course, wind, scorecard, save compatibility, regressions, documentation, and browser/native screenshots.
- Publish the game subtree to the existing `golden-tee` remote's `main` branch.
- The verified installed game code is unchanged. Build output, dependencies, scratch logs, and the install ZIP remain ignored.

## October 28, 2026 — More clubs, precise putting, and green break

- Request: add 3 iron, 4 iron, 6 iron, 3 wood, sand wedge, and 8 iron; improve putting precision; add undulating greens with arrows.
- Started from the latest nine-hole wind revision in a new managed worktree because the original workspace contained generated output only.
- Added the requested clubs, full-size club bag, distinct launch tuning, and sand-wedge bunker behavior.
- Added separate cubic putting input, gentle return recognition, quarter-degree aim, and estimated level-green distance.
- Added nine authored green surfaces. Rendering, downhill arrows, and ball roll use the same slope calculation.
- Retained nine-hole scoring, wind, save schema, package identity, platform ownership, and the Sports model.
- Corrected desktop preview centering so the complete portrait controls remain visible in a narrow browser panel.
- Verification and evidence limits are recorded in the acceptance ledger. This revision has not been installed or published.

## October 28, 2026 — Install the twelve-club build

- Request: install the new build on the person's Board.
- Installed and launched the verified twelve-club package through Board Connect, retaining the existing app identity and data.
- Verified platform startup and the native title screen. No game code or package contents changed.
- Physical putting feel, green reading, and sustained Board play remain unverified.

## October 28, 2026 — Add up to four players

- Request: add up to four players.
- Preserved the latest clubs, precision putting, greens, wind, and nine-hole course in a separate managed worktree.
- Added roster-based group setup, independent balls and scorecards, explicit shot handoffs, shared hole progression, and tied winners.
- Added version-2 multiplayer saves and compatible solo restoration. Roster replacements cannot take another participant's score.
- Added explicit named guest recovery for native session changes, with cancellation and identity regressions.
- Extended the browser selector and headless journey. Verified 265 passing tests, browser interaction, and the Board package.
- No model, identity, or external asset change. This revision has not been installed on Board or published.

## October 28, 2026 — Install the four-player build

- Request: install the new build on the person's Board.
- Installed and launched the verified four-player package, preserving app identity and existing data.
- Verified platform startup and the native title with its 1–4-player label and Players button.
- No game code or package contents changed. Physical multiplayer play remains unverified.

## October 28, 2026 — Restore original putting

- Request: go back to the old way of putting.
- Restored the pre-precision swing controller, two-degree aim, percentage power feedback, and original putting instructions.
- Kept four-player support, the twelve-club bag, green slopes and reading arrows, wind, and all nine holes.
- Verified 261 passing tests, the browser controls, and the unchanged 18-file package inventory.
- Installed and launched the corrected build on the person's Board and verified native startup. Physical putting feel remains unverified.

## October 28, 2026 — Remove putting arrows

- Request: get rid of the putting arrows.
- Removed the downhill arrows across greens and replaced their instructions with green-slope guidance.
- Kept contour grids, slope physics, aiming controls, original swing response, all clubs, and four-player rounds.
- Verified 260 passing tests, the browser putting view, package identity/model, and successful installation and launch on Board.

## October 28, 2026 — Commit, publish, and install all changes

- Request: commit and push all changes and install.
- Include the complete twelve-club revision, one-to-four-player rounds, restored original putting response, removed downhill arrows, tests, documentation, and evidence screenshots.
- Publish the committed game subtree to the existing `golden-tee` remote's `main`, keeping game files at the standalone repository root.
- Reinstalled and launched the verified package on Board. Dependencies, build output, local QA files, and install ZIPs stay ignored as in the established publishing workflow.

## October 28, 2026 — Correct the Board app selection

- Report: the latest build was not visible on Board.
- Found separate Golden Tee and Tee Time installations. Verified the published Golden Tee package against a fresh isolated build.
- Explicitly reinstalled and launched Golden Tee on KT's Board; confirmed its native 1–4-player title screen.
- No runtime changes or uninstall were needed. These diagnostic notes are local; the published game remains `5b87c06`.

## October 28, 2026 — One Tee Time app and a standalone project

- Request: keep only Tee Time with the latest multiplayer and move the project out of Board-tennis into the home directory.
- Moved the complete current project to `/Users/kevinthau/tee-time`, initialized standalone Git from the published game history, and retained the existing remote. The former nested project directories are absent; old generated outputs are preserved under ignored artifacts.
- Renamed the current multiplayer app to Tee Time while keeping its established appId/packageId and platform save-build key. Installed and launched `tee-time.webapp.zip`.
- Removed the older solo app `73118527-b76c-581d-a357-8243da0525cf` as requested. Board Connect now lists exactly one Tee Time and no Golden Tee.
- Updated README commands and current document titles. All 260 active tests pass; the new browser title and native multiplayer setup are verified.
