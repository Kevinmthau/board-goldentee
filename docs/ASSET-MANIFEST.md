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
| src/course-view.ts | Nine-hole terrain, water and sand hazards, cup, flag, ball, camera, and generated-art composition; procedural image-failure fallback | Original project code and Canvas artwork |
| src/piece-club.ts | Twelve-club visuals, including rounded driver and 3 wood, attached to the Sports footprint's center front and scaled to its width | Original project code and Canvas artwork |
| src/holes.ts | Nine authored coastal hole layouts, yardages, pars, and hazards | Original project course data |
| src/scorecard.ts | Traditional golf card, table, and scoring marks | Original project code and Canvas artwork |
| src/wind-view.ts | Fixed wind indicator and camera-relative arrow | Original project code and Canvas artwork |
| src/green.ts | Shared green elevation, slope, and downhill acceleration; source for procedural mesh and contours | Original project code and course data |
| src/club-picker.ts | Full-size twelve-club bag layout and two-degree aim controls | Original project code |
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
assets/index-CXCTlMpU.js
assets/index-DcBmdo0M.css
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


October 27, 2026 three-hole revision adds original procedural course and club artwork in the sources listed above.
No external images, audio recordings, fonts, models, or dependencies were added. The inventory above reflects the final 18-file package. Developer fixtures and screenshots under artifacts/ are excluded from the package.

Prior three-hole package SHA-256: `fdb86a9948b525e71a62053cc7991131d8985ad5f97ca671a086d583c70d87b3`.

October 28, 2026 twist tuning changes only the generated game bundle. No art, audio, fonts, models, or dependencies changed.
The initial shorter-twist package has SHA-256 `257defe9ee632e050b71e1fa70ee3c3a5972c12c4bbe544266172ff5e91d5b2c`.
`docs/screenshots/shorter-twist-board-installed.png` records the October 28 native title screen after installation. It is verification evidence and is not packaged.

The October 28 Tee Off correction changes only the generated game bundle. The inventory above records its 18-file package, SHA-256 `78df7023b656e5d5bb238dbe7596ddbb8531d3fcc0089817e7da95c1e427e8b5`.

October 28, 2026 nine-hole revision adds procedural course layouts, the scorecard, and the wind indicator.
No external art, fonts, recordings, models, or dependencies were added. The inventory above records the current 18-file package.
Package SHA-256: `5385c8353d8f2409850cc3dfe6f843f4eff9d918b9d7ab7c65a0a16a00cf3924`.
Screenshots named `nine-hole-*.png` document this revision. They and the local QA scripts in `artifacts/` are excluded from the package.

`docs/screenshots/nine-hole-board-installed.png` records the October 28 native installation of this package. It is verification evidence and is not packaged.

October 28, 2026 twelve-club revision adds original procedural green shapes, reading arrows, club geometry, and control layouts.
No external art, font, model, audio, or dependency is added. The inventory above records the current 18-file package.
Current package SHA-256: `c857f0c2f9c6d2dd85deb39593ddddb7495ffb730b8dbee81f2614fc7a2f7f52`.
The Sports model retains the recorded hash. Browser screenshots and development fixtures remain outside the package.

`docs/screenshots/precision-putting-board-installed.png` records the October 28 native installation of this package. It is evidence and does not ship.

October 28, 2026 four-player revision adds original procedural interface and round logic in `src/multiplayer-view.ts`, `src/multiplayer.ts`, and `src/main.ts`.
No external art, fonts, audio, models, or dependencies were added. The existing 18-file shipped inventory still applies.
The generated JavaScript bundle is `assets/index-CglAoTkU.js`. Package SHA-256: `3163e12494c27c78e655afd23a74754b259924ba362ddec71b7928ee2ba4fb05`.
The `four-player-*.png` screenshots are local browser evidence and are excluded from the package.

`docs/screenshots/four-player-board-installed.png` records the October 28 native installation. It is evidence and is not packaged.

October 28, 2026 original-putting restoration changes only original game code and generated runtime assets.
No external art, font, model, audio, or dependency was added. The existing 18-file shipped inventory still applies.
The generated JavaScript bundle is `assets/index-Cmy9XbX_.js`. Package SHA-256: `9b8923459506d1aefef6deb75df5495c20fb5f90db5ecb73002b00b6a9b12cef`.
`docs/screenshots/original-putting-controls.png` and `original-putting-board-installed.png` record browser controls and native installation. They are evidence and do not ship.

October 28, 2026 putting-arrow removal deletes original procedural arrow drawing and updates game text.
No external assets or dependencies changed. The existing 18-file inventory still applies.
Bundle: `assets/index-Bwtc59Ji.js`. Package SHA-256: `cabfd91e3292a8ab50a3c9531009063888454997cfb015fe15e75686fb0810d4`.
`docs/screenshots/no-putting-arrows.png` and `no-putting-arrows-board-installed.png` are browser/native evidence and are excluded from the package.

`docs/screenshots/published-four-player-board-installed.png` records the October 28 reinstall requested with publication. It is verification evidence and is not packaged. The shipped inventory and package SHA-256 remain unchanged from the putting-arrow removal revision.
