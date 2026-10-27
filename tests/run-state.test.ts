import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,strike,stepGame} from '../src/rules';
import {readRun} from '../src/run-state';
test('a saved shot resumes its ball and score without sharing mutable state',()=>{
 const game=createGame();strike(game,{power:.8,angle:.1});stepGame(game,.4);
 const loaded=readRun({version:1,playerId:'p1',game},'p1');assert.deepEqual(loaded,game);assert.notEqual(loaded?.ball,game.ball);
});
test('a different profile or malformed save cannot replace a run',()=>{
 const game=createGame();assert.equal(readRun({version:1,playerId:'p1',game},'p2'),null);
 game.ball.x=NaN;assert.equal(readRun({version:1,playerId:'p1',game},'p1'),null);
 assert.equal(readRun({version:42,playerId:'p1',game:createGame()},'p1'),null);
});
