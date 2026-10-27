import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

type Event = Record<string, unknown>;
class Element {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: Element[] = [];
  parent: Element | null = null;
  listeners = new Map<string, (e: Event) => void>();
  nodes = new Map<string, Element>();
  className = ''; innerHTML = ''; hidden = true; disabled = false;
  setAttribute() {}
  appendChild(child: Element) { child.parent = this; this.children.push(child); return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  querySelector(selector: string) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector)!;
  }
  addEventListener(type: string, fn: (e: Event) => void) { this.listeners.set(type, fn); }
  click() { this.listeners.get('click')?.({}); }
}

type Contact = { id: number; x: number; y: number; g: number; p: number; touched: number };
function simulator() {
  const listeners = new Map<string, (e: Event) => void>();
  let rect = { left: 20, top: 200, width: 960, height: 540 };
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
  const pointer = (type: string, x: number, y: number, shift = false, pointerId = 1) => {
    listeners.get(type)!({ clientX: x, clientY: y, shiftKey: shift, pointerId, target: { closest: () => null } });
  };
  return { pointer, flush, listeners, root: body.children[0], resize: (next: typeof rect) => { rect = next; listeners.get('resize')?.({}); } };
}

test('browser ring placement maps a scaled canvas to Board coordinates', () => {
  const sim = simulator();
  sim.pointer('pointerdown', 500, 625, true);
  const placed = sim.flush()[0];
  assert.equal(placed.g, 1);
  assert.equal(placed.p, 1);
  assert.equal(placed.x, 960);
  assert.equal(placed.y, 850);
  sim.pointer('pointerup', 500, 625);
  const held = sim.flush()[0];
  assert.equal(held.id, placed.id);
  assert.equal(held.p, 2);
  assert.equal(held.touched, 0);
});

test('ordinary drag moves a placed ring without a new placement or pickup jump', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click();
  const placed = sim.flush()[0];
  // Grab 20 CSS pixels to the right of its center, then move down 30 CSS pixels.
  sim.pointer('pointerdown', 520, 625);
  let contact = sim.flush()[0];
  assert.equal(contact.id, placed.id);
  assert.equal(contact.p, 2);
  assert.equal(contact.x, 960, 'touching an edge must not teleport the ring center');
  sim.pointer('pointermove', 520, 655);
  contact = sim.flush()[0];
  assert.equal(contact.id, placed.id);
  assert.equal(contact.x, 960);
  assert.equal(contact.y, 910);
  sim.pointer('pointerup', 520, 655);
  assert.equal(sim.flush()[0].p, 2, 'release leaves the simulated piece resting');
});

test('menu touches and clicks outside the ring remain fingers', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click(); sim.flush();
  sim.pointer('pointerdown', 100, 300);
  assert.equal(sim.flush()[0].g, 0);
  sim.pointer('pointerup', 100, 300); sim.flush();
  sim.pointer('pointerdown', 100, 100, true);
  assert.equal(sim.flush().length, 0, 'letterbox area is outside the glass');
});

test('ring toolbar creates one contact, scales its proxy, and lifts it', () => {
  const sim = simulator();
  const place = sim.root.querySelector('.bs-place');
  place.click(); const placed = sim.flush()[0];
  place.click(); assert.equal(sim.flush().length, 0, 'Place ring must not duplicate an existing ring');
  const layer = sim.root.querySelector('.bs-pieces');
  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0].style.left, '500px');
  assert.equal(layer.children[0].style.top, '625px');
  assert.equal(layer.children[0].style.width, '81px');
  sim.resize({ left: 0, top: 0, width: 1920, height: 1080 });
  assert.equal(layer.children[0].style.left, '960px');
  assert.equal(layer.children[0].style.top, '850px');
  assert.equal(layer.children[0].style.width, '162px');
  sim.root.querySelector('.bs-lift').click();
  const lifted = sim.flush()[0];
  assert.equal(lifted.id, placed.id);
  assert.equal(lifted.p, 3);
  assert.equal(layer.children.length, 0);
  assert.equal(place.disabled, false);
});


test('pausing during a ring drag releases the pointer and permits pickup after redetection', () => {
  const sim = simulator();
  sim.root.querySelector('.bs-place').click(); sim.flush();
  sim.pointer('pointerdown', 500, 625); sim.flush();
  sim.listeners.get('keydown')!({ key: 'p', preventDefault() {} });
  sim.listeners.get('keydown')!({ key: 'p', preventDefault() {} });
  let redetected: Contact[] = [];
  for (let frame = 0; frame < 6; frame++) redetected = sim.flush();
  assert.equal(redetected[0].p, 1);
  assert.equal(redetected[0].touched, 0);
  sim.pointer('pointerdown', 500, 625);
  const resumed = sim.flush()[0];
  assert.equal(resumed.id, redetected[0].id);
  assert.equal(resumed.g, 1);
  assert.equal(resumed.p, 2);
});
