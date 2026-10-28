import { test } from "node:test";
import assert from "node:assert/strict";
import { BoardContactPhase as Phase, BoardContactType as Type, type BoardContact } from "@board.fun/web-sdk";
import { PieceController, isSportsPiece, TURN_SWING } from "../src/piece-control";
import { createGame, strike, type Shot } from "../src/rules";

const contact = (id: number, orientation = 270, phase = Phase.Moved, glyphId = 5, x = 960, y = 800): BoardContact =>
  ({ contactId: id, x, y, phase, glyphId, orientation, type: Type.Glyph, isTouched: true });
function rig(towardPlayerDeg = 90, facingOffset = 0) {
  const controller = new PieceController({
    facingDeg: c => c.orientation + facingOffset,
    isPlacement: c => c.x >= 640 && c.x <= 1280 && c.y >= 720 && c.y <= 990,
    towardPlayerDeg,
  });
  const active = new Map<number, BoardContact>();
  controller.setEnabled(true);
  const frame = (now: number, ...batch: BoardContact[]) => {
    for (const c of batch) {
      if (c.phase === Phase.Ended || c.phase === Phase.Canceled) active.delete(c.contactId);
      else active.set(c.contactId, c);
    }
    return controller.update(batch, active, now);
  };
  const address = (id = 1, glyph = 5, angle = 270) => {
    frame(0, contact(id, angle, Phase.Began, glyph));
    controller.tick(300);
  };
  return { controller, active, frame, address };
}

test("all eight Sports players can address the ball; hands and unknown glyphs cannot", () => {
  for (let glyph = 1; glyph <= 8; glyph++) {
    const { controller, address } = rig();
    address(1, glyph);
    assert.equal(controller.piece?.glyphId, glyph);
    assert.equal(controller.swing.stage, "ready");
  }
  const { controller, frame } = rig();
  frame(0, contact(1, 270, Phase.Began, 9), { ...contact(2, 270, Phase.Began), type: Type.Hand });
  assert.equal(controller.piece, null);
  assert.equal(isSportsPiece(contact(1, 270, Phase.Began, 1.5)), false);
});

test("a new stable placement accepts any physical facing without creating a shot", () => {
  for (const facing of [0, 41, 90, 180, 270, 359]) {
    const { controller, frame } = rig();
    assert.equal(frame(0, contact(1, facing, Phase.Began)).shot, null);
    controller.tick(299);
    assert.equal(controller.swing.stage, "settling");
    assert.equal(controller.addressFacing, null);
    controller.tick(300);
    assert.equal(controller.swing.stage, "ready");
    assert.equal(controller.addressFacing, facing);
    assert.equal(frame(350, contact(1, facing, Phase.Stationary)).shot, null);
    assert.equal(controller.swing.power, 0);
  }
});

test("unarmed takeaway follows rotation and a 90-degree return twist fires once across 360", () => {
  const { controller, address, frame } = rig();
  address();
  assert.equal(frame(350, contact(1, 300)).shot, null);
  assert.equal(controller.swing.stage, "ready");
  assert.ok(controller.swing.windup > 0 && controller.swing.windup < 1);
  frame(400, contact(1, 330)); frame(450, contact(1, 359));
  assert.ok(controller.swing.power < 1, "89 degrees is still below full power");
  assert.equal(frame(500, contact(1, 0)).shot, null);
  assert.equal(controller.swing.stage, "backswing");
  assert.equal(controller.swing.power, 1);
  assert.equal(frame(540, contact(1, 345)).shot, null);
  assert.equal(frame(580, contact(1, 330)).shot, null, "reversing is not contact while the club is behind the piece");
  assert.equal(frame(620, contact(1, 300)).shot, null);
  assert.deepEqual(frame(660, contact(1, 270)).shot, { power: 1, angle: 0 });
  assert.equal(controller.swing.stage, "committed");
  assert.equal(frame(700, contact(1, 250)).shot, null);
  assert.equal(frame(740, contact(1, 270)).shot, null);
  assert.equal(frame(780, contact(1, 90)).shot, null);
});

