import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardPlayerType, type BoardPlayer } from '@board.fun/web-sdk';
import { createRound, type GolfRound } from '../src/multiplayer';
import { createGame, HOLES } from '../src/rules';
import { ADD_PLAYER, PLAYER_ROWS, REMOVE_PLAYER_ROWS, READY_BUTTON, START_ROUND, PLAYERS_BUTTON,
  MULTIPLAYER_SCORECARD_BOX, boundedPlayerName, drawMultiplayerSetup, drawMultiplayerScorecard,
  drawTurnHandoff } from '../src/multiplayer-view';

interface Label {text: string; x: number; y: number; size: number; left: number; right: number; alpha: number}
function drawing() {
  const labels: Label[] = [], geometry: number[][] = [];
  let state: Record<string, unknown> = {font: '48px sans-serif', globalAlpha: 1, textAlign: 'center'};
  const stack: Record<string, unknown>[] = [];
  const measure = (value: string) => Array.from(value).reduce((sum, c) => sum +
    (/[MW@]/.test(c) ? 0.9 : /[il !.,]/.test(c) ? 0.3 : 0.58) * parseFloat(String(state.font)), 0);
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key: string) {
      if (key in state) return state[key];
      if (key === 'save') return () => stack.push({...state});
      if (key === 'restore') return () => { state = stack.pop()!; };
      if (key === 'measureText') return (text: string) => ({width: measure(text)});
      if (key === 'fillText') return (text: string, x: number, y: number) => {
        const width = measure(text), align = state.textAlign;
        const left = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
        labels.push({text, x, y, left, right: left + width, size: parseFloat(String(state.font)), alpha: Number(state.globalAlpha)});
      };
      return (...args: number[]) => geometry.push(args);
    },
    set(_target, key: string, value) { state[key] = value; return true; },
  });
  return {ctx, labels, geometry};
}

