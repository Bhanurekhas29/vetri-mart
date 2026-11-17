// "Recently viewed" lives only on this phone. We remember just the product slugs (the last 10, newest first);
// the price, stock and picture are fetched fresh from the server each time, so they are never out of date.
import { getText, setText } from '@/lib/storage';

const KEY = 'recently_viewed';
const MAX_ITEMS = 10;

export async function getRecentSlugs(): Promise<string[]> {
  try {
    const raw = await getText(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is string => typeof s === 'string').slice(0, MAX_ITEMS);
  } catch {
    return []; // a damaged or missing value just means "nothing viewed yet"
  }
}

export async function addRecentSlug(slug: string): Promise<void> {
  try {
    const list = await getRecentSlugs();
    const next = [slug, ...list.filter((s) => s !== slug)].slice(0, MAX_ITEMS);
    await setText(KEY, JSON.stringify(next));
  } catch {
    // remembering is a convenience; never block opening a product because of it
  }
}
