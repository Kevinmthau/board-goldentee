import { BoardPlayerType, type BoardPlayer } from '@board.fun/web-sdk';
import { advanceHole, createGame, isFinalHole, roundStrokes, type GolfState } from './rules';
import { readRun } from './run-state';

export const MAX_PLAYERS = 4;
export interface RoundPlayer {
  playerId: string;
  sessionId: number;
  name: string;
  type: BoardPlayerType;
  aiTypeIndex?: number;
  game: GolfState;
}
export interface GolfRound { players: RoundPlayer[]; activeIndex: number }
export interface SavedRound { version: 2; playerId: string; round: GolfRound }

type Identity = Pick<RoundPlayer, 'playerId' | 'sessionId' | 'type' | 'name' | 'aiTypeIndex'>;

/** Nonempty player IDs survive session changes; anonymous guests belong to their current session. */
export function golferKey(player: Identity): string {
  return player.playerId ? `${player.type}:id:${player.playerId}` : `${player.type}:session:${player.sessionId}`;
}

function identity(player: Identity): Omit<RoundPlayer, 'game'> {
  return {playerId: player.playerId, sessionId: player.sessionId, name: player.name, type: player.type,
    ...(player.aiTypeIndex !== undefined ? {aiTypeIndex: player.aiTypeIndex} : {})};
}

function validIdentity(player: unknown): player is Identity {
  if (!player || typeof player !== 'object') return false;
  const p = player as Identity;
  return typeof p.playerId === 'string' && typeof p.name === 'string' &&
    Number.isInteger(p.sessionId) && p.sessionId >= -1 &&
    [BoardPlayerType.Profile, BoardPlayerType.Guest, BoardPlayerType.AI].includes(p.type) &&
    (p.type !== BoardPlayerType.Profile || p.playerId.length > 0) &&
    (p.aiTypeIndex === undefined || (Number.isInteger(p.aiTypeIndex) && p.aiTypeIndex >= 0));
}

function uniquePlayers(players: Identity[]): boolean {
  return new Set(players.map(golferKey)).size === players.length &&
    new Set(players.map(p => p.sessionId)).size === players.length;
}

/** All players tee off on the same hole, with the same wind and their own ball and score. */
export function createRound(roster: readonly BoardPlayer[]): GolfRound {
  if (!roster.length || roster.length > MAX_PLAYERS || !roster.every(validIdentity) || !uniquePlayers([...roster])) {
    throw new RangeError('Choose one to four distinct roster players');
  }
  return {players: roster.map(player => ({...identity(player), game: createGame()})), activeIndex: 0};
}

export function activeGolfer(round: GolfRound): RoundPlayer { return round.players[round.activeIndex]; }
export function finishedHole(game: GolfState): boolean { return game.phase === 'holed' || game.phase === 'limit'; }
export function holeComplete(round: GolfRound): boolean {
  return round.players.length > 0 && round.players.every(player => finishedHole(player.game));
}
export function roundComplete(round: GolfRound): boolean {
  return holeComplete(round) && round.players.every(player => isFinalHole(player.game));
}

/** Call after a shot settles. A false result leaves the turn unchanged; no shot or hole advances here. */
export function nextTurn(round: GolfRound): boolean {
  const phase = activeGolfer(round).game.phase;
  if (phase === 'flight' || phase === 'rolling') return false;
  for (let offset = 1; offset <= round.players.length; offset++) {
    const index = (round.activeIndex + offset) % round.players.length;
    if (!finishedHole(round.players[index].game)) { round.activeIndex = index; return true; }
  }
  return false;
}

/** A shared Next hole choice advances everybody together. Roster order determines tee order. */
export function advanceRoundHole(round: GolfRound): boolean {
  if (!holeComplete(round) || roundComplete(round)) return false;
  for (const player of round.players) advanceHole(player.game);
  round.activeIndex = 0;
  return true;
}

/** Ties are shared wins. Unfinished rounds have no winner. */
export function winners(round: GolfRound): RoundPlayer[] {
  if (!roundComplete(round)) return [];
  const best = Math.min(...round.players.map(player => roundStrokes(player.game)));
  return round.players.filter(player => roundStrokes(player.game) === best);
}

