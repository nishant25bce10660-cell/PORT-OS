import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { validateHostAndOrigin } from '@/lib/security';

export async function PUT(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (!Array.isArray(body.widgets)) {
      return NextResponse.json({ error: 'widgets array is required' }, { status: 400 });
    }

    const current = getPortfolioData();
    current.widgets = body.widgets;
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

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }

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
