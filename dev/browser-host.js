// Based on the Studio generated browser host. Local preview additions: portrait input, Sports proxy, and twist controls.
// The web lane's simulated Board host, injected by assets/board-app/boot_capture.cjs so a
// packed Create Game candidate boots in a headless browser the way it does on a Board.
(() => {
"use strict";
// Browser host — a simulated Board host so the packaged game is playable with a
// mouse or a touch screen in a plain browser (Studio preview, `vite dev`, QA).
//
// It installs ONLY when `window.BoardSDK` is undefined. On a real Board the OS
// injects the bridge before any script runs, so this module is inert there and
// the game keeps ONE code path: `Board.isOnDevice` is true under this host and
// the pinned @board.fun/web-sdk parses the same wire frames it parses on the
// glass (dist/input.js parseContact/parsePollContact, pause.js HOST_ACTION_MAP,
// bridge.js window.__board resolve/reject/onPauseResult/onAppVisibility).
//
//   drag         one finger contact (glyphId 0): Began → Moved… → Ended
//   shift-click  a resting Sports Piece (glyphId `__sim.glyph`, default 1)
//   drag piece   twist its facing; Alt-drag moves it; the piece stays after release
//   backspace    lift every resting Piece
//   P / Escape   open the simulated system menu (Board.application.onPause fires);
//                inside it: Enter/P resume · Q quit · S save & quit (only when the
//                pause context has offerSaveOption) · 1-9 custom buttons ·
//                M / N toggle the first / second audio track (delivered on resume)
//
// Board.save is simulated the way a Board keeps it: saves outlive a reload of the
// page (this origin's web storage, written through the untouched Storage methods,
// or memory where storage is refused), a save's players are the live roster when
// it is created, a blank description or a roster with no profile is rejected,
// loading a save reseats the session to its players, and save covers do not exist
// (no Board has them yet; `window.__boardSimProfile = { covers: true }` before this
// host installs adds them). The active profile always reports sessionId -1, and
// Board services come up a moment after the page starts. As on a Board, a profile's
// id is raw in a save's players and hashed with the app id in the session
// (getActiveProfile, getPlayers): libboard's hashProfileIdWithAppId, see sessionIdOf.
//
// The stream behaves like the sensor, not like a mouse: a resting Piece is not
// re-reported every frame but in single-frame untouched Moved blips 100-700 ms
// apart with empty frames between; NO frame at all arrives while the system
// menu is open; and after it closes a few empty frames pass before the resting
// Pieces are detected again under fresh ids. A game must never read "this piece
// was not in the last frame" as "this piece was lifted".
//
// The "BROWSER SIMULATOR" label and `window.BoardSDK.__sim` are browser-only;
// `isSimulatedHost()` is the sanctioned way to branch on them, and nothing here
// is evidence of native behaviour (knowledge/POLICY.md).
//
// The platform layer (board-platform.js) is packed with every game and loads
// first; under `vite dev` its in-memory stand-in comes from this import.

/** Set on window before the host installs: what kind of Board to simulate. */

// The Board bridge reads a pause-menu track value with JSONObject.optInt("value", 50): a
// number is truncated to an integer (0.6 becomes 0) and anything unreadable becomes 50.
// The host keeps (and later returns) that integer, so a game sending 0-1 gains hears 0 here
// exactly as it would on a Board.
function boardTrackValue(value         )         {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : 50;
}
const hostTrack = (t       )        => ({ ...t, value: boardTrackValue(t.value) });
// The system menu upper-cases a button's icon and looks it up; anything else shows no icon.
const ICONS                         = { CIRCULAR_ARROW: "↻", DOOR_WITH_ARROW: "⇥", LEFT_ARROW: "←", SQUARE: "■" };
function boardIcon(icon         )         {
  return typeof icon === "string" ? ICONS[icon.toUpperCase()] ?? "" : "";
}
// SHA-256 of a string's UTF-8, as lowercase hex. Synchronous (the session's getters are),
// so it cannot be crypto.subtle; checked against node:crypto in tests/astra/browser_host.test.mjs.
function sha256Hex(text        )         {
  const bytes = new TextEncoder().encode(text);
  const K           = [], H           = [];
  for (let n = 2; K.length < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (!prime) continue;
    if (H.length < 8) H.push(((n ** (1 / 2) % 1) * 2 ** 32) >>> 0);
    K.push(((n ** (1 / 3) % 1) * 2 ** 32) >>> 0);
  }
  const words = new Uint32Array(((bytes.length + 9 + 63) >> 6) << 4);
  bytes.forEach((b, i) => (words[i >> 2] |= b << (24 - (i % 4) * 8)));
  words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[words.length - 1] = bytes.length * 8;
  const rotr = (x        , r        ) => (x >>> r) | (x << (32 - r));
  const w = new Uint32Array(64);
  for (let off = 0; off < words.length; off += 16) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = words[off + i];
      else {
        const a = w[i - 15], b = w[i - 2];
        w[i] = w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10));
      }
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
  }
  return H.map((v) => v.toString(16).padStart(8, "0")).join("");
}
const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The simulated Board's one profile: a raw id, as UDS keeps it. */
const SIM_PROFILE_ID = "5e1f0b0a-4d00-4c1e-8000-00000000517d";
const REDETECT_FRAMES = 6; // empty frames between the menu closing and a resting Piece being born again
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const STYLE = `[data-board-sim]{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font:12px ui-monospace,monospace;color:#fff}
[data-board-sim] .bs-toolbar{position:absolute;left:8px;top:8px;width:280px;max-width:280px;display:flex;align-items:flex-start;flex-direction:column;gap:6px;pointer-events:none}
[data-board-sim] .bs-toolbar button{pointer-events:auto;cursor:pointer;min-height:30px}
[data-board-sim] .bs-hint{padding:4px 8px;border-radius:4px;background:rgba(0,0,0,.7);user-select:none}
[data-board-sim][data-toolbar-layout="compact"] .bs-toolbar{right:8px;max-width:none;flex-direction:row;flex-wrap:wrap;gap:4px}
[data-board-sim][data-toolbar-layout="compact"] .bs-hint{display:none}
[data-board-sim] .bs-pieces{position:absolute;inset:0;pointer-events:none}
[data-board-sim] .bs-piece{position:absolute;transform:translate(-50%,-50%);background:center/contain no-repeat;pointer-events:none;opacity:.92}
[data-board-sim] .bs-piece[data-held="true"]{opacity:1}
[data-board-sim] .bs-facing{position:absolute;inset:0;transform-origin:center;color:#fff5ad;text-shadow:0 1px 2px #102e2c}
[data-board-sim] .bs-facing::before{content:"↑";position:absolute;left:50%;top:-.5em;transform:translateX(-50%);line-height:1}
[data-board-sim] .bs-menu{z-index:2}
[data-board-sim] .bs-menu{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);pointer-events:auto}
[data-board-sim] .bs-menu[hidden]{display:none}
[data-board-sim] .bs-card{min-width:320px;padding:16px 20px;border-radius:8px;background:#1a1a2e;box-shadow:0 8px 32px #000}
[data-board-sim] .bs-card h2{margin:0 0 12px;font-size:14px}
[data-board-sim] .bs-card div{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
[data-board-sim] button{font:inherit;color:#fff;background:#33415c;border:0;border-radius:4px;padding:6px 10px;cursor:pointer}`;

