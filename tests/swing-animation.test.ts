import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FULL_IMPACT_SECONDS, PUTT_IMPACT_SECONDS, SWING_TIMING, SwingAnimation } from '../src/swing-animation';

const near = (a: number, b: number, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('held backswing eases to its top and stays there without striking', () => {
  const animation = new SwingAnimation();
  const halfway = animation.update(0.225, true);
  near(halfway.windup, 0.5);
  assert.equal(halfway.impact, false);
  assert.equal(animation.update(0.225, true).windup, 1);
  assert.equal(animation.update(0.5, true).windup, 1);
  assert.equal(animation.pose.phase, 'backswing');
});

test('canceling a partial backswing returns smoothly to address', () => {
  const animation = new SwingAnimation();
  const before = animation.update(0.225, true).windup;
  const first = animation.update(0.001, false);
  assert.ok(first.windup < before && first.windup > before - 0.001, 'cancel must not snap the arms to address');
  const final = animation.update(SWING_TIMING.returnToAddress, false);
  assert.equal(final.windup, 0);
  assert.equal(final.phase, 'address');
  assert.equal(final.impact, false);
});

test('a strike during a tiny backswing starts from its exact pose without a forced windup', () => {
  const animation = new SwingAnimation();
  const before = animation.update(0.01, true).windup;
  assert.ok(before > 0 && before < 0.01);
  assert.equal(animation.strike(), true);
  near(animation.pose.windup, before);
  near(animation.update(0, false).windup, before);
  assert.ok(animation.update(0.01, false).windup < before);
});

test('downswing accelerates and reaches impact exactly at 140 milliseconds', () => {
  const animation = new SwingAnimation();
  animation.update(0.45, true); animation.strike();
  const firstHalf = animation.update(FULL_IMPACT_SECONDS / 2, false).windup;
  near(firstHalf, 0.875);
  assert.equal(animation.update(FULL_IMPACT_SECONDS / 2 - 0.001, false).impact, false);
  const impact = animation.update(0.001, false);
  assert.equal(impact.impact, true);
  near(impact.windup, 0);
  near(impact.followThrough, 0);
  assert.equal(impact.phase, 'followThrough');
  assert.equal(animation.update(0.01, false).impact, false);
});

test('follow-through eases to a held finish and produces only one impact', () => {
  const animation = new SwingAnimation();
  animation.update(0.45, true); animation.strike();
  let impacts = 0;
  let lastFollow = 0;
  for (let i = 0; i < 180; i++) {
    const pose = animation.update(1 / 120, false);
    if (pose.impact) impacts += 1;
    assert.ok(pose.followThrough >= lastFollow);
    lastFollow = pose.followThrough;
  }
  assert.equal(impacts, 1);
  assert.equal(animation.pose.phase, 'finish');
  assert.equal(animation.pose.followThrough, 1);
  assert.equal(animation.pose.finished, true);
  near(animation.pose.strokeElapsed, 0.59);
  assert.equal(animation.strike(), false, 'an active stroke cannot be restarted by repeated input');
  animation.reset();
  assert.equal(animation.pose.phase, 'address');
  assert.equal(animation.strike(), true);
});

test('putting uses its own impact and shorter follow-through timing', () => {
  const animation = new SwingAnimation();
  animation.update(0.2, true, true); animation.strike(true);
  assert.equal(animation.update(PUTT_IMPACT_SECONDS - 0.001, false, true).impact, false);
  assert.equal(animation.update(0.001, false, true).impact, true);
  const final = animation.update(SWING_TIMING.puttFollowThrough, false, true);
  assert.equal(final.finished, true);
  near(final.strokeElapsed, 0.42);
});

test('paused time and invalid deltas cannot advance or cancel a swing', () => {
  const animation = new SwingAnimation();
  animation.update(0.225, true);
  const before = { ...animation.pose };
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) assert.deepEqual(animation.update(dt, false), before);
  animation.strike(); animation.update(0.05, false);
  const moving = { ...animation.pose };
  for (let i = 0; i < 100; i++) assert.deepEqual(animation.update(0, false), moving);
  assert.equal(animation.update(0.09, false).impact, true, 'resume consumes only active game time');
});

test('frame rates produce the same pose along the complete animation', () => {
  const run = (fps: number) => {
    const animation = new SwingAnimation();
    const advance = (seconds: number, held: boolean) => {
      let remaining = seconds;
      while (remaining > 1e-10) { const dt = Math.min(1 / fps, remaining); animation.update(dt, held); remaining -= dt; }
    };
    advance(0.2, true); animation.strike(); advance(0.31, false);
    return animation.pose;
  };
  const reference = run(30);
  for (const fps of [60, 120, 144]) {
    const pose = run(fps);
    near(pose.windup, reference.windup);
    near(pose.followThrough, reference.followThrough);
    near(pose.strokeElapsed, reference.strokeElapsed);
    assert.equal(pose.phase, reference.phase);
  }
});

test('a bounded large update crosses impact once and resolves to a finite finish', () => {
  const animation = new SwingAnimation();
  animation.update(0.45, true); animation.strike();
  const first = animation.update(1e12, false);
  assert.equal(first.impact, true);
  assert.equal(first.finished, true);
  assert.ok([first.windup, first.followThrough, first.strokeElapsed].every(Number.isFinite));
  assert.equal(animation.update(1e12, false).impact, false);
});
