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
import { createGame, distanceToCup, terrainAt, CLUBS, strike, stepGame, holeFor, roundStrokes, type GolfState } from "../src/rules";
import { toNative } from "../src/portrait";
import { TURN_SWING } from "../src/piece-control";

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
const raf = new Map<number, (ms: number) => void>();
let nextRafId = 1;
let nowMs = 1000;
Object.defineProperty(performance, "now", { value: () => nowMs, configurable: true }); // frames and the game share one clock
g.requestAnimationFrame = (cb: (ms: number) => void) => { const id = nextRafId++; raf.set(id, cb); return id; };
g.cancelAnimationFrame = (id: number) => { raf.delete(id); };
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
  subscribe: (cb: typeof onBatch) => { onBatch = cb; }, unsubscribe: () => { onBatch = null; }, getActiveModel: () => "model.tflite",
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
    // Like the browser, retain every scheduled callback and defer new requests to the next frame.
    for (const [id, frame] of [...raf]) {
      if (!raf.delete(id)) continue;
      calls = [];
      frame(nowMs);
      frames.push(calls);
    }
  }
}
let nextId = 1;
const piece = (x: number, y: number, phase: BoardContactPhase, contactId: number, orientation = 0) => ({
  contactId, glyphId: 5, x, y, orientation, phase, type: BoardContactType.Glyph, isTouched: true,
}) as unknown as BoardContact;
/** UI assertions use the player's portrait view; only the injected sensor contacts are native. */
function tap(x: number, y: number) {
  const position = toNative({ x, y });
  const finger = { ...piece(position.x, position.y, BoardContactPhase.Began, nextId++), type: BoardContactType.Finger, glyphId: 0 };
  onBatch!([finger]);
  run(0.1);
  onBatch!([{ ...finger, phase: BoardContactPhase.Ended }]);
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
test("portrait Sports golf restores, selects all clubs, survives pauses and completes a three-hole round and rematch", async t => {
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
  let finishRestore: () => void = () => assert.fail("restore promise not initialized");
  const ready = new Promise<{ restored: boolean }>(resolve => {
    finishRestore = () => resolve({ restored: true });
  });
  let menuAction: (id: string) => void = () => assert.fail("game did not register menu actions");
  const platform = g.BoardPlatform as {
    state: { progress: { get: (key: string) => unknown } };
    menu: Record<string, unknown>;
  };
  stub(platform.state, {
    ready: () => ready,
    load: () => structuredClone(restoredRun),
    save: (value: Run) => { latestRun = structuredClone(value); savedRuns.push(latestRun); },
  });
  stub(platform.menu, {
    onButton: (handler: (id: string) => void) => { menuAction = handler; return () => {}; },
  });
  await import("../src/main");
  await t.test("boot completed while paused waits for resume before scheduling a frame", async () => {
    for (const pause of pauses) pause();
    finishRestore();
    // All mocked asset loads complete in microtasks; drain them before checking paused boot.
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(raf.size, 0, "finishing boot under the menu must not schedule rendering");
    for (const resume of resumes) resume();
    assert.equal(raf.size, 1, "resume starts the completed boot exactly once");
  });
  assert.equal(raf.size, 1, "boot schedules exactly one frame");

  run(2.5);
  const title = frames[frames.length - 1];
  assert.ok(title.some(c => c.name === "fillText" || c.name === "drawImage"), "the title frame draws no text or image");
  assert.ok(title.length > 5, `the title frame made only ${title.length} drawing calls: a blank screen`);
  assert.deepEqual(errors, [], "the title threw");

  await t.test("pause and resume before the pending frame runs keep one rendering loop", () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const pause of pauses) pause();
      for (const resume of resumes) resume();
      assert.equal(raf.size, 1, "resume must replace the pending frame, not add another loop");
      const before = frames.length;
      run(0.1);
      assert.equal(frames.length - before, 6, "each display frame draws the game once");
      assert.equal(raf.size, 1, "one loop remains scheduled");
    }
    for (const pause of pauses) pause();
    assert.equal(raf.size, 0, "pause cancels the pending frame");
    const pausedFrames = frames.length;
    run(1);
    assert.equal(frames.length, pausedFrames, "the menu cannot advance rendering");
    for (const resume of resumes) resume();
    for (const resume of resumes) resume();
    assert.equal(raf.size, 1, "duplicate resume notifications do not add a loop");
  });

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
  tap(540, 1785); // Help's Back button; a repeated menu action must preserve its original return destination.
  assert.match(gameLabel, /^title/, "opening help twice must not trap Back on the help screen");
  assert.equal(savedRuns.length, 0, "help before Continue must not consume or overwrite the pending save");

  assert.ok(firstMove(960, 540), "a piece put down at the centre got no visible answer");
  assert.deepEqual(errors, [], "the first move threw");
  assert.ok(firstMove(535, 540), "a piece put down at the portrait player's short edge got no visible answer");
  assert.deepEqual(errors, [], "the second move threw");
  assert.match(gameLabel, /play.*2 strokes.*ready/, "the first legal Sports placement adopts the pending round");
  assert.equal(latestRun.game.ball.z, 82, "adopting a saved round preserves its lie");

  // Reproduce the native contact that was previously sensed but silently rejected.
  run(3); // finish the camera's previous saved-lie transition before touching the piece
  const cameraCheckStart = frames.length;
  const footballId = nextId++;
  const football = {...piece(687, 301, BoardContactPhase.Began, footballId, 131), glyphId: 6};
  onBatch!([football]); run(0.6);
  assert.match(gameLabel, /play.*2 strokes.*ready.*Sports player present.*ready/, 'the logged football position and arbitrary 41-degree facing can address');
  assert.equal(latestRun.game.strokes, 2, 'placement and calibration cannot strike');
  const turningFootball = {...football, x: football.x - 40, y: football.y + 5, orientation: football.orientation + 60, phase: BoardContactPhase.Moved};
  onBatch!([turningFootball]); run(0.6);
  assert.match(gameLabel, /backswing/, 'the camera check includes an actual armed physical turn');
  await t.test("duplicate resume while active retains the armed swing", () => {
    for (const resume of resumes) resume();
    run(0.1);
    assert.match(gameLabel, /backswing/, "a redundant resume cannot discard a live swing");
    assert.equal(raf.size, 1);
  });
  onBatch!([{...turningFootball, phase: BoardContactPhase.Ended}]); run(0.5);
  assert.equal(frames.slice(cameraCheckStart).flat().filter(c => c.name === 'clearRect' && c.args[2] === 1080 && c.args[3] === 1920).length,
    0, 'placement, a turning piece with translation, and lifting never reproject the course camera');


  for (const pause of pauses) pause();
  run(1);
  const paused = frames.length;
  for (const resume of resumes) resume();
  run(1);
  assert.ok(frames.length >= paused + 50, "the game did not draw again after the system menu closed");
  run(10); // and it keeps going with nobody touching anything
  assert.ok(frames[frames.length - 1].length > 5, "the game stopped drawing when left alone");
  assert.deepEqual(errors, [], "a pause and resume threw");

  // Drive real piece rotation and finger club/aim selection through a complete hole.
  menuAction("restart"); run(0.1);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "the real Restart hole action begins a new round");
  let id = nextId++;
  onBatch!([piece(535, 540, BoardContactPhase.Began, id)]);
  run(0.6);
  assert.match(gameLabel, /play.*0 strokes.*ready.*7 IRON.*Sports player present.*ready/, "a roster player and a settled Sports piece enter the hole");
  tap(204, 1805); // Select 9 iron, then return to the 150-yard 7 iron.
  assert.match(gameLabel, /9 IRON/, "club buttons select a club independently of the current lie");
  tap(876, 1655);
  assert.match(gameLabel, /7 IRON/);
  tap(936, 1425); // Aim two degrees right so the first stroke leaves a playable putt.
  run(0.5);
  let checkedImpactPause=false;
  const turn = (angle: number, seconds = 0.05) => {
    run(seconds);
    onBatch!([piece(535, 540, BoardContactPhase.Moved, id, angle)]);
    if(!checkedImpactPause&&latestRun.game.strokes===1&&latestRun.game.phase==='flight') {
      checkedImpactPause=true;
      run(0.04);
      for(const pause of pauses)pause(); // Saves the actual ball position at the physical strike.
      assert.ok(latestRun.game.ball.z > 0, 'the returning physical club launches the ball immediately');
      const atPause = latestRun.game.ball.z;
      run(1);
      assert.equal(latestRun.game.ball.z, atPause, 'a native menu freezes a committed ball');
      for(const resume of resumes)resume();
      run(1 / 60);
      for(const pause of pauses)pause();
      assert.equal(latestRun.game.ball.z, atPause, 'the first resumed frame excludes paused wall time');
      for(const resume of resumes)resume();
      run(0.05);
      for(const pause of pauses)pause();
      assert.ok(latestRun.game.ball.z > atPause, 'the same committed ball resumes after the menu');
      assert.equal(latestRun.game.strokes, 1, 'resume must not count the physical contact twice');
      for(const resume of resumes)resume();
    }
  };
  const swing = (backswing: number) => {
    turn(0); run(0.6);
    const samples = Math.ceil(backswing / 50);
    for (let i = 1; i <= samples; i++) turn(backswing * i / samples);
    const returnSamples = Math.max(2, Math.ceil(backswing / 50));
    for (let i = 1; i <= returnSamples; i++) turn(backswing * (1 - i / returnSamples));
    run(0.1);
  };
  swing(90);
  assert.ok(checkedImpactPause,'the real swing must exercise the impact/pause check');
  assert.match(gameLabel, /1 strokes/, "one backward-then-forward twist counts once");
  assert.equal(latestRun.game.shotPower, 1, "a quarter turn gives the selected 7 iron its full distance");
  assert.ok(latestRun.game.shotAngle > 0, "the finger aim control sets the shot direction");
  run(12);
  assert.match(gameLabel, /1 strokes.*ready/, "flight and roll reach a playable rest");
  assert.equal(terrainAt(latestRun.game.ball.x, latestRun.game.ball.z), "green", "the 7 iron reaches the par-3 green");
  assert.match(gameLabel, /PUTTER/, "the green recommends the putter");

  // Three menu cycles preserve the shot and rebind the piece without another swing.
  for(let cycle=0;cycle<3;cycle++) {
    for(const pause of pauses)pause();
    run(0.4);
    for(const resume of resumes)resume();
    id=nextId++;
    onBatch!([piece(535, 540, BoardContactPhase.Began, id)]);
    run(0.6);
    assert.match(gameLabel, /1 strokes/, "menu redetection must not strike");
  }
  // Constant green friction is 3 yd/s²; leave 1 yd/s at the cup instead of aiming for zero.
  const puttPower = (Math.sqrt(6 * distanceToCup(latestRun.game) + 1) - 1) / 14;
  assert.ok(puttPower > 0.1 && puttPower < 0.5, "the 7 iron leaves a short, controlled putt");
  const puttBackswing = TURN_SWING.backswingDeg - TURN_SWING.powerLeadDeg + puttPower * (TURN_SWING.fullBackswingDeg - TURN_SWING.backswingDeg + TURN_SWING.powerLeadDeg);
  swing(puttBackswing);
  run(8);
  assert.match(gameLabel, /over.*2 strokes.*holed/, "the physical gesture can finish the hole");
  run(5);
  assert.match(gameLabel, /over.*2 strokes.*holed/, "the result waits for a shared choice");
  // The result waits, then advances explicitly while preserving the seated piece and scorecard.
  tap(540, 1340);
  run(0.5);
  assert.match(gameLabel, /play.*Hole 2 of 3, par 4.*0 strokes.*ready.*DRIVER.*Sports player present/);
  assert.deepEqual(latestRun.game.completedStrokes, [2]);
  assert.equal(platform.state.progress.get("bestRoundStrokes:p1"), undefined, "one hole cannot count as a complete round best");

  const chooseClub = (club: typeof CLUBS[number]['id']) => {
    const index = CLUBS.findIndex(option => option.id === club);
    tap(48 + (index % 3) * 336 + 156, 1590 + Math.floor(index / 3) * 150 + 65);
    assert.ok(gameLabel.includes(club), `club selection should choose ${club}`);
  };
  chooseClub('5 IRON');
  chooseClub('DRIVER');
  for (let holeIndex = 1; holeIndex < 3; holeIndex++) {
    assert.equal(latestRun.game.holeIndex, holeIndex);
    // Deliberately play the new driver from each tee through the actual contact path.
    chooseClub('DRIVER'); swing(90); run(18);
    assert.equal(latestRun.game.strokes, 1, 'the driver clears the water and counts one stroke');
    assert.equal(latestRun.game.penalty, false);
    assert.equal(latestRun.game.phase, 'ready');
    let shots = 1;
    while (latestRun.game.phase === 'ready' && shots < 10) {
      // Search legal clean shots in the rule model, then execute the same chosen gesture in main.
      const source = latestRun.game;
      let bestShot: { club: typeof CLUBS[number]['id']; power: number; distance: number } | null = null;
      const clubs = terrainAt(source.ball.x, source.ball.z, holeFor(source)) === 'green'
        ? CLUBS.filter(c => c.id === 'PUTTER') : CLUBS.filter(c => c.id !== 'PUTTER');
      for (const club of clubs) for (let percent = 8; percent <= 100; percent++) {
        const trial = structuredClone(source);
        strike(trial, {power: percent / 100, angle: 0}, club.id);
        for (let frame = 0; frame < 40 && (trial.phase === 'flight' || trial.phase === 'rolling'); frame++) stepGame(trial, 1);
        const distance = trial.penalty ? Infinity : trial.phase === 'holed' ? -1 : distanceToCup(trial);
        if (!bestShot || distance < bestShot.distance) bestShot = {club: club.id, power: percent / 100, distance};
      }
      assert.ok(bestShot && Number.isFinite(bestShot.distance), 'each lie has a playable next stroke');
      chooseClub(bestShot.club);
      const turnDegrees = TURN_SWING.backswingDeg - TURN_SWING.powerLeadDeg + bestShot.power * (TURN_SWING.fullBackswingDeg - TURN_SWING.backswingDeg + TURN_SWING.powerLeadDeg);
      swing(turnDegrees); run(18); shots++;
    }
    assert.equal(latestRun.game.phase, 'holed', `hole ${holeIndex + 1} can be finished with the real swing`);
    assert.match(gameLabel, /^over/);
    const finishedScore = latestRun.game.strokes;
    run(3);
    assert.equal(latestRun.game.holeIndex, holeIndex, 'results never auto-advance');
    if (holeIndex === 1) {
      tap(540, 1340); run(0.5);
      assert.deepEqual(latestRun.game.completedStrokes, [2, finishedScore]);
      assert.match(gameLabel, /Hole 3 of 3, par 5/);
    }
  }
  const total = roundStrokes(latestRun.game);
  assert.equal(platform.state.progress.get("bestRoundStrokes:p1"), total, "the complete three-hole round records its total");
  tap(540, 1340); run(0.5);
  assert.match(gameLabel, /play.*Hole 1 of 3.*0 strokes.*ready.*Sports player present/, "rematch resets the round with the piece left down");
  assert.deepEqual(latestRun.game.completedStrokes, []);

  menuAction("setup"); run(0.1);
  assert.match(gameLabel, /^setup/);
  tap(540, 1115); // Change player; the host stub dismisses the selector without a roster change.
  await new Promise(resolve => setTimeout(resolve, 0));
  run(0.1);
  assert.match(gameLabel, /^setup/, "canceling the player selector leaves setup in place");
  const outside = toNative({x: 540, y: 1500});
  onBatch!([piece(outside.x, outside.y, BoardContactPhase.Moved, id)]); run(0.1);
  assert.ok(frames[frames.length - 1].some(c => c.name === 'fillText' && c.args[0] === 'TEE OFF'),
    "setup offers Tee Off for the detected Sports piece outside the swing area");
  tap(540, 1315); // A visible Tee Off button must confirm the retained piece at its current position.
  run(0.5);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "the visible Tee Off button starts play without replaying the startup two-stroke snapshot");
  assert.ok(frames[frames.length - 1].some(c => c.name === 'fillText' && c.args[0] === 'MOVE ONTO THE OPEN GRASS'),
    "play guides the confirmed piece into the swing area");
  for (const angle of [60, 90, 60, 0]) {
    onBatch!([piece(outside.x, outside.y, BoardContactPhase.Moved, id, angle)]); run(0.1);
    assert.match(gameLabel, /play.*0 strokes.*ready.*Sports player present.*settling/,
      "turning outside the swing area cannot arm or strike");
  }
  onBatch!([piece(535, 540, BoardContactPhase.Moved, id)]); run(0.5);
  assert.match(gameLabel, /play.*0 strokes.*ready.*Sports player present.*ready/,
    "sliding the same retained piece onto the grass permits a new swing without lifting");
  assert.equal(latestRun.game.strokes, 0);
  assert.equal(latestRun.game.ball.z, 0);
  assert.deepEqual(errors, [], "the complete golf journey threw");

});
