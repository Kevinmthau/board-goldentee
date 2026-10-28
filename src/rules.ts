/** Golf uses yards for x/z and height. Input uses the Board's unscaled screen pixels. */
export type Phase = "ready" | "flight" | "rolling" | "holed" | "limit";
export type Terrain = "fairway" | "rough" | "bunker" | "green" | "water" | "out";
export type Club = "DRIVER" | "5 IRON" | "7 IRON" | "9 IRON" | "WEDGE" | "PUTTER";
/** Approximate full-shot total distance from a clean lie (putter distance is on the green). */
export const CLUBS: readonly { id: Club; label: string; distanceYards: number }[] = [
  { id: "DRIVER", label: "DRIVER", distanceYards: 250 },
  { id: "5 IRON", label: "5 IRON", distanceYards: 185 },
  { id: "7 IRON", label: "7 IRON", distanceYards: 150 },
  { id: "9 IRON", label: "9 IRON", distanceYards: 125 },
  { id: "WEDGE", label: "WEDGE", distanceYards: 60 },
  { id: "PUTTER", label: "PUTTER", distanceYards: 37 },
];
const CLUB_LAUNCH: Record<Club, { speedMin: number; speedGain: number; liftMin: number; liftGain: number }> = {
  "DRIVER": { speedMin: 8, speedGain: 47, liftMin: 5, liftGain: 30 },
  "5 IRON": { speedMin: 7, speedGain: 38, liftMin: 5, liftGain: 27 },
  "7 IRON": { speedMin: 6, speedGain: 33, liftMin: 5, liftGain: 24 },
  "9 IRON": { speedMin: 5, speedGain: 30, liftMin: 5, liftGain: 23 },
  "WEDGE": { speedMin: 4, speedGain: 17, liftMin: 6, liftGain: 17 },
  "PUTTER": { speedMin: 1, speedGain: 14, liftMin: 0, liftGain: 0 },
};
export interface Shot { power: number; angle: number }
export interface Ball { x: number; z: number; y: number; vx: number; vz: number; vy: number }
export interface GolfState {
  holeIndex: number;
  /** One entry per completed hole, excluding the current hole. */
  completedStrokes: number[];
  ball: Ball;
  strokes: number;
  phase: Phase;
  lastSafe: { x: number; z: number };
  penalty: boolean;
  penaltyKind: "water" | "out" | null;
  shotPower: number;
  shotAngle: number;
  /** Unsimulated active time, retained across frames and saves. */
  stepRemainder: number;
}

export const PHYSICS_STEP_SECONDS = 1 / 120;
const PHYSICS_TIME_EPSILON = 1e-12;

export interface Ellipse { x: number; z: number; rx: number; rz: number }
export interface Hole {
  id: string;
  name: string;
  par: number;
  maxStrokes: number;
  tee: { x: number; z: number };
  flag: { x: number; z: number };
  green: Ellipse;
  /** First bunker remains available for the original single-hole callers. */
  bunker: Ellipse;
  bunkers: readonly Ellipse[];
  water: readonly Ellipse[];
  bounds: { left: number; right: number; near: number; far: number };
  cupRadius: number;
  fairway: readonly { x: number; z: number; width: number }[];
}

