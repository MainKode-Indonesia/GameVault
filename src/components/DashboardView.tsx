import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileDown,
  Flag,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ADMIN_AUDIT_ACTION_TYPES,
  isSafeHttpOrAssetUrl,
  resolveVerticalCover,
  type ActivityActionType,
  type ActivityLog,
  type GameItem,
  type MirrorReport,
  type MirrorValidationResult,
  type UserProfile,
  type WishlistItem,
} from '../types/game';
import { RETRO_AVATARS } from '../data/retroAvatars';
import { SafeImage } from './SafeImage';
import { useToast } from './ToastProvider';

interface DashboardViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  games: GameItem[];
  wishlist: WishlistItem[];
  activities: ActivityLog[];
  mirrorReports?: MirrorReport[];
  onSignIn: () => void;
  onUpdateProfile: (updates: { displayName: string; photoURL: string }) => Promise<void>;
  onOpenGame: (game: GameItem) => void;
  onCreateGame: () => void;
  onEditGame: (game: GameItem) => void;
  onDeleteGame: (game: GameItem) => Promise<void>;
  onResolveMirrorReport?: (report: MirrorReport) => Promise<void>;
  onSeedStarterCatalog: () => Promise<void>;
  onExportCatalog: () => void;
  onExportWishlist: () => void;
  seeding: boolean;
}

const ACTION_LABELS: Record<ActivityActionType, string> = {
  wishlist_add: 'Added to Wishlist',
  wishlist_remove: 'Removed from Wishlist',
  download: 'Mirror Download',
  comment: 'Posted Review',
  mirror_report: 'Reported Dead Link',
  game_publish: 'Game Published',
  game_update: 'Game Updated',
  game_delete: 'Game Deleted',
  catalog_seed: 'Catalog Seeded',
};

const ACTIVITY_PAGE_SIZE = 5;
const AUDIT_PAGE_SIZE = 8;
const LIBRARY_PAGE_SIZE = 5;

interface DeadMirrorEntry {
  gameId: string;
  gameTitle: string;
  label: string;
  provider: string;
  url: string;
  reason: string;
}

function toMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const maybe = ts as { toMillis?: () => number };
  return typeof maybe.toMillis === 'function' ? maybe.toMillis() : 0;
}

type DashboardSubView = 'overview' | 'audit';

