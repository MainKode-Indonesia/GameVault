import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PORT = 3000;

// Registered Google Admin accounts (extendable via ADMIN_EMAILS env var)
const REGISTERED_ADMIN_EMAILS = new Set<string>(
  [
    'mainkode4@gmail.com',
    ...(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ].map((email) => email.toLowerCase())
);

interface FirebaseAppletConfig {
  projectId: string;
}

interface VerifiedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
}

interface AuthenticatedRequest extends Request {
  user?: VerifiedUser;
}

function loadFirebaseProjectId(): string | null {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;
    if (!raw.projectId || raw.projectId === 'remixed-project-id') return null;
    return raw.projectId;
  } catch {
    return null;
  }
}

const projectId = loadFirebaseProjectId();
const adminApp = projectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId })
  : null;

function isPrivateOrBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const [, aStr, bStr] = ipv4Match;
    const a = Number(aStr);
    const b = Number(bStr);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function detectMirrorProvider(hostname: string): string {
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

// Middleware 1: Verify Firebase Google Auth ID Token
async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!adminApp) {
    res.status(503).json({ error: 'Firebase project is not configured on the server.' });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Empty Authorization token.' });
    return;
  }
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    const emailLower = (decoded.email || '').toLowerCase();
    const emailVerified = decoded.email_verified === true;
    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified,
      isAdmin: emailVerified && REGISTERED_ADMIN_EMAILS.has(emailLower),
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

// Middleware 2: Restrict route strictly to registered Google Admin accounts
function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.isAdmin) {
    res.status(403).json({
      error: 'Forbidden: Only registered Google admin accounts can perform catalog mutations.',
    });
    return;
  }
  next();
}

type MirrorHealthStatus = 'online' | 'degraded' | 'offline';

interface MirrorInspectionResult {
  url: string;
  valid: boolean;
  provider: string;
  status: 'reachable' | 'format-ok' | 'blocked' | 'invalid';
  health: MirrorHealthStatus;
  latencyMs?: number;
  statusCode?: number;
  reason?: string;
}

const MIRROR_HEALTH_CACHE_TTL_MS = 60_000;
const DEGRADED_LATENCY_THRESHOLD_MS = 1800;
const mirrorHealthCache = new Map<
  string,
  { result: MirrorInspectionResult; expiresAt: number }
>();

