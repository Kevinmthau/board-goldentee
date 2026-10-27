import { createGame, type GolfState } from './rules';
export interface SavedRun { version: 1; playerId: string; game: GolfState }
/** Saves contain game state, never physical contacts or an unfinished swing. */
export function readRun(value: unknown, playerId: string): GolfState | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as SavedRun, g = run.game;
  if (run.version !== 1 || run.playerId !== playerId || !g || !g.ball || !g.lastSafe) return null;
  if (!['ready','flight','rolling','holed','limit'].includes(g.phase)) return null;
  if (!Number.isInteger(g.strokes) || g.strokes < 0 || g.strokes > 10) return null;
  if (![g.ball.x,g.ball.z,g.ball.y,g.ball.vx,g.ball.vz,g.ball.vy,g.lastSafe.x,g.lastSafe.z,g.shotPower,g.shotAngle].every(Number.isFinite)) return null;
  if (Math.abs(g.ball.x)>1000 || Math.abs(g.ball.z)>1000 || g.ball.y<0 || g.ball.y>1000) return null;
  return {...createGame(),...g,ball:{...g.ball},lastSafe:{...g.lastSafe}};
}
