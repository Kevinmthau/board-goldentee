import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleGreen } from '../src/green';
import { createGame, HOLES, holeFor, stepGame, strike, terrainAt, type GolfState } from '../src/rules';
import { readRun } from '../src/run-state';

function finish(game: GolfState, frames = [1 / 60]): void {
  for (let i = 0; i < 3000 && ['flight', 'rolling'].includes(game.phase); i++) stepGame(game, frames[i % frames.length]);
  assert.ok(!['flight', 'rolling'].includes(game.phase), 'the ball must come to rest on every slope');
}

test('all nine authored greens have distinct, smooth undulations and bounded slopes', () => {
  assert.equal(new Set(HOLES.map(hole => JSON.stringify(hole.greenShape))).size, 9);
  for (const hole of HOLES) {
    const heights: number[] = [], directions: number[] = [];
    for (let ux = -.9; ux <= .9; ux += .15) for (let uz = -.9; uz <= .9; uz += .15) {
      if (ux * ux + uz * uz >= 1) continue;
      const x = hole.green.x + ux * hole.green.rx, z = hole.green.z + uz * hole.green.rz;
      const sample = sampleGreen(x, z, hole);
      heights.push(sample.height);
      directions.push(Math.atan2(sample.downhill.x, sample.downhill.z));
      assert.ok(Math.hypot(sample.downhill.x, sample.downhill.z) < 1, 'gravity stays below 3 yd/s² green friction');
      // Numerical derivatives catch a mismatch between drawn contours and the ball's acceleration.
      const epsilon = .0001;
      const gx = (sampleGreen(x + epsilon, z, hole).height - sampleGreen(x - epsilon, z, hole).height) / (2 * epsilon);
      const gz = (sampleGreen(x, z + epsilon, hole).height - sampleGreen(x, z - epsilon, hole).height) / (2 * epsilon);
      assert.ok(Math.abs(gx - sample.gradient.x) < 1e-8);
      assert.ok(Math.abs(gz - sample.gradient.z) < 1e-8);
      assert.ok(sample.downhill.x * gx + sample.downhill.z * gz <= 0, 'acceleration points downhill');
    }
    assert.ok(Math.max(...heights) - Math.min(...heights) > .10, `${hole.name} has visible elevation changes`);
    assert.ok(Math.max(...directions) - Math.min(...directions) > 1, `${hole.name} has changing break across the green`);
    for (const sign of [-1, 1]) {
      const edge = sampleGreen(hole.green.x + sign * hole.green.rx, hole.green.z, hole);
      assert.deepEqual(edge, { height: 0, gradient: { x: 0, z: 0 }, downhill: { x: 0, z: 0 } });
      const inside = sampleGreen(hole.green.x + sign * (hole.green.rx - .0001), hole.green.z, hole);
      assert.ok(Math.abs(inside.height) < 1e-8 && Math.hypot(inside.gradient.x, inside.gradient.z) < .00001);
    }
  }
});

test('green roll initially bends in the downhill direction of the surface', () => {
  for (let index = 0; index < HOLES.length; index++) {
    const game = createGame(index, HOLES.slice(0, index).map(hole => hole.par)), hole = holeFor(game);
    game.ball.x = hole.green.x;
    game.ball.z = hole.green.z - 10;
    const slope = sampleGreen(game.ball.x, game.ball.z, hole).downhill;
    assert.equal(terrainAt(game.ball.x, game.ball.z, hole), 'green');
    Object.assign(game.ball, { vx: 0, vz: 7 });
    game.phase = 'rolling';
    stepGame(game, 1 / 120);
    assert.equal(Math.sign(game.ball.vx), Math.sign(slope.x));
    assert.ok(Math.abs(game.ball.vx - slope.x / 120) < 1e-12);
    assert.ok(Math.abs(game.ball.vz - (7 - 3 / 120 + slope.z / 120)) < 1e-12);
    finish(game);
  }
});

test('the same putt travels farther downhill than uphill', () => {
  const origin = createGame(2), hole = holeFor(origin);
  origin.ball.x = hole.green.x + 8;
  origin.ball.z = hole.green.z - 3;
  const slope = sampleGreen(origin.ball.x, origin.ball.z, hole).downhill;
  const magnitude = Math.hypot(slope.x, slope.z);
  assert.ok(magnitude > .1);
  const distances = [1, -1].map(sign => {
    const game = structuredClone(origin);
    Object.assign(game.ball, { vx: sign * slope.x / magnitude * 4, vz: sign * slope.z / magnitude * 4 });
    game.phase = 'rolling';
    finish(game);
    return Math.hypot(game.ball.x - origin.ball.x, game.ball.z - origin.ball.z);
  });
  assert.ok(distances[0] > distances[1] + .1, `downhill ${distances[0]} should exceed uphill ${distances[1]}`);
});

test('breaking putts retain exact results across frame timing and saved mid-roll state', () => {
  for (let index = 0; index < HOLES.length; index++) {
    const start = () => {
      const game = createGame(index, HOLES.slice(0, index).map(hole => hole.par)), hole = holeFor(game);
      Object.assign(game.ball, { x: hole.green.x + 7, z: hole.green.z - 10 });
      strike(game, { power: .6, angle: .1 }, 'PUTTER');
      return game;
    };
    const expected = start(); finish(expected);
    for (const frames of [[1 / 30], [1 / 144], [.012, .021, .008]]) {
      const game = start(); stepGame(game, .213);
      const restored = readRun(JSON.parse(JSON.stringify({ version: 1, playerId: 'p1', game })), 'p1');
      assert.ok(restored);
      finish(restored, frames);
      assert.deepEqual(restored, expected);
      const resting = structuredClone(restored);
      stepGame(restored, 1);
      assert.deepEqual(restored, resting, 'a resting ball does not creep downhill between strokes');
    }
  }
});
