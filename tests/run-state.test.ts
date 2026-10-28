import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,strike,stepGame,PHYSICS_STEP_SECONDS} from '../src/rules';
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

test('restoring between physics steps preserves flight and rolling motion',()=>{
 for (const club of ['7 IRON','PUTTER'] as const) {
  const game=createGame(), uninterrupted=createGame();
  for (const state of [game,uninterrupted]) {
   if(club==='PUTTER') state.ball.z=140;
   strike(state,{power:.49,angle:0},club);
  }
  stepGame(game,.013);
  assert.ok(game.stepRemainder>0);
  const saved=JSON.parse(JSON.stringify({version:1,playerId:'p1',game}));
  const loaded=readRun(saved,'p1');
  assert.ok(loaded);
  stepGame(loaded,.012);stepGame(uninterrupted,.025);
  assert.deepEqual(loaded,uninterrupted,`${club} continues at the same point in its shot`);
  for(let i=0;i<1000;i++) {stepGame(loaded,1/59);stepGame(uninterrupted,1/60);}
  assert.deepEqual(loaded,uninterrupted,`${club} finishes at the same lie and score`);
 }
});

test('older version-1 saves resume with no partial physics step',()=>{
 const game=createGame();strike(game,{power:.8,angle:.1});stepGame(game,.025);
 const legacy=JSON.parse(JSON.stringify(game));delete legacy.stepRemainder;
 const loaded=readRun({version:1,playerId:'p1',game:legacy},'p1');
 assert.ok(loaded);assert.equal(loaded.stepRemainder,0);
 assert.deepEqual(loaded.ball,game.ball);
 stepGame(loaded,.025);stepGame(game,.025);
 assert.deepEqual(loaded,game);
});

test('malformed fractional physics time cannot replace a saved run',()=>{
 for(const stepRemainder of [NaN,Infinity,-.001,PHYSICS_STEP_SECONDS,null,'0.001']) {
  const game={...createGame(),stepRemainder};
  assert.equal(readRun({version:1,playerId:'p1',game},'p1'),null);
 }
});
