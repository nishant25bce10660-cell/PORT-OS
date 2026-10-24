import React from 'react';

export type PortOSIconKind =
  | 'finder'
  | 'terminal'
  | 'settings'
  | 'projects'
  | 'cert-education'
  | 'owners-data'
  | 'widgets'
  | 'about'
  | 'trash'
  | 'trash-full'
  | 'markdown'
  | 'code'
  | 'certificate'
  | 'image'
  | 'folder'
  | 'folder-projects'
  | 'folder-cert-edu'
  | 'folder-owner'
  | 'generic-file'
  | 'lock'
  | 'power';

export interface IconCategoryMeta {
  kind: PortOSIconKind;
  label: string;
  category: 'app' | 'file' | 'folder' | 'utility';
  bgGradient: [string, string];
  accent: string;
}

export const ICON_METADATA: Record<PortOSIconKind, IconCategoryMeta> = {
  finder: {
    kind: 'finder',
    label: 'Finder',
    category: 'app',
    bgGradient: ['#254a67', '#172b43'],
    accent: '#90d7f5',
  },
  terminal: {
    kind: 'terminal',
    label: 'Terminal',
    category: 'app',
    bgGradient: ['#252c3a', '#111722'],
    accent: '#a7e3c6',
  },
  settings: {
    kind: 'settings',
    label: 'System Settings',
    category: 'app',
    bgGradient: ['#424652', '#242732'],
    accent: '#d2d7e1',
  },
  projects: {
    kind: 'projects',
    label: 'Projects',
    category: 'app',
    bgGradient: ['#1e3a8a', '#172554'],
    accent: '#60a5fa',
  },
  'cert-education': {
    kind: 'cert-education',
    label: 'Certification & Education',
    category: 'app',
    bgGradient: ['#581c87', '#3b0764'],
    accent: '#c084fc',
  },
  'owners-data': {
    kind: 'owners-data',
    label: "Owner's Data",
    category: 'app',
    bgGradient: ['#065f46', '#022c22'],
    accent: '#34d399',
  },
  widgets: {
    kind: 'widgets',
    label: 'Widgets Manager',
    category: 'app',
    bgGradient: ['#3730a3', '#1e1b4b'],
    accent: '#818cf8',
  },
  about: {
    kind: 'about',
    label: 'About PORT OS',
    category: 'app',
    bgGradient: ['#334155', '#0f172a'],
    accent: '#94a3b8',
  },
  trash: {
    kind: 'trash',
    label: 'Trash',
    category: 'utility',
    bgGradient: ['#262e3d', '#131822'],
    accent: '#94a3b8',
  },
  'trash-full': {
    kind: 'trash-full',
    label: 'Trash (Full)',
    category: 'utility',
    bgGradient: ['#2a3342', '#141a24'],
    accent: '#cbd5e1',
  },
  markdown: {
    kind: 'markdown',
    label: 'Markdown Document',
    category: 'file',
    bgGradient: ['#263342', '#182331'],
    accent: '#79c8f2',
  },
  code: {
    kind: 'code',
    label: 'Source Code',
    category: 'file',
    bgGradient: ['#252b45', '#181d32'],
    accent: '#a5b4fc',
  },
  certificate: {
    kind: 'certificate',
    label: 'Certificate Document',
    category: 'file',
    bgGradient: ['#343126', '#211f19'],
    accent: '#e8c77a',
  },
  image: {
    kind: 'image',
    label: 'Image Document',
    category: 'file',
    bgGradient: ['#1e293b', '#0f172a'],
    accent: '#38bdf8',
  },
  folder: {
    kind: 'folder',
    label: 'Folder',
    category: 'folder',
    bgGradient: ['#24364a', '#172638'],
    accent: '#8fc8ef',
  },
  'folder-projects': {
    kind: 'folder-projects',
    label: 'Projects Folder',
    category: 'folder',
    bgGradient: ['#1e3a8a', '#172554'],
    accent: '#60a5fa',
  },
  'folder-cert-edu': {
    kind: 'folder-cert-edu',
    label: 'Certifications Folder',
    category: 'folder',
    bgGradient: ['#581c87', '#3b0764'],
    accent: '#c084fc',
  },
  'folder-owner': {
    kind: 'folder-owner',
    label: 'Owner Folder',
    category: 'folder',
    bgGradient: ['#065f46', '#022c22'],
    accent: '#34d399',
  },
  'generic-file': {
    kind: 'generic-file',
    label: 'Document',
    category: 'file',
    bgGradient: ['#29313b', '#191e27'],
    accent: '#b8c5d4',
  },
  lock: {
    kind: 'lock',
    label: 'Lock Screen',
    category: 'utility',
    bgGradient: ['#334155', '#1e293b'],
    accent: '#38bdf8',
  },
  power: {
    kind: 'power',
    label: 'Power',
    category: 'utility',
    bgGradient: ['#3f1d24', '#200e12'],
    accent: '#f87171',
  },
};

