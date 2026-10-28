import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceHole, createGame, HOLES, holeFor, MAX_WIND_MPH, stepGame, strike, windForHole, windSpeed,
  type GolfState, type Wind } from '../src/rules';
import { readRun } from '../src/run-state';

function shot(wind: Wind): GolfState {
  const game = createGame();
  game.wind = { ...wind };
  assert.equal(strike(game, { power: 0.7, angle: 0 }, '7 IRON'), true);
  return game;
}

function finish(game: GolfState, frames: readonly number[] = [1 / 60]): void {
  for (let i = 0; i < 3000 && ['flight', 'rolling'].includes(game.phase); i++) stepGame(game, frames[i % frames.length]);
  assert.ok(!['flight', 'rolling'].includes(game.phase), 'wind cannot leave a shot moving forever');
}

test('every hole has a steady playable wind that is independent of earlier games', () => {
  const winds = HOLES.map((_, index) => createGame(index).wind);
  assert.ok(winds.every(wind => windSpeed(wind) >= 4 && windSpeed(wind) <= 8));
  assert.equal(new Set(winds.map(wind => JSON.stringify(wind))).size, HOLES.length);
  for (let index = 0; index < HOLES.length; index++) {
    const game = createGame(index);
    const originalWind = { ...game.wind };
    for (let frame = 0; frame < 120; frame++) stepGame(game, 1 / 60);
    assert.deepEqual(game.wind, originalWind, 'waiting does not reroll the forecast');
    game.wind.x = 0;
    assert.deepEqual(createGame(index).wind, originalWind, 'a run cannot mutate the course forecast');
  }
});

test('crosswind bends airborne shots toward the displayed direction', () => {
  const left = shot({ x: -10, z: 0 }), calm = shot({ x: 0, z: 0 }), right = shot({ x: 10, z: 0 });
  for (const game of [left, calm, right]) stepGame(game, 1);
  assert.ok(left.ball.x < -0.8 && right.ball.x > 0.8);
  assert.equal(calm.ball.x, 0);
  assert.ok(Math.abs(left.ball.x + right.ball.x) < 1e-10);
  assert.equal(left.ball.z, calm.ball.z);
  assert.equal(right.ball.y, calm.ball.y, 'wind bends carry without changing the vertical arc');
  for (const game of [left, calm, right]) finish(game);
  assert.ok(left.ball.x < calm.ball.x && right.ball.x > calm.ball.x);
  assert.ok([left, calm, right].every(game => game.strokes === 1 && !game.penalty));
});

test('headwind shortens carry and tailwind lengthens carry for the same swing', () => {
  const head = shot({ x: 0, z: -10 }), calm = shot({ x: 0, z: 0 }), tail = shot({ x: 0, z: 10 });
  for (const game of [head, calm, tail]) finish(game);
  assert.ok(head.ball.z < calm.ball.z - 3);
  assert.ok(tail.ball.z > calm.ball.z + 3);
  assert.ok([head, calm, tail].every(game => game.strokes === 1 && !game.penalty));
});

test('wind has no effect on putts or already rolling balls', () => {
  for (const putt of [true, false]) {
    const calm = createGame(), windy = createGame();
    for (const game of [calm, windy]) {
      game.wind = { x: 0, z: 0 };
      game.ball.z = 140;
      strike(game, { power: putt ? 0.49 : 0.1, angle: 0 }, putt ? 'PUTTER' : 'WEDGE');
      while (game.phase === 'flight') stepGame(game, 1 / 120);
    }
    windy.wind = { x: MAX_WIND_MPH, z: 0 };
    finish(calm); finish(windy);
    assert.deepEqual(windy.ball, calm.ball);
    assert.equal(windy.phase, calm.phase);
    assert.equal(windy.strokes, calm.strokes);
  }
});

test('windy shots retain identical lies and scores across uneven frames and save/restore', () => {
  const wind = { x: 6, z: -4 }, expected = shot(wind);
  finish(expected);
  for (const frames of [[1 / 30], [1 / 59], [1 / 144], [0.012, 0.021, 0.008]]) {
    const game = shot(wind);
    stepGame(game, 0.013);
    const restored = readRun(JSON.parse(JSON.stringify({ version: 1, playerId: 'p1', game })), 'p1');
    assert.ok(restored);
    assert.deepEqual(restored.wind, wind);
    finish(restored, frames);
    assert.deepEqual(restored, expected);
  }
});

test('pre-wind saves preserve calm trajectories and gain wind at the next hole', () => {
  const game = shot({ x: 0, z: 0 });
  stepGame(game, 0.013);
  const legacy = JSON.parse(JSON.stringify(game));
  delete legacy.wind;
  const restored = readRun({ version: 1, playerId: 'p1', game: legacy }, 'p1');
  assert.ok(restored);
  finish(game); finish(restored);
  assert.deepEqual(restored, game, 'restored flight reaches the original lie');
  restored.phase = 'holed'; restored.strokes = 3;
  Object.assign(restored.ball, holeFor(restored).flag, { y: 0, vx: 0, vz: 0, vy: 0 });
  assert.equal(advanceHole(restored), true);
  assert.deepEqual(restored.wind, windForHole(1));
  assert.deepEqual(restored.completedStrokes, [3]);
});

test('a finished legacy three-hole round can continue to hole four with its scores intact', () => {
  const game = createGame(2, [3, 4]);
  game.phase = 'holed'; game.strokes = 5;
  Object.assign(game.ball, holeFor(game).flag, { y: 0, vx: 0, vz: 0, vy: 0 });
  const legacy = JSON.parse(JSON.stringify(game)); delete legacy.wind;
  const restored = readRun({ version: 1, playerId: 'p1', game: legacy }, 'p1');
  assert.ok(restored);
  assert.deepEqual(restored.wind, { x: 0, z: 0 });
  assert.equal(advanceHole(restored), true);
  assert.equal(restored.holeIndex, 3);
  assert.deepEqual(restored.completedStrokes, [3, 4, 5]);
  assert.deepEqual(restored.wind, windForHole(3));
});

test('malformed or excessive saved wind cannot replace the current game', () => {
  for (const wind of [null, 0, 'calm', {}, { x: 1 }, { x: NaN, z: 0 }, { x: 0, z: Infinity },
    { x: '4', z: 0 }, { x: MAX_WIND_MPH + 1, z: 0 }, { x: MAX_WIND_MPH, z: 1 }]) {
    assert.equal(readRun({ version: 1, playerId: 'p1', game: { ...createGame(), wind } }, 'p1'), null);
  }
});
