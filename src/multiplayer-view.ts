import { gameFont } from './runtime';
import { drawButton, type Box } from './howto';
import { formatToPar, scorecardFor } from './scorecard';
import type { GolfRound } from './multiplayer';

// All players use the existing left-edge swing station. Leave its physical piece area clear.
export const PLAYER_ROWS: readonly Box[] = Array.from({length: 4}, (_, index) =>
  ({x: 64, y: 440 + index * 180, width: 808, height: 140}));
export const REMOVE_PLAYER_ROWS: readonly Box[] = PLAYER_ROWS.map(row =>
  ({x: 896, y: row.y, width: 120, height: 140}));
export const ADD_PLAYER: Box = {x: 280, y: 1510, width: 520, height: 130};
export const START_ROUND: Box = {x: 280, y: 1680, width: 520, height: 140};
export const READY_BUTTON: Box = {x: 280, y: 1500, width: 520, height: 140};
export const PLAYERS_BUTTON: Box = {x: 280, y: 1280, width: 520, height: 130};
export const MULTIPLAYER_SCORECARD_BOX = {x: 48, y: 600, width: 984, height: 685} as const;

const colors = ['#E5BA69', '#8FC9D1', '#C9AFDE', '#C2D58B'];

function text(ctx: CanvasRenderingContext2D, label: string, x: number, y: number,
  size = 48, color = '#FFF8E4', align: CanvasTextAlign = 'center') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = align;
  ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}

/** Keep the roster's full name in state; only this particular rendered label is shortened. */
export function boundedPlayerName(ctx: CanvasRenderingContext2D, name: string, maxWidth: number, size = 48): string {
  ctx.font = gameFont(size);
  const clean = name.replace(/\s+/g, ' ').trim();
  if (ctx.measureText(clean).width <= maxWidth) return clean;
  const chars = Array.from(clean);
  while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
  return chars.join('').trimEnd() + '…';
}

function backdrop(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#12392C'; ctx.fillRect(0, 0, 1080, 1920);
}

export function drawMultiplayerSetup(ctx: CanvasRenderingContext2D, players: readonly {name: string}[],
  canStart: boolean, restoring = false): void {
  ctx.save(); backdrop(ctx);
  text(ctx, 'YOUR TEE TIME', 540, 200, 72, '#F1D58B');
  text(ctx, `${players.length} OF 4 PLAYERS  /  9 HOLES`, 540, 300, 48, '#E2EACF');
  for (let i = 0; i < Math.min(4, players.length); i++) {
    const box = PLAYER_ROWS[i];
    drawButton(ctx, box, '');
    ctx.fillStyle = colors[i]; ctx.fillRect(box.x + 16, box.y + 18, 72, 104);
    text(ctx, String(i + 1), box.x + 52, box.y + 70, 48, '#173F30');
    text(ctx, boundedPlayerName(ctx, players[i].name, box.width - 146), box.x + 112, box.y + 50,
      48, '#173F30', 'left');
    text(ctx, 'TAP TO CHANGE PLAYER', box.x + 112, box.y + 104, 32, '#52634A', 'left');
    if (i > 0) drawButton(ctx, REMOVE_PLAYER_ROWS[i], '−');
  }
  if (!players.length) text(ctx, 'Choose a player to begin', 540, 550, 48, '#E2EACF');
  text(ctx, 'TAKE TURNS FROM THIS END', 540, 1215, 48, '#F1D58B');
  text(ctx, 'Lift the piece before swapping it.', 540, 1280, 40, '#E2EACF');
  if (players.length < 4) drawButton(ctx, ADD_PLAYER, players.length ? 'ADD PLAYER' : 'CHOOSE PLAYER');
  else text(ctx, 'FOUR PLAYERS SELECTED', 540, 1575, 40, '#E2EACF');
  ctx.save(); if (!canStart) ctx.globalAlpha = 0.45;
  drawButton(ctx, START_ROUND, restoring ? 'CONTINUE ROUND' : 'TEE OFF'); ctx.restore();
  text(ctx, canStart ? 'Lowest total wins. Ties share the win.' : 'Place a Sports piece to tee off.',
    540, 1840, 40, '#E2EACF');
  ctx.restore();
}

