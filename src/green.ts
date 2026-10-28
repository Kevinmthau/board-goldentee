import type { Hole } from './holes';

export interface GreenSample {
  /** Ground elevation in yards; zero at the center and outside the green. */
  height: number;
  /** Rise/run in the course's x and z directions. */
  gradient: { x: number; z: number };
  /** Downhill acceleration in yards/second², shared by roll physics and arrows. */
  downhill: { x: number; z: number };
}

const GRAVITY_YARDS = 10.73;

/** One surface supplies the visible contours, break arrows, and ball acceleration. */
export function sampleGreen(x: number, z: number, hole: Hole): GreenSample {
  const dx = x - hole.green.x, dz = z - hole.green.z;
  const r2 = (dx / hole.green.rx) ** 2 + (dz / hole.green.rz) ** 2;
  if (r2 >= 1) return { height: 0, gradient: { x: 0, z: 0 }, downhill: { x: 0, z: 0 } };
  const shape = hole.greenShape;
  const kx = Math.PI * 2 / shape.wavelengthX, kz = Math.PI * 2 / shape.wavelengthZ;
  const ax = kx * dx + shape.phaseX, az = kz * dz + shape.phaseZ;
  const elevation = shape.tiltX * dx + shape.tiltZ * dz +
    shape.swellX * (Math.sin(ax) - Math.sin(shape.phaseX)) +
    shape.swellZ * (Math.sin(az) - Math.sin(shape.phaseZ));
  // The squared envelope joins the surrounding course with zero height and slope.
  const edge = 1 - r2, envelope = edge * edge;
  const gx = (shape.tiltX + shape.swellX * kx * Math.cos(ax)) * envelope -
    elevation * 4 * edge * dx / hole.green.rx ** 2;
  const gz = (shape.tiltZ + shape.swellZ * kz * Math.cos(az)) * envelope -
    elevation * 4 * edge * dz / hole.green.rz ** 2;
  const gravity = GRAVITY_YARDS / (1 + gx * gx + gz * gz);
  return {
    height: elevation * envelope,
    gradient: { x: gx, z: gz },
    downhill: { x: -gx * gravity, z: -gz * gravity },
  };
}