test("either hand can wind back: a 60-degree turn produces equal partial power", () => {
  const powers: number[] = [];
  for (const direction of [-1, 1]) {
    const { address, frame } = rig();
    address();
    frame(350, contact(1, 270 + direction * 40));
    frame(400, contact(1, 270 + direction * 60));
    frame(440, contact(1, 270 + direction * 45));
    assert.equal(frame(480, contact(1, 270 + direction * 30)).shot, null);
    const shot = frame(520, contact(1, 270)).shot;
    assert.ok(shot);
    powers.push(shot.power);
  }
  assert.equal(powers[0], powers[1]);
  assert.ok(powers[0] > 0.4 && powers[0] < 0.5);
});

test("the observed football player's 41-degree address works in either direction and across angular wrap", () => {
  for (const direction of [-1, 1]) {
    const { controller, address, frame } = rig();
    address(1, 6, 41);
    assert.equal(controller.addressFacing, 41);
    for (let i = 1; i <= 3; i++) assert.equal(frame(300 + i * 50, contact(1, 41 + direction * i * 30, Phase.Moved, 6)).shot, null);
    assert.equal(controller.swing.power, 1);
    assert.equal(frame(500, contact(1, 41 + direction * 60, Phase.Moved, 6)).shot, null);
    assert.equal(frame(550, contact(1, 41 + direction * 30, Phase.Moved, 6)).shot, null);
    assert.deepEqual(frame(600, contact(1, 41 - direction * 3, Phase.Moved, 6)).shot, { power: 1, angle: 0 });
    assert.equal(frame(650, contact(1, 41, Phase.Moved, 6)).shot, null);
  }
});

test("a fresh turn can deliberately settle a new address, while a simple stroke reset retains it", () => {
  const { controller, address, frame } = rig();
  address(1, 6, 41);
  controller.setEnabled(false);
  frame(350, contact(1, 190, Phase.Moved, 6));
  controller.setEnabled(true);
  assert.equal(controller.addressFacing, null);
  controller.tick(649);
  assert.equal(controller.swing.stage, "settling");
  controller.tick(650);
  assert.equal(controller.addressFacing, 190);
  assert.equal(controller.swing.stage, "ready");
  frame(700, contact(1, 250, Phase.Moved, 6));
  controller.resetStroke();
  controller.tick(1200);
  assert.equal(controller.addressFacing, 190);
  assert.equal(controller.swing.stage, "settling", "canceling the stroke does not make its backswing the address");
});

test("short putting turns produce low power independently of return speed", () => {
  const powers: number[] = [];
  for (const interval of [20, 120]) {
    const { address, frame } = rig(); address();
    frame(350, contact(1, 310));
    frame(350 + interval, contact(1, 298));
    assert.equal(frame(350 + interval * 2, contact(1, 286)).shot, null);
    const shot = frame(350 + interval * 3, contact(1, 274)).shot;
    assert.ok(shot);
    assert.ok(shot.power > 0 && shot.power < 0.1);
    powers.push(shot.power);
  }
  assert.equal(powers[0], powers[1]);
});

test("smooth slow returns strike once with equal power at every contact rate", () => {
  for (const backswing of [40, 60]) {
    let expectedPower: number | undefined;
    for (const hz of [20, 30, 60, 120]) for (const speed of [26, 30, 90]) for (const direction of [-1, 1]) {
      const { address, frame } = rig(); address();
      frame(350, contact(1, 270 + direction * backswing));
      const powers: number[] = [];
      const duration = backswing / speed;
      for (let sample = 1; sample <= Math.ceil(duration * hz) + 1; sample++) {
        const remaining = Math.max(0, backswing - sample * speed / hz);
        const shot = frame(350 + sample * 1000 / hz, contact(1, 270 + direction * remaining)).shot;
        if (shot) powers.push(shot.power);
      }
      const context = `${backswing}° backswing, ${speed}°/s return, ${hz} Hz, direction ${direction}`;
      assert.equal(powers.length, 1, context);
      expectedPower ??= powers[0];
      assert.equal(powers[0], expectedPower, context);
    }
  }
});

