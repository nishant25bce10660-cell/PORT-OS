'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Widget, WidgetType, ClockConfig, DEFAULT_CLOCK_CONFIG } from '@/lib/types';
import { renderCustomWidgetBlocks } from './WidgetStudio';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';

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
}: WidgetsProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [touchActiveId, setTouchActiveId] = useState<string | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if ((e.target as HTMLElement).closest('.widget-handle, textarea, input, button')) return;

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

      // 16px Grid Snap
      const snappedX = Math.round(rawX / 16) * 16;
      const snappedY = Math.max(32, Math.round(rawY / 16) * 16);

      dragRef.current.currentX = snappedX;
      dragRef.current.currentY = snappedY;

      if (dragRef.current.targetEl) {
        dragRef.current.targetEl.style.transform = `translate3d(${snappedX}px, ${snappedY}px, 0)`;
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
    let resolvedX = Math.round(currentX / 16) * 16;
    let resolvedY = Math.max(32, Math.round(currentY / 16) * 16);

    if (currentWidget) {
      const dimA = getWidgetDimensions(currentWidget.type, currentWidget.sizeMode, currentWidget.customWidth, currentWidget.customHeight);

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
          resolvedY = Math.max(32, Math.round((other.y + dimB.h + 16) / 16) * 16);
        }
      }
    }

    onUpdateWidgetPosition(id, resolvedX, resolvedY);
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
      {widgets.map((widget) => {
        const dims = getWidgetDimensions(widget.type, widget.sizeMode, widget.customWidth, widget.customHeight);
        const app = widget.appearance;
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;
        const posX = Math.max(8, Math.min(widget.x, screenW - dims.w - 8));
        const posY = Math.max(32, Math.min(widget.y, screenH - dims.h - 16));

        return (
          <div
            key={widget.id}
            id={`widget-${widget.id}`}
            className={`desktop-widget ${widget.type === 'clock' ? 'widget-clock-glow' : ''} desktop-widget-editable ${touchActiveId === widget.id ? 'is-touch-active' : ''}`}
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
              top: 0,
              left: 0,
              transform: `translate3d(${posX}px, ${posY}px, 0)`,
              width: `${dims.w}px`,
              minHeight: `${dims.h}px`,
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
            {widget.type === 'todo' && (() => {
              const items: { id: string; text: string; done: boolean }[] = widget.config?.items || [
                { id: '1', text: 'Refactor widget catalog', done: true },
                { id: '2', text: 'Apple-inspired effects test', done: true },
                { id: '3', text: 'End-to-end Trash validation', done: false },
              ];

              const toggleItem = (itemId: string) => {
                if (!canEdit) return;
                const nextItems = items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
                onUpdateWidgetConfig?.(widget.id, { config: { ...widget.config, items: nextItems } });
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>☑️</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#34d399' }}>{widget.title || 'Tasks'}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--tx-3)' }}>
                      {items.filter((i) => i.done).length}/{items.length} done
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                    {items.map((it) => (
                      <div
                        key={it.id}
                        onClick={() => toggleItem(it.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          cursor: canEdit ? 'pointer' : 'default',
                          background: it.done ? 'rgba(52, 211, 153, 0.06)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <span
                          style={{
                            width: '13px',
                            height: '13px',
                            borderRadius: '3px',
                            border: it.done ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.25)',
                            background: it.done ? '#34d399' : 'transparent',
                            color: '#000',
                            fontSize: '9px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {it.done ? '✓' : ''}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: it.done ? 'var(--tx-3)' : 'inherit',
                            textDecoration: it.done ? 'line-through' : 'none',
                          }}
                        >
                          {it.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
