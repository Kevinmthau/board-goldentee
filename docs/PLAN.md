# Plan: Golden Tee

Updated: October 27, 2026.
Status: Sports-piece portrait game installed and under native playtest. Physical detection and two rotation-to-shot events are confirmed; placement and turn tolerance are being corrected from logs. Human feel and sustained performance remain open.

## Summary

Golden Tee is a solo coastal par-3 golf game. Take a swing, find the green, and finish in the fewest strokes.
Use the Board Studio TypeScript, Vite, and Canvas 2D starter with the vendored SDK.
The physical Sports player replaces the Bloogs ring and digital golfer. Its visible club is attached to the center front of the real piece and exists only while that piece is detected.

## How to play

1. Sit at the left short edge of Board. The course extends away from you in portrait orientation.
2. Place any Sports player on the open grass and hold still briefly. This establishes a comfortable starting angle.
3. Select a club. Turn the piece back toward yourself to bring the club back.
4. Reverse the twist and return the club to the ball to hit. A larger backswing gives more power. Use a small turn for a short putt.

Keep hold of the piece. Placement, translation alone, and lifting do not hit the ball.
The grip attaches just outside the center front of the footprint; the shaft extends in the piece's actual facing direction. Iron shafts are 1.25 piece widths long; the putter is 1.1 widths. The address camera, terrain, and digital ball stay fixed when the piece is placed, translated, or turned. Only the attached club follows the piece. The camera may follow the ball after a committed shot.

## Scope and rules

- One original 150-yard par-3 hole, with tee, fairway, rough, sand, green, ball flight, rolling, and putting.
- Club buttons offer 7 iron, 9 iron, wedge, and putter. The default tee club is the 7 iron.
- A full 7 iron reaches the green from the tee. Terrain can reduce distance.
- Club choices apply explicitly to the next shot. Recommend a club at each new lie.
- Fixed left and right aim controls adjust direction separately from swing power.
- Each deliberate shot adds one stroke. Out of bounds adds a penalty and returns to the last safe lie.
- The cup captures a slowly rolling ball. A ten-stroke limit ends the prototype.
- The result waits for one shared Rematch or Change setup choice.
- Rematch retains the roster and detected piece, but resets the hole and unfinished gesture.
- Change setup releases the piece binding and requires confirmation before replay.

## Input and ownership

- Accept Sports glyphs 1–8 after checking BoardContactType.Glyph. Track instances by contactId.
- Read facing and dimensions through pieceFootprint(). Sports uses a zero-degree facing offset.
- Keep native contacts and the canvas at 1920 × 1080. Rotate the logical 1080 × 1920 scene onto that surface.
- Convert positions and facing into the portrait view with a rigid quarter turn, never a native-coordinate scale.
- Wait for BoardPlatform.state.ready(). Read and refresh the solo roster through src/seats.ts.
- An eligible Sports piece on the open course binds to the signed-in solo player. The permitted portrait area is x140–940, y400–1530; the suggested position is near (540,1385). Club choices begin at y1740.
- Require a stable initial address, then calibrate to that angle. Do not require a hidden compass direction. Small orientation noise stays inside a dead band.
- Either twist direction can wind back toward the player. Reverse that direction and return within 10 degrees of the address to strike once. Merely beginning the reversal does not launch the ball.
- Launch the ball and hit sound when the physical turn returns to address, with no additional animated downswing delay. Placement and rotation never reframe the course or move the resting ball.
- Turning through the angular wrap must stay continuous. A short tracking gap and pause retain the calibrated rotation zero. A fresh lie or explicit new setup can calibrate a new address.
- Placement, translation alone, lift, redetection, and pause return cannot create a shot. The translation guard must allow the center drift seen when a person turns a Sports piece; deliberate dragging still cancels intent.
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
| Putting | Make a small backswing | Shorter attached putter and distance in feet | Cup capture |
| Menu return | Return to the starting angle and settle | Fresh address cue, no automatic shot | New gesture |
| Result | Rematch or Change setup | Strokes and score relative to par | Explicit choice |

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
| Separate aim buttons | Builder | Rotation is reserved for swing intent |
| 7 iron, 9 iron, wedge, putter | Builder | Useful distances for one par-3 hole |
| Solo roster and one shared result | Person, retained | Prior agreed solo scope |
| Approved implementation and native installation scope | Person | Change, installation, and log-watching requests authorize this revision |

Earlier sliding-ring, digital-golfer, and separate digital-ball-club decisions are superseded. Their evidence remains in the acceptance ledger and edit history.
The user's explicit set change authorizes replacing the bundled model through use-piece-set; runtime never loads, renames, or activates models.

## Verification

Test rotation jitter, wrap, both handed directions, partial/full power, fresh reversal, return-to-address contact, one-shot commitment, tracking gaps, pause epochs, and the observed native center drift.
Test club attachment and proportional size across all eight Sports footprints, no club without a piece, club distances, and the 7-iron tee shot. Keep old saves readable.
Inspect title, setup, help, club selection, swing, flight, next lie, putting, result, rematch, and menu return in the browser.
Pack with the Sports model only and preserve package identity.

The final attached-club, native-tolerance, and fixed-camera revision passes 178 automated checks, with three full-catalog checks skipped. Its 18-file package is installed and launched on Board, as recorded in the acceptance ledger.
Browser inspection confirms the attached club's size and disappearance on lift, with the course and resting ball fixed through placement and a full backswing. The absent-piece character placeholder is removed. Native logs from the fixed-camera build confirm five further hits at 91%, 48%, 17%, 100%, and 64%, followed by cup capture and rematch. None of those armed swings canceled.
Native physical alignment, comfortable full swing/putting, sustained performance, platform behavior, and uncoached teaching remain open. Earlier ring-build evidence does not validate those Sports checks.
