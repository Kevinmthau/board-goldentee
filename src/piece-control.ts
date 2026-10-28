import { BoardContactPhase, BoardContactType, type BoardContact } from "@board.fun/web-sdk";
import type { Shot } from "./rules";

/** Angles are physical facing angles in the player's view, supplied by pieceFootprint(). */
export interface PieceControlOptions {
  facingDeg: (contact: BoardContact) => number | null;
  isPlacement: (contact: BoardContact) => boolean;
  /** Kept for callers of the earlier control; address now follows the settled piece. */
  towardPlayerDeg?: number;
}

export const TURN_SWING = {
  settleMs: 300,
  restRadius: 12,
  // Turning a Sports figure by hand can shift its center by nearly one base width.
  // Native football traces drifted 89 px through a deliberate backswing; a 48 px
  // cutoff canceled those turns before the player could return to the ball.
  translationLimit: 120,
  deadbandDeg: 4,
  restAngleDeg: 8,
  addressToleranceDeg: 30,
  backswingDeg: 40,
  fullBackswingDeg: 150,
  forwardDeg: 24,
  impactToleranceDeg: 10,
  minSpeed: 25,
  freshMs: 180,
  sampleWindowMs: 160,
  maxStepDeg: 120,
  maxTurnDeg: 210,
} as const;

export interface TurnSwingState {
  stage: "settling" | "ready" | "backswing" | "committed";
  /** Current turn, including small unarmed takeaways; 1 is a full backswing. */
  windup: number;
  /** Preview/accepted power. The amount of backswing, not return speed, sets distance. */
  power: number;
  backswingDeg: number;
  forwardDeg: number;
}

interface Identity {
  contact: BoardContact;
  live: boolean;
  lostAt: number;
  pauseUntil: number | null;
  autoBind: boolean;
  /** The accepted address survives contact IDs, tracking gaps, and pause epochs. */
  addressFacing: number | null;
}
interface TurnSample { angle: number; time: number }
export interface PieceEvents { arrivals: BoardContact[]; shot: Shot | null }

const ended = (c: BoardContact) => c.phase === BoardContactPhase.Ended || c.phase === BoardContactPhase.Canceled;
const separation = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const angleDelta = (from: number, to: number) => ((to - from + 540) % 360 + 360) % 360 - 180;
export const isSportsPiece = (contact: BoardContact): boolean =>
  contact.type === BoardContactType.Glyph && Number.isInteger(contact.glyphId) && contact.glyphId >= 1 && contact.glyphId <= 8;
const emptySwing = (): TurnSwingState => ({ stage: "settling", windup: 0, power: 0, backswingDeg: 0, forwardDeg: 0 });
const powerFor = (degrees: number) => clamp01((degrees - TURN_SWING.backswingDeg + 8) /
  (TURN_SWING.fullBackswingDeg - TURN_SWING.backswingDeg + 8));

/** Observation, seat authority, and deliberate twist intent remain separate. */
export class PieceController {
  private identities: Identity[] = [];
  private live = new Map<number, Identity>();
  private owner: Identity | null = null;
  private readonly gesture = emptySwing();
  private enabled = false;
  private paused = false;
  private clock = 0;
  private anchor: { x: number; y: number; facing: number } | null = null;
  private restSince = 0;
  private last: TurnSample | null = null;
  private heading = 0;
  private turn = 0;
  private direction = 0;
  private forwardSamples = 0;
  private history: TurnSample[] = [];
  constructor(private readonly options: PieceControlOptions) {}

  get piece(): BoardContact | null { return !this.paused && this.owner?.live ? this.owner.contact : null; }
  get swing(): Readonly<TurnSwingState> { return this.gesture; }
  get addressFacing(): number | null { return this.owner?.addressFacing ?? null; }
  get observedPiece(): BoardContact | null {
    if (this.piece) return this.piece;
    const pieces = this.identities.filter(i => i.live && isSportsPiece(i.contact));
    return (pieces.find(i => this.options.isPlacement(i.contact)) ?? pieces[0])?.contact ?? null;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    // A new turn or return from help can address at a comfortable new angle.
    // Pause and tracking rebind do not toggle enabled, so they retain the old zero.
    this.resetStroke(enabled);
  }

  resetStroke(recalibrate = false): void {
    if (recalibrate && this.owner) this.owner.addressFacing = null;
    Object.assign(this.gesture, emptySwing());
    this.anchor = null;
    this.last = null;
    this.turn = this.direction = this.forwardSamples = 0;
    this.history = [];
    this.restSince = this.clock;
    const piece = this.piece;
    if (this.enabled && piece) this.seed(piece);
  }

