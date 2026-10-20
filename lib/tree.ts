import { Item, FolderItem, FileItem } from './types';

export function findItemById(items: Item[], id: string): Item | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.kind === 'folder' && item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParentFolder(items: Item[], childId: string): FolderItem | null {
  for (const item of items) {
    if (item.kind === 'folder' && item.children) {
      if (item.children.some(c => c.id === childId)) {
        return item;
      }
      const found = findParentFolder(item.children, childId);
      if (found) return found;
    }
  }
  return null;
}

export function updateItemInTree(
  items: Item[],
  id: string,
  updater: (item: Item) => Item
): { updated: boolean; items: Item[] } {
  let updated = false;

  const nextItems = items.map(item => {
    if (item.id === id) {
      updated = true;
      return updater(item);
    }
    if (item.kind === 'folder' && item.children) {
      const res = updateItemInTree(item.children, id, updater);
      if (res.updated) {
        updated = true;
        return {
          ...item,
          children: res.items,
        };
      }
    }
    return item;
  });

  return { updated, items: nextItems };
}

export function removeItemFromTree(
  items: Item[],
  id: string
): { removed: boolean; items: Item[] } {
  let removed = false;

  const filtered = items.filter(item => {
    if (item.id === id) {
      removed = true;
      return false;
    }
    return true;
  });

  if (removed) {
    return { removed: true, items: filtered };
  }

  const nextItems = items.map(item => {
    if (item.kind === 'folder' && item.children) {
      const res = removeItemFromTree(item.children, id);
      if (res.removed) {
        removed = true;
        return {
          ...item,
          children: res.items,
        };
      }
    }
    return item;
  });

  return { removed, items: nextItems };
}

export function addItemToTree(
  items: Item[],
  parentId: string | null,
  newItem: Item
): { added: boolean; items: Item[] } {
  if (!parentId) {
    return { added: true, items: [...items, newItem] };
  }

  let added = false;
  const nextItems = items.map(item => {
    if (item.id === parentId && item.kind === 'folder') {
      added = true;
      return {
        ...item,
        children: [...(item.children || []), newItem],
      };
    }
    if (item.kind === 'folder' && item.children) {
      const res = addItemToTree(item.children, parentId, newItem);
      if (res.added) {
        added = true;
        return {
          ...item,
          children: res.items,
        };
      }
    }
    return item;
  });

  return { added, items: nextItems };
}
