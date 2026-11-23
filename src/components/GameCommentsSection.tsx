import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { MessagesSquare, Send, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BLUEPRINT_LIMITS,
  isSafeHttpOrAssetUrl,
  type GameComment,
  type UserPublicBadge,
} from '../types/game';
import { useToast } from './ToastProvider';

interface GameCommentsSectionProps {
  gameId: string;
  gameTitle: string;
  gameCreatedBy: string;
  user: User | null;
  userAvatarUrl?: string;
  userDisplayName?: string;
  isAdmin: boolean;
  isPreviewOnly?: boolean;
  onRequireAuth: () => void;
}

interface ResolvedUserBadge {
  role: 'admin' | 'user';
  memberSinceMs: number | null;
}

const VERIFIED_TENURE_MS = 7 * 24 * 60 * 60 * 1000;

function toMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return Date.now();
  const maybe = ts as { toMillis?: () => number };
  return typeof maybe.toMillis === 'function' ? maybe.toMillis() : Date.now();
}

function toOptionalMillis(ts: unknown): number | null {
  if (!ts || typeof ts !== 'object') return null;
  const maybe = ts as { toMillis?: () => number };
  return typeof maybe.toMillis === 'function' ? maybe.toMillis() : null;
}

function resolveRoleBadge(
  commentUserId: string,
  badgeInfo: ResolvedUserBadge | undefined,
  gameCreatedBy: string
): { label: 'Admin' | 'Verified'; title: string; className: string } | null {
  if (badgeInfo?.role === 'admin' || commentUserId === gameCreatedBy) {
    return {
      label: 'Admin',
      title: 'Game creator or registered platform administrator',
      className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    };
  }
  if (
    badgeInfo?.memberSinceMs !== null &&
    badgeInfo?.memberSinceMs !== undefined &&
    Date.now() - badgeInfo.memberSinceMs >= VERIFIED_TENURE_MS
  ) {
    return {
      label: 'Verified',
      title: 'Long-time verified GameVault community member',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    };
  }
  return null;
}

