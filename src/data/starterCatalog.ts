import type { GameGenre, DownloadMirror } from '../types/game';

export interface StarterGameSeed {
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
  screenshots: string[];
  downloadLinks: DownloadMirror[];
  featured: boolean;
  visibility: 'public';
  downloadsCount: number;
}

export const STARTER_GAMES: StarterGameSeed[] = [
  {
    id: 'chrono-eclipse-aethelgard',
    title: 'Chrono Eclipse: Aethelgard',
    description:
      'Traverse the shattered obsidian citadels of Aethelgard in a tactical dark fantasy action RPG. Master stance-based greatsword combat, forge ancient runic armaments, and confront colossal stone sentinels across interconnected ruined cathedrals and flooded subterranean vaults.',
    size: '68.4 GB',
    genre: 'Action RPG',
    tags: ['Open World', 'Soulslike', 'Singleplayer', 'Dark Fantasy', 'Controller Support'],
    rating: 0,
    ratingSum: 0,
    reviewCount: 0,
    developer: 'Obsidian Forge Studio',
    releaseYear: '2026',
    bannerCoverUrl: '/src/assets/images/banner_chrono_eclipse_1795345534254.jpg',
    verticalCoverUrl: '/src/assets/images/vcover_chrono_eclipse_1795345534547.jpg',
    screenshots: [
      '/src/assets/images/screen_chrono_1_1795343709375.jpg',
      '/src/assets/images/screen_chrono_2_1795343710343.jpg',
      '/src/assets/images/screen_chrono_3_1795343710531.jpg',
    ],
    downloadLinks: [
      {
        label: 'Flare RPG v1.15 Windows Package',
        provider: 'GitHub Releases',
        url: 'https://github.com/flareteam/flare-game/releases/download/v1.15/flare-engine-win-v1.15.zip',
        partInfo: 'Windows ZIP (39 MB)',
      },
      {
        label: 'Flare RPG v1.15 Linux AppImage',
        provider: 'GitHub Releases',
        url: 'https://github.com/flareteam/flare-game/releases/download/v1.15/flare-linux64-v1.15.AppImage',
        partInfo: 'Linux AppImage (579 MB)',
      },
      {
        label: 'Flare Full Campaign SourceForge Mirror',
        provider: 'SourceForge',
        url: 'https://sourceforge.net/projects/flare-game/files/',
        partInfo: 'Multi-OS Archives',
      },
      {
        label: 'Flare Empyrean Itch.io Mirror',
        provider: 'Itch.io',
        url: 'https://dorkster.itch.io/flare',
        partInfo: 'Official Itch.io Build',
      },
    ],
    featured: true,
    visibility: 'public',
    downloadsCount: 1420,
  },
  {
    id: 'valkyrie-protocol-zero',
    title: 'Valkyrie Protocol: Zero',
    description:
      'Deploy with an orbital recon squad into high-risk basalt moon outposts and pressurized industrial ring stations. Plan tactical breaches, manage squad telemetry, and extract encrypted orbital payloads before atmospheric dust storms sever extraction corridors.',
    size: '54.2 GB',
    genre: 'Tactical Shooter',
    tags: ['Co-op', 'Tactical', 'Multiplayer', 'Sci-Fi', 'PvE'],
    rating: 0,
    ratingSum: 0,
    reviewCount: 0,
    developer: 'Orbital Dynamics Interactive',
    releaseYear: '2026',
    bannerCoverUrl: '/src/assets/images/banner_valkyrie_protocol_1795345533696.jpg',
    verticalCoverUrl: '/src/assets/images/vcover_valkyrie_protocol_1795345534209.jpg',
    screenshots: [
      '/src/assets/images/screen_valkyrie_1_1795343710893.jpg',
      '/src/assets/images/screen_valkyrie_2_1795343710894.jpg',
      '/src/assets/images/screen_valkyrie_3_1795343710733.jpg',
    ],
    downloadLinks: [
      {
        label: 'Unvanquished v0.56.2 Full Archive',
        provider: 'GitHub Releases',
        url: 'https://github.com/Unvanquished/Unvanquished/releases/download/v0.56.2/unvanquished_0.56.2.zip',
        partInfo: 'Universal ZIP (598 MB)',
      },
      {
        label: 'Official CDN Package Repository',
        provider: 'Official CDN',
        url: 'https://dl.unvanquished.net/',
        partInfo: 'Direct Packages & Assets',
      },
      {
        label: 'Unvanquished Official Download Hub',
        provider: 'Official Site',
        url: 'https://unvanquished.net/download/',
        partInfo: 'Windows / macOS / Linux',
      },
      {
        label: 'Flathub Verified Linux Mirror',
        provider: 'Flathub',
        url: 'https://flathub.org/en/apps/net.unvanquished.Unvanquished',
        partInfo: 'Sandboxed Flatpak',
      },
    ],
    featured: false,
    visibility: 'public',
    downloadsCount: 985,
  },
  {
    id: 'apex-horizon-touge',
    title: 'Apex Horizon: Touge',
    description:
      'Precision motorsport simulation engineered for wet alpine hairpins, night endurance rain stages, and telemetry-driven pit lane tuning. Calibrate tire pressures, brake bias, and suspension geometry across dynamic coastal mountain passes.',
    size: '42.8 GB',
    genre: 'Motorsport Sim',
    tags: ['Racing', 'Simulation', 'Indie', 'Time Attack', 'Controller Support'],
    rating: 0,
    ratingSum: 0,
    reviewCount: 0,
    developer: 'Kronos Motorsport Labs',
    releaseYear: '2025',
    bannerCoverUrl: '/src/assets/images/banner_apex_horizon_1795345534364.jpg',
    verticalCoverUrl: '/src/assets/images/vcover_apex_horizon_1795345533824.jpg',
    screenshots: [
      '/src/assets/images/screen_apex_1_1795343710245.jpg',
      '/src/assets/images/screen_apex_2_1795343710642.jpg',
      '/src/assets/images/screen_apex_3_1795343710679.jpg',
    ],
    downloadLinks: [
      {
        label: 'SuperTuxKart 1.5 Windows x64 Installer',
        provider: 'GitHub Releases',
        url: 'https://github.com/supertuxkart/stk-code/releases/download/1.5/SuperTuxKart-1.5-installer-x86_64.exe',
        partInfo: 'Windows x64 EXE (690 MB)',
      },
      {
        label: 'Speed Dreams Official Itch.io Mirror',
        provider: 'Itch.io',
        url: 'https://speed-dreams.itch.io/speed-dreams',
        partInfo: 'Windows & Linux Builds',
      },
      {
        label: 'Speed Dreams SourceForge Mirror',
        provider: 'SourceForge',
        url: 'https://sourceforge.net/projects/speed-dreams/files/',
        partInfo: 'Release Archives',
      },
      {
        label: 'SuperTuxKart Official Download Hub',
        provider: 'Official Site',
        url: 'https://supertuxkart.net/Download',
        partInfo: 'Windows / macOS / Android',
      },
    ],
    featured: false,
    visibility: 'public',
    downloadsCount: 760,
  },
];
