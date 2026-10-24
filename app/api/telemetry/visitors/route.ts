import { NextRequest, NextResponse } from 'next/server';
import { getVisitors, clearVisitors } from '@/lib/telemetry';
import { validateHostAndOrigin, requireRole } from '@/lib/security';

// GET /api/telemetry/visitors - Admin only
export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

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

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

  clearVisitors();
  return NextResponse.json({
    success: true,
    message: 'Visitor telemetry successfully cleared',
  });
}
