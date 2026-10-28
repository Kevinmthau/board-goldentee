import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceHole, clubFor, createGame, distanceToCup, fairwayAt, holeFor, HOLES, isFinalHole,
  roundPar, roundStrokes, scoreLabel, stepGame, strike, terrainAt, type GolfState } from '../src/rules';

function calmGame(holeIndex = 0, completedStrokes: number[] = []): GolfState {
  const game = createGame(holeIndex, completedStrokes);
  game.wind = { x: 0, z: 0 };
  return game;
}

function finish(game: GolfState, frames = [1 / 60]) {
  for (let i = 0; i < 4000 && (game.phase === 'flight' || game.phase === 'rolling'); i++) stepGame(game, frames[i % frames.length]);
  assert.ok(game.phase !== 'flight' && game.phase !== 'rolling', 'every shot resolves');
}

test('nine distinct coastal holes preserve the original three and total par 36', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(new Set(HOLES.map(h => h.id)).size, 9);
  assert.equal(new Set(HOLES.map(h => h.name)).size, 9);
  assert.deepEqual(HOLES.map(h => h.par), [3, 4, 5, 4, 3, 5, 4, 4, 4]);
  assert.equal(HOLES.reduce((sum, hole) => sum + hole.par, 0), 36);
  assert.deepEqual(HOLES.map(h => Math.hypot(h.flag.x - h.tee.x, h.flag.z - h.tee.z)),
    [150, 340, 510, 375, 175, 530, 390, 320, 410]);
  for (const hole of HOLES) {
    assert.equal(terrainAt(hole.tee.x, hole.tee.z, hole), 'fairway');
    assert.equal(terrainAt(hole.flag.x, hole.flag.z, hole), 'green');
    for (const bunker of hole.bunkers) assert.equal(terrainAt(bunker.x, bunker.z, hole), 'bunker');
    for (const water of hole.water) assert.equal(terrainAt(water.x, water.z, hole), 'water');
  }
  for (const hole of HOLES.slice(1)) {
    assert.ok(hole.water.length > 0 && hole.bunkers.length > 0);
    for (const node of hole.fairway) assert.deepEqual(fairwayAt(node.z, hole), {x: node.x, width: node.width});
  }
});

test('recommendations use the current hole and include the driver and 5 iron', () => {
  const game = createGame(1, [3]);
  assert.equal(clubFor(game), 'DRIVER');
  assert.equal(distanceToCup(game), 340);
  game.ball.z = 155;
  assert.equal(clubFor(game), '5 IRON');
  game.ball.z = 190;
  assert.equal(clubFor(game), '7 IRON');
  game.ball.z = 225;
  assert.equal(clubFor(game), '9 IRON');
  game.ball.z = 290;
  assert.equal(clubFor(game), 'WEDGE');
  game.ball.z = 330;
  assert.equal(clubFor(game), 'PUTTER');
});

test('a full driver clears the par-5 water carry and finishes on the fairway', () => {
  const game = calmGame(2, [3, 4]);
  strike(game, {power: 1, angle: 0}, 'DRIVER');
  let flewOverWater = false;
  for (let i = 0; i < 2000 && (game.phase === 'flight' || game.phase === 'rolling'); i++) {
    stepGame(game, 1 / 60);
    if (terrainAt(game.ball.x, game.ball.z, holeFor(game)) === 'water') {
      flewOverWater = true;
      assert.ok(game.ball.y > 0);
      assert.equal(game.penalty, false);
    }
  }
  assert.ok(flewOverWater, 'the shot crosses the water footprint');
  assert.equal(game.phase, 'ready');
  assert.equal(game.penalty, false);
  assert.equal(game.strokes, 1);
  assert.equal(terrainAt(game.ball.x, game.ball.z, holeFor(game)), 'fairway');
  assert.ok(Math.abs(game.ball.z - 250) < 2);
});

test('a short carry lands in water, adds one penalty, and returns to the last safe lie', () => {
  const expected = calmGame(2, [3, 4]);
  strike(expected, {power: 1, angle: 0}, '5 IRON');
  finish(expected);
  assert.equal(expected.penaltyKind, 'water');
  assert.equal(expected.penalty, true);
  assert.equal(expected.strokes, 2);
  assert.equal(expected.phase, 'ready');
  assert.deepEqual({x: expected.ball.x, z: expected.ball.z}, HOLES[2].tee);
  for (const frames of [[1/59], [1/144], [.009, .025]]) {
    const game = calmGame(2, [3, 4]);
    strike(game, {power: 1, angle: 0}, '5 IRON');
    finish(game, frames);
    assert.deepEqual(game, expected);
  }
  stepGame(expected, 10);
  assert.equal(expected.strokes, 2, 'resting after recovery cannot add another penalty');
  strike(expected, {power: 1, angle: 0}, 'DRIVER');
  assert.equal(expected.penalty, false);
  assert.equal(expected.penaltyKind, null);
});

test('rolling into water is a penalty, with the last stroke capped at the hole limit', () => {
  for (const strokes of [0, 8]) {
    const game = calmGame(2, [3, 4]);
    game.ball.z = 140;
    game.lastSafe.z = 140;
    game.strokes = strokes;
    assert.equal(terrainAt(0, 140, HOLES[2]), 'fairway');
    strike(game, {power: .8, angle: 0}, 'PUTTER');
    finish(game);
    assert.equal(game.penaltyKind, 'water');
    assert.equal(game.strokes, strokes + 2);
    assert.equal(game.ball.z, 140);
    assert.equal(game.phase, strokes === 8 ? 'limit' : 'ready');
  }
});

