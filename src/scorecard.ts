import { gameFont } from './runtime';
import { HOLES, type GolfState } from './rules';

export type ScoreMark = 'none' | 'birdie' | 'eagle' | 'bogey' | 'double-bogey';
export interface ScorecardHole {
  number: number;
  yards: number;
  par: number;
  strokes: number | null;
  relative: number | null;
  mark: ScoreMark;
}

export function formatToPar(relative: number): string {
  return relative === 0 ? 'E' : relative > 0 ? `+${relative}` : String(relative);
}

/** A score is entered only after the hole finishes. Unplayed holes never count as zeroes. */
export function scorecardFor(game: GolfState) {
  const finished = game.phase === 'holed' || game.phase === 'limit';
  const holes: ScorecardHole[] = HOLES.map((hole, index) => {
    const strokes = index < game.holeIndex ? game.completedStrokes[index]
      : index === game.holeIndex && finished ? game.strokes : null;
    const relative = strokes === null ? null : strokes - hole.par;
    const mark: ScoreMark = relative === null || relative === 0 ? 'none'
      : relative <= -2 ? 'eagle' : relative === -1 ? 'birdie'
      : relative === 1 ? 'bogey' : 'double-bogey';
    return {number: index + 1, yards: Math.round(Math.hypot(hole.flag.x - hole.tee.x, hole.flag.z - hole.tee.z)),
      par: hole.par, strokes, relative, mark};
  });
  const completed = holes.filter(hole => hole.strokes !== null);
  const strokes = completed.reduce((sum, hole) => sum + hole.strokes!, 0);
  const completedPar = completed.reduce((sum, hole) => sum + hole.par, 0);
  return {holes, through: completed.length, strokes, completedPar, relative: strokes - completedPar,
    yards: holes.reduce((sum, hole) => sum + hole.yards, 0),
    par: holes.reduce((sum, hole) => sum + hole.par, 0)};
}

export const SCORECARD_BOX = {x: 48, y: 600, width: 984, height: 590} as const;

function text(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, size: number,
  color = '#173F30', align: CanvasTextAlign = 'center') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = align;
  ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}

function scoreMark(ctx: CanvasRenderingContext2D, mark: ScoreMark, x: number, y: number) {
  if (mark === 'none') return;
  ctx.strokeStyle = mark === 'birdie' || mark === 'eagle' ? '#286649' : '#7D493C';
  ctx.lineWidth = 2;
  if (mark === 'birdie' || mark === 'eagle') {
    ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.stroke();
    if (mark === 'eagle') { ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    ctx.strokeRect(x - 31, y - 31, 62, 62);
    if (mark === 'double-bogey') ctx.strokeRect(x - 35, y - 35, 70, 70);
  }
}

/** A traditional front-nine card, drawn within the portrait result screen's safe inset. */
export function drawScorecard(ctx: CanvasRenderingContext2D, game: GolfState): void {
  const card = scorecardFor(game), {x, y, width, height} = SCORECARD_BOX;
  const labelWidth = 154, holeWidth = 80, totalWidth = 110;
  const gridTop = y + 75, gridBottom = y + 470;
  const totalX = x + labelWidth + holeWidth * 9;
  const center = (index: number) => x + labelWidth + holeWidth * (index + 0.5);
  const totalCenter = totalX + totalWidth / 2;
  const headerY = y + 110, yardsY = y + 185, parY = y + 260, scoreY = y + 345, relativeY = y + 430;
  ctx.save();
  ctx.fillStyle = '#F7EED7'; ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#E9DFC3'; ctx.fillRect(totalX, gridTop, totalWidth, gridBottom - gridTop);
  ctx.fillStyle = '#284F3E'; ctx.fillRect(x, y, width, 75);
  text(ctx, 'SCORECARD', 540, y + 38, 40, '#FAF1D9');
  ctx.fillStyle = '#D9E0C8'; ctx.fillRect(x, gridTop, width, 70);
  ctx.fillStyle = '#EFE5CB'; ctx.fillRect(x, y + 220, width, 75);
  if (game.phase === 'holed' || game.phase === 'limit') {
    ctx.fillStyle = '#ECD698'; ctx.fillRect(center(game.holeIndex) - holeWidth / 2, y + 295, holeWidth, 100);
  }
  ctx.strokeStyle = '#AFB697'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 9; i++) {
    const lineX = x + labelWidth + holeWidth * i;
    ctx.moveTo(lineX, gridTop); ctx.lineTo(lineX, gridBottom);
  }
  for (const offset of [75, 145, 220, 295, 395, 470]) {
    ctx.moveTo(x, y + offset); ctx.lineTo(x + width, y + offset);
  }
  ctx.stroke();
  ctx.strokeStyle = '#B8AE8D'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  for (const [label, rowY] of [['HOLE', headerY], ['YARDS', yardsY], ['PAR', parY], ['SCORE', scoreY], ['TO PAR', relativeY]] as const) {
    text(ctx, label, x + labelWidth / 2, rowY, 32);
  }
  for (let i = 0; i < card.holes.length; i++) {
    const hole = card.holes[i], cx = center(i);
    text(ctx, String(hole.number), cx, headerY, 36);
    text(ctx, String(hole.yards), cx, yardsY, 32);
    text(ctx, String(hole.par), cx, parY, 40);
    scoreMark(ctx, hole.mark, cx, scoreY);
    text(ctx, hole.strokes === null ? '—' : String(hole.strokes), cx, scoreY, 48,
      hole.strokes === null ? '#838975' : '#173F30');
    text(ctx, hole.relative === null ? '—' : formatToPar(hole.relative), cx, relativeY, 36,
      hole.relative === null ? '#838975' : '#173F30');
  }
  text(ctx, 'OUT', totalCenter, headerY, 32);
  text(ctx, String(card.yards), totalCenter, yardsY, 32);
  text(ctx, String(card.par), totalCenter, parY, 40);
  text(ctx, card.through ? String(card.strokes) : '—', totalCenter, scoreY, 48);
  text(ctx, card.through ? formatToPar(card.relative) : '—', totalCenter, relativeY, 36);
  text(ctx, `THROUGH ${card.through} OF ${card.holes.length}`, x + 24, y + 510, 32, '#284F3E', 'left');
  text(ctx, card.through ? `${card.strokes} STROKES  /  PAR ${card.completedPar}` : 'READY TO TEE OFF',
    x + width - 24, y + 510, 32, '#284F3E', 'right');
  text(ctx, 'CIRCLE: UNDER PAR   /   SQUARE: OVER PAR', 540, y + 555, 32, '#52634A');
  ctx.restore();
}
