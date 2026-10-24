import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { validateHostAndOrigin, requireRole } from '@/lib/security';
import { DEFAULT_CUSTOMIZATION } from '@/lib/types';

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

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

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
      customization: {
        ...(data.settings.customization || DEFAULT_CUSTOMIZATION),
        ...(body.customization || {}),
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
        name: data.settings.general.ownerName || data.settings.general.name || data.owner.name,
        title: data.settings.general.title || data.owner.title,
        bio: data.settings.general.bio || data.owner.bio,
        email: data.settings.general.email || data.owner.email,
        location: data.settings.general.location || data.owner.location,
        github: data.settings.general.github || data.owner.github || '',
        linkedin: data.settings.general.linkedin || data.owner.linkedin || '',
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
