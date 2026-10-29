import { BoardContactPhase, type BoardContact } from '@board.fun/web-sdk';
import { isSportsPiece, TURN_SWING } from './piece-control';

type Hold = { contactId: number; glyphId: number; x: number; y: number; since: number };

function usable(contact: BoardContact): boolean {
  return isSportsPiece(contact) &&
    (contact.phase === BoardContactPhase.Began || contact.phase === BoardContactPhase.Moved ||
      contact.phase === BoardContactPhase.Stationary) &&
    Number.isFinite(contact.x) && Number.isFinite(contact.y) &&
    contact.x >= 0 && contact.x <= 1920 && contact.y >= 0 && contact.y <= 1080;
}

/** A steady Sports piece anywhere on the glass can confirm one multiplayer turn. */
export class TurnPlacement {
  private targetKey: string | null = null;
  private hold: Hold | null = null;
  private confirmed = false;
  private preferredContactId: number | null = null;

  /** A new physical player can take the next address from a retained shared piece. */
  prefer(contactId: number): void {
    this.preferredContactId = contactId;
    this.hold = null;
    this.confirmed = false;
  }

  /** Interrupt a partial hold without allowing an already confirmed turn to repeat. */
  reset(): void { this.hold = null; }

  update(active: ReadonlyMap<number, BoardContact>, targetKey: string | null, now: number): number | null {
    if (targetKey !== this.targetKey) {
      this.targetKey = targetKey;
      this.hold = null;
      this.confirmed = false;
    }
    if (targetKey === null) { this.hold = null; this.preferredContactId = null; return null; }
    if (!Number.isFinite(now)) { this.hold = null; return null; }
    if (this.confirmed) return null;

    const contacts = [...active.values()].filter(usable);
    const preferred = contacts.find(c => c.contactId === this.preferredContactId);
    if (!preferred) this.preferredContactId = null;
    const contact = preferred ?? contacts.find(c => c.contactId === this.hold?.contactId && c.glyphId === this.hold.glyphId) ??
      contacts.sort((a, b) => a.contactId - b.contactId)[0];
    if (!contact) { this.hold = null; return null; }
    if (!this.hold || this.hold.contactId !== contact.contactId || this.hold.glyphId !== contact.glyphId ||
        Math.hypot(contact.x - this.hold.x, contact.y - this.hold.y) > TURN_SWING.restRadius || now < this.hold.since) {
      this.hold = { contactId: contact.contactId, glyphId: contact.glyphId, x: contact.x, y: contact.y, since: now };
      return null;
    }
    if (now - this.hold.since < TURN_SWING.settleMs) return null;

    this.confirmed = true;
    this.hold = null;
    this.preferredContactId = null;
    return contact.contactId;
  }
}
