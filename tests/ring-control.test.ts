import { test } from "node:test";
import assert from "node:assert/strict";
import { BoardContactPhase as Phase, BoardContactType as Type, type BoardContact } from "@board.fun/web-sdk";
import { RingController, isRingPlacement } from "../src/ring-control";

const contact = (id: number, x = 960, y = 800, phase = Phase.Moved, glyphId = 1, orientation = 0): BoardContact =>
  ({ contactId: id, x, y, phase, glyphId, orientation, type: Type.Glyph, isTouched: true });
function rig() {
  const controller = new RingController();
  const active = new Map<number, BoardContact>();
  controller.setEnabled(true);
  const frame = (now: number, ...batch: BoardContact[]) => {
    for (const c of batch) {
      if (c.phase === Phase.Ended || c.phase === Phase.Canceled) active.delete(c.contactId);
      else active.set(c.contactId, c);
    }
    return controller.update(batch, active, now);
  };
  return { controller, active, frame };
}

test("a stationary contact settles without repeated sensor events", () => {
  const { controller, frame } = rig();
  assert.equal(frame(0, contact(1, 960, 800, Phase.Began)).arrivals.length, 1);
  controller.tick(500);
  assert.equal(controller.swing.stage, "ready");
  assert.equal(frame(600).arrivals.length, 0);
  assert.equal(controller.ring?.contactId, 1);
  assert.equal(controller.swing.history.length, 0);
});

test("a still hold then back-and-forward movement fires exactly once", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began)); controller.tick(500);
  assert.equal(frame(1000, contact(1, 960, 860)).shot, null);
  frame(1040, contact(1, 960, 880));
  assert.equal(frame(1070, contact(1, 960, 850)).shot, null);
  assert.ok(frame(1100, contact(1, 960, 820)).shot);
  assert.equal(frame(1140, contact(1, 960, 750)).shot, null);
  assert.equal(frame(1200, contact(1, 960, 880)).shot, null);
});

test("a pause at the back retains intent but throws away old velocity", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began)); controller.tick(300);
  frame(350, contact(1, 960, 880));
  controller.tick(3000);
  assert.equal(controller.swing.stage, "backswing");
  assert.equal(controller.swing.history.length, 0);
  assert.equal(frame(3020, contact(1, 960, 850)).shot, null);
  assert.ok(frame(3050, contact(1, 960, 820)).shot);
  assert.equal(frame(3080, contact(1, 960, 790)).shot, null);
});

test("turning the round ring and small jitter have no stroke meaning", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began));
  for (let time = 50; time < 1500; time += 50) {
    const e = frame(time, contact(1, 960 + Math.sin(time) * 3, 800 + Math.cos(time) * 3, Phase.Moved, 1, time % 360));
    assert.equal(e.shot, null); assert.equal(e.arrivals.length, 0);
  }
  assert.equal(controller.swing.stage, "ready");
});

test("a lift or cancellation immediately disarms the stroke", () => {
  for (const phase of [Phase.Ended, Phase.Canceled]) {
    const { controller, frame } = rig();
    frame(0, contact(1, 960, 800, Phase.Began)); controller.tick(300);
    frame(350, contact(1, 960, 880));
    frame(400, contact(1, 960, 880, phase));
    assert.equal(controller.ring, null);
    assert.equal(controller.swing.stage, "settling");
    const returned = frame(450, contact(4, 960, 780, Phase.Began));
    assert.equal(returned.shot, null); assert.equal(returned.arrivals.length, 0);
    assert.equal(controller.ring?.contactId, 4);
  }
});

test("two identical glyphs have separate arrivals and the second cannot steal control", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 900, 800, Phase.Began)); controller.tick(300);
  assert.equal(frame(310, contact(2, 1000, 800, Phase.Began)).arrivals.length, 1);
  frame(350, contact(2, 1000, 880)); frame(380, contact(2, 1000, 840));
  assert.equal(frame(410, contact(2, 1000, 790)).shot, null);
  assert.equal(controller.ring?.contactId, 1);
  frame(450, contact(1, 900, 800, Phase.Ended));
  frame(500, contact(2, 1000, 800));
  assert.equal(controller.ring, null, "an already present duplicate must not claim a lifted owner's seat");
  frame(550, contact(3, 910, 800, Phase.Began));
  assert.equal(controller.ring?.contactId, 3);
});

