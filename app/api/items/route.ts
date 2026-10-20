import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData, Item } from '@/lib/data';
import { addItemToTree } from '@/lib/tree';
import { validateHostAndOrigin } from '@/lib/security';

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const session = getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { parentId, item } = body as { parentId?: string | null; item: Item };

    if (!item || !item.name || !item.kind) {
      return NextResponse.json({ error: 'Valid item name and kind are required' }, { status: 400 });
    }

    const current = getPortfolioData();
    const res = addItemToTree(current.root, parentId || null, item);
    current.root = res.items;
    savePortfolioData(current);

    return NextResponse.json({ success: true, item, root: current.root }, { status: 201 });
  } catch (err) {
    console.error('Error adding item:', err);
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}
