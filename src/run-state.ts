import { createGame, HOLES, PHYSICS_STEP_SECONDS, terrainAt, type GolfState } from './rules';
export interface SavedRun { version: 1; playerId: string; game: GolfState }
/** Saves contain game state, never physical contacts or an unfinished swing. */
export function readRun(value: unknown, playerId: string): GolfState | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as SavedRun, g = run.game;
  if (run.version !== 1 || run.playerId !== playerId || !g || !g.ball || !g.lastSafe) return null;
  // Original single-hole runs remain on Seabreeze, including shots already in flight.
  const holeIndex = g.holeIndex === undefined ? 0 : g.holeIndex;
  const completedStrokes = g.completedStrokes === undefined && holeIndex === 0 ? [] : g.completedStrokes;
  if (!Number.isInteger(holeIndex) || holeIndex < 0 || holeIndex >= HOLES.length) return null;
  if (!Array.isArray(completedStrokes) || completedStrokes.length !== holeIndex ||
      !completedStrokes.every((strokes, i) => Number.isInteger(strokes) && strokes >= 1 && strokes <= HOLES[i].maxStrokes)) return null;
  const hole = HOLES[holeIndex];
  if (!['ready','flight','rolling','holed','limit'].includes(g.phase)) return null;
  if (!Number.isInteger(g.strokes) || g.strokes < 0 || g.strokes > hole.maxStrokes) return null;
  if ((g.phase === 'flight' || g.phase === 'rolling' || g.phase === 'holed') && g.strokes === 0) return null;
  if (g.phase === 'limit' && g.strokes !== hole.maxStrokes) return null;
  if (g.phase === 'ready' && g.strokes >= hole.maxStrokes) return null;
  if (g.phase === 'holed' && (g.ball.x !== hole.flag.x || g.ball.z !== hole.flag.z ||
      g.ball.y !== 0 || g.ball.vx !== 0 || g.ball.vz !== 0 || g.ball.vy !== 0)) return null;
  if (typeof g.penalty !== 'boolean') return null;
  const penaltyKind = g.penaltyKind === undefined ? (g.penalty ? 'out' : null) : g.penaltyKind;
  if (penaltyKind !== null && penaltyKind !== 'out' && penaltyKind !== 'water') return null;
  if (g.penalty !== (penaltyKind !== null)) return null;
  if (![g.ball.x,g.ball.z,g.ball.y,g.ball.vx,g.ball.vz,g.ball.vy,g.lastSafe.x,g.lastSafe.z,g.shotPower,g.shotAngle].every(Number.isFinite)) return null;
  if (Math.abs(g.ball.x)>1000 || Math.abs(g.ball.z)>1000 || g.ball.y<0 || g.ball.y>1000) return null;
  const safeTerrain = terrainAt(g.lastSafe.x, g.lastSafe.z, hole);
  if (safeTerrain === 'out' || safeTerrain === 'water') return null;
  // Earlier version-1 runs did not retain a fractional physics step.
  const stepRemainder = g.stepRemainder === undefined ? 0 : g.stepRemainder;
  if (!Number.isFinite(stepRemainder) || stepRemainder < 0 || stepRemainder >= PHYSICS_STEP_SECONDS) return null;
  return {...createGame(holeIndex, completedStrokes),...g,holeIndex,completedStrokes:[...completedStrokes],
    ball:{...g.ball},lastSafe:{...g.lastSafe},penaltyKind,stepRemainder};
}
