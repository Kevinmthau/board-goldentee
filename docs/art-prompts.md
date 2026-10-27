# Art generation prompts

## October 27, 2026 — realistic golfer swing sheet

- **Saved asset:** `docs/art-reference/golfer-swing-v1.png` (originally `public/art/golfer-swing.png`; archived after the fuller motion sheet replaced it).
- **Method:** built-in `image_gen`, with `transparent_background: true`.
- **Use:** four poses of the same original golfer, composited over the game's course.
- **Output:** 2172 × 724 PNG, four equal 543 × 724 horizontal cells.

### Full final prompt

Use case: stylized-concept
Asset type: production transparent sprite sheet for a realistic 3D arcade golf game, viewed from behind the player.
Create one wide image, ideally 3072 by 1024 pixels (3:1 aspect ratio), containing exactly FOUR equally spaced, equal-width horizontal cells in a single row. The four cells are invisible; do not draw borders or a grid. Each cell is one animation pose of the EXACT SAME adult male golfer, rendered with the SAME camera, body proportions, clothing, body scale, lighting and feet baseline. Leave transparent padding between the figures. The entire image background must be genuine alpha transparency, not a visible checkerboard.
Subject: an original athletic adult male golfer, medium tan skin, a plain tan/cream golf cap, coral/salmon short-sleeve performance polo tucked into navy blue tailored golf trousers, brown belt, white modern golf shoes. No logos or writing. Realistic anatomy, natural fabric folds, stitching, shoe materials and believable skin; premium realistic pre-rendered 3D sports video-game character, not cartoon, not illustration, not low-poly.
Camera: three-quarter BACK view, looking at the golfer from behind his left shoulder. Golfer faces diagonally away from viewer toward SCREEN RIGHT and up the golf course. Show the back and left side of the polo, the back/side of the cap, and only a slight side profile. Full body in every pose, completely visible from cap or raised hands to the soles of both shoes. Camera is about waist height, with a very slight downward angle and restrained perspective.
The four cells, left to right:
1. ADDRESS: right-handed golf setup, slightly bent at hips, knees naturally flexed, feet about shoulder width, arms angled down toward screen right, both hands joined in a golf grip in front of the thighs.
2. HALF BACKSWING: same feet and stance, torso rotated into the backswing, hands together raised to about lower chest/shoulder height, elbows anatomically correct.
3. TOP OF BACKSWING: same body scale, hips and torso wound, hands together high above the rear shoulder, shoulders rotated, feet still grounded. Keep all raised hands and elbows inside this cell.
4. FULL FOLLOW-THROUGH: weight on lead leg, trailing heel raised and knee turned in, body turned toward the shot, hands together over the opposite/lead shoulder, balanced finish. Still a three-quarter rear view with face mostly hidden.
IMPORTANT: there is NO GOLF CLUB in any cell. Hands must form a closed two-handed golf grip around an invisible handle, so a game engine can draw and animate the club separately. No ball, no tee, no golf bag, no scenery, no ground plane, no labels, no text, no grid, no extra people.
Layout consistency: each cell has its own figure centered at about 50% of that cell width, foot sole baseline at 93% image height. Keep identical character height and head size in every cell; do not scale a pose down to fit raised arms. Leave enough clear space above all heads for raised arms. Give all four figures approximately 70% of image height from soles to crown, allowing pose differences. All cells contain complete isolated cutouts with clean antialiased edges. Lighting: realistic soft coastal daylight from upper left, gentle modelling, no cast shadow outside the silhouette. Materials are detailed but readable at 350 pixels character height in game.
