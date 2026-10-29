'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Widget, WidgetType, ClockConfig, DEFAULT_CLOCK_CONFIG } from '@/lib/types';
import { renderCustomWidgetBlocks } from './WidgetStudio';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';
import SpringCheck from './SpringCheck';

interface WidgetsProps {
  widgets: Widget[];
  canEdit?: boolean;
  isAdmin?: boolean;
  clockConfig?: ClockConfig;
  onUpdateWidgetPosition: (id: string, x: number, y: number) => void;
  onUpdateWidgetText: (id: string, text: string) => void;
  onUpdateWidgetConfig?: (id: string, patch: Partial<Widget>) => void;
  onDeleteWidget: (id: string) => void;
  onAddWidget?: (type: WidgetType) => void;
  onEditCustomWidget?: (widget: Widget) => void;
  onContextMenuWidget?: (e: React.MouseEvent, widget: Widget) => void;
  totalFiles: number;
  totalProjects: number;
  widgetDisplacements?: Record<string, { x: number; y: number }>;
  expansionProgress?: number;
  desktopSide?: 'left' | 'right';
}

// 1. Quick Note Editor with 280-char counter and debounced autosave
function NoteEditor({
  widgetId,
  initialText,
  canEdit,
  onSave,
}: {
  widgetId: string;
  initialText: string;
  canEdit: boolean;
  onSave: (id: string, text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: '13px', color: 'var(--tx-1)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text || 'No note written yet.'}
        </p>
      </div>
    );
  }

  const handleChange = (newVal: string) => {
    if (newVal.length > 280) return;
    setText(newVal);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave(widgetId, newVal);
    }, 280);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSave(widgetId, text);
  };

  const isLimit = text.length >= 270;
  const isWarning = text.length >= 240 && !isLimit;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <textarea
        id={`widget-note-input-${widgetId}`}
        value={text}
        maxLength={280}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        rows={4}
        placeholder="Type a quick note..."
        style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          color: '#f5f7fa',
          fontSize: '12px',
          lineHeight: '1.45',
          padding: '8px 10px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'var(--font-inter), sans-serif',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
        }}
      />
      <div className={`note-char-counter ${isLimit ? 'is-limit' : isWarning ? 'is-warning' : ''}`}>
        {text.length} / 280
      </div>
    </div>
  );
}