test("returns below the minimum speed cannot strike at any contact rate", () => {
  for (const hz of [20, 30, 60, 120]) for (const direction of [-1, 1]) {
    const { address, frame } = rig(); address();
    frame(350, contact(1, 270 + direction * 40));
    for (let sample = 1; sample <= 2 * hz; sample++) {
      const remaining = 40 - sample * 20 / hz;
      assert.equal(frame(350 + sample * 1000 / hz, contact(1, 270 + direction * remaining)).shot, null,
        `20°/s return at ${hz} Hz, direction ${direction}`);
    }
  }
});

test("one reversed jump followed by small slow drift cannot strike", () => {
  for (const direction of [-1, 1]) {
    const { address, frame } = rig(); address();
    frame(350, contact(1, 270 + direction * 60));
    assert.equal(frame(400, contact(1, 270)).shot, null);
    for (let sample = 1; sample <= 12; sample++) {
      assert.equal(frame(400 + sample * 1000 / 60, contact(1, 270 - direction * sample * 0.1)).shot, null);
    }
  }
});

test("resting orientation jitter and position drift never arm a stroke", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 270, Phase.Began));
  for (let time = 50; time <= 2000; time += 50) {
    const result = frame(time, contact(1, 270 + Math.sin(time) * 3, Phase.Moved, 5,
      960 + Math.cos(time) * 3, 800 + Math.sin(time) * 3));
    assert.equal(result.shot, null);
  }
  assert.equal(controller.swing.stage, "ready");
  assert.equal(controller.swing.windup, 0);
});

test("sliding a piece cannot arm a stroke, even within the turning drift allowance", () => {
  const { controller, address, frame } = rig(); address();
  for (const [time, x] of [[350, 990], [400, 1020], [450, 1050], [500, 1080], [550, 1020], [600, 960]]) {
    assert.equal(frame(time, contact(1, 270, Phase.Moved, 5, x)).shot, null);
    assert.equal(controller.swing.stage, "ready");
    assert.equal(controller.swing.power, 0);
  }
});

test("large repositioning cancels a wound-up stroke", () => {
  const { controller, address, frame } = rig(); address();
  frame(350, contact(1, 330));
  assert.equal(controller.swing.stage, "backswing");
  assert.equal(frame(400, contact(1, 330, Phase.Moved, 5, 1090)).shot, null);
  assert.equal(controller.swing.stage, "settling");
  assert.equal(frame(450, contact(1, 300, Phase.Moved, 5, 1090)).shot, null);
  assert.equal(frame(500, contact(1, 270, Phase.Moved, 5, 960)).shot, null);
});

test("the native football backswing survives hand drift and can return to strike", () => {
  const { controller, address, frame } = rig();
  address(19, 6, 11);
  // Recorded Board snapshots, 21:03:01–03:03 on 2026-10-27. Translation only
  // puts native address (739,380) into this fixture's placement area (960,800).
  const native = (facing: number, x: number, y: number) =>
    contact(19, facing, Phase.Moved, 6, 960 + x - 739, 800 + y - 380);
  for (const [time, facing, x, y] of [
    [570, 11, 742, 376], [1017, 83, 700, 371], [1517, 118, 691, 361],
    [2022, 131, 687, 354], [2543, 124, 662, 361], [3036, 105, 650, 372],
  ]) assert.equal(frame(time, native(facing, x, y)).shot, null);
  assert.equal(controller.swing.stage, "backswing", "the old 48 px cutoff canceled this observed turn");
  assert.equal(controller.swing.power, 1, "the recorded 120-degree backswing caps at full power");
  // The recorded attempt ended in a lift. This synthetic continuation verifies
  // a deliberate return can hit while the center remains at its observed offset.
  assert.equal(frame(3086, native(83, 650, 372)).shot, null);
  assert.equal(frame(3136, native(50, 650, 372)).shot, null);
  assert.ok(frame(3186, native(11, 650, 372)).shot);
  assert.equal(frame(3236, native(0, 650, 372)).shot, null);
});

