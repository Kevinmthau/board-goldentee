# Plan: Golden Tee

Updated: October 28, 2026.
Status: Twelve clubs, precision putting, and undulating greens pass 238 automated checks, browser inspection, and packaging. Installed and launched on Board; native play remains open.

## Summary

Golden Tee is a solo coastal golf game with nine holes and a total par of 36. Finish the round in the fewest strokes.
Use the Board Studio TypeScript, Vite, and Canvas 2D starter with the vendored SDK.
The physical Sports player replaces the Bloogs ring and digital golfer. Its visible club is attached to the center front of the real piece and exists only while that piece is detected.

## How to play

1. Sit at the left short edge of Board. The course extends away from you in portrait orientation.
2. Place any Sports player on the open grass and hold still briefly. This establishes a comfortable starting angle.
3. Select a club. Turn the piece back toward yourself to bring the club back.
4. Reverse the twist and return the club to the ball to hit. A larger backswing gives more power. Use a small turn for a short putt.

A quarter turn (90 degrees) reaches full power. Woods, irons, and wedges arm at 40 degrees, giving about 7% power.
Putting arms at 12 degrees. Its cubic response gives short putts more adjustment room, and a gentle return can strike.
Putting aim changes by 0.25 degrees per tap. Other clubs retain two-degree aim steps.

Keep hold of the piece. Placement, translation alone, and lifting do not hit the ball.
The grip attaches just outside the center front of the footprint; the shaft extends in the piece's actual facing direction. The driver shaft is 1.45 piece widths long; the 3 wood is 1.41 widths. Long irons range from 1.29 to 1.38 widths, other irons use 1.25 widths, sand wedge uses 1.18, and putter uses 1.1. The address camera, terrain, and digital ball stay fixed when the piece is placed, translated, or turned. Only the attached club follows the piece. The camera may follow the ball after a committed shot.

## Scope and rules

- A nine-hole round totaling par 36. Preserve the original three holes and add six distinct coastal holes.
- The new holes include water hazards and multiple bunkers. Fairways provide room to lay up or carry the water.
- The club bag offers driver, 3 wood, 3 through 9 irons, wedge, sand wedge, and putter.
- Approximate clean-lie distances are 250, 225, 210, 195, 185, 170, 150, 140, 125, 60, and 40 yards. Putter capacity remains about 111 feet.
- Tap the selected club to open the bag. Choosing a club returns to play and requires a settled address.
- Recommendations include all twelve clubs. Sand wedge retains more speed from a bunker lie.
- Each green has distinct smooth swells and slopes. Grounded rolls bend downhill and travel farther downhill than uphill.
- Curved grid lines and arrows appear near the green or with the putter selected. Arrows point downhill using the same surface as physics.
- During a putter backswing, the footer shows estimated feet on a level green. Slopes and other terrain change the actual distance.
- A full 7 iron reaches the first green from the tee. Terrain can reduce distance.
- Club choices apply explicitly to the next shot. Recommend a club at each new lie.
- Fixed left and right aim controls adjust direction separately from swing power.
- Each deliberate shot adds one stroke. Out of bounds or grounded water contact adds one penalty and returns to the last safe lie.
- Airborne balls can carry water. Sand reduces flight distance from the lie and absorbs the landing and roll.
- The cup captures a slowly rolling ball. Each hole has a ten-stroke limit.
- Each completed hole waits for an explicit Next hole choice. Every result shows a traditional scorecard with all nine holes, yardage, par, strokes, and totals.
- The final result waits for one shared Rematch or Change setup choice.
- Rematch retains the roster and detected piece, but resets the full round and unfinished gesture.
- Saves retain the current hole, preceding scores, and live ball state. Earlier one-hole saves resume on hole 1.
- Change setup releases the piece binding and requires confirmation before replay.
- Tee Off confirms a detected Sports piece and enters the course even if the piece is outside the swing area. The placement cue then guides repositioning.

## Input and ownership

