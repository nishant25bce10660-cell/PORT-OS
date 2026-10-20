import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import { validateHostAndOrigin } from '@/lib/security';

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const response = NextResponse.json({ success: true });
  response.cookies.set(clearSessionCookie());
  return response;
}
