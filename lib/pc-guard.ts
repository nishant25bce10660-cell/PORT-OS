import path from 'path';
import fs from 'fs';
import { getPortfolioData } from './data';

// Safe allowlisted root directories
export const ALLOWED_ROOTS = [
  path.resolve(process.cwd()),
  path.resolve(process.cwd(), 'data'),
  path.resolve(process.cwd(), 'public'),
];

export function isShareModeActive(): boolean {
  if (process.env.PORT_OS_SHARE === '1' || process.env.PORT_OS_SHARE === 'true') {
    return true;
  }
  try {
    const data = getPortfolioData();
    if (data.settings?.security?.shareMode) {
      return true;
    }
  } catch {}
  return false;
}

export function validateSafePath(userPath: string | null | undefined): { safePath: string; rootDir: string } | null {
  if (!userPath || typeof userPath !== 'string') {
    return { safePath: ALLOWED_ROOTS[0], rootDir: ALLOWED_ROOTS[0] };
  }

  // 1. Block null byte injection
  if (userPath.includes('\0')) {
    return null;
  }

  // 2. Decode percent-encoded components and check for traversal
  let decoded = userPath;
  try {
    decoded = decodeURIComponent(userPath);
  } catch {
    return null;
  }

  if (decoded.includes('..') || userPath.includes('..') || userPath.toLowerCase().includes('%2e%2e')) {
    return null;
  }

  // 3. Prevent absolute Windows/POSIX path overrides outside allowlist
  // Check against each allowed root
  for (const root of ALLOWED_ROOTS) {
    const normalizedTarget = path.normalize(path.resolve(root, decoded));
    const normalizedRoot = path.normalize(root);

    if (normalizedTarget.startsWith(normalizedRoot)) {
      // Check realpath if path exists to prevent symlink escape
      if (fs.existsSync(normalizedTarget)) {
        try {
          const realTarget = fs.realpathSync(normalizedTarget);
          const realRoot = fs.realpathSync(normalizedRoot);
          if (realTarget.startsWith(realRoot)) {
            return { safePath: realTarget, rootDir: realRoot };
          }
        } catch {
          return null;
        }
      } else {
        return { safePath: normalizedTarget, rootDir: normalizedRoot };
      }
    }
  }

  return null;
}