test("one orientation jump or one reversed sample cannot commit", () => {
  const { controller, address, frame } = rig(); address();
  frame(350, contact(1, 330));
  assert.equal(frame(400, contact(1, 270)).shot, null);
  assert.equal(controller.swing.stage, "backswing");
  controller.resetStroke(); controller.tick(700);
  assert.equal(frame(750, contact(1, 90)).shot, null);
  assert.equal(controller.swing.stage, "settling");
});

test("holding the backswing keeps power but needs fresh return samples", () => {
  const { controller, address, frame } = rig(); address();
  frame(350, contact(1, 300)); frame(400, contact(1, 330)); frame(450, contact(1, 0));
  controller.tick(3000);
  assert.equal(controller.swing.stage, "backswing");
  assert.equal(controller.swing.power, 1);
  assert.equal(frame(3020, contact(1, 345)).shot, null);
  assert.equal(frame(3060, contact(1, 330)).shot, null);
  assert.equal(frame(3100, contact(1, 300)).shot, null);
  assert.ok(frame(3140, contact(1, 270)).shot);
});

test("continuous rotation in the same direction never acts as a return swing", () => {
  const { controller, address, frame } = rig(); address();
  for (let i = 1; i <= 12; i++) assert.equal(frame(300 + i * 40, contact(1, 270 + i * 30)).shot, null);
  assert.equal(controller.swing.stage, "settling");
});

test("a lift or cancellation disarms, and a nearby blink retains identity with no new arrival", () => {
  for (const phase of [Phase.Ended, Phase.Canceled]) {
    const { controller, address, frame } = rig(); address();
    frame(350, contact(1, 330));
    frame(400, contact(1, 330, phase));
    assert.equal(controller.piece, null);
    assert.equal(controller.swing.stage, "settling");
    const returned = frame(450, contact(4, 300, Phase.Began));
    assert.equal(returned.shot, null);
    assert.equal(returned.arrivals.length, 0);
    assert.equal(controller.piece?.contactId, 4);
    assert.equal(frame(470, contact(4, 270)).shot, null);
    controller.tick(770);
    assert.equal(controller.swing.stage, "ready");
  }
});

test("a blink does not calibrate a backward piece as the new address direction", () => {
  const { controller, address, frame } = rig(); address();
  frame(350, contact(1, 330)); frame(400, contact(1, 30)); frame(450, contact(1, 90));
  frame(500, contact(1, 90, Phase.Ended));
  frame(550, contact(2, 90, Phase.Began));
  controller.tick(1000);
  assert.equal(controller.swing.stage, "settling");
  assert.equal(frame(1040, contact(2, 30)).shot, null);
  assert.equal(frame(1080, contact(2, 330)).shot, null);
  assert.equal(frame(1120, contact(2, 270)).shot, null);
  controller.tick(1420);
  assert.equal(controller.swing.stage, "ready");
});

test("three native pause epochs rebind pieces without splash, sound, or stale strike", () => {
  const { controller, active, frame } = rig();
  let id = 1, time = 0;
  frame(time, contact(id, 270, Phase.Began));
  for (let cycle = 0; cycle < 3; cycle++) {
    controller.tick(time + 300); frame(time + 350, contact(id, 330));
    controller.pause(time + 400); active.clear();
    assert.equal(controller.piece, null);
    controller.resume(time + 5400);
    time += 6000; id++;
    const result = frame(time, contact(id, 270, Phase.Began));
    assert.equal(result.arrivals.length, 0);
    assert.equal(result.shot, null);
    assert.equal(controller.piece?.contactId, id);
    assert.equal(controller.swing.stage, "settling");
  }
});

