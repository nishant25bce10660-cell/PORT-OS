import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { validateHostAndOrigin, requireRole } from '@/lib/security';

export async function PUT(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    if (!Array.isArray(body.widgets)) {
      return NextResponse.json({ error: 'widgets array is required' }, { status: 400 });
    }

    if (body.widgets.length > 35) {
      return NextResponse.json({ error: 'Widget limit exceeded (max 35)' }, { status: 400 });
    }

    // Validate widget items
    const validWidgets = body.widgets.filter(
      (w: any) => w && typeof w.id === 'string' && typeof w.type === 'string' && typeof w.x === 'number' && typeof w.y === 'number'
    );

    const current = getPortfolioData();
    current.widgets = validWidgets;
    savePortfolioData(current);

    return NextResponse.json({ success: true, widgets: current.widgets });
  } catch (err) {
    console.error('Error updating widgets:', err);
    return NextResponse.json({ error: 'Failed to update widgets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

  try {
    const widget = await req.json();
    const current = getPortfolioData();
    current.widgets.push(widget);
    savePortfolioData(current);
    return NextResponse.json({ success: true, widget }, { status: 201 });
  } catch (err) {
    console.error('Error adding widget:', err);
    return NextResponse.json({ error: 'Failed to add widget' }, { status: 500 });
  }
}
