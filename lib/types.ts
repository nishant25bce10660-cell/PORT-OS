// TypeScript definitions for PORT OS

export type ItemKind = 'file' | 'folder';

export interface BaseItem {
  id: string;
  name: string;
  kind: ItemKind;
}

export interface FileItem extends BaseItem {
  kind: 'file';
  content?: string;
  size?: number;
  updatedAt?: string;
}

export interface FolderItem extends BaseItem {
  kind: 'folder';
  children: (FileItem | FolderItem)[];
}

export type Item = FileItem | FolderItem;

export type WidgetType =
  | 'clock'
  | 'analog-clock'
  | 'calendar'
  | 'countdown'
  | 'note'
  | 'todo'
  | 'counter'
  | 'metric'
  | 'quote'
  | 'custom';

export type CustomWidgetFieldType =
  | 'heading'
  | 'text'
  | 'number'
  | 'metric'
  | 'progress'
  | 'checklist'
  | 'list'
  | 'date'
  | 'image'
  | 'link'
  | 'divider';

export interface CustomWidgetBlock {
  id: string;
  type: CustomWidgetFieldType;
  config: {
    text?: string;
    subtext?: string;
    value?: number | string;
    targetValue?: number;
    unit?: string;
    items?: { id: string; text: string; done?: boolean }[];
    url?: string;
    targetDate?: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    align?: 'left' | 'center' | 'right';
  };
}

export interface WidgetCustomAppearance {
  bgColor?: string;
  bgOpacity?: number;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  backdropBlur?: number;
  effect?: 'none' | 'liquid-glass' | 'glow' | 'tilt';
}

export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  text?: string;
  title?: string;
  sizeMode?: 'auto' | 'compact' | 'standard' | 'expanded' | 'custom';
  customWidth?: number;
  customHeight?: number;
  blocks?: CustomWidgetBlock[];
  appearance?: WidgetCustomAppearance;
  config?: Record<string, any>;
  scope?: 'personal' | 'shared';
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminConfig {
  username: string;
  passwordHash: string;
}

export interface OwnerInfo {
  name: string;
  title: string;
  bio: string;
  email: string;
  location: string;
  github: string;
  linkedin: string;
}

export interface ClockConfig {
  timeFormat?: '24h' | '12h';
  is24Hour?: boolean;
  showSeconds: boolean;
  showDate: boolean;
  showGlow?: boolean;
  glowIntensity?: number;
  fontFamily?: string;
  fontWeight?: string;
  digitSize?: number | 'small' | 'medium' | 'large';
  hoursColor?: string;
  digitColorHours?: string;
  colonColor?: string;
  digitColorColon?: string;
  minutesColor?: string;
  digitColorMinutes?: string;
  secondsColor?: string;
  digitColorSeconds?: string;
  // Per-digit customization (H1, H2, colon1, M1, M2, colon2, S1, S2)
  digitColorH1?: string;
  digitColorH2?: string;
  colonColor1?: string;
  digitColorM1?: string;
  digitColorM2?: string;
  colonColor2?: string;
  digitColorS1?: string;
  digitColorS2?: string;
  locationLabel: string;
  material?: 'liquid-glass' | 'frosted' | 'solid';
  sizeMode?: 'auto' | 'compact' | 'standard' | 'expanded' | 'custom';
  customWidth?: number;
  customHeight?: number;
}

export interface DesktopIconPosition {
  id: string;
  x: number;
  y: number;
}

export interface EffectsConfig {
  preset?: 'liquid-glass' | 'frosted-glass' | 'deep-velvet' | 'aurora-flow' | 'spatial-minimal' | string;
  liquidGlass?: boolean;
  glassmorphism?: boolean;
  magneticHover?: boolean;
  tiltEffect?: boolean;
  ambientGlow?: boolean;
  auroraMesh?: boolean;
  glassOpacity?: number;
  blurAmount?: number;
  specularBorders?: boolean;
  glowIntensity?: number;
  tiltEnabled?: boolean;
  parallaxDepth?: boolean;
  reduceMotion?: boolean;
  highContrast?: boolean;
}

export interface WallpaperConfig {
  type: 'preset' | 'image';
  preset?: string;
  imageUrl?: string;
  scaling?: 'cover' | 'contain' | 'stretch';
}

