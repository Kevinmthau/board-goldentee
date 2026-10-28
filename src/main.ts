import './style.css';
import { Board, BoardContactPhase, BoardContactType, type BoardPlayer } from '@board.fun/web-sdk';
import { createSurface, gameFont, loadTitleFont, startInput } from './runtime';
import { drawTitle } from './title';
import { drawButton, drawHowTo, hit, setPieceArt, BACK_BUTTON, type Box } from './howto';
import { Splashes, Particles } from './fx';
import { loadPieceFootprints, pieceFootprint, type PieceFootprints } from './piece-footprints';
import { activeSeat, seated, noteContacts, pickPlayer, selectorOpen } from './seats';
import { createGame, strike, stepGame, distanceToCup, clubFor, CLUBS, HOLES, holeFor, advanceHole, roundStrokes, roundPar, isFinalHole, scoreLabel, terrainAt, type GolfState, type Club } from './rules';
import { PieceController } from './piece-control';
import { CourseView } from './course-view';
import { drawPieceClub } from './piece-club';
import { drawPortrait, toPortrait, portraitFacing, isPiecePlacement } from './portrait';
import { playCue } from './sound';
import { readRun } from './run-state';
import { drawScorecard } from './scorecard';
import { drawWind } from './wind-view';

type Mode = 'title' | 'setup' | 'play' | 'over' | 'howto' | 'scorecard';
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = createSurface(canvas);
const view = new CourseView();
let footprints: PieceFootprints | null = null;
const controller = new PieceController({
  facingDeg: c => { const fp = pieceFootprint(footprints, c); return fp ? portraitFacing(fp.facingDeg) : null; },
  isPlacement: isPiecePlacement,
  towardPlayerDeg: 90,
});
const splashes = new Splashes();
const particles = new Particles(180);
let game = createGame();
let selectedClub: Club = clubFor(game);
let aim = 0;
let mode: Mode = 'title';
let helpReturn: Mode = 'title';
let scorecardReturn: Mode = 'play';
let player: BoardPlayer | undefined;
let booted = false;
let paused = false;
let pendingFrame: number | null = null;
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
const SCORECARD: Box = {x: 696, y: 248, width: 336, height: 120};
const HELP: Box = {x: 340, y: 1120, width: 400, height: 120};
const PLAYER: Box = {x: 280, y: 1050, width: 520, height: 130};
const CONTINUE: Box = {x: 280, y: 1250, width: 520, height: 130};
const REMATCH: Box = {x: 280, y: 1500, width: 520, height: 140};
const SETUP: Box = {x: 280, y: 1680, width: 520, height: 140};
const AIM_LEFT: Box = {x: 64, y: 1360, width: 160, height: 130};
const AIM_RIGHT: Box = {x: 856, y: 1360, width: 160, height: 130};
const CLUB_BOXES = CLUBS.map((club, i) => ({club, box: {x: 48 + (i % 3) * 336, y: 1590 + Math.floor(i / 3) * 150, width: 312, height: 130}}));

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
  const n = player ? BoardPlatform.state.progress.get<number>(`nineHoleBestRoundStrokes:${player.playerId}`) : undefined;
  best = typeof n === 'number' && n > 0 ? n : null;
}
function freshLie() { selectedClub = clubFor(game); aim = 0; view.setAim(aim); controller.resetStroke(); }
function startRound(restore = false) {
  if (!player) { mode = 'setup'; say('Choose your player'); return; }
  if (restore && saved) { game = saved; saved = null; }
  else game = createGame();
  saved = null; roundActive = true;
  freshLie(); view.reset(game); setupConfirm = false;
  mode = game.phase === 'holed' || game.phase === 'limit' ? 'over' : 'play';
  resultAt = performance.now(); persist();
}
function nextHole() {
  if (!advanceHole(game)) return;
  freshLie(); view.reset(game); mode = 'play'; toast = ''; persist();
}
function changeSetup() { controller.release(); controller.setEnabled(false); mode = 'setup'; setupConfirm = true; syncRoster(); }
function showScorecard() { if (mode === 'scorecard' || !roundActive) return; scorecardReturn = mode === 'howto' ? helpReturn : mode; mode = 'scorecard'; controller.setEnabled(false); controller.resetStroke(); }
function showHelp() { if (mode === 'howto') return; helpReturn = mode === 'scorecard' ? scorecardReturn : mode; mode = 'howto'; controller.setEnabled(false); controller.resetStroke(); }
function leaveHelp() { mode = helpReturn; controller.resetStroke(); if (mode === 'title' && controller.piece && player) startRound(!!saved); }
async function changePlayer() {
  if (selectorOpen()) return;
  await pickPlayer([], player?.sessionId); syncRoster(); readSaved();
}

