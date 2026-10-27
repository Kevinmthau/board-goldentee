# Plan: Golden Tee

Status: agreed solo first playable; implementation in progress. The person delegated the camera choice.
Updated: October 27, 2026.

## Summary

- **Name:** Golden Tee (working title).
- **One line:** Take a swing, find the green, and sink the ball in the fewest strokes.
- **Goal:** Test whether Board can capture the satisfying physical stroke of arcade golf.
- **Engine:** TypeScript, Vite, and Canvas 2D from the board-games Studio starter.
- **Players:** Solo golf first, seated at the bottom edge.
- **Piece set:** `save-the-bloogs`, using the Ring (glyph 1), one per box.
- **First move:** Place the Bloogs ring at the bottom swing area, then slide back and forward along the arrows.
- **Sound:** Proposed short swing, landing, sand, and cup effects through the platform audio system.
- **Reference:** [Golden Tee Golf](https://en.wikipedia.org/wiki/Golden_Tee_Golf), supplied by the person.

The reference's main design cue is its trackball stroke, which controls power, direction, and curve.
Use original course layouts and game artwork for this prototype.

## How to play

1. Place the Bloogs ring at your edge.
2. Follow the arrows: slide back, then forward to swing.
3. Slide faster for power; angle the stroke to aim.
4. Putt into the cup in the fewest strokes.

Keep hold of the ring during the stroke. Throwing the piece is not required.
In the browser, Shift-drag simulates the same ring and gesture.

## First playable

Build one complete par-3 hole before expanding the course.
Include a tee, fairway, rough, bunker, green, ball flight, rolling, putting, stroke count, and a result.
Use an original coastal course drawn in Canvas, with cached scenery and a clear swing area.
The result waits for Rematch or Change setup.

The main risk is power control: short strokes must feel predictable while leaving room to improve.
An uncoached person should be able to hit, approach, putt, and explain the result.

Defer the full course, online play, tournament systems, equipment progression, and a full art pass.
Local competitors and AI are outside this solo first playable, as requested by the person.

## Rules (builder proposal)

- Use ordinary stroke scoring: fewer strokes wins. Show the score relative to par.
- The first hole has par 3. Each deliberate shot adds one stroke.
- Select an approach club away from the green. Select the putter on the green.
- Rough and sand reduce shot distance. The ball rolls farther on the green.
- Capture the ball only when it passes the cup at a low speed.
- Recover an out-of-bounds ball to its last safe position with one penalty stroke.
- Stop at 10 strokes for the prototype, and explain the stroke limit in the result.
- Keep the ball's simulation separate from the physical swing control.
- Placing, turning, lifting, or redetecting the ring alone never commits a shot.
- A completed backswing arms the forward stroke. Only a deliberate forward stroke commits it.
- Use the forward slide's direction for shot direction. Ring rotation has no game effect.
- Use forward slide speed for power, with a capped maximum and a softer scale for putting.
- Show fixed direction arrows beside the swing area, clear of the ring's travel path.
- Show a back arrow first, then forward choices: left, straight, and right.
- Arrows teach a continuous slide direction. They are not small buttons to press.
- After a shot, wait for the ball to stop and the ring to settle before arming another backswing.
- Show aim and power at the digital ball or the player's edge, clear of the physical piece.
- A real placement gets one short splash and sound. Movement gets no following decoration.
- A tracking gap keeps the piece's identity. A pause clears unfinished swing intent.
- Use gentle ball lift, a clear landing response, and a cup celebration to explain each outcome.

The exact swing thresholds and club distances remain tunable builder choices.
The ring has a 162 by 162 px footprint and an 81 px radius. Leave room for the player's hand.
Never use the round ring's orientation to aim. Use `pieceFootprint()` for its outline and placement response.

### Proposed swing state machine

1. A ring at the bottom edge binds to the current roster player.
2. The ring settles for 0.3 seconds before it can start a backswing.
3. A backward slide of at least 50 px arms the stroke.
4. A forward movement of at least 40 px commits one shot after clear direction and speed samples.
5. Forward speed from 120 to 1400 px per second maps to useful shot power, clamped at the maximum.
6. Small position jitter never arms a shot. Return movement after a committed shot never fires again.
7. A pause or loss of fresh motion samples cancels an unfinished stroke, preserving the hole and any ball already in flight.

These values are prototype settings to test on glass, not claims about measured physical feel.

## Players and seating

- Wait for `BoardPlatform.state.ready()` before reading the roster.
- Use `src/seats.ts` and the platform player selector for all player identity.
- For the solo prototype, use the signed-in player at the bottom edge.
- The first playable uses only the bottom edge. All teaching, controls, and score information face that edge.
- The ring at the bottom edge binds to the current solo roster player.
- The platform selector can change the solo player; it is not a gate before play.
- Read the roster again during setup and when players change.
- Keep ownership through a lift or tracking gap. Rebind after the system menu without another splash.
- No competitor or AI seat is created in this requested solo practice mode.
- If competitive play is added later, offer computer golfers through the roster using the same shot and scoring rules.

## Communication and teaching

| State | Player's next action | Signal and words | Signal ends |
|---|---|---|---|
| Title | Place the ring to enter setup | Course preview, game title, and canonical ring art | The ring arrives |
| Piece setup | Place the ring at the bottom edge | Canonical upright ring art and an empty placement spot | The ring arrives |
| Ready | Slide back, then forward | Fixed direction arrows and a brief back-and-forward demonstration | First deliberate shot |
| Flight | Watch the shot | Ball flight, shadow, landing sound | Ball rests |
| Approach | Take the next shot | Distance to flag and active club | The next shot |
| Putting | Roll toward the cup | Clear cup and short target cue | Ball enters cup |
| Pause return | Continue the same turn | Restore the course with unfinished stroke canceled | A fresh stroke begins |
| Result | Pick Rematch or Change setup | Strokes, score relative to par, shared choices | One choice is made |

## First minute

1. Title: a course preview introduces the game and the required control.
2. Setup: the player is read from the roster; a real placement gets one splash and sound.
3. First move: a short demonstration invites the same swing used throughout the game.
4. First success: the ball flies, lands, rolls, and shows a useful distance to the flag.
5. Ordinary play: shorter approach shots lead to putting and the cup.
6. Interruption: a menu visit preserves the hole and score without producing an extra shot.
7. Result: the score remains until the player chooses what happens next.

## Result and replay

- Show strokes, par, and the resulting golf score, or the explicit stroke-limit result.
- Present one shared Rematch or Change setup decision. Do not restart on a timer.
- Rematch resets the ball, strokes, and unfinished gesture while keeping seats and detected pieces.
- Change setup releases seat bindings and returns to setup.
- The solo result faces the bottom edge and controls one shared result state.

## Look

Use a bright coastal course with deep green fairways, pale bunkers, blue water, and a clear white ball.
Use a third-person view from behind a visible golfer, as the person requested during the browser review.
Use Canvas 2D perspective to show the golfer, course, ball flight, and rolling.
The golfer stands beside the digital ball and animates the backswing and follow-through.
The golfer never follows the physical ring. The camera follows the ball after impact.
The swing area stays at the bottom edge while the camera follows the digital ball between shots.
Favor a large course, readable ball motion, and short golf labels over dashboard panels.
Follow the platform's font, touch-target, and text-size floors.
Record every shipped asset in `docs/ASSET-MANIFEST.md` when the starter is prepared.

### Visual-world and asset plan

- World promise: a sunny coastal golf hole, with pale sand, blue sea, and cypress trees.
- Palette: forest green for framing, warm cream for cues, coral for the flag, and white for the ball.
- Camera: behind a visible golfer at address, following ball flight, then framing the golfer and cup for the next shot.
- Coverage: title and setup show the same course; play uses exact terrain; help uses canonical ring art; results keep the course behind them.
- Assets: original Canvas sky, coast, terrain, trees, flag, ball, and finite effects. Cache detailed scenery instead of rebuilding it while still.
- Sound: original short synthesized swing, putt, landing, sand, placement, penalty, and cup cues. No music in this first playable.
- Interaction protection: quiet turf around the bottom-centre swing corridor; arrows remain to its right.
- Proof: inspect title, help, address, flight, approach, green, result, rematch, and pause in the browser.
- Board sensing, speaker mix, and performance remain unverified until played on a device.

## Build steps

1. Design intake complete: physical ring, solo par-3, and builder-selected behind-the-ball view.
2. Copy the exact Studio template, install its dependencies, and configure the chosen piece set.
3. Build the single-hole core loop and meaningful rule/input tests.
4. Run tests and pack, then inspect the title, swing, ball rest, result, and rematch in a browser.
5. Ask for play feedback; tune the core control before adding course content.
6. Add the agreed remaining scope in playable steps, maintaining the checklist and evidence ledger.

## Decisions

| Decision | Value | By | Source | Conflict or status |
|---|---|---|---|---|
| Inspiration | Golden Tee Golf | Person | October 27 request and link | Fixed |
| Platform | Playable web version from Studio starter | Person | October 27 request | Fixed |
| Workflow | Design together, then build; ask questions as work proceeds | Person | October 27 request | Fixed |
| Core control | Slide the physical Bloogs ring back, then forward along direction arrows | Person | “slide the bloogs ring back, then forward to swing along the arrows for directions” | Fixed |
| Piece set | Save the Bloogs, Ring, glyph 1 | Person | Control choice, confirmed against piece inventory | Replaces proposed Arcade robots |
| Direction | Forward movement path, not ring rotation | Builder | Ring has no visible facing | Supports the requested arrows |
| Arrows | Fixed beside the swing lane, showing back and forward directions | Builder proposal | Person requested direction arrows | Clear of the moving piece |
| First scope | One par-3 hole with a complete result loop | Builder | Final design question answered by person | Browser playable; Board and human checks open |
| Players | Solo golf first | Person | “Solo golf first” | Fixed; multiplayer deferred |
| Camera | Third-person, with a visible golfer beside the ball | Person | “I want to see the golfer third person style” | Replaces the initial ball-only framing |
| Recipe | Sports, using ball rest/recovery and deliberate stroke commitment | Builder | Genre recipes | No existing golf recipe |
| UI floors | 48 px in play; 32 px elsewhere; 120 px targets; 48 px edge inset | Builder | User's Board rules | No conflicting spec sizes |
| Physical control art | Nothing follows or sits under the moving ring | Builder | User's Board rules | Ball and arrows stay separate from the controller |

## Evidence

- Source: reference, plugin rules, piece inventory, and starter architecture inspected.
- Unit: 117 passed, 3 full-catalog footprint checks skipped; includes core physics, stroke commitment, tracking gaps, pause epochs, save restoration, and a complete boot walk.
- Package: TypeScript, Vite, platform build, and web-pack passed; stable package identity retained.
- Browser: title, help, ring placement, varied swing powers, approach, putting, two-stroke birdie, rematch, and pause checked with real pointer actions. Third-person address, backswing, follow-through, and next-lie framing inspected.
- Screenshots: `docs/screenshots/third-person-ready.png`, `third-person-backswing.png`, and `birdie-result.png`.
- Board: not tested.
- Human: no swing or teaching playtest yet.
