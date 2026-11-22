import { useEffect } from 'react';
import { ArrowLeftRight, ExternalLink, Scale, Star, X } from 'lucide-react';
import { resolveBannerCover, type GameItem } from '../types/game';
import { SafeImage } from './SafeImage';

interface CompareGamesModalProps {
  gameA: GameItem;
  gameB: GameItem;
  allGames: GameItem[];
  onChangeGame: (slot: 0 | 1, gameId: string) => void;
  onSwapGames: () => void;
  onOpenGameDetail: (gameId: string) => void;
  onClearCompare: () => void;
  onClose: () => void;
}

export function CompareGamesModal({
  gameA,
  gameB,
  allGames,
  onChangeGame,
  onSwapGames,
  onOpenGameDetail,
  onClearCompare,
  onClose,
}: CompareGamesModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const ratingA = (gameA.reviewCount ?? 0) > 0 ? gameA.rating : null;
  const ratingB = (gameB.reviewCount ?? 0) > 0 ? gameB.rating : null;
  const ratingWinner =
    ratingA !== null && ratingB !== null
      ? ratingA > ratingB
        ? 'A'
        : ratingB > ratingA
          ? 'B'
          : null
      : ratingA !== null && ratingB === null
        ? 'A'
        : ratingB !== null && ratingA === null
          ? 'B'
          : null;

  const downloadsWinner =
    gameA.downloadsCount > gameB.downloadsCount
      ? 'A'
      : gameB.downloadsCount > gameA.downloadsCount
        ? 'B'
        : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/80 backdrop-blur-sm overflow-y-auto p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Compare games side-by-side"
    >
      <div className="max-w-5xl mx-auto bg-white dark:bg-[#111620] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-4">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                Compare Games Side-by-Side
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Compare genre, storage size, player rating, developer, and mirror availability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSwapGames}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-800 dark:bg-[#171E2C] dark:hover:bg-[#1E2738] dark:border-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Swap</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close comparison"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14]">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131822]">
                  <th
                    scope="col"
                    className="w-44 px-5 py-4 align-top text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    Specification
                  </th>

                  {[
                    { slot: 0 as const, game: gameA, otherId: gameB.id },
                    { slot: 1 as const, game: gameB, otherId: gameA.id },
                  ].map(({ slot, game, otherId }) => (
                    <th key={slot} scope="col" className="w-[38%] px-5 py-4 align-top">
                      <div className="space-y-3">
                        <div className="aspect-[16/9] w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                          <SafeImage
                            src={resolveBannerCover(game)}
                            alt={game.title}
                            fallbackTitle={game.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                            {game.title}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`Select game ${slot + 1} to compare`}
                              value={game.id}
                              onChange={(e) => onChangeGame(slot, e.target.value)}
                              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-700/80 text-xs font-normal text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                              {allGames.map((candidate) => (
                                <option
                                  key={candidate.id}
                                  value={candidate.id}
                                  disabled={candidate.id === otherId}
                                >
                                  {candidate.title}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenGameDetail(game.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium whitespace-nowrap transition-colors"
                            >
                              <span>Details</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-sm">
                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Genre
                  </th>
                  <td className="px-5 py-3.5 text-slate-900 dark:text-slate-100 font-medium">
                    {gameA.genre}
                  </td>
                  <td className="px-5 py-3.5 text-slate-900 dark:text-slate-100 font-medium">
                    {gameB.genre}
                  </td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Size
                  </th>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {gameA.size}
                  </td>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {gameB.size}
                  </td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Rating
                  </th>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Star
                          className={`w-3.5 h-3.5 ${(gameA.reviewCount ?? 0) > 0 ? 'fill-amber-500 dark:fill-amber-400' : ''}`}
                        />
                        {(gameA.reviewCount ?? 0) > 0
                          ? `${gameA.rating.toFixed(1)} / 5.0`
                          : 'Unrated'}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        ({gameA.reviewCount ?? 0}{' '}
                        {(gameA.reviewCount ?? 0) === 1 ? 'review' : 'reviews'})
                      </span>
                      {ratingWinner === 'A' && (
                        <span className="text-xs font-sans font-medium text-emerald-600 dark:text-emerald-400">
                          · Higher rated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Star
                          className={`w-3.5 h-3.5 ${(gameB.reviewCount ?? 0) > 0 ? 'fill-amber-500 dark:fill-amber-400' : ''}`}
                        />
                        {(gameB.reviewCount ?? 0) > 0
                          ? `${gameB.rating.toFixed(1)} / 5.0`
                          : 'Unrated'}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        ({gameB.reviewCount ?? 0}{' '}
                        {(gameB.reviewCount ?? 0) === 1 ? 'review' : 'reviews'})
                      </span>
                      {ratingWinner === 'B' && (
                        <span className="text-xs font-sans font-medium text-emerald-600 dark:text-emerald-400">
                          · Higher rated
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Developer
                  </th>
                  <td className="px-5 py-3.5 text-slate-900 dark:text-slate-100">{gameA.developer}</td>
                  <td className="px-5 py-3.5 text-slate-900 dark:text-slate-100">{gameB.developer}</td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Release Year
                  </th>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {gameA.releaseYear}
                  </td>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {gameB.releaseYear}
                  </td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Downloads
                  </th>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    <span>{gameA.downloadsCount.toLocaleString()}</span>
                    {downloadsWinner === 'A' && (
                      <span className="ml-2 text-xs font-sans font-medium text-emerald-600 dark:text-emerald-400">
                        · Most downloaded
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    <span>{gameB.downloadsCount.toLocaleString()}</span>
                    {downloadsWinner === 'B' && (
                      <span className="ml-2 text-xs font-sans font-medium text-emerald-600 dark:text-emerald-400">
                        · Most downloaded
                      </span>
                    )}
                  </td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Download Mirrors
                  </th>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {gameA.downloadLinks.length} sources
                  </td>
                  <td className="px-5 py-3.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {gameB.downloadLinks.length} sources
                  </td>
                </tr>

                <tr>
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400 align-top"
                  >
                    Tags
                  </th>
                  <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {(gameA.tags ?? []).length > 0
                      ? (gameA.tags ?? []).join(' · ')
                      : 'None'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {(gameB.tags ?? []).length > 0
                      ? (gameB.tags ?? []).join(' · ')
                      : 'None'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <button
              type="button"
              onClick={() => {
                onClearCompare();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
