'use client';

import React, { useState } from 'react';
import { Widget, CustomWidgetBlock, CustomWidgetFieldType, WidgetCustomAppearance } from '@/lib/types';

interface WidgetStudioProps {
  initialWidget?: Widget | null;
  onSave: (widget: Widget) => void;
  onCancel: () => void;
}

const DEFAULT_TEMPLATES: { name: string; desc: string; blocks: CustomWidgetBlock[]; appearance: WidgetCustomAppearance }[] = [
  {
    name: 'Goal & Progress',
    desc: 'Track sprint goals, completion percent and checklist items',
    appearance: {
      bgColor: '#1e293b',
      bgOpacity: 0.75,
      textColor: '#f8fafc',
      borderColor: 'rgba(56, 189, 248, 0.3)',
      borderRadius: 14,
      backdropBlur: 20,
      effect: 'liquid-glass',
    },
    blocks: [
      { id: 'b1', type: 'heading', config: { text: 'Quarterly Goals', size: 'medium', align: 'left' } },
      { id: 'b2', type: 'progress', config: { text: 'Sprint Target', value: 75, targetValue: 100, color: '#38bdf8' } },
      { id: 'b3', type: 'divider', config: {} },
      {
        id: 'b4',
        type: 'checklist',
        config: {
          items: [
            { id: 'c1', text: 'Deploy PORT OS v2.0', done: true },
            { id: 'c2', text: 'Verify DevTools 0-bug pass', done: true },
            { id: 'c3', text: 'Deliver Custom Widget Studio', done: false },
          ],
        },
      },
    ],
  },
  {
    name: 'Key Metric Card',
    desc: 'Showcase high-impact numbers, growth trends and KPIs',
    appearance: {
      bgColor: '#0f172a',
      bgOpacity: 0.85,
      textColor: '#f8fafc',
      borderColor: 'rgba(52, 211, 153, 0.35)',
      borderRadius: 16,
      backdropBlur: 24,
      effect: 'glow',
    },
    blocks: [
      { id: 'b1', type: 'heading', config: { text: 'System Telemetry', size: 'small', align: 'left' } },
      { id: 'b2', type: 'number', config: { value: '99.98%', subtext: 'Production Uptime', color: '#34d399', align: 'left' } },
      { id: 'b3', type: 'metric', config: { text: 'Monthly Active Visitors', value: '4.8k', subtext: '+18.4% vs last mo', color: '#38bdf8' } },
    ],
  },
  {
    name: 'Daily To-Do List',
    desc: 'Interactive personal checklist for everyday tasks',
    appearance: {
      bgColor: '#18181b',
      bgOpacity: 0.8,
      textColor: '#fafafa',
      borderColor: 'rgba(251, 191, 36, 0.3)',
      borderRadius: 12,
      backdropBlur: 16,
      effect: 'none',
    },
    blocks: [
      { id: 'b1', type: 'heading', config: { text: 'Today\'s Focus', size: 'medium', align: 'left' } },
      {
        id: 'b2',
        type: 'checklist',
        config: {
          items: [
            { id: 't1', text: 'Review pull requests', done: false },
            { id: 't2', text: 'Update portfolio architecture', done: true },
            { id: 't3', text: 'Backup vault state', done: false },
          ],
        },
      },
    ],
  },
  {
    name: 'Bookmark & Resources',
    desc: 'Fast desktop shortcut with target links and status',
    appearance: {
      bgColor: '#1e1b4b',
      bgOpacity: 0.8,
      textColor: '#f8fafc',
      borderColor: 'rgba(129, 140, 248, 0.3)',
      borderRadius: 14,
      backdropBlur: 20,
      effect: 'liquid-glass',
    },
    blocks: [
      { id: 'b1', type: 'heading', config: { text: 'Quick Links', size: 'medium', align: 'left' } },
      { id: 'b2', type: 'text', config: { text: 'Direct access to essential repositories & docs' } },
      { id: 'b3', type: 'link', config: { text: 'GitHub Profile', url: 'https://github.com' } },
      { id: 'b4', type: 'link', config: { text: 'Project Documentation', url: 'https://developer.apple.com' } },
    ],
  },
];

