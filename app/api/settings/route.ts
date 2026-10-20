import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { validateHostAndOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  try {
    const data = getPortfolioData();
    return NextResponse.json({ settings: data.settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = getPortfolioData();

    // Deep merge settings
    data.settings = {
      general: {
        ...data.settings.general,
        ...(body.general || {}),
      },
      appearance: {
        ...data.settings.appearance,
        ...(body.appearance || {}),
      },
      boot: {
        ...data.settings.boot,
        ...(body.boot || {}),
      },
      security: {
        ...data.settings.security,
        ...(body.security || {}),
      },
    };

    // If general owner info changed, keep owner object synced
    if (body.general) {
      data.owner = {
        ...data.owner,
        name: data.settings.general.ownerName,
        title: data.settings.general.title,
        bio: data.settings.general.bio,
        email: data.settings.general.email,
        location: data.settings.general.location,
        github: data.settings.general.github,
        linkedin: data.settings.general.linkedin,
      };
    }

    savePortfolioData(data);

    return NextResponse.json({
      success: true,
      settings: data.settings,
      owner: data.owner,
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
