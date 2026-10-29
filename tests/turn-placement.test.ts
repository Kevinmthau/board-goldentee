import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardContactPhase as Phase, BoardContactType as Type, type BoardContact } from '@board.fun/web-sdk';
import { TurnPlacement } from '../src/turn-placement';

const contact = (contactId = 1, x = 200, y = 900, glyphId = 1): BoardContact =>
  ({ contactId, x, y, glyphId, orientation: 0, type: Type.Glyph, phase: Phase.Stationary, isTouched: false });
const active = (...contacts: BoardContact[]) => new Map(contacts.map(c => [c.contactId, c]));

test('an idle piece already on the board confirms the turn after a full stable hold', () => {
  const gate = new TurnPlacement(), held = active(contact());
  assert.equal(gate.update(held, null, 0), null);
  assert.equal(gate.update(held, 'turn:alice:1', 1000), null);
  assert.equal(gate.update(held, 'turn:alice:1', 1299), null);
  assert.equal(gate.update(held, 'turn:alice:1', 1300), 1);
});

test('fresh Sports pieces can confirm away from the name circle and at every native board edge', () => {
  const positions = [[0, 0], [1920, 0], [0, 1080], [1920, 1080], [960, 540]];
  for (let glyphId = 1; glyphId <= 8; glyphId++) {
    for (const [x, y] of positions) {
      const gate = new TurnPlacement();
      gate.update(active(), 'turn:alice:1', 0);
      assert.equal(gate.update(active({ ...contact(8, x, y, glyphId), phase: Phase.Began }), 'turn:alice:1', 100), null);
      assert.equal(gate.update(active(contact(8, x, y, glyphId)), 'turn:alice:1', 400), 8);
    }
  }
});

test('fingers, hands, unsupported glyphs, inactive contacts, and invalid positions never confirm', () => {
  const invalid = [
    { ...contact(), type: Type.Finger }, { ...contact(), type: Type.Hand },
    contact(1, 200, 900, 0), contact(1, 200, 900, 9), contact(1, 200, 900, 1.5),
    { ...contact(), phase: Phase.Ended }, { ...contact(), phase: Phase.Canceled },
    contact(1, NaN), contact(1, Infinity), contact(1, 200, NaN), contact(1, 200, -Infinity),
    contact(1, -0.1), contact(1, 1920.1), contact(1, 200, -0.1), contact(1, 200, 1080.1),
  ];
  for (const c of invalid) {
    const gate = new TurnPlacement();
    assert.equal(gate.update(active(c), 'turn:alice:1', 0), null);
    assert.equal(gate.update(active(c), 'turn:alice:1', 1000), null);
  }
});

test('a candidate retains its exact contact when another piece appears', () => {
  const gate = new TurnPlacement();
  gate.update(active(contact(8)), 'turn:alice:1', 0);
  assert.equal(gate.update(active(contact(1), contact(8)), 'turn:alice:1', 200), null);
  assert.equal(gate.update(active(contact(1), contact(8)), 'turn:alice:1', 300), 8);
});

test('explicitly preferring a newly placed piece replaces the old hold and requires a fresh dwell', () => {
  const gate = new TurnPlacement();
  gate.update(active(contact(1)), 'turn:alice:1', 0);
  gate.prefer(8);
  const pieces = active(contact(1), contact(8, 1600, 200));
  assert.equal(gate.update(pieces, 'turn:alice:1', 299), null);
  assert.equal(gate.update(pieces, 'turn:alice:1', 300), null, 'the old candidate cannot finish its former hold');
  assert.equal(gate.update(pieces, 'turn:alice:1', 598), null);
  assert.equal(gate.update(pieces, 'turn:alice:1', 599), 8);
  assert.equal(gate.update(pieces, 'turn:alice:1', 1000), null);
});

test('a newly placed preferred piece can take an already confirmed turn from the shared piece', () => {
  const gate = new TurnPlacement();
  gate.update(active(contact(1)), 'turn:alice:1', 0);
  assert.equal(gate.update(active(contact(1)), 'turn:alice:1', 300), 1);
  gate.prefer(8);
  const pieces = active(contact(1), contact(8));
  assert.equal(gate.update(pieces, 'turn:alice:1', 400), null);
  assert.equal(gate.update(pieces, 'turn:alice:1', 699), null);
  assert.equal(gate.update(pieces, 'turn:alice:1', 700), 8);
  assert.equal(gate.update(pieces, 'turn:alice:1', 1000), null, 'the old shared piece cannot reclaim the consumed turn');
});

test('a preference survives enabling or changing a turn key', () => {
  for (const previousKey of [null, 'turn:alice:1']) {
    const gate = new TurnPlacement(), pieces = active(contact(1), contact(8));
    gate.update(pieces, previousKey, 0);
    gate.prefer(8);
    assert.equal(gate.update(pieces, 'turn:bob:1', 100), null);
    assert.equal(gate.update(pieces, 'turn:bob:1', 400), 8);
  }
});

test('disabling a turn clears its preferred piece', () => {
  const gate = new TurnPlacement(), pieces = active(contact(1), contact(8));
  gate.prefer(8);
  gate.update(pieces, null, 0);
  gate.update(pieces, 'turn:alice:1', 100);
  assert.equal(gate.update(pieces, 'turn:alice:1', 400), 1);
});

