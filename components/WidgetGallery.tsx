'use client';

import React, { useState } from 'react';
import { Widget, WidgetType } from '@/lib/types';
import WidgetStudio from './WidgetStudio';
import WarmTooltip from './WarmTooltip';
import SpringCheck from './SpringCheck';

interface WidgetGalleryProps {
  widgets: Widget[];
  canEdit: boolean;
  onAddWidget: (type: WidgetType, customWidget?: Widget) => void;
  onDeleteWidget: (id: string) => void;
  onUpdateWidget?: (widget: Widget) => void;
  onClose?: () => void;
}

interface CatalogItem {
  id: string;
  type: WidgetType;
  title: string;
  category: 'time' | 'productivity' | 'portfolio' | 'custom';
  description: string;
  icon: string;
  badge?: string;
  defaultConfig?: Record<string, any>;
}

const CATALOG_ITEMS: CatalogItem[] = [
  // Time & Date
  {
    id: 'cat-clock-digital',
    type: 'clock',
    title: 'Digital Clock',
    category: 'time',
    description: 'macOS ambient typography clock with configurable city timezone, seconds dot, and glow',
    icon: '🕒',
    badge: 'Popular',
  },
  {
    id: 'cat-clock-analog',
    type: 'analog-clock',
    title: 'Analog Clock',
    category: 'time',
    description: 'Precision dial analog clock with sweeping orange second hand and 12-hour markers',
    icon: '🧭',
    badge: 'New',
  },
  {
    id: 'cat-calendar',
    type: 'calendar',
    title: 'Calendar & Month',
    category: 'time',
    description: 'Live monthly calendar grid with red current-day highlight and weekday headers',
    icon: '📅',
    badge: 'New',
  },
  {
    id: 'cat-countdown',
    type: 'countdown',
    title: 'Event Countdown',
    category: 'time',
    description: 'Countdown timer tracking days, hours, and minutes until target release milestones',
    icon: '⏳',
    badge: 'New',
    defaultConfig: { targetDate: '2026-12-31' },
  },

  // Productivity
  {
    id: 'cat-note',
    type: 'note',
    title: 'Quick Note',
    category: 'productivity',
    description: 'Minimalist scratchpad with 280-character limit, debounced autosave, and amber badge',
    icon: '📌',
    badge: 'Popular',
  },
  {
    id: 'cat-todo',
    type: 'todo',
    title: 'To-Do Checklist',
    category: 'productivity',
    description: 'Interactive checklist with checkable tasks, strike-through states, and progress counter',
    icon: '☑️',
    badge: 'New',
  },

  // Portfolio & Information
  {
    id: 'cat-stats',
    type: 'counter',
    title: 'Portfolio Stats',
    category: 'portfolio',
    description: 'Three responsive metric cards (Projects, Certifications, Experience) with micro-sparklines',
    icon: '📊',
    badge: 'Popular',
  },
  {
    id: 'cat-metric',
    type: 'metric',
    title: 'Custom Metric Card',
    category: 'portfolio',
    description: 'Standalone KPI card showing big numerical value, percentage growth trend, and subtext',
    icon: '📈',
    badge: 'New',
  },
  {
    id: 'cat-quote',
    type: 'quote',
    title: 'Quote & Message',
    category: 'portfolio',
    description: 'Inspirational design/engineering quote card with typography marks and author line',
    icon: '💬',
    badge: 'New',
  },
];

