import {
  isSafeHttpOrAssetUrl,
  type DownloadMirror,
  type MirrorHealthStatus,
  type MirrorValidationResult,
} from '../types/game';

function detectProviderFromHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.includes('github.com') || host.includes('githubusercontent.com')) return 'GitHub Releases';
  if (host.includes('sourceforge.net')) return 'SourceForge';
  if (host.includes('itch.io')) return 'Itch.io';
  if (host.includes('flathub.org')) return 'Flathub';
  if (host.includes('datanodes.')) return 'DataNodes';
  if (host.includes('drive.google.com') || host.includes('docs.google.com')) return 'Google Drive';
  if (host.includes('mediafire.com')) return 'MediaFire';
  if (host.includes('mega.nz') || host.includes('mega.co.nz')) return 'Mega.nz';
  if (host.includes('pixeldrain.com')) return 'PixelDrain';
  if (host.includes('gofile.io')) return 'GoFile';
  if (host.includes('1fichier.com')) return '1Fichier';
  if (host.includes('dropbox.com')) return 'Dropbox';
  if (host.startsWith('dl.')) return 'Official CDN';
  if (
    host.includes('unvanquished.net') ||
    host.includes('supertuxkart.net') ||
    host.includes('veloren.net') ||
    host.includes('xonotic.org')
  ) {
    return 'Official Site';
  }
  return 'Direct CDN';
}

function hashSeed(input: string, tick: number): number {
  let hash = 2166136261 ^ tick;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Simulates a deterministic-with-jitter health check for a mirror URL.
 * Evaluates URL safety, placeholder hosts, and simulated latency / CDN health.
 */
export function checkMirrorHealth(
  mirror: Pick<DownloadMirror, 'url' | 'provider' | 'healthStatus'>,
  tick = 0
): MirrorValidationResult {
  const trimmedUrl = (mirror.url || '').trim();
  const fallbackProvider = mirror.provider || 'Direct CDN';

  if (!isSafeHttpOrAssetUrl(trimmedUrl) || trimmedUrl.startsWith('/src/assets/')) {
    return {
      url: trimmedUrl,
      valid: false,
      provider: fallbackProvider,
      status: 'invalid',
      health: 'offline',
      reason: 'Invalid or unsupported mirror URL.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return {
      url: trimmedUrl,
      valid: false,
      provider: fallbackProvider,
      status: 'invalid',
      health: 'offline',
      reason: 'Malformed mirror URL.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === 'example.org' ||
    host.endsWith('.example.org') ||
    host === 'example.com' ||
    host.endsWith('.example.com') ||
    host === 'example.net' ||
    host.endsWith('.example.net')
  ) {
    return {
      url: trimmedUrl,
      valid: false,
      provider: 'Placeholder',
      status: 'blocked',
      health: 'offline',
      reason: 'Placeholder or private mirror host is blocked.',
    };
  }

  const provider = mirror.provider || detectProviderFromHost(host);
  const sample = hashSeed(trimmedUrl, tick) % 100;

  if (mirror.healthStatus === 'issue_reported') {
    return {
      url: trimmedUrl,
      valid: false,
      provider,
      status: 'invalid',
      health: 'issue_reported',
      statusCode: 503,
      reason: 'Issue reported by user — awaiting admin verification.',
    };
  }

  let health: MirrorHealthStatus = 'online';
  let latencyMs = 75 + (hashSeed(`${trimmedUrl}:lat`, tick) % 240);
  let reason: string | undefined;

  if (mirror.healthStatus === 'offline') {
    health = 'offline';
    latencyMs = undefined as unknown as number;
    reason = 'Marked offline by catalog administrator.';
  } else if (sample >= 95) {
    health = 'offline';
    reason = 'Simulated health probe timeout (mirror unreachable).';
  } else if (sample >= 82 || mirror.healthStatus === 'degraded') {
    health = 'degraded';
    latencyMs = 1850 + (sample * 15);
    reason = `Elevated mirror latency (${latencyMs} ms).`;
  }

  return {
    url: trimmedUrl,
    valid: health !== 'offline',
    provider,
    status: health === 'online' ? 'reachable' : health === 'degraded' ? 'format-ok' : 'invalid',
    health,
    latencyMs: health === 'offline' ? undefined : latencyMs,
    statusCode: health === 'online' ? 200 : health === 'degraded' ? 429 : 503,
    reason,
  };
}
