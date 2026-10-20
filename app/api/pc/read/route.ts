import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';
import { validateSafePath, isShareModeActive } from '@/lib/pc-guard';
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
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    return NextResponse.json({ error: 'Path is a directory, not a file' }, { status: 400 });
  }

  try {
    const ext = path.extname(targetPath).toLowerCase();
    const isText = ['.md', '.txt', '.json', '.js', '.ts', '.css', '.html', '.svg'].includes(ext);

    if (isText) {
      const content = fs.readFileSync(targetPath, 'utf-8');
      return NextResponse.json({
        name: path.basename(targetPath),
        content,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    } else {
      const buffer = fs.readFileSync(targetPath);
      const base64 = buffer.toString('base64');
      return NextResponse.json({
        name: path.basename(targetPath),
        base64,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  } catch (err) {
    console.error('Error reading PC file:', err);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
