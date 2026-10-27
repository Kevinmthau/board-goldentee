import './style.css';
import { Board, BoardContactPhase, BoardContactType, type BoardPlayer } from '@board.fun/web-sdk';
import { createSurface, gameFont, loadTitleFont, startInput } from './runtime';
import { drawTitle } from './title';
import { drawButton, drawHowTo, hit, setRingArt, BACK_BUTTON, type Box } from './howto';
import { Splashes, Particles } from './fx';
import { loadPieceFootprints, pieceFootprint, type PieceFootprints } from './piece-footprints';
import { activeSeat, seated, noteContacts, pickPlayer, selectorOpen } from './seats';
import { createGame, strike, stepGame, distanceToCup, clubFor, scoreLabel, terrainAt, type GolfState } from './rules';
import { RingController, isRingPlacement } from './ring-control';
import { CourseView, drawSwingGuide } from './course-view';
import { playCue } from './sound';
import { readRun } from './run-state';

type Mode = 'title' | 'setup' | 'play' | 'over' | 'howto';
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = createSurface(canvas);
const view = new CourseView();
const controller = new RingController();
const splashes = new Splashes();
const particles = new Particles(180);
let game = createGame();
let mode: Mode = 'title';
let helpReturn: Mode = 'title';
let player: BoardPlayer | undefined;
let footprints: PieceFootprints | null = null;
let ringArt: HTMLImageElement | null = null;
let artFailed = false;
let booted = false;
let paused = false;
let last = 0;
let pollAt = -Infinity;
let saveAt = 0;
let resultAt = 0;
let toast = '';
let toastUntil = 0;
let saved: GolfState | null = null;
let roundActive = false;
let best: number | null = null;
let setupConfirm = false;
let taps: {x: number; y: number}[] = [];
let lastLabel = '';
const HELP: Box = {x: 1472, y: 48, width: 400, height: 120};
const PLAYER: Box = {x: 1280, y: 680, width: 520, height: 130};
const CONTINUE: Box = {x: 1280, y: 840, width: 520, height: 130};
const REMATCH: Box = {x: 460, y: 698, width: 460, height: 140};
const SETUP: Box = {x: 1000, y: 698, width: 460, height: 140};

function say(message: string, seconds = 3) { toast = message; toastUntil = performance.now() + seconds * 1000; }
function syncRoster() {
  const next = activeSeat() ?? seated()[0];
  if (player && (!next || player.playerId !== next.playerId)) {
    controller.release(); game = createGame(); saved = null; roundActive = false; mode = 'setup'; setupConfirm = true;
  }
  const changed = player?.playerId !== next?.playerId;
  player = next;
  if (changed) refreshBest();
}
function persist() {
  if (player && roundActive) BoardPlatform.state.save({version: 1, playerId: player.playerId, game});
}
function readSaved() {
  if (!roundActive) saved = player ? readRun(BoardPlatform.state.load(), player.playerId) : null;
  refreshBest();
}
function refreshBest() {
  const n = player ? BoardPlatform.state.progress.get<number>(`bestStrokes:${player.playerId}`) : undefined;
  best = typeof n === 'number' && n > 0 ? n : null;
}
function startRound(restore = false) {
  if (!player) { mode = 'setup'; say('Choose your player'); return; }
  if (restore && saved) { game = saved; saved = null; }
  else game = createGame();
  saved = null; roundActive = true;
  controller.resetStroke(); view.reset(game); setupConfirm = false;
  mode = game.phase === 'holed' || game.phase === 'limit' ? 'over' : 'play';
  resultAt = performance.now(); persist();
}
function changeSetup() {
  controller.release(); controller.setEnabled(false); mode = 'setup'; setupConfirm = true; syncRoster();
}
function showHelp() { if (mode === 'howto') return; helpReturn = mode; mode = 'howto'; controller.setEnabled(false); controller.resetStroke(); }
function leaveHelp() { mode = helpReturn; controller.resetStroke(); if (mode === 'title' && controller.ring && player) startRound(!!saved); }
async function changePlayer() {
  if (selectorOpen()) return;
  await pickPlayer([], player?.sessionId); syncRoster(); readSaved();
}

startInput((batch, active) => {
  noteContacts(batch);
  if (!booted || paused) return;
  const now = performance.now();
  for (const c of batch) {
    if (c.type === BoardContactType.Finger && c.phase === BoardContactPhase.Began) taps.push(c);
  }
  controller.setEnabled(mode === 'play' && game.phase === 'ready' && !!player);
  const events = controller.update(batch, active, now);
  for (const c of events.arrivals) {
    splashes.at(c.x, c.y, {inner: pieceFootprint(footprints, c)?.radiusPx ?? 81, color: '#F3DC9A', sound: () => playCue('place')});
    if (c.glyphId !== 1) say('Use the Bloogs ring');
    else if (!controller.ring) say('Place the ring at the bottom centre');
    if (mode === 'title' && c.glyphId === 1) mode = 'setup';
  }
  if (controller.ring && player && mode === 'setup' && !setupConfirm) startRound(!!saved);
  if (events.shot && mode === 'play' && game.phase === 'ready') {
    const putter = clubFor(game) === 'PUTTER';
    if (strike(game, events.shot)) {
      view.startStroke(game,putter); controller.setEnabled(false); toast = ''; persist();
    }
  }
}, () => {
  paused = true; controller.pause(performance.now()); taps = []; persist();
});

