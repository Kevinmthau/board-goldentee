import './style.css';
import { Board, BoardContactType, BoardContactPhase, type BoardContact, type BoardPlayer } from '@board.fun/web-sdk';
import { createSurface, gameFont, loadTitleFont, startInput, gameAudio } from './runtime';
import { drawTitle } from './title';
import { drawButton, hit, type Box } from './howto';
import { Splashes } from './fx';
import { loadPieceFootprints, pieceFootprint, type PieceFootprints } from './piece-footprints';
import { seated, noteContacts, pickPlayer } from './seats';
import { createGame, strike, stepGame, distanceToCup, clubFor, scoreLabel, HOLE, createSwing, resetSwing, sampleSwing } from './rules';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = createSurface(canvas);
let game = createGame();
const swing = createSwing();
let mode: 'title' | 'setup' | 'play' | 'over' = 'title';
let player: BoardPlayer | undefined;
let footprints: PieceFootprints | null = null;
const splashes = new Splashes();
let ring: BoardContact | null = null;
let lost: { x: number; y: number; time: number } | null = null;
let pauseSpot: { x: number; y: number } | null = null;
let paused = false;
let pollAt = 0;
let camera = { x: 0, z: 0 };
let taps: { x: number; y: number }[] = [];
const known = new Set<number>();
let message = '';
const REMATCH: Box = { x: 480, y: 650, width: 440, height: 140 };
const SETUP: Box = { x: 1000, y: 650, width: 440, height: 140 };
const PLAYER: Box = { x: 1460, y: 48, width: 400, height: 120 };

function sound(frequency: number) {
  const a = gameAudio(), tone = a.ctx.createOscillator(), gain = a.ctx.createGain();
  tone.frequency.value = frequency; tone.connect(gain); gain.connect(a.sfx);
  gain.gain.setValueAtTime(0.16, a.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + 0.2);
  tone.start(); tone.stop(a.ctx.currentTime + 0.2);
}
function syncRoster() { player = seated()[0]; }
function save() { BoardPlatform.state.save({ version: 1, game }); }
function newRound() { game = createGame(); camera = { x: 0, z: 0 }; resetSwing(swing); mode = ring && player ? 'play' : 'setup'; save(); }

startInput((batch, active) => {
  noteContacts(batch);
  const now = performance.now();
  for (const c of batch) {
    if (c.type === BoardContactType.Finger && c.phase === BoardContactPhase.Began) taps.push(c);
    if (c.type !== BoardContactType.Glyph) continue;
    const ended = c.phase === BoardContactPhase.Ended || c.phase === BoardContactPhase.Canceled;
    if (ended) known.delete(c.contactId);
    if (ended && ring?.contactId === c.contactId) {
      lost = { x: ring.x, y: ring.y, time: now }; ring = null; resetSwing(swing); continue;
    }
    if (ended || c.glyphId !== 1) continue;
    if (ring?.contactId !== c.contactId) {
      if (ring && active.has(ring.contactId)) continue;
      const rebound = (lost && now - lost.time < 900 && Math.hypot(c.x - lost.x, c.y - lost.y) < 140)
        || (pauseSpot && Math.hypot(c.x - pauseSpot.x, c.y - pauseSpot.y) < 140);
      if (!rebound && !known.has(c.contactId)) splashes.at(c.x, c.y, { inner: pieceFootprint(footprints, c)?.radiusPx ?? 81, color: '#E8D7A4', sound: () => sound(320) });
      known.add(c.contactId); lost = null; pauseSpot = null; resetSwing(swing);
      if (mode === 'title') mode = 'setup';
      if (c.y < 720 || !player) { message = player ? 'Place the ring at your edge' : 'Choose a player'; continue; }
      ring = c;
      if (mode === 'setup') mode = 'play';
    }
    ring = c;
    if (!paused && mode === 'play' && game.phase === 'ready' && player) {
      const shot = sampleSwing(swing, { x: c.x, y: c.y, time: now });
      if (shot && strike(game, shot)) { sound(180); message = ''; save(); }
    }
  }
}, () => {
  paused = true; pauseSpot = ring ? { x: ring.x, y: ring.y } : null;
  ring = null; taps = []; known.clear(); resetSwing(swing);
});

