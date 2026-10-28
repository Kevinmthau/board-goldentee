import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CourseView } from '../src/course-view';
import { createGame } from '../src/rules';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('physical contact launches immediately at every frame rate and emits one impact', () => {
  for (const putting of [false, true]) for (const hz of [30, 60, 120, 144]) {
    const view = new CourseView(), game = createGame();
    view.reset(game); view.startStroke(game, putting);
    let ballTime = 0, impacts = 0;
    for (let frame = 0; frame < hz; frame++) {
      const result = view.advanceSwing(1 / hz, putting);
      ballTime += result.ballDt; impacts += Number(result.impact);
      assert.equal(result.putting, putting);
      if (frame === 0) {
        assert.equal(result.impact, true);
        near(result.ballDt, 1 / hz);
      }
    }
    assert.equal(impacts, 1); near(ballTime, 1);
  }
});

test('pause contributes no ball time and does not replay the physical impact sound', () => {
  const view = new CourseView(), game = createGame();
  view.reset(game); view.startStroke(game, false);
  for (let i = 0; i < 30; i++) assert.deepEqual(view.advanceSwing(0), {impact: false, putting: false, ballDt: 0});
  assert.deepEqual(view.advanceSwing(0.05), {impact: true, putting: false, ballDt: 0.05});
  for (let i = 0; i < 30; i++) assert.deepEqual(view.advanceSwing(0), {impact: false, putting: false, ballDt: 0});
  assert.deepEqual(view.advanceSwing(0.05), {impact: false, putting: false, ballDt: 0.05});
});

test('reset clears the prior hit so the next physical contact produces a new impact', () => {
  const view = new CourseView(), game = createGame();
  view.reset(game); view.startStroke(game, false); view.advanceSwing(0.8);
  view.reset(game);
  assert.deepEqual(view.advanceSwing(0.05), {impact: false, putting: false, ballDt: 0.05});
  view.startStroke(game, true);
  assert.deepEqual(view.advanceSwing(0.05), {impact: true, putting: true, ballDt: 0.05});
  assert.equal(view.advanceSwing(0.05).impact, false);
});

function renderHarness() {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previousDocument = globals.document, previousImage = globals.Image;
  const balls: {x: number; y: number}[] = [];
  let terrainPaints = 0;
  const context = (observe = false): CanvasRenderingContext2D => new Proxy({globalAlpha: 1} as Record<string, unknown>, {
    get(state, key: string) {
      if (key in state) return state[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({addColorStop() {}});
      if (key === 'createPattern') return () => ({});
      if (key === 'clearRect') return (_x: number, _y: number, width: number, height: number) => {
        if (!observe && width === 1080 && height === 1920) terrainPaints++;
      };
      if (key === 'arc') return (x: number, y: number) => {
        if (observe && state.fillStyle === '#FFFBEA') balls.push({x: x + 1, y: y + 1});
      };
      return () => {};
    },
    set(state, key: string, value) { state[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  globals.document = {createElement: () => ({width: 0, height: 0, getContext: () => context()})};
  globals.Image = class { set src(_src: string) {} };
  const ctx = context(true);
  return {
    get terrainPaints() { return terrainPaints; },
    draw(view: CourseView, game: ReturnType<typeof createGame>, dt = 1 / 60) {
      view.draw(ctx, game, 1000, dt);
      assert.ok(balls.length, 'the real renderer draws a ball');
      return balls.at(-1)!;
    },
    restore() {
      if (previousDocument === undefined) Reflect.deleteProperty(globals, 'document'); else globals.document = previousDocument;
      if (previousImage === undefined) Reflect.deleteProperty(globals, 'Image'); else globals.Image = previousImage;
    },
  };
}

test('address and backswing keep the ball and course fixed; the camera follows only after a hit', () => {
  const harness = renderHarness();
  try {
    const game = createGame(), view = new CourseView(); view.reset(game);
    const restingBall = harness.draw(view, game);
    const paints = harness.terrainPaints;
    for (const stage of ['settling', 'ready', 'backswing', 'settling'] as const) {
      view.setSwing(stage, stage === 'backswing' ? 150 : 0);
      for (let frame = 0; frame < 60; frame++) {
        assert.deepEqual(harness.draw(view, game), restingBall);
      }
    }
    assert.equal(harness.terrainPaints, paints, 'the static course does not reproject while addressing or turning');

    view.startStroke(game, false); game.phase = 'flight'; game.ball.z = 12; game.ball.y = 4;
    harness.draw(view, game);
    assert.equal(harness.terrainPaints, paints, 'contact begins before the chase camera departs');
    view.advanceSwing(0.5);
    harness.draw(view, game, 0.1);
    assert.ok(harness.terrainPaints > paints, 'the camera follows the flying ball after impact');
  } finally { harness.restore(); }
});
