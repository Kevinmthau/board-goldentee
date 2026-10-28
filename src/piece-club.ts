import { facingRotation, frontPoint, type Footprint, type Vec } from './piece-footprints';

export interface PieceClubGeometry {
  /** Native Board coordinates; the grip begins at the center of the real front edge. */
  grip: Vec;
  head: Vec;
  facingRadians: number;
  shaftLength: number;
  shaftWidth: number;
  gripLength: number;
  gripWidth: number;
  headWidth: number;
  headDepth: number;
}

/** The requested club attachment is the sole drawing that follows a physical player. */
export function pieceClubGeometry(footprint: Footprint | null, putting = false): PieceClubGeometry | null {
  if (!footprint || footprint.outline.length < 3 || !Number.isFinite(footprint.facingDeg)) return null;
  const facingRadians = facingRotation(footprint, 'right');
  const forward = { x: Math.cos(facingRadians), y: Math.sin(facingRadians) };
  const side = { x: -forward.y, y: forward.x };
  let left = Infinity, right = -Infinity;
  for (const p of footprint.outline) {
    const across = (p.x - footprint.center.x) * side.x + (p.y - footprint.center.y) * side.y;
    left = Math.min(left, across); right = Math.max(right, across);
  }
  const width = right - left;
  if (!Number.isFinite(width) || width <= 0) return null;
  // Sports bases are 121–131 px across. The shaft is only a little longer than the base.
  const shaftLength = width * (putting ? 1.1 : 1.25);
  const grip = frontPoint(footprint, 1);
  if (!Number.isFinite(grip.x) || !Number.isFinite(grip.y)) return null;
  return {
    grip,
    head: { x: grip.x + forward.x * shaftLength, y: grip.y + forward.y * shaftLength },
    facingRadians,
    shaftLength,
    shaftWidth: width * 0.028,
    gripLength: shaftLength * 0.23,
    gripWidth: width * 0.052,
    headWidth: width * (putting ? 0.23 : 0.21),
    headDepth: width * (putting ? 0.085 : 0.105),
  };
}

/** Draw on the native 1920×1080 surface. The caller restores its portrait transform afterwards. */
export function drawPieceClub(ctx: CanvasRenderingContext2D, footprint: Footprint | null, putting = false): void {
  const club = pieceClubGeometry(footprint, putting);
  if (!club) return;
  ctx.save();
  ctx.translate(club.grip.x, club.grip.y);
  ctx.rotate(club.facingRadians);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#8B9F98'; ctx.lineWidth = club.shaftWidth + 1.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(club.shaftLength, 0); ctx.stroke();
  ctx.strokeStyle = '#E2E9E4'; ctx.lineWidth = club.shaftWidth * 0.55;
  ctx.beginPath(); ctx.moveTo(0, -club.shaftWidth * 0.17); ctx.lineTo(club.shaftLength, -club.shaftWidth * 0.17); ctx.stroke();
  ctx.strokeStyle = '#23352F'; ctx.lineWidth = club.gripWidth;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(club.gripLength, 0); ctx.stroke();
  ctx.translate(club.shaftLength, 0);
  const half = club.headWidth / 2, depth = club.headDepth;
  ctx.fillStyle = '#52665D';
  if (putting) {
    ctx.fillRect(-depth / 2, -half, depth, club.headWidth);
    ctx.fillStyle = '#E0E7DD'; ctx.fillRect(-depth / 2, -half, depth * 0.4, club.headWidth);
  } else {
    ctx.beginPath(); ctx.moveTo(-depth * 0.4, -half * 0.75);
    ctx.lineTo(depth * 0.35, -half); ctx.lineTo(depth * 0.65, half * 0.65);
    ctx.lineTo(depth * 0.3, half); ctx.lineTo(-depth * 0.4, half * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E0E7DD';
    ctx.beginPath(); ctx.moveTo(-depth * 0.4, -half * 0.75); ctx.lineTo(0, -half * 0.88);
    ctx.lineTo(depth * 0.2, half * 0.86); ctx.lineTo(-depth * 0.4, half * 0.8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
