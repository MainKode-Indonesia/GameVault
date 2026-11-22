import { useState, type FormEvent } from 'react';
import { X, Plus, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  GAME_GENRES,
  SUGGESTED_GAME_TAGS,
  isSafeHttpOrAssetUrl,
  resolveBannerCover,
  resolveVerticalCover,
  type DownloadMirror,
  type GameGenre,
  type GameItem,
  type MirrorValidationResult,
} from '../types/game';
import { auth } from '../lib/firebase';

export interface GameFormValues {
  title: string;
  description: string;
  size: string;
  genre: GameGenre;
  tags: string[];
  developer: string;
  releaseYear: string;
  bannerCoverUrl: string;
  verticalCoverUrl: string;
  screenshots: string[];
  downloadLinks: DownloadMirror[];
  featured: boolean;
  visibility: 'public' | 'draft';
}

interface GameFormModalProps {
  initialGame?: GameItem | null;
  onClose: () => void;
  onSave: (values: GameFormValues, existingId?: string) => Promise<void>;
}

const MIRROR_PROVIDERS = [
  'Direct CDN',
  'Google Drive',
  'MediaFire',
  'Mega.nz',
  'PixelDrain',
  'GoFile',
  '1Fichier',
];

export function GameFormModal({ initialGame, onClose, onSave }: GameFormModalProps) {
  const [title, setTitle] = useState(initialGame?.title ?? '');
  const [developer, setDeveloper] = useState(initialGame?.developer ?? '');
  const [releaseYear, setReleaseYear] = useState(initialGame?.releaseYear ?? '2026');
  const [genre, setGenre] = useState<GameGenre>(initialGame?.genre ?? 'Action RPG');
  const [tags, setTags] = useState<string[]>(
    initialGame?.tags && initialGame.tags.length > 0
      ? initialGame.tags
      : initialGame
        ? [initialGame.genre]
        : ['Open World']
  );
  const [customTag, setCustomTag] = useState('');
  const [size, setSize] = useState(initialGame?.size ?? '');
  const [description, setDescription] = useState(initialGame?.description ?? '');
  const [bannerCoverUrl, setBannerCoverUrl] = useState(
    initialGame ? resolveBannerCover(initialGame) : ''
  );
  const [verticalCoverUrl, setVerticalCoverUrl] = useState(
    initialGame ? resolveVerticalCover(initialGame) : ''
  );
  const [screenshots, setScreenshots] = useState<string[]>(
    initialGame?.screenshots && initialGame.screenshots.length >= 3
      ? initialGame.screenshots
      : ['', '', '']
  );
  const [downloadLinks, setDownloadLinks] = useState<DownloadMirror[]>(
    initialGame?.downloadLinks && initialGame.downloadLinks.length >= 1
      ? initialGame.downloadLinks
      : [{ label: 'Primary Full Build', provider: 'Direct CDN', url: '', partInfo: 'Single Archive' }]
  );
  const [featured, setFeatured] = useState(initialGame?.featured ?? false);
  const [visibility, setVisibility] = useState<'public' | 'draft'>(
    initialGame?.visibility ?? 'public'
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingMirrors, setCheckingMirrors] = useState(false);
  const [mirrorResults, setMirrorResults] = useState<Record<number, MirrorValidationResult>>({});

  const handleToggleTag = (tag: string) => {
    setError(null);
    const exists = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (exists) {
      setTags(tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
      return;
    }
    if (tags.length >= BLUEPRINT_LIMITS.TAGS_MAX) {
      setError(`Maximum ${BLUEPRINT_LIMITS.TAGS_MAX} tags allowed per game.`);
      return;
    }
    setTags([...tags, tag]);
  };

  const handleAddCustomTag = () => {
    const trimmed = customTag.trim();
    if (!trimmed) return;
    if (
      trimmed.length < BLUEPRINT_LIMITS.TAG_MIN_LEN ||
      trimmed.length > BLUEPRINT_LIMITS.TAG_MAX_LEN
    ) {
      setError(
        `Each tag must be between ${BLUEPRINT_LIMITS.TAG_MIN_LEN} and ${BLUEPRINT_LIMITS.TAG_MAX_LEN} characters.`
      );
      return;
    }
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setCustomTag('');
      return;
    }
    if (tags.length >= BLUEPRINT_LIMITS.TAGS_MAX) {
      setError(`Maximum ${BLUEPRINT_LIMITS.TAGS_MAX} tags allowed per game.`);
      return;
    }
    setError(null);
    setTags([...tags, trimmed]);
    setCustomTag('');
  };

  const handleAddScreenshot = () => {
    if (screenshots.length < BLUEPRINT_LIMITS.SCREENSHOTS_MAX) {
      setScreenshots([...screenshots, '']);
    }
  };

  const handleRemoveScreenshot = (idx: number) => {
    if (screenshots.length <= BLUEPRINT_LIMITS.SCREENSHOTS_MIN) return;
    setScreenshots(screenshots.filter((_, i) => i !== idx));
  };

  const handleAddMirror = () => {
    if (downloadLinks.length < BLUEPRINT_LIMITS.MIRRORS_MAX) {
      setDownloadLinks([
        ...downloadLinks,
        {
          label: `Mirror ${downloadLinks.length + 1}`,
          provider: 'Google Drive',
          url: '',
          partInfo: 'Full Package',
        },
      ]);
    }
  };

  const handleRemoveMirror = (idx: number) => {
    if (downloadLinks.length <= BLUEPRINT_LIMITS.MIRRORS_MIN) return;
    setDownloadLinks(downloadLinks.filter((_, i) => i !== idx));
  };

  const handleInspectMirrors = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      setError('Registered Google admin sign-in required.');
      return;
    }
    const urls = downloadLinks.map((m) => m.url.trim());
    setCheckingMirrors(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/mirrors/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls }),
      });
      const data = (await response.json()) as { results?: MirrorValidationResult[]; error?: string };
      if (!response.ok || !data.results) {
        throw new Error(data.error || 'Mirror inspection failed.');
      }
      const map: Record<number, MirrorValidationResult> = {};
      data.results.forEach((res, idx) => {
        map[idx] = res;
      });
      setMirrorResults(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check mirrors.');
    } finally {
      setCheckingMirrors(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedSize = size.trim();
    const trimmedDev = developer.trim();
    const trimmedYear = releaseYear.trim();
    const trimmedBanner = bannerCoverUrl.trim();
    const trimmedVertical = verticalCoverUrl.trim();

    if (
      trimmedTitle.length < BLUEPRINT_LIMITS.TITLE_MIN ||
      trimmedTitle.length > BLUEPRINT_LIMITS.TITLE_MAX
    ) {
      setError(
        `Title must be between ${BLUEPRINT_LIMITS.TITLE_MIN} and ${BLUEPRINT_LIMITS.TITLE_MAX} characters.`
      );
      return;
    }
    if (
      trimmedDev.length < BLUEPRINT_LIMITS.DEV_MIN ||
      trimmedDev.length > BLUEPRINT_LIMITS.DEV_MAX
    ) {
      setError(
        `Developer must be between ${BLUEPRINT_LIMITS.DEV_MIN} and ${BLUEPRINT_LIMITS.DEV_MAX} characters.`
      );
      return;
    }
    if (!BLUEPRINT_LIMITS.YEAR_REGEX.test(trimmedYear)) {
      setError('Release year must be a 4-digit year (e.g., 2026).');
      return;
    }
    if (
      trimmedSize.length < BLUEPRINT_LIMITS.SIZE_MIN ||
      trimmedSize.length > BLUEPRINT_LIMITS.SIZE_MAX
    ) {
      setError('Please provide a valid storage size (e.g., 45.2 GB).');
      return;
    }
    if (
      trimmedDesc.length < BLUEPRINT_LIMITS.DESC_MIN ||
      trimmedDesc.length > BLUEPRINT_LIMITS.DESC_MAX
    ) {
      setError(
        `Description must be between ${BLUEPRINT_LIMITS.DESC_MIN} and ${BLUEPRINT_LIMITS.DESC_MAX} characters.`
      );
      return;
    }
    if (!isSafeHttpOrAssetUrl(trimmedBanner)) {
      setError('Banner cover (16:9) must be a valid http(s) URL or local asset path.');
      return;
    }
    if (!isSafeHttpOrAssetUrl(trimmedVertical)) {
      setError('Vertical cover (3:4) must be a valid http(s) URL or local asset path.');
      return;
    }

    const cleanScreenshots = screenshots.map((s) => s.trim()).filter(Boolean);
    if (cleanScreenshots.length < BLUEPRINT_LIMITS.SCREENSHOTS_MIN) {
      setError(`Minimum ${BLUEPRINT_LIMITS.SCREENSHOTS_MIN} valid screenshots are required.`);
      return;
    }
    for (const shot of cleanScreenshots) {
      if (!isSafeHttpOrAssetUrl(shot)) {
        setError('All screenshot URLs must use valid http(s) or local asset paths.');
        return;
      }
    }

    const cleanMirrors = downloadLinks.map((m) => ({
      label: m.label.trim().slice(0, 80),
      provider: m.provider.trim().slice(0, 60) || 'Direct CDN',
      url: m.url.trim(),
      partInfo: m.partInfo.trim().slice(0, 80) || 'Full Build',
    }));

    if (cleanMirrors.length < 1) {
      setError('At least 1 download mirror link is required.');
      return;
    }
    for (const mirror of cleanMirrors) {
      if (!mirror.label || !isSafeHttpOrAssetUrl(mirror.url)) {
        setError('Each download mirror requires a label and a valid http(s) URL.');
        return;
      }
    }

    const cleanTags = tags
      .map((t) => t.trim())
      .filter(
        (t) =>
          t.length >= BLUEPRINT_LIMITS.TAG_MIN_LEN &&
          t.length <= BLUEPRINT_LIMITS.TAG_MAX_LEN
      )
      .slice(0, BLUEPRINT_LIMITS.TAGS_MAX);

    if (cleanTags.length < BLUEPRINT_LIMITS.TAGS_MIN) {
      setError(`Select or add at least ${BLUEPRINT_LIMITS.TAGS_MIN} tag for this game.`);
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          title: trimmedTitle,
          description: trimmedDesc,
          size: trimmedSize,
          genre,
          tags: cleanTags,
          developer: trimmedDev,
          releaseYear: trimmedYear,
          bannerCoverUrl: trimmedBanner,
          verticalCoverUrl: trimmedVertical,
          screenshots: cleanScreenshots,
          downloadLinks: cleanMirrors,
          featured,
          visibility,
        },
        initialGame?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl my-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {initialGame ? `Edit Game: ${initialGame.title}` : 'Add New Game'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Game Title</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chrono Eclipse: Aethelgard"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Developer / Studio</span>
              <input
                type="text"
                required
                value={developer}
                onChange={(e) => setDeveloper(e.target.value)}
                placeholder="e.g. Obsidian Forge Studio"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Genre</span>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as GameGenre)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                {GAME_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Size</span>
                <input
                  type="text"
                  required
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="64.0 GB"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Year</span>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  placeholder="2026"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </label>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</span>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a comprehensive synopsis, key mechanics, and build details..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </label>

          {/* Multi-Tag Selector */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Game Tags ({tags.length}/{BLUEPRINT_LIMITS.TAGS_MAX})
              </span>
              <span className="text-[11px] text-slate-500">
                Select at least 1 tag for search &amp; filtering
              </span>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/15 dark:bg-blue-600/20 border border-blue-500/40 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-600/25 transition-colors"
                  >
                    <span>{tag}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_GAME_TAGS.filter(
                (suggested) =>
                  !tags.some((t) => t.toLowerCase() === suggested.toLowerCase())
              ).map((suggested) => (
                <button
                  key={suggested}
                  type="button"
                  onClick={() => handleToggleTag(suggested)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:border-slate-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>{suggested}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customTag}
                maxLength={BLUEPRINT_LIMITS.TAG_MAX_LEN}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder="Add custom tag (e.g. Co-op, Roguelike)..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                disabled={tags.length >= BLUEPRINT_LIMITS.TAGS_MAX || !customTag.trim()}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-transparent disabled:opacity-40 text-xs font-medium dark:text-slate-200 transition-colors whitespace-nowrap"
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* Dual Covers: Banner (16:9) + Vertical (3:4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Banner Cover URL (16:9 Wide)
              </span>
              <input
                type="text"
                required
                value={bannerCoverUrl}
                onChange={(e) => setBannerCoverUrl(e.target.value)}
                placeholder="https://... or /src/assets/images/banner_..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Vertical Cover URL (3:4 Poster)
              </span>
              <input
                type="text"
                required
                value={verticalCoverUrl}
                onChange={(e) => setVerticalCoverUrl(e.target.value)}
                placeholder="https://... or /src/assets/images/vcover_..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </label>
          </div>

          {/* Screenshots (min 3) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Gameplay Screenshots (Minimum 3 Required)
              </span>
              <button
                type="button"
                onClick={handleAddScreenshot}
                disabled={screenshots.length >= BLUEPRINT_LIMITS.SCREENSHOTS_MAX}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Screenshot</span>
              </button>
            </div>

            <div className="space-y-2">
              {screenshots.map((shot, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500 w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    required
                    value={shot}
                    onChange={(e) => {
                      const next = [...screenshots];
                      next[idx] = e.target.value;
                      setScreenshots(next);
                    }}
                    placeholder={`Screenshot ${idx + 1} URL`}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {screenshots.length > BLUEPRINT_LIMITS.SCREENSHOTS_MIN && (
                    <button
                      type="button"
                      onClick={() => handleRemoveScreenshot(idx)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-slate-800 transition-colors"
                      aria-label={`Remove screenshot ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Multiple Download Mirrors */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Download Links &amp; Mirrors ({downloadLinks.length})
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleInspectMirrors}
                  disabled={checkingMirrors}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-transparent text-xs font-medium dark:text-slate-200 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{checkingMirrors ? 'Verifying...' : 'Verify Mirror URLs'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddMirror}
                  disabled={downloadLinks.length >= BLUEPRINT_LIMITS.MIRRORS_MAX}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Mirror</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {downloadLinks.map((mirror, idx) => {
                const check = mirrorResults[idx];
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        required
                        value={mirror.label}
                        onChange={(e) => {
                          const next = [...downloadLinks];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setDownloadLinks(next);
                        }}
                        placeholder="Mirror Label (e.g. Part 1-2)"
                        className="px-3 py-2 rounded-md bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <select
                        value={mirror.provider}
                        onChange={(e) => {
                          const next = [...downloadLinks];
                          next[idx] = { ...next[idx], provider: e.target.value };
                          setDownloadLinks(next);
                        }}
                        className="px-3 py-2 rounded-md bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        {MIRROR_PROVIDERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={mirror.partInfo}
                        onChange={(e) => {
                          const next = [...downloadLinks];
                          next[idx] = { ...next[idx], partInfo: e.target.value };
                          setDownloadLinks(next);
                        }}
                        placeholder="Part Info (e.g. Full ISO)"
                        className="px-3 py-2 rounded-md bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        required
                        value={mirror.url}
                        onChange={(e) => {
                          const next = [...downloadLinks];
                          next[idx] = { ...next[idx], url: e.target.value };
                          setDownloadLinks(next);
                        }}
                        placeholder="https://drive.google.com/..."
                        className="flex-1 px-3 py-2 rounded-md bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-700/80 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      {downloadLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMirror(idx)}
                          className="p-2 rounded-md text-slate-500 hover:text-red-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-slate-800 transition-colors"
                          aria-label={`Remove mirror ${idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {check && (
                      <div
                        className={`text-xs ${
                          check.valid
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {check.valid
                          ? `Verified (${check.provider} · ${check.status})`
                          : `Blocked: ${check.reason || 'Invalid URL'}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0B0E14] text-blue-600"
              />
              <span>Feature in Storefront Spotlight</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">Visibility:</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'draft')}
                className="px-3 py-1.5 rounded-md bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="public">Public</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {saving ? 'Saving...' : initialGame ? 'Save Changes' : 'Publish Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