async function probeRemoteMirror(targetUrl: string): Promise<{
  statusCode: number;
  latencyMs: number;
}> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    let response = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(targetUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'manual',
        signal: controller.signal,
      });
    }
    return {
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function inspectMirrorUrls(
  urls: unknown[],
  options: { forceRefresh?: boolean } = {}
): Promise<MirrorInspectionResult[]> {
  const now = Date.now();
  return Promise.all(
    urls.map(async (rawUrl): Promise<MirrorInspectionResult> => {
      if (typeof rawUrl !== 'string' || rawUrl.trim().length > 1000) {
        return {
          url: String(rawUrl ?? ''),
          valid: false,
          provider: 'Unknown',
          status: 'invalid',
          health: 'offline',
          reason: 'URL must be a string under 1000 characters.',
        };
      }

      const trimmed = rawUrl.trim();
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        return {
          url: trimmed,
          valid: false,
          provider: 'Unknown',
          status: 'invalid',
          health: 'offline',
          reason: 'Malformed URL syntax.',
        };
      }

      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return {
          url: trimmed,
          valid: false,
          provider: 'Unknown',
          status: 'blocked',
          health: 'offline',
          reason: 'Only HTTP/HTTPS protocols are allowed.',
        };
      }

      if (isPrivateOrBlockedHostname(parsed.hostname)) {
        return {
          url: trimmed,
          valid: false,
          provider: 'Blocked',
          status: 'blocked',
          health: 'offline',
          reason: 'Private or loopback network hosts are prohibited.',
        };
      }

      const provider = detectMirrorProvider(parsed.hostname);

      const hostLower = parsed.hostname.toLowerCase();
      if (
        hostLower === 'example.org' ||
        hostLower.endsWith('.example.org') ||
        hostLower === 'example.com' ||
        hostLower.endsWith('.example.com') ||
        hostLower === 'example.net' ||
        hostLower.endsWith('.example.net')
      ) {
        return {
          url: trimmed,
          valid: false,
          provider: 'Placeholder',
          status: 'invalid',
          health: 'offline',
          reason: 'Placeholder/dummy domains (example.*) are not allowed. Use a real mirror URL.',
        };
      }

      const cacheKey = parsed.toString();
      if (!options.forceRefresh) {
        const cached = mirrorHealthCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
          return cached.result;
        }
      }

      let result: MirrorInspectionResult;
      try {
        const { statusCode, latencyMs } = await probeRemoteMirror(cacheKey);
        if (statusCode >= 200 && statusCode < 400) {
          const isSlow = latencyMs >= DEGRADED_LATENCY_THRESHOLD_MS;
          result = {
            url: trimmed,
            valid: true,
            provider,
            status: 'reachable',
            health: isSlow ? 'degraded' : 'online',
            latencyMs,
            statusCode,
            reason: isSlow ? `Slow mirror response (${latencyMs} ms).` : undefined,
          };
        } else if (statusCode === 403 || statusCode === 405 || statusCode === 429 || statusCode === 503) {
          result = {
            url: trimmed,
            valid: true,
            provider,
            status: 'format-ok',
            health: 'degraded',
            latencyMs,
            statusCode,
            reason: `Mirror responded with HTTP ${statusCode} (bot check or rate limit).`,
          };
        } else {
          result = {
            url: trimmed,
            valid: false,
            provider,
            status: 'invalid',
            health: 'offline',
            latencyMs,
            statusCode,
            reason: `Mirror returned HTTP ${statusCode}.`,
          };
        }
      } catch (err) {
        const errObj = err as { name?: string; cause?: { code?: string }; code?: string };
        const errCode = errObj?.cause?.code || errObj?.code || '';
        const isTimeout = errObj?.name === 'AbortError';
        const isDnsOrRefused =
          errCode === 'ENOTFOUND' || errCode === 'EAI_AGAIN' || errCode === 'ECONNREFUSED';

        if (isDnsOrRefused) {
          result = {
            url: trimmed,
            valid: false,
            provider,
            status: 'invalid',
            health: 'offline',
            reason: 'Mirror host could not be reached.',
          };
        } else {
          result = {
            url: trimmed,
            valid: true,
            provider,
            status: 'format-ok',
            health: 'degraded',
            reason: isTimeout
              ? 'Mirror ping timed out (>3s).'
              : 'Remote host did not answer automated HEAD probe.',
          };
        }
      }

      mirrorHealthCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + MIRROR_HEALTH_CACHE_TTL_MS,
      });
      return result;
    })
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'gamevault-server',
      firebaseConfigured: Boolean(projectId),
      timestamp: new Date().toISOString(),
    });
  });

  // Verify Google session & return admin middleware status
  app.post('/api/auth/verify', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ verified: true, user: req.user });
  });

  // Public SSRF-guarded mirror health ping endpoint (supports automatic status checks)
  app.post('/api/mirrors/health', async (req: Request, res: Response) => {
    const body = req.body as { urls?: unknown; forceRefresh?: unknown };
    if (!Array.isArray(body?.urls) || body.urls.length === 0 || body.urls.length > 12) {
      res.status(400).json({ error: 'Provide an array of 1 to 12 mirror URLs.' });
      return;
    }
    const results = await inspectMirrorUrls(body.urls, {
      forceRefresh: body.forceRefresh === true,
    });
    res.json({ results });
  });

  // Admin-only mirror validation endpoint protected by requireAuth + requireAdmin middleware
  app.post(
    '/api/admin/mirrors/validate',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
      const body = req.body as { urls?: unknown; forceRefresh?: unknown };
      if (!Array.isArray(body?.urls) || body.urls.length === 0 || body.urls.length > 12) {
        res.status(400).json({ error: 'Provide an array of 1 to 12 mirror URLs.' });
        return;
      }
      const results = await inspectMirrorUrls(body.urls, {
        forceRefresh: body.forceRefresh === true,
      });
      res.json({ results });
    }
  );

  // Authenticated user mirror verification endpoint
  app.post('/api/mirrors/validate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const body = req.body as { urls?: unknown; forceRefresh?: unknown };
    if (!Array.isArray(body?.urls) || body.urls.length === 0 || body.urls.length > 12) {
      res.status(400).json({ error: 'Provide an array of 1 to 12 mirror URLs.' });
      return;
    }
    const results = await inspectMirrorUrls(body.urls, {
      forceRefresh: body.forceRefresh === true,
    });
    res.json({ results });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GameVault server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
