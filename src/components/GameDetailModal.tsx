import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  Download,
  ExternalLink,
  MessageSquare,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  BLUEPRINT_LIMITS,
  isSafeHttpOrAssetUrl,
  resolveBannerCover,
  resolveVerticalCover,
  type DownloadMirror,
  type GameItem,
  type GameReview,
  type MirrorValidationResult,
} from '../types/game';
import { SafeImage } from './SafeImage';
import { GameCommentsSection } from './GameCommentsSection';
import { useToast } from './ToastProvider';

interface GameDetailModalProps {
  game: GameItem;
  user: User | null;
  userAvatarUrl?: string;
  userDisplayName?: string;
  isAdmin: boolean;
  isWishlisted: boolean;
  isPreviewOnly?: boolean;
  onToggleWishlist: (game: GameItem) => Promise<void>;
  onRequireAuth: () => void;
  onClose: () => void;
}

const ADMIN_UPDATE_WINDOW_MS = 48 * 60 * 60 * 1000;

function toMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const maybe = ts as { toMillis?: () => number };
  return typeof maybe.toMillis === 'function' ? maybe.toMillis() : 0;
}

function formatRelativeAge(ageMs: number): string {
  if (ageMs < 60_000) return 'just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(ageMs / 86_400_000);
  return `${days}d ago`;
}

