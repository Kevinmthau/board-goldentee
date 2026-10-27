# Asset manifest: Golden Tee

| File | Role | Source | Licence |
|---|---|---|---|
| public/fonts/itc-kabel-ultra.otf | All game text and title | Board Studio starter | Board-provided font for Board games |
| public/piece-art/1.png | Canonical Bloogs ring in setup and help | board-games 0.4.0, Save the Bloogs set | Board-provided piece art for Board games |
| public/piece-art/2.png | Canonical cannon, supplied set asset | Same set | Board-provided piece art for Board games |
| public/piece-art/3.png | Canonical stairs, supplied set asset | Same set | Board-provided piece art for Board games |
| public/piece-art/4.png | Canonical block, supplied set asset | Same set | Board-provided piece art for Board games |
| public/model.dla | Detect Save the Bloogs pieces | save-the-bloogs_v1.3.4.dla from the plugin | Board-provided model for Board games |
| public/piece-footprints.json | True physical outlines and facing | Same set | Board-provided data for Board games |

Model SHA-256: 407af89d2a7c41ba6bdcef3d15134dcb7d04f81d93e63dcafe143b4aac9c63dd.

## Original runtime artwork and sound

| Source | Role | Origin and licence |
|---|---|---|
| src/course-view.ts | Coastal sky, water, mountains, cypress trees, fairway, bunker, green, cup, flag, ball, and golfer | Original project artwork drawn in Canvas; no third-party images |
| src/howto.ts | Animated control lesson and buttons | Original project drawing; ring render retains Board source above |
| src/sound.ts | Placement, swing, putt, landing, sand, cup, button, and penalty cues | Original deterministic synthesized audio; no sampled recordings |

The browser simulator ring proxy uses the same canonical ring render. The simulator is excluded from the Board package.
Screenshot evidence in docs/screenshots is not shipped as a game asset.

## Generated package files

The seven public assets above retain their paths inside the zip without the `public/` prefix. These five generated files complete the 12-file package:

| Packaged file | Role | Source | Licence |
|---|---|---|---|
| assets/index-CEmDy7iA.css | Full-size canvas layout | Vite build of src/style.css | Original project changes to Board Studio starter |
| assets/index-CozXF8ye.js | Game, rendering, input, and SDK runtime | Vite build of src and vendored SDK beta.8 | Original game code plus Board-provided starter; SDK is © 2026 Harris Hill Products Inc., governed by Board Developer Terms (see node_modules/@board.fun/web-sdk/LICENSE) |
| board-platform.js | Native menu, saves, audio, exit, and game name | Unmodified Board Studio platform layer, stamped by pack | Board-provided platform code |
| harness-config.json | Package identity and game name | Generated from board.config.json by pack | Project metadata |
| index.html | Entry point loading platform and game | Board Studio entry transformed by Vite and pack | Board-provided starter with generated project references |

Hashed bundle names above describe the October 27 handover build and change when the corresponding source changes.