  /** Change setup releases authority; confirming a retained piece never causes an arrival. */
  release(): void {
    this.owner = null;
    for (const identity of this.identities) identity.autoBind = false;
    this.resetStroke();
  }

  confirmPlacement(): boolean {
    if (this.paused) return false;
    const identity = this.identities.find(i => i.live && isSportsPiece(i.contact) && this.options.isPlacement(i.contact));
    if (!identity) return false;
    this.owner = identity;
    identity.autoBind = true;
    this.resetStroke(true);
    return true;
  }

  pause(now: number): void {
    if (this.paused) return;
    this.clock = now;
    this.paused = true;
    for (const identity of this.identities) {
      if (!identity.live) continue;
      identity.live = false;
      identity.lostAt = now;
      identity.pauseUntil = Infinity;
    }
    this.live.clear();
    this.resetStroke();
  }

  resume(now: number): void {
    this.clock = now;
    this.paused = false;
    for (const identity of this.identities) {
      if (identity.pauseUntil === Infinity) identity.pauseUntil = now + 2000;
    }
    this.resetStroke();
  }

  /** Time can settle an observed hold. It can never manufacture a turn or strike. */
  tick(now: number): void {
    this.clock = now;
    const piece = this.piece;
    if (!piece || !this.enabled) return;
    if (this.gesture.stage === "settling") {
      const facing = this.facing(piece);
      const address = this.owner?.addressFacing ?? null;
      if (facing === null || !this.options.isPlacement(piece) ||
          (address !== null && Math.abs(angleDelta(address, facing)) > TURN_SWING.addressToleranceDeg)) {
        this.anchor = null;
        this.restSince = now;
        return;
      }
      if (!this.anchor || separation(piece, this.anchor) > TURN_SWING.restRadius ||
          Math.abs(angleDelta(this.anchor.facing, facing)) > TURN_SWING.restAngleDeg) this.seed(piece);
      if (now - this.restSince >= TURN_SWING.settleMs) {
        if (this.owner && this.owner.addressFacing === null) this.owner.addressFacing = this.anchor!.facing;
        this.gesture.stage = "ready";
        this.heading = facing;
        this.turn = angleDelta(this.owner!.addressFacing!, facing);
        this.last = { angle: this.turn, time: now };
      }
    } else if (this.last && now - this.last.time > TURN_SWING.freshMs) {
      this.history = [];
      this.forwardSamples = 0;
    }
  }

  update(batch: readonly BoardContact[], active: ReadonlyMap<number, BoardContact>, now: number): PieceEvents {
    this.clock = now;
    const events: PieceEvents = { arrivals: [], shot: null };
    if (this.paused) return events;
    // Runtime owns snapshot reconciliation; omitted stationary contacts are still active.
    for (const [id, identity] of this.live) {
      const c = active.get(id);
      if (!c || c.type !== BoardContactType.Glyph || c.glyphId !== identity.contact.glyphId || ended(c)) this.lose(identity, now);
    }
    this.tick(now);
    for (const c of batch) {
      if (c.type !== BoardContactType.Glyph || ended(c) || !active.has(c.contactId)) continue;
      let identity = this.live.get(c.contactId);
      let returned = false;
      if (identity && c.phase === BoardContactPhase.Began && separation(c, identity.contact) > 300) {
        this.lose(identity, now);
        identity = undefined;
      }
      if (!identity) {
        identity = this.findRebind(c, now);
        if (identity) {
          returned = true;
          identity.live = true;
          identity.pauseUntil = null;
        } else {
          identity = { contact: { ...c }, live: true, lostAt: now, pauseUntil: null,
            autoBind: !this.owner?.live, addressFacing: null };
          this.identities.push(identity);
          events.arrivals.push(c);
        }
        this.live.set(c.contactId, identity);
      }
      identity.contact = { ...c };
      let boundNow = false;
      if (isSportsPiece(c) && !this.owner?.live && identity.autoBind && this.options.isPlacement(c)) {
        this.owner = identity;
        boundNow = true;
        this.resetStroke();
      }
      if (identity !== this.owner) continue;
      if (returned) { this.resetStroke(); continue; }
      if (!boundNow && this.enabled) events.shot ??= this.sample(c, now);
    }
    this.tick(now);
    this.identities = this.identities.filter(i => i.live || i === this.owner ||
      (i.pauseUntil !== null ? now <= i.pauseUntil : now - i.lostAt <= 900));
    return events;
  }