startInput((batch, active) => {
  noteContacts(batch);
  if (!booted || paused) return;
  const now = performance.now();
  for (const c of batch) {
    if (c.type === BoardContactType.Finger && c.phase === BoardContactPhase.Began) taps.push(toPortrait(c));
  }
  controller.setEnabled(mode === 'play' && game.phase === 'ready' && !!player);
  const events = controller.update(batch, active, now);
  for (const c of events.arrivals) {
    const p = toPortrait(c);
    splashes.at(p.x, p.y, {inner: pieceFootprint(footprints, c)?.radiusPx ?? 81, color: '#F3DC9A', sound: () => playCue('place')});
    if (c.glyphId < 1 || c.glyphId > 8) say('Use a Sports player');
    else if (!controller.piece) say('Move your player onto the open grass');
    if (mode === 'title' && c.glyphId >= 1 && c.glyphId <= 8) mode = 'setup';
  }
  if (controller.piece && player && mode === 'setup' && !setupConfirm) startRound(!!saved);
  if (events.shot && mode === 'play' && game.phase === 'ready') {
    const putter = selectedClub === 'PUTTER';
    if (strike(game, {...events.shot, angle: aim}, selectedClub)) {
      view.startStroke(game, putter); controller.setEnabled(false); toast = ''; persist();
    }
  }
}, () => {
  paused = true;
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  pendingFrame = null;
  controller.pause(performance.now()); taps = []; persist();
});