const seabreezeBunker = { x: -20, z: 123, rx: 10, rz: 12 };
const lagoonBunkers = [
  { x: -21, z: 235, rx: 10, rz: 16 },
  { x: -22, z: 318, rx: 11, rz: 12 },
  { x: 24, z: 336, rx: 9, rz: 13 },
];
const pelicanBunkers = [
  { x: -24, z: 254, rx: 10, rz: 17 },
  { x: -23, z: 476, rx: 12, rz: 14 },
  { x: 24, z: 511, rx: 10, rz: 16 },
];
export const HOLES: readonly Hole[] = [
  {
    id: "seabreeze", name: "Seabreeze", par: 3, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 150 },
    green: { x: 0, z: 150, rx: 24, rz: 20 },
    bunker: seabreezeBunker, bunkers: [seabreezeBunker], water: [],
    bounds: { left: -58, right: 58, near: -12, far: 190 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 19 }, { x: 5, z: 70, width: 24 }, { x: -1, z: 150, width: 19 }],
  },
  {
    id: "lagoon-bend", name: "Lagoon Bend", par: 4, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 340 },
    green: { x: 0, z: 340, rx: 22, rz: 21 },
    bunker: lagoonBunkers[0], bunkers: lagoonBunkers,
    water: [{ x: -25, z: 148, rx: 23, rz: 37 }, { x: 35, z: 280, rx: 19, rz: 30 }],
    bounds: { left: -72, right: 72, near: -12, far: 385 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 24 }, { x: 12, z: 135, width: 27 },
      { x: 7, z: 245, width: 29 }, { x: -5, z: 300, width: 25 }, { x: 0, z: 340, width: 22 }],
  },
  {
    id: "pelican-reach", name: "Pelican Reach", par: 5, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 510 },
    green: { x: 0, z: 510, rx: 23, rz: 22 },
    bunker: pelicanBunkers[0], bunkers: pelicanBunkers,
    water: [{ x: 0, z: 170, rx: 29, rz: 27 }, { x: 34, z: 385, rx: 23, rz: 42 }],
    bounds: { left: -78, right: 78, near: -12, far: 555 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 25 }, { x: -9, z: 110, width: 29 },
      { x: -24, z: 175, width: 30 }, { x: 0, z: 250, width: 30 },
      { x: -8, z: 370, width: 29 }, { x: -3, z: 450, width: 26 }, { x: 0, z: 510, width: 23 }],
  },
];
/** Compatibility alias: old single-hole saves and callers start on Seabreeze. */
export const HOLE = HOLES[0];
export function holeFor(game: GolfState): Hole { return HOLES[game.holeIndex] ?? HOLE; }
export function isFinalHole(game: GolfState): boolean { return game.holeIndex === HOLES.length - 1; }
export function roundStrokes(game: GolfState): number {
  return game.completedStrokes.reduce((sum, strokes) => sum + strokes, game.strokes);
}
export function roundPar(game: GolfState): number {
  return HOLES.slice(0, game.holeIndex + 1).reduce((sum, hole) => sum + hole.par, 0);
}
/** The result screen waits for an explicit choice before calling this function. */
export function advanceHole(game: GolfState): boolean {
  if ((game.phase !== "holed" && game.phase !== "limit") || isFinalHole(game)) return false;
  Object.assign(game, createGame(game.holeIndex + 1, [...game.completedStrokes, game.strokes]));
  return true;
}