/** True when the game runs under this simulated host (never on a real Board). */
function isSimulatedHost(win         = window)          {
  return (win.BoardSDK                                      )?.__simulated === true;
}

/** Install the simulated host. Returns false, touching nothing, when a real bridge exists. */
function installBrowserHost(win         = window)          {
  if (typeof win.BoardSDK !== "undefined") return false;
  const doc = win.document;
  // The game still renders in native Board coordinates. Only the browser preview is upright.
  doc.documentElement.setAttribute("data-portrait-preview", "");
  const board = () => win.__board;
  const esc = (s        ) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

  // --- contacts: delta frames at frame rate, exactly what the sensor host pushes
  const live = new Map              ();
  const byPointer = new Map                ();
  const pointerOffsets = new Map();
  let renderPieces = () => {};
  let pending         = [];
  let lastBatch         = [];
  let nextId = 1;
  let selectorOpen = false;
  let cancelSelector = () => {};
  const push = (c      , p        ) => {
    let prev                  ;
    for (let i = pending.length - 1; i >= 0 && !prev; i--) if (pending[i].id === c.id) prev = pending[i];
    if (prev && prev.p === 2 && p === 2) return void Object.assign(prev, { x: c.x, y: c.y, o: c.o, touched: c.touched });
    pending.push({ id: c.id, x: c.x, y: c.y, o: c.o, p, g: c.g, touched: c.touched });
  };
  const touch = { onmessage: null                                          , postMessage() {} };
  // Resting Pieces the sensor keeps re-reporting: the host's own (shift-drag) and
  // those a harness injects through __sim.emit. Deterministic jitter per contact.

  const rests = new Map              ();
  const now = () => (win.performance ? win.performance.now() : Date.now());
  const rest = (c      ) => {
    const r = rests.get(c.id) ?? { c, seed: (c.id * 2654435761) >>> 0, due: 0 };
    r.seed = (r.seed * 1664525 + 1013904223) >>> 0;
    (r.c = { ...c, p: 2, touched: 0 }), (r.due = now() + 100 + (r.seed % 601)), rests.set(c.id, r);
  };
  // Every event for a contact restarts its blip clock; a lift or a hand on it stops the blips.
  const track = (c      ) => (c.g === 0 || c.p === 3 || c.p === 4 || c.touched ? rests.delete(c.id) : rest(c));
  const blip = () => {
    const t = now();
    for (const r of rests.values()) if (t >= r.due && !pending.some((c) => c.id === r.c.id)) pending.push({ ...r.c }), rest(r.c);
  };
  let redetectIn = 0;
  const redetect = () => {
    // New observation epoch: resting Pieces are re-detected under fresh ids.
    for (const c of [...live.values()]) live.delete(c.id), (c.id = nextId++), live.set(c.id, c), push(c, 1);
  };
  const flush = () => {
    // The native overlay switches the detector off: nothing crosses the wire.
    if (menuOpen || selectorOpen) return void (pending = []);
    if (redetectIn > 0 && --redetectIn === 0) redetect();
    blip();
    const events = pending;
    pending = [];
    const send = (batch) => {
      batch.forEach(track);
      lastBatch = batch;
      touch.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ c: batch }) }));
    };
    // A fast browser click can begin and end between animation frames. The SDK
    // keeps one state per contact in a wire frame, so separate lifecycle changes
    // or Ended would erase Began before subscribers ever see the tap.
    let batch = [];
    const ids = new Set();
    for (const c of events) {
      if (ids.has(c.id)) { send(batch); batch = []; ids.clear(); }
      batch.push(c); ids.add(c.id);
    }
    send(batch);
  };
  const raf = (cb            ) => (win.requestAnimationFrame ? win.requestAnimationFrame(cb) : setTimeout(cb, 16));
  const loop = () => (flush(), renderPieces(), raf(loop));
  raf(loop);
  const end = (c      ) => (live.delete(c.id), (c.touched = 0), push(c, 3));
  const endFingers = () => {
    live.forEach((c) => { if (!c.resting) end(c); else if (c.touched) (c.touched = 0), push(c, 2); });
    byPointer.clear(); pointerOffsets.clear();
  };
  const liftResting = () => live.forEach((c) => c.resting && end(c));
  const fromShim = (e       ) => Boolean((e.target                  )?.closest?.("[data-board-sim]"));
  // Convert browser pointer positions only. Native Board contacts never pass through here.
  const canvasRect = () => doc.querySelector("#game")?.getBoundingClientRect();
  const toWorld = (e) => {
    const r = canvasRect();
    if (!r || r.width <= 0 || r.height <= 0) return null;
    const portraitX = (e.clientX - r.left) * 1080 / r.width;
    const portraitY = (e.clientY - r.top) * 1920 / r.height;
    return { x: 1920 - portraitY, y: portraitX };
  };
  // Sports catalog radii, millimetres × 3.6 Board pixels. This only controls mouse pickup.
  const pickupRadius = (glyph) => ({ 1: 18.7, 2: 19.8, 3: 19.4, 4: 21.8, 5: 24.4, 6: 18.3, 7: 18.7, 8: 18.5 }[glyph] ?? 18.7) * 3.6;
  const pointerAnchor = (e, p, c) => ({ x: p.x - c.x, y: p.y - c.y, startAcross: p.y, orientation: c.o, translate: Boolean(e.altKey) });
  const onDown = (e) => {
    if (menuOpen || selectorOpen || fromShim(e)) return;
    const p = toWorld(e);
    if (!p || p.x < 0 || p.x > 1920 || p.y < 0 || p.y > 1080) return;
    let c;
    for (const r of live.values()) if (r.resting && ![...byPointer.values()].includes(r.id) && Math.hypot(r.x - p.x, r.y - p.y) <= pickupRadius(r.g)) c = r;
    if (c) {
      pointerOffsets.set(e.pointerId, pointerAnchor(e, p, c));
      c.touched = 1; push(c, 2);
    } else {
      c = { id: nextId++, x: p.x, y: p.y, o: 0, p: 1, g: e.shiftKey ? host.__sim.glyph : 0, touched: 1, resting: e.shiftKey };
      pointerOffsets.set(e.pointerId, pointerAnchor(e, p, c));
      live.set(c.id, c); push(c, 1);
    }
    byPointer.set(e.pointerId, c.id);
    renderPieces();
  };
  const onMove = (e) => {
    const c = live.get(byPointer.get(e.pointerId) ?? -1), p = toWorld(e);
    if (!c || !p) return;
    const offset = pointerOffsets.get(e.pointerId) ?? { x: 0, y: 0 };
    if (c.resting && !offset.translate) {
      c.o = ((offset.orientation + (p.y - offset.startAcross) * 0.8) % 360 + 360) % 360;
    } else {
      c.x = p.x - offset.x; c.y = p.y - offset.y;
    }
    push(c, 2);
    renderPieces();
  };
  const onUp = (e) => {
    const c = live.get(byPointer.get(e.pointerId) ?? -1);
    byPointer.delete(e.pointerId); pointerOffsets.delete(e.pointerId);
    if (c && c.resting) (c.touched = 0), push(c, 2);
    else if (c) end(c);
    renderPieces();
  };

  // --- simulated system menu: pause/resume, quit, custom buttons, audio gains
  let ctx               = {};
  let tracks          = [];
  let menuOpen = false;
  let tracksChanged = false;
  const quits           = [];
  const restore = new Map                ();
  const root = doc.createElement("div");
  root.setAttribute("data-board-sim", "");
  root.innerHTML = `<style>${STYLE}</style><div class="bs-pieces" aria-hidden="true"></div><div class="bs-toolbar"><button type="button" class="bs-place">Place sports player</button><button type="button" class="bs-lift">Lift piece</button><button type="button" class="bs-label">Menu · P</button><span class="bs-hint">BROWSER SIMULATOR · drag piece sideways to twist · Alt-drag to move · Shift-click to place</span></div><div class="bs-menu" hidden></div>`;
  (doc.body ?? doc.documentElement).appendChild(root);
  const label = root.querySelector(".bs-label")               ;
  const menu = root.querySelector(".bs-menu")               ;
  const proxyLayer = root.querySelector(".bs-pieces");
  const placeButton = root.querySelector(".bs-place");
  const liftButton = root.querySelector(".bs-lift");
  const toolbar = root.querySelector(".bs-toolbar");
  const proxies = new Map();
  renderPieces = () => {
    const r = canvasRect();
    if (!r) return;
    // Use the empty side of a desktop portrait preview, instead of covering the player's edge.
    const rail = r.left >= 200;
    const toolbarLayout = rail ? "rail" : "compact";
    const toolbarWidth = rail ? `${Math.min(280, r.left - 16)}px` : "auto";
    if (root.dataset.toolbarLayout !== toolbarLayout) root.dataset.toolbarLayout = toolbarLayout;
    if (toolbar.style.width !== toolbarWidth) toolbar.style.width = toolbarWidth;
    const stillHere = new Set();
    for (const c of live.values()) {
      if (!c.resting) continue;
      stillHere.add(c.id);
      let proxy = proxies.get(c.id);
      if (!proxy) {
        proxy = doc.createElement("div"); proxy.className = "bs-piece";
        proxy.style.backgroundImage = `url("piece-art/${c.g}.png")`;
        const facing = doc.createElement("span"); facing.className = "bs-facing"; proxy.appendChild(facing);
        proxyLayer.appendChild(proxy); proxies.set(c.id, proxy);
      }
      const key = [r.left, r.top, r.width, r.height, c.x, c.y, c.o, c.touched].join(",");
      if (proxy.dataset.pose === key) continue;
      proxy.dataset.pose = key; proxy.dataset.held = String(Boolean(c.touched));
      proxy.style.left = `${r.left + c.y * r.width / 1080}px`;
      proxy.style.top = `${r.top + (1920 - c.x) * r.height / 1920}px`;
      proxy.style.width = `${180 * r.width / 1080}px`;
      proxy.style.height = `${180 * r.height / 1920}px`;
      const facing = proxy.children[0];
      facing.style.transform = `rotate(${c.o}deg)`;
      facing.style.fontSize = `${48 * r.width / 1080}px`;
    }
    for (const [id, proxy] of proxies) if (!stillHere.has(id)) { proxy.remove(); proxies.delete(id); }
    placeButton.disabled = [...live.values()].some(c => c.resting && c.g === 1);
    liftButton.disabled = ![...live.values()].some(c => c.resting);
  };
  placeButton.addEventListener("click", () => {
    if (menuOpen || selectorOpen || [...live.values()].some(c => c.resting && c.g === 1)) return;
    const c = { id: nextId++, x: 535, y: 540, o: 0, p: 1, g: 1, touched: 0, resting: true };
    live.set(c.id, c); push(c, 1); renderPieces();
  });
  liftButton.addEventListener("click", () => { if (!menuOpen && !selectorOpen) { liftResting(); renderPieces(); } });
  win.addEventListener("resize", renderPieces);

  const renderMenu = () => {
    const save = ctx.offerSaveOption ? `<button data-act="save">Save &amp; quit · S</button>` : "";
    const custom = (ctx.customButtons ?? []).map((b, i) => `<button data-act="custom" data-id="${esc(b.id)}">${i + 1} · ${boardIcon(b.icon)}${boardIcon(b.icon) ? " " : ""}${esc(b.title)}</button>`);
    const audio = tracks.map((t, i) => `<button data-act="track" data-i="${i}">${["M", "N"][i] ?? "·"} · ${esc(t.name)} ${t.value}</button>`);
    menu.innerHTML = `<div class="bs-card"><h2>${esc(ctx.gameName ?? "Game")} · system menu (simulated)</h2><div><button data-act="resume">Resume · Enter</button><button data-act="quit">Quit · Q</button>${save}</div><div>${custom.join("")}</div><div>${audio.join("")}</div></div>`;
  };
  const openMenu = () => {
    if (menuOpen || selectorOpen) return;
    (menuOpen = true), (tracksChanged = false);
    // A native overlay steals the touches and restarts the detector epoch: drop
    // fingers silently (no synthetic lift) and keep resting Pieces on the table.
    live.forEach((c) => { if (!c.resting) live.delete(c.id); else c.touched = 0; });
    byPointer.clear(), pointerOffsets.clear(), rests.clear(), (pending = []), (redetectIn = 0);
    renderMenu(), (menu.hidden = false);
    board()?.onAppVisibility(false);
  };
  const closeMenu = (action        , customButtonId         ) => {
    if (!menuOpen) return;
    (menuOpen = false), (menu.hidden = true);
    const result                          = { action };
    if (customButtonId) result.customButtonId = customButtonId;
    if (tracksChanged) result.audioTracks = tracks.map((t) => ({ id: t.id, value: t.value }));
    board()?.onPauseResult(JSON.stringify(result));
    board()?.onAppVisibility(true);
    // The detector needs a few frames before a resting Piece is born again:
    // empty frames reach the game first (see redetect in flush).
    redetectIn = REDETECT_FRAMES;
  };
  const toggleTrack = (i        ) => {
    const t = tracks[i];
    if (!t) return;
    if (t.value > 0) restore.set(t.id, t.value), (t.value = 0);
    else t.value = restore.get(t.id) || 100;
    (tracksChanged = true), renderMenu();
  };
  const onKey = (e               ) => {
    if (selectorOpen) {
      if (e.key === "Escape") { e.preventDefault(); cancelSelector(); }
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target                  )?.tagName ?? "")) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!menuOpen) {
      if (k === "P" || k === "Escape") { e.preventDefault(); openMenu(); }
      else if (k === "Backspace") { e.preventDefault(); liftResting(); renderPieces(); }
      return;
    }
    e.preventDefault();
    if (k === "Escape" || k === "Enter" || k === "P") closeMenu("RESUME");
    else if (k === "Q") closeMenu("EXIT_GAME_UNSAVED");
    else if (k === "S" && ctx.offerSaveOption) closeMenu("EXIT_GAME_SAVED");
    else if (k === "M" || k === "N") toggleTrack(k === "M" ? 0 : 1);
    else if (/^[1-9]$/.test(k) && ctx.customButtons?.[Number(k) - 1]) closeMenu("CUSTOM_ACTION", ctx.customButtons[Number(k) - 1].id);
  };
  menu.addEventListener("click", (e) => {
    const b = (e.target                  )?.closest?.("button[data-act]")                      ;
    const act = b?.dataset.act;
    if (act === "resume") closeMenu("RESUME");
    else if (act === "quit") closeMenu("EXIT_GAME_UNSAVED");
    else if (act === "save") closeMenu("EXIT_GAME_SAVED");
    else if (act === "custom") closeMenu("CUSTOM_ACTION", b?.dataset.id);
    else if (act === "track") toggleTrack(Number(b?.dataset.i));
  });
  label.addEventListener("click", () => (menuOpen ? closeMenu("RESUME") : openMenu()));
  const opts = { capture: true, passive: true };
  win.addEventListener("pointerdown", onDown, opts);
  win.addEventListener("pointermove", onMove, opts);
  win.addEventListener("pointerup", onUp, opts);
  win.addEventListener("pointercancel", onUp, opts);
  win.addEventListener("blur", endFingers);
  win.addEventListener("keydown", onKey, { capture: true });

  // --- session / avatar services, async via window.__board
  const profile             = ((win                                                 ).__boardSimProfile) ?? {};
  const startedAt = Date.now();
  const servicesDelayMs = profile.servicesDelayMs ?? 100;
  // Players and saves hold raw ids; what the session reports goes through sessionIdOf.
  const players           = [{ playerId: SIM_PROFILE_ID, sessionId: 1, name: "Player 1", type: "profile", avatarId: "0" }];
  const activeProfile = { playerId: SIM_PROFILE_ID, name: "Player 1", avatarId: "0" };
  // A Board reports a profile (a UUID) as the first 32 hex of sha256(rawId + "|" + appId) and
  // keeps guest and AI ids as they are (libboard BoardSaveGameData.hashProfileIdWithAppId).
  // The app id is the platform layer's, read when asked.
  const appIdNow = () => String((win                                                                 ).BoardPlatform?.game?.appId ?? "");
  const hashed = new Map                ();
  const sessionIdOf = (id        )         => {
    if (!PROFILE_ID.test(id)) return id;
    const key = `${id}|${appIdNow()}`;
    let out = hashed.get(key);
    if (out === undefined) hashed.set(key, (out = sha256Hex(key).slice(0, 32)));
    return out;
  };
  const seen = (p        )         => ({ ...p, playerId: sessionIdOf(p.playerId) });
  let nextRequest = 1, nextSession = 2, nextGuest = 2;
  let aiTypes = [];
  const later = (produce               )         => {
    const id = nextRequest++;
    setTimeout(() => {
      try { board()?.resolve(id, JSON.stringify(produce() ?? null)); } catch (err) { board()?.reject(id, String((err         )?.message ?? err)); }
    }, 0);
    return id;
  };
  const guest = (sessionId) => {
    const identity = nextGuest++;
    return { playerId: `sim-guest-${identity}`, sessionId, name: `Guest ${identity}`, type: "guest", avatarId: "0" };
  };
  const playersChanged = () => board()?.onPlayersChanged();
  const calls                            = {};
  const record = (name        , args           ) => void (calls[name] ??= []).push(args.length > 1 ? args : args[0]);

  // This overlay is a browser-only stand-in for the native selector. All choices
  // mutate the host roster itself, including identity changes on replacement.
  const choosePlayer = (replaceSessionId, allowedAi = []) => {
    const seatIndex = players.findIndex(p => p.sessionId === replaceSessionId);
    if (selectorOpen || menuOpen || (replaceSessionId !== undefined && seatIndex < 0)) return later(() => false);
    const requestId = nextRequest++;
    selectorOpen = true;
    live.forEach(c => { if (!c.resting) live.delete(c.id); else c.touched = 0; });
    byPointer.clear(); pointerOffsets.clear(); rests.clear(); pending = []; redetectIn = 0;
    board()?.onAppVisibility(false);
    const overlay = doc.createElement("div");
    overlay.className = "bs-menu";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", replaceSessionId === undefined ? "Add golf player" : "Change golf player");
    const card = doc.createElement("section");
    card.className = "bs-card";
    Object.assign(card.style, { width: "min(440px, 88vw)", boxSizing: "border-box", padding: "24px", font: "18px system-ui,sans-serif" });
    const title = doc.createElement("h2");
    title.textContent = replaceSessionId === undefined ? "Add golf player" : `Change ${players[seatIndex].name}`;
    title.style.fontSize = "24px";
    const hint = doc.createElement("p");
    hint.textContent = "Up to four players take turns from the same short edge.";
    card.append(title, hint);
    const finish = (changed) => {
      if (!selectorOpen) return;
      selectorOpen = false;
      overlay.remove();
      cancelSelector = () => {};
      if (changed) playersChanged();
      board()?.resolve(requestId, JSON.stringify(changed));
      board()?.onAppVisibility(true);
      redetectIn = REDETECT_FRAMES;
    };
    const option = (label, action) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = label;
      Object.assign(button.style, { display: "block", width: "100%", marginTop: "12px", padding: "16px", fontSize: "20px" });
      button.addEventListener("click", action);
      card.append(button);
    };
    const select = makePlayer => {
      if (replaceSessionId === undefined) {
        if (players.length >= 4) return finish(false);
        while (players.some(p => p.sessionId === nextSession)) nextSession++;
        players.push(makePlayer(nextSession++));
      } else {
        const current = players.findIndex(p => p.sessionId === replaceSessionId);
        if (current < 0) return finish(false);
        players[current] = makePlayer(replaceSessionId);
      }
      finish(true);
    };
    if (replaceSessionId !== undefined || players.length < 4) {
      if (!players.some(p => p.playerId === activeProfile.playerId && p.sessionId !== replaceSessionId)) {
        option(`${activeProfile.name} · Profile`, () => select(sessionId => ({ ...activeProfile, sessionId, type: "profile" })));
      }
      option("Local guest", () => select(guest));
      let indices = allowedAi;
      if (typeof indices === "string") { try { indices = JSON.parse(indices); } catch { indices = []; } }
      aiTypes.forEach((type, index) => {
        if (Array.isArray(indices) && indices.length && !indices.includes(index)) return;
        option(type.name, () => select(sessionId => ({
          playerId: `sim-ai-${nextGuest++}`, sessionId, name: type.name, type: "ai", avatarId: "0", aiTypeIndex: index,
        })));
      });
    } else {
      hint.textContent = "Four players are already seated. Change a player to replace or remove them.";
    }
    if (seatIndex >= 0 && players[seatIndex].playerId !== activeProfile.playerId) {
      option("Remove player", () => {
        const current = players.findIndex(p => p.sessionId === replaceSessionId);
        if (current < 0) return finish(false);
        players.splice(current, 1);
        finish(true);
      });
    }
    option("Cancel", () => finish(false));
    cancelSelector = () => finish(false);
    overlay.append(card); root.append(overlay);
    return requestId;
  };

  // --- Board.save simulation ---
  // Saves outlive a reload of the page, as they outlive a relaunch on a Board: kept in this
  // origin's web storage through the untouched Storage methods (a game's own storage use or a
  // harness's storage faults never reach them), in memory where storage is refused (an opaque
  // preview origin). Players come from the live roster; covers only with profile.covers.
  const SAVES_KEY = "__board_sim_saves";
  let memorySaves                       = {};
  const storage = (() => {
    try { const s = win.localStorage; Storage.prototype.getItem.call(s, SAVES_KEY); return s; } catch { return null; }
  })();
  const readSaves = ()                       => {
    if (!storage) return memorySaves;
    try { return JSON.parse(Storage.prototype.getItem.call(storage, SAVES_KEY) || "{}")                        ; } catch { return {}; }
  };
  const writeSaves = (all                      ) => {
    memorySaves = all;
    if (storage) try { Storage.prototype.setItem.call(storage, SAVES_KEY, JSON.stringify(all)); } catch { /* full: memory keeps them */ }
  };
  const saveLog                                           = [];
  const saved = (id        )       => { const s = readSaves()[id]; if (!s) throw new Error(`Save ${id} not found`); return s; };
  const store = (id               , description        , data        , playedTime        , gameVersion        , cover               ) => {
    if (!String(description ?? "").trim()) throw new Error("Save description must not be blank");
    const all = readSaves();
    const old = id ? all[id] : undefined;
    if (id && !old) throw new Error(`Save ${id} not found`);
    const roster = players.map((p) => ({ playerId: p.playerId, name: p.name, avatarId: Number(p.avatarId) || 0, type: p.type,
      ...(p.aiTypeIndex === undefined ? {} : { aiTypeIndex: p.aiTypeIndex }) }));
    // A save's players are fixed when it is created; an update never changes them.
    const savePlayers = old ? old.meta.players : roster;
    if (!savePlayers.some((p) => p.type === "profile")) throw new Error("A save needs at least one profile");
    const now = Date.now();
    const saveId = id ?? `sim-save-${now.toString(36)}-${Object.keys(all).length + 1}`;
    const meta           = {
      id: saveId, description: String(description), createdAt: old?.meta.createdAt ?? now, updatedAt: now, playedTime, fileSize: data.length, gameVersion,
      playerCount: savePlayers.length, hasCoverImage: (cover ?? old?.cover ?? null) !== null, payloadChecksum: null, coverImageChecksum: null, players: savePlayers,
    };
    all[saveId] = { meta, data, cover: cover ?? old?.cover ?? null };
    writeSaves(all);
    saveLog.push({ op: old ? "update" : "create", id: saveId, at: now });
    return meta;
  };
  const dropPlayers = (id        , only               ) => {
    const all = readSaves();
    const s = all[id];
    if (!s) throw new Error(`Save ${id} not found`);
    s.meta.players = only ? s.meta.players.filter((p) => p.playerId !== only) : [];
    if (!s.meta.players.length) delete all[id];
    writeSaves(all);
  };
  // Loading a save reseats the session to the save's players.
  const reseat = (s      ) => {
    players.length = 0;
    for (const p of s.meta.players) players.push({ playerId: p.playerId, sessionId: nextSession++, name: p.name, type: p.type, avatarId: String(p.avatarId),
      ...(p.aiTypeIndex === undefined ? {} : { aiTypeIndex: p.aiTypeIndex }) });
    playersChanged();
  };
  const coverMethods = profile.covers
    ? {
        createSaveWithCover: (d        , data        , t        , v        , cover        ) => later(() => store(null, d, data, t, v, `data:image/png;base64,${cover}`)),
        updateSaveWithCover: (id        , d        , data        , t        , v        , cover        ) => later(() => void store(id, d, data, t, v, `data:image/png;base64,${cover}`)),
      }
    : {};
  const avatarPng = (avatarId        ) => {
    try {
      const c = doc.createElement("canvas"), g = c.getContext("2d") ;
      (c.width = c.height = 64), (g.fillStyle = `hsl(${(avatarId * 47) % 360} 60% 45%)`), g.beginPath(), g.arc(32, 32, 30, 0, Math.PI * 2), g.fill();
      (g.fillStyle = "#fff"), (g.font = "bold 28px sans-serif"), (g.textAlign = "center"), (g.textBaseline = "middle"), g.fillText(String(avatarId), 32, 34);
      return c.toDataURL("image/png");
    } catch { return PNG_1PX; }
  };

  const host                = {
    __simulated: true,
    __sim: {
      glyph: 1,
      emit: (contacts) => contacts.forEach((c) => pending.push({ id: c.id, x: c.x, y: c.y, o: c.orientation, p: c.phase, g: c.glyph, touched: c.touched ? 1 : 0 })),
      flush,
      get menuOpen() { return menuOpen; },
      // This host re-reports resting Pieces itself; a harness must not double the blips.
      blips: true,
      // What a harness reads: the last pause context, quits, saves and other calls.
      get context() { return ctx; },
      quits,
      saves: () => Object.values(readSaves()).map((s) => s.meta),
      saveLog,
      calls,
      sessionIdOf,
    },
    getPlayers: () => JSON.stringify(players.map(seen)),
    getPlayerCount: () => players.length,
    addGuest: (sessionId) => {
      if (players.some(p => p.sessionId === sessionId)) return;
      players.push(guest(sessionId));
      nextSession = Math.max(nextSession, sessionId + 1);
      playersChanged();
    },
    removePlayer(sessionId) {
      const i = players.findIndex((p) => p.sessionId === sessionId);
      if (i > 0) players.splice(i, 1), playersChanged();
    },
    resetPlayers() {
      const keep = players.filter((p) => p.playerId === activeProfile.playerId);
      players.length = 0;
      players.push(...keep);
      playersChanged();
      return true;
    },
    // The active profile always reports sessionId -1, seated or not: it is not a seat.
    getActiveProfile: () => JSON.stringify({ ...activeProfile, playerId: sessionIdOf(activeProfile.playerId), sessionId: -1, type: "profile" }),
    isReady: () => true,
    areServicesReady: () => Date.now() - startedAt >= servicesDelayMs,
    getCurrentContacts: () => JSON.stringify(lastBatch.map((c) => ({ contactId: c.id, positionX: c.x, positionY: c.y, orientation: c.o, phaseId: c.p, glyphId: c.g, isTouched: c.touched }))),
    presentAddPlayerSelector: (allowedAi) => choosePlayer(undefined, allowedAi),
    presentReplacePlayerSelector: (sessionId, allowedAi) => choosePlayer(sessionId, allowedAi),
    setAIPlayerTypes(json) {
      try { aiTypes = JSON.parse(json); } catch { aiTypes = []; }
      if (!Array.isArray(aiTypes)) aiTypes = [];
    },
    createSave: (d, data, t, v) => later(() => store(null, d, data, t, v, null)),
    loadSave: (id) => later(() => { const s = saved(id); saveLog.push({ op: "load", id, at: Date.now() }); reseat(s); return { data: s.data }; }),
    listSaves: () => later(() => Object.values(readSaves()).map((s) => s.meta)),
    updateSave: (id, d, data, t, v) => later(() => void store(id, d, data, t, v, null)),
    ...coverMethods,
    removePlayersFromSave: (id) => later(() => dropPlayers(id, null)),
    removeActiveProfileFromSave: (id) => later(() => dropPlayers(id, activeProfile.playerId)),
    loadCoverImage: (id) => later(() => ({ dataUri: saved(id).cover })),
    getMaxSaveDataSize: () => 16 << 20,
    getMaxAppStorageSize: () => 64 << 20,
    getMaxSaveDescriptionLength: () => 100,
    getAppStorageInfo() {
      const used = Object.values(readSaves()).reduce((n, s) => n + s.data.length, 0);
      return JSON.stringify({ totalStorage: 64 << 20, usedStorage: used, remainingStorage: (64 << 20) - used, usagePercentage: used / (64 << 20) });
    },
    loadAvatarPNG: (avatarId) => later(() => ({ dataUri: avatarPng(avatarId) })),
    showProfileSwitcher() {},
    hideProfileSwitcher() {},
    // Newer Boards: hand detection, display orientation and the overlay anchor (recorded;
    // the glass never flips here).
    setHandDetectionEnabled: (enabled) => record("setHandDetectionEnabled", [enabled]),
    getDisplayOrientation: () => 0,
    setDisplayOrientation: (orientation) => record("setDisplayOrientation", [orientation]),
    setOverlayAnchor: (overlayId, anchor) => record("setOverlayAnchor", [overlayId, anchor]),
    resetOverlayAnchor: (overlayId) => record("resetOverlayAnchor", [overlayId]),
    setPauseContext(json) {
      ctx = JSON.parse(json);
      tracks = (ctx.audioTracks ?? []).map(hostTrack);
    },
    updatePauseContext(json) {
      const partial = JSON.parse(json)                ;
      ctx = { ...ctx, ...partial };
      if (partial.audioTracks) tracks = partial.audioTracks.map(hostTrack);
    },
    clearPauseContext: () => void ((ctx = {}), (tracks = [])),
    getPauseResult: () => "null",
    quit() {
      quits.push(Date.now());
      // Under a capture (the boot check) the quit is recorded and the page stays.
      if (profile.capture) return void (label.textContent = "BROWSER SIMULATOR · game quit");
      // The launcher analog in a browser: reload back to the title screen.
      label.textContent = "BROWSER SIMULATOR · game quit · reloading";
      setTimeout(() => win.location.reload(), 300);
    },
  };
  (win.BoardSDK = host), (win.boardTouch = touch);
  return true;
}

if (typeof window !== "undefined") installBrowserHost(window);
})();