function copyGame(game: GolfState): GolfState {
  return {...game, completedStrokes: [...game.completedStrokes], ball: {...game.ball},
    lastSafe: {...game.lastSafe}, wind: {...game.wind}};
}

/** Save only roster identities, independent golf states, and the next turn. Never save gesture/contact state. */
export function saveRound(round: GolfRound, ownerPlayerId: string): SavedRound {
  return {version: 2, playerId: ownerPlayerId,
    round: {activeIndex: round.activeIndex, players: round.players.map(player => ({...identity(player), game: copyGame(player.game)}))}};
}

/** The platform's owner profile must match before either legacy or multiplayer progress can be restored. */
export function readRound(value: unknown, ownerPlayerId: string): GolfRound | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as SavedRound;
  if (run.playerId !== ownerPlayerId) return null;
  if ((value as {version: number}).version === 1) {
    const game = readRun(value, ownerPlayerId);
    return game ? {players: [{playerId: ownerPlayerId, sessionId: -1, name: '', type: BoardPlayerType.Profile, game}], activeIndex: 0} : null;
  }
  if (run.version !== 2 || !run.round || !Array.isArray(run.round.players)) return null;
  const {players, activeIndex} = run.round;
  if (players.length < 1 || players.length > MAX_PLAYERS || !Number.isInteger(activeIndex) ||
      activeIndex < 0 || activeIndex >= players.length || !players.every(validIdentity) || !uniquePlayers(players)) return null;
  const restored: RoundPlayer[] = [];
  for (const [index, player] of players.entries()) {
    const game = readRun({version: 1, playerId: player.playerId, game: player.game}, player.playerId);
    if (!game || (index !== activeIndex && (game.phase === 'flight' || game.phase === 'rolling'))) return null;
    if (restored.length && game.holeIndex !== restored[0].game.holeIndex) return null;
    restored.push({...identity(player), game});
  }
  const round = {players: restored, activeIndex};
  if (finishedHole(activeGolfer(round).game) && !holeComplete(round)) return null;
  return round;
}

/** Shared matching rule for refresh and for identifying roster seats that need replacement. */
export function sameGolfer(saved: Identity, current: Identity): boolean {
  if (saved.type !== current.type) return false;
  if (saved.playerId) return saved.playerId === current.playerId && saved.aiTypeIndex === current.aiTypeIndex;
  return saved.sessionId === current.sessionId && saved.playerId === current.playerId &&
    (saved.playerId.length > 0 || saved.name === current.name) && saved.aiTypeIndex === current.aiTypeIndex;
}

/** Refresh names and current session IDs atomically, never transfer scores to a replacement player. */
export function syncRoundRoster(round: GolfRound, roster: readonly BoardPlayer[]): boolean {
  const matches = round.players.map(saved => roster.find(current => sameGolfer(saved, current)));
  if (matches.some(player => !player) || new Set(matches.map(player => player!.sessionId)).size !== matches.length) return false;
  for (let i = 0; i < matches.length; i++) Object.assign(round.players[i], identity(matches[i]!));
  return true;
}

/**
 * After an explicit, named guest-restoration choice, bind that guest's saved score to the chosen seat.
 * Normal roster changes must use syncRoundRoster; they never call this reassignment helper.
 */
export function restoreGuestSeat(round: GolfRound, savedIndex: number, chosen: BoardPlayer): boolean {
  if (!Number.isInteger(savedIndex) || savedIndex < 0 || savedIndex >= round.players.length ||
      !validIdentity(chosen) || chosen.type !== BoardPlayerType.Guest || chosen.sessionId < 0) return false;
  const saved = round.players[savedIndex];
  if (saved.type !== BoardPlayerType.Guest || saved.playerId !== '') return false;
  if (round.players.some((other, index) => index !== savedIndex &&
      (other.sessionId === chosen.sessionId || sameGolfer(other, chosen)))) return false;
  delete saved.aiTypeIndex;
  Object.assign(saved, identity(chosen));
  return true;
}
