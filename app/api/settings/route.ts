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

    // Step 3 Guard: Reject any attempt to customize or mutate wallpapers
    const hasWallpaperMutation =
      body.wallpaper !== undefined ||
      body.appearance?.wallpaper !== undefined ||
      (body.customization?.desktopWallpaper && Object.keys(body.customization.desktopWallpaper).length > 0) ||
      (body.customization?.lockScreenWallpaper && Object.keys(body.customization.lockScreenWallpaper).length > 0) ||
      body.customization?.wallpaperDesktop !== undefined ||
      body.customization?.wallpaperLockScreen !== undefined ||
      body.customization?.customWallpaperData !== undefined;

    if (hasWallpaperMutation) {
      return NextResponse.json(
        { error: 'Wallpaper customization has been retired. The desktop is powered by the unified system-managed robot sequence.' },
        { status: 400 }
      );
    }

    if (body.customization) {
      delete body.customization.desktopWallpaper;
      delete body.customization.lockScreenWallpaper;
      delete body.customization.wallpaperDesktop;
      delete body.customization.wallpaperLockScreen;
      delete body.customization.customWallpaperData;
    }

    // Sanitize and clamp dial & appearance numerical inputs
    if (body.appearance) {
      if (body.appearance.volume !== undefined) {
        const v = Number(body.appearance.volume);
        if (Number.isNaN(v) || !Number.isFinite(v)) {
          body.appearance.volume = 0.8;
        } else {
          body.appearance.volume = Math.max(0, Math.min(1, v));
        }
      }
    }

    if (body.customization) {
      if (body.customization.desktopSide !== undefined) {
        if (!['left', 'right'].includes(body.customization.desktopSide)) {
          return NextResponse.json(
            { error: 'Invalid desktopSide enum value. Must be "left" or "right".' },
            { status: 400 }
          );
        }
      }
      if (body.customization.bgOpacity !== undefined) {
        const op = Number(body.customization.bgOpacity);
        if (Number.isNaN(op) || !Number.isFinite(op)) {
          body.customization.bgOpacity = 0.8;
        } else {
          body.customization.bgOpacity = Math.max(0.2, Math.min(1.0, op));
        }
      }
      if (body.customization.borderRadius !== undefined) {
        const br = Number(body.customization.borderRadius);
        if (Number.isNaN(br) || !Number.isFinite(br)) {
          body.customization.borderRadius = 14;
        } else {
          body.customization.borderRadius = Math.max(4, Math.min(24, Math.round(br)));
        }
      }
    }

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
        clock: {
          ...(data.settings.customization?.clock || DEFAULT_CUSTOMIZATION.clock),
          ...(body.customization?.clock || {}),
        },
        effects: {
          ...(data.settings.customization?.effects || DEFAULT_CUSTOMIZATION.effects),
          ...(body.customization?.effects || {}),
        },
        sounds: {
          ...(data.settings.customization?.sounds || DEFAULT_CUSTOMIZATION.sounds),
          ...(body.customization?.sounds || {}),
        },
        desktopIcons: {
          ...(data.settings.customization?.desktopIcons || {}),
          ...(body.customization?.desktopIcons || {}),
        },
        appTheme: {
          ...(data.settings.customization?.appTheme || {}),
          ...(body.customization?.appTheme || {}),
        },
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

    // Sanitize effects (drop deprecated fields per Step 5)
    if (data.settings.customization?.effects) {
      delete (data.settings.customization.effects as any).magneticHover;
      delete (data.settings.customization.effects as any).tiltEffect;
      delete (data.settings.customization.effects as any).auroraMesh;
    }

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
