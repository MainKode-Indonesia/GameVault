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
        label: 'Primary Full Build v1.4',
        provider: 'Direct CDN',
        url: 'https://cdn.example.org/gamevault/chrono-eclipse-v1.4-full.zip',
        partInfo: 'Single Archive (68.4 GB)',
      },
      {
        label: 'Google Drive Mirror (Part 1-2)',
        provider: 'Google Drive',
        url: 'https://drive.google.com/drive/folders/chrono-eclipse-mirror',
        partInfo: '2 Parts (34.2 GB each)',
      },
      {
        label: 'MediaFire High-Speed Mirror',
        provider: 'MediaFire',
        url: 'https://www.mediafire.com/folder/chrono-eclipse-aethelgard',
        partInfo: 'Multi-part Archive',
      },
      {
        label: 'Mega.nz Backup Vault',
        provider: 'Mega.nz',
        url: 'https://mega.nz/folder/chrono-eclipse-backup',
        partInfo: 'Verified Checksum ISO',
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
        label: 'Direct CDN Installer',
        provider: 'Direct CDN',
        url: 'https://cdn.example.org/gamevault/valkyrie-protocol-zero.zip',
        partInfo: 'Single Archive (54.2 GB)',
      },
      {
        label: 'Google Drive Cloud Mirror',
        provider: 'Google Drive',
        url: 'https://drive.google.com/drive/folders/valkyrie-protocol-zero',
        partInfo: 'Full Repack + HD Pack',
      },
      {
        label: 'PixelDrain Fast Mirror',
        provider: 'PixelDrain',
        url: 'https://pixeldrain.com/l/valkyrie-protocol-zero',
        partInfo: 'Direct Multi-Part',
      },
      {
        label: 'Mega.nz Archive',
        provider: 'Mega.nz',
        url: 'https://mega.nz/folder/valkyrie-protocol-zero',
        partInfo: 'SHA-256 Verified',
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
        label: 'Primary Track Edition ISO',
        provider: 'Direct CDN',
        url: 'https://cdn.example.org/gamevault/apex-horizon-touge-v2.iso',
        partInfo: 'Single ISO (42.8 GB)',
      },
      {
        label: 'Google Drive Mirror',
        provider: 'Google Drive',
        url: 'https://drive.google.com/drive/folders/apex-horizon-touge',
        partInfo: 'Complete DLC Pack',
      },
      {
        label: 'GoFile Fast Mirror',
        provider: 'GoFile',
        url: 'https://gofile.io/d/apex-horizon-touge',
        partInfo: 'Uncompressed Zip',
      },
    ],
    featured: false,
    visibility: 'public',
    downloadsCount: 760,
  },
];