export function DashboardView({
  user,
  userProfile,
  isAdmin,
  games,
  wishlist,
  activities,
  mirrorReports = [],
  onSignIn,
  onUpdateProfile,
  onOpenGame,
  onCreateGame,
  onEditGame,
  onDeleteGame,
  onResolveMirrorReport,
  onSeedStarterCatalog,
  onExportCatalog,
  onExportWishlist,
  seeding,
}: DashboardViewProps) {
  const [dashboardSubView, setDashboardSubView] = useState<DashboardSubView>('overview');
  const [activityFilter, setActivityFilter] = useState<'all' | ActivityActionType>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'all' | ActivityActionType>('all');
  const [auditPage, setAuditPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [libraryPage, setLibraryPage] = useState(1);
  const [checkingAllLinks, setCheckingAllLinks] = useState(false);
  const [checkedLinkMap, setCheckedLinkMap] = useState<
    Record<string, MirrorValidationResult>
  >({});
  const [deadLinkEntries, setDeadLinkEntries] = useState<DeadMirrorEntry[]>([]);
  const [showDeadAlert, setShowDeadAlert] = useState(false);
  const [lastLinkAuditAt, setLastLinkAuditAt] = useState<number | null>(null);
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const { showToast } = useToast();

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

  // Query Firestore 'activities' collection where actionType is admin-related for the Admin Audit Log view
  useEffect(() => {
    if (!user || !isAdmin) {
      setAuditLogs([]);
      setAuditLoading(false);
      if (dashboardSubView === 'audit') {
        setDashboardSubView('overview');
      }
      return;
    }

    setAuditLoading(true);
    const auditQuery = query(
      collection(db, 'activities'),
      where('actionType', 'in', ADMIN_AUDIT_ACTION_TYPES),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      auditQuery,
      (snapshot) => {
        const list: ActivityLog[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityLog, 'id'>),
        }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setAuditLogs(list);
        setAuditLoading(false);
      },
      (error) => {
        setAuditLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'activities');
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

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
  const totalActivityPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / ACTIVITY_PAGE_SIZE)
  );
  const currentActivityPage = Math.min(activityPage, totalActivityPages);
  const activityStartIndex = (currentActivityPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedActivities = filteredActivities.slice(
    activityStartIndex,
    activityStartIndex + ACTIVITY_PAGE_SIZE
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

  const totalLibraryPages = Math.max(
    1,
    Math.ceil(filteredCatalogGames.length / LIBRARY_PAGE_SIZE)
  );
  const currentLibraryPage = Math.min(libraryPage, totalLibraryPages);
  const libraryStartIndex = (currentLibraryPage - 1) * LIBRARY_PAGE_SIZE;
  const paginatedCatalogGames = filteredCatalogGames.slice(
    libraryStartIndex,
    libraryStartIndex + LIBRARY_PAGE_SIZE
  );

  const openMirrorReports = mirrorReports.filter((r) => r.status === 'open');
  const openReportedUrlSet = new Set(
    openMirrorReports.map((r) => r.mirrorUrl.trim()).filter(Boolean)
  );

  const handleResolveReport = async (report: MirrorReport) => {
    if (!onResolveMirrorReport) return;
    setResolvingReportId(report.id);
    try {
      await onResolveMirrorReport(report);
    } finally {
      setResolvingReportId(null);
    }
  };

  const handleCheckAllLibraryLinks = async () => {
    const uniqueUrls = Array.from(
      new Set(
        games
          .flatMap((game) => (game.downloadLinks ?? []).map((m) => m.url.trim()))
          .filter(Boolean)
      )
    );

    if (uniqueUrls.length === 0) {
      showToast({
        title: 'No links found',
        description: 'There are no mirror links in the Library Directory to check.',
        variant: 'info',
      });
      return;
    }

    const reportedUrls = Array.from(
      new Set([
        ...Array.from(openReportedUrlSet),
        ...games.flatMap((game) =>
          (game.downloadLinks ?? [])
            .filter((m) => m.healthStatus === 'issue_reported')
            .map((m) => m.url.trim())
        ),
      ])
    );

    setCheckingAllLinks(true);
    try {
      const nextMap: Record<string, MirrorValidationResult> = {};
      const batchSize = 12;

      for (let i = 0; i < uniqueUrls.length; i += batchSize) {
        const batch = uniqueUrls.slice(i, i + batchSize);
        const response = await fetch('/api/mirrors/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls: batch,
            forceRefresh: true,
            reportedUrls,
          }),
        });
        if (!response.ok) {
          throw new Error('Mirror health check request failed.');
        }
        const data = (await response.json()) as { results?: MirrorValidationResult[] };
        for (const item of data.results ?? []) {
          nextMap[item.url] = item;
        }
      }

      const deadEntries: DeadMirrorEntry[] = [];
      let degradedCount = 0;

      for (const game of games) {
        for (const mirror of game.downloadLinks ?? []) {
          const res = nextMap[mirror.url.trim()];
          if (!res) continue;
          if (res.health === 'offline' || !res.valid) {
            deadEntries.push({
              gameId: game.id,
              gameTitle: game.title,
              label: mirror.label,
              provider: mirror.provider,
              url: mirror.url,
              reason: res.reason || 'Mirror link is offline or unreachable.',
            });
          } else if (res.health === 'degraded') {
            degradedCount += 1;
          }
        }
      }

      setCheckedLinkMap(nextMap);
      setDeadLinkEntries(deadEntries);
      setShowDeadAlert(deadEntries.length > 0);
      setLastLinkAuditAt(Date.now());

      if (deadEntries.length > 0) {
        const previewList = deadEntries
          .slice(0, 3)
          .map((d) => `${d.gameTitle} — ${d.provider} (${d.url})`)
          .join(' • ');
        const extra =
          deadEntries.length > 3 ? ` (+${deadEntries.length - 3} more)` : '';
        showToast({
          title: `${deadEntries.length} dead mirror ${deadEntries.length === 1 ? 'link' : 'links'} found`,
          description: `${previewList}${extra}`,
          variant: 'error',
          durationMs: 8000,
        });
      } else if (degradedCount > 0) {
        showToast({
          title: `Checked ${uniqueUrls.length} links — no dead links`,
          description: `${degradedCount} mirror(s) responded slowly or with rate-limiting.`,
          variant: 'info',
          durationMs: 5000,
        });
      } else {
        showToast({
          title: `All ${uniqueUrls.length} mirror links are online`,
          description: `Verified across ${games.length} ${games.length === 1 ? 'game' : 'games'} in the Library Directory.`,
          variant: 'success',
          durationMs: 4500,
        });
      }
    } catch (error) {
      showToast({
        title: 'Link check failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to verify mirror links right now.',
        variant: 'error',
      });
    } finally {
      setCheckingAllLinks(false);
    }
  };

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

  const filteredAuditLogs = auditLogs.filter((log) =>
    auditFilter === 'all' ? true : log.actionType === auditFilter
  );
  const totalAuditPages = Math.max(
    1,
    Math.ceil(filteredAuditLogs.length / AUDIT_PAGE_SIZE)
  );
  const currentAuditPage = Math.min(auditPage, totalAuditPages);
  const auditStartIndex = (currentAuditPage - 1) * AUDIT_PAGE_SIZE;
  const paginatedAuditLogs = filteredAuditLogs.slice(
    auditStartIndex,
    auditStartIndex + AUDIT_PAGE_SIZE
  );

  const getAuditActionBadgeStyle = (actionType: ActivityActionType) => {
    switch (actionType) {
      case 'game_delete':
        return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
      case 'catalog_seed':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'game_update':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'game_publish':
      default:
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
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
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#131822] border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDashboardSubView('overview')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dashboardSubView === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setDashboardSubView('audit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dashboardSubView === 'audit'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin Audit Log</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                    dashboardSubView === 'audit'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {auditLogs.length}
                </span>
              </button>
            </div>
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

      {isAdmin && dashboardSubView === 'audit' ? (
        <section className="bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Admin Audit Log
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                High-impact administrative catalog actions queried from Firestore (Game Published, Game Updated, Game Deleted, Catalog Seeded).
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Actions' },
                  { id: 'game_publish', label: 'Game Published' },
                  { id: 'game_update', label: 'Game Updated' },
                  { id: 'game_delete', label: 'Game Deleted' },
                  { id: 'catalog_seed', label: 'Catalog Seeded' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setAuditFilter(tab.id);
                    setAuditPage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    auditFilter === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {auditLoading ? (
            <div className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Loading admin audit logs...
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No high-impact admin actions recorded for this filter yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-5 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Admin</th>
                      <th className="py-3 px-4 font-medium">Target Game</th>
                      <th className="py-3 px-4 font-medium">Detail</th>
                      <th className="py-3 px-5 font-medium text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-sm">
                    {paginatedAuditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium ${getAuditActionBadgeStyle(
                              log.actionType
                            )}`}
                          >
                            {ACTION_LABELS[log.actionType] || log.actionType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                          {log.userName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white font-medium">
                            {log.gameTitle}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {log.gameId}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs max-w-[320px] truncate">
                          {log.detail}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E14]/60 text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  Showing {auditStartIndex + 1}–
                  {Math.min(auditStartIndex + AUDIT_PAGE_SIZE, filteredAuditLogs.length)} of{' '}
                  {filteredAuditLogs.length}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAuditPage((prev) =>
                        Math.max(1, Math.min(prev, totalAuditPages) - 1)
                      )
                    }
                    disabled={currentAuditPage <= 1}
                    aria-label="Previous audit page"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131822] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="px-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {currentAuditPage} / {totalAuditPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))
                    }
                    disabled={currentAuditPage >= totalAuditPages}
                    aria-label="Next audit page"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131822] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <>

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
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {isAdmin ? 'Open Mirror Reports' : 'Logged Events'}
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              isAdmin && openMirrorReports.length > 0
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {isAdmin ? openMirrorReports.length : activities.length}
          </div>
        </div>
      </div>

      {isAdmin && openMirrorReports.length > 0 && (
        <section
          role="alert"
          className="bg-orange-50/90 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/35 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Flag className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                  Reported Dead Mirrors ({openMirrorReports.length})
                </h2>
                <p className="text-xs text-orange-800/80 dark:text-orange-300/80">
                  Players flagged these mirror URLs as broken. Edit the game mirror or mark resolved once verified.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {openMirrorReports.map((report) => {
              const matchedGame = games.find((g) => g.id === report.gameId);
              const isResolving = resolvingReportId === report.id;
              return (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-white/90 dark:bg-[#0B0E14]/90 border border-orange-200/80 dark:border-orange-500/25"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => matchedGame && onOpenGame(matchedGame)}
                        className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {report.gameTitle}
                      </button>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="font-medium text-orange-700 dark:text-orange-300">
                        {report.mirrorProvider} ({report.mirrorLabel})
                      </span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        Reported by {report.userName}
                      </span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      Reason: <span className="font-medium">{report.reason}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-2xl">
                      {report.mirrorUrl}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {matchedGame && (
                      <button
                        type="button"
                        onClick={() => onEditGame(matchedGame)}
                        className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition-colors"
                      >
                        Fix Link
                      </button>
                    )}
                    {onResolveMirrorReport && (
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={() => void handleResolveReport(report)}
                        className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 dark:bg-[#131822] dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50 text-xs font-medium transition-colors"
                      >
                        {isResolving ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                  onClick={() => {
                    setActivityFilter(tab.id);
                    setActivityPage(1);
                  }}
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
            <>
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
                    {paginatedActivities.map((act) => (
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

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E14]/60 text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  Showing {activityStartIndex + 1}–
                  {Math.min(activityStartIndex + ACTIVITY_PAGE_SIZE, filteredActivities.length)} of{' '}
                  {filteredActivities.length}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivityPage((prev) => Math.max(1, Math.min(prev, totalActivityPages) - 1))}
                    disabled={currentActivityPage <= 1}
                    aria-label="Previous activity page"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131822] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="px-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {currentActivityPage} / {totalActivityPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setActivityPage((prev) => Math.min(totalActivityPages, prev + 1))}
                    disabled={currentActivityPage >= totalActivityPages}
                    aria-label="Next activity page"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131822] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Wishlist Collection (Clean vertical covers) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs dark:shadow-none">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Saved Collection</h2>
            <div className="flex items-center gap-2.5">
              {wishlist.length > 0 && (
                <button
                  type="button"
                  onClick={onExportWishlist}
                  title="Export wishlist backup as JSON"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#0B0E14] dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>JSON</span>
                </button>
              )}
              <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {wishlist.length} items
              </span>
            </div>
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
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Library Directory</h2>
              {lastLinkAuditAt !== null && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                    deadLinkEntries.length > 0
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {deadLinkEntries.length > 0 ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      <span>{deadLinkEntries.length} Dead Link(s)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>All Links OK</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isAdmin
                ? 'Registered admin session active — you can publish, edit, verify links, and remove titles.'
                : 'Read-only directory overview of available builds and mirror counts.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => {
                  setCatalogSearch(e.target.value);
                  setLibraryPage(1);
                }}
                placeholder="Filter library..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleCheckAllLibraryLinks()}
              disabled={checkingAllLinks || games.length === 0}
              title="Verify all download mirror URLs in the Library Directory"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 dark:bg-[#0B0E14] dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-medium whitespace-nowrap transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${
                  checkingAllLinks ? 'animate-spin' : ''
                }`}
              />
              <span>{checkingAllLinks ? 'Checking Links...' : 'Check All Links'}</span>
            </button>
            <button
              type="button"
              onClick={onExportCatalog}
              disabled={games.length === 0}
              title="Export catalog backup as JSON"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 dark:bg-[#0B0E14] dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-40 text-xs font-medium whitespace-nowrap transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Export Catalog</span>
            </button>
          </div>
        </div>

        {showDeadAlert && deadLinkEntries.length > 0 && (
          <div
            role="alert"
            className="mx-5 mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {deadLinkEntries.length} Dead Mirror {deadLinkEntries.length === 1 ? 'Link' : 'Links'} Detected
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeadAlert(false)}
                aria-label="Dismiss dead link alert"
                className="p-1 rounded text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="space-y-1.5 text-xs">
              {deadLinkEntries.map((entry, idx) => {
                const matchedGame = games.find((g) => g.id === entry.gameId);
                return (
                  <li
                    key={`${entry.gameId}-${entry.url}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-[#0B0E14]/80 border border-red-200/80 dark:border-red-500/20"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {entry.gameTitle}{' '}
                        <span className="text-slate-500 dark:text-slate-400 font-normal">
                          · {entry.provider} ({entry.label})
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-red-700 dark:text-red-300 truncate max-w-xl">
                        {entry.url} — {entry.reason}
                      </div>
                    </div>
                    {isAdmin && matchedGame && (
                      <button
                        type="button"
                        onClick={() => onEditGame(matchedGame)}
                        className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-medium shrink-0 transition-colors"
                      >
                        Fix Link
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
              {paginatedCatalogGames.map((game) => {
                const gameLinkResults = (game.downloadLinks ?? [])
                  .map((m) => checkedLinkMap[m.url.trim()])
                  .filter((r): r is MirrorValidationResult => Boolean(r));
                const reportedCount = (game.downloadLinks ?? []).filter(
                  (m) =>
                    openReportedUrlSet.has(m.url.trim()) ||
                    m.healthStatus === 'issue_reported' ||
                    checkedLinkMap[m.url.trim()]?.health === 'issue_reported'
                ).length;
                const deadCount = gameLinkResults.filter(
                  (r) => r.health === 'offline' || (!r.valid && r.health !== 'issue_reported')
                ).length;
                const degradedCount = gameLinkResults.filter(
                  (r) => r.health === 'degraded' && r.valid
                ).length;

                return (
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
                      <div className="inline-flex items-center gap-2">
                        <span>{game.downloadLinks.length} links</span>
                        {(gameLinkResults.length > 0 || reportedCount > 0) && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium ${
                              reportedCount > 0
                                ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                                : deadCount > 0
                                  ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                                  : degradedCount > 0
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                reportedCount > 0
                                  ? 'bg-orange-500'
                                  : deadCount > 0
                                    ? 'bg-red-500'
                                    : degradedCount > 0
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                              }`}
                            />
                            {reportedCount > 0
                              ? `${reportedCount} issue reported`
                              : deadCount > 0
                                ? `${deadCount} dead`
                                : degradedCount > 0
                                  ? `${degradedCount} slow`
                                  : 'All OK'}
                          </span>
                        )}
                      </div>
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
                );
              })}
              {filteredCatalogGames.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-8 text-center text-sm text-slate-600 dark:text-slate-400"
                  >
                    {games.length === 0
                      ? 'No games published in Firestore catalog yet.'
                      : 'No titles match your library filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredCatalogGames.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E14]/60 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              Showing {libraryStartIndex + 1}–
              {Math.min(libraryStartIndex + LIBRARY_PAGE_SIZE, filteredCatalogGames.length)} of{' '}
              {filteredCatalogGames.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setLibraryPage((prev) =>
                    Math.max(1, Math.min(prev, totalLibraryPages) - 1)
                  )
                }
                disabled={currentLibraryPage <= 1}
                aria-label="Previous library page"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131822] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {currentLibraryPage} / {totalLibraryPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setLibraryPage((prev) => Math.min(totalLibraryPages, prev + 1))
                }
                disabled={currentLibraryPage >= totalLibraryPages}
                aria-label="Next library page"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131822] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
