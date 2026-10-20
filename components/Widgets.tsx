'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Widget } from '@/lib/types';

interface WidgetsProps {
  widgets: Widget[];
  canEdit: boolean;
  onUpdateWidgetPosition: (id: string, x: number, y: number) => void;
  onUpdateWidgetText: (id: string, text: string) => void;
  onDeleteWidget: (id: string) => void;
  onAddWidget: (type: 'clock' | 'note' | 'counter') => void;
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

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: '13px', color: 'var(--tx-1)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text || 'No note written yet.'}
        </p>
      </div>
    );
  }

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

export default function Widgets({
  widgets,
  canEdit,
  onUpdateWidgetPosition,
  onUpdateWidgetText,
  onDeleteWidget,
  onAddWidget,
  totalFiles,
  totalProjects,
}: WidgetsProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  // Live ticking clock
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
    targetEl: HTMLElement | null;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (!canEdit) return;
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
      targetEl: el,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const dx = e.clientX - dragRef.current.pointerStartX;
    const dy = e.clientY - dragRef.current.pointerStartY;

    const rawX = dragRef.current.origX + dx;
    const rawY = dragRef.current.origY + dy;

    // 16px Grid Snap
    const snappedX = Math.round(rawX / 16) * 16;
    const snappedY = Math.max(36, Math.round(rawY / 16) * 16);

    dragRef.current.currentX = snappedX;
    dragRef.current.currentY = snappedY;

    if (dragRef.current.targetEl) {
      dragRef.current.targetEl.style.transform = `translate3d(${snappedX}px, ${snappedY}px, 0)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { id, currentX, currentY } = dragRef.current;
    dragRef.current = null;

    // D5: Widget collision detection & resolution
    const currentWidget = widgets.find((w) => w.id === id);
    const getWidgetDimensions = (type: string) => {
      if (type === 'clock') return { w: 300, h: 180 };
      if (type === 'note') return { w: 260, h: 200 };
      return { w: 320, h: 160 }; // counter
    };

    let resolvedX = currentX;
    let resolvedY = currentY;

    if (currentWidget) {
      const dimA = getWidgetDimensions(currentWidget.type);

      // Check collision with all other widgets
      for (const other of widgets) {
        if (other.id === id) continue;
        const dimB = getWidgetDimensions(other.type);

        const overlaps = !(
          resolvedX + dimA.w <= other.x ||
          resolvedX >= other.x + dimB.w ||
          resolvedY + dimA.h <= other.y ||
          resolvedY >= other.y + dimB.h
        );

        if (overlaps) {
          // Push below the colliding widget with 16px gap
          resolvedY = Math.round((other.y + dimB.h + 16) / 16) * 16;
        }
      }
    }

    onUpdateWidgetPosition(id, resolvedX, resolvedY);
  };

  const hoursStr = currentTime.toLocaleTimeString([], { hour: '2-digit', hour12: false });
  const minsStr = currentTime.toLocaleTimeString([], { minute: '2-digit' });

  return (
    <>
      {/* D11: macOS-Style Widget Gallery Sheet/Bar */}
      {canEdit && (
        <div
          id="widgets-admin-toolbar"
          className="widget-gallery-panel"
          style={{
            position: 'absolute',
            bottom: '78px',
            right: '24px',
            background: 'rgba(24, 28, 37, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9990,
            boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px' }}>🎛️</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-1)' }}>Widgets Gallery:</span>
          </div>

          <button
            type="button"
            id="btn-add-clock-widget"
            onClick={() => onAddWidget('clock')}
            style={{
              background: 'rgba(53, 208, 186, 0.15)',
              border: '1px solid rgba(53, 208, 186, 0.4)',
              color: '#35d0ba',
              fontSize: '11px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>⏰</span>
            <span>Clock</span>
          </button>

          <button
            type="button"
            id="btn-add-note-widget"
            onClick={() => onAddWidget('note')}
            style={{
              background: 'rgba(255, 179, 64, 0.15)',
              border: '1px solid rgba(255, 179, 64, 0.4)',
              color: '#ffb340',
              fontSize: '11px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📌</span>
            <span>Quick Note</span>
          </button>

          <button
            type="button"
            id="btn-add-counter-widget"
            onClick={() => onAddWidget('counter')}
            style={{
              background: 'rgba(124, 108, 255, 0.15)',
              border: '1px solid rgba(124, 108, 255, 0.4)',
              color: '#7c6cff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📊</span>
            <span>Stats</span>
          </button>
        </div>
      )}

      {/* Render Desktop Widgets */}
      {widgets.map((widget) => {
        return (
          <div
            key={widget.id}
            id={`widget-${widget.id}`}
            className={`desktop-widget ${widget.type === 'clock' ? 'widget-clock-glow' : ''} ${canEdit ? 'desktop-widget-editable' : ''}`}
            onPointerDown={(e) => handlePointerDown(e, widget)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translate3d(${widget.x}px, ${widget.y}px, 0)`,
              width: widget.type === 'clock' ? '300px' : widget.type === 'note' ? '260px' : '320px',
            }}
          >
            {/* Admin Handles (Hover only in Edit Mode) */}
            {canEdit && (
              <>
                <button
                  type="button"
                  className="widget-handle widget-remove-handle"
                  id={`btn-delete-widget-${widget.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWidget(widget.id);
                  }}
                  title="Remove widget"
                  aria-label="Remove widget"
                >
                  ✕
                </button>
                <button
                  type="button"
                  className="widget-handle widget-edit-handle"
                  id={`btn-edit-widget-${widget.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id);
                  }}
                  title="Edit label"
                  aria-label="Edit widget"
                >
                  ✎
                </button>
              </>
            )}

            {/* 1. CLOCK WIDGET */}
            {widget.type === 'clock' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {editingWidgetId === widget.id ? (
                  <input
                    type="text"
                    autoFocus
                    defaultValue={widget.text}
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
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--tx-3)', fontWeight: 600 }}>
                    {widget.text || 'SAN FRANCISCO, CA'}
                  </span>
                )}
                <div className="widget-clock-display" style={{ marginTop: '4px' }}>
                  <span>{hoursStr}</span>
                  <span className="clock-seconds-dot" />
                  <span>{minsStr}</span>
                </div>
                <div className="widget-date-label">
                  {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
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
                  initialText={widget.text}
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
                  <span>Vault Assets: {totalFiles || 8}</span>
                  <span>Sync: Local Vault</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
