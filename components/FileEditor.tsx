'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileItem } from '@/lib/types';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';
import { useContextMenu, ContextMenuItem } from './ContextMenu';

interface FileEditorProps {
  file: FileItem;
  canEdit: boolean;
  isAdmin?: boolean;
  onSaveContent: (fileId: string, newContent: string) => Promise<void>;
}

export default function FileEditor({
  file,
  canEdit,
  isAdmin = false,
  onSaveContent,
}: FileEditorProps) {
  const [content, setContent] = useState<string>(file.content || '');
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(file.content || '');
  }, [file]);

  const applyFormat = (format: 'bold' | 'italic' | 'link' | 'heading' | 'list' | 'code') => {
    if (!canEdit || !isAdmin) return;
    if (viewMode !== 'source') {
      setViewMode('source');
    }
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const selected = content.slice(start, end);
      const before = content.slice(0, start);
      const after = content.slice(end);
      let replacement = '';
      let cursorOffset = 0;

      switch (format) {
        case 'bold':
          replacement = `**${selected || 'bold text'}**`;
          cursorOffset = selected ? replacement.length : 2;
          break;
        case 'italic':
          replacement = `*${selected || 'italic text'}*`;
          cursorOffset = selected ? replacement.length : 1;
          break;
        case 'link':
          replacement = `[${selected || 'link text'}](https://example.com)`;
          cursorOffset = selected ? replacement.length : 1;
          break;
        case 'heading':
          replacement = `\n### ${selected || 'Heading'}\n`;
          cursorOffset = replacement.length;
          break;
        case 'list':
          replacement = `\n- ${selected || 'List item'}\n`;
          cursorOffset = replacement.length;
          break;
        case 'code':
          replacement = selected.includes('\n')
            ? `\n\`\`\`\n${selected || 'code'}\n\`\`\`\n`
            : `\`${selected || 'code'}\``;
          cursorOffset = selected ? replacement.length : 1;
          break;
      }

      const newContent = before + replacement + after;
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }, 10);
    }, 50);
  };

  useEffect(() => {
    if (!canEdit || !isAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        applyFormat('bold');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        applyFormat('italic');
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        applyFormat('link');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, isAdmin, content, viewMode]);

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await onSaveContent(file.id, content);
      setSaveStatus('Saved successfully');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown');

  const { openContextMenu } = useContextMenu();

  const handleContextMenuEditor = (e: React.MouseEvent) => {
    // If user right-clicks inside the textarea in source view, let native context menu work
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'ctx-editor-toggle-view',
        label: viewMode === 'preview' ? 'Switch to Source View' : 'Switch to Formatted View',
        action: () => setViewMode(viewMode === 'preview' ? 'source' : 'preview'),
      },
    ];

    if (canEdit && isAdmin) {
      items.push(
        { id: 'ctx-div-fmt', label: '', isDivider: true },
        {
          id: 'ctx-editor-bold',
          label: 'Bold (**text**)',
          shortcut: '⌘B',
          action: () => applyFormat('bold'),
        },
        {
          id: 'ctx-editor-italic',
          label: 'Italic (*text*)',
          shortcut: '⌘I',
          action: () => applyFormat('italic'),
        },
        {
          id: 'ctx-editor-link',
          label: 'Link ([text](url))',
          shortcut: '⌘K',
          action: () => applyFormat('link'),
        },
        {
          id: 'ctx-editor-code',
          label: 'Code (`code`)',
          action: () => applyFormat('code'),
        }
      );
    }

    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: file.name,
      items,
    });
  };

  return (
    <div
      onContextMenu={handleContextMenuEditor}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(18, 21, 28, 0.98)',
        fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Editor toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(24, 28, 37, 0.9)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            data-status-badge
            style={{
              color: 'var(--text-secondary)',
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {isAdmin
              ? (canEdit ? 'Document (Editing)' : 'Document (Owner Viewing)')
              : 'Document (Guest Read-Only)'}
          </span>

          {/* D4: Formatted / Source Toggle */}
          {isMarkdown && (
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                id="btn-view-preview"
                onClick={() => setViewMode('preview')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'preview' ? 'var(--accent, #7C6CFF)' : 'transparent',
                  color: viewMode === 'preview' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: viewMode === 'preview' ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                Formatted View
              </button>
              <button
                type="button"
                id="btn-view-source"
                onClick={() => setViewMode('source')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'source' ? 'var(--accent, #7C6CFF)' : 'transparent',
                  color: viewMode === 'source' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: viewMode === 'source' ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                Raw Source
              </button>
            </div>
          )}

          {/* Owner Document Formatting Toolbar: Bold, Italic, Link, Heading, List, Code with WarmTooltip & Shortcut Keycaps */}
          {canEdit && isAdmin && (
            <div
              className="document-editor-formatting-toolbar"
              id="doc-formatting-toolbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '6px',
                padding: '2px 4px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
                <WarmTooltip content="Bold" shortcut="⌘B" side="bottom">
                  <button
                    type="button"
                    id="btn-format-bold"
                    className="doc-format-btn"
                    onClick={() => applyFormat('bold')}
                    aria-label="Bold (⌘B)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                    }}
                  >
                    <b style={{ fontFamily: 'serif' }}>B</b>
                  </button>
                </WarmTooltip>
                <WarmTooltip content="Italic" shortcut="⌘I" side="bottom">
                  <button
                    type="button"
                    id="btn-format-italic"
                    className="doc-format-btn"
                    onClick={() => applyFormat('italic')}
                    aria-label="Italic (⌘I)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                    }}
                  >
                    <i style={{ fontFamily: 'serif' }}>I</i>
                  </button>
                </WarmTooltip>
                <WarmTooltip content="Link" shortcut="⌘K" side="bottom">
                  <button
                    type="button"
                    id="btn-format-link"
                    className="doc-format-btn"
                    onClick={() => applyFormat('link')}
                    aria-label="Link (⌘K)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                    }}
                  >
                    🔗
                  </button>
                </WarmTooltip>
                <WarmTooltip content="Heading" side="bottom">
                  <button
                    type="button"
                    id="btn-format-heading"
                    className="doc-format-btn"
                    onClick={() => applyFormat('heading')}
                    aria-label="Heading"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    H
                  </button>
                </WarmTooltip>
                <WarmTooltip content="Bullet List" side="bottom">
                  <button
                    type="button"
                    id="btn-format-list"
                    className="doc-format-btn"
                    onClick={() => applyFormat('list')}
                    aria-label="Bullet List"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      lineHeight: 1,
                    }}
                  >
                    •
                  </button>
                </WarmTooltip>
                <WarmTooltip content="Code Block" side="bottom">
                  <button
                    type="button"
                    id="btn-format-code"
                    className="doc-format-btn"
                    onClick={() => applyFormat('code')}
                    aria-label="Code"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  >
                    &lt;/&gt;
                  </button>
                </WarmTooltip>
              </WarmTooltipGroup>
            </div>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saveStatus && (
              <span
                style={{
                  color: saveStatus.includes('success') ? '#30D158' : '#FF5A52',
                  fontSize: '11px',
                }}
              >
                {saveStatus}
              </span>
            )}
            <button
              type="button"
              id="btn-save-file"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                background: 'var(--accent, #7C6CFF)',
                border: 'none',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Editor or Formatted Markdown Viewer */}
      <div
        className="file-editor-content-area"
        style={{
          flex: 1,
          padding: '24px 32px',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {canEdit && viewMode === 'source' ? (
          <textarea
            ref={textareaRef}
            id="file-content-editor"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'none',
              whiteSpace: 'pre-wrap',
            }}
          />
        ) : (
          <div
            id="file-content-readonly"
            className="file-content-rendered"
            style={{
              color: '#e2e8f0',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '14px',
              lineHeight: '1.65',
              userSelect: 'text',
              maxWidth: '720px',
            }}
          >
            {isMarkdown ? renderMarkdown(content) : <pre style={{ fontFamily: 'var(--font-mono)' }}>{content}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}

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
              margin: '14px 0',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '12.5px',
              lineHeight: 1.5,
              overflowX: 'auto',
              color: '#35D0BA',
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
            fontSize: '22px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '16px 0 10px 0',
            letterSpacing: '-0.3px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '8px',
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
            fontSize: '17px',
            fontWeight: 600,
            color: '#FFFFFF',
            margin: '14px 0 8px 0',
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
            fontSize: '14px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            margin: '12px 0 6px 0',
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
            margin: '16px 0',
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
            gap: '10px',
            margin: '5px 0',
            fontSize: '13.5px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <span style={{ color: 'var(--accent, #7C6CFF)', fontWeight: 'bold' }}>•</span>
          <span>{formatInline(line.trim().slice(2))}</span>
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} style={{ height: '8px' }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          margin: '6px 0',
          fontSize: '13.5px',
          lineHeight: 1.65,
          color: 'rgba(255, 255, 255, 0.85)',
        }}
      >
        {formatInline(line)}
      </p>
    );
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
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
            color: '#35D0BA',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const closeBracket = token.indexOf('](');
      const label = token.slice(1, closeBracket);
      const url = token.slice(closeBracket + 2, -1);
      parts.push(
        <a
          key={`a-${match.index}`}
          href={url}
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

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}
