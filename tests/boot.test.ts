// A headless stand-in for Studio's boot check (build-rules section 13), for `npm test` with no browser.
// It boots the real src/main.ts against stand-in globals: a canvas that records every call, a
// WebAudio context that accepts everything, files read off the disk, and a Board bridge whose host
// side is stubbed (one signed-in profile seated, as the simulated host has). Then it does the boot
// check's walk: the title draws, a piece at the centre and a piece near the bottom edge each get a
// visible answer, and a system-menu pause and resume neither throws nor stops the game.
// Keep it passing as the game grows; change the walk only when the game's own start path needs it.
// What it cannot do: look at pixels. Drawing calls are not proof that the game looks right, and
// none of this is proof of physical feel. Only a browser and a real Board can show those.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Board, BoardContactPhase, BoardContactType, BoardPlayerType, type BoardContact } from "@board.fun/web-sdk";
import { createGame, type GolfState } from "../src/rules";

// ---- the stand-in browser --------------------------------------------------------------------------
type Call = { name: string; args: unknown[] };
let calls: Call[] = [];
let gameLabel = "";
const frames: Call[][] = []; // the calls of each frame, newest last
const recorder = () => new Proxy({} as Record<string, unknown>, {
  get(state, key) {
    if (typeof key !== "string") return undefined;
    if (key === "canvas") return { width: 1920, height: 1080 };
    if (key in state) return state[key];
    return (...args: unknown[]) => {
      calls.push({ name: key, args });
      if (key === "measureText") {
        const width = String(args[0]).length * 0.6 * (parseFloat(String(state.font)) || 32);
        return { width, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width };
      }
      if (key === "getTransform") return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      return { addColorStop() {} }; // a gradient, for createLinearGradient and friends
    };
  },
  set(state, key, value) {
    if (typeof key === "string") { state[key] = value; calls.push({ name: `set ${key}`, args: [value] }); }
    return true;
  },
}) as unknown as CanvasRenderingContext2D;

const listeners: [string, (e: unknown) => void][] = [];
const listen = (type: string, handler: (e: unknown) => void) => { listeners.push([type, handler]); };
const fakeCanvas = () => ({
  width: 0, height: 0, style: {},
  getContext: () => recorder(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 }),
  addEventListener: listen, removeEventListener() {}, setAttribute(name: string, value: string) { if (name === "aria-label") gameLabel = value; },
});
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {},
  setTargetAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), Q: param() });

const g = globalThis as unknown as Record<string, unknown>;
let raf: ((ms: number) => void) | null = null;
let nowMs = 1000;
Object.defineProperty(performance, "now", { value: () => nowMs, configurable: true }); // frames and the game share one clock
g.requestAnimationFrame = (cb: (ms: number) => void) => { raf = cb; return 1; };
g.cancelAnimationFrame = () => { raf = null; };
g.document = { title: "", hidden: false, fonts: { add() {}, size: 0, ready: Promise.resolve() },
  querySelector: () => fakeCanvas(), createElement: () => fakeCanvas(), addEventListener: listen, removeEventListener() {} };
