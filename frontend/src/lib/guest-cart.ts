// The cart of a shopper who is not logged in. It lives only on this phone: a short list of
// [version id, quantity, saved for later]. Prices, pictures and stock always come from the server (cart/preview/),
// so the phone never keeps old prices. At login the list is merged into the account's cart (cart/merge/).
import { getText, setText } from './storage';

export type GuestLine = { variantId: number; quantity: number; saved: boolean };

const KEY = 'guest_cart';
export const GUEST_MAX_LINES = 50; // the server accepts at most this many lines

export async function readGuestLines(): Promise<GuestLine[]> {
  try {
    const raw = await getText(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const lines: GuestLine[] = [];
    for (const row of list) {
      if (!Array.isArray(row)) continue;
      const [variantId, quantity, saved] = row;
      if (Number.isInteger(variantId) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) {
        lines.push({ variantId, quantity, saved: saved === 1 });
      }
    }
    return lines.slice(0, GUEST_MAX_LINES);
  } catch {
    return []; // a damaged value just means an empty cart
  }
}

export async function writeGuestLines(lines: GuestLine[]): Promise<void> {
  // compact on purpose: the phone's secure store only holds about 2 KB per value
  await setText(KEY, JSON.stringify(lines.map((l) => [l.variantId, l.quantity, l.saved ? 1 : 0])));
}
