import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { validateHostAndOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  try {
    const session = getSession();
    const data = getPortfolioData();

    // Sanitize data: do not expose passwordHash
    const sanitized = {
      owner: data.owner,
      widgets: data.widgets,
      root: data.root,
      settings: data.settings,
      trash: session?.role === 'admin' ? data.trash : [],
      role: session?.role || 'guest',
      user: session ? {
        role: session.role,
        name: session.name,
        email: session.email,
        username: session.username,
      } : null,
    };

    return NextResponse.json(sanitized);
  } catch (err) {
    console.error('Error fetching portfolio data:', err);
    return NextResponse.json(
      { error: 'Failed to load portfolio data' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  try {
    const session = getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const current = getPortfolioData();

    const updated = {
      ...current,
      widgets: body.widgets !== undefined ? body.widgets : current.widgets,
      root: body.root !== undefined ? body.root : current.root,
      owner: body.owner !== undefined ? { ...current.owner, ...body.owner } : current.owner,
      settings: body.settings !== undefined ? { ...current.settings, ...body.settings } : current.settings,
      trash: body.trash !== undefined ? body.trash : current.trash,
    };

    savePortfolioData(updated);

    return NextResponse.json({
      success: true,
      data: {
        owner: updated.owner,
        widgets: updated.widgets,
        root: updated.root,
        settings: updated.settings,
        trash: updated.trash,
      },
    });
  } catch (err) {
    console.error('Error saving portfolio data:', err);
    return NextResponse.json(
      { error: 'Failed to save portfolio data' },
      { status: 500 }
    );
  }
}
