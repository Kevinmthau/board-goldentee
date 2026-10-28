# Golden Tee — Board web prototype

A solo nine-hole coastal golf round controlled with any physical Sports player. Play 3,200 yards across nine holes totaling par 36, with steady wind and a traditional golf scorecard. Built from the Board Studio starter with TypeScript, Vite, and Canvas 2D. Play in portrait orientation from Board’s left short edge.

Place the piece on the open grass and hold it still to set your starting angle. Turn it back toward yourself, then return the club to the ball to hit. Backswing sets power; a quarter turn (90 degrees) reaches 100%. Tap **Club bag** to select driver, 3 wood, 3 through 9 irons, wedge, sand wedge, or putter. The club appears only with the piece, attached to its center front and sized to its footprint. The camera and resting ball stay fixed while you place or turn the piece; the camera follows the ball after a hit.

Putting has its own gentle response. Small and medium turns give finer distance control, and aim arrows adjust by 0.25 degrees. During the backswing, watch the estimated feet on a level green. The curved grid and downhill arrows show the green's undulations. Account for uphill, downhill, and sidehill break before returning the club to the ball.

![Twelve-club bag](docs/screenshots/twelve-club-bag.png)

## Play in a browser

```sh
git clone https://github.com/Kevinmthau/board-goldentee.git
cd board-goldentee
npm ci
npm run dev
```

Open the local address Vite prints. The browser toolbar is a simulator and does not ship to Board.

1. Click **Place sports player**, or Shift-click on the open grass, then hold still briefly.
2. Drag sideways across the simulated player to bring the club back.
3. Grab it again and drag the other way until the club returns to the ball. A larger backswing gives more power.
4. Select a club and use the aim arrows before the next swing. A full 7 iron reaches the first green.
5. Choose **Next hole** after each hole. The final scorecard totals all nine holes against par 36.

The wind arrow points where the wind blows, at the displayed mph. Wind affects airborne shots. Grounded rolls follow the green's slopes instead. Open **Scorecard** between shots or through the platform menu to see hole-by-hole yards, par, strokes, and totals.

Water costs one penalty stroke and returns the ball to its previous lie. Carry it in the air or use a shorter club to lay up. Sand reduces carry and roll. Each hole has a ten-stroke limit.

At the next lie, hold the piece still to set your new starting angle before swinging again.
Lifting the piece removes the club and leaves the course clear, with no replacement character graphic.
The browser-only facing arrow shows the current direction; canonical piece art stays upright.

- Hold Alt while dragging to move the simulated piece.
- Press Backspace or click Lift piece to lift it.
- Press P or click Menu to pause. Enter resumes.
- How to play on the title explains the controls.

The desktop simulator does not persist a round across page reloads. Real Board saves use the platform layer.

## Board package

```sh
npm test
npm run pack
board-connect install golden-tee.webapp.zip --launch
```

Use any Sports player (glyphs 1–8). Keep hold of it while twisting. Native Board input and the framebuffer stay at 1920×1080; the game rotates its portrait scene toward the left short edge.

- appId: `e087aaee-903b-43a2-b2b9-bbd4189601b2`
- packageId: `fun.board.dev.goldentee.e087aaee`
- SDK: vendored `1.0.0-beta.8`; keep its tarball and the lockfile.

The native system menu provides How to swing, Restart round, and Change setup. The platform owns audio, saves, and exit.

## Design and evidence

See [the plan](docs/PLAN.md), [build checklist](docs/BUILD-CHECKLIST.md), and [acceptance ledger](docs/ACCEPTANCE-LEDGER.md).
The twelve-club revision passes 238 automated checks, with three catalog-only checks skipped. Tests complete a full round through simulated contacts, including all club choices, a breaking putt, wind, saves, scorecards, progression, and rematch. TypeScript, Vite, and the 18-file Board package pass.

Browser checks and screenshots are recorded in the acceptance ledger. The twelve-club build is installed and launched on Board, with native startup and title rendering verified. Native performance and physical putting feel remain unverified.

Older saves keep their scores and ball state. New green slopes apply to resumed rolls. A save without wind continues its current hole in calm conditions, then gains wind on the next hole. Earlier three-hole personal bests remain stored separately from nine-hole records. The 90-degree full-power twist and responsive Tee Off confirmation are retained.

Artwork, the Board SDK, font, platform layer, and piece-set assets have separate provenance and terms; see the [asset manifest](docs/ASSET-MANIFEST.md). Keep the vendored SDK and package lockfile so a fresh checkout uses the tested SDK version.
