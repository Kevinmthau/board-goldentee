import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Board, BoardContactPhase, BoardContactType, type BoardContact } from '@board.fun/web-sdk';

type Event = Record<string, unknown>;
class Element {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: Element[] = [];
  parent: Element | null = null;
  listeners = new Map<string, (e: Event) => void>();
  nodes = new Map<string, Element>();
  attributes: Record<string, string> = {};
  className = ''; innerHTML = ''; hidden = true; disabled = false;
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  appendChild(child: Element) { child.parent = this; this.children.push(child); return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  querySelector(selector: string) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector)!;
  }
  addEventListener(type: string, fn: (e: Event) => void) { this.listeners.set(type, fn); }
  click() { this.listeners.get('click')?.({}); }
}

type Contact = { id: number; x: number; y: number; o: number; g: number; p: number; touched: number };
function simulator() {
  const listeners = new Map<string, (e: Event) => void>();
  let rect = { left: 20, top: 200, width: 540, height: 960 };
  const body = new Element();
  const document = {
    body, documentElement: body,
    createElement: () => new Element(),
    querySelector: () => ({ getBoundingClientRect: () => rect }),
  };
  const win = {
    document, performance: { now: () => 0 },
    addEventListener: (type: string, fn: (e: Event) => void) => listeners.set(type, fn),
    requestAnimationFrame: () => 1,
    __board: { onAppVisibility() {}, onPauseResult() {} },
  } as unknown as Record<string, any>;
  runInNewContext(readFileSync('dev/browser-host.js', 'utf8'), {
    window: win, TextEncoder, MessageEvent, setTimeout,
  });
  let batch: Contact[] = [];
  win.boardTouch.onmessage = (event: MessageEvent) => { batch = JSON.parse(event.data).c; };
  const flush = () => { win.BoardSDK.__sim.flush(); return batch; };
  const pointer = (type: string, x: number, y: number, shift = false, pointerId = 1, alt = false) => {
    listeners.get(type)!({ clientX: x, clientY: y, shiftKey: shift, altKey: alt, pointerId, target: { closest: () => null } });
  };
  return { pointer, flush, listeners, win, root: body.children[0], resize: (next: typeof rect) => { rect = next; listeners.get('resize')?.({}); } };
}

test('a finger pressed and released before one animation frame reaches SDK subscribers as one tap', () => {
  const sim = simulator();
  const oldWindow = globalThis.window;
  Object.assign(globalThis, { window: sim.win });
  const phases: number[] = [];
  const onContacts = (contacts: readonly BoardContact[]) => {
    for (const c of contacts) if (c.type === BoardContactType.Finger) phases.push(c.phase);
  };
  Board.input.subscribe(onContacts);
  try {
    sim.pointer('pointerdown', 100, 300);
    sim.pointer('pointerup', 100, 300);
    sim.flush();
    assert.deepEqual(phases, [BoardContactPhase.Began, BoardContactPhase.Ended]);
    assert.equal(Board.input.getContacts().length, 0, 'a fast tap must not leave a stuck finger');
    sim.flush();
    assert.equal(phases.length, 2, 'the next frame must not repeat the tap');
  } finally {
    Board.input.unsubscribe(onContacts);
    if (oldWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else Object.assign(globalThis, { window: oldWindow });
  }
});

test('browser Sports placement maps an upright portrait canvas to native Board coordinates', () => {
  const sim = simulator();
  assert.equal(sim.win.document.documentElement.attributes['data-portrait-preview'], '');
  sim.pointer('pointerdown', 290, 892.5, true);
  const placed = sim.flush()[0];
  assert.equal(placed.g, 1);
  assert.equal(placed.p, 1);
  assert.equal(placed.x, 535);
  assert.equal(placed.y, 540);
  assert.equal(placed.o, 0, 'Sports native facing 0 points up in the portrait preview');
  sim.pointer('pointerup', 290, 892.5);
  const held = sim.flush()[0];
  assert.equal(held.id, placed.id);
  assert.equal(held.p, 2);
  assert.equal(held.touched, 0);
});

test('ordinary drag twists the Sports player and coalescing keeps its latest facing', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click();
  const placed = sim.flush()[0];
  // Grab 20 CSS pixels right of the centre, then drag right without moving the piece.
  sim.pointer('pointerdown', 310, 892.5);
  let contact = sim.flush()[0];
  assert.equal(contact.id, placed.id);
  assert.equal(contact.p, 2);
  assert.equal(contact.x, 535, 'touching an edge must not teleport the piece centre');
  assert.equal(contact.o, 0, 'pickup must not turn the piece');
  sim.pointer('pointermove', 325, 892.5);
  sim.pointer('pointermove', 340, 892.5);
  contact = sim.flush()[0];
  assert.equal(contact.id, placed.id);
  assert.equal(contact.x, 535);
  assert.equal(contact.y, 540);
  assert.equal(contact.o, 48, '30 CSS pixels = 60 logical pixels = 48 degrees');
  sim.pointer('pointermove', 320, 892.5);
  assert.equal(sim.flush()[0].o, 16, 'reversing the drag reverses the swing');
  sim.pointer('pointerup', 320, 892.5);
  assert.equal(sim.flush()[0].p, 2, 'release leaves the simulated piece resting');
});