  private facing(contact: BoardContact): number | null {
    const value = this.options.facingDeg(contact);
    return value === null || !Number.isFinite(value) ? null : ((value % 360) + 360) % 360;
  }

  private seed(contact: BoardContact): void {
    const facing = this.facing(contact);
    this.anchor = facing === null ? null : { x: contact.x, y: contact.y, facing };
    this.restSince = this.clock;
    this.last = null;
    if (facing !== null) this.heading = facing;
  }

  private sample(contact: BoardContact, now: number): Shot | null {
    const swing = this.gesture;
    if (swing.stage === "committed" || swing.stage === "settling") return null;
    const facing = this.facing(contact);
    if (facing === null || !this.anchor || !this.options.isPlacement(contact) ||
        separation(contact, this.anchor) > TURN_SWING.translationLimit) {
      this.resetStroke();
      return null;
    }
    const delta = angleDelta(this.heading, facing);
    if (Math.abs(delta) > TURN_SWING.maxStepDeg) { this.resetStroke(); return null; }
    if (Math.abs(delta) < 0.01) return null;
    this.heading = facing;
    this.turn += delta;
    if (Math.abs(this.turn) > TURN_SWING.maxTurnDeg) { this.resetStroke(); return null; }
    const last = this.last;
    const sample = { angle: this.turn, time: now };
    this.last = sample;
    swing.windup = clamp01((Math.abs(this.turn) - TURN_SWING.deadbandDeg) /
      (TURN_SWING.fullBackswingDeg - TURN_SWING.deadbandDeg));
    if (swing.stage === "ready") {
      swing.backswingDeg = Math.abs(this.turn);
      swing.power = powerFor(swing.backswingDeg);
      if (swing.backswingDeg >= TURN_SWING.backswingDeg) {
        swing.stage = "backswing";
        this.direction = Math.sign(this.turn);
        this.history = [sample];
      }
      return null;
    }

    const extent = this.turn * this.direction;
    if (extent >= swing.backswingDeg) {
      swing.backswingDeg = extent;
      swing.forwardDeg = 0;
      swing.power = powerFor(extent);
      this.forwardSamples = 0;
      this.history = [sample];
      return null;
    }
    swing.forwardDeg = swing.backswingDeg - extent;
    if (!last || now - last.time > TURN_SWING.freshMs) {
      this.history = [sample];
      this.forwardSamples = 0;
      return null;
    }
    // Count deliberate return motion by speed, so small steps from a faster
    // contact feed still qualify. A single jump followed by slow jitter does not.
    const sampleSeconds = (now - last.time) / 1000;
    const returnSpeed = sampleSeconds > 0 ? -delta * this.direction / sampleSeconds : 0;
    if (returnSpeed >= TURN_SWING.minSpeed) this.forwardSamples += 1;
    else if (delta * this.direction > TURN_SWING.deadbandDeg) {
      this.forwardSamples = 0;
      this.history = [sample];
    }
    this.history.push(sample);
    while (this.history.length > 2 && now - this.history[1].time > TURN_SWING.sampleWindowMs) this.history.shift();
    const start = this.history[0];
    const elapsed = (now - start.time) / 1000;
    const speed = elapsed > 0 ? (start.angle - sample.angle) * this.direction / elapsed : 0;
    if (this.forwardSamples >= 2 && swing.forwardDeg >= TURN_SWING.forwardDeg &&
        extent <= TURN_SWING.impactToleranceDeg &&
        elapsed >= 0.016 && speed >= TURN_SWING.minSpeed) {
      swing.stage = "committed";
      return { power: swing.power, angle: 0 };
    }
    return null;
  }

  private lose(identity: Identity, now: number): void {
    this.live.delete(identity.contact.contactId);
    identity.live = false;
    identity.lostAt = now;
    identity.pauseUntil = null;
    if (identity === this.owner) this.resetStroke();
  }

  private findRebind(contact: BoardContact, now: number): Identity | undefined {
    return this.identities.filter(i => !i.live && i.contact.glyphId === contact.glyphId &&
      separation(i.contact, contact) <= 140 &&
      (i.pauseUntil !== null ? now <= i.pauseUntil : now - i.lostAt <= 900))
      .sort((a, b) => separation(a.contact, contact) - separation(b.contact, contact))[0];
  }
}