test("pause retains an arbitrary calibrated address and rejects a backward redetection", () => {
  const { controller, active, address, frame } = rig();
  address(1, 6, 41);
  frame(350, contact(1, 101, Phase.Moved, 6));
  frame(400, contact(1, 161, Phase.Moved, 6));
  controller.pause(450); active.clear(); controller.resume(1500);
  const returned = frame(1600, contact(7, 161, Phase.Began, 6));
  assert.equal(returned.arrivals.length, 0);
  assert.equal(returned.shot, null);
  controller.tick(2000);
  assert.equal(controller.addressFacing, 41);
  assert.equal(controller.swing.stage, "settling");
  assert.equal(frame(2050, contact(7, 101, Phase.Moved, 6)).shot, null);
  assert.equal(frame(2100, contact(7, 41, Phase.Moved, 6)).shot, null);
  controller.tick(2400);
  assert.equal(controller.swing.stage, "ready");
  assert.equal(controller.addressFacing, 41);
  frame(2450, contact(7, 101, Phase.Moved, 6));
  frame(2500, contact(7, 161, Phase.Moved, 6));
  frame(2550, contact(7, 101, Phase.Moved, 6));
  assert.ok(frame(2600, contact(7, 41, Phase.Moved, 6)).shot);
});

test("pause restoration matches glyph and location even when contact IDs are swapped", () => {
  const { controller, active, frame } = rig();
  frame(0, contact(1, 270, Phase.Began, 5), contact(2, 270, Phase.Began, 2, 400, 500));
  controller.pause(100); active.clear(); controller.resume(1000);
  const result = frame(1100, contact(1, 270, Phase.Began, 2, 400, 500), contact(2, 270, Phase.Began, 5));
  assert.equal(result.arrivals.length, 0);
  assert.equal(controller.piece?.contactId, 2);
});

test("existing second pieces cannot steal authority from a lifted player", () => {
  const { controller, address, frame } = rig(); address();
  frame(310, contact(2, 270, Phase.Began, 6, 1040));
  frame(350, contact(2, 330, Phase.Moved, 6, 1040));
  frame(390, contact(2, 315, Phase.Moved, 6, 1040));
  assert.equal(frame(430, contact(2, 300, Phase.Moved, 6, 1040)).shot, null);
  assert.equal(controller.piece?.contactId, 1);
  frame(450, contact(1, 270, Phase.Ended));
  frame(500, contact(2, 270, Phase.Moved, 6, 1040));
  assert.equal(controller.piece, null);
  frame(550, contact(3, 270, Phase.Began, 5));
  assert.equal(controller.piece?.contactId, 3);
});

test("observation, placement legality, and explicit setup confirmation stay separate", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 270, Phase.Began, 5, 400, 500));
  assert.equal(controller.piece, null);
  assert.equal(controller.observedPiece?.contactId, 1);
  frame(100, contact(1, 270)); controller.tick(400);
  assert.equal(controller.piece?.contactId, 1);
  controller.release();
  assert.equal(controller.piece, null);
  assert.equal(controller.observedPiece?.contactId, 1);
  assert.equal(frame(500, contact(1, 270, Phase.Stationary)).arrivals.length, 0);
  assert.equal(controller.piece, null);
  assert.equal(controller.confirmPlacement(), true);
  assert.equal(controller.piece?.contactId, 1);
  assert.equal(controller.swing.stage, "settling");
});

