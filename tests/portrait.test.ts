import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawPortrait, isPiecePlacement, portraitFacing, toNative, toPortrait } from '../src/portrait';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('native corners map to the full portrait scene from the left short edge', () => {
  for (const [native, portrait] of [
    [{ x: 0, y: 0 }, { x: 0, y: 1920 }],
    [{ x: 1920, y: 0 }, { x: 0, y: 0 }],
    [{ x: 1920, y: 1080 }, { x: 1080, y: 0 }],
    [{ x: 0, y: 1080 }, { x: 1080, y: 1920 }],
  ]) {
    assert.deepEqual(toPortrait(native), portrait);
    assert.deepEqual(toNative(portrait), native);
  }
});

test('portrait conversion is reversible and preserves native distances without scaling', () => {
  const points = [
    { x: 245, y: 540 }, { x: 960, y: 540 }, { x: 137.5, y: 999.125 },
    { x: 1860, y: 48 }, { x: 360, y: 700 },
  ];
  for (const a of points) {
    assert.deepEqual(toNative(toPortrait(a)), a);
    for (const b of points) {
      const pa = toPortrait(a), pb = toPortrait(b);
      near(Math.hypot(pa.x - pb.x, pa.y - pb.y), Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
});

test('the rendering transform is the inverse of portrait contact conversion', () => {
  let matrix: number[] = [];
  drawPortrait({ setTransform: (...values: number[]) => { matrix = values; } } as unknown as CanvasRenderingContext2D);
  assert.equal(matrix.length, 6);
  const [a, b, c, d, e, f] = matrix;
  for (const p of [{x: 0, y: 0}, {x: 1080, y: 1920}, {x: 540, y: 1675}]) {
    const expected = toNative(p);
    near(a * p.x + c * p.y + e, expected.x);
    near(b * p.x + d * p.y + f, expected.y);
  }
});

test('native Sports facing rotates with positions into the player’s portrait frame', () => {
  assert.equal(portraitFacing(0), 270, 'native right faces the flag from the left seat');
  assert.equal(portraitFacing(90), 0);
  assert.equal(portraitFacing(180), 90, 'native left faces the player');
  assert.equal(portraitFacing(270), 180);
  for (const degrees of [0, 17, 90, 135, 180, 270, 359]) {
    const angle = degrees * Math.PI / 180;
    const origin = { x: 245, y: 540 };
    const front = { x: origin.x + Math.cos(angle), y: origin.y + Math.sin(angle) };
    const po = toPortrait(origin), pf = toPortrait(front), converted = portraitFacing(degrees) * Math.PI / 180;
    near(pf.x - po.x, Math.cos(converted));
    near(pf.y - po.y, Math.sin(converted));
  }
});

test('Sports placement includes the native football location and a broad open course area', () => {
  assert.deepEqual(toPortrait({x: 535, y: 540}), {x: 540, y: 1385});
  assert.equal(isPiecePlacement({x: 535, y: 540}), true);
  // Actual rejected contact from the Board log: football player at portrait (301,1233).
  assert.deepEqual(toPortrait({x: 687, y: 301}), {x: 301, y: 1233});
  assert.equal(isPiecePlacement({x: 687, y: 301}), true);
  assert.equal(isPiecePlacement({x: 647, y: 306}), true, 'the observed drift during the football turn keeps its address');
  assert.equal(isPiecePlacement(toNative({x: 283, y: 1231})), true, 'a small move from the logged football placement stays playable');
  assert.equal(isPiecePlacement(toNative({x: 140, y: 400})), true);
  assert.equal(isPiecePlacement(toNative({x: 940, y: 1240})), true);
  assert.equal(isPiecePlacement(toNative({x: 540, y: 1430})), true);
  for (const point of [{x: 139, y: 1000}, {x: 941, y: 1000}, {x: 540, y: 399}, {x: 540, y: 1431},
    {x: 540, y: 1530}, {x: 144, y: 1400}, {x: 936, y: 1400}, {x: 540, y: 1805}, {x: 144, y: 1595}, {x: 936, y: 1595}]) {
    assert.equal(isPiecePlacement(toNative(point)), false, 'buttons and margins cannot bind a player');
  }
});
