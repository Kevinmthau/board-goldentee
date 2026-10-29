import './style.css';
import { Board, BoardContactPhase, BoardContactType, type BoardPlayer, type BoardContact } from '@board.fun/web-sdk';
import { createSurface, gameFont, loadTitleFont, startInput } from './runtime';
import { drawTitle } from './title';
import { drawButton, drawHowTo, hit, setPieceArt, BACK_BUTTON, type Box } from './howto';
import { Splashes, Particles } from './fx';
import { loadPieceFootprints, pieceFootprint, type PieceFootprints } from './piece-footprints';
import { activeSeat, seated, noteContacts, pickPlayer, selectorOpen, removeSeatedPlayer } from './seats';
import { createGame, strike, stepGame, distanceToCup, clubFor, CLUBS, HOLES, holeFor, roundStrokes, roundPar, isFinalHole, scoreLabel, terrainAt, type Club } from './rules';
import { PieceController, isSportsPiece } from './piece-control';
import { NameStartPlacement } from './name-start';
import { TurnPlacement } from './turn-placement';
import { CourseView } from './course-view';
import { drawPieceClub } from './piece-club';
import { drawPortrait, toPortrait, portraitFacing, isPiecePlacement } from './portrait';
import { playCue } from './sound';
import { createRound, activeGolfer, nextTurn, holeComplete, roundComplete, advanceRoundHole, winners, readRound, saveRound, syncRoundRoster, sameGolfer, restoreGuestSeat, MAX_PLAYERS, type GolfRound } from './multiplayer';
import { PLAYER_ROWS, REMOVE_PLAYER_ROWS, ADD_PLAYER, RESTORE_PLAYERS_BUTTON, PLAYERS_BUTTON, drawNameStart, drawMultiplayerSetup, drawMultiplayerScorecard, drawTurnHandoff, boundedPlayerName } from './multiplayer-view';
import { drawScorecard } from './scorecard';
import { drawWind } from './wind-view';
import { CLUB_BAG_BUTTON, CLUB_BAG_BACK, CLUB_BOXES, clubDistanceLabel, clubById, aimStep, aimLabel } from './club-picker';

type Mode = 'title' | 'setup' | 'play' | 'over' | 'howto' | 'scorecard' | 'clubs' | 'handoff';
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = createSurface(canvas);
const view = new CourseView();
const nameStart = new NameStartPlacement();
const turnPlacement = new TurnPlacement();
let activeContacts: ReadonlyMap<number, BoardContact> = new Map();
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
let turnAnnounceUntil = 0;
let toast = '';
let toastUntil = 0;
let saved: GolfRound | null = null;
let round: GolfRound | null = null;
let roster: BoardPlayer[] = [];
let ownerId = '';
let rosterReady = true;
let roundActive = false;
let best: number | null = null;
let taps: {x: number; y: number}[] = [];
let lastLabel = '';
const SCORECARD: Box = {x: 708, y: 1590, width: 324, height: 130};
const HELP: Box = {x: 48, y: 1100, width: 476, height: 130};
const REMATCH: Box = {x: 280, y: 1500, width: 520, height: 140};
const SETUP: Box = {x: 280, y: 1680, width: 520, height: 140};
const AIM_LEFT: Box = {x: 64, y: 1360, width: 160, height: 130};
const AIM_RIGHT: Box = {x: 856, y: 1360, width: 160, height: 130};

