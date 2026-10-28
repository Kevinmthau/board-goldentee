/** A rigid quarter turn puts the player at Board's left short edge.
 * The native canvas and native contacts stay in their original 1920×1080 units. */
export const PORTRAIT = { width: 1080, height: 1920 } as const;
export function toPortrait(p: { x: number; y: number }) { return { x: p.y, y: 1920 - p.x }; }
export function toNative(p: { x: number; y: number }) { return { x: 1920 - p.y, y: p.x }; }
export function portraitFacing(degrees: number) { return (degrees + 270) % 360; }
export function drawPortrait(ctx: CanvasRenderingContext2D) { ctx.setTransform(0, 1, -1, 0, 1920, 0); }
export function isPiecePlacement(native: { x: number; y: number }) {
  const p = toPortrait(native);
  // Leave room for the physical footprint above the two club rows and beside the aim buttons.
  const clearOfAim = p.y < 1250 || (p.x >= 300 && p.x <= 780);
  return p.x >= 140 && p.x <= 940 && p.y >= 400 && p.y <= 1430 && clearOfAim;
}