// 2. Interactive To-Do Widget Content with SpringCheck physics
function TodoWidgetContent({
  widget,
  canEdit = true,
  onUpdateWidgetConfig,
}: {
  widget: Widget;
  canEdit?: boolean;
  onUpdateWidgetConfig?: (id: string, patch: Partial<Widget>) => void;
}) {
  const [newText, setNewText] = useState('');
  const parseItems = useCallback(() => {
    const rawList = widget.config?.items || widget.config?.todos || [
      { id: '1', text: 'Refactor widget catalog', done: true },
      { id: '2', text: 'Apple-inspired effects test', done: true },
      { id: '3', text: 'End-to-end Trash validation', done: false },
    ];
    return rawList.map((it: any) => ({
      id: String(it.id || it.text),
      text: String(it.text || it.title || 'Untitled task'),
      done: Boolean(it.done !== undefined ? it.done : it.completed),
    }));
  }, [widget.config?.items, widget.config?.todos]);

  const [items, setItems] = useState(parseItems);

  useEffect(() => {
    setItems(parseItems());
  }, [parseItems]);

  const toggleItem = (itemId: string, nextChecked: boolean) => {
    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, done: nextChecked, completed: nextChecked } : it
    );
    setItems(nextItems);
    onUpdateWidgetConfig?.(widget.id, {
      config: {
        ...widget.config,
        items: nextItems,
        todos: nextItems,
      },
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    const newItem = {
      id: `todo-${Date.now()}`,
      text: newText.trim(),
      done: false,
      completed: false,
    };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    onUpdateWidgetConfig?.(widget.id, {
      config: {
        ...widget.config,
        items: nextItems,
        todos: nextItems,
      },
    });
    setNewText('');
  };

  const handleRemoveItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextItems = items.filter((it) => it.id !== itemId);
    setItems(nextItems);
    onUpdateWidgetConfig?.(widget.id, {
      config: {
        ...widget.config,
        items: nextItems,
        todos: nextItems,
      },
    });
  };

  const completedCount = items.filter((i) => i.done).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>☑️</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#34d399' }}>{widget.title || 'Tasks'}</span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--tx-3)', fontWeight: 500 }}>
          {completedCount}/{items.length} done
        </span>
      </div>

      <div
        className="custom-scrollbar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          maxHeight: '140px',
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        {items.map((it) => (
          <div
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '1px 4px',
              borderRadius: '6px',
              background: it.done ? 'rgba(52, 211, 153, 0.04)' : 'rgba(255,255,255,0.02)',
              transition: 'background 0.15s ease',
            }}
          >
            <SpringCheck
              label={it.text}
              checked={it.done}
              disabled={!canEdit}
              onChange={(checked) => toggleItem(it.id, checked)}
              color="#f8fafc"
              fillColor="#34d399"
              checkColor="#052e16"
              boxSize={18}
              boxRadius={5}
              fontSize={12}
              rowHeight={26}
              bounce={0.2}
              strikeLag={0.12}
              doneOpacity={0.42}
              strike="left"
            />
            {canEdit && (
              <button
                type="button"
                onClick={(e) => handleRemoveItem(it.id, e)}
                title="Delete task"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  transition: 'color 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '4px', marginTop: 'auto', paddingTop: '4px' }}>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add task..."
            maxLength={60}
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '11px',
              padding: '4px 8px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!newText.trim()}
            style={{
              background: newText.trim() ? '#34d399' : 'rgba(255,255,255,0.08)',
              color: newText.trim() ? '#0a0e17' : 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: newText.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
          >
            +
          </button>
        </form>
      )}
    </div>
  );
}

export const MENUBAR_INSET = 32;
export const DOCK_INSET = 72;
export const DESKTOP_MARGIN = 8;

export function clampWidgetPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportW: number,
  viewportH: number
): { x: number; y: number } {
  const minX = DESKTOP_MARGIN;
  const maxX = Math.max(minX, viewportW - width - DESKTOP_MARGIN);
  const minY = MENUBAR_INSET;
  const maxY = Math.max(minY, viewportH - height - DOCK_INSET);

  const clampedX = Math.round(Math.max(minX, Math.min(x, maxX)) / 16) * 16;
  const clampedY = Math.round(Math.max(minY, Math.min(y, maxY)) / 16) * 16;
  return { x: clampedX, y: clampedY };
}

export interface WidgetControlsProps {
  widget: Widget;
  width: number;
  height: number;
  canEdit: boolean;
  onDelete: (id: string) => void;
  onEdit: (widget: Widget) => void;
}

export function WidgetControls({
  widget,
  width,
  height,
  canEdit,
  onDelete,
  onEdit,
}: WidgetControlsProps) {
  if (!canEdit) return null;

  // Viewport clamping & corner flipping
  const isNearTop = widget.y < 32;
  const isNearLeft = widget.x < 16;
  const isNearRight = typeof window !== 'undefined' ? widget.x + width > window.innerWidth - 16 : false;

  const overlayClasses = [
    'widget-controls-overlay',
    isNearTop ? 'flip-top' : '',
    isNearLeft ? 'flip-left' : '',
    isNearRight ? 'flip-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={overlayClasses}>
      <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
        <div className="widget-remove-handle-box">
          <WarmTooltip content="Remove widget" side={isNearTop ? 'bottom' : 'top'}>
            <button
              type="button"
              className="widget-handle widget-remove-handle"
              id={`btn-delete-widget-${widget.id}`}
              data-action="remove"
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(widget.id);
              }}
              aria-label="Remove widget"
            >
              ✕
            </button>
          </WarmTooltip>
        </div>
        <div className="widget-edit-handle-box">
          <WarmTooltip
            content={widget.type === 'custom' ? 'Edit in Widget Studio' : 'Edit label'}
            side={isNearTop ? 'bottom' : 'top'}
          >
            <button
              type="button"
              className="widget-handle widget-edit-handle"
              id={`btn-edit-widget-${widget.id}`}
              data-action="edit"
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(widget);
              }}
              aria-label="Edit widget"
            >
              ✎
            </button>
          </WarmTooltip>
        </div>
      </WarmTooltipGroup>
    </div>
  );
}