g.Image = class { onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 329; height = 337; naturalWidth = 329; naturalHeight = 337; complete = true; set src(_value: string) { queueMicrotask(() => this.onload?.()); } };
g.FontFace = class { load() { return Promise.resolve(this); } };
g.AudioContext = class {
  state = "running"; sampleRate = 48000; currentTime = 0; destination = {};
  createGain() { return node(); } createOscillator() { return node(); } createBiquadFilter() { return node(); }
  createBufferSource() { return node(); }
  createBuffer(_ch: number, length: number, sampleRate: number) { return { length, sampleRate, getChannelData: () => new Float32Array(length) }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer(1, 1, 48000)); }
  addEventListener() {} resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
};
// What the page would fetch comes off the disk (public/ is the site root); anything else is a 404.
g.fetch = async (url: string) => {
  try {
    const body = readFileSync(`public/${String(url).split("?")[0].replace(/^\.?\//, "")}`);
    return { ok: true, status: 200, json: async () => JSON.parse(body.toString("utf8")), text: async () => body.toString("utf8"),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
  } catch {
    return { ok: false, status: 404, json: async () => { throw new Error("404"); }, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
  }
};

// ---- the host's side of the Board bridge -------------------------------------------------------------
g.window = { addEventListener: listen, removeEventListener() {}, devicePixelRatio: 1, BoardSDK: {} }; // Board.isOnDevice
let onBatch: ((batch: readonly BoardContact[]) => void) | null = null;
const pauses: (() => void)[] = [];
const resumes: (() => void)[] = [];
const stub = (target: unknown, fields: Record<string, unknown>) => Object.assign(target as Record<string, unknown>, fields);
stub(Board.input, {
  subscribe: (cb: typeof onBatch) => { onBatch = cb; }, unsubscribe: () => { onBatch = null; }, getActiveModel: () => "model.dla",
});
stub(Board.application, {
  onPause: (cb: () => void) => { pauses.push(cb); return () => {}; },
  onResume: (cb: () => void) => { resumes.push(cb); return () => {}; },
});
const profile = { playerId: "p1", sessionId: 1, name: "Player 1", type: BoardPlayerType.Profile, avatarId: "0" };
stub(Board.session, {
  areServicesReady: () => true, isReady: () => true,
  getPlayers: () => [profile], getPlayerCount: () => 1,
  getActiveProfile: () => ({ ...profile, sessionId: -1 }),
  onPlayersChanged: () => () => {}, onActiveProfileChanged: () => () => {},
  setAIPlayerTypes() {}, presentAddPlayer: async () => false, presentReplacePlayer: async () => false,
});

// ---- driving it ----------------------------------------------------------------------------------------
const errors: unknown[] = [];
process.on("uncaughtException", e => errors.push(e));
process.on("unhandledRejection", e => errors.push(e));

function run(seconds: number) { // frames at 60 fps, the way a browser runs them
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    nowMs += 1000 / 60;
    const frame = raf;
    raf = null;
    if (!frame) return;
    calls = [];
    frame(nowMs);
    frames.push(calls);
  }
}
let nextId = 1;
const piece = (x: number, y: number, phase: BoardContactPhase, contactId: number) => ({
  contactId, glyphId: 1, x, y, orientation: 0, phase, type: BoardContactType.Glyph, isTouched: true,
}) as unknown as BoardContact;
function tap(x: number, y: number) {
  onBatch!([{ ...piece(x, y, BoardContactPhase.Began, nextId++), type: BoardContactType.Finger, glyphId: 0 }]);
  run(0.1);
}
const texts = (from: number, to = frames.length) =>
  [...new Set(frames.slice(from, to).flatMap(f => f.filter(c => c.name === "fillText").map(c => String(c.args[0]))))].sort().join("|");
// How different two frames are: 0 for the same drawing calls, 1 for nothing in common.
const sig = (f: Call[]) => f.map(c => `${c.name}(${c.args.map(a => (typeof a === "number" ? Math.round(a / 8) : typeof a === "object" ? "" : String(a))).join()})`);
function distance(a: Call[], b: Call[]) {
  const left = new Map<string, number>();
  for (const s of sig(a)) left.set(s, (left.get(s) ?? 0) + 1);
  let shared = 0;
  for (const s of sig(b)) { const n = left.get(s) ?? 0; if (n > 0) { shared++; left.set(s, n - 1); } }
  return 1 - shared / Math.max(1, Math.max(a.length, b.length));
}
/** Put a piece down, slide it 200 px, hold it and lift it (Studio's first move); return whether the screen answered. */
function firstMove(x: number, y: number) {
  run(1);
  const idle = distance(frames[frames.length - 2], frames[frames.length - 1]);
  const before = frames.length;
  const id = nextId++;
  onBatch!([piece(x, y, BoardContactPhase.Began, id)]);
  run(0.5);
  const answered = frames.slice(before).some(f => distance(frames[before - 1], f) > idle + 0.15)
    || texts(before) !== texts(before - 30, before);
  onBatch!([piece(x + 200, y, BoardContactPhase.Moved, id)]);
  run(1);
  onBatch!([piece(x + 200, y, BoardContactPhase.Ended, id)]);
  run(0.5);
  return answered;
}

// One test: it is one walk through the game in one process.
test("the game boots, draws its title, answers the first move and survives a pause", async () => {
  // The real platform's load() remains its startup snapshot after save(). Reproduce that
  // contract so menu visits and canceled selectors cannot accidentally resurrect old progress.
  await import("../src/platform-stub");
  const restoredGame = createGame();
  restoredGame.strokes = 2;
  restoredGame.ball.z = 82;
  restoredGame.lastSafe.z = 82;
  const restoredRun = { version: 1, playerId: "p1", game: restoredGame };
  type Run = { version: number; playerId: string; game: GolfState };
  const savedRuns: Run[] = [];
  let latestRun = structuredClone(restoredRun);
  let menuAction: (id: string) => void = () => assert.fail("game did not register menu actions");
  const platform = g.BoardPlatform as {
    state: { progress: { get: (key: string) => unknown } };
    menu: Record<string, unknown>;
  };
  stub(platform.state, {
    ready: async () => ({ restored: true, reason: "restored" }),
    load: () => structuredClone(restoredRun),
    save: (value: Run) => { latestRun = structuredClone(value); savedRuns.push(latestRun); },
  });
  stub(platform.menu, {
    onButton: (handler: (id: string) => void) => { menuAction = handler; return () => {}; },
  });
  await import("../src/main");
  for (let i = 0; i < 20 && !raf; i++) await new Promise(resolve => setTimeout(resolve, 10)); // ready(), fonts, footprints
  assert.ok(raf, "nothing asked for a frame, so the game never started");

  run(2.5);
  const title = frames[frames.length - 1];
  assert.ok(title.some(c => c.name === "fillText" || c.name === "drawImage"), "the title frame draws no text or image");
  assert.ok(title.length > 5, `the title frame made only ${title.length} drawing calls: a blank screen`);
  assert.deepEqual(errors, [], "the title threw");

  for (const pause of pauses) pause();
  run(0.3);
  assert.equal(savedRuns.length, 0, "opening the menu before Continue must not save the fresh placeholder game");
  assert.deepEqual(latestRun, restoredRun, "the pending two-stroke round must survive a title-screen menu visit");
  for (const resume of resumes) resume();
  run(0.2);
  assert.match(gameLabel, /^title/, "a menu visit leaves the pending round on its title screen");

  menuAction("help"); run(0.1);
  assert.match(gameLabel, /^howto/);
  menuAction("help"); run(0.1);
  tap(188, 962); // Help's Back button; a repeated menu action must preserve its original return destination.
  assert.match(gameLabel, /^title/, "opening help twice must not trap Back on the help screen");
  assert.equal(savedRuns.length, 0, "help before Continue must not consume or overwrite the pending save");

  assert.ok(firstMove(960, 540), "a piece put down at the centre got no visible answer");
  assert.deepEqual(errors, [], "the first move threw");
  assert.ok(firstMove(480, 810), "a piece put down near the bottom edge got no visible answer");
  assert.deepEqual(errors, [], "the second move threw");
  assert.match(gameLabel, /play.*2 strokes.*ready/, "the first legal ring placement adopts the pending round");
  assert.equal(latestRun.game.ball.z, 82, "adopting a saved round preserves its lie");

  for (const pause of pauses) pause();
  run(1);
  const paused = frames.length;
  for (const resume of resumes) resume();
  run(1);
  assert.ok(frames.length >= paused + 50, "the game did not draw again after the system menu closed");
  run(10); // and it keeps going with nobody touching anything
  assert.ok(frames[frames.length - 1].length > 5, "the game stopped drawing when left alone");
  assert.deepEqual(errors, [], "a pause and resume threw");

  // Drive the actual ring input through a whole hole, not a test-only game hook.
  menuAction("restart"); run(0.1);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "the real Restart hole action begins a new round");
  let id = nextId++;
  onBatch!([piece(960, 850, BoardContactPhase.Began, id)]);
  run(0.6);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "a roster player and a settled ring enter the hole");
  const move = (y: number, seconds: number) => {
    run(seconds);
    onBatch!([piece(960, y, BoardContactPhase.Moved, id)]);
  };
  const swing = (speed: number) => {
    move(850, 0.05); run(0.6);
    move(880, 0.05); move(910, 0.05); move(940, 0.05);
    for (let i=1;i<=7;i++) move(940-speed/60*i, 1/60);
    run(0.1);
  };
  swing(1272); // 90% iron: lands near the pin.
  assert.match(gameLabel, /1 strokes/, "one back-then-forward swing counts once");
  run(12);
  assert.match(gameLabel, /1 strokes.*ready/, "flight and roll reach a playable rest");

  // Three menu cycles preserve the shot and rebind the ring without another swing.
  for(let cycle=0;cycle<3;cycle++) {
    for(const pause of pauses)pause();
    run(0.4);
    for(const resume of resumes)resume();
    id=nextId++;
    onBatch!([piece(960, 790, BoardContactPhase.Began, id)]);
    run(0.6);
    assert.match(gameLabel, /1 strokes/, "menu redetection must not strike");
  }
  swing(624.32); // A controlled putt of about seven yards.
  run(8);
  assert.match(gameLabel, /over.*2 strokes.*holed/, "the physical gesture can finish the hole");
  run(5);
  assert.match(gameLabel, /over.*2 strokes.*holed/, "the result waits for a shared choice");
  onBatch!([{...piece(690,768,BoardContactPhase.Began,nextId++),type:BoardContactType.Finger,glyphId:0}]);
  run(0.5);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "rematch resets the hole with the ring left down");
  assert.equal(platform.state.progress.get("bestStrokes:p1"), 2, "the completed round records this golfer's personal best");

  menuAction("setup"); run(0.1);
  assert.match(gameLabel, /^setup/);
  tap(1540, 745); // Change player; the host stub dismisses the selector without a roster change.
  await new Promise(resolve => setTimeout(resolve, 0));
  run(0.1);
  assert.match(gameLabel, /^setup/, "canceling the player selector leaves setup in place");
  tap(1540, 905); // Explicitly confirm the retained ring and tee off again.
  run(0.5);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "a canceled selector cannot replay the startup two-stroke snapshot");
  assert.equal(latestRun.game.strokes, 0);
  assert.equal(latestRun.game.ball.z, 0);
  assert.deepEqual(errors, [], "the complete golf journey threw");

});
