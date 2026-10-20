import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData, FileItem } from '@/lib/data';
import { addItemToTree } from '@/lib/tree';
import { validateHostAndOrigin } from '@/lib/security';

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { targetFolderId, fileName, content, base64 } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const cleanFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newItem: FileItem = {
      id: fileId,
      name: cleanFileName,
      kind: 'file',
      content: content || (base64 ? `data:image/png;base64,${base64}` : ''),
      size: content ? Buffer.byteLength(content, 'utf-8') : (base64 ? Math.floor(base64.length * 0.75) : 0),
      updatedAt: new Date().toISOString(),
    };

    const data = getPortfolioData();
    const result = addItemToTree(data.root, targetFolderId || 'folder-projects', newItem);
    data.root = result.items;
    savePortfolioData(data);

    return NextResponse.json({
      success: true,
      item: newItem,
      root: data.root,
    }, { status: 201 });
  } catch (err) {
    console.error('Error importing file:', err);
    return NextResponse.json({ error: 'Failed to import file' }, { status: 500 });
  }
}
