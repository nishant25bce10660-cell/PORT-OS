import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioData, savePortfolioData } from '@/lib/data';
import { addItemToTree, findItemById } from '@/lib/tree';
import { validateHostAndOrigin, requireRole } from '@/lib/security';

export async function POST(req: NextRequest) {
  const secError = validateHostAndOrigin(req);
  if (secError) return secError;

  const { errorResponse } = requireRole(['admin']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const data = getPortfolioData();
    const trashedIndex = (data.trash || []).findIndex((t) => t.id === itemId);
    if (trashedIndex === -1) {
      return NextResponse.json({ error: 'Item not found in trash' }, { status: 404 });
    }

    const [trashed] = data.trash.splice(trashedIndex, 1);
    const targetParentId = trashed.originalParentId;

    // Check if original parent exists, else restore to root
    const parentExists = targetParentId ? !!findItemById(data.root, targetParentId) : false;
    const parentIdToUse = parentExists ? targetParentId : null;

    const addResult = addItemToTree(data.root, parentIdToUse, trashed.item);
    data.root = addResult.items;

    savePortfolioData(data);

    return NextResponse.json({
      success: true,
      restoredItem: trashed.item,
      trash: data.trash,
      root: data.root,
    });
  } catch (err) {
    console.error('Error restoring item from trash:', err);
    return NextResponse.json({ error: 'Failed to restore item from trash' }, { status: 500 });
  }
}