test("a nearby return within the blink window keeps identity without another arrival", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began));
  frame(100, contact(1, 960, 800, Phase.Ended));
  const result = frame(400, contact(8, 1010, 800, Phase.Began));
  assert.equal(result.arrivals.length, 0);
  assert.equal(result.shot, null);
  assert.equal(controller.ring?.contactId, 8);
});

test("late and far returns are new placements", () => {
  for (const [time, x] of [[1100, 960], [300, 1200]]) {
    const { frame } = rig();
    frame(0, contact(1, 960, 800, Phase.Began)); frame(100, contact(1, 960, 800, Phase.Ended));
    assert.equal(frame(time, contact(9, x, 800, Phase.Began)).arrivals.length, 1);
  }
});

test("three native pause cycles preserve control without splash or stale shots", () => {
  const { controller, active, frame } = rig();
  let id = 1, time = 0;
  frame(time, contact(id, 960, 800, Phase.Began));
  for (let cycle = 0; cycle < 3; cycle++) {
    controller.tick(time + 300); frame(time + 350, contact(id, 960, 870));
    controller.pause(time + 400); active.clear();
    assert.equal(controller.ring, null);
    controller.resume(time + 5400);
    time += 6000; id += 1;
    const result = frame(time, contact(id, 970, 820, Phase.Began));
    assert.equal(result.arrivals.length, 0); assert.equal(result.shot, null);
    assert.equal(controller.ring?.contactId, id);
    assert.equal(controller.swing.stage, "settling");
  }
});

test("pause re-detection window begins at resume and expires after two seconds", () => {
  const { controller, active, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began)); controller.pause(100); active.clear();
  controller.resume(10100);
  assert.equal(frame(12200, contact(2, 960, 800, Phase.Began)).arrivals.length, 1);
});

test("pause snapshots match glyph and location rather than reused native IDs", () => {
  const { controller, active, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began), contact(2, 400, 600, Phase.Began, 2));
  controller.pause(100); active.clear(); controller.resume(1000);
  const result = frame(1100, contact(1, 400, 600, Phase.Began, 2), contact(2, 960, 800, Phase.Began, 1));
  assert.equal(result.arrivals.length, 0);
  assert.equal(controller.ring?.contactId, 2);
});

test("wrong pieces answer visibly but hands sharing a glyph are ignored", () => {
  const { controller, frame } = rig();
  assert.equal(frame(0, contact(1, 960, 800, Phase.Began, 2)).arrivals.length, 1);
  assert.equal(frame(10, { ...contact(2, 960, 800, Phase.Began), type: Type.Hand }).arrivals.length, 0);
  assert.equal(controller.ring, null);
});

test("initial position legality is separate from observed motion and never clamps a ring", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 960, 400, Phase.Began));
  assert.equal(controller.ring, null);
  assert.equal(controller.observedRing?.y, 400);
  assert.equal(isRingPlacement(controller.observedRing!), false);
  frame(100, contact(1, 960, 800)); controller.tick(400);
  assert.equal(controller.ring?.y, 800);
  frame(450, contact(1, 960, 860)); frame(480, contact(1, 960, 830)); frame(510, contact(1, 960, 700));
  assert.equal(controller.ring?.y, 700, "forward stroke coordinates must remain the real physical pose");
});

test("disabled input observes and binds pieces but cannot swing", () => {
  const { controller, frame } = rig(); controller.setEnabled(false);
  assert.equal(frame(0, contact(1, 960, 800, Phase.Began)).arrivals.length, 1);
  controller.tick(300); frame(400, contact(1, 960, 880)); frame(430, contact(1, 960, 840));
  assert.equal(frame(460, contact(1, 960, 790)).shot, null);
  assert.equal(controller.ring?.contactId, 1);
  controller.setEnabled(true); controller.tick(800);
  assert.equal(controller.swing.stage, "ready");
});

test("change setup releases authority and confirms the retained ring without another splash", () => {
  const { controller, frame } = rig();
  frame(0, contact(1, 960, 800, Phase.Began)); controller.tick(300); controller.release();
  assert.equal(controller.ring, null); assert.equal(controller.observedRing?.contactId, 1);
  assert.equal(frame(400, contact(1, 960, 800, Phase.Stationary)).arrivals.length, 0);
  assert.equal(controller.ring, null);
  assert.equal(controller.confirmPlacement(), true);
  assert.equal(controller.ring?.contactId, 1);
  assert.equal(controller.swing.stage, "settling");
});
