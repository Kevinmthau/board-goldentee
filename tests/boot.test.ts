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
import { Board, BoardContactPhase, BoardContactType, BoardPlayerType, type BoardContact, type BoardPlayer } from "@board.fun/web-sdk";
import { createGame, distanceToCup, terrainAt, CLUBS, HOLES, strike, stepGame, holeFor, roundStrokes, type GolfState } from "../src/rules";
import { toNative, toPortrait } from "../src/portrait";
import { TURN_SWING } from "../src/piece-control";
import { CLUB_BAG_BUTTON, CLUB_BOXES } from '../src/club-picker';
import { createRound, saveRound, type SavedRound, type GolfRound } from '../src/multiplayer';
import { PLAYER_ROWS, REMOVE_PLAYER_ROWS, ADD_PLAYER, RESTORE_PLAYERS_BUTTON } from '../src/multiplayer-view';

// ---- the stand-in browser --------------------------------------------------------------------------
type Call = { name: string; args: unknown[] };
let calls: Call[] = [];
let recordGeometry = true;
let gameLabel = "";
const frames: Call[][] = []; // the calls of each frame, newest last
const recorder = () => new Proxy({} as Record<string, unknown>, {
  get(state, key) {
    if (typeof key !== "string") return undefined;
    if (key === "canvas") return { width: 1920, height: 1080 };
    if (key in state) return state[key];
    return (...args: unknown[]) => {
      if (recordGeometry || key === "fillText") calls.push({ name: key, args });
      if (key === "measureText") {
        const width = String(args[0]).length * 0.6 * (parseFloat(String(state.font)) || 32);
        return { width, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width };
      }
      if (key === "getTransform") return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      return { addColorStop() {} }; // a gradient, for createLinearGradient and friends
    };
  },
  set(state, key, value) {
    if (typeof key === "string") { state[key] = value; if (recordGeometry) calls.push({ name: `set ${key}`, args: [value] }); }
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
const profile: BoardPlayer = { playerId: "p1", sessionId: 1, name: "Player 1", type: BoardPlayerType.Profile, avatarId: "0" };
let sessionPlayers: BoardPlayer[] = [profile];
const rosterListeners = new Set<(players: BoardPlayer[]) => void>();
const selectorCalls: (number | undefined)[] = [];
let nextSelection: ((replaceSessionId?: number) => boolean) | null = null;
const changeRoster = (players: BoardPlayer[]) => {
  sessionPlayers = players.map(player => ({...player}));
  for (const listener of rosterListeners) listener(sessionPlayers);
};
const selectPlayer = async (replaceSessionId?: number) => {
  selectorCalls.push(replaceSessionId);
  const select = nextSelection; nextSelection = null;
  return select?.(replaceSessionId) ?? false;
};
stub(Board.session, {
  areServicesReady: () => true, isReady: () => true,
  getPlayers: () => sessionPlayers, getPlayerCount: () => sessionPlayers.length,
  getActiveProfile: () => ({ ...profile, sessionId: -1 }),
  onPlayersChanged: (listener: (players: BoardPlayer[]) => void) => { rosterListeners.add(listener); return () => rosterListeners.delete(listener); },
  onActiveProfileChanged: () => () => {},
  setAIPlayerTypes() {}, presentAddPlayer: () => selectPlayer(), presentReplacePlayer: (id: number) => selectPlayer(id),
  removePlayer: (id: number) => changeRoster(sessionPlayers.filter(player => player.sessionId !== id)),
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
  const placed = toPortrait({x, y});
  const arrivalSplash = frames.slice(before).some(f => f.some(c => c.name === 'arc' &&
    c.args[0] === placed.x && c.args[1] === placed.y && Number(c.args[2]) > 0));
  const answered = arrivalSplash || frames.slice(before).some(f => distance(frames[before - 1], f) > idle + 0.15)
    || texts(before) !== texts(before - 30, before);
  onBatch!([piece(x + 200, y, BoardContactPhase.Moved, id)]);
  run(1);
  onBatch!([piece(x + 200, y, BoardContactPhase.Ended, id)]);
  run(0.5);
  return answered;
}

// One test: it is one walk through the game in one process.
test("portrait Sports golf restores solo saves, completes nine holes, and plays one-to-four-player rounds with guarded handoffs", async t => {
  // The real platform's load() remains its startup snapshot after save(). Reproduce that
  // contract so menu visits and canceled selectors cannot accidentally resurrect old progress.
  await import("../src/platform-stub");
  const restoredGame = createGame();
  restoredGame.strokes = 2;
  restoredGame.ball.z = 82;
  restoredGame.lastSafe.z = 82;
  const restoredRun = { version: 1 as const, playerId: "p1", game: restoredGame };
  type Run = { version: 1; playerId: string; game: GolfState } | SavedRound;
  const savedRuns: Run[] = [];
  let latestRun: Run = structuredClone(restoredRun);
  let loadSnapshot: Run | undefined = structuredClone(restoredRun);
  const restoreListeners = new Set<() => void>();
  const activeGame = () => latestRun.version === 1 ? latestRun.game : latestRun.round.players[latestRun.round.activeIndex].game;
  const latestRound = (): GolfRound => {
    assert.equal(latestRun.version, 2, 'new saves use the multiplayer schema');
    return (latestRun as SavedRound).round;
  };
  let finishRestore: () => void = () => assert.fail("restore promise not initialized");
  const ready = new Promise<{ restored: boolean }>(resolve => {
    finishRestore = () => resolve({ restored: true });
  });
  let menuAction: (id: string) => void = () => assert.fail("game did not register menu actions");
  const platform = g.BoardPlatform as {
    state: { progress: { get: (key: string) => unknown; set: (key: string, value: number) => void } };
    menu: Record<string, unknown>;
  };
  platform.state.progress.set("bestRoundStrokes:p1", 8); // Previous three-hole best must stay separate.
  stub(platform.state, {
    ready: () => ready,
    load: () => structuredClone(loadSnapshot),
    save: (value: Run) => { latestRun = structuredClone(value); savedRuns.push(latestRun); },
    onRestore: (listener: () => void) => { restoreListeners.add(listener); return () => restoreListeners.delete(listener); },
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
  assert.match(gameLabel, /^title/, "placing a piece on arbitrary grass cannot start the round");
  assert.deepEqual(latestRun, restoredRun, "off-target placement leaves the pending save untouched");
  assert.ok(texts(frames.length - 1).includes(profile.name), 'the start target identifies the roster player');

  await t.test('the named circle ignores fingers and held pieces across help and pause, then binds the exact placed piece', () => {
    tap(540, 1385); run(0.5);
    assert.match(gameLabel, /^title/, 'a finger cannot claim the named placement target');
    const handId = nextId++;
    const hand = {...piece(535, 540, BoardContactPhase.Began, handId), type: BoardContactType.Hand};
    onBatch!([hand]); run(0.5);
    assert.match(gameLabel, /^title/, 'a Hand contact with a Sports glyph ID cannot start');
    onBatch!([{...hand, phase: BoardContactPhase.Ended}]); run(0.1);

    const strayId = nextId++;
    onBatch!([piece(960, 540, BoardContactPhase.Began, strayId)]); run(0.5);
    assert.match(gameLabel, /^title/, 'a live Sports piece elsewhere cannot start');
    let targetId = nextId++;
    onBatch!([piece(535, 540, BoardContactPhase.Began, targetId)]); run(0.1);
    assert.match(gameLabel, /^title/, 'a brief pass through the circle is not a start');
    menuAction('help'); run(0.4); tap(540, 1785); run(0.6);
    assert.match(gameLabel, /^title/, 'returning from help cannot confirm a piece left in the circle');
    onBatch!([piece(700, 540, BoardContactPhase.Moved, targetId)]); run(0.4);
    onBatch!([piece(535, 540, BoardContactPhase.Moved, targetId)]); run(0.1);
    for (const pause of pauses) pause(); run(0.4);
    for (const resume of resumes) resume();
    targetId = nextId++;
    onBatch!([piece(535, 540, BoardContactPhase.Began, targetId)]); run(0.7);
    assert.match(gameLabel, /^title/, 'pause redetection under a new contact ID cannot confirm the circle');
    onBatch!([piece(700, 540, BoardContactPhase.Moved, targetId)]); run(0.4);
    // Reintroduce the stray after the pause epoch cleared the sensor snapshot.
    onBatch!([piece(960, 540, BoardContactPhase.Began, strayId)]); run(0.1);
    onBatch!([piece(535, 540, BoardContactPhase.Moved, targetId)]); run(0.8);
    assert.match(gameLabel, /play.*2 strokes.*ready/, 'a fresh settled entry adopts the pending round');
    assert.equal(activeGame().ball.z, 82, 'adopting a saved round preserves its lie');
    onBatch!([piece(535, 540, BoardContactPhase.Moved, targetId, 60)]); run(0.1);
    assert.match(gameLabel, /backswing/, 'the piece in the named circle owns the swing, despite the other live piece');
    assert.equal(activeGame().strokes, 2, 'placement and backswing cannot commit a shot');
    onBatch!([piece(535, 540, BoardContactPhase.Ended, targetId, 60),
      piece(960, 540, BoardContactPhase.Ended, strayId)]); run(0.5);
  });

  // Reproduce the native contact that was previously sensed but silently rejected.
  run(3); // finish the camera's previous saved-lie transition before touching the piece
  const cameraCheckStart = frames.length;
  const footballId = nextId++;
  const football = {...piece(687, 301, BoardContactPhase.Began, footballId, 131), glyphId: 6};
  onBatch!([football]); run(0.6);
  assert.match(gameLabel, /play.*2 strokes.*ready.*Sports player present.*ready/, 'the logged football position and arbitrary 41-degree facing can address');
  assert.equal(activeGame().strokes, 2, 'placement and calibration cannot strike');
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

  // The long round needs text evidence only; discard earlier geometry instead of retaining every terrain point.
  recordGeometry = false; frames.length = 0;
  // Drive real piece rotation and finger club/aim selection through a complete hole.
  menuAction("restart"); run(0.1);
  assert.match(gameLabel, /play.*0 strokes.*ready/, "the real Restart hole action begins a new round");
  let id = nextId++;
  onBatch!([piece(535, 540, BoardContactPhase.Began, id)]);
  run(0.6);
  assert.match(gameLabel, /play.*0 strokes.*ready.*7 IRON.*Sports player present.*ready/, "a roster player and a settled Sports piece enter the hole");
  const chooseClub = (club: typeof CLUBS[number]['id']) => {
    tap(CLUB_BAG_BUTTON.x + CLUB_BAG_BUTTON.width / 2, CLUB_BAG_BUTTON.y + CLUB_BAG_BUTTON.height / 2);
    assert.match(gameLabel, /^clubs/, 'club bag opens without consuming a stroke');
    const {box} = CLUB_BOXES.find(option => option.club.id === club)!;
    tap(box.x + box.width / 2, box.y + box.height / 2);
    assert.match(gameLabel, /^play/);
    assert.ok(gameLabel.includes(club), `club selection should choose ${club}`);
  };
  for (const club of CLUBS) chooseClub(club.id);
  chooseClub('9 IRON');
  assert.match(gameLabel, /9 IRON/, "club buttons select a club independently of the current lie");
  chooseClub('7 IRON');
  assert.match(gameLabel, /7 IRON/);
  tap(936, 1425); // Aim two degrees right so the first stroke leaves a playable putt.
  run(0.5);
  let checkedImpactPause=false;
  const turn = (angle: number, seconds = 0.05) => {
    run(seconds);
    onBatch!([piece(535, 540, BoardContactPhase.Moved, id, angle)]);
    if(!checkedImpactPause&&activeGame().strokes===1&&activeGame().phase==='flight') {
      checkedImpactPause=true;
      run(0.04);
      for(const pause of pauses)pause(); // Saves the actual ball position at the physical strike.
      assert.ok(activeGame().ball.z > 0, 'the returning physical club launches the ball immediately');
      const atPause = activeGame().ball.z;
      run(1);
      assert.equal(activeGame().ball.z, atPause, 'a native menu freezes a committed ball');
      for(const resume of resumes)resume();
      run(1 / 60);
      for(const pause of pauses)pause();
      assert.equal(activeGame().ball.z, atPause, 'the first resumed frame excludes paused wall time');
      for(const resume of resumes)resume();
      run(0.05);
      for(const pause of pauses)pause();
      assert.ok(activeGame().ball.z > atPause, 'the same committed ball resumes after the menu');
      assert.equal(activeGame().strokes, 1, 'resume must not count the physical contact twice');
      for(const resume of resumes)resume();
    }
  };
  let checkedPuttHud = false;
  const swing = (backswing: number) => {
    turn(0); run(0.6);
    const samples = Math.ceil(backswing / 50);
    for (let i = 1; i <= samples; i++) turn(backswing * i / samples);
    if (!checkedPuttHud && gameLabel.includes('PUTTER')) {
      run(0.05);
      assert.match(gameLabel, /backswing/, 'a putt uses the shared backswing state');
      assert.match(texts(frames.length - 1), /\d+%/, 'putting displays the same percentage power feedback as other clubs');
      assert.doesNotMatch(texts(frames.length - 1), /PRECISION PUTTING|FT ON LEVEL GREEN|0\.25°/);
      checkedPuttHud = true;
    }
    const returnSamples = Math.max(2, Math.ceil(backswing / 50));
    for (let i = 1; i <= returnSamples; i++) turn(backswing * (1 - i / returnSamples));
    run(0.1);
  };
  swing(90);
  assert.ok(checkedImpactPause,'the real swing must exercise the impact/pause check');
  assert.match(gameLabel, /1 strokes/, "one backward-then-forward twist counts once");
  assert.equal(activeGame().shotPower, 1, "a quarter turn gives the selected 7 iron its full distance");
  assert.ok(activeGame().shotAngle > 0, "the finger aim control sets the shot direction");
  run(12);
  assert.match(gameLabel, /1 strokes.*ready/, "flight and roll reach a playable rest");
  assert.equal(terrainAt(activeGame().ball.x, activeGame().ball.z), "green", "the 7 iron reaches the par-3 green");
  assert.match(gameLabel, /PUTTER/, "the green recommends the putter");
  tap(936, 1425); run(0.1);
  assert.match(gameLabel, /PUTTER.*Aim R 2°/, 'one putting aim tap moves two degrees');
  tap(144, 1425); run(0.1);
  assert.match(gameLabel, /PUTTER.*Aim 0°/, 'the opposite tap restores the original putting aim');

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
  // Read the actual sloping green, then execute the shared two-degree aim and linear physical turn.
  let finishPutt: {power: number; steps: number} | null = null;
  for (let steps = -22; steps <= 22 && !finishPutt; steps++) for (let percent = 8; percent <= 80; percent++) {
    const trial = structuredClone(activeGame());
    strike(trial, {power: percent / 100, angle: steps * Math.PI / 90}, 'PUTTER');
    for (let frame = 0; frame < 30 && trial.phase === 'rolling'; frame++) stepGame(trial, 1);
    if (trial.phase === 'holed') { finishPutt = {power: percent / 100, steps}; break; }
  }
  assert.ok(finishPutt, 'the green has a reachable putt with the restored two-degree aim and minimum swing power');
  for (let step = 0; step < Math.abs(finishPutt.steps); step++) tap(finishPutt.steps < 0 ? 144 : 936, 1425);
  const puttBackswing = 36 + 54 * finishPutt.power;
  swing(puttBackswing);
  assert.ok(checkedPuttHud, 'the actual finishing putt verified restored power feedback');
  run(8);
  assert.match(gameLabel, /over.*2 strokes.*holed/, "the physical gesture can finish the hole");
  run(5);
  assert.match(gameLabel, /over.*2 strokes.*holed/, "the result waits for a shared choice");
  // The result waits, then advances explicitly while preserving the seated piece and scorecard.
  tap(540, 1570);
  run(0.5);
  assert.match(gameLabel, /play.*Hole 2 of 9, par 4.*0 strokes.*ready.*DRIVER.*Sports player present/);
  assert.deepEqual(activeGame().completedStrokes, [2]);
  assert.equal(platform.state.progress.get("nineHoleBestRoundStrokes:p1"), undefined, "one hole cannot count as a complete round best");

  const beforeCard = structuredClone(activeGame());
  tap(870, 1655); run(0.3);
  assert.match(gameLabel, /^scorecard/);
  assert.match(texts(frames.length - 1), /SCORECARD/);
  run(1);
  assert.deepEqual(activeGame(), beforeCard, 'looking at the scorecard cannot change strokes or wind');
  tap(540, 1570); run(0.5);
  assert.match(gameLabel, /^play/);
  assert.deepEqual(activeGame(), beforeCard, 'Back returns to the same lie');
  menuAction('scorecard'); run(0.1);
  menuAction('help'); run(0.1);
  menuAction('scorecard'); run(0.1);
  tap(540, 1570); run(0.5);
  assert.match(gameLabel, /^play/, 'switching help and scorecard preserves the underlying play screen');
  menuAction('scorecard'); run(0.1); menuAction('help'); run(0.1);
  tap(540, 1785); run(0.5);
  assert.match(gameLabel, /^play/, 'help opened over the card also returns to play');
  chooseClub('5 IRON');
  chooseClub('DRIVER');
  for (let holeIndex = 1; holeIndex < HOLES.length; holeIndex++) {
    frames.length = 0; // Keep capture memory bounded across nine complete holes.
    assert.equal(activeGame().holeIndex, holeIndex);
    // Exercise the long driver carries, then use the selected club appropriate to each new hole.
    if (holeIndex === 1 || holeIndex === 2) {
      chooseClub('DRIVER'); swing(90); run(18);
      assert.equal(activeGame().strokes, 1, 'the driver clears the water and counts one stroke');
      assert.equal(activeGame().penalty, false);
      assert.equal(activeGame().phase, 'ready');
    }
    let shots = activeGame().strokes;
    while (activeGame().phase === 'ready' && shots < 10) {
      // Search legal clean shots in the rule model, then execute the same chosen gesture in main.
      const source = activeGame();
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
    assert.equal(activeGame().phase, 'holed', `hole ${holeIndex + 1} can be finished with the real swing`);
    assert.match(gameLabel, /^over/);
    const finishedScore = activeGame().strokes;
    run(3);
    assert.equal(activeGame().holeIndex, holeIndex, 'results never auto-advance');
    if (holeIndex < HOLES.length - 1) {
      const priorScores = [...activeGame().completedStrokes];
      assert.equal(platform.state.progress.get('nineHoleBestRoundStrokes:p1'), undefined);
      tap(540, 1570); run(0.5);
      assert.deepEqual(activeGame().completedStrokes, [...priorScores, finishedScore]);
      assert.ok(gameLabel.includes(`Hole ${holeIndex + 2} of 9`));
    }
  }
  const total = roundStrokes(activeGame());
  assert.match(texts(frames.length - 1), /ROUND COMPLETE/);
  assert.match(texts(frames.length - 1), /SCORECARD/);
  assert.equal(platform.state.progress.get('bestRoundStrokes:p1'), 8, 'the earlier three-hole record is preserved');
  assert.equal(platform.state.progress.get("nineHoleBestRoundStrokes:p1"), total, "the complete nine-hole round records its total");
  tap(540, 1570); run(0.5);
  assert.match(gameLabel, /play.*Hole 1 of 9.*0 strokes.*ready.*Sports player present/, "rematch resets the round with the piece left down");
  assert.deepEqual(activeGame().completedStrokes, []);

  menuAction("setup"); run(0.1);
  assert.match(gameLabel, /^setup/);
  tap(PLAYER_ROWS[0].x + 200, PLAYER_ROWS[0].y + 70); // Change player; the host stub dismisses the selector without a roster change.
  await new Promise(resolve => setTimeout(resolve, 0));
  run(0.1);
  assert.match(gameLabel, /^setup/, "canceling the player selector leaves setup in place");
  run(0.6);
  assert.match(gameLabel, /^setup/, 'returning to setup and canceling selection cannot reuse a piece left on the name');
  const outside = toNative({x: 540, y: 1500});
  onBatch!([piece(outside.x, outside.y, BoardContactPhase.Moved, id)]); run(0.5);
  assert.match(gameLabel, /^setup/, 'a detected piece outside the name circle does not start');
  for (const angle of [60, 90, 60, 0]) {
    onBatch!([piece(outside.x, outside.y, BoardContactPhase.Moved, id, angle)]); run(0.1);
    assert.match(gameLabel, /^setup/, 'turning outside the name circle cannot bypass startup');
  }
  onBatch!([piece(535, 540, BoardContactPhase.Moved, id)]); run(0.8);
  assert.match(gameLabel, /play.*0 strokes.*ready.*Sports player present.*ready/,
    'sliding onto the named circle starts fresh play without a finger confirmation or lift');
  assert.equal(activeGame().strokes, 0);
  assert.equal(activeGame().ball.z, 0);
  assert.deepEqual(errors, [], "the complete golf journey threw");

  const tapBox = (box: {x: number; y: number; width: number; height: number}) => tap(box.x + box.width / 2, box.y + box.height / 2);
  const settleSelector = async () => { await new Promise(resolve => setTimeout(resolve, 0)); run(0.2); };
  const addGuest = async (count: number) => {
    const before = selectorCalls.length;
    nextSelection = replacement => {
      assert.equal(replacement, undefined, 'Add player opens the native add selector');
      // Native guests need not have persistent profile IDs. Seat IDs distinguish them.
      changeRoster([...sessionPlayers, {playerId: '', sessionId: count, name: ['Lee', 'Sam', 'Alex'][count - 2], type: BoardPlayerType.Guest, avatarId: '0'}]);
      return true;
    };
    tapBox(ADD_PLAYER); await settleSelector();
    assert.equal(selectorCalls.length, before + 1);
    assert.equal(sessionPlayers.length, count);
    assert.match(gameLabel, /^setup/);
  };
  const beginGroup = (count: number) => {
    onBatch!([piece(700, 540, BoardContactPhase.Moved, id)]); run(0.4);
    onBatch!([piece(535, 540, BoardContactPhase.Moved, id)]); run(0.8);
    assert.match(gameLabel, new RegExp(`^play.*${count} players.*Player 1`), 'named placement confirms the first golfer');
    assert.equal(latestRound().players.length, count);
    assert.deepEqual(latestRound().players.map(p => p.game.strokes), Array(count).fill(0));
  };
  const placeForTurn = () => {
    onBatch!([piece(700, 540, BoardContactPhase.Moved, id)]); run(0.4);
    assert.match(gameLabel, /^handoff/, 'placing on grass outside the named circle cannot confirm a turn');
    onBatch!([piece(535, 540, BoardContactPhase.Moved, id)]); run(0.8);
    assert.match(gameLabel, /^play.*Sports player present.*ready/, 'a fresh settled entry in the named circle starts the turn');
  };
  let pendingGroupSave: SavedRound | null = null;
  let originalGroupRoster: BoardPlayer[] = [];
  await t.test('two and three players join through the selector and rotate with independent strokes', async () => {
    for (const count of [2, 3]) {
      menuAction('setup'); run(0.1);
      await addGuest(count); beginGroup(count);
      assert.equal(latestRound().activeIndex, 0, 'the named starter owns the first turn');
      swing(90); run(15);
      assert.equal(latestRound().activeIndex, 1);
      assert.deepEqual(latestRound().players.map(p => p.game.strokes), [1, ...Array(count - 1).fill(0)]);
      assert.match(gameLabel, /^handoff.*Player 2: Lee/);
      const nextTurn = structuredClone(latestRound());
      run(3);
      assert.match(gameLabel, /^handoff/, 'a retained piece cannot start the next golfer’s turn');
      assert.deepEqual(latestRound(), nextTurn, 'waiting for placement never advances a ball or score');
      const selectors = selectorCalls.length;
      tap(540, 1570); run(0.7);
      assert.match(gameLabel, /^handoff/, 'the former Ready finger target cannot begin a turn');
      assert.equal(selectorCalls.length, selectors, 'a normal turn does not open the roster selector');
      assert.deepEqual(latestRound(), nextTurn);
      assert.ok(texts(frames.length - 1).includes('Lee’s turn'), 'the course announces whose turn it is');
      assert.ok(!texts(frames.length - 1).includes('READY'), 'normal turns have no Ready button');
      recordGeometry = true;
      run(1 / 60);
      const handoffFrame = frames.at(-1)!;
      recordGeometry = false;
      assert.ok(handoffFrame.some(c => c.name === 'drawImage'), 'the course remains drawn while waiting for a player');
      assert.ok(!handoffFrame.some(c => c.name === 'fillRect' &&
        c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 1080 && c.args[3] === 1920),
      'normal turn placement cannot cover the course with an interstitial');
      onBatch!([piece(700, 540, BoardContactPhase.Moved, id)]); run(0.7);
      assert.match(gameLabel, /^handoff/, 'an off-circle Sports piece cannot begin a turn');
      tap(540, 1385); run(0.7);
      assert.match(gameLabel, /^handoff/, 'a finger on the named circle cannot begin a turn');
      const wrongId = nextId++;
      onBatch!([{...piece(535, 540, BoardContactPhase.Began, wrongId), glyphId: 9}]); run(0.7);
      assert.match(gameLabel, /^handoff/, 'a non-player glyph cannot claim the named circle');
      onBatch!([{...piece(535, 540, BoardContactPhase.Ended, wrongId), glyphId: 9}]); run(0.1);
      assert.deepEqual(latestRound(), nextTurn, 'rejected placements keep the next player’s lie');
    }
  });

  await t.test('four players finish a hole, retain turns through pause, and advance together', async () => {
    menuAction('setup'); run(0.1);
    await addGuest(4); beginGroup(4);
    originalGroupRoster = sessionPlayers.map(p => ({...p}));
    const selectors = selectorCalls.length;
    menuAction('setup'); run(0.1); tapBox(ADD_PLAYER); await settleSelector();
    assert.equal(selectorCalls.length, selectors, 'four players cannot open a fifth add selector');
    beginGroup(4);
    let checkedPause = false;
    let checkedMovingRoster = false;
    let shotCount = 0;
    while (!latestRound().players.every(p => p.game.phase === 'limit' || p.game.phase === 'holed')) {
      frames.length = 0;
      const before = structuredClone(latestRound());
      const activeIndex = before.activeIndex;
      if (activeIndex === 2 && !pendingGroupSave) pendingGroupSave = structuredClone(latestRun as SavedRound);
      assert.match(gameLabel, /^handoff|^play/);
      if (gameLabel.startsWith('handoff')) {
        // The previous person's return gesture cannot become the new player's shot.
        swing(90);
        assert.deepEqual(latestRound(), before, 'unconfirmed turn input leaves every ball and score unchanged');
        if (!checkedPause && activeIndex === 1) {
          checkedPause = true;
          for (const pause of pauses) pause(); run(1);
          assert.deepEqual(latestRound(), before, 'pause keeps the pending handoff and all four lies');
          for (const resume of resumes) resume();
          id = nextId++;
          onBatch!([piece(535, 540, BoardContactPhase.Began, id)]); run(0.7);
          assert.match(gameLabel, /^handoff.*Player 2: Lee/);
          assert.deepEqual(latestRound(), before, 'piece redetection does not confirm another person’s turn');
        }
        placeForTurn();
      }
      // Tiny real putts from the tee finish by the normal ten-stroke limit.
      // This exercises input, settlement, rotation, and the final shared result cheaply.
      chooseClub('PUTTER'); swing(40);
      if (!checkedMovingRoster) {
        checkedMovingRoster = true;
        assert.ok(['flight', 'rolling'].includes(activeGame().phase), 'the roster interrupt starts during a committed shot');
        const moving = structuredClone(latestRound());
        changeRoster(originalGroupRoster.slice(0, 3)); run(1);
        assert.match(gameLabel, /^handoff/);
        assert.ok(texts(frames.length - 1).includes('ROUND PAUSED'));
        assert.deepEqual(latestRound(), moving, 'a missing participant freezes the committed ball without discarding its stroke');
        changeRoster(originalGroupRoster); run(0.1);
        assert.match(gameLabel, /^play/, 'restoring the roster resumes the committed shot');
        assert.equal(latestRound().players[activeIndex].game.strokes, moving.players[activeIndex].game.strokes);
      }
      run(12);
      const after = latestRound();
      assert.equal(after.players[activeIndex].game.strokes, before.players[activeIndex].game.strokes + 1, 'exactly the active player receives the stroke');
      for (let i = 0; i < 4; i++) if (i !== activeIndex) assert.deepEqual(after.players[i].game, before.players[i].game, `player ${i + 1} keeps their own lie, penalties, and score`);
      assert.ok(++shotCount <= 40, 'four ten-stroke limits bound the hole');
    }
    assert.ok(checkedPause, 'the group journey exercised a pending-turn pause');
    assert.ok(checkedMovingRoster, 'the group journey exercised roster recovery during a committed shot');
    assert.equal(shotCount, 40);
    assert.match(gameLabel, /^over/);
    assert.deepEqual(latestRound().players.map(p => p.game.strokes), [10, 10, 10, 10]);
    assert.match(texts(frames.length - 1), /EVERYONE IS IN/);
    for (const name of ['Lee', 'Sam', 'Alex']) assert.ok(texts(frames.length - 1).includes(name), `the scorecard identifies ${name}`);
    const result = structuredClone(latestRound()); run(3);
    assert.deepEqual(latestRound(), result, 'the shared result waits for a decision');
    tap(540, 1570); run(0.7);
    assert.match(gameLabel, /^handoff.*Player 1.*Hole 2 of 9/);
    assert.deepEqual(latestRound().players.map(p => p.game.completedStrokes), [[10], [10], [10], [10]]);
    assert.deepEqual(latestRound().players.map(p => p.game.strokes), [0, 0, 0, 0]);
    const nextHole = structuredClone(latestRound());
    menuAction('scorecard'); run(0.1);
    assert.match(gameLabel, /^scorecard/);
    for (const name of ['Lee', 'Sam', 'Alex']) assert.ok(texts(frames.length - 1).includes(name));
    tap(540, 1570); run(0.1);
    assert.match(gameLabel, /^handoff/);
    assert.deepEqual(latestRound(), nextHole, 'scorecard returns to the same pending turn');
  });

  await t.test('replacement and removal cannot inherit another participant’s scores', async () => {
    const oldRound = structuredClone(latestRound());
    const oldGuest = {...sessionPlayers[1]};
    menuAction('setup'); run(0.1);
    nextSelection = replacement => {
      assert.equal(replacement, oldGuest.sessionId, 'replacement uses the seated ID, never the active profile’s -1');
      changeRoster(sessionPlayers.map(p => p.sessionId === replacement ? {...p, playerId: 'replacement-lee', name: 'Jo'} : p));
      return true;
    };
    tapBox(PLAYER_ROWS[1]); await settleSelector();
    assert.match(gameLabel, /^setup/);
    assert.deepEqual(latestRound(), oldRound, 'selecting a different person does not transfer or erase the saved round');
    tapBox(REMOVE_PLAYER_ROWS[2]); run(0.2);
    assert.equal(sessionPlayers.length, 3);
    assert.deepEqual(latestRound(), oldRound, 'removing a participant from setup preserves the previous saved scores');
    beginGroup(3);
    assert.match(gameLabel, /^play.*3 players/);
    assert.deepEqual(latestRound().players.map(p => p.name), ['Player 1', 'Jo', 'Alex']);
    assert.ok(latestRound().players.every(p => p.game.strokes === 0 && p.game.completedStrokes.length === 0), 'an explicit new setup starts every participant from zero');
    assert.equal(latestRound().players[1].playerId, 'replacement-lee');
  });
  await t.test('late four-player restore preserves its pending turn and restores the correct missing guest', async () => {
    assert.ok(pendingGroupSave, 'the played four-person round produced a pending third-player turn');
    loadSnapshot = undefined;
    const savesBeforeSwitch = savedRuns.length;
    changeRoster([{...profile, playerId: 'other-profile', sessionId: 99, name: 'Other profile'}]); run(0.2);
    assert.match(gameLabel, /^title/);
    changeRoster([profile]); run(0.2);
    assert.match(gameLabel, /^title/);
    assert.equal(savedRuns.length, savesBeforeSwitch, 'profile transitions cannot write the old round into a new owner’s slot');
    loadSnapshot = structuredClone(pendingGroupSave);
    for (const restore of restoreListeners) restore(); run(0.2);
    assert.match(texts(frames.length - 1), /CONTINUE/, 'a late multiplayer save becomes available from the title');
    assert.ok(texts(frames.length - 1).includes('Sam'), 'the continuation target identifies the saved active golfer');
    onBatch!([piece(535, 540, BoardContactPhase.Ended, id)]); run(1.2);
    id = nextId++;
    onBatch!([piece(535, 540, BoardContactPhase.Began, id)]); run(0.7);
    assert.match(gameLabel, /^handoff.*4 players.*Player 3: Sam/, 'placing a piece restores multiplayer directly, without losing Continue behind setup');
    assert.deepEqual(latestRun, pendingGroupSave, 'restore keeps every saved ball, score, and the next player');
    assert.ok(texts(frames.length - 1).includes('ROUND PAUSED'), 'missing roster participants stop play');
    tapBox(RESTORE_PLAYERS_BUTTON); await settleSelector();
    assert.equal(selectorCalls.at(-1), undefined, 'missing players use Add while seats are available');
    assert.match(gameLabel, /^handoff/);
    assert.deepEqual(latestRun, pendingGroupSave, 'canceling restoration cannot discard or alter the saved round');
    changeRoster(originalGroupRoster.map(p => p.sessionId === 4 ? {...p, name: 'Different guest'} : p)); run(0.2);
    nextSelection = replacement => {
      assert.equal(replacement, 4, 'the full roster replaces the missing guest’s seat, not another blank-ID guest');
      changeRoster(originalGroupRoster);
      return true;
    };
    tapBox(RESTORE_PLAYERS_BUTTON); await settleSelector();
    assert.match(gameLabel, /^handoff.*Player 3: Sam/);
    assert.ok(texts(frames.length - 1).includes('Sam’s turn'), 'restored participants return to the named placement on the course');
    assert.deepEqual(latestRun, pendingGroupSave, 'rejoining participants retain their own saved progress');
    placeForTurn();
    assert.match(gameLabel, /^play.*Player 3: Sam/);
    assert.deepEqual(latestRun, pendingGroupSave, 'named placement preserves the restored lie without inventing a stroke');
  });
  await t.test('explicit guest restoration accepts a new session ID without transferring scores during ordinary replacement', async () => {
    const saved = structuredClone(latestRun as SavedRound);
    const priorGuest = {...sessionPlayers.find(p => p.sessionId === 2)!};
    assert.equal(saved.round.players[1].playerId, '');
    assert.equal(saved.round.players[1].game.strokes, 1, 'the guest has an actual played stroke to restore');
    changeRoster(sessionPlayers.filter(p => p.sessionId !== priorGuest.sessionId)); run(0.2);
    assert.match(gameLabel, /^handoff.*Player 3: Sam/);
    assert.ok(texts(frames.length - 1).includes('Player 2: Lee'), 'restoration identifies the specific missing guest');
    const beforeCancel = structuredClone(latestRun);
    tapBox(RESTORE_PLAYERS_BUTTON); await settleSelector();
    assert.equal(selectorCalls.at(-1), undefined);
    assert.deepEqual(latestRun, beforeCancel, 'canceling the guest selector changes neither identity nor game state');
    assert.equal(sessionPlayers.length, 3);
    nextSelection = replacement => {
      assert.equal(replacement, undefined, 'a returning guest uses an available session seat');
      changeRoster([...sessionPlayers, {...priorGuest, sessionId: 22}]);
      return true;
    };
    tapBox(RESTORE_PLAYERS_BUTTON); await settleSelector();
    const restored = structuredClone(latestRun as SavedRound);
    const expected = structuredClone(saved);
    expected.round.players[1].sessionId = 22;
    assert.deepEqual(restored, expected, 'explicit RESTORE changes only the selected guest’s session identity');
    assert.equal(latestRound().activeIndex, 2, 'restoring another participant preserves the pending Sam turn');
    assert.equal(latestRound().players[1].game.strokes, 1);
    assert.match(gameLabel, /^handoff.*Player 3: Sam/);
    assert.ok(texts(frames.length - 1).includes('Sam’s turn'));
    placeForTurn();
    assert.deepEqual(latestRun, restored, 'confirming play keeps the restored score and ball');

    menuAction('setup'); run(0.1);
    const index = sessionPlayers.findIndex(p => p.sessionId === 22);
    nextSelection = replacement => {
      assert.equal(replacement, 22);
      changeRoster(sessionPlayers.map(p => p.sessionId === replacement ? {...p, name: 'Different guest'} : p));
      return true;
    };
    tapBox(PLAYER_ROWS[index]); await settleSelector();
    assert.match(gameLabel, /^setup/);
    assert.deepEqual(latestRun, restored, 'the ordinary Change player selector cannot reassign saved guest scores to another guest in the same seat');
  });
  await t.test('the last unfinished multiplayer golfer must place again for each shot', () => {
    const finalRoster = [profile, {playerId: '', sessionId: 25, name: 'Finisher', type: BoardPlayerType.Guest, avatarId: '0'}];
    const finishingRound = createRound(finalRoster);
    const finished = finishingRound.players[0].game;
    finished.strokes = 1; finished.phase = 'holed';
    finished.ball = {...finished.ball, ...holeFor(finished).flag, y: 0, vx: 0, vz: 0, vy: 0};
    finishingRound.activeIndex = 1;
    loadSnapshot = undefined;
    changeRoster([{...profile, playerId: 'other-profile', sessionId: 99, name: 'Other profile'}]); run(0.2);
    changeRoster(finalRoster); run(0.2);
    loadSnapshot = saveRound(finishingRound, profile.playerId);
    for (const restore of restoreListeners) restore(); run(0.2);
    assert.match(gameLabel, /^title/);
    assert.ok(texts(frames.length - 1).includes('Finisher'));
    onBatch!([piece(700, 540, BoardContactPhase.Moved, id)]); run(0.4);
    onBatch!([piece(535, 540, BoardContactPhase.Moved, id)]); run(0.8);
    assert.match(gameLabel, /^play.*Player 2: Finisher/, 'saved continuation confirms this golfer directly from the title circle');
    for (const expectedStrokes of [1, 2]) {
      chooseClub('PUTTER'); swing(40); run(12);
      assert.equal(latestRound().activeIndex, 1, 'finished golfers are skipped');
      assert.equal(activeGame().strokes, expectedStrokes);
      assert.match(gameLabel, /^handoff.*Player 2: Finisher/, 'the same remaining golfer gets a fresh placement turn');
      const settled = structuredClone(latestRound());
      run(1); tap(540, 1570); run(0.7);
      assert.match(gameLabel, /^handoff/, 'a held piece or finger cannot start the next shot');
      assert.deepEqual(latestRound(), settled, 'waiting for reentry keeps both golfers’ progress');
      assert.deepEqual(latestRound().players[0].game, finished, 'the finished golfer keeps the completed hole');
      if (expectedStrokes === 1) placeForTurn();
    }
  });
  assert.deepEqual(errors, [], 'the complete one-to-four-player journey threw');
});