export default function WidgetGallery({
  widgets,
  canEdit,
  onAddWidget,
  onDeleteWidget,
  onUpdateWidget,
}: WidgetGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const filteredItems = CATALOG_ITEMS.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const customWidgetsOnDesktop = widgets.filter((w) => w.type === 'custom');

  // Handle saving from Studio
  const handleStudioSave = (widget: Widget) => {
    if (editingWidget) {
      onUpdateWidget?.(widget);
      setEditingWidget(null);
    } else {
      onAddWidget('custom', widget);
    }
    setIsStudioOpen(false);
  };

  if (isStudioOpen) {
    return (
      <WidgetStudio
        initialWidget={editingWidget}
        onSave={handleStudioSave}
        onCancel={() => {
          setIsStudioOpen(false);
          setEditingWidget(null);
        }}
      />
    );
  }

  return (
    <div
      className="widget-gallery-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: '#f8fafc',
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      {/* Gallery Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
            Widgets Gallery
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--tx-3, #64748b)', margin: '2px 0 0 0' }}>
            Choose from the built-in library or design your own widgets in the Studio
          </p>
        </div>

        {/* Primary CTA: Open Widget Studio */}
        <button
          id="btn-create-custom-widget"
          className="btn-create-custom-widget"
          type="button"
          onClick={() => {
            setEditingWidget(null);
            setIsStudioOpen(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            border: 'none',
            color: '#0f172a',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(56, 189, 248, 0.35)',
            transition: 'transform 0.15s ease',
          }}
        >
          <span>🎨</span>
          <span>Create Custom Widget</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(255, 255, 255, 0.02)',
          gap: '12px',
        }}
      >
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'all', label: 'All Widgets' },
            { id: 'time', label: 'Time & Date' },
            { id: 'productivity', label: 'Productivity' },
            { id: 'portfolio', label: 'Portfolio' },
            { id: 'custom', label: `My Custom (${customWidgetsOnDesktop.length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="widget-gallery-tab"
              id={`tab-cat-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeCategory === cat.id ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: activeCategory === cat.id ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter widgets..."
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            color: '#fff',
            outline: 'none',
            width: '160px',
          }}
        />
      </div>

      {/* Main Grid View */}
      <div
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '14px',
          alignContent: 'start',
        }}
      >
        {/* SECTION A: Custom widgets if in 'custom' or 'all' */}
        {(activeCategory === 'custom' || activeCategory === 'all') &&
          customWidgetsOnDesktop.map((customW) => (
            <div
              key={customW.id}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '18px' }}>🎨</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>{customW.title || 'Custom Widget'}</span>
                  </div>
                  <span style={{ fontSize: '9px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    Custom
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--tx-3)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  {customW.blocks?.length || 0} configured blocks · {customW.appearance?.effect || 'standard'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingWidget(customW);
                    setIsStudioOpen(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '5px',
                    fontSize: '11px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Edit in Studio
                </button>
                <WarmTooltip content="Remove from Desktop" side="top">
                  <button
                    type="button"
                    onClick={() => onDeleteWidget(customW.id)}
                    aria-label="Remove from Desktop"
                    style={{
                      padding: '5px 8px',
                      fontSize: '11px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </WarmTooltip>
              </div>
            </div>
          ))}

        {/* SECTION B: Catalog items */}
        {activeCategory !== 'custom' &&
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="widget-catalog-card"
              id={`widget-catalog-item-${item.type}`}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: item.badge === 'Popular' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                        color: item.badge === 'Popular' ? '#fbbf24' : '#34d399',
                        fontWeight: 600,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--tx-2, #94a3b8)', lineHeight: 1.45, margin: '0 0 14px 0' }}>
                  {item.description}
                </p>
                {item.type === 'todo' && (
                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '8px 10px',
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <SpringCheck
                      label="Ship the build"
                      defaultChecked={false}
                      color="#ffffff"
                      fillColor="#34d399"
                      checkColor="#052e16"
                      boxSize={18}
                      boxRadius={5}
                      fontSize={12}
                      rowHeight={24}
                      bounce={0.2}
                      strikeLag={0.12}
                      doneOpacity={0.42}
                      strike="left"
                    />
                  </div>
                )}
              </div>

              <button
                id={`btn-add-widget-${item.type}`}
                type="button"
                onClick={() => onAddWidget(item.type)}
                style={{
                  width: '100%',
                  padding: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.15s ease',
                }}
              >
                <span>+</span>
                <span>Add to Desktop</span>
              </button>
            </div>
          ))}
      </div>

      {/* Footer Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.25)',
          fontSize: '11px',
          color: 'var(--tx-3, #64748b)',
        }}
      >
        <span>Active on Desktop: {widgets.length} widgets</span>
        <span>Drag widgets to move · Right-click for options</span>
      </div>
    </div>
  );
}
