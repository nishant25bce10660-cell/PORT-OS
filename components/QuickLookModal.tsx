'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Item, FileItem, FolderItem } from '@/lib/types';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForFile, getIconKindForFolder } from '@/components/icons/iconRegistry';
import WarmTooltip from './WarmTooltip';
import { useContextMenu, ContextMenuItem } from './ContextMenu';

export interface QuickLookModalProps {
  item: Item | null;
  allItems?: Item[];
  onClose: () => void;
  onSetWallpaper?: (item: FileItem) => void;
  onNavigateItem?: (item: Item) => void;
}

// Sanitized Inline Formatter: Strips raw HTML and javascript:/data: links
function formatInline(text: string): React.ReactNode {
  // Strip raw HTML tags
  const sanitized = text.replace(/<[^>]*>/g, '');
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sanitized)) !== null) {
    if (match.index > lastIdx) {
      parts.push(sanitized.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} style={{ fontWeight: 600, color: '#FFFFFF' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`i-${match.index}`} style={{ fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.9)' }}>
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${match.index}`}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '12px',
            color: '#38bdf8',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const closeBracket = token.indexOf('](');
      const label = token.slice(1, closeBracket);
      const rawUrl = token.slice(closeBracket + 2, -1).trim();
      // Security: Disallow javascript: and data: links
      const isDangerous = /^javascript:|^data:/i.test(rawUrl);
      const safeUrl = isDangerous ? '#' : rawUrl;
      parts.push(
        <a
          key={`a-${match.index}`}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#7C6CFF', textDecoration: 'underline' }}
        >
          {label}
        </a>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < sanitized.length) {
    parts.push(sanitized.slice(lastIdx));
  }

  return parts.length > 0 ? parts : sanitized;
}

// Rich Sanitized Markdown Parser for Quick Look
function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div
            key={`code-${i}`}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px 16px',
              margin: '12px 0',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '12px',
              lineHeight: 1.5,
              overflowX: 'auto',
              color: '#38bdf8',
            }}
          >
            <pre style={{ margin: 0 }}>{codeBuffer.join('\n')}</pre>
          </div>
        );
        inCodeBlock = false;
        codeBuffer = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '14px 0 8px 0',
            letterSpacing: '-0.3px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '6px',
          }}
        >
          {formatInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#FFFFFF',
            margin: '12px 0 6px 0',
            letterSpacing: '-0.2px',
          }}
        >
          {formatInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            margin: '10px 0 4px 0',
          }}
        >
          {formatInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            margin: '14px 0',
          }}
        />
      );
      continue;
    }

    // Unordered List
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div
          key={`li-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            margin: '4px 0',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.88)',
          }}
        >
          <span style={{ color: '#7C6CFF', fontWeight: 'bold' }}>•</span>
          <span>{formatInline(line.trim().slice(2))}</span>
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} style={{ height: '6px' }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '5px 0',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'rgba(255, 255, 255, 0.88)',
        }}
      >
        {formatInline(line)}
      </p>
    );
  }

  return elements;
}

