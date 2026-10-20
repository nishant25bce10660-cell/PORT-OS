import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';
import { validateSafePath, isShareModeActive, ALLOWED_ROOTS } from '@/lib/pc-guard';
import { validateHostAndOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  if (isShareModeActive()) {
    return NextResponse.json(
      { error: 'Forbidden: PC Bridge is disabled in Portfolio Share mode' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const requestedPath = searchParams.get('path');

  const validated = validateSafePath(requestedPath);
  if (!validated) {
    return NextResponse.json(
      { error: 'Access denied: Path is outside allowlisted directories or contains illegal traversal' },
      { status: 403 }
    );
  }

  const targetPath = validated.safePath;

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ error: 'Path not found' }, { status: 404 });
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
  }

  try {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => {
        const itemFullPath = path.join(targetPath, e.name);
        let size = 0;
        let mtime = new Date().toISOString();
        try {
          const s = fs.statSync(itemFullPath);
          size = s.size;
          mtime = s.mtime.toISOString();
        } catch {}

        return {
          name: e.name,
          path: path.relative(validated.rootDir, itemFullPath),
          fullPath: itemFullPath,
          isDirectory: e.isDirectory(),
          size,
          updatedAt: mtime,
        };
      });

    return NextResponse.json({
      currentPath: path.relative(validated.rootDir, targetPath) || '/',
      roots: ALLOWED_ROOTS.map((r) => path.basename(r)),
      items,
    });
  } catch (err) {
    console.error('Error reading directory:', err);
    return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
  }
}
