import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,strike,stepGame,PHYSICS_STEP_SECONDS,HOLES} from '../src/rules';
import {readRun} from '../src/run-state';
test('a saved shot resumes its ball and score without sharing mutable state',()=>{
 const game=createGame();strike(game,{power:.8,angle:.1});stepGame(game,.4);
 const loaded=readRun({version:1,playerId:'p1',game},'p1');assert.deepEqual(loaded,game);assert.notEqual(loaded?.ball,game.ball);assert.notEqual(loaded?.wind,game.wind);
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

test('legacy single-hole saves gain course progress without changing the pending shot',()=>{
 const game=createGame();strike(game,{power:.8,angle:.1});stepGame(game,.013);
 const legacy=JSON.parse(JSON.stringify(game));
 delete legacy.holeIndex;delete legacy.completedStrokes;delete legacy.penaltyKind;
 const loaded=readRun({version:1,playerId:'p1',game:legacy},'p1');
 assert.deepEqual(loaded,game);
 assert.equal(loaded?.holeIndex,0);assert.deepEqual(loaded?.completedStrokes,[]);
});

test('legacy penalty saves retain the out-of-bounds explanation',()=>{
 const game=createGame();strike(game,{power:1,angle:Math.PI/2});
 for(let i=0;i<1000;i++)stepGame(game,1/60);
 assert.equal(game.penalty,true);
 const legacy=JSON.parse(JSON.stringify(game));
 delete legacy.holeIndex;delete legacy.completedStrokes;delete legacy.penaltyKind;
 const loaded=readRun({version:1,playerId:'p1',game:legacy},'p1');
 assert.deepEqual(loaded,game);
 assert.equal(loaded?.penaltyKind,'out');
});

test('par-4 and par-5 saves retain prior scores and resume the correct shot',()=>{
 for(const [holeIndex,completedStrokes] of [[1,[3]],[2,[2,4]]] as const) {
  const game=createGame(holeIndex,completedStrokes);
  strike(game,{power:1,angle:0},'DRIVER');stepGame(game,.013);
  const loaded=readRun({version:1,playerId:'p1',game},'p1');
  assert.deepEqual(loaded,game);assert.ok(loaded);
  assert.notEqual(loaded.completedStrokes,game.completedStrokes);
  for(let i=0;i<1000;i++) {stepGame(loaded,1/59);stepGame(game,1/60);}
  assert.deepEqual(loaded,game);
 }
});

test('invalid course progress and unsafe recovery locations cannot replace a run',()=>{
 const valid=createGame(2,[3,4]);
 for(const changes of [
  {holeIndex:-1},{holeIndex:HOLES.length},{holeIndex:1.5},{holeIndex:null},
  {completedStrokes:[]},{completedStrokes:[3]},{completedStrokes:[3,4,5]},
  {completedStrokes:[0,4]},{completedStrokes:[3,11]},{completedStrokes:[3,4.5]},
  {completedStrokes:'3,4'},{completedStrokes:undefined},{penaltyKind:'bunker'},
  {penalty:true,penaltyKind:null},{lastSafe:{x:0,z:170}},{lastSafe:{x:0,z:700}},
 ]) assert.equal(readRun({version:1,playerId:'p1',game:{...valid,...changes}},'p1'),null);
});

test('finished saves must match their current hole and terminal stroke count',()=>{
 const holed=createGame(1,[3]);
 holed.strokes=4;holed.phase='holed';holed.ball.z=340;
 assert.deepEqual(readRun({version:1,playerId:'p1',game:holed},'p1'),holed);
 for(const changes of [
  {strokes:0},{ball:{...holed.ball,z:150}},{ball:{...holed.ball,vz:1}},
  {phase:'limit',strokes:4},{phase:'ready',strokes:10},
 ]) assert.equal(readRun({version:1,playerId:'p1',game:{...holed,...changes}},'p1'),null);
 const limit=createGame(2,[3,4]);limit.strokes=10;limit.phase='limit';
 assert.deepEqual(readRun({version:1,playerId:'p1',game:limit},'p1'),limit);
});