export const SWING = {
  settleMs: 300,
  restRadius: 12,
  backswingPx: 50,
  forwardPx: 40,
  minSpeed: 120,
  maxSpeed: 1400,
  freshMs: 160,
  sampleWindowMs: 100,
  maxAngle: Math.PI / 3,
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const ellipseContains = (x: number, z: number, e: { x: number; z: number; rx: number; rz: number }) =>
  ((x - e.x) / e.rx) ** 2 + ((z - e.z) / e.rz) ** 2 <= 1;

export function createGame(holeIndex = 0, completedStrokes: readonly number[] = []): GolfState {
  const hole = HOLES[holeIndex];
  if (!hole) throw new RangeError("Unknown golf hole");
  return {
    holeIndex, completedStrokes: [...completedStrokes],
    ball: { ...hole.tee, y: 0, vx: 0, vz: 0, vy: 0 },
    strokes: 0, phase: "ready", lastSafe: { ...hole.tee }, penalty: false, penaltyKind: null,
    shotPower: 0, shotAngle: 0, stepRemainder: 0,
  };
}

/** Fairway geometry is shared by collision and the course renderer. Width is the half-width. */
export function fairwayAt(z: number, hole: Hole = HOLE): { x: number; width: number } {
  if (hole.id === "seabreeze") {
    return { x: Math.sin(z / 45) * 5, width: 19 + Math.sin(clamp(z / 150, 0, 1) * Math.PI) * 5 };
  }
  const nodes = hole.fairway;
  if (z <= nodes[0].z) return { x: nodes[0].x, width: nodes[0].width };
  for (let i = 1; i < nodes.length; i++) {
    if (z <= nodes[i].z) {
      const a = nodes[i - 1], b = nodes[i], t = (z - a.z) / (b.z - a.z);
      return { x: a.x + (b.x - a.x) * t, width: a.width + (b.width - a.width) * t };
    }
  }
  const end = nodes[nodes.length - 1];
  return { x: end.x, width: end.width };
}

export function terrainAt(x: number, z: number, hole: Hole = HOLE): Terrain {
  const b = hole.bounds;
  if (x < b.left || x > b.right || z < b.near || z > b.far) return "out";
  if (hole.water.some(e => ellipseContains(x, z, e))) return "water";
  if (hole.bunkers.some(e => ellipseContains(x, z, e))) return "bunker";
  if (ellipseContains(x, z, hole.green)) return "green";
  const fairway = fairwayAt(z, hole);
  return Math.abs(x - fairway.x) <= fairway.width ? "fairway" : "rough";
}

export function distanceToCup(game: GolfState): number {
  const hole = holeFor(game);
  return Math.hypot(hole.flag.x - game.ball.x, hole.flag.z - game.ball.z);
}

export function clubFor(game: GolfState): Club {
  if (terrainAt(game.ball.x, game.ball.z, holeFor(game)) === "green") return "PUTTER";
  const distance = distanceToCup(game);
  return distance <= 55 ? "WEDGE" : distance <= 125 ? "9 IRON" : distance <= 155 ? "7 IRON" : distance <= 195 ? "5 IRON" : "DRIVER";
}

/** The selected club wins over the recommendation. Angle is relative to the cup: positive goes right. */
export function strike(game: GolfState, shot: Shot, club: Club = clubFor(game)): boolean {
  const hole = holeFor(game);
  if (game.phase !== "ready" || game.strokes >= hole.maxStrokes ||
      !Number.isFinite(shot.power) || !Number.isFinite(shot.angle) ||
      !CLUBS.some(option => option.id === club)) return false;
  const power = clamp(shot.power, 0, 1);
  const direction = Math.atan2(hole.flag.x - game.ball.x, hole.flag.z - game.ball.z) + shot.angle;
  const terrain = terrainAt(game.ball.x, game.ball.z, holeFor(game));
  const lie = terrain === "bunker" ? 0.58 : terrain === "rough" ? 0.76 : 1;
  const launch = CLUB_LAUNCH[club];
  const speed = (launch.speedMin + launch.speedGain * power) * (club === "PUTTER" ? 1 : lie);
  game.lastSafe = { x: game.ball.x, z: game.ball.z };
  game.ball.vx = Math.sin(direction) * speed;
  game.ball.vz = Math.cos(direction) * speed;
  game.ball.vy = launch.liftMin + launch.liftGain * power;
  game.ball.y = 0;
  game.strokes += 1;
  game.phase = club === "PUTTER" ? "rolling" : "flight";
  game.penalty = false;
  game.penaltyKind = null;
  game.shotPower = power;
  game.shotAngle = shot.angle;
  game.stepRemainder = 0;
  return true;
}

function stopBall(game: GolfState): void {
  game.ball.vx = game.ball.vz = game.ball.vy = game.ball.y = 0;
}

function recoverHazard(game: GolfState, kind: "out" | "water"): void {
  const hole = holeFor(game);
  game.strokes = Math.min(hole.maxStrokes, game.strokes + 1);
  game.ball.x = game.lastSafe.x;
  game.ball.z = game.lastSafe.z;
  stopBall(game);
  game.penalty = true;
  game.penaltyKind = kind;
  game.phase = game.strokes >= holeFor(game).maxStrokes ? "limit" : "ready";
}

function settleBall(game: GolfState): void {
  stopBall(game);
  game.lastSafe = { x: game.ball.x, z: game.ball.z };
  game.phase = game.strokes >= holeFor(game).maxStrokes ? "limit" : "ready";
}

function crossesCup(ax: number, az: number, bx: number, bz: number, hole: Hole): boolean {
  const dx = bx - ax, dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? clamp(((hole.flag.x - ax) * dx + (hole.flag.z - az) * dz) / length2, 0, 1) : 0;
  return Math.hypot(ax + dx * t - hole.flag.x, az + dz * t - hole.flag.z) <= hole.cupRadius;
}

/** Fixed steps make landing, terrain changes and cup capture independent of render timing. */
export function stepGame(game: GolfState, dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
  if (game.phase !== "flight" && game.phase !== "rolling") return;
  const hole = holeFor(game);
  let remaining = game.stepRemainder + Math.min(dtSeconds, 1);
  while (remaining + PHYSICS_TIME_EPSILON >= PHYSICS_STEP_SECONDS && (game.phase === "flight" || game.phase === "rolling")) {
    const dt = PHYSICS_STEP_SECONDS;
    remaining = Math.max(0, remaining - dt);
    const ball = game.ball;
    const oldX = ball.x, oldZ = ball.z;
    if (game.phase === "flight") {
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      ball.y += ball.vy * dt - 9 * dt * dt;
      ball.vy -= 18 * dt;
      if (ball.y <= 0 && ball.vy < 0) {
        ball.y = ball.vy = 0;
        const landing = terrainAt(ball.x, ball.z, hole);
        const retention = landing === "bunker" ? 0.1 : landing === "rough" ? 0.2 : 0.32;
        ball.vx *= retention;
        ball.vz *= retention;
        game.phase = "rolling";
      }
    } else {
      const terrain = terrainAt(ball.x, ball.z, hole);
      if (terrain === "water" || terrain === "out") { recoverHazard(game, terrain); break; }
      const friction = terrain === "green" ? 3 : terrain === "rough" ? 9 : terrain === "bunker" ? 18 : 4.2;
      const speed = Math.hypot(ball.vx, ball.vz);
      if (speed < 0.14) { settleBall(game); break; }
      const movingTime = Math.min(dt, speed / friction);
      const distance = speed * movingTime - 0.5 * friction * movingTime ** 2;
      ball.x += ball.vx / speed * distance;
      ball.z += ball.vz / speed * distance;
      const nextSpeed = Math.max(0, speed - friction * dt);
      ball.vx *= nextSpeed / speed;
      ball.vz *= nextSpeed / speed;
    }
    const surface = terrainAt(ball.x, ball.z, hole);
    if (surface === "out" || (surface === "water" && ball.y <= 0)) { recoverHazard(game, surface); break; }
    if (game.phase === "rolling" && Math.hypot(ball.vx, ball.vz) <= 6 &&
        crossesCup(oldX, oldZ, ball.x, ball.z, hole)) {
      ball.x = hole.flag.x;
      ball.z = hole.flag.z;
      stopBall(game);
      game.phase = "holed";
      break;
    }
  }
  // A completed shot must not donate its unused frame time to the next stroke.
  game.stepRemainder = (game.phase === "flight" || game.phase === "rolling") && remaining > PHYSICS_TIME_EPSILON ? remaining : 0;
}

export function scoreLabel(strokes: number, par = HOLE.par): string {
  if (strokes === 1) return "Hole in one";
  const over = strokes - par;
  if (over <= -3) return "Albatross";
  if (over <= -2) return "Eagle";
  if (over === -1) return "Birdie";
  if (over === 0) return "Par";
  if (over === 1) return "Bogey";
  if (over === 2) return "Double bogey";
  if (over === 3) return "Triple bogey";
  return `${over} over par`;
}

export interface SwingSample { x: number; y: number; time: number }
export interface SwingState {
  stage: "settling" | "ready" | "backswing" | "committed";
  anchor: { x: number; y: number } | null;
  peak: SwingSample | null;
  last: SwingSample | null;
  history: SwingSample[];
  restSince: number;
  power: number;
  forwardSamples: number;
}

export function createSwing(): SwingState {
  return { stage: "settling", anchor: null, peak: null, last: null, history: [], restSince: 0, power: 0, forwardSamples: 0 };
}

/** Call on pause, a real lift, a turn change, or once the previous ball has stopped. */
export function resetSwing(swing: SwingState): void {
  Object.assign(swing, createSwing());
}

/** Only fresh backward-then-forward movement emits a shot; placement is never a stroke. */
export function sampleSwing(swing: SwingState, sample: SwingSample): Shot | null {
  if (![sample.x, sample.y, sample.time].every(Number.isFinite) || swing.stage === "committed") return null;
  const last = swing.last;
  if (last && sample.time <= last.time) return null;
  if (last && (sample.time - last.time > SWING.freshMs ||
      Math.hypot(sample.x - last.x, sample.y - last.y) > 300)) resetSwing(swing);
  swing.last = { ...sample };
  if (!swing.anchor) {
    swing.anchor = { x: sample.x, y: sample.y };
    swing.restSince = sample.time;
    return null;
  }
  if (swing.stage === "settling") {
    if (Math.hypot(sample.x - swing.anchor.x, sample.y - swing.anchor.y) > SWING.restRadius) {
      swing.anchor = { x: sample.x, y: sample.y };
      swing.restSince = sample.time;
    } else if (sample.time - swing.restSince >= SWING.settleMs) {
      swing.stage = "ready";
    }
    return null;
  }
  if (swing.stage === "ready") {
    if (sample.y - swing.anchor.y >= SWING.backswingPx) {
      swing.stage = "backswing";
      swing.peak = { ...sample };
      swing.history = [{ ...sample }];
      swing.forwardSamples = 0;
    }
    return null;
  }
  if (!swing.peak) return null;
  if (sample.y >= swing.peak.y) {
    swing.peak = { ...sample };
    swing.history = [{ ...sample }];
    swing.power = 0;
    swing.forwardSamples = 0;
    return null;
  }
  if ((last && sample.y < last.y - 0.5) || (!last && sample.y < swing.peak.y - 0.5)) swing.forwardSamples += 1;
  else if (last && sample.y > last.y + 0.5) {
    swing.forwardSamples = 0;
    swing.history = [];
  }
  swing.history.push({ ...sample });
  while (swing.history.length > 2 && sample.time - swing.history[1].time > SWING.sampleWindowMs) swing.history.shift();
  const prior = swing.history[0];
  const elapsed = (sample.time - prior.time) / 1000;
  const forward = swing.peak.y - sample.y;
  const speed = elapsed > 0 ? Math.hypot(sample.x - prior.x, sample.y - prior.y) / elapsed : 0;
  swing.power = clamp((speed - SWING.minSpeed) / (SWING.maxSpeed - SWING.minSpeed), 0.05, 1);
  const angle = Math.atan2(sample.x - swing.peak.x, forward);
  if (forward >= SWING.forwardPx && speed >= SWING.minSpeed && elapsed >= 0.016 &&
      sample.y < prior.y && Math.abs(angle) <= SWING.maxAngle && swing.forwardSamples >= 2) {
    swing.stage = "committed";
    return { power: swing.power, angle };
  }
  return null;
}