function text(label: string, x: number, y: number, size = 48, color = '#FFF8E4', align: CanvasTextAlign = 'left') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}
function nameLines(name: string, x: number, y: number, width: number) {
  ctx.font = gameFont(48);
  const lines: string[] = []; let line = '';
  for (const char of name) {
    if (ctx.measureText(line + char).width > width) { lines.push(line); line = char; }
    else line += char;
  }
  if (line) lines.push(line);
  // Expand the name region without reducing the font or truncating the profile name.
  lines.forEach((part, i) => text(part, x, y + i * 54, 48, '#FFF8E4', 'center'));
}
function result(now: number) {
  const hole = holeFor(game), final = isFinalHole(game);
  const total = roundStrokes(game), par = roundPar(game);
  const relative = total - par;
  const score = relative === 0 ? 'EVEN PAR' : `${relative > 0 ? '+' : ''}${relative} TO PAR`;
  ctx.fillStyle = 'rgba(9,42,37,0.94)'; ctx.fillRect(0, 0, 1080, 1920);
  text(final ? 'ROUND COMPLETE' : `HOLE ${game.holeIndex + 1} COMPLETE`, 540, 260, 48, '#C5D5B7', 'center');
  text(final ? score : game.phase === 'holed' ? scoreLabel(game.strokes, hole.par).toUpperCase() : 'STROKE LIMIT', 540, 390, 72, '#F1D58B', 'center');
  text(final ? `${total} STROKES  /  PAR ${par}` : `${game.strokes} STROKES  /  PAR ${hole.par}`, 540, 500, 56, '#FFFFFF', 'center');
  drawScorecard(ctx, game);
  drawButton(ctx, REMATCH, final ? 'REMATCH' : 'NEXT HOLE'); drawButton(ctx, SETUP, 'CHANGE SETUP');
  if (best !== null) text(`BEST ROUND  ${best}`, 540, 1250, 48, '#C5D5B7', 'center');
  if (now - resultAt < 2400) particles.draw(ctx);
}
function roundCard() {
  ctx.fillStyle = 'rgba(9,42,37,0.96)'; ctx.fillRect(0, 0, 1080, 1920);
  text('ROUND SCORECARD', 540, 320, 64, '#F1D58B', 'center');
  text('9 HOLES  /  PAR 36', 540, 440, 48, '#FFFFFF', 'center');
  drawScorecard(ctx, game);
  drawButton(ctx, REMATCH, 'BACK');
}
function drawPlay(now: number) {
  ctx.fillStyle = 'rgba(12,45,36,0.82)'; ctx.fillRect(48, 48, 984, 184);
  const hole = holeFor(game);
  text(hole.name.toUpperCase(), 76, 100, 48, '#E3DBB6'); text(`${game.holeIndex + 1}/${HOLES.length}  /  PAR ${hole.par}`, 76, 174, 48);
  const distance = distanceToCup(game), putting = selectedClub === 'PUTTER';
  const amount = putting ? distance * 3 : distance;
  text(`${amount < 10 ? amount.toFixed(1) : Math.round(amount)} ${putting ? 'FT' : 'YD'}`, 1004, 102, 64, '#FFF8E4', 'right');
  text(`STROKES ${game.strokes}`, 1004, 174, 48, '#EEDA9E', 'right');
  drawWind(ctx, game.wind, view.heading);
  const ready = game.phase === 'ready';
  ctx.save(); if (!ready) ctx.globalAlpha = 0.55;
  drawButton(ctx, SCORECARD, 'SCORECARD'); ctx.restore();
  for (const {club, box} of CLUB_BOXES) {
    ctx.save(); if (!ready) ctx.globalAlpha = 0.55;
    drawButton(ctx, box, `${club.label} ${club.id === 'PUTTER' ? club.distanceYards * 3 : club.distanceYards}${club.id === 'PUTTER' ? 'FT' : 'YD'}`);
    if (selectedClub === club.id) { ctx.strokeStyle = '#E6B861'; ctx.lineWidth = 8; ctx.strokeRect(box.x + 4, box.y + 4, box.width - 8, box.height - 8); }
    ctx.restore();
  }
  drawButton(ctx, AIM_LEFT, '←'); drawButton(ctx, AIM_RIGHT, '→');
  text('AIM', 144, 1320, 48, '#C5D5B7', 'center');
  text(`${Math.abs(Math.round(aim * 180 / Math.PI))}°`, 936, 1320, 48, '#C5D5B7', 'center');
  const swing = controller.swing;
  const instruction = !ready ? 'WATCH YOUR SHOT' : !controller.piece ? (controller.observedPiece ? 'MOVE ONTO THE OPEN GRASS' : 'PLACE YOUR SPORTS PLAYER') :
    !isPiecePlacement(controller.piece) ? 'MOVE ONTO THE OPEN GRASS' :
    swing.stage === 'settling' ? 'HOLD STILL TO ADDRESS' : swing.stage === 'backswing' ? 'TURN BACK TO THE BALL' : 'TURN BACK, THEN THROUGH';
  text(instruction, 540, 1530, 48, '#FFF8E4', 'center');
  // Fixed feedback stays with the controls; only the requested club follows the piece.
  if (ready && swing.windup > 0) {
    text(`${Math.round(swing.power * 100)}%`, 790, 1423, 48, '#F1D58B', 'right');
  }
  if (game.penalty && (!toast || now >= toastUntil)) text(game.penaltyKind === 'water' ? 'WATER  +1  /  REPLAY SHOT' : 'OUT OF BOUNDS  +1', 540, 425, 48, '#F4DA94', 'center');
}
function draw(now: number, dt: number) {
  drawPortrait(ctx);
  const piece = controller.piece ?? controller.observedPiece;
  const fp = piece ? pieceFootprint(footprints, piece) : null;
  // Piece placement and rotation affect only the attached club, never the course camera.
  view.draw(ctx, game, now, dt, mode === 'title' || mode === 'setup' || mode === 'howto');
  if (mode === 'play' && fp) {
    // Explicit person-requested exception: the club connects to the real front edge.
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); drawPieceClub(ctx, fp, selectedClub); ctx.restore();
  }
  if (mode === 'title') {
    ctx.fillStyle = 'rgba(6,37,35,0.3)'; ctx.fillRect(0, 0, 1080, 1920);
    text('SEABREEZE LINKS', 540, 220, 40, '#E8E0BE', 'center');
    drawTitle(ctx, {x: 48, y: 320, width: 984, height: 460});
    text('NINE HOLES. EVERY SHOT COUNTS.', 540, 900, 48, '#F4DA94', 'center');
    text('COASTAL GOLF  /  PAR 36', 540, 990, 48, '#FFFFFF', 'center');
    text('Place any Sports player to tee off', 540, 1840, 48, '#FFFFFF', 'center');
    drawButton(ctx, HELP, 'HOW TO PLAY');
    if (saved) drawButton(ctx, CONTINUE, 'CONTINUE ROUND');
  } else if (mode === 'setup') {
    ctx.fillStyle = 'rgba(6,37,35,0.6)'; ctx.fillRect(0, 0, 1080, 1920);
    text('YOUR TEE TIME', 540, 360, 80, '#F4DA94', 'center');
    if (player) nameLines(player.name, 540, 520, 900);
    text('SOLO  /  9 HOLES  /  PAR 36', 540, 800, 48, '#FFFFFF', 'center');
    text(player ? 'Place your player on the open grass' : 'Choose a player to begin', 540, 930, 48, '#FFFFFF', 'center');
    if (!controller.observedPiece) text('Place the player on the open grass', 540, 1840, 48, '#FFFFFF', 'center');
    drawButton(ctx, PLAYER, player ? 'CHANGE PLAYER' : 'CHOOSE PLAYER');
    if (player && (controller.piece || controller.observedPiece)) drawButton(ctx, CONTINUE, 'TEE OFF');
  } else if (mode === 'howto') drawHowTo(ctx, now);
  else if (mode === 'over') result(now);
  else if (mode === 'scorecard') roundCard();
  else drawPlay(now);
  if (toast && now < toastUntil) {
    ctx.fillStyle = 'rgba(7,35,31,0.94)'; ctx.fillRect(48, 390, 984, 110); text(toast, 540, 445, 48, '#FFF8E4', 'center');
  }
  splashes.draw(ctx);
}
function update(now: number, dt: number) {
  if (now - pollAt > 1000) { syncRoster(); pollAt = now; }
  const tapped = (box: Box) => taps.some(t => hit(box, t.x, t.y));
  if (mode === 'title') {
    if (tapped(HELP)) { playCue('button'); showHelp(); }
    else if (saved && tapped(CONTINUE)) { playCue('button'); startRound(true); }
  } else if (mode === 'setup') {
    if (tapped(PLAYER)) { playCue('button'); void changePlayer(); }
    else if (tapped(CONTINUE) && player && (controller.piece || controller.confirmPlacement())) { playCue('button'); startRound(!!saved); }
  } else if (mode === 'howto' && tapped(BACK_BUTTON)) { playCue('button'); leaveHelp(); }
  else if (mode === 'scorecard') {
    if (tapped(REMATCH)) { playCue('button'); mode = scorecardReturn; controller.resetStroke(); }
  } else if (mode === 'over') {
    if (tapped(REMATCH)) { playCue('button'); if (isFinalHole(game)) startRound(); else nextHole(); }
    else if (tapped(SETUP)) { playCue('button'); changeSetup(); }
  } else if (mode === 'play' && game.phase === 'ready') {
    if (tapped(SCORECARD)) { playCue('button'); showScorecard(); }
    for (const {club, box} of CLUB_BOXES) if (tapped(box)) { selectedClub = club.id; controller.resetStroke(); playCue('button'); }
    if (tapped(AIM_LEFT) || tapped(AIM_RIGHT)) {
      aim = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, aim + (tapped(AIM_LEFT) ? -1 : 1) * Math.PI / 90));
      view.setAim(aim); controller.resetStroke(); playCue('button');
    }
  }
  controller.setEnabled(mode === 'play' && game.phase === 'ready' && !!player); controller.tick(now);
  if (mode === 'play') {
    view.setSwing(controller.swing.stage, controller.swing.windup);
    const animation = view.advanceSwing(dt, selectedClub === 'PUTTER');
    if (animation.impact) playCue(animation.putting ? 'putt' : 'swing', game.shotPower);
    const before = game.phase; stepGame(game, animation.ballDt);
    if (before !== game.phase) {
      if (before === 'flight' && game.phase === 'rolling') playCue(terrainAt(game.ball.x, game.ball.z, holeFor(game)) === 'bunker' ? 'sand' : 'land');
      if (game.phase === 'ready') { freshLie(); if (game.penalty) playCue('penalty'); }
      if (game.phase === 'holed' || game.phase === 'limit') {
        mode = 'over'; resultAt = now; controller.setEnabled(false);
        if (game.phase === 'holed') {
          playCue('cup'); particles.burst(540, 640, {count: 120, color: '#F1D58B', speed: 420, life: 1.6, gravity: 220});

        } else playCue('penalty');
        if (isFinalHole(game) && (best === null || roundStrokes(game) < best)) {
          best = roundStrokes(game); BoardPlatform.state.progress.set(`nineHoleBestRoundStrokes:${player!.playerId}`, best);
        }
      }
      persist();
    }
    if (now - saveAt > 400) { persist(); saveAt = now; }
  }
  splashes.update(dt); particles.update(dt); taps = [];
  const label = `${mode}. Solo golf. Hole ${game.holeIndex + 1} of ${HOLES.length}, par ${holeFor(game).par}. ${game.strokes} strokes. ${game.phase}. ${distanceToCup(game).toFixed(1)} yards to cup. ${selectedClub}. ${controller.piece ? 'Sports player present' : 'Place Sports player on the open grass'}. ${controller.swing.stage}. ${Math.round(controller.swing.power * 100)}% power. Wind ${Math.round(Math.hypot(game.wind.x, game.wind.z))} mph.`;
  if (label !== lastLabel) { canvas.setAttribute('aria-label', label); lastLabel = label; }
}
function scheduleFrame() {
  if (booted && !paused && pendingFrame === null) pendingFrame = requestAnimationFrame(frame);
}
function frame(now: number) {
  pendingFrame = null;
  if (paused) return;
  const dt = Math.min(.05, last ? (now - last) / 1000 : 0);
  last = now; update(now, dt); draw(now, dt); scheduleFrame();
}
Board.application.onResume(() => {
  if (!paused) return;
  controller.resume(performance.now()); paused = false; last = 0; scheduleFrame();
});
async function loadSportsArt() {
  return new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => { setPieceArt(img); resolve(); };
    img.onerror = () => { resolve(); };
    img.src = 'piece-art/1.png';
  });
}
void (async () => {
  await BoardPlatform.state.ready(); syncRoster(); readSaved();
  Board.session.onPlayersChanged(syncRoster);
  BoardPlatform.state.onRestore(() => { syncRoster(); readSaved(); });
  BoardPlatform.menu.setButtons([{id: 'scorecard', title: 'Scorecard', icon: 'square'}, {id: 'help', title: 'How to swing', icon: 'square'}, {id: 'restart', title: 'Restart round', icon: 'circular_arrow'}, {id: 'setup', title: 'Change setup', icon: 'left_arrow'}]);
  BoardPlatform.menu.onButton(id => { if (id === 'scorecard') showScorecard(); if (id === 'help') showHelp(); if (id === 'restart') startRound(); if (id === 'setup') changeSetup(); });
  [footprints] = await Promise.all([loadPieceFootprints(), loadTitleFont(), loadSportsArt()]);
  view.reset(game); booted = true; scheduleFrame();
})();