/**
 * Determine the semantic icon kind for a file item based on its name and extension
 */
export function getIconKindForFile(filename: string): PortOSIconKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return 'markdown';
  }
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.py') ||
    lower.endsWith('.go') ||
    lower.endsWith('.json') ||
    lower.endsWith('.css') ||
    lower.endsWith('.html') ||
    lower.endsWith('.sh') ||
    lower.endsWith('.sql')
  ) {
    return 'code';
  }
  if (lower.includes('cert') || lower.endsWith('.pdf')) {
    return 'certificate';
  }
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif')
  ) {
    return 'image';
  }
  return 'generic-file';
}

/**
 * Determine the semantic icon kind for a folder item
 */
export function getIconKindForFolder(folderId?: string, folderName?: string): PortOSIconKind {
  const idLower = (folderId || '').toLowerCase();
  const nameLower = (folderName || '').toLowerCase();

  if (idLower.includes('project') || nameLower.includes('project')) {
    return 'folder-projects';
  }
  if (idLower.includes('cert') || nameLower.includes('cert') || nameLower.includes('edu')) {
    return 'folder-cert-edu';
  }
  if (idLower.includes('owner') || nameLower.includes('owner') || nameLower.includes('profile')) {
    return 'folder-owner';
  }
  return 'folder';
}

/**
 * Determine the icon kind for an application or dock item
 */
export function getIconKindForApp(appId: string): PortOSIconKind {
  switch (appId) {
    case 'finder':
      return 'finder';
    case 'terminal':
      return 'terminal';
    case 'settings':
    case 'system-settings':
      return 'settings';
    case 'projects':
    case 'folder-projects':
      return 'projects';
    case 'certifications':
    case 'cert-education':
    case 'folder-cert-edu':
      return 'cert-education';
    case 'owner':
    case 'owners-data':
    case 'owner-profile':
      return 'owners-data';
    case 'widgets':
    case 'widgets-manager':
      return 'widgets';
    case 'about':
    case 'about-portos':
      return 'about';
    case 'trash':
      return 'trash';
    case 'lock':
      return 'lock';
    case 'power':
    case 'shutdown':
    case 'restart':
    case 'sleep':
      return 'power';
    default:
      return 'generic-file';
  }
}

/**
 * Original Vector SVG Artwork for all semantic kinds (Square 48x48 coordinate system)
 */
