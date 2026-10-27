import { test } from "node:test";
import assert from "node:assert/strict";
import { clubFor, createGame, createSwing, distanceToCup, HOLE, resetSwing, sampleSwing, scoreLabel,
  stepGame, strike, terrainAt, type GolfState, type SwingState } from "../src/rules";

function finish(game: GolfState, dt = 1 / 60) {
  for (let i = 0; i < 2000 && (game.phase === "flight" || game.phase === "rolling"); i++) stepGame(game, dt);
  assert.ok(game.phase !== "flight" && game.phase !== "rolling", "every shot eventually resolves");
}

function settledSwing() {
  const swing = createSwing();
  for (const time of [0, 100, 200, 300]) sampleSwing(swing, { x: 960, y: 800, time });
  assert.equal(swing.stage, "ready");
  return swing;
}

function gesture(swing: SwingState, right = 0, duration = 80) {
  sampleSwing(swing, { x: 960, y: 860, time: 400 });
  sampleSwing(swing, { x: 960, y: 880, time: 440 });
  sampleSwing(swing, { x: 960 + right / 2, y: 850, time: 440 + duration / 2 });
  return sampleSwing(swing, { x: 960 + right, y: 820, time: 440 + duration });
}

test("a valid stroke counts once and cannot be replaced while the ball is moving", () => {
  const game = createGame();
  assert.equal(distanceToCup(game), 150);
  assert.equal(strike(game, { power: 0.7, angle: 0 }), true);
  assert.equal(game.strokes, 1);
  assert.equal(strike(game, { power: 1, angle: 0 }), false);
  assert.equal(game.strokes, 1);
  finish(game);
  assert.equal(game.phase, "ready");
  assert.ok(game.ball.z > 70 && game.ball.z < 130);
});

test("an iron offers a reachable green and capped power", () => {
  const game = createGame();
  strike(game, { power: 10, angle: 0 });
  finish(game);
  assert.ok(game.ball.z > 160 && game.ball.z < 185);
  assert.equal(game.shotPower, 1);
  assert.equal(game.penalty, false);
});

test("positive and negative swing angles aim to opposite sides of the cup", () => {
  const right = createGame(), left = createGame();
  strike(right, { power: 0.5, angle: 0.2 });
  strike(left, { power: 0.5, angle: -0.2 });
  stepGame(right, 0.5); stepGame(left, 0.5);
  assert.ok(right.ball.x > 0 && left.ball.x < 0);
  assert.ok(Math.abs(right.ball.z - left.ball.z) < 1e-9);
});

test("the club changes with position and a controlled putt can finish the hole", () => {
  const game = createGame();
  assert.equal(clubFor(game), "IRON");
  game.ball.z = 105;
  assert.equal(clubFor(game), "WEDGE");
  game.ball.z = 140;
  assert.equal(clubFor(game), "PUTTER");
  strike(game, { power: 0.49, angle: 0 });
  finish(game);
  assert.equal(game.phase, "holed");
  assert.equal(distanceToCup(game), 0);
  assert.equal(strike(game, { power: 0.5, angle: 0 }), false);
});

test("a fast putt rolls through the cup instead of being captured", () => {
  const game = createGame();
  game.ball.z = 145;
  strike(game, { power: 1, angle: 0 });
  stepGame(game, 0.6);
  assert.ok(game.ball.z > HOLE.flag.z + 2);
  assert.equal(game.phase, "rolling");
});

test("sand and rough reduce carry compared with the same fairway stroke", () => {
  const fairway = createGame(), rough = createGame(), sand = createGame();
  rough.ball.x = 40;
  sand.ball.x = HOLE.bunker.x; sand.ball.z = HOLE.bunker.z;
  assert.equal(terrainAt(rough.ball.x, rough.ball.z), "rough");
  assert.equal(terrainAt(sand.ball.x, sand.ball.z), "bunker");
  strike(fairway, { power: 0.5, angle: 0 });
  strike(rough, { power: 0.5, angle: 0 });
  strike(sand, { power: 0.5, angle: 0 });
  assert.ok(Math.hypot(rough.ball.vx, rough.ball.vz) < Math.hypot(fairway.ball.vx, fairway.ball.vz));
  assert.ok(Math.hypot(sand.ball.vx, sand.ball.vz) < 12);
});

