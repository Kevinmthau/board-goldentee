# Golfer motion sprite sheet

- **Date:** October 27, 2026
- **Asset:** `public/art/golfer-motion-v2.png`
- **Method:** built-in `image_gen`, `transparent_background: true`.
- **Reference:** original `public/art/golfer-swing.png`, now archived at `docs/art-reference/golfer-swing-v1.png`, used for character identity, clothing, materials, camera, and lighting.
- **Purpose:** distinct chronological golf swing keyframes without deforming photographic anatomy.

## Output inspection

The output is 1448 × 1086 RGBA, with four columns and three rows of 362 × 362 cells. Alpha transparency was confirmed by read-only pixel inspection. Source frame 0 has an opaque bounding box of `(114, 24, 268, 357)`, a 333 px body height. The generator varied the feet baseline slightly; the estimated anchors below allow runtime alignment without altering the source image.

Each source crop is `(column × 362, row × 362, 362, 362)`. Anchors are cell-local. Normalized coordinates are divided by 362. The foot anchor is the midpoint of the two shoe bounding boxes at the lower sole baseline; grip positions are estimates checked against skin-colored pixels.

| Frame | Foot px | Grip px | Foot normalized | Grip normalized |
|---|---|---|---|---|
| 0 | 177, 356 | 219, 205 | 0.4890, 0.9834 | 0.6050, 0.5663 |
| 1 | 171, 357 | 232, 208 | 0.4724, 0.9862 | 0.6409, 0.5746 |
| 2 | 171, 357 | 267, 162 | 0.4724, 0.9862 | 0.7376, 0.4475 |
| 3 | 182, 357 | 145, 81 | 0.5028, 0.9862 | 0.4006, 0.2238 |
| 4 | 189, 360 | 193, 19 | 0.5221, 0.9945 | 0.5331, 0.0525 |
| 5 | 195, 361 | 139, 59 | 0.5387, 0.9972 | 0.3840, 0.1630 |
| 6 | 172, 360 | 222, 210 | 0.4751, 0.9945 | 0.6133, 0.5801 |
| 7 | 176, 361 | 283, 128 | 0.4862, 0.9972 | 0.7818, 0.3536 |
| 8 | 200, 343 | 136, 42 | 0.5525, 0.9475 | 0.3757, 0.1160 |
| 9 | 220, 343 | 201, 18 | 0.6077, 0.9475 | 0.5552, 0.0497 |
| 10 | 215, 343 | 201, 26 | 0.5939, 0.9475 | 0.5552, 0.0718 |
| 11 | 213, 343 | 201, 26 | 0.5884, 0.9475 | 0.5552, 0.0718 |

Frames 10 and 11 are intentionally similar settled finishes. Frame 11 has faint pixels at the upper cell edge from the preceding row; its real hands start around local y = 14, so a source crop beginning at y = 10 can exclude those stray pixels while retaining the logical anchor.

## Full final prompt

Use case: stylized-concept
Asset type: production sprite-sheet animation artwork for a realistic arcade golf game.
Input image: the attached four-pose golfer sheet is an IDENTITY, CLOTHING, MATERIAL, CAMERA and LIGHTING REFERENCE. Create a new sheet with twelve distinct chronological animation frames; do not copy its four poses repeatedly.
Create ONE high-resolution image, exactly 4:3 aspect ratio, ideally 3072 by 2304 pixels, containing EXACTLY 12 equally sized SQUARE cells arranged FOUR COLUMNS by THREE ROWS. The cell boundaries are invisible. The entire background must be genuinely transparent alpha, not checkerboard graphics, white, black, or scenery.
Same original adult male golfer in every cell: coral/salmon polo, navy tailored golf trousers, tan/cream cap, white golf shoes, brown belt, medium tan skin. Match the reference character closely. Realistic pre-rendered 3D sports-game anatomy and materials, natural cloth folds. Camera LOCKED three-quarter BACK view from behind his left shoulder, golfer facing diagonally toward SCREEN RIGHT and away up the course. No camera or lighting changes between frames.
Each square cell contains exactly ONE complete isolated full-body golfer. Both soles around 90% cell height, feet centered around 50% cell width. Use the SAME anatomical scale in every frame: standing soles-to-cap height about 60% of the cell height; never shrink a frame to fit raised arms. Leave empty transparent room above for raised hands and on each side for arm extension. Feet stay planted in the same consistent stance until follow-through lifts the trailing heel. All heads, arms, hands, legs and shoes must be fully inside their own cell without touching neighboring cells.
There is NO CLUB in any frame. Both hands form a closed, joined golf grip around an invisible handle. No ball, tee, bag, props, labels, numbers, borders, grid, logos, watermarks or ground plane. No cast shadow outside the figure.
Frame chronology must be unambiguous, reading each row LEFT TO RIGHT, then next row:
TOP ROW:
Frame 0 (top-left): ADDRESS, slightly bent from hips, flexed knees, joined hands low in front of thighs on screen-right side, ready to swing.
Frame 1: EARLY TAKEAWAY, a small natural motion away from address, joined hands just to the right of hip height, arms still low. This MUST NOT be a raised-arm or top-backswing pose.
Frame 2: HALFWAY BACKSWING, torso begins rotating, joined hands at CHEST height, forearms and wrists naturally hinged. Clearly between low takeaway and high backswing.
Frame 3: THREE-QUARTER BACKSWING, torso more rotated, joined hands at SHOULDER height beside the rear shoulder, not yet overhead.
MIDDLE ROW:
Frame 4 (middle-left): TOP OF BACKSWING, fully coiled torso, joined hands high ABOVE the rear shoulder, both feet planted.
Frame 5: EARLY DOWNSWING, hips begin opening toward target, joined hands have DROPPED back to shoulder height, elbows move in toward torso. A distinct downward-transition pose.
Frame 6: IMPACT, hands LOW near the thigh/hip line as in address, but hips now open toward target and weight moves to lead leg. Anatomically natural impact alignment, wrists leading the invisible club.
Frame 7: EARLY FOLLOW-THROUGH, joined hands and arms EXTENDED outward toward the target at CHEST height, torso rotating through, trailing heel beginning to lift. Do not jump directly to overhead finish.
BOTTOM ROW:
Frame 8 (bottom-left): MIDDLE FOLLOW-THROUGH, joined hands at SHOULDER height on the OPPOSITE side from the backswing, torso more open, balanced legs.
Frame 9: LATE FOLLOW-THROUGH, joined hands ABOVE the lead shoulder, chest turned toward the target, trailing heel raised.
Frame 10: BALANCED FINISH, relaxed full golf finish, hands resting over lead shoulder, weight over straight lead leg, rear foot on toe showing part of sole.
Frame 11 (bottom-right): SETTLED FINISH, same balanced pose as frame10 with slightly relaxed shoulders and hands. No new motion, no return to address.
MOST IMPORTANT: anatomically natural DISTINCT intermediate poses and smooth chronological progression. Do not repeat the four reference poses. Preserve character identity, clothing, body scale, camera angle and feet placement across all twelve. Hands must remain joined and convincingly grip an invisible shaft in every frame. Clean antialiased cutout edges. Uniform soft daylight from upper left. Prioritize motion continuity and accurate anatomy over decorative polish.