function ReviewUserAvatar({
  photoUrl,
  name,
  sizeClass = 'w-8 h-8',
}: {
  photoUrl?: string;
  name: string;
  sizeClass?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const initial = (name || 'P').trim().slice(0, 1).toUpperCase() || 'P';

  if (photoUrl && isSafeHttpOrAssetUrl(photoUrl) && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#0B0E14] shrink-0`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center shrink-0`}
    >
      {initial}
    </div>
  );
}

export function GameDetailModal({
  game,
  user,
  userAvatarUrl,
  userDisplayName,
  isAdmin,
  isWishlisted,
  isPreviewOnly = false,
  onToggleWishlist,
  onRequireAuth,
  onClose,
}: GameDetailModalProps) {
  const [activeShotIndex, setActiveShotIndex] = useState(0);
  const [reviews, setReviews] = useState<GameReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [verifyingMirrors, setVerifyingMirrors] = useState(false);
  const [mirrorStatusMap, setMirrorStatusMap] = useState<
    Record<string, MirrorValidationResult>
  >({});
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [whatsNewDismissed, setWhatsNewDismissed] = useState(false);
  const shareTimerRef = useRef<number | null>(null);
  const notifiedUpdateKeyRef = useRef<string | null>(null);
  const { showToast } = useToast();

  const bannerCover = resolveBannerCover(game);
  const verticalCover = resolveVerticalCover(game);
  const screenshots =
    game.screenshots && game.screenshots.length > 0 ? game.screenshots : [bannerCover];
  const activeShot = screenshots[activeShotIndex] || bannerCover;

  const adminUpdatedMs = toMillis(game.adminUpdatedAt);
  const adminUpdateAgeMs = adminUpdatedMs > 0 ? Date.now() - adminUpdatedMs : -1;
  const isRecentlyUpdatedByAdmin =
    adminUpdatedMs > 0 &&
    adminUpdateAgeMs >= 0 &&
    adminUpdateAgeMs <= ADMIN_UPDATE_WINDOW_MS;

  useEffect(() => {
    setActiveShotIndex(0);
    setShareStatus('idle');
    setWhatsNewDismissed(false);
  }, [game.id, adminUpdatedMs]);

  useEffect(() => {
    if (!isRecentlyUpdatedByAdmin) return;
    const visitKey = `${game.id}:${adminUpdatedMs}`;
    if (notifiedUpdateKeyRef.current === visitKey) return;
    notifiedUpdateKeyRef.current = visitKey;
    showToast({
      title: `What's New in ${game.title}`,
      description: `Updated by an admin ${formatRelativeAge(adminUpdateAgeMs)}.`,
      variant: 'info',
      durationMs: 5000,
    });
  }, [adminUpdateAgeMs, adminUpdatedMs, game.id, game.title, isRecentlyUpdatedByAdmin, showToast]);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current !== null) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, []);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    let copied = false;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setShareStatus(copied ? 'copied' : 'error');
    if (copied) {
      showToast({
        title: 'Link copied to clipboard',
        description: `Share link for ${game.title} copied.`,
        variant: 'success',
      });
    } else {
      showToast({
        title: 'Copy unavailable',
        description: 'Unable to copy the page URL automatically in this browser.',
        variant: 'error',
      });
    }

    if (shareTimerRef.current !== null) {
      window.clearTimeout(shareTimerRef.current);
    }
    shareTimerRef.current = window.setTimeout(() => {
      setShareStatus('idle');
    }, 3000);
  };

  // Subscribe to top-level /reviews collection filtered by gameId
  useEffect(() => {
    if (isPreviewOnly) {
      setReviews([]);
      setReviewsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'reviews'),
      where('gameId', '==', game.id),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: GameReview[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GameReview, 'id'>),
        }));
        list.sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
        setReviews(list);
        setReviewsLoading(false);
      },
      (error) => {
        setReviewsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );
    return () => unsubscribe();
  }, [game.id, isPreviewOnly]);

  const userExistingReview = useMemo(
    () => (user ? reviews.find((r) => r.userId === user.uid) || null : null),
    [reviews, user]
  );

  // Sync composer state with existing user review when loaded
  useEffect(() => {
    if (userExistingReview) {
      setReviewRating(userExistingReview.rating);
      setReviewText(userExistingReview.content);
    } else {
      setReviewRating(5);
      setReviewText('');
    }
  }, [userExistingReview?.id]);

  const starDistribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const rev of reviews) {
      const rounded = Math.min(5, Math.max(1, Math.round(rev.rating)));
      counts[rounded] = (counts[rounded] || 0) + 1;
    }
    return counts;
  }, [reviews]);

  const handleMirrorDownload = async (mirror: DownloadMirror) => {
    if (!isSafeHttpOrAssetUrl(mirror.url)) {
      setDownloadFeedback('This mirror link failed URL safety validation.');
      showToast({
        title: 'Blocked mirror link',
        description: 'This mirror link failed URL safety validation.',
        variant: 'error',
      });
      return;
    }

    setDownloadFeedback(`Opening ${mirror.provider}: ${mirror.label}`);
    showToast({
      title: 'Opening download mirror',
      description: `${mirror.provider} · ${mirror.label}`,
      variant: 'info',
    });

    if (!isPreviewOnly && user && user.emailVerified) {
      const gamePath = `games/${game.id}`;
      try {
        await updateDoc(doc(db, 'games', game.id), {
          downloadsCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, gamePath);
      }

      const activityPath = 'activities';
      try {
        await addDoc(collection(db, activityPath), {
          userId: user.uid,
          userName: (user.displayName || user.email?.split('@')[0] || 'Player').slice(0, 80),
          actionType: 'download',
          gameId: game.id,
          gameTitle: game.title.slice(0, 120),
          detail: `Mirror: ${mirror.provider} (${mirror.label})`.slice(0, 240),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, activityPath);
      }
    }
  };

  const handleVerifyMirrors = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setVerifyingMirrors(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch('/api/mirrors/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          urls: game.downloadLinks.map((m) => m.url),
        }),
      });
      const data = (await response.json()) as { results?: MirrorValidationResult[] };
      if (response.ok && data.results) {
        const nextMap: Record<string, MirrorValidationResult> = {};
        let validCount = 0;
        data.results.forEach((item) => {
          nextMap[item.url] = item;
          if (item.valid) validCount += 1;
        });
        setMirrorStatusMap(nextMap);
        showToast({
          title: 'Mirror verification complete',
          description: `${validCount} of ${data.results.length} mirrors validated.`,
          variant: validCount === data.results.length ? 'success' : 'info',
        });
      }
    } finally {
      setVerifyingMirrors(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (isPreviewOnly) {
      setReviewError(
        'This starter preview must be published to Firestore before submitting reviews.'
      );
      return;
    }
    if (!user) {
      onRequireAuth();
      return;
    }
    const trimmed = reviewText.trim();
    if (
      trimmed.length < BLUEPRINT_LIMITS.REVIEW_MIN ||
      trimmed.length > BLUEPRINT_LIMITS.REVIEW_MAX
    ) {
      setReviewError(
        `Review must be between ${BLUEPRINT_LIMITS.REVIEW_MIN} and ${BLUEPRINT_LIMITS.REVIEW_MAX} characters.`
      );
      return;
    }

    const starValue = Math.min(5, Math.max(1, Math.round(reviewRating)));
    const reviewId = `${game.id}_${user.uid}`;
    const reviewRef = doc(db, 'reviews', reviewId);
    const gameRef = doc(db, 'games', game.id);

    setSubmittingReview(true);
    setReviewError(null);

    try {
      let isUpdate = false;
      await runTransaction(db, async (tx) => {
        const gameSnap = await tx.get(gameRef);
        if (!gameSnap.exists()) {
          throw new Error('Game document no longer exists.');
        }
        const gameData = gameSnap.data() as Partial<GameItem>;
        const currentCount = typeof gameData.reviewCount === 'number' ? gameData.reviewCount : 0;
        const currentSum = typeof gameData.ratingSum === 'number' ? gameData.ratingSum : 0;

        const existingReviewSnap = await tx.get(reviewRef);
        if (existingReviewSnap.exists()) {
          isUpdate = true;
          const prevReview = existingReviewSnap.data() as GameReview;
          const nextSum = Math.max(0, currentSum - prevReview.rating + starValue);
          const nextAvg =
            currentCount > 0 ? Math.round((nextSum / currentCount) * 10) / 10 : 0;

          tx.update(reviewRef, {
            rating: starValue,
            content: trimmed,
            updatedAt: serverTimestamp(),
          });

          tx.update(gameRef, {
            rating: nextAvg,
            ratingSum: nextSum,
            reviewCount: currentCount,
            updatedAt: serverTimestamp(),
          });
        } else {
          const nextCount = currentCount + 1;
          const nextSum = currentSum + starValue;
          const nextAvg = Math.round((nextSum / nextCount) * 10) / 10;

          tx.set(reviewRef, {
            gameId: game.id,
            userId: user.uid,
            userName: (
              userDisplayName ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'Player'
            ).slice(0, 80),
            userPhoto: (userAvatarUrl || user.photoURL || '').slice(0, 500),
            rating: starValue,
            content: trimmed,
            visibility: 'public',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          tx.update(gameRef, {
            rating: nextAvg,
            ratingSum: nextSum,
            reviewCount: nextCount,
            updatedAt: serverTimestamp(),
          });
        }
      });

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        userName: (user.displayName || user.email?.split('@')[0] || 'Player').slice(0, 80),
        actionType: 'comment',
        gameId: game.id,
        gameTitle: game.title.slice(0, 120),
        detail: `${isUpdate ? 'Updated' : 'Submitted'} ${starValue}/5 star review`.slice(0, 240),
        createdAt: serverTimestamp(),
      });
      showToast({
        title: isUpdate ? 'Review updated' : 'Review submitted',
        description: `Rated ${game.title} ${starValue}/5 stars.`,
        variant: 'success',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `reviews/${reviewId}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (review: GameReview) => {
    const reviewRef = doc(db, 'reviews', review.id);
    const gameRef = doc(db, 'games', game.id);
    try {
      await runTransaction(db, async (tx) => {
        const gameSnap = await tx.get(gameRef);
        const reviewSnap = await tx.get(reviewRef);
        if (!reviewSnap.exists()) return;

        if (gameSnap.exists()) {
          const gameData = gameSnap.data() as Partial<GameItem>;
          const currentCount = typeof gameData.reviewCount === 'number' ? gameData.reviewCount : 0;
          const currentSum = typeof gameData.ratingSum === 'number' ? gameData.ratingSum : 0;
          const nextCount = Math.max(0, currentCount - 1);
          const nextSum = Math.max(0, currentSum - review.rating);
          const nextAvg = nextCount > 0 ? Math.round((nextSum / nextCount) * 10) / 10 : 0;

          tx.update(gameRef, {
            rating: nextAvg,
            ratingSum: nextSum,
            reviewCount: nextCount,
            updatedAt: serverTimestamp(),
          });
        }

        tx.delete(reviewRef);
      });
      showToast({
        title: 'Review deleted',
        description: `Removed review from ${game.title}.`,
        variant: 'info',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reviews/${review.id}`);
    }
  };

  const formatTimestamp = (ts: unknown) => {
    if (!ts || typeof ts !== 'object') return 'Just now';
    const maybe = ts as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return 'Just now';
  };

  const displayStarValue = hoverRating ?? reviewRating;
  const totalReviews = game.reviewCount ?? reviews.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/80 backdrop-blur-sm overflow-y-auto p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={game.title}
    >
      <div className="max-w-6xl mx-auto bg-white dark:bg-[#111620] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-4">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/90">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {game.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-1">
              <span>{game.developer}</span>
              <span aria-hidden="true">·</span>
              <span>{game.genre}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{game.releaseYear}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{game.size}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 dark:bg-[#171E2C] dark:hover:bg-[#1E2738] dark:border-slate-700 dark:text-slate-200 transition-colors"
            >
              {shareStatus === 'copied' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close game details"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {shareStatus === 'copied' && (
          <div
            role="status"
            aria-live="polite"
            className="px-6 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Page URL copied to your clipboard.</span>
          </div>
        )}

        {shareStatus === 'error' && (
          <div
            role="status"
            aria-live="polite"
            className="px-6 py-2.5 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 text-xs font-medium text-red-700 dark:text-red-300"
          >
            Unable to copy the page URL automatically in this browser context.
          </div>
        )}

        {/* Wide Banner Cover Header */}
        <div className="relative h-48 sm:h-64 w-full bg-slate-100 dark:bg-[#0B0E14] overflow-hidden border-b border-slate-200 dark:border-slate-800">
          <SafeImage
            src={bannerCover}
            alt={`${game.title} banner cover`}
            fallbackTitle={game.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#111620] dark:via-[#111620]/30 pointer-events-none" />
        </div>

        <div className="p-6 space-y-8">
          {isRecentlyUpdatedByAdmin && !whatsNewDismissed && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start justify-between gap-4 px-5 py-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/35"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">What&apos;s New</span>
                    <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                      ·
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                      Updated by an admin {formatRelativeAge(adminUpdateAgeMs)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    This game&apos;s details, tags, screenshots, or download mirrors were refreshed within the last 48 hours.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setWhatsNewDismissed(true)}
                aria-label="Dismiss What's New banner"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-blue-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Media Gallery + Vertical Poster Info Module */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Screenshot Gallery */}
            <div className="lg:col-span-8 space-y-3">
              <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                <SafeImage
                  src={activeShot}
                  alt={`${game.title} screenshot ${activeShotIndex + 1}`}
                  fallbackTitle={game.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {screenshots.map((shot, idx) => {
                  const selected = idx === activeShotIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveShotIndex(idx)}
                      className={`aspect-video rounded-md overflow-hidden border transition-all ${
                        selected
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <SafeImage
                        src={shot}
                        alt={`${game.title} thumbnail ${idx + 1}`}
                        fallbackTitle={`Shot ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Vertical Box-Art Poster + Specs + Wishlist */}
            <div className="lg:col-span-4 space-y-5">
              <div className="aspect-[3/4] max-w-[260px] mx-auto lg:max-w-none rounded-lg overflow-hidden bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                <SafeImage
                  src={verticalCover}
                  alt={`${game.title} vertical poster`}
                  fallbackTitle={game.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-200 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">User Rating</div>
                  <div className="text-sm font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5 flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                    <span>{totalReviews > 0 ? game.rating.toFixed(1) : '0.0'}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Footprint</div>
                  <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {game.size}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Downloads</div>
                  <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {game.downloadsCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {(game.tags ?? []).length > 0 && (
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <span className="text-slate-500 font-medium mr-1.5">Tags:</span>
                  <span className="text-slate-800 dark:text-slate-300">{(game.tags ?? []).join(' · ')}</span>
                </div>
              )}

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{game.description}</p>

              <button
                type="button"
                onClick={() => (user ? void onToggleWishlist(game) : onRequireAuth())}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isWishlisted
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-300 dark:border-blue-500/40 dark:hover:bg-slate-700'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isWishlisted ? (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Saved in Wishlist</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>Add to Wishlist</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Multiple Download Mirrors Section */}
          <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Download Mirrors ({game.downloadLinks.length})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Select a redundant mirror source below. Signed-in downloads are tracked in your dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={handleVerifyMirrors}
                disabled={verifyingMirrors}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-800 dark:bg-[#171E2C] dark:hover:bg-[#1E2738] dark:border-slate-700 dark:text-slate-200 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{verifyingMirrors ? 'Checking Mirrors...' : 'Verify Mirror Links'}</span>
              </button>
            </div>

            {downloadFeedback && (
              <div className="px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-800 dark:text-blue-200">
                {downloadFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {game.downloadLinks.map((mirror, idx) => {
                const statusInfo = mirrorStatusMap[mirror.url];
                const safeHref = isSafeHttpOrAssetUrl(mirror.url) ? mirror.url : '#';
                return (
                  <div
                    key={`${mirror.provider}-${idx}`}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{mirror.provider}</span>
                        <span aria-hidden="true">·</span>
                        <span>{mirror.partInfo || 'Full Build'}</span>
                        {statusInfo && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                statusInfo.valid
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {statusInfo.valid ? 'Verified' : 'Invalid'}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {mirror.label}
                      </div>
                    </div>

                    <a
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void handleMirrorDownload(mirror)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                      <ExternalLink className="w-3 h-3 opacity-75" />
                    </a>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5-Star Rating Summary & Reviews Collection */}
          <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Player Ratings &amp; Reviews ({totalReviews})
                </h3>
              </div>
            </div>

            {/* Dynamic Average Rating Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 items-center">
              <div className="md:col-span-4 text-center md:border-r md:border-slate-200 dark:md:border-slate-800 md:pr-6 space-y-1.5">
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {totalReviews > 0 ? game.rating.toFixed(1) : '0.0'}
                </div>
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(game.rating)
                          ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                          : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  {totalReviews === 0
                    ? 'No player ratings yet'
                    : `Based on ${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'}`}
                </div>
              </div>

              <div className="md:col-span-8 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = starDistribution[star] || 0;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-8 font-mono tabular-nums text-slate-700 dark:text-slate-300 text-right">
                        {star} ★
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {user ? (
              <form
                onSubmit={handleSubmitReview}
                className="p-4 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ReviewUserAvatar
                      photoUrl={userAvatarUrl || user.photoURL || ''}
                      name={userDisplayName || user.displayName || user.email || 'Player'}
                      sizeClass="w-6 h-6"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {userExistingReview
                        ? `Update your 5-star review as ${userDisplayName || user.displayName || user.email}`
                        : `Rate & review as ${userDisplayName || user.displayName || user.email}`}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onMouseLeave={() => setHoverRating(null)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() => setReviewRating(star)}
                        aria-label={`Rate ${star} stars`}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            star <= displayStarValue
                              ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {displayStarValue}/5
                    </span>
                  </div>
                </div>

                {reviewError && <div className="text-xs text-red-600 dark:text-red-400">{reviewError}</div>}

                <textarea
                  rows={2}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write your thoughts on performance, gameplay, or mirror integrity..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />

                <div className="flex items-center justify-end gap-2">
                  {userExistingReview && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteReview(userExistingReview)}
                      className="px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-red-100 text-slate-700 hover:text-red-700 dark:bg-slate-800 dark:hover:bg-red-500/20 dark:text-slate-300 dark:hover:text-red-300 text-xs font-medium transition-colors"
                    >
                      Delete Review
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors"
                  >
                    {submittingReview
                      ? 'Saving...'
                      : userExistingReview
                        ? 'Update Review'
                        : 'Submit Review'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Sign in with Google to submit a 5-star rating, review builds, or save games to your wishlist.
                </span>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  Sign In to Rate
                </button>
              </div>
            )}

            {reviewsLoading ? (
              <div className="text-sm text-slate-600 dark:text-slate-400 py-4">Loading player reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400 py-4">
                No reviews yet. Be the first player to rate {game.title}.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {reviews.map((review) => {
                  const canDelete = Boolean(
                    user && (user.uid === review.userId || isAdmin)
                  );
                  const resolvedPhoto =
                    user && user.uid === review.userId && userAvatarUrl
                      ? userAvatarUrl
                      : review.userPhoto;
                  return (
                    <div key={review.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          <ReviewUserAvatar
                            photoUrl={resolvedPhoto}
                            name={review.userName}
                            sizeClass="w-8 h-8"
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {review.userName}
                            </span>
                            <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-amber-600 dark:text-amber-400 font-mono tabular-nums inline-flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                              {review.rating}/5
                            </span>
                            <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 font-mono">
                              {formatTimestamp(review.updatedAt || review.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                            {review.content}
                          </p>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteReview(review)}
                          aria-label="Delete review"
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-slate-800 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <GameCommentsSection
            gameId={game.id}
            gameTitle={game.title}
            gameCreatedBy={game.createdBy}
            user={user}
            userAvatarUrl={userAvatarUrl}
            userDisplayName={userDisplayName}
            isAdmin={isAdmin}
            isPreviewOnly={isPreviewOnly}
            onRequireAuth={onRequireAuth}
          />
        </div>
      </div>
    </div>
  );
}
