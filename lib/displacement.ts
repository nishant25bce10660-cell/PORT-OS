export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'icon' | 'widget';
}

export interface ExpansionZone {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export function getWidgetDimensions(
  type: string,
  sizeMode?: string,
  customW?: number,
  customH?: number
): { w: number; h: number } {
  if (type === 'custom' && customW && customH) {
    return { w: customW, h: customH };
  }
  const mode = sizeMode || 'standard';
  if (type === 'clock') {
    if (mode === 'compact') return { w: 260, h: 160 };
    if (mode === 'expanded') return { w: 380, h: 220 };
    return { w: 320, h: 180 };
  }
  if (type === 'analog-clock') {
    if (mode === 'compact') return { w: 180, h: 180 };
    if (mode === 'expanded') return { w: 260, h: 260 };
    return { w: 220, h: 220 };
  }
  if (type === 'calendar') {
    if (mode === 'compact') return { w: 240, h: 200 };
    if (mode === 'expanded') return { w: 340, h: 280 };
    return { w: 280, h: 240 };
  }
  if (type === 'countdown') {
    if (mode === 'compact') return { w: 220, h: 130 };
    if (mode === 'expanded') return { w: 320, h: 180 };
    return { w: 260, h: 150 };
  }
  if (type === 'note') {
    if (mode === 'compact') return { w: 220, h: 160 };
    if (mode === 'expanded') return { w: 300, h: 240 };
    return { w: 260, h: 200 };
  }
  if (type === 'todo') {
    if (mode === 'compact') return { w: 240, h: 180 };
    if (mode === 'expanded') return { w: 340, h: 280 };
    return { w: 280, h: 230 };
  }
  if (type === 'metric') {
    if (mode === 'compact') return { w: 200, h: 120 };
    if (mode === 'expanded') return { w: 300, h: 170 };
    return { w: 250, h: 140 };
  }
  if (type === 'quote') {
    if (mode === 'compact') return { w: 240, h: 130 };
    if (mode === 'expanded') return { w: 340, h: 190 };
    return { w: 280, h: 150 };
  }
  if (type === 'custom') {
    return { w: customW || 300, h: customH || 200 };
  }
  if (mode === 'compact') return { w: 280, h: 130 };
  if (mode === 'expanded') return { w: 360, h: 190 };
  return { w: 320, h: 160 };
}

export function computeExpansionZone(
  folderBase: { x: number; y: number },
  side: 'left' | 'right' = 'right'
): ExpansionZone {
  // Scaled folder (1.25x) + pill cluster (4 pills, 34px pitch) + bridge zone + 16px margin
  if (side === 'left') {
    return {
      xMin: folderBase.x - 16,
      xMax: folderBase.x + 280,
      yMin: folderBase.y - 48,
      yMax: folderBase.y + 144,
    };
  }
  return {
    xMin: folderBase.x - 204,
    xMax: folderBase.x + 96,
    yMin: folderBase.y - 48,
    yMax: folderBase.y + 144,
  };
}

export function computeDisplacements(
  activeFolderId: string,
  folderBase: { x: number; y: number },
  side: 'left' | 'right',
  items: Rect[],
  viewport: { width: number; height: number }
): Record<string, { x: number; y: number }> {
  const zone = computeExpansionZone(folderBase, side);
  const displacements: Record<string, { x: number; y: number }> = {};

  for (const it of items) {
    if (it.id === activeFolderId) {
      displacements[it.id] = { x: 0, y: 0 };
      continue;
    }

    // AABB intersection check with expansion zone
    const intersects = !(
      it.x + it.w < zone.xMin ||
      it.x > zone.xMax ||
      it.y + it.h < zone.yMin ||
      it.y > zone.yMax
    );

    if (!intersects) {
      displacements[it.id] = { x: 0, y: 0 };
      continue;
    }

    let dx = 0;
    let dy = 0;

    if (it.kind === 'icon') {
      // Displace along column axis away from active folder
      if (it.y >= folderBase.y) {
        dy = Math.min(140, Math.max(88, zone.yMax + 16 - it.y));
      } else {
        dy = Math.max(-140, Math.min(-88, zone.yMin - 16 - (it.y + it.h)));
      }
    } else {
      // Widget: attempt horizontal push only if it cleanly clears the zone and fits in viewport
      const isMobile = viewport.width < 500;
      let handled = false;

      if (!isMobile) {
        if (side === 'right') {
          const neededLeft = zone.xMin - 16 - (it.x + it.w);
          if (neededLeft < 0 && Math.abs(neededLeft) <= 140 && it.x + neededLeft >= 16) {
            dx = neededLeft;
            handled = true;
          }
        } else {
          const neededRight = zone.xMax + 16 - it.x;
          if (neededRight > 0 && neededRight <= 140 && it.x + it.w + neededRight <= viewport.width - 16) {
            dx = neededRight;
            handled = true;
          }
        }
      }

      if (!handled) {
        // Move vertically around the zone
        if (it.y + it.h / 2 >= (zone.yMin + zone.yMax) / 2) {
          dy = Math.min(140, Math.max(80, zone.yMax + 16 - it.y));
        } else {
          dy = Math.max(-140, Math.min(-80, zone.yMin - 16 - (it.y + it.h)));
        }
      }
    }

    displacements[it.id] = { x: dx, y: dy };
  }

  // Relaxation passes (up to 5) to resolve collision chains between displaced items
  const TOP_BOUND = 30;
  const BOTTOM_BOUND = viewport.height - 68;
  const LEFT_BOUND = 8;
  const RIGHT_BOUND = viewport.width - 8;

  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (a.id === activeFolderId) continue;
      const dispA = displacements[a.id] || { x: 0, y: 0 };
      const curAx = a.x + dispA.x;
      const curAy = a.y + dispA.y;

      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const b = items[j];
        if (b.id === activeFolderId) continue;
        const dispB = displacements[b.id] || { x: 0, y: 0 };
        const curBx = b.x + dispB.x;
        const curBy = b.y + dispB.y;

        // Check if displaced A overlaps B
        const overlapX = !(curAx + a.w + 12 < curBx || curAx > curBx + b.w + 12);
        const overlapY = !(curAy + a.h + 12 < curBy || curAy > curBy + b.h + 12);

        if (overlapX && overlapY) {
          if (Math.abs(dispA.y) > Math.abs(dispA.x)) {
            const pushDir = dispA.y >= 0 ? 1 : -1;
            const extra = pushDir > 0 ? curAy + a.h + 16 - curBy : curBy + b.h + 16 - curAy;
            if (extra > 0) {
              const newBy = Math.max(-140, Math.min(140, dispB.y + pushDir * extra));
              if (newBy !== dispB.y) {
                dispB.y = newBy;
                displacements[b.id] = dispB;
                changed = true;
              }
            }
          } else if (Math.abs(dispA.x) > 0) {
            const pushDir = dispA.x >= 0 ? 1 : -1;
            const extra = pushDir > 0 ? curAx + a.w + 16 - curBx : curBx + b.w + 16 - curAx;
            if (extra > 0) {
              const newBx = Math.max(-140, Math.min(140, dispB.x + pushDir * extra));
              if (newBx !== dispB.x) {
                dispB.x = newBx;
                displacements[b.id] = dispB;
                changed = true;
              }
            }
          }
        }
      }
    }
    if (!changed) break;
  }

  // Viewport clamping & maximum displacement cap
  for (const it of items) {
    if (it.id === activeFolderId) continue;
    const disp = displacements[it.id];
    if (!disp) continue;

    if (it.y + disp.y < TOP_BOUND) {
      disp.y = TOP_BOUND - it.y;
    } else if (it.y + disp.y + it.h > BOTTOM_BOUND) {
      disp.y = BOTTOM_BOUND - (it.y + it.h);
    }

    if (it.x + disp.x < LEFT_BOUND) {
      disp.x = LEFT_BOUND - it.x;
    } else if (it.x + disp.x + it.w > RIGHT_BOUND) {
      disp.x = RIGHT_BOUND - (it.x + it.w);
    }

    disp.x = Math.max(-140, Math.min(140, disp.x));
    disp.y = Math.max(-140, Math.min(140, disp.y));
  }

  return displacements;
}
