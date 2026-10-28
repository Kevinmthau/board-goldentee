import { BoardContactPhase, BoardContactType, type BoardContact } from '@board.fun/web-sdk';
import { toPortrait } from './portrait';

/** The full piece fits inside the drawn circle while its sensed center stays in this smaller target. */
export const NAME_START_CIRCLE = { x: 540, y: 1385, radius: 144, centerRadius: 45, settleMs: 300 } as const;
const REST_RADIUS = 12;

function usable(contact: BoardContact): boolean {
  return contact.type === BoardContactType.Glyph && Number.isInteger(contact.glyphId) &&
    contact.glyphId >= 1 && contact.glyphId <= 8 &&
    contact.phase !== BoardContactPhase.Ended && contact.phase !== BoardContactPhase.Canceled &&
    Number.isFinite(contact.x) && Number.isFinite(contact.y);
}

export function isNameStartPlacement(contact: BoardContact): boolean {
  if (!usable(contact)) return false;
  const p = toPortrait(contact);
  return Math.hypot(p.x - NAME_START_CIRCLE.x, p.y - NAME_START_CIRCLE.y) <= NAME_START_CIRCLE.centerRadius;
}

type Hold = { contactId: number; glyphId: number; x: number; y: number; since: number };

/** A named start requires a fresh, settled placement; repainting a name never confirms it. */
export class NameStartPlacement {
  private targetKey: string | null = null;
  private enabledBefore = false;
  private hold: Hold | null = null;
  private blocked = false;
  private awaitHeldObservation = false;
  private blockedContacts = new Map<number, number>();

  get needsReentry(): boolean { return this.blocked; }

  /** Call before a menu, selector, or setup transition while the last contacts are still known. */
  reset(active: ReadonlyMap<number, BoardContact>): void {
    this.hold = null;
    this.blockHeld([...active.values()].filter(isNameStartPlacement));
  }

  update(active: ReadonlyMap<number, BoardContact>, targetKey: string | null, now: number): number | null {
    const contacts = [...active.values()].filter(usable);
    const inside = contacts.filter(isNameStartPlacement);
    if (targetKey !== this.targetKey) {
      this.targetKey = targetKey;
      this.hold = null;
      // The first title may observe a freshly placed piece immediately. Later identities
      // require exit/reentry, even when a different name occupies the same screen position.
      if (this.enabledBefore) this.blockHeld(inside);
      if (targetKey !== null) this.enabledBefore = true;
    }
    if (!Number.isFinite(now)) { this.hold = null; return null; }

    if (this.blocked) {
      if (inside.length) {
        this.awaitHeldObservation = false;
        for (const contact of inside) this.blockedContacts.set(contact.contactId, contact.glyphId);
      }
      const heldMovedOutside = contacts.some(c => this.blockedContacts.get(c.contactId) === c.glyphId && !isNameStartPlacement(c));
      // A pause clears the native snapshot. Its empty frames do not prove that the
      // physical piece left the circle; the reacquired contact may have a new ID.
      if (!inside.length && (!this.awaitHeldObservation || heldMovedOutside)) {
        this.blocked = false;
        this.awaitHeldObservation = false;
        this.blockedContacts.clear();
      } else { this.hold = null; return null; }
    }
    // Observe real exits during play/help too, but never collect a start gesture
    // while its named target is hidden. Pause gaps remain guarded above.
    if (targetKey === null) { this.hold = null; return null; }

    const contact = inside.find(c => c.contactId === this.hold?.contactId && c.glyphId === this.hold.glyphId) ??
      inside.sort((a, b) => a.contactId - b.contactId)[0];
    if (!contact) { this.hold = null; return null; }
    if (!this.hold || this.hold.contactId !== contact.contactId || this.hold.glyphId !== contact.glyphId ||
        Math.hypot(contact.x - this.hold.x, contact.y - this.hold.y) > REST_RADIUS || now < this.hold.since) {
      this.hold = { contactId: contact.contactId, glyphId: contact.glyphId, x: contact.x, y: contact.y, since: now };
      return null;
    }
    if (now - this.hold.since < NAME_START_CIRCLE.settleMs) return null;

    const contactId = this.hold.contactId;
    this.hold = null;
    this.blockHeld(inside);
    this.awaitHeldObservation = false;
    return contactId;
  }

  private blockHeld(inside: readonly BoardContact[]): void {
    if (!inside.length) return;
    this.blocked = true;
    this.awaitHeldObservation = true;
    for (const contact of inside) this.blockedContacts.set(contact.contactId, contact.glyphId);
  }
}
