import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession, UserSession } from './auth';

const ALLOWED_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLoopbackHostname(hostname: string): boolean {
  if (ALLOWED_LOOPBACK_HOSTS.has(hostname)) return true;
  if (hostname.startsWith('127.')) return true;
  const customAllowedHost = process.env.ALLOWED_HOST?.toLowerCase();
  if (customAllowedHost && hostname === customAllowedHost) return true;
  return false;
}

/**
 * H4: Validate Host header (stops DNS Rebinding) and Origin/Referer header (stops CSRF)
 */
export function validateHostAndOrigin(req: NextRequest): NextResponse | null {
  // 1. Host header validation
  const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0].toLowerCase();

  if (!hostname || !isLoopbackHostname(hostname)) {
    return NextResponse.json(
      { error: 'Security violation: Host is not an allowlisted loopback interface' },
      { status: 400 }
    );
  }

  // 2. Origin/Referer validation for state-mutating requests
  const method = req.method.toUpperCase();
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (isMutating) {
    const originHeader = req.headers.get('origin');
    const refererHeader = req.headers.get('referer');
    const hostPort = hostHeader.includes(':') ? hostHeader.split(':')[1] : '3000';

    if (originHeader) {
      try {
        const originUrl = new URL(originHeader);
        const originHost = originUrl.hostname.toLowerCase();
        const originPort = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');

        if (!isLoopbackHostname(originHost) || (originPort && hostPort && originPort !== hostPort)) {
          return NextResponse.json(
            { error: 'Security violation: Cross-origin request rejected' },
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

        if (!isLoopbackHostname(refHost) || (refPort && hostPort && refPort !== hostPort)) {
          return NextResponse.json(
            { error: 'Security violation: Untrusted Referer header rejected' },
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