const names = ['Alex', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', 'Éléonore van der Meer', '🏌️ Jordan Rodriguez'];
const roster = (count: number): BoardPlayer[] => Array.from({length: count}, (_, i) =>
  ({sessionId: i + 1, playerId: `profile-${i}`, name: names[i], type: BoardPlayerType.Profile, avatarId: 0}));

function safeLabels(labels: Label[]) {
  for (const label of labels) {
    assert.ok(label.size >= 32, `${label.text} has a readable font`);
    assert.ok(label.left >= 48 && label.right <= 1032, `${label.text} stays inside the horizontal safe inset (${label.left}, ${label.right})`);
    assert.ok(label.y - label.size / 2 >= 48 && label.y + label.size / 2 <= 1872,
      `${label.text} stays inside the vertical safe inset`);
  }
}

test('all multiplayer touch targets meet the size floor and avoid the default piece position', () => {
  for (const box of [...PLAYER_ROWS, ...REMOVE_PLAYER_ROWS, ADD_PLAYER, START_ROUND, READY_BUTTON, PLAYERS_BUTTON]) {
    assert.ok(box.width >= 120 && box.height >= 120);
    assert.ok(box.x >= 48 && box.y >= 48 && box.x + box.width <= 1032 && box.y + box.height <= 1872);
  }
  for (const box of [...PLAYER_ROWS, ...REMOVE_PLAYER_ROWS, ADD_PLAYER, START_ROUND, READY_BUTTON]) {
    assert.ok(box.y + box.height <= 1305 || box.y >= 1480 || box.x + box.width < 450 || box.x > 630);
  }
  assert.ok(READY_BUTTON.y + READY_BUTTON.height < START_ROUND.y, 'shared handoff leaves room for Change setup');
});

test('one through four-player setup keeps roster names bounded and caps the Add player control', () => {
  for (let count = 1; count <= 4; count++) {
    const players = roster(count), before = structuredClone(players);
    const {ctx, labels, geometry} = drawing();
    drawMultiplayerSetup(ctx, players, true);
    safeLabels(labels);
    assert.deepEqual(players, before, 'rendering must not modify full roster names');
    assert.equal(labels.filter(label => label.text === 'ADD PLAYER').length, count < 4 ? 1 : 0);
    assert.equal(labels.filter(label => label.text === '−').length, count - 1);
    assert.ok(!labels.some(label => label.text === '−' && label.y < REMOVE_PLAYER_ROWS[1].y),
      'the primary roster player is retained');
    assert.equal(labels.filter(label => label.text === 'TAP TO CHANGE PLAYER').length, count);
    assert.ok(labels.some(label => label.text === 'TEE OFF'));
    assert.ok(geometry.flat().every(Number.isFinite));
    if (count > 1) assert.ok(labels.some(label => label.text.includes('…')), 'extreme names show an ellipsis at the same font size');
  }
});

test('setup distinguishes an empty roster, waiting for a piece, and continuing a saved round', () => {
  const empty = drawing(); drawMultiplayerSetup(empty.ctx, [], false);
  assert.ok(empty.labels.some(label => label.text === 'CHOOSE PLAYER'));
  assert.ok(empty.labels.some(label => label.text === 'Choose a player to begin'));
  const waiting = drawing(); drawMultiplayerSetup(waiting.ctx, roster(2), false);
  assert.ok(waiting.labels.some(label => label.text === 'TEE OFF' && label.alpha < 1));
  assert.ok(waiting.labels.some(label => label.text === 'Place a Sports piece to tee off.'));
  const resumed = drawing(); drawMultiplayerSetup(resumed.ctx, roster(4), true, true);
  assert.ok(resumed.labels.some(label => label.text === 'CONTINUE ROUND' && label.alpha === 1));
});

test('a four-player scorecard retains each completed score and leaves unfinished holes blank', () => {
  const round = createRound(roster(4));
  round.players.forEach((player, index) => {
    player.game = createGame(1, [index + 1]);
    player.game.strokes = index + 2;
    if (index < 2) player.game.phase = 'holed';
  });
  round.activeIndex = 2;
  const {ctx, labels, geometry} = drawing(); drawMultiplayerScorecard(ctx, round);
  safeLabels(labels);
  assert.ok(labels.every(label => label.y >= MULTIPLAYER_SCORECARD_BOX.y &&
    label.y <= MULTIPLAYER_SCORECARD_BOX.y + MULTIPLAYER_SCORECARD_BOX.height));
  assert.ok(geometry.flat().every(Number.isFinite));
  assert.equal(labels.filter(label => label.text === '2 HOLES').length, 2);
  assert.equal(labels.filter(label => label.text === '1 HOLE').length, 2);
  assert.equal(labels.filter(label => label.text === '—').length, 30, 'four cards contain 36 holes, six completed');
  for (let row = 0; row < 4; row++) {
    const top = 828 + row * 100;
    assert.ok(labels.some(label => label.x === 317 && label.y === top + 50 && label.text === String(row + 1)));
    const total = row < 2 ? 2 * row + 3 : row + 1;
    assert.ok(labels.some(label => label.x === 972 && label.y === top + 35 && label.text === String(total)));
    const name = labels.find(label => label.x === 76 && label.y === top + 34)!;
    assert.ok(name.right < 282, 'bounded name cannot enter the hole columns');
  }
});

test('final scorecards support ten-stroke holes and all four nine-hole totals without overlap', () => {
  const round: GolfRound = createRound(roster(4));
  round.players.forEach(player => { player.game = createGame(8, Array(8).fill(10)); player.game.strokes = 10; player.game.phase = 'limit'; });
  const {ctx, labels} = drawing(); drawMultiplayerScorecard(ctx, round);
  safeLabels(labels);
  assert.equal(labels.filter(label => label.text === '90').length, 4);
  assert.equal(labels.filter(label => label.text === '+54').length, 4);
  assert.equal(labels.filter(label => label.text === '—').length, 0);
  for (const label of labels.filter(label => label.text === '10')) {
    assert.ok(label.size === 48 && label.right - label.left < 70);
  }
  assert.equal(labels.filter(label => label.text === String(HOLES.length) + ' HOLES').length, 4);
});

test('handoffs identify the active golfer and skip the shot instruction when roster recovery is required', () => {
  const round = createRound(roster(4)); round.activeIndex = 1;
  round.players[0].game.phase = 'holed'; round.players[0].game.strokes = 2;
  round.players[2].game.phase = 'limit'; round.players[2].game.strokes = 10;
  const ready = drawing(); drawTurnHandoff(ready.ctx, round);
  safeLabels(ready.labels);
  assert.ok(ready.labels.some(label => label.text === 'PLAYER 2  /  HOLE 1'));
  assert.ok(ready.labels.some(label => label.text === 'HOLED'));
  assert.ok(ready.labels.some(label => label.text === 'LIMIT'));
  assert.ok(ready.labels.some(label => label.text === 'READY' && label.y < 1640));
  const missing = drawing(); drawTurnHandoff(missing.ctx, round, names.slice(1));
  safeLabels(missing.labels);
  assert.ok(missing.labels.some(label => label.text === 'RESTORE PLAYERS'));
  assert.ok(!missing.labels.some(label => label.text === 'READY'));
  assert.ok(!missing.labels.some(label => label.text === 'Tap READY, then hold it still.'));
});

test('bounded name display preserves complete names that fit and Unicode code points when shortening', () => {
  const {ctx} = drawing();
  assert.equal(boundedPlayerName(ctx, 'Alex', 400), 'Alex');
  const original = '🏌Jordan'.repeat(20), label = boundedPlayerName(ctx, original, 300);
  assert.ok(label.endsWith('…'));
  assert.ok(!/[\uD800-\uDBFF]$/.test(label.slice(0, -1)), 'do not cut a surrogate pair');
  assert.ok(ctx.measureText(label).width <= 300);
});