- Accept Sports glyphs 1–8 after checking BoardContactType.Glyph. Track instances by contactId.
- Read facing and dimensions through pieceFootprint(). Sports uses a zero-degree facing offset.
- Keep native contacts and the canvas at 1920 × 1080. Rotate the logical 1080 × 1920 scene onto that surface.
- Convert positions and facing into the portrait view with a rigid quarter turn, never a native-coordinate scale.
- Wait for BoardPlatform.state.ready(). Read and refresh the solo roster through src/seats.ts.
- An eligible Sports piece on the open course binds to the signed-in solo player. The permitted portrait area is x140–940, y400–1430, narrowed to x300–780 below y1250 to clear the aim controls; the suggested position is near (540,1385). The club-bag button begins at y1590. Its separate twelve-club selector disables swing input.
- Require a stable initial address, then calibrate to that angle. Do not require a hidden compass direction. Small orientation noise stays inside a dead band.
- Either twist direction can wind back toward the player. Reverse and return within ten degrees of address to strike; putting requires four degrees.
- Launch the ball and hit sound when the physical turn returns to address, with no additional animated downswing delay. Placement and rotation never reframe the course or move the resting ball.
- Turning through the angular wrap must stay continuous. A short tracking gap and pause retain the calibrated rotation zero. A fresh lie or explicit new setup can calibrate a new address.
- Placement, translation alone, lift, redetection, and pause return cannot create a shot. The translation guard must allow the center drift seen when a person turns a Sports piece; deliberate dragging still cancels intent.
- Explicit Tee Off confirmation binds the visible piece separately from its position. Swinging still requires legal placement and a settled address.
- Pause cancels unfinished intent; a committed ball keeps its state. Rebind the piece without another splash.
- Show one finite placement splash and sound. The attached club is the only graphic that follows the physical piece, as expressly requested; no outline, halo, trail, or digital golfer follows it. Lifting removes the club.
- Input comes through startInput/applyContacts. The host owns model activation.

## First minute and communication

| State | Next action | Signal | Ends |
|---|---|---|---|
| Title/setup | Place a Sports player on open grass | Text placement cue | Piece arrives |
| Address | Hold still, select club, turn back | Attached club, selected club, distance, fixed twist cue | Backswing begins |
| Backswing | Return the club to the ball | Club follows the physical turn, power fills | Deliberate return to address |
| Flight | Watch the ball | Flight, landing, sound | Ball rests |
| Next lie | Choose club and swing | Distance, club recommendation, fresh address cue | Next shot |
| Putting | Read downhill arrows, fine-tune aim, turn gently | Shorter putter, quarter-degree aim, level-green distance in feet | Cup capture |
| Menu return | Return to the starting angle and settle | Fresh address cue, no automatic shot | New gesture |
| Hole result | Next hole | Hole score and accumulated round score | Explicit choice |
| Round result | Rematch or Change setup | Nine-hole scorecard and total relative to par 36 | Explicit choice |

The optional help demonstrates the same twist used in play. It also explains the club selector.
Browser controls simulate the same Sports contacts, including orientation, and show a browser-only piece proxy.

## Look and layout

Keep the sunny coastal course, pale sand, blue sea, natural turf, and coral flag.
Use a portrait perspective from behind the ball. Remove the digital human golfer and Bloogs ring art.
The club attaches to the physical piece's center front at a scale derived from its footprint. Hide it when the piece is absent. Keep club selection and aim buttons outside the suggested physical swing space.
Do not draw a replacement character when the physical piece is absent or lifted, including title and setup. Keep the text placement cue. Canonical upright Sports art appears only in the optional help lesson and the browser simulator's present-piece proxy.
Use drawTitle() for the game name and gameFont() elsewhere.
In-play text is at least 48 px; other text is at least 32 px. Targets are at least 120 px, inset 48 px.
Scenery is cached. No per-frame shadowBlur, filter, or getImageData.
Audio uses gameAudio(); saves use BoardPlatform.state. Keep existing appId and packageId.

## Decisions

