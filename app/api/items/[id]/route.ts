import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { updateItemInTree, removeItemInTree, moveItemInTree } from '@/lib/tree';
import { validateHostAndOrigin, requireRole } from '@/lib/security';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

  try {
    const { id } = params;
    const body = await req.json();
    const current = getPortfolioData();

    // Support moving item to a different parent (e.g. 'root' for desktop placement)
    if (body.parentId !== undefined) {
      const targetParent = body.parentId === 'root' ? null : body.parentId;
      const moveRes = moveItemInTree(current.root, id, targetParent);
      if (moveRes.moved) {
        current.root = moveRes.items;
      }
    }

    if (body.name !== undefined || body.content !== undefined) {
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

      if (result.updated) {
        current.root = result.items;
      }
    }

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

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

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
