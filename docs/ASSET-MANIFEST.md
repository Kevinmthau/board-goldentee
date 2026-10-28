# Asset manifest: Golden Tee

| File | Role | Source | Licence |
|---|---|---|---|
| public/fonts/itc-kabel-ultra.otf | All game text and title | Board Studio starter | Board-provided font for Board games |
| public/piece-art/1.png | Canonical baseball player in help and the browser's present-piece simulator | board-games 0.4.0 Sports set | Board-provided piece art for Board games |
| public/piece-art/2.png | Canonical hockey player, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/piece-art/3.png | Canonical cyclist, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/piece-art/4.png | Canonical soccer player, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/piece-art/5.png | Canonical tennis player, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/piece-art/6.png | Canonical football player, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/piece-art/7.png | Canonical swimmer, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/piece-art/8.png | Canonical basketball player, supplied set asset | Same Sports set | Board-provided piece art for Board games |
| public/model.tflite | Detect Sports players | sports_v0.1.0.tflite from the plugin | Board-provided model for Board games |
| public/piece-footprints.json | True physical outlines and facing | Same Sports set | Board-provided data for Board games |
| public/art/coastal-sky.png | Photographic sky, ocean, and distant headlands | Original built-in imagegen output, October 27, 2026; prompt in docs/coastal-art-prompt.md | AI-generated project artwork; no third-party source image |
| public/art/fairway-turf.png | Repeating natural turf material, baked to a small runtime tile | Original built-in imagegen output, October 27, 2026; prompt in docs/coastal-art-prompt.md | AI-generated project artwork; no third-party source image |

Model SHA-256: 4d75343e149b72f8410cad10f518c64791634ae6e6932880088a34c164026ad9.

## Original runtime artwork and sound

| Source | Role | Origin and licence |
|---|---|---|
| src/course-view.ts | Dynamic terrain, cup, flag, ball, camera, and generated-art composition; procedural image-failure fallback | Original project code and Canvas artwork |
| src/piece-club.ts | Club attached to the live Sports footprint’s center front, scaled to its physical width | Original project code and Canvas artwork |
| src/course-art.ts | Cached natural foliage, turf/sand fallback materials, and soft shadows | Original seeded procedural Canvas artwork |
| src/howto.ts | Animated control lesson and buttons | Original project drawing; Sports render retains Board source above |
| src/sound.ts | Placement, swing, putt, landing, sand, cup, button, and penalty cues | Original deterministic synthesized audio; no sampled recordings |

The browser simulator uses canonical Sports art with a separate facing arrow. The unused golfer renderer and rig remain as source history; they are excluded from the runtime bundle. The simulator is excluded from the Board package.
Screenshot evidence in docs/screenshots is not shipped as a game asset.
`docs/screenshots/correctness-fixes-birdie.png` records the local browser playthrough after the October 27 correctness fixes; it is not packaged.
The earlier four-pose golfer and twelve-pose motion sheet are preserved in docs/art-reference/golfer-swing-v1.png and docs/art-reference/golfer-motion-v2.png. Both are original built-in imagegen artwork documented in docs/art-prompts.md and docs/swing-motion-prompt.md; neither ships or loads at runtime. The development-only motion reviewer at dev/swing-review.html also stays outside the package.

## Generated package files

The thirteen public assets above retain their paths inside the zip without the `public/` prefix. These five generated files complete the 18-file package:

| Packaged file | Role | Source | Licence |
|---|---|---|---|
| assets/index-<hash>.css | Full-size canvas layout | Vite build of src/style.css | Original project changes to Board Studio starter |
| assets/index-<hash>.js | Game, rendering, input, and SDK runtime | Vite build of src and vendored SDK beta.8 | Original game code plus Board-provided starter; SDK is © 2026 Harris Hill Products Inc., governed by Board Developer Terms (see node_modules/@board.fun/web-sdk/LICENSE) |
| board-platform.js | Native menu, saves, audio, exit, and game name | Unmodified Board Studio platform layer, stamped by pack | Board-provided platform code |
| harness-config.json | Package identity and game name | Generated from board.config.json by pack | Project metadata |
| index.html | Entry point loading platform and game | Board Studio entry transformed by Vite and pack | Board-provided starter with generated project references |

Vite assigns content hashes to the two bundle filenames. The package inventory below records the handover build.

```text
art/coastal-sky.png
art/fairway-turf.png
assets/index-BzE_yp0q.js
assets/index-DXc9XbkK.css
board-platform.js
fonts/itc-kabel-ultra.otf
harness-config.json
index.html
model.tflite
piece-art/1.png
piece-art/2.png
piece-art/3.png
piece-art/4.png
piece-art/5.png
piece-art/6.png
piece-art/7.png
piece-art/8.png
piece-footprints.json
```