export interface CustomizationSettings {
  wallpaperDesktop?: string;
  wallpaperLockScreen?: string;
  desktopWallpaper: WallpaperConfig;
  lockScreenWallpaper: WallpaperConfig;
  customWallpaperData?: string;
  theme?: 'dark' | 'midnight';
  accentColor?: string;
  font?: string;
  iconSize?: number;
  clock: ClockConfig;
  clockConfig?: ClockConfig;
  effects: EffectsConfig;
  desktopIcons?: {
    positions?: Record<string, { x: number; y: number }>;
    size?: 'small' | 'medium' | 'large';
  } | DesktopIconPosition[];
}

export interface SystemSettings {
  general: {
    ownerName?: string;
    name?: string;
    title: string;
    bio: string;
    email: string;
    location: string;
    github?: string;
    linkedin?: string;
  };
  appearance: {
    theme: 'dark' | 'midnight';
    wallpaper: string; // 'wave-shader' | 'silk-midnight' | 'deep-space' | 'obsidian' | 'aurora'
    accentColor: string;
    font: string;
  };
  customization?: CustomizationSettings;
  boot: {
    bootAnimation: 'classic' | 'cyber' | 'matrix' | 'bloom' | 'pulse';
    metalFinish: 'silver' | 'space-gray' | 'gold' | 'midnight';
    bootText: string;
  };
  security: {
    lockTimeoutMinutes: number;
    shareMode: boolean;
  };
}

export interface TrashedItem {
  id: string;
  item: Item;
  originalParentId: string | null;
  trashedAt: string;
}

export interface PortfolioData {
  admin: AdminConfig;
  owner: OwnerInfo;
  widgets: Widget[];
  root: (FileItem | FolderItem)[];
  settings: SystemSettings;
  trash: TrashedItem[];
}

export const DEFAULT_CLOCK_CONFIG: ClockConfig = {
  timeFormat: '24h',
  is24Hour: true,
  showSeconds: true,
  showDate: true,
  showGlow: true,
  glowIntensity: 0.6,
  fontFamily: 'JetBrains Mono',
  fontWeight: '700',
  digitSize: 'medium',
  hoursColor: '#38bdf8',
  colonColor: '#35d0ba',
  minutesColor: '#ffffff',
  secondsColor: '#7c6cff',
  digitColorHours: '#38bdf8',
  digitColorColon: '#35d0ba',
  digitColorMinutes: '#ffffff',
  digitColorSeconds: '#7c6cff',
  locationLabel: 'San Francisco, CA',
  material: 'liquid-glass',
  sizeMode: 'auto',
  customWidth: 300,
  customHeight: 180,
};

export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  preset: 'liquid-glass',
  liquidGlass: true,
  glassmorphism: false,
  magneticHover: false,
  tiltEffect: false,
  ambientGlow: false,
  auroraMesh: false,
  glassOpacity: 0.85,
  blurAmount: 24,
  specularBorders: true,
  glowIntensity: 0.7,
  tiltEnabled: false,
  parallaxDepth: false,
  reduceMotion: false,
  highContrast: false,
};

export const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  wallpaperDesktop: 'wave-shader',
  wallpaperLockScreen: 'silk-midnight',
  desktopWallpaper: {
    type: 'preset',
    preset: 'wave-shader',
    scaling: 'cover',
  },
  lockScreenWallpaper: {
    type: 'preset',
    preset: 'silk-midnight',
    scaling: 'cover',
  },
  theme: 'dark',
  accentColor: '#38bdf8',
  font: 'Inter',
  iconSize: 48,
  clock: DEFAULT_CLOCK_CONFIG,
  clockConfig: DEFAULT_CLOCK_CONFIG,
  effects: DEFAULT_EFFECTS_CONFIG,
  desktopIcons: {
    positions: {
      projects: { x: 24, y: 52 },
      'cert-education': { x: 24, y: 156 },
      'owners-data': { x: 24, y: 260 },
    },
    size: 'medium',
  },
};

export const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    ownerName: 'Nishant',
    name: 'Nishant',
    title: 'Full Stack Engineer & macOS Enthusiast',
    bio: 'Architecting high-fidelity web experiences and secure distributed systems with Next.js, Three.js, and Node.',
    email: 'admin@portfolio.local',
    location: 'San Francisco, CA',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
  },
  appearance: {
    theme: 'dark',
    wallpaper: 'wave-shader',
    accentColor: '#38bdf8',
    font: 'Inter',
  },
  customization: DEFAULT_CUSTOMIZATION,
  boot: {
    bootAnimation: 'classic',
    metalFinish: 'silver',
    bootText: 'PORT OS v4.2 Pro',
  },
  security: {
    lockTimeoutMinutes: 15,
    shareMode: false,
  },
};
