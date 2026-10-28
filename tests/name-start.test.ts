import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardContactPhase as Phase, BoardContactType as Type, type BoardContact } from '@board.fun/web-sdk';
import { NAME_START_CIRCLE, NameStartPlacement, isNameStartPlacement } from '../src/name-start';
import { isPiecePlacement, toNative } from '../src/portrait';

const contact = (contactId = 1, x = NAME_START_CIRCLE.x, y = NAME_START_CIRCLE.y, glyphId = 1): BoardContact =>
  ({contactId, ...toNative({x, y}), glyphId, orientation: 0, type: Type.Glyph, phase: Phase.Stationary, isTouched: true});
const active = (...contacts: BoardContact[]) => new Map(contacts.map(c => [c.contactId, c]));

test('the name target accepts every Sports piece and fits the existing swing area', () => {
  for (let glyph = 1; glyph <= 8; glyph++) {
    const c = contact(1, NAME_START_CIRCLE.x, NAME_START_CIRCLE.y, glyph);
    assert.equal(isNameStartPlacement(c), true);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      assert.equal(isPiecePlacement(contact(1, NAME_START_CIRCLE.x + 45 * Math.cos(angle),
        NAME_START_CIRCLE.y + 45 * Math.sin(angle), glyph)), true);
    }
    const gate = new NameStartPlacement();
    assert.equal(gate.update(active(c), 'title:profile', 0), null);
    assert.equal(gate.update(active(c), 'title:profile', 299), null);
    assert.equal(gate.update(active(c), 'title:profile', 300), 1);
  }
  assert.equal(isNameStartPlacement(contact(1, 585)), true);
  assert.equal(isNameStartPlacement(contact(1, 585.1)), false);
});

test('fingers, hands, unsupported glyphs, ended contacts, and invalid coordinates never start', () => {
  const invalid = [
    {...contact(), type: Type.Finger}, {...contact(), type: Type.Hand},
    contact(1, 540, 1385, 0), contact(1, 540, 1385, 9), contact(1, 540, 1385, 1.5),
    {...contact(), phase: Phase.Ended}, {...contact(), phase: Phase.Canceled},
    {...contact(), x: NaN}, {...contact(), y: Infinity},
  ];
  for (const c of invalid) {
    const gate = new NameStartPlacement();
    assert.equal(isNameStartPlacement(c), false);
    assert.equal(gate.update(active(c), 'title:profile', 0), null);
    assert.equal(gate.update(active(c), 'title:profile', 1000), null);
  }
});

test('moving onto the named target selects that exact piece despite another piece on the course', () => {
  const gate = new NameStartPlacement(), stray = contact(1, 400, 900);
  assert.equal(gate.update(active(stray, contact(2, 700)), 'title:profile', 0), null);
  assert.equal(gate.update(active(stray, contact(2)), 'title:profile', 1000), null);
  assert.equal(gate.update(active(stray, contact(2)), 'title:profile', 1300), 2);
});

test('a stable hold tolerates sensing jitter but deliberate movement restarts its dwell', () => {
  const gate = new NameStartPlacement();
  assert.equal(gate.update(active(contact()), 'title:profile', 0), null);
  assert.equal(gate.update(active(contact(1, 550)), 'title:profile', 200), null);
  assert.equal(gate.update(active(contact(1, 553)), 'title:profile', 299), null);
  assert.equal(gate.update(active(contact(1, 552)), 'title:profile', 598), null);
  assert.equal(gate.update(active(contact(1, 552)), 'title:profile', 599), 1);
});

test('starting consumes the held placement exactly once until the circle is vacated', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'title:profile', 0);
  assert.equal(gate.update(active(contact()), 'title:profile', 300), 1);
  assert.equal(gate.update(active(contact()), 'title:profile', 1000), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1400), null, 'a new ID does not defeat the occupied zone');
  assert.equal(gate.update(active(contact(2, 700)), 'title:profile', 1500), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1600), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1900), 2);
});

