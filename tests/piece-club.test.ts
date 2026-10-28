import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pieceClubGeometry, drawPieceClub } from '../src/piece-club';
import { frontPoint, pieceFootprint, type PieceFootprints } from '../src/piece-footprints';
import { toPortrait } from '../src/portrait';

const catalog = JSON.parse(readFileSync('public/piece-footprints.json', 'utf8')) as PieceFootprints;
const near = (a: number, b: number, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const distance = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y);
const pose = (glyphId: number, orientation = 0, x = 535, y = 540) => pieceFootprint(catalog, {glyphId, orientation, x, y})!;

test('every Sports club starts at its actual center front edge and extends outward', () => {
  for (let glyph = 1; glyph <= 8; glyph++) for (const facing of [0, 45, 90, 180, 270, 359]) {
    const footprint = pose(glyph, facing), club = pieceClubGeometry(footprint)!;
    const expectedGrip = frontPoint(footprint, 1);
    near(club.grip.x, expectedGrip.x); near(club.grip.y, expectedGrip.y);
    near(distance(club.grip, club.head), club.shaftLength);
    const toGrip = {x: club.grip.x - footprint.center.x, y: club.grip.y - footprint.center.y};
    near(toGrip.x * footprint.facing.y - toGrip.y * footprint.facing.x, 0);
    assert.ok(toGrip.x * footprint.facing.x + toGrip.y * footprint.facing.y > 0);
    near((club.head.x - club.grip.x) * footprint.facing.x + (club.head.y - club.grip.y) * footprint.facing.y, club.shaftLength);
  }
});

test('physical scale stays proportional and rigid through a full turn for all eight players', () => {
  for (let glyph = 1; glyph <= 8; glyph++) {
    const base = pieceClubGeometry(pose(glyph))!;
    assert.ok(base.shaftLength >= 145 && base.shaftLength <= 170, `${glyph}: ${base.shaftLength}`);
    assert.ok(base.headWidth >= 22 && base.headWidth <= 30);
    assert.ok(base.gripWidth >= 5 && base.gripWidth <= 7);
    assert.ok(base.shaftWidth >= 3 && base.shaftWidth <= 4);
    for (let angle = 0; angle < 360; angle += 15) {
      const rotated = pieceClubGeometry(pose(glyph, angle))!;
      near(rotated.shaftLength, base.shaftLength);
      near(rotated.headWidth, base.headWidth);
      near(distance(rotated.grip, rotated.head), base.shaftLength);
    }
  }
});

test('the putter uses the same front attachment with a shorter shaft and distinct head', () => {
  for (let glyph = 1; glyph <= 8; glyph++) {
    const footprint = pose(glyph, 143);
    const iron = pieceClubGeometry(footprint)!, putter = pieceClubGeometry(footprint, true)!;
    near(iron.grip.x, putter.grip.x); near(iron.grip.y, putter.grip.y);
    assert.ok(putter.shaftLength < iron.shaftLength);
    assert.ok(putter.shaftLength >= 125 && putter.shaftLength <= 150);
    assert.ok(putter.headWidth > iron.headWidth);
    assert.ok(putter.headDepth < iron.headDepth);
  }
});

test('angle wrap and movement preserve exact physical attachment in portrait view', () => {
  const before = pieceClubGeometry(pose(5, -1))!, after = pieceClubGeometry(pose(5, 359))!;
  near(before.grip.x, after.grip.x); near(before.grip.y, after.grip.y);
  near(before.head.x, after.head.x); near(before.head.y, after.head.y);
  const moved = pieceClubGeometry(pose(5, 359, 555, 510))!;
  near(moved.grip.x - after.grip.x, 20); near(moved.grip.y - after.grip.y, -30);
  near(moved.head.x - after.head.x, 20); near(moved.head.y - after.head.y, -30);
  const forward = pieceClubGeometry(pose(5, 0))!;
  const gripPortrait = toPortrait(forward.grip), headPortrait = toPortrait(forward.head);
  near(gripPortrait.x, headPortrait.x);
  assert.ok(headPortrait.y < gripPortrait.y, 'native facing zero extends toward the portrait flag');
});

test('no observed piece produces no club or canvas operations', () => {
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get() { assert.fail('a missing piece must not read the rendering context'); },
    set() { assert.fail('a missing piece must not write the rendering context'); },
  });
  assert.equal(pieceClubGeometry(null), null);
  drawPieceClub(ctx, null);
  drawPieceClub(ctx, null, true);
});


test('driver and 5 iron keep the front attachment with distinct proportional reach', () => {
  for (let glyph = 1; glyph <= 8; glyph++) for (const facing of [0, 90, 181, 359]) {
    const footprint = pose(glyph, facing);
    const iron = pieceClubGeometry(footprint, '7 IRON')!;
    const five = pieceClubGeometry(footprint, '5 IRON')!;
    const driver = pieceClubGeometry(footprint, 'DRIVER')!;
    for (const club of [five, driver]) {
      near(club.grip.x, iron.grip.x); near(club.grip.y, iron.grip.y);
      near(distance(club.grip, club.head), club.shaftLength);
      assert.ok(club.shaftLength > iron.shaftLength);
    }
    assert.ok(driver.shaftLength > five.shaftLength);
    assert.ok(driver.headWidth > five.headWidth);
    assert.ok(driver.headDepth > five.headDepth);
    assert.equal(driver.kind, 'driver'); assert.equal(five.kind, 'iron');
    assert.deepEqual(pieceClubGeometry(footprint, 'PUTTER'), pieceClubGeometry(footprint, true));
  }
});

test('new clubs disappear with a lifted piece', () => {
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get() { assert.fail('an absent piece cannot draw a driver or 5 iron'); },
    set() { assert.fail('an absent piece cannot draw a driver or 5 iron'); },
  });
  drawPieceClub(ctx, null, 'DRIVER');
  drawPieceClub(ctx, null, '5 IRON');
});