function text(label: string, x: number, y: number, size = 48, color = '#FFF8E4', align: CanvasTextAlign = 'left') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label,x,y);
}
function nameLines(name: string, x: number, y: number, width: number) {
  ctx.font = gameFont(48);
  const lines: string[] = []; let line = '';
  for(const char of name) {
    if(ctx.measureText(line + char).width > width) { lines.push(line); line = char; }
    else line += char;
  }
  if(line)lines.push(line);
  lines.forEach((part,i) => text(part,x,y+i*54,48,'#FFF8E4','center'));
}
function ringPrompt(y = 830) {
  if (controller.ring || controller.observedRing) return;
  if (ringArt) ctx.drawImage(ringArt,880,y-90,160,164);
  else if (artFailed) text('Bloogs ring · piece 1',960,y,48,'#FFF8E4','center');
  ctx.strokeStyle='#E7DBB4';ctx.lineWidth=2;ctx.setLineDash([8,12]);
  ctx.beginPath();ctx.ellipse(960,y+8,106,72,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
}
function result(now: number) {
  ctx.fillStyle='rgba(9,42,37,0.86)';ctx.fillRect(0,0,1920,1080);
  text('SEABREEZE LINKS',960,230,40,'#C5D5B7','center');
  text(game.phase==='holed'?scoreLabel(game.strokes).toUpperCase():'STROKE LIMIT',960,370,104,'#F1D58B','center');
  text(`${game.strokes} STROKES   /   PAR 3`,960,500,56,'#FFFFFF','center');
  if(player) nameLines(player.name,960,575,1000);
  drawButton(ctx,REMATCH,'REMATCH');drawButton(ctx,SETUP,'CHANGE SETUP');
  if(best!==null)text(`PERSONAL BEST  ${best}`,960,920,36,'#C5D5B7','center');
  if(now-resultAt<2400)particles.draw(ctx);
}
function draw(now: number, dt: number) {
  view.draw(ctx,game,now,dt,mode==='title'||mode==='setup'||mode==='howto');
  if(mode==='title') {
    ctx.fillStyle='rgba(6,37,35,0.3)';ctx.fillRect(0,0,1920,1080);
    text('SEABREEZE LINKS',960,110,36,'#E8E0BE','center');
    drawTitle(ctx,{x:0,y:125,width:1920,height:430});
    text('ONE HOLE. MAKE IT COUNT.',960,615,40,'#F4DA94','center');
    ringPrompt();
    text('Place the Bloogs ring to tee off',960,995,48,'#FFFFFF','center');
    drawButton(ctx,HELP,'HOW TO PLAY');
    if(saved)drawButton(ctx,CONTINUE,'CONTINUE ROUND');
  } else if(mode==='setup') {
    ctx.fillStyle='rgba(6,37,35,0.5)';ctx.fillRect(0,0,1920,1080);
    text('YOUR TEE TIME',960,220,88,'#F4DA94','center');
    if(player)nameLines(player.name,960,350,1150);
    text('SOLO  /  HOLE 01  /  PAR 3',960,475,40,'#FFFFFF','center');
    ringPrompt();
    text(player?'Place your ring at the bottom centre':'Choose a player to begin',960,620,48,'#FFFFFF','center');
    drawButton(ctx,PLAYER,player?'CHANGE PLAYER':'CHOOSE PLAYER');
    if(player&&(controller.ring||controller.observedRing))drawButton(ctx,CONTINUE,'TEE OFF');
  } else if(mode==='howto') {
    ctx.fillStyle='rgba(6,37,35,0.9)';ctx.fillRect(0,0,1920,1080);drawHowTo(ctx,now);
  } else if(mode==='over') result(now);
  else {
    ctx.fillStyle='rgba(12,45,36,0.72)';ctx.fillRect(48,48,432,146);
    text('SEABREEZE',74,92,48,'#E3DBB6');text('01   /   PAR 3',74,150,48);
    const distance=distanceToCup(game), putting=clubFor(game)==='PUTTER';
    const unit=putting?'FT':'YD', amount=putting?distance*3:distance;
    ctx.fillStyle='rgba(12,45,36,0.72)';ctx.fillRect(1452,48,420,184);
    text(`${amount<10?amount.toFixed(1):Math.round(amount)} ${unit}`,1838,106,64,'#FFF8E4','right');
    text(game.phase === 'flight' ? 'IN FLIGHT' : game.phase === 'rolling' ? 'ROLLING' : clubFor(game),1838,184,48,'#EEDA9E','right');
    text(`STROKES ${String(game.strokes).padStart(2,'0')}`,64,900,48);
    text(game.strokes?`${Math.round(game.shotPower*100)}% POWER`:'150 YD · PAR 3',64,970,48,'#EEDA9E');
    drawSwingGuide(ctx,game.phase==='ready'?controller.swing.stage:'watch',controller.swing.power,!!controller.ring,now);
    if(!controller.ring)ringPrompt(820);
    const instruction=!player?'Choose a player':!controller.ring?'Return the ring to swing':'';
    if(instruction)text(instruction,960,1010,48,'#FFF8E4','center');
    if(controller.ring&&game.phase==='ready'&&controller.swing.stage==='settling'&&!isRingPlacement(controller.ring))
      text('Move the ring to the bottom centre',960,290,48,'#FFF8E4','center');
    if(game.penalty && !toast)text('OUT OF BOUNDS  +1',960,260,48,'#F4DA94','center');
  }
  if(toast&&now<toastUntil) {
    ctx.fillStyle='rgba(7,35,31,0.9)';ctx.fillRect(420,240,1080,100);text(toast,960,290,48,'#FFF8E4','center');
  }
  splashes.draw(ctx);
}
function update(now: number, dt: number) {
  if(now-pollAt>1000){syncRoster();pollAt=now;}
  const tapped=(box:Box)=>taps.some(t=>hit(box,t.x,t.y));
  if(mode==='title') {
    if(tapped(HELP)){playCue('button');showHelp();}
    else if(saved&&tapped(CONTINUE)){playCue('button');startRound(true);}
  } else if(mode==='setup') {
    if(tapped(PLAYER)){playCue('button');void changePlayer();}
    else if(tapped(CONTINUE)&&player&&(controller.ring||controller.confirmPlacement())){playCue('button');startRound(!!saved);}
  } else if(mode==='howto'&&tapped(BACK_BUTTON)){playCue('button');leaveHelp();}
  else if(mode==='over') {
    if(tapped(REMATCH)){playCue('button');startRound();}
    else if(tapped(SETUP)){playCue('button');changeSetup();}
  }
  controller.setEnabled(mode==='play'&&game.phase==='ready'&&!!player);controller.tick(now);
  if(mode==='play') {
    const swing=controller.swing;
    view.setSwing(swing.stage,swing.anchor&&swing.last?swing.last.y-swing.anchor.y:0);
    const animation=view.advanceSwing(dt,clubFor(game)==='PUTTER');
    if(animation.impact)playCue(animation.putting?'putt':'swing',game.shotPower);
    const before=game.phase;stepGame(game,animation.ballDt);
    if(before!==game.phase) {
      if(before==='flight'&&game.phase==='rolling')playCue(terrainAt(game.ball.x,game.ball.z)==='bunker'?'sand':'land');
      if(game.phase==='ready'){controller.resetStroke();if(game.penalty)playCue('penalty');}
      if(game.phase==='holed'||game.phase==='limit') {
        mode='over';resultAt=now;controller.setEnabled(false);
        if(game.phase==='holed') {
          playCue('cup');particles.burst(960,410,{count:120,color:'#F1D58B',speed:420,life:1.6,gravity:220});
          if(best===null||game.strokes<best){best=game.strokes;BoardPlatform.state.progress.set(`bestStrokes:${player!.playerId}`,best);}
        } else playCue('penalty');
      }
      persist();
    }
    if(now-saveAt>400){persist();saveAt=now;}
  }
  splashes.update(dt);particles.update(dt);taps=[];
  const label=`${mode}. Solo golf. ${game.strokes} strokes. ${game.phase}. ${game.phase==='flight'||game.phase==='rolling'?'Ball in motion':distanceToCup(game).toFixed(1)+' yards to cup'}. ${controller.ring?'Ring present':'Place Bloogs ring at bottom centre'}. ${controller.swing.stage}.`;
  if(label!==lastLabel){canvas.setAttribute('aria-label',label);lastLabel=label;}
}
function frame(now:number){if(paused)return;const dt=Math.min(.05,last?(now-last)/1000:0);last=now;update(now,dt);draw(now,dt);requestAnimationFrame(frame);}
Board.application.onResume(()=>{controller.resume(performance.now());if(paused){paused=false;last=0;if(booted)requestAnimationFrame(frame);}});

async function loadRingArt() {
  return new Promise<void>(resolve=>{
    const img=new Image();
    img.onload=()=>{ringArt=img;setRingArt(img);resolve();};
    img.onerror=()=>{artFailed=true;resolve();};
    img.src='piece-art/1.png';
  });
}
void(async()=>{
  await BoardPlatform.state.ready();syncRoster();readSaved();
  Board.session.onPlayersChanged(syncRoster);
  BoardPlatform.state.onRestore(()=>{syncRoster();readSaved();});
  BoardPlatform.menu.setButtons([{id:'help',title:'How to swing',icon:'square'},{id:'restart',title:'Restart hole',icon:'circular_arrow'},{id:'setup',title:'Change setup',icon:'left_arrow'}]);
  BoardPlatform.menu.onButton(id=>{if(id==='help')showHelp();if(id==='restart')startRound();if(id==='setup')changeSetup();});
  [footprints]=await Promise.all([loadPieceFootprints(),loadTitleFont(),loadRingArt()]);
  view.reset(game);booted=true;requestAnimationFrame(frame);
})();
