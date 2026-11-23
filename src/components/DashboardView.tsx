import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Edit3,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  isSafeHttpOrAssetUrl,
  resolveVerticalCover,
  type ActivityActionType,
  type ActivityLog,
  type GameItem,
  type UserProfile,
  type WishlistItem,
} from '../types/game';
import { RETRO_AVATARS } from '../data/retroAvatars';
import { SafeImage } from './SafeImage';

interface DashboardViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  games: GameItem[];
  wishlist: WishlistItem[];
  activities: ActivityLog[];
  onSignIn: () => void;
  onUpdateProfile: (updates: { displayName: string; photoURL: string }) => Promise<void>;
  onOpenGame: (game: GameItem) => void;
  onCreateGame: () => void;
  onEditGame: (game: GameItem) => void;
  onDeleteGame: (game: GameItem) => Promise<void>;
  onSeedStarterCatalog: () => Promise<void>;
  seeding: boolean;
}

const ACTION_LABELS: Record<ActivityActionType, string> = {
  wishlist_add: 'Added to Wishlist',
  wishlist_remove: 'Removed from Wishlist',
  download: 'Mirror Download',
  comment: 'Posted Review',
  game_publish: 'Catalog Update',
};

export function DashboardView({
  user,
  userProfile,
  isAdmin,
  games,
  wishlist,
  activities,
  onSignIn,
  onUpdateProfile,
  onOpenGame,
  onCreateGame,
  onEditGame,
  onDeleteGame,
  onSeedStarterCatalog,
  seeding,
}: DashboardViewProps) {
  const [activityFilter, setActivityFilter] = useState<'all' | ActivityActionType>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [profileName, setProfileName] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setProfileName(
      userProfile?.displayName ||
        user.displayName ||
        user.email?.split('@')[0] ||
        'Player'
    );
    setSelectedAvatarUrl(userProfile?.photoURL || user.photoURL || RETRO_AVATARS[0].url);
  }, [user, userProfile]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = profileName.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setProfileError('Display name must be between 1 and 80 characters.');
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await onUpdateProfile({
        displayName: trimmed,
        photoURL: selectedAvatarUrl.slice(0, 500),
      });
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Unable to save profile changes.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) {
    return (
      <section className="max-w-3xl mx-auto py-16 px-6 text-center space-y-5">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Activity &amp; Collection Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Sign in with your Google account to monitor your wishlist collection, mirror downloads,
          and community interactions.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Sign In with Google
        </button>
      </section>
    );
  }

  const totalDownloads = games.reduce((sum, g) => sum + (g.downloadsCount || 0), 0);
  const filteredActivities = activities.filter((act) =>
    activityFilter === 'all' ? true : act.actionType === activityFilter
  );

  const filteredCatalogGames = games.filter((g) => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      g.genre.toLowerCase().includes(q) ||
      g.developer.toLowerCase().includes(q)
    );
  });

  const formatDate = (ts: unknown) => {
    if (!ts || typeof ts !== 'object') return 'Just now';
    const maybe = ts as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return 'Just now';
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-10">
      {/* Unified Dashboard Header — Game creation buttons are gated strictly by verified admin middleware */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Activity &amp; Collection Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Monitor wishlist saves, mirror download activity, and catalog availability in real time.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            {games.length === 0 && (
              <button
                type="button"
                onClick={() => void onSeedStarterCatalog()}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 dark:bg-[#171E2C] dark:hover:bg-[#1E2738] dark:border-slate-700 text-sm font-medium dark:text-slate-100 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{seeding ? 'Publishing...' : 'Publish Starter Catalog (3 Games)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onCreateGame}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Game</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabular KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-none">
          <div className="text-xs text-slate-600 dark:text-slate-400">Catalog Titles</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
            {games.length}
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-none">
          <div className="text-xs text-slate-600 dark:text-slate-400">Saved in Wishlist</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1.5">
            {wishlist.length}
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-none">
          <div className="text-xs text-slate-600 dark:text-slate-400">Mirror Downloads</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1.5">
            {totalDownloads.toLocaleString()}
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-none">
          <div className="text-xs text-slate-600 dark:text-slate-400">Logged Events</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
            {activities.length}
          </div>
        </div>
      </div>

      {/* User Profile & Retro Character Avatar Management */}
      <section className="bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs dark:shadow-none">
        <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Profile &amp; Character Avatar
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Customize your display name and select a retro pixel-art character avatar.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {selectedAvatarUrl && isSafeHttpOrAssetUrl(selectedAvatarUrl) ? (
                <img
                  src={selectedAvatarUrl}
                  alt={profileName || 'Selected avatar'}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#0B0E14] shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-blue-600 text-white text-xl font-bold flex items-center justify-center shrink-0">
                  {(profileName || user.email || 'P').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {profileName || user.email}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 truncate">{user.email}</div>
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {isAdmin ? 'Admin' : 'Verified Member'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-display-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Display Name
              </label>
              <input
                id="profile-display-name"
                type="text"
                maxLength={80}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {profileError && <div className="text-xs text-red-600 dark:text-red-400">{profileError}</div>}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
              {user.photoURL && selectedAvatarUrl !== user.photoURL && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatarUrl(user.photoURL || '')}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 dark:bg-[#0B0E14] dark:hover:bg-slate-800 dark:border-slate-700 text-xs font-medium dark:text-slate-300 transition-colors"
                >
                  Use Google Photo
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Retro Character Avatars
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                {RETRO_AVATARS.length} presets
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {RETRO_AVATARS.map((avatar) => {
                const selected = selectedAvatarUrl === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatarUrl(avatar.url)}
                    aria-pressed={selected}
                    className={`group relative rounded-xl p-2 bg-slate-50 dark:bg-[#0B0E14] border text-left transition-all ${
                      selected
                        ? 'border-blue-500 ring-2 ring-blue-500/40'
                        : 'border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-[#0B0E14]">
                      <img
                        src={avatar.url}
                        alt={avatar.label}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200 truncate text-center">
                      {avatar.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </section>

      {/* Activity Monitor + Saved Vertical Covers Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Activity Table */}
        <div className="lg:col-span-8 bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Activity Monitor</h2>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'download', label: 'Downloads' },
                  { id: 'wishlist_add', label: 'Wishlist' },
                  { id: 'comment', label: 'Reviews' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivityFilter(tab.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    activityFilter === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No activity events recorded for this filter yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-5 font-medium">User</th>
                    <th className="py-3 px-4 font-medium">Event</th>
                    <th className="py-3 px-4 font-medium">Game</th>
                    <th className="py-3 px-4 font-medium">Detail</th>
                    <th className="py-3 px-5 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-sm">
                  {filteredActivities.slice(0, 25).map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-5 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                        {act.userName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {ACTION_LABELS[act.actionType] || act.actionType}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-white font-medium whitespace-nowrap">
                        {act.gameTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs max-w-[240px] truncate">
                        {act.detail}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(act.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* User Wishlist Collection (Clean vertical covers) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Saved Collection</h2>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {wishlist.length} items
            </span>
          </div>

          {wishlist.length === 0 ? (
            <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
              Your wishlist is empty. Save games from the storefront to track them here.
            </div>
          ) : (
            <div className="p-4 grid grid-cols-3 gap-3">
              {wishlist.map((item) => {
                const matchedGame = games.find((g) => g.id === item.gameId);
                const posterUrl = matchedGame
                  ? resolveVerticalCover(matchedGame)
                  : item.gameVerticalCover || item.gameCover || '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => matchedGame && onOpenGame(matchedGame)}
                    className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 transition-colors"
                    aria-label={item.gameTitle}
                  >
                    <SafeImage
                      src={posterUrl}
                      alt={item.gameTitle}
                      fallbackTitle={item.gameTitle}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unified Catalog Overview — Edit/Delete controls only rendered for registered Admin account */}
      <section className="bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Library Directory</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isAdmin
                ? 'Registered admin session active — you can publish, edit, and remove titles.'
                : 'Read-only directory overview of available builds and mirror counts.'}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Filter library..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <th className="py-3 px-5 font-medium">Title</th>
                <th className="py-3 px-4 font-medium">Genre</th>
                <th className="py-3 px-4 font-medium">Size</th>
                <th className="py-3 px-4 font-medium">Rating</th>
                <th className="py-3 px-4 font-medium">Mirrors</th>
                <th className="py-3 px-4 font-medium">Screenshots</th>
                {isAdmin && (
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-sm">
              {filteredCatalogGames.map((game) => (
                <tr key={game.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-5 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenGame(game)}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                    >
                      {game.title}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{game.genre}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {game.size}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {(game.reviewCount ?? 0) > 0
                      ? `${(game.rating ?? 0).toFixed(1)} (${game.reviewCount})`
                      : 'Unrated'}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {game.downloadLinks.length} links
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {game.screenshots.length} photos
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditGame(game)}
                          aria-label={`Edit ${game.title}`}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteGame(game)}
                          aria-label={`Delete ${game.title}`}
                          className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredCatalogGames.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-8 text-center text-sm text-slate-600 dark:text-slate-400"
                  >
                    No games published in Firestore catalog yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
