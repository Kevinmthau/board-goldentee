import {test} from 'node:test';
import assert from 'node:assert/strict';
import {windOnScreen} from '../src/wind-view';

test('wind arrows point where the ball drifts in the visible course', () => {
  assert.deepEqual(windOnScreen({x: 6, z: 0}, 0), {x: 6, y: -0});
  assert.deepEqual(windOnScreen({x: 0, z: 6}, 0), {x: 0, y: -6});
  const rotated = windOnScreen({x: 6, z: 0}, Math.PI / 2);
  assert.ok(Math.abs(rotated.x) < 1e-10);
  assert.equal(rotated.y, -6, 'a rightward wind becomes a tailwind when the camera faces right');
  const backward = windOnScreen({x: 0, z: 6}, Math.PI);
  assert.ok(Math.abs(backward.x) < 1e-10);
  assert.equal(backward.y, 6, 'the arrow reverses after the camera turns past the cup');
});
