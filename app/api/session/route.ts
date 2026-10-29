import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateHostAndOrigin, isLoopbackHostname } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (session && (session.role === 'admin' || (session as any).role === 'owner')) {
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const hostname = hostHeader.split(':')[0].toLowerCase();
    if (!isLoopbackHostname(hostname)) {
      // Admin session is only accessible through localhost
      return NextResponse.json({ user: null });
    }
  }

  return NextResponse.json({ user: session, ...(session || {}) });
}