test("explicit setup confirmation keeps an outside Sports piece bound until it moves into the swing area", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 270, Phase.Began, 9));
  assert.equal(controller.confirmPlacement(), false, "unknown glyphs cannot confirm a player");
  frame(50, contact(2, 270, Phase.Began)); controller.tick(350);
  controller.release();
  frame(400, contact(2, 270, Phase.Moved, 5, 400, 500));
  assert.equal(controller.piece, null);
  assert.equal(controller.observedPiece?.contactId, 2);
  assert.equal(controller.confirmPlacement(), true, "Tee Off accepts a detected Sports piece outside the swing area");
  assert.equal(controller.piece?.contactId, 2);
  for (const [time, orientation] of [[500, 330], [800, 0], [850, 330], [900, 270]]) {
    const event = frame(time, contact(2, orientation, Phase.Moved, 5, 400, 500));
    assert.equal(event.shot, null, "an outside piece cannot strike");
    assert.equal(event.arrivals.length, 0, "confirmation and turning cannot replay the landing splash");
    assert.equal(controller.swing.stage, "settling");
  }
  assert.equal(frame(1000, contact(2, 270)).arrivals.length, 0, "the same piece can slide into play without lifting");
  controller.tick(1299);
  assert.equal(controller.swing.stage, "settling");
  controller.tick(1300);
  assert.equal(controller.swing.stage, "ready");
  frame(1350, contact(2, 330)); frame(1400, contact(2, 0));
  assert.equal(frame(1450, contact(2, 330)).shot, null);
  assert.deepEqual(frame(1500, contact(2, 270)).shot, { power: 1, angle: 0 });
});

test("disabled control binds but cannot wind up or strike", () => {
  const { controller, address, frame } = rig();
  controller.setEnabled(false); address();
  frame(350, contact(1, 330)); frame(400, contact(1, 315));
  assert.equal(frame(450, contact(1, 300)).shot, null);
  assert.equal(controller.piece?.contactId, 1);
  assert.equal(controller.swing.stage, "settling");
  frame(500, contact(1, 270)); controller.setEnabled(true); controller.tick(800);
  assert.equal(controller.swing.stage, "ready");
});

test("the caller supplies physical facing after view rotation; raw orientation is not reinterpreted", () => {
  const { controller, address, frame } = rig(90, -90);
  address(1, 5, 0);
  assert.equal(controller.swing.stage, "ready");
  frame(350, contact(1, 60)); frame(400, contact(1, 120));
  frame(440, contact(1, 105));
  assert.equal(frame(480, contact(1, 60)).shot, null);
  assert.ok(frame(520, contact(1, 0)).shot);
});

test("late returns and returns outside the rebind radius are new arrivals", () => {
  for (const [time, x] of [[1400, 960], [500, 1200]]) {
    const { address, frame } = rig(); address();
    frame(350, contact(1, 270, Phase.Ended));
    assert.equal(frame(time, contact(3, 270, Phase.Began, 5, x)).arrivals.length, 1);
  }
  assert.ok(TURN_SWING.forwardDeg < TURN_SWING.backswingDeg);
});

test("putts use the original arming threshold and linear quarter-turn power", () => {
  for (const [backswing, expectedPower] of [[12, null], [30, null], [39, null], [40, 2 / 27], [60, 4 / 9], [90, 1]] as const) {
    for (const direction of [-1, 1]) {
      const {controller, address, frame} = rig(); address();
      frame(350, contact(1, 270 + direction * backswing));
      const shots: Shot[] = [];
      for (let sample = 1; sample <= Math.ceil(backswing / 8) + 1; sample++) {
        const remaining = Math.max(0, backswing - sample * 8);
        const shot = frame(350 + sample * 40, contact(1, 270 + direction * remaining)).shot;
        if (shot) shots.push(shot);
      }
      const game = createGame();
      if (expectedPower === null) {
        assert.equal(shots.length, 0, `${backswing} degrees cannot arm the old putting stroke`);
        assert.equal(controller.swing.stage, 'ready');
        assert.equal(game.strokes, 0);
      } else {
        assert.equal(shots.length, 1, `${backswing} degrees commits once`);
        assert.ok(Math.abs(shots[0].power - expectedPower) < 1e-12);
        assert.equal(strike(game, shots[0], 'PUTTER'), true);
        assert.equal(game.phase, 'rolling');
        assert.equal(game.strokes, 1);
        assert.equal(game.shotPower, expectedPower);
      }
    }
  }
});
