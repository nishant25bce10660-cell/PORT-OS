import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVisitors, clearVisitors } from '@/lib/telemetry';
import { validateHostAndOrigin } from '@/lib/security';

// GET /api/telemetry/visitors - Admin only
export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();

  // Strict RBAC: Viewer or unauthenticated gets 403 Forbidden
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin privilege required to view telemetry' },
      { status: 403 }
    );
  }

  const visitors = getVisitors();
  return NextResponse.json({
    success: true,
    visitors,
    count: visitors.length,
  });
}

// DELETE /api/telemetry/visitors - Admin only
export async function DELETE(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin privilege required to clear telemetry' },
      { status: 403 }
    );
  }

  clearVisitors();
  return NextResponse.json({
    success: true,
    message: 'Visitor telemetry successfully cleared',
  });
}