| Decision | By | Reason or source |
|---|---|---|
| Sports pieces replace golfer and Bloogs ring | Person | Current request |
| Turn face toward player, reverse to hit | Person | Current request |
| Selectable clubs, 7 iron reaches par 3 | Person | Current request |
| Portrait play | Person | Current request; supersedes landscape layout |
| Club appears only with a detected piece, attached to its center front and sized to fit | Person | Native-playtest correction |
| Attached club follows the actual piece | Person | Explicit exception to the generic moving-piece-decoration rule, for the club only |
| Camera stays fixed during placement and rotation | Person | Follow-up correction; only the club moves before a shot |
| No onscreen character when the piece is lifted | Person | Remove the absent-piece placeholder; keep the course clear |
| Any of eight Sports players | Builder | Every piece has a visible face and unique glyph |
| Left short edge, logical portrait scene | Builder | Full glass coverage with unchanged native canvas and input units |
| Stable initial angle calibrates address | Builder | Native football at portrait (301,1233), facing 41 degrees, was detected but rejected by the old hidden placement/facing gates |
| Broad open-grass placement | Builder | Native input showed ordinary placement and small movements crossing the previous hidden boundary |
| Backswing sets power; return to address commits | Builder | Makes short putts controllable and places physical contact at the strike |
| Less twist to reach 100% | Person | October 28 feedback: the full backswing requires too much rotation |
| Full power at 90 degrees instead of 150 | Builder | Reduce the required turn by 40%; keep the 40-degree arming threshold and a roughly 7% minimum shot |
| Tee Off responds to a detected piece outside the swing area | Builder | October 28 bug report: the visible button silently rejected placement; enter play and retain the placement guard for swinging |
| Separate aim buttons | Builder | Rotation is reserved for swing intent |
| Add 3 wood, 3/4/6/8 irons, and sand wedge | Person | October 28 request |
| Dedicated precision putting | Person / Builder | Requested finer controls; cubic turn response, slower return, and quarter-degree aim provide adjustment room |
| Undulating greens with break arrows | Person / Builder | Requested visible break; one surface defines elevation, downhill arrows, and rolling acceleration |
| Full-size twelve-club bag | Builder | Fit every club without reducing 48 px text, 120 px targets, or physical swing space |
| Add a par 4 and par 5 with hazards | Person | Current request |
| Add driver and 5 iron | Person | Current request |
| 340-yard par 4 and 510-yard par 5 | Builder | Longer approaches give the new clubs useful roles |
| Water and bunkers on both new holes | Builder | Visible hazards reward club choice and aim |
| Three-hole round, total par 12 | Builder | Retain the original hole and make both additions reachable in normal play |
| Next hole requires a tap | Builder | Preserve deliberate progression and a readable scorecard |
| Six clubs with distinct driver head | Builder | Fit the longer holes while retaining the existing short game |
| Solo roster and one shared result | Person, retained | Prior agreed solo scope |
| Approved implementation and native installation scope | Person | Change, installation, and log-watching requests authorize this revision |

Earlier sliding-ring, digital-golfer, and separate digital-ball-club decisions are superseded. Their evidence remains in the acceptance ledger and edit history.
The user's explicit set change authorizes replacing the bundled model through use-piece-set; runtime never loads, renames, or activates models.

## Verification

Test rotation jitter, wrap, both handed directions, partial/full power, fresh reversal, return-to-address contact, one-shot commitment, tracking gaps, pause epochs, and the observed native center drift.
Test club attachment and proportional size across all eight Sports footprints, no club without a piece, club distances, and the 7-iron tee shot. Keep old saves readable.
Inspect title, setup, help, club selection, swing, flight, next lie, putting, result, rematch, and menu return in the browser.
Pack with the Sports model only and preserve package identity.

The earlier attached-club, native-tolerance, and fixed-camera revision passed 178 automated checks, with three full-catalog checks skipped. Its 18-file package is installed and launched on Board, as recorded in the acceptance ledger.
Browser inspection confirms the attached club's size and disappearance on lift, with the course and resting ball fixed through placement and a full backswing. The absent-piece character placeholder is removed. Native logs from the fixed-camera build confirm five further hits at 91%, 48%, 17%, 100%, and 64%, followed by cup capture and rematch. None of those armed swings canceled.
Native physical alignment, comfortable full swing/putting, sustained performance, platform behavior, and uncoached teaching remain open. Earlier ring-build evidence does not validate those Sports checks.

## Correctness fixes — October 27, 2026

The review found three reproducible issues. The person requested fixes, regression tests, and another review. All three fixes remain in the three-hole build.

- Return samples qualify by angular speed instead of movement per event. Regressions cover 20/30/60/120 Hz, both turn directions, and slow putting returns. The two-sample and minimum-speed guards remain.
- Physics uses persistent 1/120-second steps. Results stay consistent across frame timing. Saves retain fractional active time; older version-1 saves default that field to zero.
- The game tracks one scheduled animation frame and cancels it on pause. Paused boot waits for resume. Duplicate resume notifications preserve the active swing and one rendering loop.

The correctness revision passed 190 tests with three catalog-only skips. Independent review found no further actionable issues. A browser playthrough completed a birdie, pause/resume, and rematch. The acceptance ledger preserves that revision's evidence and package identity.

## Three-hole verification

The latest local fixes were retained when this worktree was brought forward from the older tennis revision. The merge preserves their published history and browser evidence.
The expanded controls reserve physical clearance at the bottom and beside the aim buttons. The default placement and observed football turn remain playable. Power stays in the fixed right-side percentage.

The three-hole build passed 208 tests, with three catalog-only skips. Its 18-file package retains the app identity and Sports model. Browser checks confirm the six controls, new courses, water recovery, driver carry, scorecards, Next hole, and rematch.
The package is installed and launched on KT's Board. Native rendering is verified; physical play of the new holes and clubs remains open.