export default function QuickLookModal({
  item,
  allItems = [],
  onClose,
  onSetWallpaper,
  onNavigateItem,
}: QuickLookModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [viewport, setViewport] = useState({ w: 1440, h: 900 });
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    return () => {
      // Focus restoration
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  // Live viewport resize listener using ResizeObserver on document.body for instant zero-jank updates
  useEffect(() => {
    const updateSize = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

  // Focus trap: auto focus close button on open
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, [item?.id]);

  // Arrow Key file navigation & Space/Escape closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        onClose();
        return;
      }

      if (allItems.length > 1 && item) {
        const currentIndex = allItems.findIndex((i) => i.id === item.id);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % allItems.length;
          onNavigateItem?.(allItems[nextIndex]);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + allItems.length) % allItems.length;
          onNavigateItem?.(allItems[prevIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allItems, item, onClose, onNavigateItem]);

  const { openContextMenu } = useContextMenu();

  const isFile = item?.kind === 'file';
  const file = isFile ? (item as FileItem) : null;
  const isImage =
    !!file?.name.match(/\.(png|jpe?g|webp|svg|gif)$/i) ||
    file?.content?.startsWith('data:image');
  const isMarkdown =
    !!file?.name.match(/\.(md|markdown)$/i);

  const handleContextMenuQuickLook = useCallback(
    (e: React.MouseEvent) => {
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();

      const items: ContextMenuItem[] = [
        {
          id: 'ctx-ql-close',
          label: 'Close Quick Look (Space)',
          action: onClose,
        },
      ];

      if (isImage && onSetWallpaper && file) {
        items.push({ id: 'ctx-div-wp', label: '', isDivider: true });
        items.push({
          id: 'ctx-ql-wallpaper',
          label: 'Set as Desktop Wallpaper',
          action: () => onSetWallpaper(file),
        });
      }

      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        title: item.name,
        items,
      });
    },
    [item, isImage, onSetWallpaper, file, onClose, openContextMenu]
  );

  if (!mounted || !item || typeof document === 'undefined') return null;

  // Window-Independent Sizing Formula:
  // Documents: min(720px, 90vw) x min(520px, 80vh)
  // Images: scale to fit within 90vw by 80vh keeping aspect ratio
  // Minimum 320x240
  const maxW = Math.round(viewport.w * 0.9);
  const maxH = Math.round(viewport.h * 0.8);

  const panelWidth = Math.max(320, Math.min(720, maxW));
  const panelHeight = Math.max(240, Math.min(520, maxH));

  const portalTarget = document.getElementById('portal-root') || document.body;

  const glyphKind =
    item.kind === 'folder'
      ? getIconKindForFolder(item.id, item.name)
      : getIconKindForFile(item.name);

  return createPortal(
    <div
      id="quick-look-modal"
      className="quick-look-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick Look: ${item.name}`}
      onClick={onClose}
      onContextMenu={handleContextMenuQuickLook}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
    >
      <div
        id="quick-look-panel"
        className="quick-look-window"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `${panelWidth}px`,
          height: `${panelHeight}px`,
          maxWidth: `${maxW}px`,
          maxHeight: `${maxH}px`,
          background: 'rgba(24, 27, 36, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'quickLookIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          boxSizing: 'border-box',
        }}
      >
        {/* Title Bar matching window style */}
        <div
          className="quick-look-titlebar"
          style={{
            height: '38px',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <WarmTooltip content="Close (Esc or Space)" side="bottom">
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                id="btn-close-quick-look"
                aria-label="Close Quick Look"
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ff5f56',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                }}
              />
            </WarmTooltip>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <PortOSIcon kind={glyphKind} size={16} />
              <span
                id="quick-look-title-name"
                className="quick-look-title"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {item.name}
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted, #9ca3af)',
              whiteSpace: 'nowrap',
              marginLeft: '12px',
              flexShrink: 0,
            }}
          >
            Quick Look (Space / Esc to close)
          </span>
        </div>

        {/* Content Area */}
        <div
          id="quick-look-content-body"
          className="quick-look-body"
          style={{
            flex: 1,
            padding: isImage ? '12px' : '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isImage ? 'center' : 'stretch',
            justifyContent: isImage ? 'center' : 'flex-start',
            boxSizing: 'border-box',
          }}
        >
          {isImage ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
              }}
            >
              {file?.content?.startsWith('data:image') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.content}
                  alt={item.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '320px',
                    height: '220px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <PortOSIcon kind="file" size={64} />
                </div>
              )}
            </div>
          ) : isFile ? (
            isMarkdown ? (
              <div
                className="markdown-formatted-content"
                style={{
                  fontFamily: 'var(--font-inter), -apple-system, sans-serif',
                  color: '#e2e8f0',
                  lineHeight: '1.6',
                }}
              >
                {renderMarkdown(file?.content || '*Empty markdown file*')}
              </div>
            ) : (
              <pre
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  margin: 0,
                }}
              >
                {file?.content || 'Empty file'}
              </pre>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <PortOSIcon kind="folder" size={64} />
              <h4 style={{ color: '#fff', fontSize: '15px', marginTop: '14px', marginBottom: '6px' }}>
                {item.name}
              </h4>
              <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '12px' }}>
                Folder containing {((item as FolderItem).children || []).length} items
              </p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            height: '38px',
            padding: '0 16px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>
            {isFile ? `${file?.content?.length || 0} characters` : 'Folder'}
            {allItems.length > 1 && ` · ${allItems.findIndex((i) => i.id === item.id) + 1} of ${allItems.length}`}
          </span>

          {isFile && onSetWallpaper && file && isImage && (
            <button
              type="button"
              className="btn-set-wallpaper"
              id="btn-set-as-desktop-picture"
              onClick={() => onSetWallpaper(file)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#fff',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Set as Desktop Picture
            </button>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