function text(label: string, x: number, y: number, size = 48, color = '#FFFFFF', align: CanvasTextAlign = 'left') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}
function project(x: number, z: number, h = 0) {
  const dz = z - camera.z + 24, scale = 1100 / Math.max(2, dz);
  return { x: 960 + (x - camera.x) * scale, y: 310 + (8 - h) * scale, s: scale, dz };
}
function ellipse(x: number, z: number, rx: number, rz: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, p = project(x + Math.cos(a) * rx, z + Math.sin(a) * rz); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  ctx.fill();
}
function course(now: number) {
  ctx.fillStyle = '#86C9D4'; ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = '#4B8085'; ctx.beginPath(); ctx.moveTo(0, 330); ctx.lineTo(250, 240); ctx.lineTo(480, 315); ctx.lineTo(820, 220); ctx.lineTo(1250, 320); ctx.lineTo(1920, 260); ctx.lineTo(1920, 400); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#458453'; ctx.fillRect(0, 330, 1920, 750);
  for (let z = 250; z > camera.z - 20; z -= 8) {
    const a = project(-25, z), b = project(25, z), c = project(25, z-8), d = project(-25,z-8);
    ctx.fillStyle = Math.round(z/8)%2 ? '#6BA457' : '#72AC5D'; ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.fill();
  }
  ellipse(0,150,19,21,'#90BF70'); ellipse(-19,132,9,13,'#E8D9A8');
  const flag = project(HOLE.flag.x, HOLE.flag.z), tip = project(HOLE.flag.x, HOLE.flag.z,6);
  ctx.strokeStyle='#FAFAEA';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(flag.x,flag.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
  ctx.fillStyle='#E58156';ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.lineTo(tip.x+35+Math.sin(now/300)*3,tip.y+12);ctx.lineTo(tip.x,tip.y+24);ctx.fill();
  const p=project(game.ball.x,game.ball.z,game.ball.y), shadow=project(game.ball.x,game.ball.z);
  ctx.fillStyle='rgba(20,55,30,0.35)';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,12,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(7,Math.min(16,p.s*0.25)),0,Math.PI*2);ctx.fill();
}
function draw(now: number) {
  course(now);
  if (mode === 'title') {
    ctx.fillStyle='rgba(8,43,40,0.36)';ctx.fillRect(0,0,1920,1080);
    drawTitle(ctx,{x:0,y:50,width:1920,height:600});
    text('ONE HOLE · PAR 3',960,620,48,'#F8E5AF','center');
    text('Place the Bloogs ring at your edge',960,850,48,'#FFFFFF','center');
  } else if(mode === 'setup') {
    text(message || 'Place the Bloogs ring at your edge',960,650,48,'#FFFFFF','center');
    drawButton(ctx,PLAYER,player ? 'CHANGE PLAYER':'CHOOSE PLAYER');
  } else {
    text('HOLE 01  /  PAR 3',64,85);text(`${game.strokes} STROKES`,64,150);
    text(`${Math.round(distanceToCup(game))} YD`,1856,85,64,'#FFFFFF','right');
    text(clubFor(game),1856,155,48,'#F8E5AF','right');
    text(player?.name ?? '',64,1000,48);
    text(mode === 'over' ? '' : !ring ? 'Return the ring' : swing.stage === 'backswing' ? 'Slide forward to swing' : game.phase === 'ready' ? 'Slide back, then forward' : 'Watch your shot',960,970,48,'#FFFFFF','center');
    text('↙  ↑  ↗',1650,800,64,'#F8E5AF','center');text('↓',1650,900,64,'#F8E5AF','center');
    if(mode==='over') {
      ctx.fillStyle='rgba(8,43,40,0.94)';ctx.fillRect(370,260,1180,590);
      text(game.phase==='holed'?scoreLabel(game.strokes):'STROKE LIMIT',960,390,80,'#F8E5AF','center');
      text(`${game.strokes} strokes · Par 3`,960,520,56,'#FFFFFF','center');
      drawButton(ctx,REMATCH,'REMATCH');drawButton(ctx,SETUP,'CHANGE SETUP');
    }
  }
  splashes.draw(ctx);
}
function update(now: number, dt: number) {
  if (now-pollAt>1000) {syncRoster();pollAt=now;}
  if (mode==='setup' && taps.some(t=>hit(PLAYER,t.x,t.y))) void pickPlayer([],player?.sessionId).then(syncRoster);
  if(mode==='over') {
    if(taps.some(t=>hit(REMATCH,t.x,t.y)))newRound();
    else if(taps.some(t=>hit(SETUP,t.x,t.y))) {ring=null;newRound();mode='setup';}
  }
  if(mode==='play') {
    const before=game.phase;stepGame(game,dt);
    if(before!==game.phase) {
      save();
      if(game.phase==='ready'){resetSwing(swing);camera={x:game.ball.x,z:game.ball.z};}
      if(game.phase==='holed'||game.phase==='limit'){mode='over';sound(640);}
    }
  }
  splashes.update(dt);taps=[];
}
let last=0;
function frame(now:number){if(paused)return;const dt=Math.min(0.05,last?(now-last)/1000:0);last=now;update(now,dt);draw(now);requestAnimationFrame(frame);}
Board.application.onResume(()=>{paused=false;last=0;requestAnimationFrame(frame);});
void(async()=>{await BoardPlatform.state.ready();syncRoster();Board.session.onPlayersChanged(syncRoster);[footprints]=await Promise.all([loadPieceFootprints(),loadTitleFont()]);requestAnimationFrame(frame);})();