export function renderCustomWidgetBlocks(blocks: CustomWidgetBlock[]) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {blocks.map((block) => {
        switch (block.type) {
          case 'heading': {
            const size = block.config.size === 'large' ? '17px' : block.config.size === 'small' ? '12px' : '14px';
            return (
              <div
                key={block.id}
                style={{
                  fontSize: size,
                  fontWeight: 600,
                  textAlign: block.config.align || 'left',
                  color: block.config.color || 'inherit',
                  letterSpacing: '-0.01em',
                }}
              >
                {block.config.text || 'Untitled Heading'}
              </div>
            );
          }
          case 'text':
            return (
              <div
                key={block.id}
                style={{
                  fontSize: '12px',
                  color: block.config.color || 'var(--tx-2, #94a3b8)',
                  lineHeight: 1.45,
                  textAlign: block.config.align || 'left',
                }}
              >
                {block.config.text || ''}
              </div>
            );
          case 'number':
            return (
              <div key={block.id} style={{ display: 'flex', flexDirection: 'column', textAlign: block.config.align || 'left' }}>
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono), monospace',
                    color: block.config.color || '#38bdf8',
                    lineHeight: 1.1,
                  }}
                >
                  {block.config.value || '0'}
                </span>
                {block.config.subtext && (
                  <span style={{ fontSize: '11px', color: 'var(--tx-3, #64748b)', marginTop: '2px' }}>
                    {block.config.subtext}
                  </span>
                )}
              </div>
            );
          case 'metric':
            return (
              <div
                key={block.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--tx-2, #94a3b8)' }}>{block.config.text || 'Metric'}</span>
                  {block.config.subtext && (
                    <span style={{ fontSize: '10px', color: block.config.color || '#38bdf8' }}>{block.config.subtext}</span>
                  )}
                </div>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono), monospace' }}>
                  {block.config.value || '0'}
                </span>
              </div>
            );
          case 'progress': {
            const pct = Math.min(100, Math.max(0, Number(block.config.value) || 0));
            return (
              <div key={block.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--tx-2, #94a3b8)' }}>{block.config.text || 'Progress'}</span>
                  <span style={{ fontWeight: 600, color: block.config.color || '#38bdf8' }}>{pct}%</span>
                </div>
                <div
                  style={{
                    height: '6px',
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: block.config.color || '#38bdf8',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          }
          case 'checklist':
            return (
              <div key={block.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(block.config.items || []).map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        border: item.done ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.3)',
                        background: item.done ? '#34d399' : 'transparent',
                        color: '#000',
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      {item.done ? '✓' : ''}
                    </span>
                    <span
                      style={{
                        color: item.done ? 'var(--tx-3, #64748b)' : 'inherit',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            );
          case 'link': {
            const rawUrl = block.config.url || '';
            const safeUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : '#';
            return (
              <a
                key={block.id}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  fontSize: '11px',
                  textDecoration: 'none',
                  fontWeight: 500,
                  transition: 'background 0.15s ease',
                }}
              >
                <span>↗</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.config.text || block.config.url || 'Link'}
                </span>
              </a>
            );
          }
          case 'divider':
            return (
              <div
                key={block.id}
                style={{
                  height: '1px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  margin: '4px 0',
                }}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export default function WidgetStudio({ initialWidget, onSave, onCancel }: WidgetStudioProps) {
  const [title, setTitle] = useState(initialWidget?.title || 'My Custom Widget');
  const [blocks, setBlocks] = useState<CustomWidgetBlock[]>(
    initialWidget?.blocks || DEFAULT_TEMPLATES[0].blocks
  );
  const [appearance, setAppearance] = useState<WidgetCustomAppearance>(
    initialWidget?.appearance || DEFAULT_TEMPLATES[0].appearance
  );
  const [activeTab, setActiveTab] = useState<'blocks' | 'appearance' | 'templates'>('blocks');

  const handleApplyTemplate = (tmpl: typeof DEFAULT_TEMPLATES[0]) => {
    setTitle(tmpl.name);
    setBlocks(JSON.parse(JSON.stringify(tmpl.blocks)));
    setAppearance(JSON.parse(JSON.stringify(tmpl.appearance)));
    setActiveTab('blocks');
  };

  const handleAddBlock = (type: CustomWidgetFieldType) => {
    const id = `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let newBlock: CustomWidgetBlock;

    switch (type) {
      case 'heading':
        newBlock = { id, type, config: { text: 'New Section', size: 'medium', align: 'left' } };
        break;
      case 'text':
        newBlock = { id, type, config: { text: 'Enter notes or status updates here...' } };
        break;
      case 'number':
        newBlock = { id, type, config: { value: '42', subtext: 'Key Figure', color: '#38bdf8' } };
        break;
      case 'metric':
        newBlock = { id, type, config: { text: 'System Metric', value: '120', subtext: '+12%', color: '#34d399' } };
        break;
      case 'progress':
        newBlock = { id, type, config: { text: 'Task Completion', value: 60, targetValue: 100, color: '#38bdf8' } };
        break;
      case 'checklist':
        newBlock = {
          id,
          type,
          config: {
            items: [
              { id: 'c1', text: 'First milestone', done: false },
              { id: 'c2', text: 'Second milestone', done: true },
            ],
          },
        };
        break;
      case 'link':
        newBlock = { id, type, config: { text: 'Documentation', url: 'https://github.com' } };
        break;
      case 'divider':
      default:
        newBlock = { id, type: 'divider', config: {} };
        break;
    }

    setBlocks([...blocks, newBlock]);
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const handleUpdateBlockConfig = (id: string, patch: Record<string, any>) => {
    setBlocks(
      blocks.map((b) => (b.id === id ? { ...b, config: { ...b.config, ...patch } } : b))
    );
  };

  const handleSave = () => {
    const widget: Widget = {
      id: initialWidget?.id || `custom-widget-${Date.now()}`,
      type: 'custom',
      title,
      text: title,
      x: initialWidget?.x ?? 80,
      y: initialWidget?.y ?? 120,
      sizeMode: initialWidget?.sizeMode || 'standard',
      customWidth: 320,
      customHeight: 220,
      blocks,
      appearance,
      createdAt: initialWidget?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(widget);
  };

  return (
    <div
      className="widget-studio widget-studio-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: '#f8fafc',
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🎨</span>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Custom Widget Studio</h3>
            <p style={{ fontSize: '11px', color: 'var(--tx-3, #64748b)', margin: 0 }}>
              Design declarative desktop widgets with live previews
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0, 0, 0, 0.3)', padding: '2px', borderRadius: '8px' }}>
          <button
            id="tab-studio-blocks"
            type="button"
            onClick={() => setActiveTab('blocks')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'blocks' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: activeTab === 'blocks' ? '#38bdf8' : '#94a3b8',
            }}
          >
            Blocks ({blocks.length})
          </button>
          <button
            id="tab-studio-appearance"
            type="button"
            onClick={() => setActiveTab('appearance')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'appearance' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: activeTab === 'appearance' ? '#38bdf8' : '#94a3b8',
            }}
          >
            Style & Theme
          </button>
          <button
            id="tab-studio-templates"
            type="button"
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'templates' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: activeTab === 'templates' ? '#38bdf8' : '#94a3b8',
            }}
          >
            Templates
          </button>
        </div>
      </div>

      {/* Main Workspace (Editor Left, Live Preview Right) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor Controls Pane */}
        <div
          style={{
            width: '54%',
            padding: '16px',
            overflowY: 'auto',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Widget Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx-2, #94a3b8)' }}>Widget Title</label>
            <input
              id="input-widget-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My Productivity Card"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                color: '#fff',
                outline: 'none',
              }}
            />
          </div>

          {/* TAB 1: BLOCKS CONFIGURATION */}
          {activeTab === 'blocks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Content Fields</span>
                {/* Add Block Dropdown */}
                <select
                  id="select-add-block"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddBlock(e.target.value as CustomWidgetFieldType);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: '#1a1e29',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>+ Add Content Block...</option>
                  <option value="heading">Heading</option>
                  <option value="text">Paragraph Text</option>
                  <option value="number">Key Figure / Number</option>
                  <option value="metric">Metric Pill</option>
                  <option value="progress">Progress Bar</option>
                  <option value="checklist">To-Do Checklist</option>
                  <option value="link">Safe Link Bookmark</option>
                  <option value="divider">Separator Divider</option>
                </select>
              </div>

              {/* Block List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
                        #{index + 1} {block.type.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlock(block.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title="Remove Block"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Block-specific field editor */}
                    {block.type === 'heading' && (
                      <input
                        type="text"
                        value={block.config.text || ''}
                        onChange={(e) => handleUpdateBlockConfig(block.id, { text: e.target.value })}
                        placeholder="Heading text"
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: '#fff',
                        }}
                      />
                    )}

                    {block.type === 'text' && (
                      <textarea
                        rows={2}
                        value={block.config.text || ''}
                        onChange={(e) => handleUpdateBlockConfig(block.id, { text: e.target.value })}
                        placeholder="Body text..."
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: '#fff',
                          resize: 'none',
                        }}
                      />
                    )}

                    {block.type === 'number' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          value={block.config.value || ''}
                          onChange={(e) => handleUpdateBlockConfig(block.id, { value: e.target.value })}
                          placeholder="Value (e.g. 99.9%)"
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                        />
                        <input
                          type="text"
                          value={block.config.subtext || ''}
                          onChange={(e) => handleUpdateBlockConfig(block.id, { subtext: e.target.value })}
                          placeholder="Subtitle label"
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                        />
                      </div>
                    )}

                    {block.type === 'progress' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          value={block.config.text || ''}
                          onChange={(e) => handleUpdateBlockConfig(block.id, { text: e.target.value })}
                          placeholder="Progress label"
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={block.config.value || 0}
                          onChange={(e) => handleUpdateBlockConfig(block.id, { value: parseInt(e.target.value) || 0 })}
                          placeholder="0 - 100"
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                        />
                      </div>
                    )}

                    {block.type === 'link' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          value={block.config.text || ''}
                          onChange={(e) => handleUpdateBlockConfig(block.id, { text: e.target.value })}
                          placeholder="Link Title"
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                        />
                        <input
                          type="url"
                          value={block.config.url || ''}
                          onChange={(e) => handleUpdateBlockConfig(block.id, { url: e.target.value })}
                          placeholder="https://..."
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#fff',
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE CONFIGURATION */}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Visual Styling</span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--tx-2)' }}>Background Base</label>
                  <input
                    type="color"
                    value={appearance.bgColor || '#1e293b'}
                    onChange={(e) => setAppearance({ ...appearance, bgColor: e.target.value })}
                    style={{ width: '100%', height: '32px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--tx-2)' }}>Text Color</label>
                  <input
                    type="color"
                    value={appearance.textColor || '#ffffff'}
                    onChange={(e) => setAppearance({ ...appearance, textColor: e.target.value })}
                    style={{ width: '100%', height: '32px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--tx-2)' }}>Surface Opacity</span>
                  <span>{Math.round((appearance.bgOpacity ?? 0.8) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={appearance.bgOpacity ?? 0.8}
                  onChange={(e) => setAppearance({ ...appearance, bgOpacity: parseFloat(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--tx-2)' }}>Corner Radius</span>
                  <span>{appearance.borderRadius ?? 14}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="24"
                  step="2"
                  value={appearance.borderRadius ?? 14}
                  onChange={(e) => setAppearance({ ...appearance, borderRadius: parseInt(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--tx-2)' }}>Apple Visual Effect Preset</label>
                <select
                  value={appearance.effect || 'none'}
                  onChange={(e) => setAppearance({ ...appearance, effect: e.target.value as any })}
                  style={{
                    padding: '6px',
                    fontSize: '11px',
                    background: '#1a1e29',
                    color: '#fff',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <option value="none">Standard Material</option>
                  <option value="liquid-glass">Liquid Glass Sheen</option>
                  <option value="glow">Ambient Luminous Glow</option>
                  <option value="tilt">3D Tilt Perspective</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: TEMPLATES */}
          {activeTab === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Starting Presets</span>
              {DEFAULT_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.name}
                  className="widget-template-card"
                  onClick={() => handleApplyTemplate(tmpl)}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'border 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>{tmpl.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--tx-3, #64748b)' }}>{tmpl.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Preview Pane */}
        <div
          style={{
            width: '46%',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto',
          }}
        >
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx-3)', marginBottom: '14px' }}>
            Live Desktop Preview
          </span>

          {/* Rendered Widget Preview */}
          <div
            id="widget-studio-preview"
            className="widget-live-preview"
            style={{
              width: '300px',
              minHeight: '180px',
              padding: '16px',
              borderRadius: `${appearance.borderRadius ?? 14}px`,
              background: appearance.bgColor
                ? `${appearance.bgColor}${Math.round((appearance.bgOpacity ?? 0.8) * 255).toString(16).padStart(2, '0')}`
                : 'rgba(30, 41, 59, 0.8)',
              backdropFilter: `blur(${appearance.backdropBlur ?? 20}px)`,
              WebkitBackdropFilter: `blur(${appearance.backdropBlur ?? 20}px)`,
              border: appearance.borderColor || '1px solid rgba(255, 255, 255, 0.12)',
              color: appearance.textColor || '#ffffff',
              boxShadow:
                appearance.effect === 'glow'
                  ? '0 12px 30px rgba(0,0,0,0.5), 0 0 25px rgba(56, 189, 248, 0.35)'
                  : '0 10px 25px rgba(0, 0, 0, 0.45)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {renderCustomWidgetBlocks(blocks)}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            borderRadius: '6px',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          id="btn-save-custom-widget"
          type="button"
          onClick={handleSave}
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            background: '#38bdf8',
            border: 'none',
            color: '#0f172a',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(56, 189, 248, 0.4)',
          }}
        >
          Add to Desktop
        </button>
      </div>
    </div>
  );
}
