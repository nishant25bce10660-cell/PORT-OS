import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateHostAndOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  return NextResponse.json({ user: session });
}