test('a lifted or invalid preferred piece falls back to the shared piece after a fresh dwell', () => {
  for (const invalid of [null, { ...contact(8), phase: Phase.Ended }, { ...contact(8), type: Type.Hand }]) {
    const gate = new TurnPlacement();
    gate.update(active(contact(1)), 'turn:alice:1', 0);
    gate.prefer(8);
    gate.update(active(contact(1), contact(8)), 'turn:alice:1', 200);
    const remaining = invalid ? active(contact(1), invalid) : active(contact(1));
    assert.equal(gate.update(remaining, 'turn:alice:1', 499), null);
    assert.equal(gate.update(remaining, 'turn:alice:1', 500), null, 'the preferred candidate cannot leave a completed hold');
    assert.equal(gate.update(remaining, 'turn:alice:1', 798), null);
    assert.equal(gate.update(remaining, 'turn:alice:1', 799), 1);
  }
});

test('pause reset restarts the preferred hold without giving the retained piece priority', () => {
  const gate = new TurnPlacement(), pieces = active(contact(1), contact(8));
  gate.prefer(8);
  gate.update(pieces, 'turn:alice:1', 0);
  gate.reset();
  assert.equal(gate.update(pieces, 'turn:alice:1', 1000), null);
  assert.equal(gate.update(pieces, 'turn:alice:1', 1300), 8);
  gate.reset();
  assert.equal(gate.update(pieces, 'turn:alice:1', 1700), null, 'reset does not reopen a consumed turn');
});

test('replacing the contact or its glyph restarts the full hold', () => {
  for (const replacement of [contact(2), contact(1, 200, 900, 2)]) {
    const gate = new TurnPlacement();
    gate.update(active(contact()), 'turn:alice:1', 0);
    assert.equal(gate.update(active(replacement), 'turn:alice:1', 299), null);
    assert.equal(gate.update(active(replacement), 'turn:alice:1', 598), null);
    assert.equal(gate.update(active(replacement), 'turn:alice:1', 599), replacement.contactId);
  }
});

test('small jitter is allowed while drift beyond the resting radius restarts the hold', () => {
  const gate = new TurnPlacement();
  gate.update(active(contact()), 'turn:alice:1', 0);
  assert.equal(gate.update(active(contact(1, 212)), 'turn:alice:1', 200), null);
  assert.equal(gate.update(active(contact(1, 213)), 'turn:alice:1', 299), null);
  assert.equal(gate.update(active(contact(1, 214)), 'turn:alice:1', 598), null);
  assert.equal(gate.update(active(contact(1, 214)), 'turn:alice:1', 599), 1);
});

test('a confirmed key never repeats through lifts, redetection, or reset', () => {
  const gate = new TurnPlacement();
  gate.update(active(contact()), 'turn:alice:1', 0);
  assert.equal(gate.update(active(contact()), 'turn:alice:1', 300), 1);
  assert.equal(gate.update(active(contact()), 'turn:alice:1', 600), null);
  gate.update(active(), 'turn:alice:1', 700);
  gate.reset();
  assert.equal(gate.update(active(contact(2)), 'turn:alice:1', 800), null);
  assert.equal(gate.update(active(contact(2)), 'turn:alice:1', 1200), null);
});

test('the last player can confirm the next turn with the same piece without lifting', () => {
  const gate = new TurnPlacement(), held = active(contact());
  gate.update(held, 'turn:alice:1', 0);
  assert.equal(gate.update(held, 'turn:alice:1', 300), 1);
  assert.equal(gate.update(held, 'turn:alice:2', 400), null);
  assert.equal(gate.update(held, 'turn:alice:2', 699), null);
  assert.equal(gate.update(held, 'turn:alice:2', 700), 1);
});

test('changing players discards a partial hold', () => {
  const gate = new TurnPlacement(), held = active(contact());
  gate.update(held, 'turn:alice:1', 0);
  assert.equal(gate.update(held, 'turn:bob:1', 299), null);
  assert.equal(gate.update(held, 'turn:bob:1', 598), null);
  assert.equal(gate.update(held, 'turn:bob:1', 599), 1);
});

test('pause reset requires a fresh dwell but no lift from a retained or redetected piece', () => {
  for (const resumed of [contact(), contact(2)]) {
    const gate = new TurnPlacement();
    gate.update(active(contact()), 'turn:alice:1', 0);
    gate.reset();
    assert.equal(gate.update(active(resumed), 'turn:alice:1', 1000), null);
    assert.equal(gate.update(active(resumed), 'turn:alice:1', 1299), null);
    assert.equal(gate.update(active(resumed), 'turn:alice:1', 1300), resumed.contactId);
  }
});

test('disabled targets cannot collect a hold and re-enabling starts a fresh dwell', () => {
  const gate = new TurnPlacement(), held = active(contact());
  gate.update(held, 'turn:alice:1', 0);
  assert.equal(gate.update(held, null, 200), null);
  assert.equal(gate.update(held, null, 1000), null);
  assert.equal(gate.update(held, 'turn:alice:1', 1200), null);
  assert.equal(gate.update(held, 'turn:alice:1', 1499), null);
  assert.equal(gate.update(held, 'turn:alice:1', 1500), 1);
});

test('losing the active contact or receiving an invalid clock cannot finish a stale dwell', () => {
  for (const interrupt of ['missing', 'invalid', 'backwards']) {
    const gate = new TurnPlacement(), held = active(contact());
    gate.update(held, 'turn:alice:1', 1000);
    if (interrupt === 'missing') gate.update(active(), 'turn:alice:1', 1100);
    if (interrupt === 'invalid') gate.update(held, 'turn:alice:1', NaN);
    const nextTime = interrupt === 'backwards' ? 500 : 2000;
    assert.equal(gate.update(held, 'turn:alice:1', nextTime), null);
    assert.equal(gate.update(held, 'turn:alice:1', nextTime + 299), null);
    assert.equal(gate.update(held, 'turn:alice:1', nextTime + 300), 1);
  }
});