export function renderIconArtwork(kind: PortOSIconKind): React.ReactNode {
  switch (kind) {
    case 'finder':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Dual-tone File Organizer silhouette */}
          <rect x="4" y="8" width="40" height="32" rx="6" fill="#1e3a5f" />
          <path d="M4 14C4 10.6863 6.68629 8 10 8H20L24 13H38C41.3137 13 44 15.6863 44 19V34C44 37.3137 41.3137 40 38 40H10C6.68629 40 4 37.3137 4 34V14Z" fill="url(#finderGrad)" />
          {/* Central organizing seam & navigator glyph */}
          <line x1="24" y1="13" x2="24" y2="40" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          <rect x="9" y="21" width="10" height="12" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
          <rect x="29" y="21" width="10" height="12" rx="2" fill="rgba(255,255,255,0.2)" stroke="#90d7f5" strokeWidth="1.2" />
          <path d="M12 25H16M12 29H15" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M32 25H36M32 29H35" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="finderGrad" x1="4" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'terminal':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Console chassis */}
          <rect x="4" y="7" width="40" height="34" rx="7" fill="#0d1117" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
          {/* Top header bar */}
          <path d="M4 14H44" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          <circle cx="10" cy="10.5" r="2" fill="#ef4444" />
          <circle cx="16" cy="10.5" r="2" fill="#eab308" />
          <circle cx="22" cy="10.5" r="2" fill="#22c55e" />
          {/* Emerald command prompt chevron & cursor */}
          <path d="M12 21L20 27L12 33" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="24" y1="33" x2="34" y2="33" stroke="#f4f7fb" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'settings':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Gunmetal precision mechanical gear */}
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#242732" />
          <path
            d="M24 10V14M24 34V38M10 24H14M34 24H38M14.1 14.1L16.9 16.9M31.1 31.1L33.9 33.9M14.1 33.9L16.9 31.1M31.1 16.9L33.9 14.1"
            stroke="#d2d7e1"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="24" cy="24" r="10" fill="#374151" stroke="#e2e8f0" strokeWidth="2.5" />
          <circle cx="24" cy="24" r="4.5" fill="#1e222d" stroke="#94a3b8" strokeWidth="2" />
        </svg>
      );

    case 'projects':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Royal blue workspace folder / IDE canvas */}
          <rect x="4" y="7" width="40" height="34" rx="7" fill="#1e3a8a" />
          <path d="M4 16C4 12.6863 6.68629 10 10 10H38C41.3137 10 44 12.6863 44 16V34C44 37.3137 41.3137 40 38 40H10C6.68629 40 4 37.3137 4 34V16Z" fill="url(#projectsGrad)" />
          {/* Code syntax tags */}
          <path d="M18 21L12 27L18 33" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 21L36 27L30 33" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M26 19L22 35" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="projectsGrad" x1="24" y1="10" x2="24" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3b82f6" />
              <stop offset="1" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'cert-education':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Imperial violet credential badge */}
          <rect x="4" y="7" width="40" height="34" rx="7" fill="#4c1d95" />
          <path d="M4 16C4 12.6863 6.68629 10 10 10H38C41.3137 10 44 12.6863 44 16V34C44 37.3137 41.3137 40 38 40H10C6.68629 40 4 37.3137 4 34V16Z" fill="url(#certGrad)" />
          {/* Mortarboard silhouette & laurel ribbon */}
          <path d="M24 16L12 22L24 28L36 22L24 16Z" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 24V31C16 33.5 19.5 35 24 35C28.5 35 32 31 32 31V24" stroke="#e9d5ff" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="36" cy="24" r="1.8" fill="#fbbf24" />
          <line x1="36" y1="24" x2="36" y2="32" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
          <defs>
            <linearGradient id="certGrad" x1="24" y1="10" x2="24" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#6d28d9" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'owners-data':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Forest emerald executive profile mark */}
          <rect x="4" y="7" width="40" height="34" rx="7" fill="#064e3b" />
          <path d="M4 16C4 12.6863 6.68629 10 10 10H38C41.3137 10 44 12.6863 44 16V34C44 37.3137 41.3137 40 38 40H10C6.68629 40 4 37.3137 4 34V16Z" fill="url(#ownerGrad)" />
          <circle cx="24" cy="21" r="5.5" fill="#ffffff" />
          <path d="M14 34C14 29 18 27.5 24 27.5C30 27.5 34 29 34 34" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          <defs>
            <linearGradient id="ownerGrad" x1="24" y1="10" x2="24" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10b981" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'widgets':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Modular 2x2 widget layout */}
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#312e81" />
          <rect x="10" y="10" width="12" height="12" rx="3.5" fill="#818cf8" fillOpacity="0.95" />
          <rect x="26" y="10" width="12" height="12" rx="3.5" fill="rgba(255,255,255,0.45)" />
          <rect x="10" y="26" width="12" height="12" rx="3.5" fill="rgba(255,255,255,0.45)" />
          <rect x="26" y="26" width="12" height="12" rx="3.5" fill="#38bdf8" />
        </svg>
      );

    case 'about':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Platinum system information badge */}
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#1e293b" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <circle cx="24" cy="24" r="14" stroke="#94a3b8" strokeWidth="2.5" />
          <line x1="24" y1="21" x2="24" y2="31" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="16" r="1.8" fill="#38bdf8" />
        </svg>
      );

    case 'trash':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Empty chrome fluted waste container */}
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#1e2430" />
          <path d="M12 14H36" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M20 14V11C20 10.4477 20.4477 10 21 10H27C27.5523 10 28 10.4477 28 11V14" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 14L16 36C16 37.6569 17.3431 39 19 39H29C30.6569 39 32 37.6569 32 36L34 14" stroke="#94a3b8" strokeWidth="2.2" strokeLinejoin="round" />
          <line x1="20" y1="20" x2="20" y2="32" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="24" y1="20" x2="24" y2="32" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="28" y1="20" x2="28" y2="32" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'trash-full':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Trash container with contents */}
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#1e2430" />
          <path d="M18 11L24 7L30 11" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M12 14H36" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M14 14L16 36C16 37.6569 17.3431 39 19 39H29C30.6569 39 32 37.6569 32 36L34 14" stroke="#94a3b8" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="24" cy="18" r="3" fill="#cbd5e1" fillOpacity="0.5" />
          <line x1="20" y1="22" x2="20" y2="32" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="24" y1="22" x2="24" y2="32" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="28" y1="22" x2="28" y2="32" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'markdown':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Document base with folded corner */}
          <path d="M10 6C10 4.89543 10.8954 4 12 4H30L40 14V42C40 43.1046 39.1046 44 38 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1e293b" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
          <path d="M30 4V14H40" fill="#334155" />
          {/* Stylized MD Badge */}
          <rect x="13" y="23" width="22" height="15" rx="3.5" fill="#7C6CFF" fillOpacity="0.22" stroke="#8b5cf6" strokeWidth="1.6" />
          <path d="M17 33V27L20 30.5L23 27V33" stroke="#f5f7fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 27V33M28 33L25.5 30.5M28 33L30.5 30.5" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'code':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Source code document */}
          <path d="M10 6C10 4.89543 10.8954 4 12 4H30L40 14V42C40 43.1046 39.1046 44 38 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#0f172a" stroke="rgba(53, 208, 186, 0.4)" strokeWidth="1.5" />
          <path d="M30 4V14H40" fill="#1e293b" />
          {/* Developer brackets glyph */}
          <rect x="13" y="23" width="22" height="15" rx="3.5" fill="#0d9488" fillOpacity="0.22" stroke="#2dd4bf" strokeWidth="1.6" />
          <path d="M18 28L15 30.5L18 33" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 28L33 30.5L30 33" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="25" y1="26" x2="23" y2="35" stroke="#f4f7fb" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'certificate':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Certificate credential document */}
          <path d="M10 6C10 4.89543 10.8954 4 12 4H30L40 14V42C40 43.1046 39.1046 44 38 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1c1917" stroke="rgba(254, 240, 138, 0.35)" strokeWidth="1.5" />
          <path d="M30 4V14H40" fill="#292524" />
          {/* Gold rosette seal */}
          <circle cx="24" cy="27" r="7.5" fill="#ca8a04" fillOpacity="0.35" stroke="#fef08a" strokeWidth="1.5" />
          <path d="M24 22.5L25.8 26.2L29.8 26.8L26.9 29.6L27.6 33.5L24 31.6L20.4 33.5L21.1 29.6L18.2 26.8L22.2 26.2L24 22.5Z" fill="#fde047" />
          <path d="M21 33L19 39L23 37L25 39L24 33" fill="#ca8a04" />
        </svg>
      );

    case 'image':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 6C10 4.89543 10.8954 4 12 4H30L40 14V42C40 43.1046 39.1046 44 38 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1e293b" stroke="rgba(56, 189, 248, 0.35)" strokeWidth="1.5" />
          <path d="M30 4V14H40" fill="#334155" />
          <circle cx="18" cy="23" r="3" fill="#facc15" />
          <path d="M14 36L22 28L28 34L31 31L36 36H14Z" fill="#38bdf8" />
        </svg>
      );

    case 'generic-file':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Universal clean document silhouette */}
          <path d="M10 6C10 4.89543 10.8954 4 12 4H30L40 14V42C40 43.1046 39.1046 44 38 44H12C10.8954 44 10 43.1046 10 42V6Z" fill="#1e222d" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
          <path d="M30 4V14H40" fill="#2a303f" />
          <line x1="16" y1="23" x2="32" y2="23" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="16" y1="29" x2="32" y2="29" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="16" y1="35" x2="25" y2="35" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'folder':
    case 'folder-projects':
    case 'folder-cert-edu':
    case 'folder-owner': {
      const isProjects = kind === 'folder-projects';
      const isCert = kind === 'folder-cert-edu';
      const isOwner = kind === 'folder-owner';

      const backColor = isProjects ? '#1e40af' : isCert ? '#581c87' : isOwner ? '#065f46' : '#0284c7';
      const flapColor = isProjects ? '#3b82f6' : isCert ? '#8b5cf6' : isOwner ? '#10b981' : '#38bdf8';
      const gradId = `folderGrad_${kind}`;

      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Backplate tab */}
          <path
            d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z"
            fill={backColor}
          />
          {/* Front pocket flap */}
          <path
            d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z"
            fill={`url(#${gradId})`}
          />
          {/* Category-specific subtle foreground icon */}
          {isProjects && (
            <path d="M19 23L14 28L19 33M29 23L34 28L29 33M26 21L22 35" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {isCert && (
            <>
              <path d="M24 21L15 26L24 31L33 26L24 21Z" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
              <path d="M18 27.5V32.5C18 34.5 20.5 35.5 24 35.5C27.5 35.5 30 34.5 30 32.5V27.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            </>
          )}
          {isOwner && (
            <>
              <circle cx="24" cy="24" r="4.2" stroke="#ffffff" strokeWidth="2" />
              <path d="M17 34C17 31 20 29.5 24 29.5C28 29.5 31 31 31 34" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          <defs>
            <linearGradient id={gradId} x1="24" y1="13" x2="24" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor={flapColor} />
              <stop offset="1" stopColor={backColor} />
            </linearGradient>
          </defs>
        </svg>
      );
    }

    case 'lock':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#1e293b" />
          <rect x="14" y="20" width="20" height="16" rx="4" fill="#38bdf8" />
          <path d="M18 20V15C18 11.6863 20.6863 9 24 9C27.3137 9 30 11.6863 30 15V20" stroke="#f4f7fb" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="27" r="2" fill="#0f172a" />
          <line x1="24" y1="29" x2="24" y2="32" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'power':
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="40" height="40" rx="10" fill="#2d1217" />
          <path d="M18 16.5C14.5 19 12.5 23 12.5 27.5C12.5 33.8513 17.6487 39 24 39C30.3513 39 35.5 33.8513 35.5 27.5C35.5 23 33.5 19 30 16.5" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
          <line x1="24" y1="10" x2="24" y2="24" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="6" width="28" height="36" rx="4" fill="#1e222d" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="16" y1="16" x2="32" y2="16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="24" x2="32" y2="24" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
