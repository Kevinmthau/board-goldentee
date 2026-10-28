/** Authored coastal course. Distances and terrain coordinates are in yards. */
export interface Ellipse { x: number; z: number; rx: number; rz: number }
/** Broad, smooth swells. Amplitudes and wavelengths use yards; tilt is rise/run. */
export interface GreenShape {
  tiltX: number;
  tiltZ: number;
  swellX: number;
  swellZ: number;
  wavelengthX: number;
  wavelengthZ: number;
  phaseX: number;
  phaseZ: number;
}
export interface Hole {
  id: string;
  name: string;
  par: number;
  maxStrokes: number;
  tee: { x: number; z: number };
  flag: { x: number; z: number };
  green: Ellipse;
  greenShape: GreenShape;
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

const duneBunkers = [
  { x: -33, z: 236, rx: 10, rz: 18 },
  { x: 23, z: 359, rx: 10, rz: 14 },
  { x: -24, z: 387, rx: 10, rz: 12 },
];
const gullBunkers = [
  { x: 23, z: 163, rx: 10, rz: 13 },
  { x: -25, z: 185, rx: 10, rz: 11 },
];
const heronBunkers = [
  { x: 34, z: 233, rx: 10, rz: 18 },
  { x: -25, z: 494, rx: 11, rz: 15 },
  { x: 25, z: 539, rx: 10, rz: 14 },
];
const cypressBunkers = [
  { x: 41, z: 257, rx: 11, rz: 18 },
  { x: 23, z: 371, rx: 10, rz: 14 },
  { x: -23, z: 398, rx: 10, rz: 13 },
];
const breakwaterBunkers = [
  { x: 34, z: 232, rx: 10, rz: 16 },
  { x: -23, z: 303, rx: 10, rz: 13 },
  { x: 25, z: 332, rx: 10, rz: 12 },
];
const lighthouseBunkers = [
  { x: -32, z: 242, rx: 11, rz: 18 },
  { x: -24, z: 388, rx: 10, rz: 15 },
  { x: 25, z: 420, rx: 11, rz: 13 },
];

export const HOLES: readonly Hole[] = [
  {
    id: "seabreeze", name: "Seabreeze", par: 3, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 150 },
    green: { x: 0, z: 150, rx: 24, rz: 20 },
    greenShape: { tiltX: .012, tiltZ: .006, swellX: .10, swellZ: .08, wavelengthX: 32, wavelengthZ: 28, phaseX: .4, phaseZ: 1.2 },
    bunker: seabreezeBunker, bunkers: [seabreezeBunker], water: [],
    bounds: { left: -58, right: 58, near: -12, far: 190 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 19 }, { x: 5, z: 70, width: 24 }, { x: -1, z: 150, width: 19 }],
  },
  {
    id: "lagoon-bend", name: "Lagoon Bend", par: 4, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 340 },
    green: { x: 0, z: 340, rx: 22, rz: 21 },
    greenShape: { tiltX: -.018, tiltZ: .008, swellX: .16, swellZ: .12, wavelengthX: 30, wavelengthZ: 36, phaseX: 1.6, phaseZ: .3 },
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
    greenShape: { tiltX: .008, tiltZ: -.016, swellX: .18, swellZ: .16, wavelengthX: 38, wavelengthZ: 32, phaseX: .7, phaseZ: 2.2 },
    bunker: pelicanBunkers[0], bunkers: pelicanBunkers,
    water: [{ x: 0, z: 170, rx: 29, rz: 27 }, { x: 34, z: 385, rx: 23, rz: 42 }],
    bounds: { left: -78, right: 78, near: -12, far: 555 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 25 }, { x: -9, z: 110, width: 29 },
      { x: -24, z: 175, width: 30 }, { x: 0, z: 250, width: 30 },
      { x: -8, z: 370, width: 29 }, { x: -3, z: 450, width: 26 }, { x: 0, z: 510, width: 23 }],
  },

  {
    id: "dune-crossing", name: "Dune Crossing", par: 4, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 375 },
    green: { x: 0, z: 375, rx: 24, rz: 22 },
    greenShape: { tiltX: -.01, tiltZ: -.012, swellX: .20, swellZ: .13, wavelengthX: 36, wavelengthZ: 28, phaseX: 2.4, phaseZ: 1.3 },
    bunker: duneBunkers[0], bunkers: duneBunkers,
    water: [{ x: 35, z: 185, rx: 22, rz: 38 }],
    bounds: { left: -76, right: 76, near: -12, far: 420 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 25 }, { x: -10, z: 115, width: 27 },
      { x: -16, z: 205, width: 29 }, { x: -5, z: 280, width: 28 }, { x: 0, z: 375, width: 24 }],
  },
  {
    id: "gull-cove", name: "Gull Cove", par: 3, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 175 },
    green: { x: 0, z: 175, rx: 23, rz: 22 },
    greenShape: { tiltX: .018, tiltZ: .004, swellX: .12, swellZ: .19, wavelengthX: 30, wavelengthZ: 34, phaseX: 1.1, phaseZ: 2.6 },
    bunker: gullBunkers[0], bunkers: gullBunkers,
    water: [{ x: 0, z: 92, rx: 27, rz: 24 }],
    bounds: { left: -74, right: 74, near: -12, far: 220 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 23 }, { x: -18, z: 55, width: 27 },
      { x: -39, z: 94, width: 22 }, { x: -15, z: 135, width: 26 }, { x: 0, z: 175, width: 23 }],
  },
  {
    id: "heron-marsh", name: "Heron Marsh", par: 5, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 530 },
    green: { x: 0, z: 530, rx: 25, rz: 23 },
    greenShape: { tiltX: -.012, tiltZ: .018, swellX: .21, swellZ: .15, wavelengthX: 38, wavelengthZ: 36, phaseX: 2.8, phaseZ: .7 },
    bunker: heronBunkers[0], bunkers: heronBunkers,
    water: [{ x: -32, z: 294, rx: 23, rz: 42 }, { x: 35, z: 424, rx: 22, rz: 38 }],
    bounds: { left: -84, right: 84, near: -12, far: 575 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 26 }, { x: -7, z: 130, width: 29 },
      { x: 12, z: 245, width: 31 }, { x: 10, z: 325, width: 29 },
      { x: -12, z: 420, width: 30 }, { x: 0, z: 530, width: 25 }],
  },
  {
    id: "cypress-turn", name: "Cypress Turn", par: 4, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 390 },
    green: { x: 0, z: 390, rx: 22, rz: 22 },
    greenShape: { tiltX: .02, tiltZ: -.01, swellX: .15, swellZ: .19, wavelengthX: 28, wavelengthZ: 34, phaseX: .2, phaseZ: 1.8 },
    bunker: cypressBunkers[0], bunkers: cypressBunkers,
    water: [{ x: -35, z: 220, rx: 21, rz: 36 }],
    bounds: { left: -78, right: 82, near: -12, far: 435 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 24 }, { x: 18, z: 120, width: 28 },
      { x: 21, z: 220, width: 29 }, { x: 9, z: 300, width: 27 }, { x: 0, z: 390, width: 22 }],
  },
  {
    id: "breakwater", name: "Breakwater", par: 4, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 320 },
    green: { x: 0, z: 320, rx: 24, rz: 22 },
    greenShape: { tiltX: -.016, tiltZ: -.004, swellX: .18, swellZ: .18, wavelengthX: 34, wavelengthZ: 30, phaseX: 1.8, phaseZ: 2.9 },
    bunker: breakwaterBunkers[0], bunkers: breakwaterBunkers,
    water: [{ x: 0, z: 140, rx: 28, rz: 27 }, { x: -42, z: 263, rx: 18, rz: 28 }],
    bounds: { left: -80, right: 80, near: -12, far: 365 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 24 }, { x: 17, z: 80, width: 27 },
      { x: 40, z: 140, width: 23 }, { x: 15, z: 200, width: 29 },
      { x: 1, z: 265, width: 28 }, { x: 0, z: 320, width: 24 }],
  },
  {
    id: "lighthouse", name: "Lighthouse", par: 4, maxStrokes: 10,
    tee: { x: 0, z: 0 }, flag: { x: 0, z: 410 },
    green: { x: 0, z: 410, rx: 23, rz: 22 },
    greenShape: { tiltX: .01, tiltZ: .016, swellX: .20, swellZ: .16, wavelengthX: 32, wavelengthZ: 36, phaseX: 2.5, phaseZ: .5 },
    bunker: lighthouseBunkers[0], bunkers: lighthouseBunkers,
    water: [{ x: 34, z: 305, rx: 23, rz: 39 }],
    bounds: { left: -80, right: 80, near: -12, far: 455 }, cupRadius: 0.85,
    fairway: [{ x: 0, z: 0, width: 25 }, { x: -13, z: 135, width: 29 },
      { x: 9, z: 225, width: 30 }, { x: -10, z: 305, width: 27 }, { x: 0, z: 410, width: 23 }],
  },
];
/** Compatibility alias: old single-hole saves and callers start on Seabreeze. */
export const HOLE = HOLES[0];
