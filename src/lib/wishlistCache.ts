import type { WishlistItem } from '../types/game';

const WISHLIST_CACHE_PREFIX = 'gamevault-wishlist-cache:';
const LAST_WISHLIST_UID_KEY = 'gamevault-last-wishlist-uid';

export interface CachedWishlistPayload {
  uid: string;
  userLabel: string;
  items: WishlistItem[];
  cachedAt: number;
}

export function saveWishlistToCache(
  uid: string,
  items: WishlistItem[],
  userLabel = 'Player'
): void {
  if (!uid) return;
  try {
    const payload: CachedWishlistPayload = {
      uid,
      userLabel,
      items,
      cachedAt: Date.now(),
    };
    localStorage.setItem(`${WISHLIST_CACHE_PREFIX}${uid}`, JSON.stringify(payload));
    localStorage.setItem(LAST_WISHLIST_UID_KEY, uid);
  } catch {
    // Ignore storage quota or restricted browser context errors
  }
}

export function loadWishlistFromCache(uid: string): CachedWishlistPayload | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${WISHLIST_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWishlistPayload>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      uid: parsed.uid || uid,
      userLabel: parsed.userLabel || 'Player',
      items: parsed.items,
      cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function loadLastCachedWishlist(): CachedWishlistPayload | null {
  try {
    const lastUid = localStorage.getItem(LAST_WISHLIST_UID_KEY);
    if (!lastUid) return null;
    return loadWishlistFromCache(lastUid);
  } catch {
    return null;
  }
}

export function clearWishlistCache(uid?: string): void {
  try {
    if (uid) {
      localStorage.removeItem(`${WISHLIST_CACHE_PREFIX}${uid}`);
      if (localStorage.getItem(LAST_WISHLIST_UID_KEY) === uid) {
        localStorage.removeItem(LAST_WISHLIST_UID_KEY);
      }
      return;
    }
    const lastUid = localStorage.getItem(LAST_WISHLIST_UID_KEY);
    if (lastUid) {
      localStorage.removeItem(`${WISHLIST_CACHE_PREFIX}${lastUid}`);
      localStorage.removeItem(LAST_WISHLIST_UID_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
