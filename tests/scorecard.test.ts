import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, HOLES } from '../src/rules';
import { drawScorecard, formatToPar, scorecardFor, SCORECARD_BOX } from '../src/scorecard';

test('a traditional nine-hole card shows course yardages and par 36 before any scores are entered', () => {
  const card = scorecardFor(createGame());
  assert.equal(card.holes.length, 9);
  assert.equal(card.par, 36);
  assert.equal(card.through, 0);
  assert.equal(card.strokes, 0);
  assert.equal(card.completedPar, 0);
  assert.equal(card.yards, HOLES.reduce((sum, hole) => sum + Math.round(Math.hypot(hole.flag.x - hole.tee.x, hole.flag.z - hole.tee.z)), 0));
  assert.ok(card.holes.every(hole => hole.strokes === null && hole.relative === null && hole.mark === 'none'));
});

test('partial scorecard totals use completed holes only and leave current and future holes blank', () => {
  const game = createGame(2, [2, 5]);
  game.strokes = 2; game.phase = 'flight';
  const card = scorecardFor(game);
  assert.equal(card.through, 2);
  assert.equal(card.strokes, 7);
  assert.equal(card.completedPar, 7);
  assert.equal(card.relative, 0);
  assert.deepEqual(card.holes.map(hole => hole.strokes), [2, 5, null, null, null, null, null, null, null]);
  game.phase = 'holed'; game.strokes = 4;
  const finished = scorecardFor(game);
  assert.equal(finished.through, 3);
  assert.equal(finished.strokes, 11);
  assert.equal(finished.completedPar, 12);
  assert.equal(finished.relative, -1);
});

test('finished scores have conventional under/over-par marks and a correct final total', () => {
  const deltas = [-1, -2, 0, 1, 2, -1, 0, 3, 1];
  const scores = HOLES.map((hole, i) => hole.par + deltas[i]);
  const game = createGame(8, scores.slice(0, 8));
  game.strokes = scores[8]; game.phase = 'holed';
  const card = scorecardFor(game);
  assert.deepEqual(card.holes.map(hole => hole.mark),
    ['birdie', 'eagle', 'none', 'bogey', 'double-bogey', 'birdie', 'none', 'double-bogey', 'bogey']);
  assert.equal(card.through, 9);
  assert.equal(card.completedPar, 36);
  assert.equal(card.strokes, 39);
  assert.equal(card.relative, 3);
  assert.equal(formatToPar(card.relative), '+3');
  assert.equal(formatToPar(0), 'E');
  assert.equal(formatToPar(-2), '-2');
});

test('stroke-limit results enter the capped score without counting unplayed holes', () => {
  const game = createGame(1, [3]);
  game.strokes = HOLES[1].maxStrokes; game.phase = 'limit';
  const card = scorecardFor(game);
  assert.equal(card.through, 2);
  assert.equal(card.strokes, 13);
  assert.equal(card.relative, 6);
  assert.equal(card.holes[1].strokes, 10);
  assert.equal(card.holes[1].mark, 'double-bogey');
  assert.ok(card.holes.slice(2).every(hole => hole.strokes === null));
});

test('scorecard fits the safe result region and draws readable scores, labels, and unplayed dashes', () => {
  const game = createGame(1, [2]); game.strokes = 5; game.phase = 'holed';
  const drawn: {text: string; x: number; y: number; font: string}[] = [];
  const numericGeometry: number[][] = [];
  const ctx = new Proxy({font: ''} as Record<string, unknown>, {
    get(state, key: string) {
      if (key in state) return state[key];
      if (key === 'fillText') return (text: string, x: number, y: number) => drawn.push({text, x, y, font: state.font as string});
      return (...args: number[]) => numericGeometry.push(args);
    },
    set(state, key: string, value) { state[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  drawScorecard(ctx, game);
  assert.ok(numericGeometry.flat().every(Number.isFinite));
  assert.deepEqual(SCORECARD_BOX, {x: 48, y: 600, width: 984, height: 590});
  assert.ok(drawn.every(label => label.x >= 48 && label.x <= 1032 && label.y >= 600 && label.y <= 1190));
  assert.ok(drawn.every(label => Number.parseFloat(label.font) >= 32));
  assert.ok(drawn.some(label => label.text === 'SCORECARD'));
  assert.ok(drawn.some(label => label.text === 'OUT'));
  assert.ok(drawn.some(label => label.text === 'THROUGH 2 OF 9'));
  assert.ok(drawn.some(label => label.text === '7 STROKES  /  PAR 7'));
  assert.equal(drawn.filter(label => label.text === '—').length, 14);
  assert.ok(drawn.filter(label => label.y === 945).every(label => label.text === 'SCORE' || Number.parseFloat(label.font) === 48));
});