function say(message: string, seconds = 3) { toast = message; toastUntil = performance.now() + seconds * 1000; }
function syncRoster() {
  roster = seated().slice(0, MAX_PLAYERS);
  const nextOwner = activeSeat()?.playerId ?? roster[0]?.playerId ?? '';
  if (ownerId && nextOwner !== ownerId) {
    // Never write another profile's round into the newly active profile's save slot.
    controller.release(); controller.setEnabled(false); round = null; saved = null;
    roundActive = false; game = createGame(); mode = 'title';
  }
  const changedOwner = ownerId !== nextOwner;
  ownerId = nextOwner;
  if (roundActive && round) {
    rosterReady = syncRoundRoster(round, roster);
    player = rosterReady ? roster.find(p => p.sessionId === activeGolfer(round!).sessionId) : undefined;
    if (!rosterReady && mode !== 'setup') {
      waitForTurn();
    } else if (rosterReady && mode === 'handoff') {
      // Roster recovery resumes an already committed ball or its shared result.
      // A ready lie still waits for a settled Sports piece before a new swing.
      if (holeComplete(round)) { mode = 'over'; resultAt = performance.now(); }
      else if (game.phase === 'flight' || game.phase === 'rolling') mode = 'play';
    }
  } else { player = activeSeat() ?? roster[0]; rosterReady = true; }
  if (changedOwner) { readSaved(); refreshBest(); }
}
function persist() {
  if (round && roundActive && ownerId) BoardPlatform.state.save(saveRound(round, ownerId));
}
function readSaved() {
  if (!roundActive) saved = ownerId ? readRound(BoardPlatform.state.load(), ownerId) : null;
  refreshBest();
}
function refreshBest() {
  const n = player ? BoardPlatform.state.progress.get<number>(`nineHoleBestRoundStrokes:${player.playerId}`) : undefined;
  best = typeof n === 'number' && n > 0 ? n : null;
}
function freshLie() { selectedClub = clubFor(game); aim = 0; view.setAim(aim); controller.resetStroke(); }
function useActiveGolfer() {
  if (!round) return;
  game = activeGolfer(round).game;
  syncRoster(); refreshBest(); freshLie(); view.reset(game);
}
function playableMode(): Mode {
  if (round && holeComplete(round)) return 'over';
  return round && round.players.length > 1 && game.phase === 'ready' ? 'handoff' : 'play';
}
function startingPlayer() {
  const source = mode === 'handoff' ? round : mode === 'title' ? saved : null;
  if (source) {
    const golfer = activeGolfer(source);
    // Legacy solo saves have no display name; the roster remains authoritative.
    return roster.find(p => sameGolfer(golfer, p)) ?? golfer;
  }
  return roster[0];
}
function namePlacementKey(): string | null {
  const starter = startingPlayer();
  return (mode === 'title' || mode === 'setup') && starter && roster.length && !selectorOpen() ?
    JSON.stringify([mode, starter.playerId, starter.sessionId, starter.name, !!saved, roster.map(p => [p.playerId, p.sessionId, p.name])]) : null;
}
function turnPlacementKey(): string | null {
  if (mode !== 'handoff' || !round || !rosterReady || game.phase !== 'ready' || holeComplete(round) || selectorOpen()) return null;
  const golfer = activeGolfer(round);
  return JSON.stringify([golfer.playerId, golfer.sessionId, golfer.name, game.holeIndex, game.strokes,
    roster.map(p => [p.playerId, p.sessionId, p.name])]);
}
function waitForTurn() {
  mode = 'handoff'; toast = '';
  controller.setEnabled(false); controller.resetStroke();
  // A shared piece may stay where it is. Only a new settled address and deliberate
  // twist can strike for the next player; there is no required placement location.
  turnPlacement.update(activeContacts, turnPlacementKey(), performance.now());
}
function startRound(restore = false, placementConfirmed = false) {
  turnPlacement.update(activeContacts, null, performance.now()); turnAnnounceUntil = 0;
  if (!roster.length) { mode = 'setup'; say('Choose a player'); return; }
  round = restore && saved ? saved : createRound(roster);
  saved = null; roundActive = true;
  useActiveGolfer();
  mode = rosterReady ? (placementConfirmed && game.phase === 'ready' && !holeComplete(round) ? 'play' : playableMode()) : 'handoff';
  controller.setEnabled(false); controller.resetStroke(true);
  if (mode === 'handoff') waitForTurn();
  resultAt = performance.now(); persist();
}
function nextHole() {
  if (!round || !advanceRoundHole(round)) return;
  useActiveGolfer(); mode = playableMode(); toast = '';
  if (mode === 'handoff') waitForTurn();
  persist();
}
function changeSetup() {
  nameStart.reset(activeContacts); turnPlacement.reset();
  controller.release(); controller.setEnabled(false); mode = 'setup'; syncRoster();
}
function beginTurn() {
  if (!round || !rosterReady) return;
  controller.resetStroke(true);
  mode = holeComplete(round) ? 'over' : 'play';
  turnAnnounceUntil = performance.now() + 2000; persist();
}
function showScorecard() { if (mode === 'scorecard' || !roundActive) return; scorecardReturn = mode === 'howto' ? helpReturn : mode; mode = 'scorecard'; controller.setEnabled(false); controller.resetStroke(); }
function showHelp() { if (mode === 'howto') return; nameStart.reset(activeContacts); turnPlacement.reset(); helpReturn = mode === 'scorecard' ? scorecardReturn : mode; mode = 'howto'; controller.setEnabled(false); controller.resetStroke(); }
function showClubs() { mode = 'clubs'; controller.setEnabled(false); controller.resetStroke(); }
function leaveHelp() { mode = helpReturn; controller.resetStroke(); }
async function changePlayer(index?: number): Promise<boolean> {
  if (selectorOpen() || (index === undefined && roster.length >= MAX_PLAYERS)) return false;
  nameStart.reset(activeContacts); turnPlacement.reset();
  controller.setEnabled(false); controller.resetStroke();
  const picked = await pickPlayer([], index === undefined ? undefined : roster[index]?.sessionId);
  syncRoster();
  if (!roundActive) readSaved();
  return picked;
}
function missingPlayers() {
  return round ? round.players.map((golfer, index) => ({golfer, index}))
    .filter(({golfer}) => !roster.some(p => sameGolfer(golfer, p))) : [];
}
async function restorePlayer() {
  if (!round || selectorOpen()) return;
  const restoring = round, missing = missingPlayers()[0];
  if (!missing) return;
  const before = [...roster];
  // The screen names the missing seat. Rejoining an ephemeral guest is an explicit selector choice.
  const extra = roster.find(p => !round!.players.some(r => sameGolfer(r, p)));
  const index = roster.length >= MAX_PLAYERS && extra ? roster.indexOf(extra) : undefined;
  const picked = await changePlayer(index);
  if (!picked || round !== restoring) return;
  const chosen = roster.filter(p => !before.some(prior => sameGolfer(prior, p)));
  if (chosen.length === 1) restoreGuestSeat(round, missing.index, chosen[0]);
  syncRoster(); persist();
}