test('new bunkers reduce carry without adding a penalty stroke', () => {
  for (const index of [1, 2]) {
    const game = calmGame(index, index === 1 ? [3] : [3,4]);
    const bunker = holeFor(game).bunkers[0];
    game.ball.x = bunker.x; game.ball.z = bunker.z;
    strike(game, {power: .5, angle: 0}, 'WEDGE');
    assert.ok(Math.hypot(game.ball.vx, game.ball.vz) < 8);
    finish(game);
    assert.equal(game.strokes, 1);
    assert.equal(game.penalty, false);
  }
});

test('nine-hole progression waits for each result and records each score exactly once', () => {
  const game = createGame();
  const expected: number[] = [];
  assert.equal(advanceHole(game), false);
  for (let index = 0; index < HOLES.length; index++) {
    assert.equal(game.holeIndex, index);
    assert.equal(isFinalHole(game), index === 8);
    assert.deepEqual(game.completedStrokes, expected);
    assert.equal(game.strokes, 0);
    assert.equal(game.phase, 'ready');
    assert.equal(game.penalty, false);
    assert.equal(game.stepRemainder, 0);
    assert.equal(advanceHole(game), false, 'a repeated tap cannot skip a new hole');
    game.phase = index === 1 ? 'limit' : 'holed';
    game.strokes = index === 1 ? 10 : HOLES[index].par;
    const original = structuredClone(game);
    stepGame(game, 20);
    assert.deepEqual(game, original, 'results never advance automatically');
    expected.push(game.strokes);
    assert.equal(roundStrokes(game), expected.reduce((sum, score) => sum + score, 0));
    assert.equal(roundPar(game), HOLES.slice(0, index + 1).reduce((sum, hole) => sum + hole.par, 0));
    assert.equal(advanceHole(game), index < 8);
  }
  assert.equal(roundPar(game), 36);
  assert.equal(roundStrokes(game), 42);
  assert.deepEqual(game.completedStrokes, expected.slice(0, 8));
  assert.equal(advanceHole(game), false, 'the final hole stays on its result');
  assert.equal(scoreLabel(3, 4), 'Birdie');
  assert.equal(scoreLabel(3, 5), 'Eagle');
  assert.equal(scoreLabel(2, 5), 'Albatross');
  assert.equal(scoreLabel(5, 5), 'Par');
});

test('both new holes have a playable driver, approach, and putt route', () => {
  for (const index of [1, 2]) {
    const game = calmGame(index, index === 1 ? [3] : [3,4]);
    strike(game, {power: 1, angle: 0}, 'DRIVER'); finish(game);
    assert.equal(game.penalty, false);
    if (index === 2) {
      strike(game, {power: 1, angle: 0}, '5 IRON'); finish(game);
      assert.equal(game.penalty, false);
    }
    strike(game, {power: index === 1 ? .82 : .72, angle: 2 * Math.PI / 180}, '9 IRON'); finish(game);
    assert.equal(game.phase, 'ready');
    assert.equal(game.penalty, false);
    assert.equal(terrainAt(game.ball.x, game.ball.z, holeFor(game)), 'green');
    const power = (Math.sqrt(6 * distanceToCup(game) + 1) - 1) / 14;
    strike(game, {power, angle: 0}, 'PUTTER'); finish(game);
    assert.equal(game.phase, 'holed');
    assert.equal(game.strokes, holeFor(game).par - 1);
  }
});

test('greenside sand cuts into the green with the same precedence as the artwork', () => {
  // Both points sit inside the green and the adjacent bunker ellipse.
  assert.equal(terrainAt(18, 333, HOLES[1]), 'bunker');
  assert.equal(terrainAt(18, 510, HOLES[2]), 'bunker');
  for (const index of [1, 2]) {
    const game = calmGame(index, index === 1 ? [3] : [3,4]);
    game.ball.x = 18;
    game.ball.z = index === 1 ? 333 : 510;
    assert.equal(clubFor(game), 'SAND WEDGE', 'visible sand recommends the sand wedge, not putting');
    strike(game, {power: .5, angle: 0}, 'WEDGE');
    assert.ok(Math.hypot(game.ball.vx, game.ball.vz) < 8, 'the sand lie reduces carry');
  }
});


for (const calm of [true, false]) {
  test(`all nine holes have penalty-free routes with recommended clubs in ${calm ? 'calm air' : 'their steady winds'}`, () => {
    for (let index = 0; index < HOLES.length; index++) {
      let game = createGame(index, HOLES.slice(0, index).map(hole => hole.par));
      if (calm) game.wind = { x: 0, z: 0 };
      // Search only valid power, using the recommended club and aiming at the cup.
      // Every chosen stroke must finish closer without water or out-of-bounds penalties.
      while (game.phase === 'ready' && game.strokes <= HOLES[index].par) {
        const club = clubFor(game);
        let best: GolfState | null = null;
        let bestDistance = distanceToCup(game);
        for (let percent = 8; percent <= 100; percent++) {
          const trial = structuredClone(game);
          assert.ok(strike(trial, { power: percent / 100, angle: 0 }, club));
          finish(trial, [1]);
          const distance = trial.penalty ? Infinity : trial.phase === 'holed' ? -1 : distanceToCup(trial);
          if (distance < bestDistance) { best = trial; bestDistance = distance; }
        }
        assert.ok(best, `${HOLES[index].name} has a safe next shot from each reached lie`);
        assert.equal(best.penalty, false);
        game = best;
      }
      assert.equal(game.phase, 'holed', `${HOLES[index].name} can be completed within par + 1`);
      assert.ok(game.strokes <= HOLES[index].par + 1);
    }
  });
}
