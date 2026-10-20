export interface FileItem {
  id: string;
  name: string;
  kind: 'file';
  content: string;
  size?: number;
  updatedAt?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  kind: 'folder';
  children: (FileItem | FolderItem)[];
  updatedAt?: string;
}

export type Item = FileItem | FolderItem;

export interface Widget {
  id: string;
  type: 'clock' | 'note' | 'counter';
  x: number;
  y: number;
  text: string;
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

export interface SystemSettings {
  general: {
    ownerName: string;
    title: string;
    bio: string;
    email: string;
    location: string;
    github: string;
    linkedin: string;
  };
  appearance: {
    theme: 'dark' | 'midnight';
    wallpaper: string; // 'wave-shader' | 'silk-midnight' | 'deep-space'
    accentColor: string;
    font: string;
  };
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

export const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    ownerName: 'Nishant Kumar',
    title: 'Senior Full-Stack & Systems Engineer',
    bio: 'Crafting resilient cloud-native architectures, operating system interfaces, and distributed systems with sub-50ms latency.',
    email: 'nishant@example.com',
    location: 'San Francisco, CA / Remote',
    github: 'https://github.com/example',
    linkedin: 'https://linkedin.com/in/example',
  },
  appearance: {
    theme: 'dark',
    wallpaper: 'wave-shader',
    accentColor: '#38bdf8',
    font: 'Inter',
  },
  boot: {
    bootAnimation: 'classic',
    metalFinish: 'silver',
    bootText: 'PORT OS',
  },
  security: {
    lockTimeoutMinutes: 15,
    shareMode: false,
  },
};
