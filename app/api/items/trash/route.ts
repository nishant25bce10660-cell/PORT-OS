import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData, TrashedItem } from '@/lib/data';
import { findItemById, findParentFolder, removeItemFromTree } from '@/lib/tree';
import { validateHostAndOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const data = getPortfolioData();
    return NextResponse.json({ trash: data.trash || [] });
  } catch (err) {
    console.error('Error fetching trash:', err);
    return NextResponse.json({ error: 'Failed to fetch trash' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const data = getPortfolioData();
    const item = findItemById(data.root, itemId);
    if (!item) {
      return NextResponse.json({ error: 'Item not found in tree' }, { status: 404 });
    }

    const parent = findParentFolder(data.root, itemId);
    const removeResult = removeItemFromTree(data.root, itemId);
    data.root = removeResult.items;

    const trashedItem: TrashedItem = {
      id: item.id,
      item,
      originalParentId: parent ? parent.id : null,
      trashedAt: new Date().toISOString(),
    };

    if (!data.trash) {
      data.trash = [];
    }
    data.trash.push(trashedItem);
    savePortfolioData(data);

    return NextResponse.json({ success: true, trashedItem, root: data.root });
  } catch (err) {
    console.error('Error moving item to trash:', err);
    return NextResponse.json({ error: 'Failed to move item to trash' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const data = getPortfolioData();
    data.trash = [];
    savePortfolioData(data);
    return NextResponse.json({ success: true, message: 'Trash emptied' });
  } catch (err) {
    console.error('Error emptying trash:', err);
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 });
  }
}