startInput((batch, active) => {
  noteContacts(batch);
  if (!booted || paused) return;
  activeContacts = new Map(active);
  const now = performance.now();
  for (const c of batch) {
    if (c.type === BoardContactType.Finger && c.phase === BoardContactPhase.Began) taps.push(toPortrait(c));
  }
  controller.setEnabled(mode === 'play' && game.phase === 'ready' && !!player && rosterReady && !selectorOpen());
  const events = controller.update(batch, active, now);
  for (const c of events.arrivals) {
    const p = toPortrait(c);
    splashes.at(p.x, p.y, {inner: pieceFootprint(footprints, c)?.radiusPx ?? 81, color: '#F3DC9A', sound: () => playCue('place')});
    if (c.glyphId < 1 || c.glyphId > 8) say('Use a Sports player');
    if (isSportsPiece(c) && isPiecePlacement(c) && rosterReady && round && round.players.length > 1 &&
        game.phase === 'ready' && !selectorOpen()) {
      if (mode === 'handoff') turnPlacement.prefer(c.contactId);
      else if (mode === 'play' && controller.piece?.contactId !== c.contactId && controller.swing.windup === 0) {
        // A new golfer may bring their own piece while the previous one is still
        // on the glass. Let that fresh arrival take the next settled address.
        turnPlacement.update(activeContacts, null, now);
        turnPlacement.prefer(c.contactId); waitForTurn();
      }
    }
  }
  if (events.shot && mode === 'play' && game.phase === 'ready') {
    const putter = selectedClub === 'PUTTER';
    if (strike(game, {...events.shot, angle: aim}, selectedClub)) {
      view.startStroke(game, putter); controller.setEnabled(false); toast = ''; persist();
    }
  }
}, () => {
  nameStart.reset(activeContacts); turnPlacement.reset();
  activeContacts = new Map();
  paused = true;
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  pendingFrame = null;
  controller.pause(performance.now()); taps = []; persist();
});