## Shorter full-power twist — October 28, 2026

Full power now requires 90 degrees instead of 150 degrees. The 40-degree arming threshold, return-to-address strike, and motion guards remain unchanged.
The power ramp starts four degrees before arming, retaining approximately 7% power for the shortest valid swing. Additional rotation caps at 100%.
All 208 automated checks pass, with three catalog-only skips. The production build and 18-file Board package pass.
The revised package is installed and launched on Board, with the title screen verified in a native screenshot. Physical comfort and putting control require a playtest.

## Tee Off correction — October 28, 2026

The visible Tee Off button now confirms the observed Sports piece, including one outside the swing area. The course then shows the placement cue.
The same piece can move into the swing area and settle without lifting. Outside placement cannot arm or strike.
Regression tests reproduced the silent rejection before the fix. The updated suite passes 209 tests, with three catalog-only skips.
The corrected 18-file package is installed and launched on Board. Native startup is verified; a person's Tee Off tap remains to be confirmed.

## Nine holes, wind, and scorecard — October 28, 2026

- By person: add wind, a normal golf scorecard, and six more holes for nine holes totaling par 36.
- By builder: keep a steady wind per hole. Show speed in mph and an arrow pointing where it blows, relative to the camera.
- By builder: wind changes airborne travel. Putts and grounded roll are unchanged. The wind stays fixed through shots and pauses.
- By builder: use a traditional horizontal scorecard with hole numbers, yards, par, strokes, and a total. Future holes remain blank.
- By builder: total only completed holes and compare with their par. Use circles for under-par scores and squares for over-par scores.
- By builder: retain the ten-stroke cap and explicit Next hole, Rematch, and Change setup choices. No automatic transitions.
- By builder: preserve older scores and ball states. Saves without wind continue the current hole in calm conditions, then use the next hole's wind.
- By builder: keep earlier three-hole personal bests in their existing storage key. Record nine-hole bests separately.
- Retain the 90-degree full-power twist and Tee Off correction from the latest published control revision.
- Verify all nine holes, total par, wind and pause consistency, old saves, scorecard totals, and a complete simulated round.
- Browser and native results will be recorded separately. Physical wind judgment and nine-hole pacing require a person on Board.

### Course card

| Hole | Name | Yards | Par |
|---|---|---:|---:|
| 1 | Seabreeze | 150 | 3 |
| 2 | Lagoon Bend | 340 | 4 |
| 3 | Pelican Reach | 510 | 5 |
| 4 | Dune Crossing | 375 | 4 |
| 5 | Gull Cove | 175 | 3 |
| 6 | Heron Marsh | 530 | 5 |
| 7 | Cypress Turn | 390 | 4 |
| 8 | Breakwater | 320 | 4 |
| 9 | Lighthouse | 410 | 4 |
| Total | | 3,200 | 36 |

The scorecard button opens the card between shots. The platform menu also provides Scorecard.
Back returns to the same lie. Switching between help and the card retains the underlying screen.
Result and Back controls sit below the default physical piece position. Scoring text remains outside its footprint.
All nine holes have tested playable routes in calm conditions and their default wind.
A browser pointer playthrough completed the first hole in two strokes and advanced to hole two.
The complete nine-hole journey uses simulated contacts; it does not establish physical feel or full-round human pacing.

## Twelve clubs, precision putting, and green reading — October 28, 2026

Baseline: `d411e7c`, the nine-hole wind revision. Its 225 tests pass, with three catalog-only skips.
Implementation lives on `codex/golf-putting-greens` in a separate managed worktree. The initially opened folder held only generated output.
The six requested clubs have distinct launch tuning. The 3 wood has a smaller wood head; long irons have proportional shaft lengths.
Putter input maps the 8–90 degree range cubically into existing shot power. It arms at 12 degrees and accepts returns above eight degrees/second.
Representative level-green distances are 0.8 feet at 30 degrees, 2.6 feet at 45 degrees, and 10.4 feet at 60 degrees.
Full-shot controls, nine-hole scoring, app identity, and the save schema remain unchanged. Saved positions and strokes remain readable.
New green shapes apply when resuming old runs, so an unfinished roll follows the new slopes after loading.
Green scenery and reading marks are cached. No model, dependency, external art, or audio asset is added.
Automated checks cover club selection, slow putts, slope direction, frame timing, saved rolling state, all nine holes, and explicit results.
Browser checks and packaging results belong in the acceptance ledger. Physical sensing, fine-control feel, and Board performance require a playtest.
