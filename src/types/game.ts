export type GameGenre =
  | 'Action RPG'
  | 'Tactical Shooter'
  | 'Motorsport Sim'
  | 'Strategy'
  | 'Sci-Fi Adventure'
  | 'Survival'
  | 'Indie';

export const GAME_GENRES: GameGenre[] = [
  'Action RPG',
  'Tactical Shooter',
  'Motorsport Sim',
  'Strategy',
  'Sci-Fi Adventure',
  'Survival',
  'Indie',
];

export const SUGGESTED_GAME_TAGS: string[] = [
  'Open World',
  'Co-op',
  'Indie',
  'Singleplayer',
  'Multiplayer',
  'Sci-Fi',
  'Dark Fantasy',
  'Soulslike',
  'Tactical',
  'Racing',
  'Simulation',
  'Controller Support',
  'PvE',
  'Time Attack',
];

export interface DownloadMirror {
  label: string;
  provider: string;
  url: string;
  partInfo: string;
}

export interface GameItem {
  id: string;
  title: string;
  description: string;
  size: string;
  genre: GameGenre;
  tags: string[];
  rating: number;
  ratingSum: number;
  reviewCount: number;
  developer: string;
  releaseYear: string;
  bannerCoverUrl: string;
  verticalCoverUrl: string;
  coverUrl?: string;
  screenshots: string[];
  downloadLinks: DownloadMirror[];
  featured: boolean;
  visibility: 'public' | 'draft';
  downloadsCount: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  adminUpdatedAt?: unknown;
}

export interface GameReview {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  rating: number;
  content: string;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GameComment {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  visibility: 'public';
  createdAt?: unknown;
}

export interface WishlistItem {
  id: string;
  userId: string;
  gameId: string;
  gameTitle: string;
  gameVerticalCover: string;
  gameCover?: string;
  gameGenre: string;
  gameSize: string;
  addedAt?: unknown;
}

export type ActivityActionType =
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'download'
  | 'comment'
  | 'game_publish';

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  actionType: ActivityActionType;
  gameId: string;
  gameTitle: string;
  detail: string;
  createdAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

export interface UserPublicBadge {
  uid: string;
  displayName: string;
  role: 'user' | 'admin';
  memberSince?: unknown;
  updatedAt?: unknown;
}

export interface MirrorValidationResult {
  url: string;
  valid: boolean;
  provider: string;
  status: 'reachable' | 'format-ok' | 'blocked' | 'invalid';
  statusCode?: number;
  reason?: string;
}

export const BLUEPRINT_LIMITS = {
  TITLE_MIN: 2,
  TITLE_MAX: 120,
  DESC_MIN: 10,
  DESC_MAX: 4000,
  SIZE_MIN: 2,
  SIZE_MAX: 40,
  DEV_MIN: 2,
  DEV_MAX: 100,
  YEAR_REGEX: /^[0-9]{4}$/,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  URL_MAX: 1000,
  SCREENSHOTS_MIN: 3,
  SCREENSHOTS_MAX: 10,
  MIRRORS_MIN: 1,
  MIRRORS_MAX: 12,
  REVIEW_MIN: 2,
  REVIEW_MAX: 1000,
  COMMENT_MIN: 1,
  COMMENT_MAX: 1000,
  TAGS_MIN: 1,
  TAGS_MAX: 10,
  TAG_MIN_LEN: 2,
  TAG_MAX_LEN: 30,
};

export function isSafeHttpOrAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > BLUEPRINT_LIMITS.URL_MAX) return false;
  if (trimmed.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveBannerCover(
  game: Pick<GameItem, 'bannerCoverUrl' | 'coverUrl' | 'screenshots'>
): string {
  return game.bannerCoverUrl || game.coverUrl || game.screenshots?.[0] || '';
}

export function resolveVerticalCover(
  game: Pick<GameItem, 'verticalCoverUrl' | 'coverUrl' | 'bannerCoverUrl'>
): string {
  return game.verticalCoverUrl || game.coverUrl || game.bannerCoverUrl || '';
}
