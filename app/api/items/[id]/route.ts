import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { updateItemInTree, removeItemFromTree } from '@/lib/tree';
import { validateHostAndOrigin } from '@/lib/security';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { id } = params;
    const body = await req.json();
    const current = getPortfolioData();

    const result = updateItemInTree(current.root, id, item => {
      if (item.kind === 'file') {
        return {
          ...item,
          name: body.name !== undefined ? body.name : item.name,
          content: body.content !== undefined ? body.content : item.content,
        };
      } else {
        return {
          ...item,
          name: body.name !== undefined ? body.name : item.name,
        };
      }
    });

    if (!result.updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    current.root = result.items;
    savePortfolioData(current);

    return NextResponse.json({ success: true, root: current.root });
  } catch (err) {
    console.error('Error updating item:', err);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { id } = params;
    const current = getPortfolioData();

    const result = removeItemFromTree(current.root, id);
    if (!result.removed) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    current.root = result.items;
    savePortfolioData(current);

    return NextResponse.json({ success: true, root: current.root });
  } catch (err) {
    console.error('Error deleting item:', err);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
