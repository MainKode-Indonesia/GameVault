import type { GameItem, WishlistItem } from '../types/game';

function normalizeForJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item));
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      try {
        return maybeTimestamp.toDate().toISOString();
      } catch {
        return null;
      }
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        result[key] = normalizeForJson(val);
      }
    }
    return result;
  }
  return value;
}

export function exportDataToJsonFile<T>(
  items: T[],
  backupType: 'catalog' | 'wishlist',
  filenamePrefix: string
): string {
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}-${dateSlug}.json`;

  const payload = {
    app: 'GameVault',
    backupType,
    exportedAt: new Date().toISOString(),
    count: items.length,
    items: normalizeForJson(items),
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}

export function exportCatalogToJson(games: GameItem[]): string {
  return exportDataToJsonFile(games, 'catalog', 'gamevault-catalog-backup');
}

export function exportWishlistToJson(wishlist: WishlistItem[]): string {
  return exportDataToJsonFile(wishlist, 'wishlist', 'gamevault-wishlist-backup');
}