test('a different displayed player cannot inherit a partly completed hold', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'setup:alice', 0);
  assert.equal(gate.update(active(contact()), 'setup:bob', 299), null);
  assert.equal(gate.update(active(contact()), 'setup:bob', 1000), null);
  gate.update(active(), 'setup:bob', 1100);
  gate.update(active(contact(2)), 'setup:bob', 1200);
  assert.equal(gate.update(active(contact(2)), 'setup:bob', 1500), 2);
});

test('help or a selector cannot auto-start when the same held piece returns', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'title:profile', 0);
  gate.update(active(contact()), null, 200);
  assert.equal(gate.update(active(contact()), 'title:profile', 1000), null);
  assert.equal(gate.update(active(contact()), 'title:profile', 2000), null);
  gate.update(active(), 'title:profile', 2100);
  gate.update(active(contact()), 'title:profile', 2200);
  assert.equal(gate.update(active(contact()), 'title:profile', 2500), 1);
});

test('reset rejects pause redetection under a new contact ID after an empty native epoch', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'title:profile', 0);
  gate.reset(active(contact()));
  assert.equal(gate.update(active(), 'title:profile', 1000), null);
  assert.equal(gate.update(active(), 'title:profile', 1100), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1200), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1700), null);
  gate.update(active(), 'title:profile', 1800);
  gate.update(active(contact(3)), 'title:profile', 1900);
  assert.equal(gate.update(active(contact(3)), 'title:profile', 2200), 3);
});

test('observing the retained piece outside the circle releases a reset guard', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'title:profile', 0);
  gate.reset(active(contact()));
  gate.update(active(contact(1, 700)), 'title:profile', 1000);
  gate.update(active(contact(2)), 'title:profile', 1100);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1400), 2);
});

test('an unrelated piece with the same glyph cannot release a retained-piece reset guard', () => {
  const gate = new NameStartPlacement(), outside = contact(2, 700);
  gate.update(active(contact(), outside), 'title:profile', 0);
  gate.reset(active(contact(), outside));
  assert.equal(gate.update(active(outside), 'title:profile', 1000), null);
  assert.equal(gate.update(active(outside, contact(3)), 'title:profile', 1200), null);
  assert.equal(gate.update(active(outside, contact(3)), 'title:profile', 1500), null,
    'redetecting the held piece still requires a new placement');
  gate.update(active(outside), 'title:profile', 1600);
  gate.update(active(outside, contact(3)), 'title:profile', 1700);
  assert.equal(gate.update(active(outside, contact(3)), 'title:profile', 2000), 3);
});

test('disabled targets never start and empty initial setup permits the first fresh placement', () => {
  const gate = new NameStartPlacement();
  assert.equal(gate.update(active(contact()), null, 0), null);
  assert.equal(gate.update(active(), 'title:profile', 100), null);
  assert.equal(gate.update(active(contact()), 'title:profile', 200), null);
  assert.equal(gate.update(active(contact()), 'title:profile', 500), 1);
});

test('lifting the piece during ordinary play permits the first new placement in setup', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'title:profile', 0);
  assert.equal(gate.update(active(contact()), 'title:profile', 300), 1);
  assert.equal(gate.update(active(contact()), null, 400), null);
  assert.equal(gate.update(active(), null, 500), null, 'the real lift is observed while no start target exists');
  gate.reset(active());
  gate.update(active(), 'setup:profile', 600);
  gate.update(active(contact(2)), 'setup:profile', 700);
  assert.equal(gate.update(active(contact(2)), 'setup:profile', 1000), 2);
});

test('a contact replacement or backwards clock restarts the full stable hold', () => {
  const gate = new NameStartPlacement();
  gate.update(active(contact()), 'title:profile', 1000);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 1200), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 500), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 799), null);
  assert.equal(gate.update(active(contact(2)), 'title:profile', 800), 2);
});