test('Alt-drag moves the Sports player without rotating or jumping at pickup', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click(); sim.flush();
  sim.pointer('pointerdown', 310, 892.5, false, 1, true); sim.flush();
  sim.pointer('pointermove', 330, 862.5, false, 1, true);
  const moved = sim.flush()[0];
  assert.equal(moved.x, 595);
  assert.equal(moved.y, 580);
  assert.equal(moved.o, 0);
});

test('menu touches and clicks outside the piece remain fingers', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click(); sim.flush();
  sim.pointer('pointerdown', 100, 300);
  assert.equal(sim.flush()[0].g, 0);
  sim.pointer('pointerup', 100, 300); sim.flush();
  sim.pointer('pointerdown', 100, 100, true);
  assert.equal(sim.flush().length, 0, 'letterbox area is outside the glass');
});

test('Sports toolbar creates one contact, scales its upright proxy, and lifts it', () => {
  const sim = simulator();
  const place = sim.root.querySelector('.bs-place');
  place.click(); const placed = sim.flush()[0];
  place.click(); assert.equal(sim.flush().length, 0, 'Place player must not duplicate an existing piece');
  const layer = sim.root.querySelector('.bs-pieces');
  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0].style.left, '290px');
  assert.equal(layer.children[0].style.top, '892.5px');
  assert.equal(layer.children[0].style.width, '90px');
  assert.equal(layer.children[0].style.backgroundImage, 'url("piece-art/1.png")');
  sim.resize({ left: 0, top: 0, width: 1080, height: 1920 });
  assert.equal(layer.children[0].style.left, '540px');
  assert.equal(layer.children[0].style.top, '1385px');
  assert.equal(layer.children[0].style.width, '180px');
  sim.pointer('pointerdown', 540, 1385); sim.flush();
  sim.pointer('pointermove', 640, 1385); sim.flush();
  assert.equal(layer.children[0].children[0].style.transform, 'rotate(80deg)');
  assert.equal(layer.children[0].style.transform, undefined, 'canonical art stays upright while the facing arrow turns');
  sim.root.querySelector('.bs-lift').click();
  const lifted = sim.flush()[0];
  assert.equal(lifted.id, placed.id);
  assert.equal(lifted.p, 3);
  assert.equal(layer.children.length, 0);
  assert.equal(place.disabled, false);
});


test('pausing during a twist keeps Sports facing and permits pickup after redetection', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click(); sim.flush();
  sim.pointer('pointerdown', 290, 892.5); sim.flush();
  sim.pointer('pointermove', 340, 892.5); sim.flush();
  sim.listeners.get('keydown')!({ key: 'p', preventDefault() {} });
  sim.listeners.get('keydown')!({ key: 'p', preventDefault() {} });
  let redetected: Contact[] = [];
  for (let frame = 0; frame < 6; frame++) redetected = sim.flush();
  assert.equal(redetected[0].p, 1);
  assert.equal(redetected[0].touched, 0);
  assert.equal(redetected[0].o, 80);
  sim.pointer('pointerdown', 290, 892.5);
  const resumed = sim.flush()[0];
  assert.equal(resumed.id, redetected[0].id);
  assert.equal(resumed.g, 1);
  assert.equal(resumed.p, 2);
  assert.equal(resumed.o, 80, 'resume pickup must not reset the piece facing');
  sim.pointer('pointermove', 300, 892.5);
  assert.equal(sim.flush()[0].o, 96, 'a new drag continues from the retained orientation');
});