export default function Widgets({
  widgets,
  canEdit = true,
  isAdmin = false,
  clockConfig = DEFAULT_CLOCK_CONFIG,
  onUpdateWidgetPosition,
  onUpdateWidgetText,
  onUpdateWidgetConfig,
  onDeleteWidget,
  onAddWidget,
  onEditCustomWidget,
  onContextMenuWidget,
  totalFiles,
  totalProjects,
  widgetDisplacements,
  expansionProgress,
  desktopSide = 'right',
}: WidgetsProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [touchActiveId, setTouchActiveId] = useState<string | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Viewport tracking for centralized geometry & responsive boundary clamping
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTouchWidget = (widgetId: string) => {
    setTouchActiveId(widgetId);
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setTouchActiveId(null);
    }, 3500);
  };

  // Live ticking clock (seconds tick without triggering layout or collision logic)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dragging state with 16px snap grid and Pointer Capture
  const dragRef = useRef<{
    id: string;
    pointerStartX: number;
    pointerStartY: number;
    origX: number;
    origY: number;
    currentX: number;
    currentY: number;
    hasMoved: boolean;
    targetEl: HTMLElement | null;
  } | null>(null);

  // Helper to determine dimensions based on type and sizeMode
  const getWidgetDimensions = useCallback(
    (type: string, sizeMode?: string, customW?: number, customH?: number) => {
      if (type === 'custom' && customW && customH) {
        return { w: customW, h: customH };
      }
      const mode = sizeMode || (type === 'clock' ? clockConfig.sizeMode : 'standard');
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
      // stats / counter
      if (mode === 'compact') return { w: 280, h: 130 };
      if (mode === 'expanded') return { w: 360, h: 190 };
      return { w: 320, h: 160 };
    },
    [clockConfig.sizeMode]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (e.button !== 0) return; // Only main click drags
    if ((e.target as HTMLElement).closest('.widget-handle, .widget-remove-handle-box, .widget-edit-handle-box, textarea, input, button')) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const el = document.getElementById(`widget-${widget.id}`);
    dragRef.current = {
      id: widget.id,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      origX: widget.x,
      origY: widget.y,
      currentX: widget.x,
      currentY: widget.y,
      hasMoved: false,
      targetEl: el,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.pointerStartX;
    const dy = e.clientY - dragRef.current.pointerStartY;

    if (!dragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragRef.current.hasMoved = true;
    }

    if (dragRef.current.hasMoved) {
      const rawX = dragRef.current.origX + dx;
      const rawY = dragRef.current.origY + dy;

      const currentWidget = widgets.find((w) => w.id === dragRef.current?.id);
      const dims = currentWidget
        ? getWidgetDimensions(currentWidget.type, currentWidget.sizeMode, currentWidget.customWidth, currentWidget.customHeight)
        : { w: 300, h: 180 };

      // Centralized boundary clamping & 16px grid snap
      const { x: clampedX, y: clampedY } = clampWidgetPosition(
        rawX,
        rawY,
        dims.w,
        dims.h,
        window.innerWidth,
        window.innerHeight
      );

      dragRef.current.currentX = clampedX;
      dragRef.current.currentY = clampedY;

      if (dragRef.current.targetEl) {
        dragRef.current.targetEl.style.left = `${clampedX}px`;
        dragRef.current.targetEl.style.top = `${clampedY}px`;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { id, currentX, currentY, hasMoved } = dragRef.current;
    dragRef.current = null;

    if (!hasMoved) return;

    // Collision detection & resolution only after drag ends
    const currentWidget = widgets.find((w) => w.id === id);
    const dimA = currentWidget
      ? getWidgetDimensions(currentWidget.type, currentWidget.sizeMode, currentWidget.customWidth, currentWidget.customHeight)
      : { w: 300, h: 180 };

    let { x: resolvedX, y: resolvedY } = clampWidgetPosition(
      currentX,
      currentY,
      dimA.w,
      dimA.h,
      window.innerWidth,
      window.innerHeight
    );

    if (currentWidget) {
      // Check collision with all other widgets
      for (const other of widgets) {
        if (other.id === id) continue;
        const dimB = getWidgetDimensions(other.type, other.sizeMode, other.customWidth, other.customHeight);

        const overlaps = !(
          resolvedX + dimA.w <= other.x ||
          resolvedX >= other.x + dimB.w ||
          resolvedY + dimA.h <= other.y ||
          resolvedY >= other.y + dimB.h
        );

        if (overlaps) {
          const candidateY = Math.round((other.y + dimB.h + 16) / 16) * 16;
          if (candidateY + dimA.h <= window.innerHeight - DOCK_INSET) {
            resolvedY = candidateY;
          } else {
            const candidateX = Math.round((other.x + dimB.w + 16) / 16) * 16;
            if (candidateX + dimA.w <= window.innerWidth - DESKTOP_MARGIN) {
              resolvedX = candidateX;
            }
          }
        }
      }
    }

    const finalPos = clampWidgetPosition(
      resolvedX,
      resolvedY,
      dimA.w,
      dimA.h,
      window.innerWidth,
      window.innerHeight
    );

    onUpdateWidgetPosition(id, finalPos.x, finalPos.y);
  };

  // Time string formatting according to ClockConfig
  const is24h = clockConfig.is24Hour ?? (clockConfig.timeFormat === '24h');
  const hoursStr = is24h
    ? currentTime.getHours().toString().padStart(2, '0')
    : (currentTime.getHours() % 12 || 12).toString().padStart(2, '0');
  const minsStr = currentTime.getMinutes().toString().padStart(2, '0');
  const secsStr = currentTime.getSeconds().toString().padStart(2, '0');

  // Clock typography size
  const digitFontSize =
    clockConfig.digitSize === 'small' || (typeof clockConfig.digitSize === 'number' && clockConfig.digitSize <= 36)
      ? '32px'
      : clockConfig.digitSize === 'large' || (typeof clockConfig.digitSize === 'number' && clockConfig.digitSize >= 96)
      ? '96px'
      : '88px';

  const hoursColor = clockConfig.hoursColor || clockConfig.digitColorHours || '#38bdf8';
  const colonColor = clockConfig.colonColor || clockConfig.digitColorColon || '#35d0ba';
  const minutesColor = clockConfig.minutesColor || clockConfig.digitColorMinutes || '#ffffff';
  const secondsColor = clockConfig.secondsColor || clockConfig.digitColorSeconds || '#7c6cff';
  const glow = clockConfig.glowIntensity ?? (clockConfig.showGlow ? 0.6 : 0);
  const fontWeight = clockConfig.fontWeight || '700';

  return (
    <>
      {/* Render Desktop Widgets */}
      {widgets.map((widget, idx) => {
        const dims = getWidgetDimensions(widget.type, widget.sizeMode, widget.customWidth, widget.customHeight);
        const app = widget.appearance;
        const { x: posX, y: posY } = clampWidgetPosition(
          widget.x,
          widget.y,
          dims.w,
          dims.h,
          viewport.width,
          viewport.height
        );

        // Reserved folder zone: 0 to 280 on left, (viewport.width - 240) to viewport.width on right
        let effectiveX = posX;
        let effectiveY = posY;
        if (viewport.width < 500) {
          // On mobile, horizontal space cannot fit 320px widget alongside folder column.
          // Place widgets vertically below the folder column (Y >= 392).
          if (effectiveY < 392) {
            effectiveY = 392 + idx * 16;
          }
          effectiveX = Math.max(16, Math.min(posX, viewport.width - dims.w - 16));
        } else {
          if (desktopSide === 'left') {
            if (effectiveX < 280) effectiveX = 290;
          } else {
            if (effectiveX + dims.w > viewport.width - 240) {
              effectiveX = Math.max(16, viewport.width - 240 - dims.w - 12);
            }
          }
        }

        const disp = widgetDisplacements?.[widget.id] || { x: 0, y: 0 };
        const progress = expansionProgress || 0;
        const pushX = disp.x * progress;
        const pushY = disp.y * progress;
        const isDisplaced = Math.abs(pushX) > 0.5 || Math.abs(pushY) > 0.5;

        return (
          <div
            key={widget.id}
            id={`widget-${widget.id}`}
            className={`desktop-widget widget-push-layer ${widget.type === 'clock' ? 'widget-clock-glow' : ''} desktop-widget-editable ${touchActiveId === widget.id ? 'is-touch-active' : ''}`}
            tabIndex={0}
            onTouchStart={() => handleTouchWidget(widget.id)}
            onPointerDown={(e) => handlePointerDown(e, widget)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenuWidget?.(e, widget);
            }}
            style={{
              position: 'absolute',
              top: `${effectiveY}px`,
              left: `${effectiveX}px`,
              width: `${dims.w}px`,
              minHeight: `${dims.h}px`,
              transform: `translate3d(var(--push-x, ${pushX.toFixed(2)}px), var(--push-y, ${pushY.toFixed(2)}px), 0)`,
              ['--push-x' as any]: `${pushX.toFixed(2)}px`,
              ['--push-y' as any]: `${pushY.toFixed(2)}px`,
              pointerEvents: isDisplaced && progress > 0.05 ? 'none' : 'auto',
              transition: dragRef.current?.id === widget.id ? 'none' : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
              backgroundColor: app?.bgColor
                ? `${app.bgColor}${Math.round((app.bgOpacity ?? 0.8) * 255).toString(16).padStart(2, '0')}`
                : undefined,
              borderRadius: app?.borderRadius ? `${app.borderRadius}px` : undefined,
              borderColor: app?.borderColor || undefined,
              color: app?.textColor || undefined,
              boxShadow:
                widget.type === 'clock' && glow > 0
                  ? `0 12px 35px rgba(0,0,0,0.5), 0 0 ${Math.round(glow * 28)}px ${hoursColor}40`
                  : app?.effect === 'glow'
                  ? '0 12px 30px rgba(0,0,0,0.5), 0 0 25px rgba(56, 189, 248, 0.35)'
                  : undefined,
            }}
          >
            {/* Shared WidgetControls component */}
            <WidgetControls
              widget={widget}
              width={dims.w}
              height={dims.h}
              canEdit={canEdit}
              onDelete={onDeleteWidget}
              onEdit={(w) => {
                if (w.type === 'custom') {
                  onEditCustomWidget?.(w);
                } else {
                  setEditingWidgetId(editingWidgetId === w.id ? null : w.id);
                }
              }}
            />

            {/* 1. CLOCK WIDGET */}
            {widget.type === 'clock' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {editingWidgetId === widget.id ? (
                  <input
                    type="text"
                    autoFocus
                    defaultValue={widget.text || clockConfig.locationLabel}
                    onBlur={(e) => {
                      onUpdateWidgetText(widget.id, e.target.value.trim() || 'San Francisco, CA');
                      setEditingWidgetId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdateWidgetText(widget.id, (e.target as HTMLInputElement).value.trim() || 'San Francisco, CA');
                        setEditingWidgetId(null);
                      }
                    }}
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                      padding: '2px 6px',
                      textAlign: 'center',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--tx-3)',
                      fontWeight: 600,
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                    onDoubleClick={() => setEditingWidgetId(widget.id)}
                    aria-label={canEdit ? 'Double-click to edit location label' : undefined}
                  >
                    {widget.text || clockConfig.locationLabel || 'SAN FRANCISCO, CA'}
                  </span>
                )}

                {/* Highly customizable clock display */}
                <div
                  className="widget-clock-display"
                  style={{
                    marginTop: '4px',
                    fontSize: digitFontSize,
                    fontFamily: clockConfig.fontFamily
                      ? `"${clockConfig.fontFamily}", var(--font-mono), monospace`
                      : 'var(--font-mono), monospace',
                    fontWeight: fontWeight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                  }}
                >
                  <span style={{ color: clockConfig.digitColorH1 || hoursColor }}>{hoursStr[0]}</span>
                  <span style={{ color: clockConfig.digitColorH2 || hoursColor }}>{hoursStr[1]}</span>
                  <span
                    className="clock-seconds-dot"
                    style={{ backgroundColor: clockConfig.colonColor1 || colonColor, boxShadow: `0 0 10px ${clockConfig.colonColor1 || colonColor}` }}
                  />
                  <span style={{ color: clockConfig.digitColorM1 || minutesColor }}>{minsStr[0]}</span>
                  <span style={{ color: clockConfig.digitColorM2 || minutesColor }}>{minsStr[1]}</span>
                  {clockConfig.showSeconds && (
                    <>
                      <span
                        className="clock-seconds-dot"
                        style={{
                          backgroundColor: clockConfig.colonColor2 || secondsColor,
                          width: '5px',
                          height: '5px',
                          margin: '0 4px',
                          boxShadow: `0 0 6px ${clockConfig.colonColor2 || secondsColor}`,
                        }}
                      />
                      <span style={{ color: clockConfig.digitColorS1 || secondsColor, fontSize: '0.6em' }}>{secsStr[0]}</span>
                      <span style={{ color: clockConfig.digitColorS2 || secondsColor, fontSize: '0.6em' }}>{secsStr[1]}</span>
                    </>
                  )}
                </div>

                {clockConfig.showDate && (
                  <div className="widget-date-label">
                    {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
            )}

            {/* 2. QUICK NOTE WIDGET */}
            {widget.type === 'note' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px' }}>📌</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24' }}>Quick Note</span>
                  </div>
                </div>
                <NoteEditor
                  widgetId={widget.id}
                  initialText={widget.text || ''}
                  canEdit={canEdit}
                  onSave={onUpdateWidgetText}
                />
              </div>
            )}

            {/* 3. PORTFOLIO STATS WIDGET */}
            {widget.type === 'counter' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx-3)', fontWeight: 600 }}>
                    Portfolio Stats
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--accent-2, #35d0ba)', fontWeight: 600 }}>● Live</span>
                </div>

                <div className="widget-stats-grid">
                  <div className="widget-stat-card widget-stat-pill">
                    <span className="stat-label">Projects</span>
                    <span className="stat-value">{totalProjects || 4}</span>
                    <div className="stat-sparkline">
                      <div className="sparkline-fill" style={{ width: '75%' }} />
                    </div>
                  </div>

                  <div className="widget-stat-card widget-stat-pill">
                    <span className="stat-label">Certifications</span>
                    <span className="stat-value">4</span>
                    <div className="stat-sparkline">
                      <div className="sparkline-fill" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="widget-stat-card widget-stat-pill">
                    <span className="stat-label">Experience</span>
                    <span className="stat-value">5+ Yrs</span>
                    <div className="stat-sparkline">
                      <div className="sparkline-fill" style={{ width: '85%' }} />
                    </div>
                  </div>
                </div>

                <div className="widget-stat-footer">
                  <span className="stat-footer-item">Vault assets · {totalFiles || 10}</span>
                  <span className="stat-footer-item">Sync · Local vault</span>
                </div>
              </div>
            )}

            {/* 4. ANALOG CLOCK WIDGET */}
            {widget.type === 'analog-clock' && (() => {
              const sec = currentTime.getSeconds();
              const min = currentTime.getMinutes();
              const hr = currentTime.getHours() % 12;
              const secDeg = sec * 6;
              const minDeg = min * 6 + sec * 0.1;
              const hrDeg = hr * 30 + min * 0.5;

              return (
                <div className="analog-clock-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <svg width="150" height="150" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="76" fill="#141822" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    {/* Hour ticks */}
                    {Array.from({ length: 12 }).map((_, i) => {
                      const angle = (i * 30 * Math.PI) / 180;
                      const x1 = 80 + 64 * Math.sin(angle);
                      const y1 = 80 - 64 * Math.cos(angle);
                      const x2 = 80 + 72 * Math.sin(angle);
                      const y2 = 80 - 72 * Math.cos(angle);
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={i % 3 === 0 ? '#38bdf8' : 'rgba(255,255,255,0.35)'}
                          strokeWidth={i % 3 === 0 ? 3 : 1.5}
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {/* Hour Hand */}
                    <line
                      x1="80"
                      y1="80"
                      x2="80"
                      y2="42"
                      stroke="#f8fafc"
                      strokeWidth="4"
                      strokeLinecap="round"
                      transform={`rotate(${hrDeg} 80 80)`}
                    />
                    {/* Minute Hand */}
                    <line
                      x1="80"
                      y1="80"
                      x2="80"
                      y2="24"
                      stroke="#cbd5e1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      transform={`rotate(${minDeg} 80 80)`}
                    />
                    {/* Second Hand */}
                    <line
                      x1="80"
                      y1="94"
                      x2="80"
                      y2="20"
                      stroke="#ff6b4a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      transform={`rotate(${secDeg} 80 80)`}
                    />
                    {/* Center cap */}
                    <circle cx="80" cy="80" r="4" fill="#ff6b4a" />
                  </svg>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx-3)', marginTop: '4px' }}>
                    {widget.text || 'PORT OS'}
                  </span>
                </div>
              );
            })()}

            {/* 5. CALENDAR WIDGET */}
            {widget.type === 'calendar' && (() => {
              const year = currentTime.getFullYear();
              const month = currentTime.getMonth();
              const today = currentTime.getDate();
              const monthName = currentTime.toLocaleString('default', { month: 'long' });
              const firstDayOfWeek = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();

              return (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', letterSpacing: '0.02em' }}>
                      {monthName} {year}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--tx-3)' }}>Today: {today}</span>
                  </div>
                  {/* Weekday headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '10px', color: 'var(--tx-3)', marginBottom: '4px' }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <span key={i}>{d}</span>
                    ))}
                  </div>
                  {/* Days grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '11px' }}>
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <span key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const isToday = dayNum === today;
                      return (
                        <span
                          key={dayNum}
                          style={{
                            padding: '3px 0',
                            borderRadius: '50%',
                            background: isToday ? '#ef4444' : 'transparent',
                            color: isToday ? '#ffffff' : 'var(--tx-1, #e2e8f0)',
                            fontWeight: isToday ? 700 : 400,
                          }}
                        >
                          {dayNum}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 6. COUNTDOWN WIDGET */}
            {widget.type === 'countdown' && (() => {
              const targetDate = widget.config?.targetDate || '2026-12-31';
              const diffMs = Math.max(0, new Date(targetDate).getTime() - currentTime.getTime());
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
              const mins = Math.floor((diffMs / (1000 * 60)) % 60);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                      ⏳ {widget.title || widget.text || 'Event Countdown'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--tx-3)' }}>{targetDate}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{days}</div>
                      <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Days</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{hours}</div>
                      <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Hours</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{mins}</div>
                      <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Mins</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 7. TO-DO LIST WIDGET */}
            {widget.type === 'todo' && (
              <TodoWidgetContent
                widget={widget}
                canEdit={canEdit}
                onUpdateWidgetConfig={onUpdateWidgetConfig}
              />
            )}

            {/* 8. CUSTOM METRIC CARD */}
            {widget.type === 'metric' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx-3)', fontWeight: 600 }}>
                    {widget.title || 'Metrics'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#38bdf8' }}>{widget.config?.trend || '+24.5%'}</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                  {widget.text || widget.config?.value || '2,480'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--tx-2)' }}>
                  {widget.config?.subtext || 'Active Portfolio Views'}
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ width: '70%', height: '100%', background: '#38bdf8', borderRadius: '2px' }} />
                </div>
              </div>
            )}

            {/* 9. QUOTE / BANNER CARD */}
            {widget.type === 'quote' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '22px', color: '#f59e0b', lineHeight: 1 }}>“</span>
                <p style={{ fontSize: '12px', fontStyle: 'italic', lineHeight: 1.45, color: '#f1f5f9', margin: '4px 0' }}>
                  {widget.text || widget.config?.quote || 'Simplicity is the ultimate sophistication.'}
                </p>
                <span style={{ fontSize: '10px', color: 'var(--tx-3)', textAlign: 'right', fontWeight: 600 }}>
                  — {widget.config?.author || 'Leonardo da Vinci'}
                </span>
              </div>
            )}

            {/* 10. CUSTOM WIDGET (DYNAMIC STUDIO INSTANCE) */}
            {widget.type === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {canEdit && (
                  <WarmTooltip content="Open in Widget Studio" side="top">
                    <button
                      type="button"
                      className="widget-handle"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCustomWidget?.(widget);
                      }}
                      aria-label="Open in Widget Studio"
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '30px',
                        width: '18px',
                        height: '18px',
                        fontSize: '10px',
                        background: 'rgba(56, 189, 248, 0.25)',
                        border: '1px solid rgba(56, 189, 248, 0.5)',
                        color: '#38bdf8',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ⚙
                    </button>
                  </WarmTooltip>
                )}
                {renderCustomWidgetBlocks(widget.blocks || [])}
              </div>
            )}
          </div>
        );
      })}
      {/* macOS Widget Gallery panel integration */}
      <div className="widget-gallery-panel" style={{ display: 'none' }} aria-hidden="true" />
    </>
  );
}
