'use client';

import React, { useState, useEffect } from 'react';
import { FileItem } from '@/lib/types';

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

  useEffect(() => {
    setContent(file.content || '');
  }, [file]);

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

  return (
    <div
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
