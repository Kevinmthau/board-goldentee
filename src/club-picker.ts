import { CLUBS, type Club } from './rules';
import type { Box } from './howto';

/** Full-size controls leave the physical swing area open during play. */
export const CLUB_BAG_BUTTON: Box = { x: 48, y: 1590, width: 636, height: 130 };
export const CLUB_BAG_BACK: Box = { x: 340, y: 1680, width: 400, height: 130 };
export const CLUB_BOXES = CLUBS.map((club, i) => ({
  club,
  box: { x: 48 + (i % 3) * 336, y: 540 + Math.floor(i / 3) * 160, width: 312, height: 140 },
}));
export function clubDistanceLabel(club: typeof CLUBS[number]): string {
  return `${club.id === 'PUTTER' ? club.distanceYards * 3 : club.distanceYards} ${club.id === 'PUTTER' ? 'FT' : 'YD'}`;
}
export function aimStep(): number { return 2 * Math.PI / 180; }
export function aimLabel(angle: number): string {
  const degrees = Math.round(Math.abs(angle) * 180 / Math.PI * 100) / 100;
  return `${degrees === 0 ? '' : angle < 0 ? 'L ' : 'R '}${degrees}°`;
}
export function clubById(id: Club) { return CLUBS.find(club => club.id === id)!; }
