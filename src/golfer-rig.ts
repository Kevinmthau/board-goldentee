/** Pure anatomical pose sampling. Metres: +X faces the ball, +Y is up, +Z is the shot. */
export type Vec3 = { x: number; y: number; z: number };
export type RigFrame = { center: Vec3; forward: Vec3; up: Vec3; side: Vec3 };
export interface GolferRigPose {
  joints: {
    pelvis: Vec3; chest: Vec3; neck: Vec3; head: Vec3;
    leadShoulder: Vec3; trailShoulder: Vec3; leadElbow: Vec3; trailElbow: Vec3;
    leadWrist: Vec3; trailWrist: Vec3; leadHip: Vec3; trailHip: Vec3;
    leadKnee: Vec3; trailKnee: Vec3; leadAnkle: Vec3; trailAnkle: Vec3;
    leadFoot: Vec3; trailFoot: Vec3; leadToe: Vec3; trailToe: Vec3;
    leadHeel: Vec3; trailHeel: Vec3;
  };
  torso: RigFrame;
  pelvis: RigFrame;
  head: RigFrame;
  club: { grip: Vec3; head: Vec3; direction: Vec3; length: number };
  ball: Vec3;
  trailHeelLift: number;
}

export const BALL_POSITION: Readonly<Vec3> = Object.freeze({ x: 1, y: .025, z: 0 });
const ADDRESS_GRIP: Vec3 = { x: .46, y: .97, z: 0 };
export const CLUB_LENGTH = Math.hypot(BALL_POSITION.x - ADDRESS_GRIP.x, BALL_POSITION.y - ADDRESS_GRIP.y);
export const RIG_LENGTHS = { upperArm: .35, forearm: .34, thigh: .48, shin: .46, handSeparation: .064 } as const;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const unit = (v: Vec3) => mul(v, 1 / (length(v) || 1));
const blend = (a: Vec3, b: Vec3, t: number) => add(a, mul(sub(b, a), t));
const safe01 = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const smooth = (t: number) => t * t * (3 - 2 * t);
const UP: Vec3 = { x: 0, y: 1, z: 0 };
const SHAFT_AT_ADDRESS = unit(sub(BALL_POSITION, ADDRESS_GRIP));

function frame(center: Vec3, yaw: number, hinge: number): RigFrame {
  const facing = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  return { center, forward: add(mul(facing, Math.cos(hinge)), mul(UP, -Math.sin(hinge))),
    up: add(mul(UP, Math.cos(hinge)), mul(facing, Math.sin(hinge))),
    side: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) } };
}

function bezier(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return add(add(mul(a, u ** 3), mul(b, 3 * u * u * t)), add(mul(c, 3 * u * t * t), mul(d, t ** 3)));
}

/** Analytic two-bone IK. The pole chooses a stable anatomical bending plane. */
function bendJoint(root: Vec3, end: Vec3, pole: Vec3, upper: number, lower: number): Vec3 {
  const delta = sub(end, root), distance = Math.max(1e-7, length(delta)), direction = mul(delta, 1 / distance);
  let bend = sub(pole, mul(direction, dot(pole, direction)));
  if (length(bend) < 1e-6) bend = sub(UP, mul(direction, direction.y));
  if (length(bend) < 1e-6) bend = { x: 1, y: 0, z: 0 };
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return add(add(root, mul(direction, along)), mul(unit(bend), height));
}

/** Keep the common grip inside both arm reach spheres; never stretch a limb or detach a hand. */
function reachableGrip(proposed: Vec3, shaft: Vec3, lead: Vec3, trail: Vec3): Vec3 {
  let grip = proposed;
  const reach = RIG_LENGTHS.upperArm + RIG_LENGTHS.forearm - .003;
  for (let pass = 0; pass < 10; pass++) {
    for (const [shoulder, sign] of [[lead, -1], [trail, 1]] as const) {
      const wrist = add(grip, mul(shaft, sign * RIG_LENGTHS.handSeparation / 2));
      const offset = sub(wrist, shoulder), distance = length(offset);
      if (distance > reach) grip = add(grip, mul(offset, reach / distance - 1));
    }
  }
  return grip;
}

/**
 * Samples one solid golfer. Inputs are already eased by SwingAnimation; this has no clock.
 * (0, 0) is both address and exact impact. Lead means the left/target-side limb (+Z).
 * Both wrists stay on one rigid shaft. Putting uses the same contact position and a small
 * shoulder pendulum; a full swing turns the ribcage farther than the pelvis and transfers
 * weight onto the planted lead leg, lifting the trailing heel only after contact.
 */
