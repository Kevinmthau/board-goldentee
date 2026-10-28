import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoardPlayerType, type BoardPlayer} from '@board.fun/web-sdk';
import {createGame, HOLES, holeFor, roundStrokes, strike, stepGame, type GolfState} from '../src/rules';
import {activeGolfer, advanceRoundHole, createRound, finishedHole, golferKey, holeComplete, MAX_PLAYERS,
  nextTurn, readRound, restoreGuestSeat, roundComplete, sameGolfer, saveRound, syncRoundRoster, winners, type GolfRound} from '../src/multiplayer';

function player(index: number, type = BoardPlayerType.Profile): BoardPlayer {
  return {playerId: `p${index}`, sessionId: index, name: `Player ${index}`, type, avatarId: ''};
}
const roster = (count: number) => Array.from({length: count}, (_, i) => player(i + 1));
function finish(game: GolfState, strokes = 3) {
  const hole = holeFor(game);
  Object.assign(game, {strokes, phase: 'holed', ball: {...hole.flag, y: 0, vx: 0, vy: 0, vz: 0}});
}
function settle(game: GolfState) {
  for (let i = 0; i < 2000 && (game.phase === 'flight' || game.phase === 'rolling'); i++) stepGame(game, 1 / 60);
  assert.ok(game.phase !== 'flight' && game.phase !== 'rolling');
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

test('one through four roster players receive independent balls, scores, wind, and score histories', () => {
  for (let count = 1; count <= MAX_PLAYERS; count++) {
    const round = createRound(roster(count));
    assert.equal(round.players.length, count);
    assert.equal(activeGolfer(round).playerId, 'p1');
    for (let i = 1; i < count; i++) {
      assert.deepEqual(round.players[i].game, round.players[0].game);
      assert.notEqual(round.players[i].game.ball, round.players[0].game.ball);
      assert.notEqual(round.players[i].game.wind, round.players[0].game.wind);
      assert.notEqual(round.players[i].game.completedStrokes, round.players[0].game.completedStrokes);
    }
  }
  for (const invalid of [[], roster(5), [player(1), player(1)], [player(1), {...player(2), sessionId: 1}]]) {
    assert.throws(() => createRound(invalid), RangeError);
  }
});

test('a resolved stroke passes the turn through all four golfers without changing waiting lies', () => {
  const round = createRound(roster(4));
  const waiting = round.players.slice(1).map(p => clone(p.game));
  assert.equal(strike(activeGolfer(round).game, {power: .45, angle: .1}, '7 IRON'), true);
  assert.equal(nextTurn(round), false, 'an airborne ball keeps its golfer');
  assert.equal(round.activeIndex, 0);
  settle(activeGolfer(round).game);
  assert.equal(nextTurn(round), true);
  assert.equal(round.activeIndex, 1);
  round.players.slice(1).forEach((p, index) => assert.deepEqual(p.game, waiting[index]));
  for (const expected of [2, 3, 0]) {
    assert.equal(strike(activeGolfer(round).game, {power: .2, angle: 0}, 'PUTTER'), true);
    settle(activeGolfer(round).game);
    assert.equal(nextTurn(round), true);
    assert.equal(round.activeIndex, expected);
  }
  assert.deepEqual(round.players.map(p => p.game.strokes), [1, 1, 1, 1]);
});

test('finished golfers are skipped and the last unfinished golfer keeps playing', () => {
  const round = createRound(roster(4));
  finish(round.players[1].game, 2);
  finish(round.players[3].game, 3);
  assert.equal(nextTurn(round), true);
  assert.equal(round.activeIndex, 2);
  finish(round.players[2].game, 4);
  assert.equal(nextTurn(round), true);
  assert.equal(round.activeIndex, 0);
  assert.equal(nextTurn(round), true);
  assert.equal(round.activeIndex, 0, 'only golfer one remains');
  finish(round.players[0].game, 3);
  assert.equal(nextTurn(round), false);
  assert.equal(holeComplete(round), true);
  assert.equal(roundComplete(round), false);
});

test('a stroke-limit result counts as finished and no hole advances before every golfer finishes', () => {
  const round = createRound(roster(2));
  round.players[0].game.phase = 'limit'; round.players[0].game.strokes = HOLES[0].maxStrokes;
  assert.equal(finishedHole(round.players[0].game), true);
  assert.equal(advanceRoundHole(round), false);
  assert.equal(nextTurn(round), true);
  finish(round.players[1].game, 2);
  assert.equal(advanceRoundHole(round), true);
  assert.equal(round.activeIndex, 0);
  assert.deepEqual(round.players.map(p => p.game.completedStrokes), [[10], [2]]);
  assert.ok(round.players.every(p => p.game.holeIndex === 1 && p.game.strokes === 0 && p.game.phase === 'ready'));
  assert.deepEqual(round.players[0].game.wind, round.players[1].game.wind);
});

test('four players complete nine holes through actual putt physics with explicit shared progression', () => {
  const round = createRound(roster(4));
  for (let holeIndex = 0; holeIndex < HOLES.length; holeIndex++) {
    for (let golfer = 0; golfer < 4; golfer++) {
      assert.equal(round.activeIndex, golfer);
      const game = activeGolfer(round).game, hole = holeFor(game);
      game.ball = {...hole.flag, z: hole.flag.z - .3, y: 0, vx: 0, vy: 0, vz: 0};
      assert.equal(strike(game, {power: 0, angle: 0}, 'PUTTER'), true);
      settle(game);
      assert.equal(game.phase, 'holed');
      assert.equal(game.strokes, 1);
      assert.equal(nextTurn(round), golfer < 3);
    }
    assert.equal(holeComplete(round), true);
    assert.ok(round.players.every(p => p.game.holeIndex === holeIndex), 'completion waits for Next hole');
    assert.equal(advanceRoundHole(round), holeIndex < HOLES.length - 1);
  }
  assert.equal(roundComplete(round), true);
  assert.deepEqual(round.players.map(p => roundStrokes(p.game)), [9, 9, 9, 9]);
  assert.equal(winners(round).length, 4);
  const rematch = createRound(roster(4));
  assert.deepEqual(rematch.players.map(p => p.game.strokes), [0, 0, 0, 0]);
  assert.equal(roundComplete(rematch), false);
});

test('lowest total wins and ties share the win only at the completed round', () => {
  const round = createRound(roster(4));
  assert.deepEqual(winners(round), []);
  round.players.forEach((p, i) => { p.game = createGame(8, [3, 4, 5, 4, 3, 5, 4, 4]); finish(p.game, [4, 3, 3, 5][i]); });
  assert.deepEqual(winners(round).map(p => p.playerId), ['p2', 'p3']);
  assert.equal(advanceRoundHole(round), false);
});

test('multiplayer saves retain turn, all lies, penalties and live physics without sharing mutable objects', () => {
  const round = createRound(roster(4)); round.activeIndex = 2;
  finish(round.players[0].game, 2);
  const game = activeGolfer(round).game;
  assert.equal(strike(game, {power: .7, angle: .12}, '7 IRON'), true);
  stepGame(game, .013);
  const saved = saveRound(round, 'p1');
  const loaded = readRound(saved, 'p1');
  assert.deepEqual(loaded, round); assert.ok(loaded);
  assert.notEqual(saved.round.players[2].game.ball, game.ball);
  assert.notEqual(loaded.players[2].game.ball, saved.round.players[2].game.ball);
  for (let i = 0; i < 1000; i++) { stepGame(game, 1 / 60); stepGame(activeGolfer(loaded).game, 1 / 60); }
  assert.deepEqual(loaded, round);
  assert.equal(readRound(saved, 'other-profile'), null);
});

test('legacy solo saves migrate without losing earlier holes, scores, wind or a pending shot', () => {
  const game = createGame(4, [2, 4, 6, 4]); strike(game, {power: .8, angle: -.1}, '5 IRON'); stepGame(game, .017);
  const old = {version: 1, playerId: 'p1', game};
  const round = readRound(old, 'p1'); assert.ok(round);
  assert.equal(round.players.length, 1); assert.equal(round.activeIndex, 0);
  assert.deepEqual(round.players[0].game, game);
  assert.equal(syncRoundRoster(round, [{...player(1), sessionId: 12, name: 'Current profile name'}]), true);
  assert.equal(round.players[0].name, 'Current profile name'); assert.equal(round.players[0].sessionId, 12);
  assert.deepEqual(readRound(saveRound(round, 'p1'), 'p1'), round);
});

test('legacy single-hole pre-wind saves migrate in calm conditions and retain their score', () => {
  const game = clone(createGame()) as Partial<GolfState>; game.strokes = 2;
  delete game.holeIndex; delete game.completedStrokes; delete game.wind; delete game.stepRemainder;
  const round = readRound({version: 1, playerId: 'p1', game}, 'p1'); assert.ok(round);
  assert.equal(round.players[0].game.strokes, 2);
  assert.equal(round.players[0].game.holeIndex, 0);
  assert.deepEqual(round.players[0].game.wind, {x: 0, z: 0});
});

test('malformed and impossible multiplayer saves cannot replace an active round', () => {
  const valid = saveRound(createRound(roster(4)), 'p1');
  const mutations: ((value: typeof valid) => void)[] = [
    v => { v.round.players = []; }, v => { v.round.players.push({...clone(v.round.players[0]), sessionId: 5}); },
    v => { v.round.activeIndex = -1; }, v => { v.round.activeIndex = 4; }, v => { v.round.activeIndex = 1.5; },
    v => { v.round.players[1].playerId = 'p1'; }, v => { v.round.players[1].sessionId = 1; },
    v => { v.round.players[1].type = 'robot' as BoardPlayerType; },
    v => { v.round.players[1].game = createGame(1, [3]); },
    v => { strike(v.round.players[1].game, {power: .7, angle: 0}); },
    v => { finish(v.round.players[0].game, 2); },
    v => { v.round.players[2].game.ball.x = NaN; },
    v => { v.round.players[2].game.completedStrokes = [3]; },
    v => { v.round.players[2].game.strokes = 11; },
  ];
  for (const mutate of mutations) { const value = clone(valid); mutate(value); assert.equal(readRound(value, 'p1'), null); }
  for (const value of [null, undefined, [], {}, {version: 3, playerId: 'p1'}, {version: 2, playerId: 'p1', round: null}]) {
    assert.equal(readRound(value, 'p1'), null);
  }
});

test('roster refresh follows stable identities through session changes and preserves turn order', () => {
  const round = createRound([player(1), player(2, BoardPlayerType.Guest)]);
  round.activeIndex = 1; round.players[1].game.strokes = 2;
  assert.equal(syncRoundRoster(round, [{...player(2, BoardPlayerType.Guest), sessionId: 22, name: 'Renamed guest'}, {...player(1), sessionId: 11}]), true);
  assert.deepEqual(round.players.map(p => p.sessionId), [11, 22]);
  assert.equal(activeGolfer(round).name, 'Renamed guest'); assert.equal(activeGolfer(round).game.strokes, 2);
  const before = clone(round);
  assert.equal(syncRoundRoster(round, [{...player(1), name: 'Should not leak'}, {...player(3), sessionId: 22}]), false);
  assert.deepEqual(round, before, 'a missing/replaced golfer leaves all names and scores untouched');
});

test('multiple guests without profile IDs remain distinct even when their display names match', () => {
  const guests = [1, 2, 3, 4].map(i => ({...player(i, BoardPlayerType.Guest), playerId: '', name: 'Guest'}));
  const round = createRound(guests);
  assert.equal(new Set(round.players.map(golferKey)).size, 4);
  const loaded = readRound(saveRound(round, 'owner'), 'owner'); assert.ok(loaded);
  assert.equal(syncRoundRoster(loaded, guests.slice().reverse()), true);
  assert.deepEqual(loaded.players.map(p => p.sessionId), [1, 2, 3, 4]);
  assert.equal(syncRoundRoster(loaded, guests.map(p => ({...p, sessionId: p.sessionId + 10}))), false);
  assert.equal(syncRoundRoster(loaded, guests.map((p, i) => i === 0 ? {...p, name: 'Replacement'} : p)), false);
});

test('roster recovery finds the replacement seat without mistaking a retained blank-ID guest for an extra', () => {
  const original = [player(1), {...player(2, BoardPlayerType.Guest), playerId: '', name: 'Guest'}, player(3), player(4)];
  const round = createRound(original);
  const changed = [...original.slice(0, 3), {...player(5), sessionId: 4}];
  const extras = changed.filter(current => !round.players.some(saved => sameGolfer(saved, current)));
  assert.deepEqual(extras, [changed[3]]);
  assert.equal(sameGolfer(original[1], {...original[1], name: 'Replacement guest'}), false);
  assert.equal(sameGolfer(original[1], {...original[1], sessionId: 20}), false);
});

test('explicit guest restoration preserves the named guest’s score when their session ID changes', () => {
  const guest = {...player(2, BoardPlayerType.Guest), playerId: '', name: 'Lee'};
  const round = createRound([player(1), guest]); round.activeIndex = 1;
  round.players[0].game = createGame(2, [3, 4]);
  round.players[1].game = createGame(2, [2, 5]); round.players[1].game.strokes = 3;
  const before = clone(round.players[1].game);
  const chosen = {...guest, sessionId: 22};
  assert.equal(syncRoundRoster(round, [player(1), chosen]), false, 'ordinary rejoin cannot silently inherit scores');
  assert.equal(restoreGuestSeat(round, 1, chosen), true, 'the named explicit restoration can rebind the saved guest');
  assert.equal(round.activeIndex, 1);
  assert.equal(round.players[1].sessionId, 22);
  assert.deepEqual(round.players[1].game, before);
  assert.equal(syncRoundRoster(round, [player(1), chosen]), true);
  assert.deepEqual(readRound(saveRound(round, 'p1'), 'p1'), round, 'restored seat survives another save');
});

test('explicit guest restoration rejects profiles, AI, stable IDs, and seats belonging to another golfer', () => {
  const guest = {...player(2, BoardPlayerType.Guest), playerId: '', name: 'Lee'};
  const third = {...player(3, BoardPlayerType.Guest), playerId: '', name: 'Sam'};
  const round = createRound([player(1), guest, third, player(4, BoardPlayerType.Guest)]);
  const before = clone(round);
  for (const [index, chosen] of [
    [0, {...guest, sessionId: 22}], [3, {...guest, sessionId: 22}],
    [1, player(22)], [1, player(22, BoardPlayerType.AI)],
    [1, third], [1, {...player(4, BoardPlayerType.Guest), sessionId: 44}],
    [1, {...guest, sessionId: 1}], [1, {...guest, sessionId: -1}],
    [-1, {...guest, sessionId: 22}], [4, {...guest, sessionId: 22}], [1.5, {...guest, sessionId: 22}],
  ] as const) assert.equal(restoreGuestSeat(round, index, chosen), false);
  assert.deepEqual(round, before, 'rejected assignments cannot alter identity or golf state');
});
