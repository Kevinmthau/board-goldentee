import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GolferRenderer, type GolferPose } from '../src/golfer-renderer';

const pose: GolferPose = {
  footX: 500, footY: 740, ballX: 615, ballY: 733, scale: 1,
  windup: 0.5, followThrough: 0, putting: false, alpha: 1,
};

// A failed GPU renderer must leave the main canvas untouched for its Canvas fallback.
const untouchedCanvas = new Proxy({} as CanvasRenderingContext2D, {
  get() { throw new Error('The unavailable renderer must not draw to the course canvas'); },
  set() { throw new Error('The unavailable renderer must not change the course canvas'); },
});

function withGlobals(values: Record<string, unknown>, run: () => void) {
  const saved = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    run();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('golfer renderer requests Canvas fallback when WebGL is unavailable', () => {
  withGlobals({ WebGLRenderingContext: undefined, document: undefined }, () => {
    const renderer = new GolferRenderer();
    assert.equal(renderer.draw(untouchedCanvas, pose), false);
    assert.equal(renderer.draw(untouchedCanvas, { ...pose, windup: 1 }), false);
  });
});

test('golfer renderer requests Canvas fallback when the browser cannot create a WebGL context', () => {
  let requests = 0;
  withGlobals({
    WebGLRenderingContext: class {},
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: (kind: string) => { assert.equal(kind, 'webgl'); requests++; return null; },
      }),
    },
  }, () => {
    const renderer = new GolferRenderer();
    assert.equal(renderer.draw(untouchedCanvas, pose), false);
    assert.equal(renderer.draw(untouchedCanvas, { ...pose, followThrough: 0.5 }), false);
    assert.equal(requests, 1, 'GPU creation failure must not be retried every animation frame');
  });
});

test('a WebGL context creation exception falls back without interrupting later frames', () => {
  let requests = 0;
  withGlobals({
    WebGLRenderingContext: class {},
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => { requests++; throw new Error('GPU context creation failed'); },
      }),
    },
  }, () => {
    const renderer = new GolferRenderer();
    assert.equal(renderer.draw(untouchedCanvas, pose), false);
    assert.equal(renderer.draw(untouchedCanvas, { ...pose, windup: 0, followThrough: 0.5 }), false);
    assert.equal(requests, 1, 'a failing GPU must not throw again on each frame');
  });
});

test('a GPU setup exception falls back without retrying initialization each frame', () => {
  let requests = 0;
  withGlobals({
    WebGLRenderingContext: class {},
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => {
          requests++;
          return { createShader: () => { throw new Error('GPU shader allocation failed'); } };
        },
      }),
    },
  }, () => {
    const renderer = new GolferRenderer();
    assert.equal(renderer.draw(untouchedCanvas, pose), false);
    assert.equal(renderer.draw(untouchedCanvas, { ...pose, windup: 1 }), false);
    assert.equal(requests, 1);
  });
});
