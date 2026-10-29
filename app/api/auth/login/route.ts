import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSessionCookie } from '@/lib/auth';
import { getPortfolioData } from '@/lib/data';
import { isShareModeActive } from '@/lib/pc-guard';
import { recordVisitor } from '@/lib/telemetry';
import { validateHostAndOrigin, isLoopbackHostname } from '@/lib/security';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory rate limiting map: ip -> array of failed timestamps
const failedAttemptsMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_FAILED_ATTEMPTS = 5;

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const attempts = failedAttemptsMap.get(identifier) || [];
  const validAttempts = attempts.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  failedAttemptsMap.set(identifier, validAttempts);
  return validAttempts.length >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(identifier: string) {
  const now = Date.now();
  const attempts = failedAttemptsMap.get(identifier) || [];
  attempts.push(now);
  failedAttemptsMap.set(identifier, attempts);
}

function clearAttempts(identifier: string) {
  failedAttemptsMap.delete(identifier);
}

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

  try {
    const body = await req.json();
    const tab = body.tab || (body.mode === 'guest' ? 'guest' : body.mode === 'owner' ? 'owner' : 'viewer');

    if (tab === 'viewer' || tab === 'guest') {
      const name = body.name || (tab === 'guest' ? 'Guest Visitor' : '');
      const email = body.email || (tab === 'guest' ? 'guest@portos.local' : '');
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanEmail = typeof email === 'string' ? email.trim() : '';

      if (!cleanName) {
        return NextResponse.json(
          { error: 'Name is required' },
          { status: 400 }
        );
      }

      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        return NextResponse.json(
          { error: 'A valid email address is required' },
          { status: 400 }
        );
      }

      // Record visitor telemetry
      const userAgent = req.headers.get('user-agent') || 'Browser';
      try {
        recordVisitor({
          name: cleanName,
          email: cleanEmail,
          ip: clientIp,
          userAgent,
        });
      } catch (e) {
        console.error('Failed to record visitor telemetry:', e);
      }

      const sessionCookie = createSessionCookie({
        role: 'viewer',
        name: cleanName,
        email: cleanEmail,
      });

      const response = NextResponse.json({
        success: true,
        user: { role: 'viewer', name: cleanName, email: cleanEmail },
      });

      response.cookies.set(sessionCookie);
      return response;
    } else if (tab === 'admin' || tab === 'owner') {
      // Admin section is ONLY accessible through the localhost side of the website
      const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      const hostname = hostHeader.split(':')[0].toLowerCase();
      if (!isLoopbackHostname(hostname)) {
        return NextResponse.json(
          { error: 'Admin login is only accessible through localhost.' },
          { status: 403 }
        );
      }

      // R2: In portfolio share mode, admin login is disabled
      if (isShareModeActive()) {
        return NextResponse.json(
          { error: 'Admin login is disabled in Portfolio Share mode' },
          { status: 403 }
        );
      }

      // R3: Rate limit check
      if (isRateLimited(clientIp)) {
        return NextResponse.json(
          { error: 'Too many failed login attempts. Please wait 60 seconds.' },
          { status: 429 }
        );
      }

      const { username, password } = body;
      const cleanUsername = typeof username === 'string' && username.trim() ? username.trim() : 'admin';
      const cleanPassword = typeof password === 'string' ? password : '';

      if (!cleanPassword) {
        recordFailedAttempt(clientIp);
        return NextResponse.json(
          { error: 'Password is required' },
          { status: 401 }
        );
      }

      const data = getPortfolioData();
      const expectedUsername = process.env.ADMIN_USERNAME || data.admin?.username || 'admin';
      const fileHash = data.admin?.passwordHash || '';
      const envHash = process.env.ADMIN_PASSWORD_HASH || '';
      const expectedHash = fileHash.startsWith('$2')
        ? fileHash
        : envHash.startsWith('$2')
        ? envHash
        : fileHash || envHash;
      const envPassword = process.env.ADMIN_PASSWORD || '';

      // Check username if specified
      if (cleanUsername !== expectedUsername && cleanUsername !== 'admin' && cleanUsername !== 'owner') {
        recordFailedAttempt(clientIp);
        if (isRateLimited(clientIp)) {
          return NextResponse.json(
            { error: 'Too many failed login attempts. Please wait 60 seconds.' },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      let isMatch = false;
      const targetHash =
        expectedHash && (expectedHash.startsWith('$2a$') || expectedHash.startsWith('$2b$'))
          ? expectedHash
          : envPassword
          ? bcrypt.hashSync(envPassword, 12)
          : null;

      if (targetHash) {
        isMatch = bcrypt.compareSync(cleanPassword, targetHash);
      } else {
        // SEC1: Fail closed if no password configured
        return NextResponse.json(
          { error: 'Admin account is unconfigured. Set password via npm run set-password.' },
          { status: 403 }
        );
      }

      if (!isMatch) {
        recordFailedAttempt(clientIp);
        if (isRateLimited(clientIp)) {
          return NextResponse.json(
            { error: 'Too many failed login attempts. Please wait 60 seconds.' },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      // Successful login clears failed attempts
      clearAttempts(clientIp);

      const sessionCookie = createSessionCookie({
        role: 'admin',
        username: cleanUsername,
      });

      const response = NextResponse.json({
        success: true,
        user: { role: 'admin', username: cleanUsername },
      });

      response.cookies.set(sessionCookie);
      return response;
    } else {
      return NextResponse.json(
        { error: 'Invalid login tab specified' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  clearAttempts(clientIp);
  failedAttemptsMap.clear();
  return NextResponse.json({ success: true, message: 'Rate limit reset' });
}