/** Shared nine-hole card. A numbered name identifies each row without relying on color. */
export function drawMultiplayerScorecard(ctx: CanvasRenderingContext2D, round: GolfRound): void {
  const {x, y, width, height} = MULTIPLAYER_SCORECARD_BOX;
  const cards = round.players.map(player => scorecardFor(player.game));
  if (!cards.length) return;
  const labelWidth = 234, holeWidth = 70, totalWidth = 120;
  const totalX = x + labelWidth + 9 * holeWidth;
  const holeX = (index: number) => x + labelWidth + (index + 0.5) * holeWidth;
  const totalCenter = totalX + totalWidth / 2;
  const rowTop = (index: number) => y + 228 + index * 100;
  ctx.save();
  ctx.fillStyle = '#F7EED7'; ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#284F3E'; ctx.fillRect(x, y, width, 54);
  text(ctx, 'ROUND SCORECARD', 540, y + 27, 36, '#FAF1D9');
  ctx.fillStyle = '#D9E0C8'; ctx.fillRect(x, y + 54, width, 58);
  ctx.fillStyle = '#EFE5CB'; ctx.fillRect(x, y + 170, width, 58);
  ctx.fillStyle = '#E9DFC3'; ctx.fillRect(totalX, y + 54, totalWidth, 574);
  for (let i = 0; i < Math.min(4, round.players.length); i++) {
    const top = rowTop(i);
    if (i === round.activeIndex) { ctx.fillStyle = '#E8DFBE'; ctx.fillRect(x, top, width, 100); }
    ctx.fillStyle = colors[i]; ctx.fillRect(x + 10, top + 12, 6, 76);
    text(ctx, boundedPlayerName(ctx, `${i + 1}  ${round.players[i].name}`, labelWidth - 56, 32),
      x + 28, top + 34, 32, '#173F30', 'left');
    text(ctx, `${cards[i].through} ${cards[i].through === 1 ? 'HOLE' : 'HOLES'}`, x + 28, top + 74, 32, '#52634A', 'left');
    for (let j = 0; j < 9; j++) {
      const hole = cards[i].holes[j], cx = holeX(j), cy = top + 50;
      if (hole.relative !== null && hole.relative !== 0) {
        ctx.strokeStyle = hole.relative < 0 ? '#286649' : '#7D493C'; ctx.lineWidth = 2;
        if (hole.relative < 0) { ctx.beginPath(); ctx.arc(cx, cy, 27, 0, Math.PI * 2); ctx.stroke(); }
        else ctx.strokeRect(cx - 27, cy - 29, 54, 58);
      }
      text(ctx, hole.strokes === null ? '—' : String(hole.strokes), cx, cy, 48,
        hole.strokes === null ? '#838975' : '#173F30');
    }
    text(ctx, cards[i].through ? String(cards[i].strokes) : '—', totalCenter, top + 35, 48, '#173F30');
    text(ctx, cards[i].through ? formatToPar(cards[i].relative) : '—', totalCenter, top + 77, 32, '#52634A');
  }
  ctx.strokeStyle = '#AFB697'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i <= 9; i++) {
    const lineX = x + labelWidth + i * holeWidth;
    ctx.moveTo(lineX, y + 54); ctx.lineTo(lineX, y + 628);
  }
  for (const offset of [54, 112, 170, 228, 328, 428, 528, 628]) {
    ctx.moveTo(x, y + offset); ctx.lineTo(x + width, y + offset);
  }
  ctx.stroke();
  for (const [label, offset] of [['HOLE', 83], ['YARDS', 141], ['PAR', 199]] as const) {
    text(ctx, label, x + 28, y + offset, 32, '#173F30', 'left');
  }
  for (let i = 0; i < 9; i++) {
    const hole = cards[0].holes[i];
    text(ctx, String(hole.number), holeX(i), y + 83, 36, '#173F30');
    text(ctx, String(hole.yards), holeX(i), y + 141, 32, '#173F30');
    text(ctx, String(hole.par), holeX(i), y + 199, 36, '#173F30');
  }
  text(ctx, 'OUT', totalCenter, y + 83, 32, '#173F30');
  text(ctx, String(cards[0].yards), totalCenter, y + 141, 32, '#173F30');
  text(ctx, String(cards[0].par), totalCenter, y + 199, 36, '#173F30');
  text(ctx, 'FINISHED HOLES COUNT TOWARD TOTALS', 540, y + 655, 32, '#52634A');
  ctx.strokeStyle = '#B8AE8D'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.restore();
}

export function drawTurnHandoff(ctx: CanvasRenderingContext2D, round: GolfRound, missing: readonly string[] = []): void {
  const golfer = round.players[round.activeIndex];
  if (!golfer) return;
  ctx.save(); backdrop(ctx);
  text(ctx, missing.length ? 'ROUND PAUSED' : 'NEXT GOLFER', 540, 220, 64, '#F1D58B');
  text(ctx, boundedPlayerName(ctx, golfer.name, 940, 64), 540, 370, 64);
  text(ctx, `PLAYER ${round.activeIndex + 1}  /  HOLE ${golfer.game.holeIndex + 1}`, 540, 480, 48, '#E2EACF');
  text(ctx, `STROKES ${golfer.game.strokes}`, 540, 565, 48, colors[round.activeIndex]);
  if (missing.length) {
    text(ctx, 'Choose this player to rejoin the round.', 540, 710, 48, '#F1D58B');
    text(ctx, boundedPlayerName(ctx, missing.join(', '), 940), 540, 790, 48, '#E2EACF');
  } else {
    text(ctx, 'Take the piece at this end.', 540, 710, 48, '#E2EACF');
    text(ctx, 'Tap READY, then hold it still.', 540, 790, 48, '#E2EACF');
  }
  for (let i = 0; i < round.players.length; i++) {
    const p = round.players[i], top = 930 + i * 78;
    text(ctx, `${i + 1}  ${boundedPlayerName(ctx, p.name, 570)}`, 80, top, 48, colors[i], 'left');
    text(ctx, p.game.phase === 'limit' ? 'LIMIT' : p.game.phase === 'holed' ? 'HOLED' : `${p.game.strokes} SHOT${p.game.strokes === 1 ? '' : 'S'}`,
      1000, top, 48, '#E2EACF', 'right');
  }
  if (!missing.length) drawButton(ctx, READY_BUTTON, 'READY');
  else drawButton(ctx, READY_BUTTON, 'RESTORE PLAYERS');
  text(ctx, 'One shot each. Finished players wait.', 540, 1840, 40, '#E2EACF');
  ctx.restore();
}