export function sampleGolferRig(windup: number, followThrough: number, putting = false): GolferRigPose {
  const follow = safe01(followThrough), back = safe01(windup) * (1 - follow);
  const turnBack = smooth(back), turnFollow = smooth(follow), full = putting ? 0 : 1;
  const hipYaw = full * (.45 * turnBack - .98 * turnFollow);
  const chestYaw = full * (1.28 * turnBack - 1.58 * turnFollow);
  const hinge = .31 - full * .23 * turnFollow;
  const pelvisCenter = { x: -.015 + full * .025 * turnFollow, y: .98 + full * .025 * turnFollow,
    z: full * (-.045 * turnBack + .15 * turnFollow) };
  const pelvisFrame = frame(pelvisCenter, hipYaw, .035);
  const torso = frame(pelvisCenter, chestYaw, hinge);
  const chest = add(pelvisCenter, mul(torso.up, .34));
  const shoulderCenter = add(pelvisCenter, mul(torso.up, .50));
  const leadShoulder = add(add(shoulderCenter, mul(torso.side, .215)), { x: 0, y: .022, z: 0 });
  const trailShoulder = add(add(shoulderCenter, mul(torso.side, -.215)), { x: 0, y: -.022, z: 0 });
  const neck = add(shoulderCenter, mul(torso.up, .075));
  const headCenter = add(neck, mul(torso.up, .155));
  // Eyes stay on the contact point through impact, then turn gently with the finish.
  const headFrame = frame(headCenter, -.76 * full * smooth(Math.max(0, (follow - .3) / .7)), .43 - .15 * turnFollow);

  let proposedGrip: Vec3;
  let shaftAngle: number;
  if (putting) {
    const pendulum = .24 * (follow - back);
    proposedGrip = { x: ADDRESS_GRIP.x, y: ADDRESS_GRIP.y + .04 * (back * back + follow * follow), z: pendulum };
    shaftAngle = .20 * (follow - back);
  } else {
    const backGrip = bezier(ADDRESS_GRIP, { x: .60, y: 1.17, z: -.62 },
      { x: -.20, y: 1.59, z: -.82 }, { x: -.25, y: 1.72, z: -.42 }, back);
    const followGrip = bezier(ADDRESS_GRIP, { x: .60, y: 1.17, z: .62 },
      { x: -.20, y: 1.59, z: .82 }, { x: -.22, y: 1.73, z: .32 }, follow);
    proposedGrip = add(backGrip, sub(followGrip, ADDRESS_GRIP));
    shaftAngle = Math.PI * (1.45 * follow - 1.5 * back);
  }
  const shaft = { x: SHAFT_AT_ADDRESS.x * Math.cos(shaftAngle), y: SHAFT_AT_ADDRESS.y * Math.cos(shaftAngle), z: Math.sin(shaftAngle) };
  const grip = reachableGrip(proposedGrip, shaft, leadShoulder, trailShoulder);
  const leadWrist = add(grip, mul(shaft, -RIG_LENGTHS.handSeparation / 2));
  const trailWrist = add(grip, mul(shaft, RIG_LENGTHS.handSeparation / 2));
  const leadPole = add(add(mul(torso.forward, -.6), mul(torso.up, -.8)), mul(torso.side, .3));
  const trailPole = add(add(mul(torso.forward, -.55), mul(torso.up, -.85)), mul(torso.side, -.38));
  const leadElbow = bendJoint(leadShoulder, leadWrist, leadPole, RIG_LENGTHS.upperArm, RIG_LENGTHS.forearm);
  const trailElbow = bendJoint(trailShoulder, trailWrist, trailPole, RIG_LENGTHS.upperArm, RIG_LENGTHS.forearm);

  const leadHip = add(pelvisCenter, mul(pelvisFrame.side, .125));
  const trailHip = add(pelvisCenter, mul(pelvisFrame.side, -.125));
  const leadToe = { x: .18, y: .025, z: .235 }, leadHeel = { x: -.13, y: .025, z: .235 };
  const trailToe = { x: .18, y: .025, z: -.235 };
  const heelAngle = full * .60 * smooth(Math.max(0, (follow - .2) / .8));
  const trailHeelLift = .31 * Math.sin(heelAngle);
  const trailHeel = { x: trailToe.x - .31 * Math.cos(heelAngle), y: .025 + trailHeelLift, z: trailToe.z };
  const leadAnkle = { x: 0, y: .105, z: .235 };
  const trailAnkle = { x: trailToe.x - .18 * Math.cos(heelAngle), y: .105 + .18 * Math.sin(heelAngle), z: trailToe.z };
  const kneePole = add(mul(pelvisFrame.forward, 1), { x: 0, y: -.25, z: 0 });
  const leadKnee = bendJoint(leadHip, leadAnkle, kneePole, RIG_LENGTHS.thigh, RIG_LENGTHS.shin);
  const trailKnee = bendJoint(trailHip, trailAnkle, kneePole, RIG_LENGTHS.thigh, RIG_LENGTHS.shin);
  return {
    joints: { pelvis: pelvisCenter, chest, neck, head: headCenter, leadShoulder, trailShoulder,
      leadElbow, trailElbow, leadWrist, trailWrist, leadHip, trailHip, leadKnee, trailKnee,
      leadAnkle, trailAnkle, leadFoot: blend(leadHeel, leadToe, .5), trailFoot: blend(trailHeel, trailToe, .5),
      leadToe, trailToe, leadHeel, trailHeel },
    torso, pelvis: pelvisFrame, head: headFrame,
    club: { grip, head: add(grip, mul(shaft, CLUB_LENGTH)), direction: shaft, length: CLUB_LENGTH },
    ball: { ...BALL_POSITION }, trailHeelLift,
  };
}