function text(label: string, x: number, y: number, size = 48, color = '#FFF8E4', align: CanvasTextAlign = 'left') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}
function result(now: number) {
  const hole = holeFor(game), final = !!round && roundComplete(round);
  const multiplayer = !!round && round.players.length > 1;
  const total = roundStrokes(game), par = roundPar(game);
  const relative = total - par;
  const score = relative === 0 ? 'EVEN PAR' : `${relative > 0 ? '+' : ''}${relative} TO PAR`;
  ctx.fillStyle = 'rgba(9,42,37,0.94)'; ctx.fillRect(0, 0, 1080, 1920);
  text(final ? 'ROUND COMPLETE' : `HOLE ${game.holeIndex + 1} COMPLETE`, 540, 260, 48, '#C5D5B7', 'center');
  text(multiplayer ? (final ? (winners(round!).length > 1 ? 'TIED ROUND' : 'ROUND WINNER') : 'EVERYONE IS IN') : final ? score : game.phase === 'holed' ? scoreLabel(game.strokes, hole.par).toUpperCase() : 'STROKE LIMIT', 540, 390, 72, '#F1D58B', 'center');
  text(multiplayer ? (final && winners(round!).length === 1 ? boundedPlayerName(ctx, winners(round!)[0].name, 920, 56) : final ? `${winners(round!).length} PLAYERS TIED` : `HOLE ${game.holeIndex + 1}  /  PAR ${hole.par}`) : final ? `${total} STROKES  /  PAR ${par}` : `${game.strokes} STROKES  /  PAR ${hole.par}`, 540, 500, 56, '#FFFFFF', 'center');
  if (round && round.players.length > 1) drawMultiplayerScorecard(ctx, round); else drawScorecard(ctx, game);
  drawButton(ctx, REMATCH, final ? 'REMATCH' : 'NEXT HOLE'); drawButton(ctx, SETUP, 'CHANGE SETUP');
  if (!multiplayer && best !== null) text(`BEST ROUND  ${best}`, 540, 1250, 48, '#C5D5B7', 'center');
  if (now - resultAt < 2400) particles.draw(ctx);
}
function roundCard() {
  ctx.fillStyle = 'rgba(9,42,37,0.96)'; ctx.fillRect(0, 0, 1080, 1920);
  text('ROUND SCORECARD', 540, 320, 64, '#F1D58B', 'center');
  text('9 HOLES  /  PAR 36', 540, 440, 48, '#FFFFFF', 'center');
  if (round && round.players.length > 1) drawMultiplayerScorecard(ctx, round); else drawScorecard(ctx, game);
  drawButton(ctx, REMATCH, 'BACK');
}
function drawClubs() {
  ctx.fillStyle = '#12392C'; ctx.fillRect(0, 0, 1080, 1920);
  text('YOUR CLUB BAG', 540, 245, 64, '#F1D58B', 'center');
  text('CHOOSE YOUR NEXT SHOT', 540, 350, 48, '#FFF8E4', 'center');
  for (const {club, box} of CLUB_BOXES) {
    drawButton(ctx, box, '');
    text(club.label, box.x + box.width / 2, box.y + 43, 48, '#204834', 'center');
    text(clubDistanceLabel(club), box.x + box.width / 2, box.y + 100, 48, '#204834', 'center');
    if (selectedClub === club.id) { ctx.strokeStyle = '#E6B861'; ctx.lineWidth = 8; ctx.strokeRect(box.x + 4, box.y + 4, box.width - 8, box.height - 8); }
  }
  text('FULL SHOTS FROM A CLEAN LIE', 540, 1240, 48, '#C5D5B7', 'center');
  drawButton(ctx, CLUB_BAG_BACK, 'BACK');
}
function drawHoleContext() {
  // Keep the entire horizon open: only hole context and distance live above the course.
  ctx.fillStyle = 'rgba(12,45,36,0.82)'; ctx.fillRect(48, 48, 984, 104);
  const hole = holeFor(game);
  text(`${game.holeIndex + 1}/${HOLES.length}  /  PAR ${hole.par}`, 76, 100, 48, '#E3DBB6');
  const distance = distanceToCup(game), putting = selectedClub === 'PUTTER';
  const amount = putting ? distance * 3 : distance;
  text(`${amount < 10 ? amount.toFixed(1) : Math.round(amount)} ${putting ? 'FT' : 'YD'}`, 1004, 102, 64, '#FFF8E4', 'right');
}
function drawPlay(now: number) {
  drawHoleContext();
  drawWind(ctx, game.wind, view.heading);
  if (round && round.players.length > 1) {
    text(`${round.activeIndex + 1}  ${boundedPlayerName(ctx, activeGolfer(round).name, 540, 48)}`, 76, 1780, 48, '#F1D58B');
  }
  text(`STROKES ${game.strokes}`, 76, 1840, 48, '#C5D5B7');
  const ready = game.phase === 'ready';
  if (ready) {
    drawButton(ctx, SCORECARD, 'SCORECARD');
    const club = clubById(selectedClub), center = CLUB_BAG_BUTTON.x + CLUB_BAG_BUTTON.width / 2;
    drawButton(ctx, CLUB_BAG_BUTTON, '');
    text(club.label, center, 1628, 48, '#204834', 'center');
    text(`${clubDistanceLabel(club)}  /  CLUB BAG`, center, 1686, 48, '#204834', 'center');
    drawButton(ctx, AIM_LEFT, '←'); drawButton(ctx, AIM_RIGHT, '→');
    text('AIM', 144, 1320, 48, '#C5D5B7', 'center');
    text(aimLabel(aim), 936, 1320, 48, '#C5D5B7', 'center');
  }
  const swing = controller.swing;
  const instruction = !ready ? 'WATCH YOUR SHOT' : !controller.piece || !isPiecePlacement(controller.piece) ? 'PLACE YOUR PLAYER ANYWHERE' :
    swing.stage === 'settling' ? 'HOLD STILL TO ADDRESS' : swing.stage === 'backswing' ? 'RETURN TO THE BALL' : 'TURN BACK, THEN THROUGH';
  // Feedback uses one fixed footer line, clear of the physical piece and the flag.
  if (!(toast && now < toastUntil)) {
    const penalty = game.penalty && controller.piece && isPiecePlacement(controller.piece) && swing.stage === 'ready';
    const announcingTurn = ready && controller.piece && round && now < turnAnnounceUntil && swing.windup === 0;
    const suffix = '’s turn';
    ctx.font = gameFont(48);
    const turnName = announcingTurn ? boundedPlayerName(ctx, activeGolfer(round!).name, 984 - ctx.measureText(suffix).width) : '';
    const message = announcingTurn ? `${turnName}${suffix}` : penalty ? (game.penaltyKind === 'water' ? 'WATER  +1  /  REPLAY SHOT' : 'OUT OF BOUNDS  +1') :
      ready && swing.windup > 0 ? `${Math.round(swing.power * 100)}%  /  ${instruction}` : instruction;
    text(message, 540, 1530, 48, penalty || swing.windup > 0 ? '#F1D58B' : '#FFF8E4', 'center');
  }
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
    text('1–4 PLAYERS  /  PAR 36', 540, 990, 48, '#FFFFFF', 'center');
    const starter = startingPlayer();
    if (starter) drawNameStart(ctx, starter.name, !!saved, nameStart.needsReentry);
    else text('Choose a player to begin', 540, 1580, 48, '#FFFFFF', 'center');
    drawButton(ctx, HELP, 'HOW TO PLAY');
    drawButton(ctx, PLAYERS_BUTTON, 'PLAYERS');
  } else if (mode === 'setup') {
    drawMultiplayerSetup(ctx, roster, nameStart.needsReentry);
  } else if (mode === 'handoff' && round) {
    const missing = missingPlayers()[0];
    if (rosterReady) drawHoleContext();
    drawTurnHandoff(ctx, round, rosterReady ? [] : [missing ? `Player ${missing.index + 1}: ${missing.golfer.name}` : 'Round players']);
    if (!rosterReady) drawButton(ctx, SETUP, 'CHANGE SETUP');
  } else if (mode === 'howto') drawHowTo(ctx, now);
  else if (mode === 'over') result(now);
  else if (mode === 'scorecard') roundCard();
  else if (mode === 'clubs') drawClubs();
  else drawPlay(now);
  if (toast && now < toastUntil) {
    const y = mode === 'play' ? 1475 : mode === 'handoff' && rosterReady ? 1760 : 390;
    ctx.fillStyle = 'rgba(7,35,31,0.94)'; ctx.fillRect(48, y, 984, 110); text(toast, 540, y + 55, 48, '#FFF8E4', 'center');
  }
  splashes.draw(ctx);
}
function update(now: number, dt: number) {
  if (now - pollAt > 1000) { syncRoster(); pollAt = now; }
  const tapped = (box: Box) => taps.some(t => hit(box, t.x, t.y));
  if (mode === 'title') {
    if (tapped(HELP)) { playCue('button'); showHelp(); }
    else if (tapped(PLAYERS_BUTTON)) { playCue('button'); changeSetup(); }
  } else if (mode === 'setup') {
    const changeIndex = roster.findIndex((_, index) => tapped(PLAYER_ROWS[index]));
    const removeIndex = roster.findIndex((_, index) => tapped(REMOVE_PLAYER_ROWS[index]));
    if (changeIndex >= 0) { playCue('button'); void changePlayer(changeIndex); }
    else if (removeIndex > 0 && roster.length > 1) { removeSeatedPlayer(roster[removeIndex].sessionId); syncRoster(); playCue('button'); }
    else if (tapped(ADD_PLAYER)) { playCue('button'); void changePlayer(); }
  } else if (mode === 'handoff') {
    if (!rosterReady && tapped(RESTORE_PLAYERS_BUTTON)) { playCue('button'); void restorePlayer(); }
    else if (!rosterReady && tapped(SETUP)) { playCue('button'); changeSetup(); }
  } else if (mode === 'howto' && tapped(BACK_BUTTON)) { playCue('button'); leaveHelp(); }
  else if (mode === 'scorecard') {
    if (tapped(REMATCH)) { playCue('button'); mode = scorecardReturn; controller.resetStroke(); }
  } else if (mode === 'clubs') {
    if (tapped(CLUB_BAG_BACK)) { mode = 'play'; controller.resetStroke(); playCue('button'); }
    for (const {club, box} of CLUB_BOXES) if (tapped(box)) {
      selectedClub = club.id; controller.resetStroke(); mode = 'play'; playCue('button');
    }
  } else if (mode === 'over') {
    if (tapped(REMATCH)) { playCue('button'); if (isFinalHole(game)) startRound(); else nextHole(); }
    else if (tapped(SETUP)) { playCue('button'); changeSetup(); }
  } else if (mode === 'play' && game.phase === 'ready') {
    if (tapped(SCORECARD)) { playCue('button'); showScorecard(); }
    else if (tapped(CLUB_BAG_BUTTON)) { showClubs(); playCue('button'); }
    else if (tapped(AIM_LEFT) || tapped(AIM_RIGHT)) {
      aim = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, aim + (tapped(AIM_LEFT) ? -1 : 1) * aimStep()));
      view.setAim(aim); controller.resetStroke(); playCue('button');
    }
  }
  const startingContact = nameStart.update(activeContacts, namePlacementKey(), now);
  if (startingContact !== null && controller.confirmPlacement(startingContact)) {
    const restore = mode === 'title' && !!saved;
    toast = ''; playCue('button');
    startRound(restore, true);
  }
  const turnContact = turnPlacement.update(activeContacts, turnPlacementKey(), now);
  if (turnContact !== null && controller.confirmPlacement(turnContact)) {
    toast = ''; playCue('button'); beginTurn();
  }
  controller.setEnabled(mode === 'play' && game.phase === 'ready' && !!player && rosterReady && !selectorOpen()); controller.tick(now);
  if (mode === 'play') {
    view.setSwing(controller.swing.stage, controller.swing.windup);
    const animation = view.advanceSwing(dt, selectedClub === 'PUTTER');
    if (animation.impact) playCue(animation.putting ? 'putt' : 'swing', game.shotPower);
    const before = game.phase; stepGame(game, animation.ballDt);
    if (before !== game.phase) {
      if (before === 'flight' && game.phase === 'rolling') playCue(terrainAt(game.ball.x, game.ball.z, holeFor(game)) === 'bunker' ? 'sand' : 'land');
      if (game.phase === 'ready' || game.phase === 'holed' || game.phase === 'limit') {
        const finished = game.phase === 'holed' || game.phase === 'limit';
        if (game.phase === 'holed') {
          playCue('cup'); particles.burst(540, 640, {count: 120, color: '#F1D58B', speed: 420, life: 1.6, gravity: 220});
        } else if (game.penalty || game.phase === 'limit') playCue('penalty');
        controller.setEnabled(false); controller.resetStroke();
        if (round && holeComplete(round)) {
          mode = 'over'; resultAt = now;
          if (roundComplete(round)) for (const golfer of round.players) {
            if (golfer.type !== 'profile') continue;
            const key = `nineHoleBestRoundStrokes:${golfer.playerId}`;
            const prior = BoardPlatform.state.progress.get<number>(key);
            if (typeof prior !== 'number' || roundStrokes(golfer.game) < prior) BoardPlatform.state.progress.set(key, roundStrokes(golfer.game));
          }
          refreshBest();
        } else if (round) {
          nextTurn(round); useActiveGolfer();
          if (round.players.length > 1) waitForTurn();
          else { mode = 'play'; freshLie(); }
        } else if (!finished) freshLie();
      }
      persist();
    }
    if (now - saveAt > 400) { persist(); saveAt = now; }
  }
  splashes.update(dt); particles.update(dt); taps = [];
  const starter = startingPlayer();
  const placementLabel = mode === 'title' || mode === 'setup' ? `Place Sports player in the circle on ${starter?.name ?? 'your name'}` :
    mode === 'handoff' ? 'Place Sports player anywhere on the Board' :
    controller.piece ? 'Sports player present' : 'Place Sports player anywhere on the Board';
  const label = `${mode}. ${mode === 'setup' ? `${roster.length} players selected` : round && round.players.length > 1 ? `${round.players.length} players. Player ${round.activeIndex + 1}: ${activeGolfer(round).name}` : 'Solo golf'}. Hole ${game.holeIndex + 1} of ${HOLES.length}, par ${holeFor(game).par}. ${game.strokes} strokes. ${game.phase}. ${distanceToCup(game).toFixed(1)} yards to cup. ${selectedClub}. ${placementLabel}. ${controller.swing.stage}. ${Math.round(controller.swing.power * 100)}% power. Wind ${Math.round(Math.hypot(game.wind.x, game.wind.z))} mph. Aim ${aimLabel(aim)}.${selectedClub === 'PUTTER' ? ' The grid shows green slopes.' : ''}`;
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
