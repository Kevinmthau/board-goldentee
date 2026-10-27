/** Golf uses yards for x/z and height. Input uses the Board's unscaled screen pixels. */
export type Phase = "ready" | "flight" | "rolling" | "holed" | "limit";
export type Terrain = "fairway" | "rough" | "bunker" | "green" | "out";
export type Club = "IRON" | "WEDGE" | "PUTTER";
export interface Shot { power: number; angle: number }
export interface Ball { x: number; z: number; y: number; vx: number; vz: number; vy: number }
export interface GolfState {
  ball: Ball;
  strokes: number;
  phase: Phase;
  lastSafe: { x: number; z: number };
  penalty: boolean;
  shotPower: number;
  shotAngle: number;
}

export const HOLE = {
  par: 3,
  maxStrokes: 10,
  tee: { x: 0, z: 0 },
  flag: { x: 0, z: 150 },
  green: { x: 0, z: 150, rx: 24, rz: 20 },
  bunker: { x: -20, z: 123, rx: 10, rz: 12 },
  bounds: { left: -58, right: 58, near: -12, far: 190 },
  cupRadius: 0.85,
} as const;

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

export function createGame(): GolfState {
  return {
    ball: { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0 },
    strokes: 0, phase: "ready", lastSafe: { ...HOLE.tee }, penalty: false, shotPower: 0, shotAngle: 0,
  };
}

export function terrainAt(x: number, z: number): Terrain {
  const b = HOLE.bounds;
  if (x < b.left || x > b.right || z < b.near || z > b.far) return "out";
  if (ellipseContains(x, z, HOLE.green)) return "green";
  if (ellipseContains(x, z, HOLE.bunker)) return "bunker";
  const center = Math.sin(z / 45) * 5;
  return Math.abs(x - center) <= 19 + Math.sin(clamp(z / 150, 0, 1) * Math.PI) * 5
    ? "fairway" : "rough";
}

export function distanceToCup(game: GolfState): number {
  return Math.hypot(HOLE.flag.x - game.ball.x, HOLE.flag.z - game.ball.z);
}

export function clubFor(game: GolfState): Club {
  if (terrainAt(game.ball.x, game.ball.z) === "green") return "PUTTER";
  return distanceToCup(game) <= 55 ? "WEDGE" : "IRON";
}

/** Angle is relative to the line from the ball to the cup: positive goes right. */
export function strike(game: GolfState, shot: Shot): boolean {
  if (game.phase !== "ready" || game.strokes >= HOLE.maxStrokes ||
      !Number.isFinite(shot.power) || !Number.isFinite(shot.angle)) return false;
  const power = clamp(shot.power, 0, 1);
  const direction = Math.atan2(HOLE.flag.x - game.ball.x, HOLE.flag.z - game.ball.z) + shot.angle;
  const terrain = terrainAt(game.ball.x, game.ball.z);
  const lie = terrain === "bunker" ? 0.58 : terrain === "rough" ? 0.76 : 1;
  const club = clubFor(game);
  const speed = club === "PUTTER" ? 1 + 14 * power :
    (club === "WEDGE" ? 4 + 16 * power : 6 + 36 * power) * lie;
  game.lastSafe = { x: game.ball.x, z: game.ball.z };
  game.ball.vx = Math.sin(direction) * speed;
  game.ball.vz = Math.cos(direction) * speed;
  game.ball.vy = club === "PUTTER" ? 0 : club === "WEDGE" ? 6 + 16 * power : 5 + 26 * power;
  game.ball.y = 0;
  game.strokes += 1;
  game.phase = club === "PUTTER" ? "rolling" : "flight";
  game.penalty = false;
  game.shotPower = power;
  game.shotAngle = shot.angle;
  return true;
}

function stopBall(game: GolfState): void {
  game.ball.vx = game.ball.vz = game.ball.vy = game.ball.y = 0;
}

function recoverOut(game: GolfState): void {
  game.strokes = Math.min(HOLE.maxStrokes, game.strokes + 1);
  game.ball.x = game.lastSafe.x;
  game.ball.z = game.lastSafe.z;
  stopBall(game);
  game.penalty = true;
  game.phase = game.strokes >= HOLE.maxStrokes ? "limit" : "ready";
}

function settleBall(game: GolfState): void {
  stopBall(game);
  game.lastSafe = { x: game.ball.x, z: game.ball.z };
  game.phase = game.strokes >= HOLE.maxStrokes ? "limit" : "ready";
}

function crossesCup(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax, dz = bz - az;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? clamp(((HOLE.flag.x - ax) * dx + (HOLE.flag.z - az) * dz) / length2, 0, 1) : 0;
  return Math.hypot(ax + dx * t - HOLE.flag.x, az + dz * t - HOLE.flag.z) <= HOLE.cupRadius;
}

/** Substeps prevent a fast ball tunnelling across the cup and keep frame rates equivalent. */
export function stepGame(game: GolfState, dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
  let remaining = Math.min(dtSeconds, 1);
  while (remaining > 1e-9 && (game.phase === "flight" || game.phase === "rolling")) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    const ball = game.ball;
    const oldX = ball.x, oldZ = ball.z;
    if (game.phase === "flight") {
      ball.x += ball.vx * dt;
      ball.z += ball.vz * dt;
      ball.y += ball.vy * dt - 9 * dt * dt;
      ball.vy -= 18 * dt;
      if (ball.y <= 0 && ball.vy < 0) {
        ball.y = ball.vy = 0;
        const landing = terrainAt(ball.x, ball.z);
        const retention = landing === "bunker" ? 0.1 : landing === "rough" ? 0.2 : 0.32;
        ball.vx *= retention;
        ball.vz *= retention;
        game.phase = "rolling";
      }
    } else {
      const terrain = terrainAt(ball.x, ball.z);
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
    if (terrainAt(ball.x, ball.z) === "out") { recoverOut(game); break; }
    if (game.phase === "rolling" && Math.hypot(ball.vx, ball.vz) <= 6 &&
        crossesCup(oldX, oldZ, ball.x, ball.z)) {
      ball.x = HOLE.flag.x;
      ball.z = HOLE.flag.z;
      stopBall(game);
      game.phase = "holed";
      break;
    }
  }
}

export function scoreLabel(strokes: number): string {
  if (strokes === 1) return "Hole in one";
  const over = strokes - HOLE.par;
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
