import { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Download,
  Layers,
  Plus,
  Scale,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import { STARTER_GAMES } from './data/starterCatalog';
import {
  GAME_GENRES,
  resolveBannerCover,
  resolveVerticalCover,
  type ActivityLog,
  type GameGenre,
  type GameItem,
  type UserProfile,
  type WishlistItem,
} from './types/game';
import { TopBar, type AppView, type ThemeMode } from './components/TopBar';
import { SafeImage } from './components/SafeImage';
import { GameDetailModal } from './components/GameDetailModal';
import { GameFormModal, type GameFormValues } from './components/GameFormModal';
import { CompareGamesModal } from './components/CompareGamesModal';
import { DashboardView } from './components/DashboardView';
import { useToast } from './components/ToastProvider';

type SortOption = 'rating' | 'downloads' | 'newest';

function toMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const maybe = ts as { toMillis?: () => number };
  return typeof maybe.toMillis === 'function' ? maybe.toMillis() : 0;
}

function slugifyGameId(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || 'game'}-${suffix}`;
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('storefront');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [games, setGames] = useState<GameItem[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<'All' | GameGenre>('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('rating');

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [compareGameIds, setCompareGameIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('gamevault-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameItem | null>(null);
  const [seeding, setSeeding] = useState(false);

  const autoSeededRef = useRef(false);
  const justSignedInRef = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('gamevault-theme', theme);
    } catch {
      // Ignore storage quota or restricted context errors
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Sync user profile & verify registered Google Admin status via Node.js middleware
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser && currentUser.emailVerified) {
        let verifiedAdmin = false;
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const payload = (await res.json()) as {
              verified?: boolean;
              user?: { isAdmin?: boolean };
            };
            verifiedAdmin = Boolean(payload.user?.isAdmin);
            setIsAdmin(verifiedAdmin);
          } else {
            setIsAdmin(false);
          }
        } catch {
          setIsAdmin(false);
        }

        const safeDisplayName = (
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'Player'
        ).slice(0, 80);
        const userRef = doc(db, 'users', currentUser.uid);
        const userPath = `users/${currentUser.uid}`;
        let userCreatedAt: unknown = null;
        let persistedDisplayName = safeDisplayName;

        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: (currentUser.email || '').slice(0, 160),
              displayName: safeDisplayName,
              photoURL: (currentUser.photoURL || '').slice(0, 500),
              role: verifiedAdmin ? 'admin' : 'user',
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            });
          } else {
            const existingData = snap.data() as {
              createdAt?: unknown;
              role?: string;
              displayName?: string;
              photoURL?: string;
            };
            userCreatedAt = existingData.createdAt || null;
            persistedDisplayName = (existingData.displayName || safeDisplayName).slice(0, 80);
            const preservedPhoto = (
              existingData.photoURL ||
              currentUser.photoURL ||
              ''
            ).slice(0, 500);
            await updateDoc(userRef, {
              displayName: persistedDisplayName,
              photoURL: preservedPhoto,
              ...(verifiedAdmin && existingData.role !== 'admin'
                ? { role: 'admin' }
                : {}),
              lastLoginAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, userPath);
        }

        const publicRef = doc(db, 'users', currentUser.uid, 'public', 'profile');
        const publicPath = `users/${currentUser.uid}/public/profile`;
        try {
          const publicSnap = await getDoc(publicRef);
          if (!publicSnap.exists()) {
            await setDoc(publicRef, {
              uid: currentUser.uid,
              displayName: persistedDisplayName,
              role: verifiedAdmin ? 'admin' : 'user',
              memberSince: userCreatedAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const existingPublic = publicSnap.data() as { role?: string; displayName?: string };
            await updateDoc(publicRef, {
              displayName: (existingPublic.displayName || persistedDisplayName).slice(0, 80),
              ...(verifiedAdmin && existingPublic.role !== 'admin'
                ? { role: 'admin' }
                : {}),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, publicPath);
        }

        if (justSignedInRef.current) {
          justSignedInRef.current = false;
          showToast({
            title: 'Profile updated',
            description: `Signed in as ${persistedDisplayName}.`,
            variant: 'success',
          });
        }
      } else {
        setIsAdmin(false);
        setUserProfile(null);
      }

      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [showToast]);

  // Subscribe to signed-in user's Firestore profile document
  useEffect(() => {
    if (!authReady || !user) {
      setUserProfile(null);
      return;
    }
    const profilePath = `users/${user.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, profilePath);
      }
    );
    return () => unsubscribe();
  }, [authReady, user]);

  // Subscribe to Games Catalog in real-time
  useEffect(() => {
    if (!authReady) return;
    setGamesLoading(true);
    const gamesQuery = isAdmin
      ? query(collection(db, 'games'))
      : query(collection(db, 'games'), where('visibility', '==', 'public'));

    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        const list: GameItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GameItem, 'id'>),
        }));
        setGames(list);
        setGamesLoading(false);
      },
      (error) => {
        setGamesLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'games');
      }
    );

    return () => unsubscribe();
  }, [authReady, isAdmin]);

  // Auto-seed starter games once when verified admin opens an empty catalog or legacy schema
  useEffect(() => {
    if (!authReady || gamesLoading || !isAdmin || !user) return;
    const needsSeedOrUpgrade =
      games.length === 0 ||
      games.some(
        (g) =>
          !g.bannerCoverUrl ||
          !g.verticalCoverUrl ||
          g.ratingSum === undefined ||
          g.reviewCount === undefined ||
          !Array.isArray(g.tags) ||
          g.tags.length === 0
      );
    if (needsSeedOrUpgrade && !autoSeededRef.current) {
      autoSeededRef.current = true;
      void handleSeedStarterCatalog();
    }
  }, [authReady, gamesLoading, isAdmin, user, games]);

  // Subscribe to user's private Wishlist when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setWishlist([]);
      return;
    }

    const wishlistPath = `users/${user.uid}/wishlist`;
    const q = query(
      collection(db, wishlistPath),
      where('userId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: WishlistItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WishlistItem, 'id'>),
        }));
        list.sort((a, b) => toMillis(b.addedAt) - toMillis(a.addedAt));
        setWishlist(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, wishlistPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  // Subscribe to Activity Logs when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setActivities([]);
      return;
    }

    const activitiesRef = collection(db, 'activities');
    const q = isAdmin
      ? query(activitiesRef, limit(50))
      : query(activitiesRef, where('userId', '==', user.uid), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ActivityLog[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityLog, 'id'>),
        }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setActivities(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'activities');
      }
    );

    return () => unsubscribe();
  }, [authReady, user, isAdmin]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    justSignedInRef.current = true;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      justSignedInRef.current = false;
      const msg =
        error instanceof Error ? error.message : 'Unable to complete Google sign-in.';
      setAuthError(msg);
      showToast({
        title: 'Sign-in failed',
        description: msg,
        variant: 'error',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      setIsAdmin(false);
      setUserProfile(null);
      setWishlist([]);
      setActivities([]);
      showToast({
        title: 'Signed out',
        description: 'Your session has ended.',
        variant: 'info',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (updates: {
    displayName: string;
    photoURL: string;
  }) => {
    if (!user) return;
    const trimmedName = updates.displayName.trim().slice(0, 80);
    const safePhoto = updates.photoURL.trim().slice(0, 500);
    const userRef = doc(db, 'users', user.uid);
    const publicRef = doc(db, 'users', user.uid, 'public', 'profile');

    try {
      await updateDoc(userRef, {
        displayName: trimmedName,
        photoURL: safePhoto,
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }

    try {
      await updateDoc(publicRef, {
        displayName: trimmedName,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `users/${user.uid}/public/profile`
      );
    }

    showToast({
      title: 'Profile updated',
      description: 'Your retro character avatar and profile details have been saved.',
      variant: 'success',
    });
  };

  const handleSeedStarterCatalog = async (isManual = false) => {
    if (!user || !isAdmin) return;
    setSeeding(true);
    try {
      for (const seed of STARTER_GAMES) {
        const gameRef = doc(db, 'games', seed.id);
        const existingSnap = await getDoc(gameRef);
        if (existingSnap.exists()) {
          const existingData = existingSnap.data() as Partial<GameItem>;
          const hasAggregates =
            typeof existingData.ratingSum === 'number' &&
            typeof existingData.reviewCount === 'number';
          await setDoc(gameRef, {
            title: seed.title,
            description: seed.description,
            size: seed.size,
            genre: seed.genre,
            tags: seed.tags,
            rating: hasAggregates ? (existingData.rating ?? 0) : 0,
            ratingSum: hasAggregates ? existingData.ratingSum : 0,
            reviewCount: hasAggregates ? existingData.reviewCount : 0,
            developer: seed.developer,
            releaseYear: seed.releaseYear,
            bannerCoverUrl: seed.bannerCoverUrl,
            verticalCoverUrl: seed.verticalCoverUrl,
            screenshots: seed.screenshots,
            downloadLinks: seed.downloadLinks,
            featured: seed.featured,
            visibility: seed.visibility,
            downloadsCount:
              typeof existingData.downloadsCount === 'number'
                ? existingData.downloadsCount
                : seed.downloadsCount,
            createdBy: existingData.createdBy || user.uid,
            createdAt: existingData.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(isManual
              ? { adminUpdatedAt: serverTimestamp() }
              : existingData.adminUpdatedAt
                ? { adminUpdatedAt: existingData.adminUpdatedAt }
                : {}),
          });
        } else {
          await setDoc(gameRef, {
            title: seed.title,
            description: seed.description,
            size: seed.size,
            genre: seed.genre,
            tags: seed.tags,
            rating: seed.rating,
            ratingSum: seed.ratingSum,
            reviewCount: seed.reviewCount,
            developer: seed.developer,
            releaseYear: seed.releaseYear,
            bannerCoverUrl: seed.bannerCoverUrl,
            verticalCoverUrl: seed.verticalCoverUrl,
            screenshots: seed.screenshots,
            downloadLinks: seed.downloadLinks,
            featured: seed.featured,
            visibility: seed.visibility,
            downloadsCount: seed.downloadsCount,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Upgrade any custom non-starter games missing dynamic rating aggregates or tags
      for (const g of games) {
        if (
          !STARTER_GAMES.some((s) => s.id === g.id) &&
          (g.ratingSum === undefined ||
            g.reviewCount === undefined ||
            !Array.isArray(g.tags) ||
            g.tags.length === 0)
        ) {
          await updateDoc(doc(db, 'games', g.id), {
            rating: typeof g.rating === 'number' ? g.rating : 0,
            ratingSum: typeof g.ratingSum === 'number' ? g.ratingSum : 0,
            reviewCount: typeof g.reviewCount === 'number' ? g.reviewCount : 0,
            tags: Array.isArray(g.tags) && g.tags.length > 0 ? g.tags : [g.genre],
            updatedAt: serverTimestamp(),
          });
        }
      }

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        userName: (user.displayName || user.email?.split('@')[0] || 'Admin').slice(0, 80),
        actionType: 'game_publish',
        gameId: STARTER_GAMES[0].id,
        gameTitle: 'Starter Catalog (3 Games)',
        detail: 'Published initial catalog with banner + vertical covers',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'games');
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleWishlist = async (game: GameItem) => {
    if (!user) {
      void handleSignIn();
      return;
    }

    const existsInDb = games.some((g) => g.id === game.id);
    if (!existsInDb) {
      if (isAdmin) {
        await handleSeedStarterCatalog();
      } else {
        setAuthError(
          'This preview title has not been published by an administrator yet.'
        );
        return;
      }
    }

    const itemPath = `users/${user.uid}/wishlist/${game.id}`;
    const itemRef = doc(db, 'users', user.uid, 'wishlist', game.id);
    const existsInWishlist = wishlist.some((w) => w.gameId === game.id);
    const displayName = (
      user.displayName ||
      user.email?.split('@')[0] ||
      'Player'
    ).slice(0, 80);

    try {
      if (existsInWishlist) {
        await deleteDoc(itemRef);
        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          userName: displayName,
          actionType: 'wishlist_remove',
          gameId: game.id,
          gameTitle: game.title.slice(0, 120),
          detail: 'Removed from personal wishlist',
          createdAt: serverTimestamp(),
        });
        showToast({
          title: 'Removed from Wishlist',
          description: `${game.title} was removed from your collection.`,
          variant: 'info',
        });
      } else {
        await setDoc(itemRef, {
          userId: user.uid,
          gameId: game.id,
          gameTitle: game.title.slice(0, 120),
          gameVerticalCover: resolveVerticalCover(game).slice(0, 1000),
          gameGenre: game.genre.slice(0, 50),
          gameSize: game.size.slice(0, 40),
          addedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          userName: displayName,
          actionType: 'wishlist_add',
          gameId: game.id,
          gameTitle: game.title.slice(0, 120),
          detail: `Saved to wishlist (${game.size})`.slice(0, 240),
          createdAt: serverTimestamp(),
        });
        showToast({
          title: 'Added to Wishlist',
          description: `${game.title} saved to your wishlist.`,
          variant: 'success',
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, itemPath);
    }
  };

  const handleSaveGame = async (values: GameFormValues, existingId?: string) => {
    if (!user || !isAdmin) {
      throw new Error('Only registered Google admin accounts can add or edit games.');
    }

    const displayName = (
      user.displayName ||
      user.email?.split('@')[0] ||
      'Admin'
    ).slice(0, 80);

    if (existingId) {
      const gameRef = doc(db, 'games', existingId);
      const path = `games/${existingId}`;
      const existingGame = games.find((g) => g.id === existingId);
      const needsAggregateInit =
        existingGame?.ratingSum === undefined ||
        existingGame?.reviewCount === undefined;
      try {
        await updateDoc(gameRef, {
          title: values.title,
          description: values.description,
          size: values.size,
          genre: values.genre,
          tags: values.tags,
          ...(needsAggregateInit
            ? { rating: 0, ratingSum: 0, reviewCount: 0 }
            : {}),
          developer: values.developer,
          releaseYear: values.releaseYear,
          bannerCoverUrl: values.bannerCoverUrl,
          verticalCoverUrl: values.verticalCoverUrl,
          screenshots: values.screenshots,
          downloadLinks: values.downloadLinks,
          featured: values.featured,
          visibility: values.visibility,
          updatedAt: serverTimestamp(),
          adminUpdatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          userName: displayName,
          actionType: 'game_publish',
          gameId: existingId,
          gameTitle: values.title.slice(0, 120),
          detail: `Updated build (${values.downloadLinks.length} mirrors)`.slice(0, 240),
          createdAt: serverTimestamp(),
        });
        showToast({
          title: 'Game updated',
          description: `${values.title} has been updated.`,
          variant: 'success',
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const newId = slugifyGameId(values.title);
      const gameRef = doc(db, 'games', newId);
      const path = `games/${newId}`;
      try {
        await setDoc(gameRef, {
          title: values.title,
          description: values.description,
          size: values.size,
          genre: values.genre,
          tags: values.tags,
          rating: 0,
          ratingSum: 0,
          reviewCount: 0,
          developer: values.developer,
          releaseYear: values.releaseYear,
          bannerCoverUrl: values.bannerCoverUrl,
          verticalCoverUrl: values.verticalCoverUrl,
          screenshots: values.screenshots,
          downloadLinks: values.downloadLinks,
          featured: values.featured,
          visibility: values.visibility,
          downloadsCount: 0,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'activities'), {
          userId: user.uid,
          userName: displayName,
          actionType: 'game_publish',
          gameId: newId,
          gameTitle: values.title.slice(0, 120),
          detail: `Published new game (${values.downloadLinks.length} mirrors)`.slice(0, 240),
          createdAt: serverTimestamp(),
        });
        showToast({
          title: 'Game published',
          description: `${values.title} is now live in the catalog.`,
          variant: 'success',
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const handleDeleteGame = async (game: GameItem) => {
    if (!user || !isAdmin) return;
    const path = `games/${game.id}`;
    try {
      await deleteDoc(doc(db, 'games', game.id));
      if (selectedGameId === game.id) setSelectedGameId(null);
      showToast({
        title: 'Game removed',
        description: `${game.title} was deleted from the catalog.`,
        variant: 'info',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const publicGames = useMemo(
    () => games.filter((g) => g.visibility === 'public'),
    [games]
  );

  const isUsingPreviewCatalog = !gamesLoading && publicGames.length === 0;

  const displayGames = useMemo<GameItem[]>(() => {
    if (publicGames.length > 0) return publicGames;
    if (gamesLoading) return [];
    return STARTER_GAMES.map((seed) => ({
      ...seed,
      createdBy: 'starter',
    }));
  }, [publicGames, gamesLoading]);

  const featuredGame = useMemo(() => {
    return (
      displayGames.find((g) => g.featured) ||
      displayGames[0] ||
      null
    );
  }, [displayGames]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>(selectedTags);
    for (const game of displayGames) {
      for (const tag of game.tags ?? []) {
        if (tag.trim()) tagSet.add(tag.trim());
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [displayGames, selectedTags]);

  const handleToggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = displayGames.filter((game) => {
      const matchesGenre = selectedGenre === 'All' || game.genre === selectedGenre;
      if (!matchesGenre) return false;
      const gameTags = game.tags ?? [];
      if (
        selectedTags.length > 0 &&
        !selectedTags.every((tag) => gameTags.includes(tag))
      ) {
        return false;
      }
      if (!q) return true;
      return (
        game.title.toLowerCase().includes(q) ||
        game.genre.toLowerCase().includes(q) ||
        game.developer.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        gameTags.some((tag) => tag.toLowerCase().includes(q))
      );
    });

    result.sort((a, b) => {
      if (sortBy === 'rating') {
        const diff = (b.rating ?? 0) - (a.rating ?? 0);
        if (diff !== 0) return diff;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      }
      if (sortBy === 'downloads') return b.downloadsCount - a.downloadsCount;
      return Number(b.releaseYear) - Number(a.releaseYear);
    });

    return result;
  }, [displayGames, searchQuery, selectedGenre, selectedTags, sortBy]);

  const selectedGame = useMemo(
    () =>
      games.find((g) => g.id === selectedGameId) ||
      displayGames.find((g) => g.id === selectedGameId) ||
      null,
    [games, displayGames, selectedGameId]
  );

  const wishlistGameIds = useMemo(
    () => new Set(wishlist.map((w) => w.gameId)),
    [wishlist]
  );

  const compareGames = useMemo(
    () =>
      compareGameIds
        .map((id) => displayGames.find((g) => g.id === id))
        .filter((g): g is GameItem => Boolean(g)),
    [compareGameIds, displayGames]
  );

  const handleToggleCompare = (game: GameItem) => {
    if (compareGameIds.includes(game.id)) {
      const next = compareGameIds.filter((id) => id !== game.id);
      setCompareGameIds(next);
      if (next.length < 2) {
        setCompareModalOpen(false);
      }
      return;
    }

    if (compareGameIds.length === 0) {
      setCompareGameIds([game.id]);
      showToast({
        title: 'Added to comparison (1/2)',
        description: `Select one more game to compare with ${game.title}.`,
        variant: 'info',
      });
      return;
    }

    if (compareGameIds.length === 1) {
      setCompareGameIds([compareGameIds[0], game.id]);
      setCompareModalOpen(true);
      return;
    }

    setCompareGameIds([compareGameIds[1], game.id]);
    setCompareModalOpen(true);
    showToast({
      title: 'Comparison updated',
      description: `Now comparing with ${game.title}.`,
      variant: 'info',
    });
  };

  const handleChangeCompareSlot = (slot: 0 | 1, nextGameId: string) => {
    setCompareGameIds((prev) => {
      if (prev.length < 2) return prev;
      const otherSlot = slot === 0 ? 1 : 0;
      if (prev[otherSlot] === nextGameId) {
        return [prev[1], prev[0]];
      }
      const next = [...prev];
      next[slot] = nextGameId;
      return next;
    });
  };

  const handleSwapCompareGames = () => {
    setCompareGameIds((prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
  };

  const handleClearCompare = () => {
    setCompareGameIds([]);
    setCompareModalOpen(false);
  };

  const renderGameCard = (game: GameItem) => {
    const wishlisted = wishlistGameIds.has(game.id);
    const isCompared = compareGameIds.includes(game.id);
    const bannerCover = resolveBannerCover(game);
    const isPopular = (game.downloadsCount ?? 0) > 1000;
    return (
      <article
        key={game.id}
        className="group bg-white dark:bg-[#131822] border border-slate-200 hover:border-slate-300 dark:border-slate-800/90 dark:hover:border-slate-700 shadow-sm dark:shadow-none rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5"
      >
        <button
          type="button"
          onClick={() => setSelectedGameId(game.id)}
          className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-[#0B0E14] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <SafeImage
            src={bannerCover}
            alt={game.title}
            fallbackTitle={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white dark:from-[#131822] to-transparent pointer-events-none" />
        </button>

        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>{game.genre}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{game.size}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-600 dark:text-amber-400">
                <Star
                  className={`w-3 h-3 ${(game.reviewCount ?? 0) > 0 ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''}`}
                />
                {(game.reviewCount ?? 0) > 0
                  ? `${(game.rating ?? 0).toFixed(1)} (${game.reviewCount})`
                  : 'Unrated'}
              </span>
              {isPopular && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[11px] font-semibold leading-none">
                    Popular
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedGameId(game.id)}
              className="text-left block w-full"
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                {game.title}
              </h3>
            </button>

            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {game.description}
            </p>

            {(game.tags ?? []).length > 0 && (
              <p className="text-xs text-slate-500 truncate">
                {(game.tags ?? []).slice(0, 4).join(' · ')}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono tabular-nums">
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{game.downloadLinks.length} Mirrors</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleCompare(game)}
                aria-pressed={isCompared}
                aria-label={
                  isCompared
                    ? `Remove ${game.title} from comparison`
                    : `Select ${game.title} to compare`
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                  isCompared
                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/50 dark:text-blue-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-700'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>{isCompared ? 'Selected' : 'Compare'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleToggleWishlist(game)}
                aria-label={
                  wishlisted
                    ? `Remove ${game.title} from wishlist`
                    : `Save ${game.title} to wishlist`
                }
                className={`p-2 rounded-lg border transition-colors ${
                  wishlisted
                    ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-500/15 dark:border-blue-500/40 dark:text-blue-400'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-700'
                }`}
              >
                {wishlisted ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedGameId(game.id)}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium whitespace-nowrap transition-colors"
              >
                View &amp; Download
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100 flex flex-col transition-colors">
      <TopBar
        activeView={activeView}
        onNavigate={setActiveView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        userAvatarUrl={userProfile?.photoURL || user?.photoURL || ''}
        userDisplayName={userProfile?.displayName || user?.displayName || ''}
        wishlistCount={wishlist.length}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
        authLoading={authLoading}
      />

      {authError && (
        <div className="max-w-[1440px] mx-auto w-full px-6 pt-4">
          <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-xs font-medium text-red-700 dark:text-red-200 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {(activeView === 'storefront' || activeView === 'catalog') && (
          <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-10">
            {/* Storefront Spotlight Hero */}
            {activeView === 'storefront' && featuredGame && (
              <section className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131822] shadow-sm dark:shadow-none">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-7 relative aspect-[16/9] lg:aspect-auto lg:min-h-[420px] bg-slate-100 dark:bg-[#0B0E14]">
                    <SafeImage
                      src={resolveBannerCover(featuredGame)}
                      alt={featuredGame.title}
                      fallbackTitle={featuredGame.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-white via-white/30 to-transparent dark:from-[#131822] dark:via-[#131822]/30 pointer-events-none" />
                  </div>

                  <div className="lg:col-span-5 p-8 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Featured Release</span>
                        <span aria-hidden="true">·</span>
                        <span>{featuredGame.genre}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{featuredGame.size}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-600 dark:text-amber-400">
                          <Star
                            className={`w-3.5 h-3.5 ${(featuredGame.reviewCount ?? 0) > 0 ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''}`}
                          />
                          {(featuredGame.reviewCount ?? 0) > 0
                            ? `${(featuredGame.rating ?? 0).toFixed(1)} (${featuredGame.reviewCount})`
                            : 'Unrated'}
                        </span>
                        {(featuredGame.downloadsCount ?? 0) > 1000 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[11px] font-semibold leading-none">
                              Popular
                            </span>
                          </>
                        )}
                      </div>

                      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
                        {featuredGame.title}
                      </h1>

                      <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-4">
                        {featuredGame.description}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        {featuredGame.screenshots.slice(0, 3).map((shot, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedGameId(featuredGame.id)}
                            className="aspect-video rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 transition-colors"
                          >
                            <SafeImage
                              src={shot}
                              alt={`${featuredGame.title} preview ${idx + 1}`}
                              fallbackTitle={`Preview ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedGameId(featuredGame.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium whitespace-nowrap transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          <span>Explore {featuredGame.downloadLinks.length} Mirrors</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleWishlist(featuredGame)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 dark:bg-[#0B0E14] dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-sm font-medium whitespace-nowrap transition-colors"
                        >
                          {wishlistGameIds.has(featuredGame.id) ? (
                            <>
                              <BookmarkCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span>Wishlisted</span>
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
                  </div>
                </div>
              </section>
            )}

            {/* Real-Time Search & Genre Filter Toolbar */}
            <section className="space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {activeView === 'catalog'
                      ? 'Complete Game Catalog'
                      : 'Curated Game Collection'}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Real-time search across verified builds, screenshots, and multi-source download mirrors.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search titles, genres, tags, studios..."
                      aria-label="Real-time game search"
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sort games"
                    className="px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="rating">Top Rated</option>
                    <option value="downloads">Most Downloaded</option>
                    <option value="newest">Newest Year</option>
                  </select>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGame(null);
                        setFormModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium whitespace-nowrap transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Game</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Genre Segmented Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(['All', ...GAME_GENRES] as const).map((genre) => {
                  const active = selectedGenre === genre;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => setSelectedGenre(genre)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-[#131822] dark:text-slate-400 dark:hover:text-slate-100 dark:border-slate-800'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>

              {/* Multi-Tag Interactive Filter Bar */}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-500 mr-1">
                    Tags:
                  </span>
                  {availableTags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleToggleTagFilter(tag)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-blue-50 text-blue-700 border border-blue-300 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/50'
                            : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-[#131822] dark:text-slate-400 dark:hover:text-slate-100 dark:border-slate-800'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  {selectedTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTags([])}
                      className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white underline underline-offset-2 transition-colors"
                    >
                      Clear tags ({selectedTags.length})
                    </button>
                  )}
                </div>
              )}

              {/* Compare Selection Bar */}
              {compareGames.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#131822] border border-blue-200 dark:border-blue-500/30 shadow-sm dark:shadow-none">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                      <Scale className="w-4 h-4" />
                      <span>Compare ({compareGames.length}/2):</span>
                    </span>

                    {compareGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleToggleCompare(g)}
                        aria-label={`Remove ${g.title} from comparison`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 transition-colors"
                      >
                        <span className="truncate max-w-[180px]">{g.title}</span>
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}

                    {compareGames.length === 1 && (
                      <span className="text-slate-600 dark:text-slate-400">
                        Select 1 more game from the catalog to compare side-by-side.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearCompare}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      disabled={compareGames.length < 2}
                      onClick={() => setCompareModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium whitespace-nowrap transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Compare Side-by-Side</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Catalog Grid */}
              {gamesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-[360px] rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="p-12 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 text-center space-y-4">
                  <p className="text-base font-medium text-slate-900 dark:text-white">
                    {publicGames.length === 0
                      ? 'No games published in Firestore yet.'
                      : 'No games match your current search, genre, or tag filters.'}
                  </p>
                  {publicGames.length === 0 && isAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleSeedStarterCatalog()}
                      disabled={seeding}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{seeding ? 'Publishing...' : 'Publish Starter Catalog (3 Games)'}</span>
                    </button>
                  )}
                  {publicGames.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedGenre('All');
                        setSelectedTags([]);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGames.map((game) => renderGameCard(game))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Wishlist View: ONLY vertical covers (3:4), zero extra text or metadata */}
        {activeView === 'wishlist' && (
          <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
            <div className="pb-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Wishlist</h1>
              {user && (
                <span className="text-sm font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {wishlist.length}
                </span>
              )}
            </div>

            {!user ? (
              <div className="max-w-lg mx-auto py-12 text-center space-y-4">
                <p className="text-slate-600 dark:text-slate-300 text-base">
                  Sign in with your Google account to view your saved wishlist covers.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                >
                  Sign In with Google
                </button>
              </div>
            ) : wishlist.length === 0 ? (
              <div className="py-16 px-6 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center space-y-6">
                <svg
                  viewBox="0 0 180 128"
                  className="w-44 h-32 text-slate-300 dark:text-slate-700"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="24"
                    y="22"
                    width="54"
                    height="76"
                    rx="7"
                    transform="rotate(-8 24 22)"
                    className="fill-slate-100 dark:fill-[#0B0E14] stroke-slate-300 dark:stroke-[#1E293B]"
                    strokeWidth="2"
                  />
                  <rect
                    x="104"
                    y="15"
                    width="54"
                    height="76"
                    rx="7"
                    transform="rotate(8 104 15)"
                    className="fill-slate-100 dark:fill-[#0B0E14] stroke-slate-300 dark:stroke-[#1E293B]"
                    strokeWidth="2"
                  />
                  <rect
                    x="61"
                    y="14"
                    width="58"
                    height="82"
                    rx="8"
                    className="fill-white dark:fill-[#111622] stroke-blue-500"
                    strokeOpacity="0.65"
                    strokeWidth="2"
                  />
                  <path
                    d="M82 38C82 35.7909 83.7909 34 86 34H94C96.2091 34 98 35.7909 98 38V62L90 56L82 62V38Z"
                    className="fill-blue-500/20 stroke-blue-600 dark:stroke-blue-400"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="73"
                    y1="76"
                    x2="107"
                    y2="76"
                    className="stroke-slate-300 dark:stroke-[#334155]"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="79"
                    y1="83"
                    x2="101"
                    y2="83"
                    className="stroke-slate-200 dark:stroke-[#1E293B]"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="space-y-1.5 max-w-md">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Your wishlist shelf is empty
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Bookmark titles from the catalog to curate your personal collection of vertical game covers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView('storefront')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                >
                  <span>Discover Games</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {wishlist.map((item) => {
                  const fullGame = games.find((g) => g.id === item.gameId);
                  const verticalSrc = fullGame
                    ? resolveVerticalCover(fullGame)
                    : item.gameVerticalCover || item.gameCover || '';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => fullGame && setSelectedGameId(fullGame.id)}
                      aria-label={item.gameTitle}
                      className="group aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-[#131822] border border-slate-200 dark:border-slate-800/90 hover:border-blue-500/60 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <SafeImage
                        src={verticalSrc}
                        alt={item.gameTitle}
                        fallbackTitle={item.gameTitle}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeView === 'dashboard' && (
          <DashboardView
            user={user}
            userProfile={userProfile}
            isAdmin={isAdmin}
            games={games}
            wishlist={wishlist}
            activities={activities}
            onSignIn={() => void handleSignIn()}
            onUpdateProfile={handleUpdateProfile}
            onOpenGame={(g) => setSelectedGameId(g.id)}
            onCreateGame={() => {
              setEditingGame(null);
              setFormModalOpen(true);
            }}
            onEditGame={(g) => {
              setEditingGame(g);
              setFormModalOpen(true);
            }}
            onDeleteGame={handleDeleteGame}
            onSeedStarterCatalog={() => handleSeedStarterCatalog(true)}
            seeding={seeding}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-6 px-6 mt-12">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>GameVault · Digital Game Distribution &amp; Mirror Hub</span>
          <span>Powered by React, Node.js, and Firebase</span>
        </div>
      </footer>

      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          user={user}
          userAvatarUrl={userProfile?.photoURL || user?.photoURL || ''}
          userDisplayName={userProfile?.displayName || user?.displayName || ''}
          isAdmin={isAdmin}
          isWishlisted={wishlistGameIds.has(selectedGame.id)}
          isPreviewOnly={isUsingPreviewCatalog}
          onToggleWishlist={async (g) => {
            if (isUsingPreviewCatalog) {
              if (!user) void handleSignIn();
              return;
            }
            await handleToggleWishlist(g);
          }}
          onRequireAuth={() => void handleSignIn()}
          onClose={() => setSelectedGameId(null)}
        />
      )}

      {compareModalOpen && compareGames.length === 2 && (
        <CompareGamesModal
          gameA={compareGames[0]}
          gameB={compareGames[1]}
          allGames={displayGames}
          onChangeGame={handleChangeCompareSlot}
          onSwapGames={handleSwapCompareGames}
          onOpenGameDetail={(id) => setSelectedGameId(id)}
          onClearCompare={handleClearCompare}
          onClose={() => setCompareModalOpen(false)}
        />
      )}

      {formModalOpen && isAdmin && (
        <GameFormModal
          initialGame={editingGame}
          onClose={() => {
            setFormModalOpen(false);
            setEditingGame(null);
          }}
          onSave={handleSaveGame}
        />
      )}
    </div>
  );
}
