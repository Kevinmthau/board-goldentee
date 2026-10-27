import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALL_POSITION, CLUB_LENGTH, RIG_LENGTHS, sampleGolferRig, type Vec3 } from '../src/golfer-rig';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('full and putting address contact the same ball with two hands attached to one rigid club', () => {
  for (const putting of [false, true]) {
    const rig = sampleGolferRig(0, 0, putting);
    near(distance(rig.club.head, BALL_POSITION), 0);
    near(distance(rig.club.head, rig.club.grip), CLUB_LENGTH);
    near(distance(rig.joints.leadWrist, rig.joints.trailWrist), RIG_LENGTHS.handSeparation);
    assert.equal(rig.ball.x, 1, 'renderer uses the nonzero X coordinate to anchor the golf ball');
    assert.equal(rig.ball.z, 0);
    near(distance(rig.joints.neck, rig.joints.head), .155);
    assert.ok(rig.joints.head.y > 1.6 && rig.joints.head.y < 1.8);
  }
});

test('arms, legs and the club retain anatomical lengths throughout full and putting strokes', () => {
  for (const putting of [false, true]) for (const phase of ['back', 'follow']) {
    for (let i = 0; i <= 200; i++) {
      const rig = sampleGolferRig(phase === 'back' ? i / 200 : 0, phase === 'follow' ? i / 200 : 0, putting);
      const j = rig.joints;
      for (const [root, bend, end, upper, lower] of [
        [j.leadShoulder, j.leadElbow, j.leadWrist, RIG_LENGTHS.upperArm, RIG_LENGTHS.forearm],
        [j.trailShoulder, j.trailElbow, j.trailWrist, RIG_LENGTHS.upperArm, RIG_LENGTHS.forearm],
        [j.leadHip, j.leadKnee, j.leadAnkle, RIG_LENGTHS.thigh, RIG_LENGTHS.shin],
        [j.trailHip, j.trailKnee, j.trailAnkle, RIG_LENGTHS.thigh, RIG_LENGTHS.shin],
      ] as const) {
        near(distance(root, bend), upper); near(distance(bend, end), lower);
      }
      near(distance(rig.club.head, rig.club.grip), CLUB_LENGTH);
      for (const [wrist, sign] of [[j.leadWrist, -1], [j.trailWrist, 1]] as const) {
        const d = RIG_LENGTHS.handSeparation * sign / 2;
        near(wrist.x, rig.club.grip.x + rig.club.direction.x * d);
        near(wrist.y, rig.club.grip.y + rig.club.direction.y * d);
        near(wrist.z, rig.club.grip.z + rig.club.direction.z * d);
      }
      assert.ok(rig.club.head.y >= .024, 'the clubhead must leave the turf rather than pass beneath it');
    }
  }
});

test('joint trajectories remain continuous including tiny swings, impact and the held finish', () => {
  for (const putting of [false, true]) for (const phase of ['back', 'follow']) {
    let previous = sampleGolferRig(0, 0, putting);
    for (let i = 1; i <= 1000; i++) {
      const next = sampleGolferRig(phase === 'back' ? i / 1000 : 0, phase === 'follow' ? i / 1000 : 0, putting);
      for (const key of Object.keys(next.joints) as (keyof typeof next.joints)[]) {
        assert.ok(distance(next.joints[key], previous.joints[key]) < .007, `${phase} ${i}: ${key} jumped`);
      }
      assert.ok(distance(next.club.head, previous.club.head) < .008, 'rigid club follows one uninterrupted arc');
      previous = next;
    }
  }
  const tinyBack = sampleGolferRig(1e-7, 0), tinyFollow = sampleGolferRig(0, 1e-7);
  assert.ok(distance(tinyBack.club.head, tinyFollow.club.head) < .000002, 'impact has no minimum-pose snap');
  assert.deepEqual(sampleGolferRig(0, 1), sampleGolferRig(0, 1), 'a held finish has no hidden clock');
});

test('the lead foot and both toes stay planted while only the full-swing trailing heel lifts', () => {
  const address = sampleGolferRig(0, 0);
  for (let i = 0; i <= 20; i++) {
    const f = i / 20, full = sampleGolferRig(0, f), putt = sampleGolferRig(0, f, true);
    assert.deepEqual(full.joints.leadHeel, address.joints.leadHeel);
    assert.deepEqual(full.joints.leadToe, address.joints.leadToe);
    assert.deepEqual(full.joints.trailToe, address.joints.trailToe);
    assert.deepEqual(putt.joints.trailHeel, address.joints.trailHeel);
    near(distance(full.joints.trailHeel, full.joints.trailToe), .31);
    if (f <= .2) near(full.trailHeelLift, 0);
  }
  const finish = sampleGolferRig(0, 1);
  assert.ok(finish.trailHeelLift > .15);
  assert.ok(finish.joints.pelvis.z > address.joints.pelvis.z + .12, 'weight transfers toward the lead leg');
});

test('torso, pelvis and head frames remain orthonormal for solid mesh transforms', () => {
  for (let i = 0; i <= 40; i++) for (const rig of [sampleGolferRig(i / 40, 0), sampleGolferRig(0, i / 40)]) {
    for (const frame of [rig.torso, rig.pelvis, rig.head]) {
      near(dot(frame.forward, frame.forward), 1); near(dot(frame.up, frame.up), 1); near(dot(frame.side, frame.side), 1);
      near(dot(frame.forward, frame.up), 0); near(dot(frame.forward, frame.side), 0); near(dot(frame.up, frame.side), 0);
    }
  }
});

test('nonfinite inputs cannot poison rendering and out-of-range inputs clamp to valid poses', () => {
  for (const value of [NaN, Infinity, -Infinity, -1]) assert.deepEqual(sampleGolferRig(value, value), sampleGolferRig(0, 0));
  assert.deepEqual(sampleGolferRig(100, 0), sampleGolferRig(1, 0));
  assert.deepEqual(sampleGolferRig(0, 100), sampleGolferRig(0, 1));
  const tinyOverlap = sampleGolferRig(.6, 1e-7), held = sampleGolferRig(.6, 0);
  assert.ok(distance(tinyOverlap.club.head, held.club.head) < .000002, 'blended input does not switch between disconnected paths');
  const mutated = sampleGolferRig(0, 0); mutated.ball.x = 9; mutated.joints.head.y = 9;
  near(sampleGolferRig(0, 0).ball.x, 1);
});
