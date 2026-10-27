import { BoardContactPhase, BoardContactType, type BoardContact } from "@board.fun/web-sdk";
import { createSwing, resetSwing, sampleSwing, SWING, type Shot, type SwingState } from "./rules";

export const RING_PLACEMENT = { left: 640, right: 1280, top: 720, bottom: 990 } as const;
export function isRingPlacement(contact: { x: number; y: number }): boolean {
  return contact.x >= RING_PLACEMENT.left && contact.x <= RING_PLACEMENT.right &&
    contact.y >= RING_PLACEMENT.top && contact.y <= RING_PLACEMENT.bottom;
}

interface Identity {
  contact: BoardContact;
  live: boolean;
  lostAt: number;
  pauseUntil: number | null;
  autoBind: boolean;
}
export interface RingEvents { arrivals: BoardContact[]; shot: Shot | null }
const ended = (c: BoardContact) => c.phase === BoardContactPhase.Ended || c.phase === BoardContactPhase.Canceled;
const separation = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Piece observation, stroke authority, and stroke intent are deliberately separate. */
export class RingController {
  private identities: Identity[] = [];
  private live = new Map<number, Identity>();
  private owner: Identity | null = null;
  private readonly gesture = createSwing();
  private enabled = false;
  private paused = false;
  private clock = 0;

  get ring(): BoardContact | null { return !this.paused && this.owner?.live ? this.owner.contact : null; }
  get swing(): SwingState { return this.gesture; }
  get observedRing(): BoardContact | null {
    if (this.ring) return this.ring;
    const rings = this.identities.filter(i => i.live && i.contact.glyphId === 1);
    return (rings.find(i => isRingPlacement(i.contact)) ?? rings[0])?.contact ?? null;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.resetStroke();
  }

  resetStroke(): void {
    resetSwing(this.gesture);
    const ring = this.ring;
    if (this.enabled && ring && isRingPlacement(ring)) this.seed(ring);
  }

  /** Release authority, not observation. A retained ring needs an explicit confirmation. */
  release(): void {
    this.owner = null;
    for (const identity of this.identities) identity.autoBind = false;
    resetSwing(this.gesture);
  }

  confirmPlacement(): boolean {
    if (this.paused) return false;
    const identity = this.identities.find(i => i.live && i.contact.glyphId === 1 && isRingPlacement(i.contact));
    if (!identity) return false;
    this.owner = identity;
    identity.autoBind = true;
    this.resetStroke();
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
    resetSwing(this.gesture);
  }

  resume(now: number): void {
    this.clock = now;
    this.paused = false;
    for (const identity of this.identities) {
      if (identity.pauseUntil === Infinity) identity.pauseUntil = now + 2000;
    }
    resetSwing(this.gesture);
  }

  /** Advancing a known stationary hold can settle it, but can never add a velocity sample. */
  tick(now: number): void {
    this.clock = now;
    const ring = this.ring;
    if (!ring || !this.enabled) return;
    const swing = this.gesture;
    if (swing.stage === "settling") {
      if (!isRingPlacement(ring)) { resetSwing(swing); return; }
      if (!swing.anchor || separation(ring, swing.anchor) > SWING.restRadius) this.seed(ring);
      if (now - swing.restSince >= SWING.settleMs) swing.stage = "ready";
    } else if (swing.stage === "backswing" && swing.last && now - swing.last.time > SWING.freshMs) {
      swing.history = [];
      swing.forwardSamples = 0;
      swing.power = 0;
    }
  }

  update(batch: readonly BoardContact[], active: ReadonlyMap<number, BoardContact>, now: number): RingEvents {
    this.clock = now;
    const events: RingEvents = { arrivals: [], shot: null };
    if (this.paused) return events;
    // Omitted contacts remain in runtime's active map; only actual ends or epoch resets remove them.
    for (const [id, identity] of this.live) {
      const c = active.get(id);
      if (!c || c.type !== BoardContactType.Glyph || c.glyphId !== identity.contact.glyphId || ended(c)) {
        this.lose(identity, now);
      }
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
          identity = { contact: { ...c }, live: true, lostAt: now, pauseUntil: null, autoBind: !this.owner?.live };
          this.identities.push(identity);
          events.arrivals.push(c);
        }
        this.live.set(c.contactId, identity);
      }
      const prior = identity.contact;
      identity.contact = { ...c };
      let boundNow = false;
      if (c.glyphId === 1 && !this.owner?.live && identity.autoBind && isRingPlacement(c)) {
        this.owner = identity;
        boundNow = true;
        this.resetStroke();
      }
      if (identity !== this.owner) continue;
      if (returned) { this.resetStroke(); continue; }
      if (boundNow || !this.enabled || separation(prior, c) < 0.01) continue;
      if (this.gesture.stage === "settling" && !isRingPlacement(c)) { resetSwing(this.gesture); continue; }
      const swing = this.gesture;
      // The maintained pose proves a hold. Discard old velocity without erasing a deliberate backswing.
      if (swing.last && now - swing.last.time > SWING.freshMs) {
        swing.last = null;
        swing.history = [];
        swing.forwardSamples = 0;
      }
      events.shot ??= sampleSwing(swing, { x: c.x, y: c.y, time: now });
    }
    this.tick(now);
    this.identities = this.identities.filter(i => i.live || i === this.owner ||
      (i.pauseUntil !== null ? now <= i.pauseUntil : now - i.lostAt <= 900));
    return events;
  }

  private seed(contact: BoardContact): void {
    resetSwing(this.gesture);
    sampleSwing(this.gesture, { x: contact.x, y: contact.y, time: this.clock });
  }

  private lose(identity: Identity, now: number): void {
    this.live.delete(identity.contact.contactId);
    identity.live = false;
    identity.lostAt = now;
    identity.pauseUntil = null;
    if (identity === this.owner) resetSwing(this.gesture);
  }

  private findRebind(contact: BoardContact, now: number): Identity | undefined {
    return this.identities.filter(i => !i.live && i.contact.glyphId === contact.glyphId &&
      separation(i.contact, contact) <= 140 &&
      (i.pauseUntil !== null ? now <= i.pauseUntil : now - i.lostAt <= 900))
      .sort((a, b) => separation(a.contact, contact) - separation(b.contact, contact))[0];
  }
}