export function GameCommentsSection({
  gameId,
  gameTitle,
  gameCreatedBy,
  user,
  userAvatarUrl,
  userDisplayName,
  isAdmin,
  isPreviewOnly = false,
  onRequireAuth,
}: GameCommentsSectionProps) {
  const [comments, setComments] = useState<GameComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userBadges, setUserBadges] = useState<Record<string, ResolvedUserBadge>>({});
  const fetchedUidsRef = useRef<Set<string>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    if (isPreviewOnly) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'comments'),
      where('gameId', '==', gameId),
      where('visibility', '==', 'public')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: GameComment[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GameComment, 'id'>),
        }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setComments(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'comments');
      }
    );

    return () => unsubscribe();
  }, [gameId, isPreviewOnly]);

  // Fetch user role & tenure metadata from users/{uid}/public/profile for commenters
  useEffect(() => {
    const missingUids = Array.from(
      new Set(comments.map((c) => c.userId))
    ).filter((uid) => uid && !fetchedUidsRef.current.has(uid));

    if (missingUids.length === 0) return;

    missingUids.forEach((uid) => fetchedUidsRef.current.add(uid));

    let cancelled = false;
    const loadBadges = async () => {
      const entries = await Promise.all(
        missingUids.map(async (uid): Promise<[string, ResolvedUserBadge]> => {
          const badgePath = `users/${uid}/public/profile`;
          try {
            const snap = await getDoc(doc(db, 'users', uid, 'public', 'profile'));
            if (snap.exists()) {
              const data = snap.data() as UserPublicBadge;
              return [
                uid,
                {
                  role: data.role === 'admin' ? 'admin' : 'user',
                  memberSinceMs: toOptionalMillis(data.memberSince),
                },
              ];
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, badgePath);
          }
          return [
            uid,
            {
              role: uid === gameCreatedBy ? 'admin' : 'user',
              memberSinceMs: null,
            },
          ];
        })
      );

      if (!cancelled) {
        setUserBadges((prev) => {
          const next = { ...prev };
          for (const [uid, info] of entries) {
            next[uid] = info;
          }
          return next;
        });
      }
    };

    void loadBadges();

    return () => {
      cancelled = true;
    };
  }, [comments, gameCreatedBy]);

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault();
    if (isPreviewOnly) {
      setErrorMsg(
        'This starter preview must be published to Firestore before posting comments.'
      );
      return;
    }
    if (!user) {
      onRequireAuth();
      return;
    }

    const trimmed = commentText.trim();
    if (
      trimmed.length < BLUEPRINT_LIMITS.COMMENT_MIN ||
      trimmed.length > BLUEPRINT_LIMITS.COMMENT_MAX
    ) {
      setErrorMsg(
        `Comment must be between ${BLUEPRINT_LIMITS.COMMENT_MIN} and ${BLUEPRINT_LIMITS.COMMENT_MAX} characters.`
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const authorName = (
      userDisplayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'Player'
    ).slice(0, 80);

    try {
      await addDoc(collection(db, 'comments'), {
        gameId,
        userId: user.uid,
        userName: authorName,
        userPhoto: (userAvatarUrl || user.photoURL || '').slice(0, 500),
        text: trimmed,
        visibility: 'public',
        createdAt: serverTimestamp(),
      });

      setCommentText('');

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        userName: authorName,
        actionType: 'comment',
        gameId,
        gameTitle: gameTitle.slice(0, 120),
        detail: `Commented: ${trimmed}`.slice(0, 240),
        createdAt: serverTimestamp(),
      });

      showToast({
        title: 'Comment posted',
        description: `Your comment was added to ${gameTitle}.`,
        variant: 'success',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment: GameComment) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (user.uid !== comment.userId && !isAdmin) return;

    setDeletingId(comment.id);
    const commentPath = `comments/${comment.id}`;
    try {
      await deleteDoc(doc(db, 'comments', comment.id));
      showToast({
        title: 'Comment deleted',
        description: 'Your comment has been removed.',
        variant: 'info',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, commentPath);
    } finally {
      setDeletingId(null);
    }
  };

  const formatTimestamp = (ts: unknown) => {
    if (!ts || typeof ts !== 'object') return 'Just now';
    const maybe = ts as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') {
      return maybe.toDate().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return 'Just now';
  };

  return (
    <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Community Discussion ({comments.length})
          </h3>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          Ask questions about mirrors, patches, or compatibility
        </span>
      </div>

      {user ? (
        <form
          onSubmit={handlePostComment}
          className="p-4 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Commenting as{' '}
              <span className="text-slate-900 dark:text-slate-200 font-medium">
                {user.displayName || user.email}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              {commentText.trim().length}/{BLUEPRINT_LIMITS.COMMENT_MAX}
            </span>
          </div>

          {errorMsg && <div className="text-xs text-red-600 dark:text-red-400">{errorMsg}</div>}

          <textarea
            rows={2}
            maxLength={BLUEPRINT_LIMITS.COMMENT_MAX}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={`Share a comment about ${gameTitle}...`}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || commentText.trim().length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Sign in with Google to join the discussion or post comments on {gameTitle}.
          </span>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            Sign In to Comment
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-600 dark:text-slate-400 py-3">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-slate-600 dark:text-slate-400 py-3">
          No comments yet. Start the discussion for {gameTitle}.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
          {comments.map((comment) => {
            const canDelete = Boolean(
              user && (user.uid === comment.userId || isAdmin)
            );
            const initial = (comment.userName || 'P').slice(0, 1).toUpperCase();
            const roleBadge = resolveRoleBadge(
              comment.userId,
              userBadges[comment.userId],
              gameCreatedBy
            );
            return (
              <div
                key={comment.id}
                className="py-4 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {comment.userPhoto && isSafeHttpOrAssetUrl(comment.userPhoto) ? (
                    <img
                      src={comment.userPhoto}
                      alt={comment.userName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {initial}
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {comment.userName}
                      </span>
                      {roleBadge && (
                        <span
                          title={roleBadge.title}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] leading-none ${roleBadge.className}`}
                        >
                          {roleBadge.label}
                        </span>
                      )}
                      <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 font-mono">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>
                  </div>
                </div>

                {canDelete && (
                  <button
                    type="button"
                    disabled={deletingId === comment.id}
                    onClick={() => void handleDeleteComment(comment)}
                    aria-label="Delete comment"
                    className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:text-red-400 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
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
  );
}