test("out of bounds adds one penalty and returns to the previous safe lie", () => {
  const game = createGame();
  game.ball.x = 12; game.ball.z = 25;
  strike(game, { power: 1, angle: Math.PI / 2 });
  finish(game);
  assert.equal(game.penalty, true);
  assert.equal(game.strokes, 2);
  assert.deepEqual({ x: game.ball.x, z: game.ball.z }, { x: 12, z: 25 });
  assert.equal(game.phase, "ready");
});

test("the last allowed stroke resolves before showing the stroke limit", () => {
  const game = createGame();
  game.strokes = 9;
  strike(game, { power: 0, angle: 0 });
  assert.equal(game.phase, "flight");
  finish(game);
  assert.equal(game.phase, "limit");
  assert.equal(game.strokes, 10);
  assert.equal(strike(game, { power: 0.5, angle: 0 }), false);
});

test("simulation agrees across common frame rates", () => {
  const a = createGame(), b = createGame();
  strike(a, { power: 0.8, angle: 0.1 }); strike(b, { power: 0.8, angle: 0.1 });
  finish(a, 1 / 30); finish(b, 1 / 120);
  assert.ok(Math.hypot(a.ball.x - b.ball.x, a.ball.z - b.ball.z) < 0.01);
  assert.equal(a.strokes, b.strokes);
});

test("golf score labels use this hole's par", () => {
  assert.equal(scoreLabel(1), "Hole in one");
  assert.equal(scoreLabel(2), "Birdie");
  assert.equal(scoreLabel(3), "Par");
  assert.equal(scoreLabel(4), "Bogey");
  assert.equal(scoreLabel(5), "Double bogey");
});

test("stationary jitter and forward-only movement cannot commit a stroke", () => {
  const swing = createSwing();
  for (let time = 0; time <= 600; time += 50) {
    assert.equal(sampleSwing(swing, { x: 960 + Math.sin(time) * 3, y: 800 + Math.cos(time) * 3, time }), null);
  }
  assert.equal(swing.stage, "ready");
  assert.equal(sampleSwing(swing, { x: 960, y: 750, time: 650 }), null);
  assert.equal(sampleSwing(swing, { x: 960, y: 650, time: 700 }), null);
  assert.notEqual(swing.stage, "committed");
});

test("backswing then fresh forward movement emits one directional shot", () => {
  const swing = settledSwing();
  const shot = gesture(swing, 24);
  assert.ok(shot && shot.power > 0 && shot.power < 1);
  assert.ok(shot.angle > 0);
  assert.equal(swing.stage, "committed");
  assert.equal(sampleSwing(swing, { x: 1000, y: 680, time: 550 }), null);
  assert.equal(sampleSwing(swing, { x: 960, y: 880, time: 600 }), null);
});

test("a faster forward slide produces more power", () => {
  const slow = gesture(settledSwing(), 0, 140);
  const fast = gesture(settledSwing(), 0, 40);
  assert.ok(slow && fast && fast.power > slow.power);
});

test("stale samples cancel an armed stroke instead of committing on redetection", () => {
  const swing = settledSwing();
  sampleSwing(swing, { x: 960, y: 880, time: 400 });
  assert.equal(swing.stage, "backswing");
  assert.equal(sampleSwing(swing, { x: 960, y: 700, time: 800 }), null);
  assert.equal(swing.stage, "settling");
});

test("pause or lift reset requires a new settle and backswing", () => {
  const swing = settledSwing();
  sampleSwing(swing, { x: 960, y: 880, time: 400 });
  resetSwing(swing);
  assert.equal(sampleSwing(swing, { x: 960, y: 700, time: 420 }), null);
  assert.equal(swing.stage, "settling");
  assert.equal(swing.power, 0);
});

test("a brief fresh gap retains the backswing but still needs forward samples", () => {
  const swing = settledSwing();
  sampleSwing(swing, { x: 960, y: 880, time: 400 });
  assert.equal(sampleSwing(swing, { x: 960, y: 870, time: 480 }), null);
  assert.equal(swing.stage, "backswing");
  const shot = sampleSwing(swing, { x: 960, y: 820, time: 520 });
  assert.ok(shot);
});

test("non-finite shot data is rejected without corrupting the game", () => {
  const game = createGame();
  assert.equal(strike(game, { power: NaN, angle: 0 }), false);
  stepGame(game, Infinity);
  assert.deepEqual(game, createGame());
});
