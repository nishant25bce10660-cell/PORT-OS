import fs from 'fs';
import path from 'path';
import { PortfolioData, DEFAULT_SETTINGS } from './types';

export * from './types';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'portfolio.json');

export function getPortfolioData(): PortfolioData {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      throw new Error(`Data file not found at ${DATA_FILE_PATH}`);
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    // Merge default settings & trash if not present
    if (!parsed.settings) {
      parsed.settings = { ...DEFAULT_SETTINGS };
      if (parsed.owner) {
        parsed.settings.general = {
          ownerName: parsed.owner.name || DEFAULT_SETTINGS.general.ownerName,
          title: parsed.owner.title || DEFAULT_SETTINGS.general.title,
          bio: parsed.owner.bio || DEFAULT_SETTINGS.general.bio,
          email: parsed.owner.email || DEFAULT_SETTINGS.general.email,
          location: parsed.owner.location || DEFAULT_SETTINGS.general.location,
          github: parsed.owner.github || DEFAULT_SETTINGS.general.github,
          linkedin: parsed.owner.linkedin || DEFAULT_SETTINGS.general.linkedin,
        };
      }
    } else if (!parsed.settings.customization) {
      parsed.settings.customization = {
        ...DEFAULT_SETTINGS.customization,
        theme: parsed.settings.appearance?.theme || 'dark',
        accentColor: parsed.settings.appearance?.accentColor || '#38bdf8',
        font: parsed.settings.appearance?.font || 'Inter',
      };
    }

    if (!Array.isArray(parsed.trash)) {
      parsed.trash = [];
    }

    // Migration: drop deprecated effects fields safely (Step 5)
    if (parsed.settings?.customization?.effects) {
      delete (parsed.settings.customization.effects as any).magneticHover;
      delete (parsed.settings.customization.effects as any).tiltEffect;
      delete (parsed.settings.customization.effects as any).auroraMesh;
    }

    // Migration: drop deprecated wallpaper fields safely (Step 3)
    if (parsed.settings?.customization) {
      delete (parsed.settings.customization as any).wallpaperDesktop;
      delete (parsed.settings.customization as any).wallpaperLockScreen;
      delete (parsed.settings.customization as any).desktopWallpaper;
      delete (parsed.settings.customization as any).lockScreenWallpaper;
      delete (parsed.settings.customization as any).customWallpaperData;
    }
    if (parsed.settings?.appearance) {
      delete (parsed.settings.appearance as any).wallpaper;
    }

    return parsed as PortfolioData;
  } catch (err) {
    console.error('Error reading portfolio data:', err);
    throw err;
  }
}

export function savePortfolioData(data: PortfolioData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving portfolio data:', err);
    throw err;
  }
}
