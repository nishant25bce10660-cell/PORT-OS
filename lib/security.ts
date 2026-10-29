import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession, UserSession } from './auth';

const ALLOWED_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackHostname(hostname: string): boolean {
  if (!hostname) return false;
  const clean = hostname.split(':')[0].toLowerCase();
  if (ALLOWED_LOOPBACK_HOSTS.has(clean)) return true;
  if (clean.startsWith('127.')) return true;
  const customAllowedHost = process.env.ALLOWED_HOST?.toLowerCase();
  if (customAllowedHost && clean === customAllowedHost) return true;
  return false;
}

export function isAllowedHost(hostname: string): boolean {
  if (!hostname) return false;
  const clean = hostname.split(':')[0].toLowerCase();
  if (isLoopbackHostname(clean)) return true;
  // Allow Vercel deployment domains (*.vercel.app)
  if (clean.endsWith('.vercel.app')) return true;
  if (process.env.VERCEL_URL && clean === process.env.VERCEL_URL.toLowerCase().split(':')[0]) return true;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL && clean === process.env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase().split(':')[0]) return true;
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      const u = new URL(process.env.NEXT_PUBLIC_SITE_URL);
      if (clean === u.hostname.toLowerCase()) return true;
    } catch {}
  }
  return false;
}

/**
 * H4: Validate Host header (stops DNS Rebinding) and Origin/Referer header (stops CSRF)
 */
export function validateHostAndOrigin(req: NextRequest): NextResponse | null {
  // 1. Host header validation
  const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0].toLowerCase();

  if (!hostname || !isAllowedHost(hostname)) {
    return NextResponse.json(
      { error: 'Security violation: Host is not an allowlisted loopback interface or domain' },
      { status: 400 }
    );
  }

  // 2. Origin/Referer validation for state-mutating requests
  const method = req.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (isMutating) {
    const originHeader = req.headers.get('origin');
    const refererHeader = req.headers.get('referer');
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.nextUrl.protocol === 'https:';
    const defaultPort = isHttps ? '443' : (isLoopbackHostname(hostname) ? '3000' : '80');
    const hostPort = hostHeader.includes(':') ? hostHeader.split(':')[1] : defaultPort;

    if (originHeader) {
      try {
        const originUrl = new URL(originHeader);
        const originHost = originUrl.hostname.toLowerCase();
        const originPort = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');

        if (!isAllowedHost(originHost) || originHost !== hostname) {
          return NextResponse.json(
            { error: 'Security violation: Cross-origin request rejected' },
            { status: 403 }
          );
        }

        const isStandardPortPair = (hostPort === '443' || hostPort === '80') && (originPort === '443' || originPort === '80');
        if (hostPort && originPort && hostPort !== originPort && !isStandardPortPair) {
          return NextResponse.json(
            { error: 'Security violation: Cross-origin port mismatch' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Security violation: Malformed Origin header' },
          { status: 403 }
        );
      }
    } else if (refererHeader) {
      try {
        const refUrl = new URL(refererHeader);
        const refHost = refUrl.hostname.toLowerCase();
        const refPort = refUrl.port || (refUrl.protocol === 'https:' ? '443' : '80');

        if (!isAllowedHost(refHost) || refHost !== hostname) {
          return NextResponse.json(
            { error: 'Security violation: Untrusted Referer header rejected' },
            { status: 403 }
          );
        }

        const isStandardPortPair = (hostPort === '443' || hostPort === '80') && (refPort === '443' || refPort === '80');
        if (hostPort && refPort && hostPort !== refPort && !isStandardPortPair) {
          return NextResponse.json(
            { error: 'Security violation: Untrusted Referer port mismatch' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Security violation: Malformed Referer header' },
          { status: 403 }
        );
      }
    }
  }

  return null;
}

/**
 * H5: Enforce authorization inside route handlers
 */
export function requireRole(allowedRoles: ('guest' | 'viewer' | 'admin' | 'owner')[]): {
  session: UserSession | null;
  errorResponse: NextResponse | null;
} {
  const session = getSession();

  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const role = session.role;
  const isMatch = allowedRoles.includes(role as any) || (role === 'admin' && allowedRoles.includes('owner'));

  if (!isMatch) {
    return {
      session,
      errorResponse: NextResponse.json(
        { error: `Forbidden: requires one of [${allowedRoles.join(', ')}] role` },
        { status: 403 }
      ),
    };
  }

  return { session, errorResponse: null };
}

/**
 * Constant-time string comparison against timing attacks
 */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
