import type { User } from 'firebase/auth';
import { LogOut, Moon, Sun } from 'lucide-react';

export type AppView = 'storefront' | 'catalog' | 'wishlist' | 'dashboard';
export type ThemeMode = 'light' | 'dark';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  user: User | null;
  userAvatarUrl?: string;
  userDisplayName?: string;
  wishlistCount: number;
  onSignIn: () => void;
  onSignOut: () => void;
  authLoading: boolean;
}

export function TopBar({
  activeView,
  onNavigate,
  theme,
  onToggleTheme,
  user,
  userAvatarUrl,
  userDisplayName,
  wishlistCount,
  onSignIn,
  onSignOut,
  authLoading,
}: TopBarProps) {
  const navItems: { id: AppView; label: string }[] = [
    { id: 'storefront', label: 'Storefront' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'wishlist', label: user && wishlistCount > 0 ? `Wishlist (${wishlistCount})` : 'Wishlist' },
    { id: 'dashboard', label: 'Dashboard' },
  ];

  const resolvedAvatar = userAvatarUrl || user?.photoURL || '';
  const resolvedName =
    userDisplayName || user?.displayName || user?.email?.split('@')[0] || 'Account';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0E14]/95 backdrop-blur-md transition-colors">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('storefront')}
          className="text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          GameVault
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-[21px] h-0.5 bg-blue-600 dark:bg-blue-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#151B26] dark:hover:bg-[#1C2433] dark:border-slate-700/80 dark:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={authLoading}
              title={`Signed in as ${user.email || resolvedName}. Click to sign out.`}
              className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-medium text-slate-900 dark:bg-[#151B26] dark:hover:bg-[#1C2433] dark:border-slate-700/80 dark:text-slate-100 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={resolvedName}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-[11px] font-semibold flex items-center justify-center text-white">
                  {resolvedName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="max-w-[120px] truncate">{resolvedName}</span>
              <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authLoading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        className="flex md:hidden items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-800/70 overflow-x-auto gap-4"
        aria-label="Mobile navigation"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 py-1 px-2 rounded transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
