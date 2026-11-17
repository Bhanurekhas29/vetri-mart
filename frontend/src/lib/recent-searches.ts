// "Recent searches" live only on this phone (the last 8, newest first). Guests have them too.
import { getText, setText } from './storage';

const KEY = 'recent_searches';
const MAX_ITEMS = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await getText(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export async function addRecentSearch(term: string): Promise<string[]> {
  const clean = term.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) return getRecentSearches();
  try {
    const list = await getRecentSearches();
    const next = [clean, ...list.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_ITEMS);
    await setText(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await setText(KEY, '[]');
  } catch {
    // nothing to clear
  }
}
