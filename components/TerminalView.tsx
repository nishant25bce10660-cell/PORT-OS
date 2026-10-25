'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PortfolioData, FileItem, FolderItem } from '@/lib/types';
import { sound } from '@/lib/sound';
import { useContextMenu, ContextMenuItem } from './ContextMenu';

interface TerminalViewProps {
  portfolioData: PortfolioData | null;
  userRole: 'viewer' | 'admin';
  userName?: string;
  onClose?: () => void;
  onOpenWindow?: (id: string, title: string, meta: any) => void;
  onSetWallpaper?: (wp: string) => void;
  initialCommand?: string;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  output: React.ReactNode;
}

export default function TerminalView({
  portfolioData,
  userRole,
  userName = 'owner',
  onClose,
  onOpenWindow,
  onSetWallpaper,
  initialCommand,
}: TerminalViewProps) {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<CommandHistoryEntry[]>([
    {
      id: 'init-1',
      command: '',
      output: (
        <div style={{ color: '#9ca3af', marginBottom: '8px' }}>
          <div>Welcome to PORT OS Shell (portsh v2.0.0-release)</div>
          <div>Type <span style={{ color: '#38bdf8' }}>help</span> to see available commands or <span style={{ color: '#38bdf8' }}>neofetch</span> for system info.</div>
        </div>
      ),
    },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on output change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on mount or click
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      setHistory((prev) => [
        ...prev,
        { id: `cmd-${Date.now()}`, command: '', output: null },
      ]);
      return;
    }

    setCmdHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);

    const parts = trimmed.split(' ');
    const mainCmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    let output: React.ReactNode = null;

    switch (mainCmd) {
      case 'help':
        output = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#d1d5db' }}>
            <div style={{ color: '#38bdf8', fontWeight: 600 }}>Available commands:</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>neofetch</span> - Display PORT OS hardware & software specs</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>ls</span> - List files and directories in vault</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>cat &lt;file&gt;</span> - Print contents of a markdown file</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>whoami</span> - Display current user session and role</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>contact</span> - Display portfolio owner contact links</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>ps</span> - List active system runtime processes</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>vault</span> - Show vault storage and file statistics</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>uname -a</span> - Display system architecture & kernel</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>date</span> - Display current ISO timestamp</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>theme &lt;name&gt;</span> - Switch wallpaper theme</div>
            {userRole === 'admin' && (
              <>
                <div><span style={{ color: '#f59e0b', width: '130px', display: 'inline-block' }}>edit &lt;file&gt;</span> - Open markdown document in FileEditor (Owner)</div>
                <div><span style={{ color: '#f59e0b', width: '130px', display: 'inline-block' }}>mkdir &lt;name&gt;</span> - Create new vault folder (Owner)</div>
                <div><span style={{ color: '#f59e0b', width: '130px', display: 'inline-block' }}>rm &lt;file&gt;</span> - Move vault file or folder to trash (Owner)</div>
                <div><span style={{ color: '#f59e0b', width: '130px', display: 'inline-block' }}>passwd</span> - Update portfolio administrator credentials (Owner)</div>
              </>
            )}
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>clear</span> - Clear terminal scrollback</div>
            <div><span style={{ color: '#7c6cff', width: '130px', display: 'inline-block' }}>exit</span> - Close terminal window</div>
          </div>
        );
        break;

      case 'neofetch':
      case 'systeminfo':
        output = (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', color: '#e5e7eb', flexWrap: 'wrap' }}>
            <pre style={{ color: '#7C6CFF', margin: 0, fontWeight: 700, lineHeight: 1.15, fontSize: '11px', flexShrink: 0 }}>
{`   _____ 
  /     \\
 /  PORT \\
/   OS    \\
\\  1.0.0  /
 \\       / 
  \\_____/  `}
            </pre>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11.5px', minWidth: '220px' }}>
              <div><strong style={{ color: '#38bdf8' }}>PORT OS</strong> 1.0.0 (macOS Dark Release)</div>
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>────────────────────────────────────</div>
              <div><span style={{ color: '#9ca3af' }}>OS:</span> PORT OS Darwin Browser Edition</div>
              <div><span style={{ color: '#9ca3af' }}>Host:</span> Browser V8 Virtual Machine</div>
              <div><span style={{ color: '#9ca3af' }}>Kernel:</span> Next.js 14 App Router</div>
              <div><span style={{ color: '#9ca3af' }}>Shell:</span> portsh 2.0.0-zsh</div>
              <div><span style={{ color: '#9ca3af' }}>Theme:</span> Silk Wave GLSL (60 FPS)</div>
              <div><span style={{ color: '#9ca3af' }}>Typography:</span> Inter Variable & JetBrains Mono</div>
              <div><span style={{ color: '#9ca3af' }}>Audio:</span> Web Audio Synthesizer (Active)</div>
              <div><span style={{ color: '#9ca3af' }}>Security:</span> H1–H5 RBAC, SameSite=Strict</div>
              <div><span style={{ color: '#9ca3af' }}>Session:</span> {userRole === 'admin' ? 'Owner (Authenticated)' : 'Guest (Read-Only)'}</div>
            </div>
          </div>
        );
        break;

      case 'uname':
        output = <div>Darwin portos.local 24.1.0 Darwin Kernel Version 24.1.0 arm64/x86_64</div>;
        break;

      case 'ps':
        output = (
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#d1d5db' }}>
            <div style={{ color: '#9ca3af', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px' }}>
              PID&nbsp;&nbsp;TTY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TIME&nbsp;&nbsp;&nbsp;&nbsp;CMD
            </div>
            <div>&nbsp;&nbsp;1&nbsp;&nbsp;??&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0:01.42&nbsp;window-manager (Zustand v5)</div>
            <div>&nbsp;&nbsp;2&nbsp;&nbsp;??&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0:04.18&nbsp;threejs-wallpaper-daemon (GLSL)</div>
            <div>&nbsp;&nbsp;3&nbsp;&nbsp;??&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0:00.32&nbsp;webaudio-engine (Synthesizer)</div>
            <div>&nbsp;&nbsp;4&nbsp;&nbsp;ttys000&nbsp;&nbsp;0:00.08&nbsp;portsh (Terminal 2.0)</div>
          </div>
        );
        break;

      case 'vault':
        output = (
          <div style={{ color: '#d1d5db', fontSize: '12px' }}>
            <div style={{ color: '#35D0BA', fontWeight: 600 }}>PORT OS Vault Status:</div>
            <div>Root Folders: {portfolioData?.root.length || 0}</div>
            <div>Widgets Installed: {portfolioData?.widgets.length || 0}</div>
            <div>Trash Bin: {portfolioData?.trash?.length || 0} items</div>
            <div>Storage Mode: Local JSON Persistent Store (data/portfolio.json)</div>
          </div>
        );
        break;

      case 'ls': {
        const rootItems = portfolioData?.root || [];
        output = (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', color: '#e5e7eb' }}>
            {rootItems.map((item) => (
              <span
                key={item.id}
                style={{
                  color: item.kind === 'folder' ? '#38bdf8' : '#a78bfa',
                  fontWeight: item.kind === 'folder' ? 600 : 400,
                }}
              >
                {item.kind === 'folder' ? `📁 ${item.name}/` : `📄 ${item.name}`}
              </span>
            ))}
          </div>
        );
        break;
      }

      case 'cat': {
        const targetName = args.join(' ').toLowerCase();
        if (!targetName) {
          output = <span style={{ color: '#f87171' }}>usage: cat &lt;filename&gt;</span>;
        } else {
          let foundFile: FileItem | null = null;
          const search = (items: any[]) => {
            for (const it of items) {
              if (it.kind === 'file' && it.name.toLowerCase().includes(targetName)) {
                foundFile = it;
                return;
              }
              if (it.kind === 'folder' && it.children) {
                search(it.children);
              }
            }
          };
          search(portfolioData?.root || []);

          if (foundFile) {
            output = (
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#d1d5db',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '8px',
                  borderRadius: '4px',
                }}
              >
                {(foundFile as FileItem).content}
              </pre>
            );
          } else {
            output = <span style={{ color: '#f87171' }}>cat: {args.join(' ')}: No such file in vault</span>;
          }
        }
        break;
      }

      case 'whoami':
        output = (
          <div style={{ color: '#38bdf8' }}>
            {userRole === 'admin' ? 'admin / owner' : 'viewer / guest'} ({userRole === 'admin' ? 'admin (Administrator • Full Read/Write Privileges)' : 'viewer (Read-Only Session)'})
          </div>
        );
        break;

      case 'contact':
        output = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#d1d5db' }}>
            <div><strong style={{ color: '#fff' }}>{portfolioData?.owner.name || 'Nishant Singh'}</strong> - {portfolioData?.owner.title}</div>
            <div>Email: <a href={`mailto:${portfolioData?.owner.email}`} style={{ color: '#38bdf8' }}>{portfolioData?.owner.email}</a></div>
            <div>GitHub: <a href={portfolioData?.owner.github} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{portfolioData?.owner.github}</a></div>
            <div>LinkedIn: <a href={portfolioData?.owner.linkedin} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{portfolioData?.owner.linkedin}</a></div>
          </div>
        );
        break;

      case 'date':
        output = <div>{new Date().toISOString()}</div>;
        break;

      case 'theme': {
        const themeName = args[0]?.toLowerCase();
        const validThemes = ['wave-shader', 'silk-midnight', 'deep-space', 'obsidian', 'aurora'];
        if (!themeName || !validThemes.includes(themeName)) {
          output = (
            <div style={{ color: '#f87171' }}>
              usage: theme &lt;name&gt;<br />
              valid options: {validThemes.join(', ')}
            </div>
          );
        } else {
          if (onSetWallpaper) {
            onSetWallpaper(themeName);
            output = <div style={{ color: '#34d399' }}>Wallpaper theme updated to {themeName}</div>;
          } else {
            output = <div>Setting theme not available in current window</div>;
          }
        }
        break;
      }

      case 'edit':
        if (userRole !== 'admin') {
          output = <span style={{ color: '#f87171' }}>portsh: permission denied: &apos;edit&apos; requires administrator role</span>;
        } else {
          output = <span style={{ color: '#38bdf8' }}>Launching FileEditor for {args.join(' ') || 'selected file'}...</span>;
        }
        break;

      case 'mkdir':
        if (userRole !== 'admin') {
          output = <span style={{ color: '#f87171' }}>portsh: permission denied: &apos;mkdir&apos; requires administrator role</span>;
        } else {
          output = <span style={{ color: '#34d399' }}>Created directory {args[0] || 'new_folder'}</span>;
        }
        break;

      case 'rm':
        if (userRole !== 'admin') {
          output = <span style={{ color: '#f87171' }}>portsh: permission denied: &apos;rm&apos; requires administrator role</span>;
        } else {
          output = <span style={{ color: '#f59e0b' }}>Moved {args[0] || 'item'} to Trash</span>;
        }
        break;

      case 'passwd':
        if (userRole !== 'admin') {
          output = <span style={{ color: '#f87171' }}>portsh: permission denied: &apos;passwd&apos; requires administrator role</span>;
        } else {
          output = <span style={{ color: '#38bdf8' }}>Run &apos;npm run set-password&apos; on server host CLI to update password hash</span>;
        }
        break;

      case 'clear':
        setHistory([]);
        return;

      case 'exit':
        if (onClose) {
          onClose();
        }
        return;

      default:
        output = (
          <div style={{ color: '#f87171' }}>
            portsh: command not found: {mainCmd}. Type &apos;help&apos; for list of commands.
          </div>
        );
        break;
    }

    setHistory((prev) => [
      ...prev,
      { id: `cmd-${Date.now()}`, command: trimmed, output },
    ]);
    sound.playClickSound();
  };

  const executedInitialRef = useRef<boolean>(false);
  useEffect(() => {
    if (initialCommand && !executedInitialRef.current) {
      executedInitialRef.current = true;
      handleCommand(initialCommand);
    }
  }, [initialCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(inputVal);
      setInputVal('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx = historyIdx === -1 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(cmdHistory[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= cmdHistory.length) {
        setHistoryIdx(-1);
        setInputVal('');
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(cmdHistory[nextIdx] || '');
      }
    }
  };

  const promptUser = userRole === 'admin' ? 'owner' : 'guest';

  const { openContextMenu } = useContextMenu();

  const handleContextMenuTerminal = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'INPUT') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: 'Terminal (portsh)',
      items: [
        {
          id: 'ctx-term-clear',
          label: 'Clear Terminal',
          action: () => setHistory([]),
        },
        {
          id: 'ctx-term-help',
          label: 'Show Help',
          action: () => handleCommand('help'),
        },
        {
          id: 'ctx-term-neofetch',
          label: 'System Info (neofetch)',
          action: () => handleCommand('neofetch'),
        },
      ],
    });
  };

  return (
    <div
      id="terminal-view-container"
      onContextMenu={handleContextMenuTerminal}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#0c0f15',
        color: '#f5f7fa',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '12px',
        lineHeight: 1.5,
        padding: '14px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output log */}
      <div
        id="terminal-output"
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          wordBreak: 'break-word',
        }}
      >
        {history.map((item) => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {item.command && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#30d158', fontWeight: 600 }}>{promptUser}@portos</span>
                <span style={{ color: '#7c6cff', marginLeft: '6px' }}>~ %</span>
                <span style={{ marginLeft: '8px' }}>{item.command}</span>
              </div>
            )}
            {item.output && <div style={{ paddingLeft: '8px' }}>{item.output}</div>}
          </div>
        ))}
      </div>

      {/* D12: Active Input Line with clean prompt and NO stray space */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span id="terminal-prompt" style={{ color: '#30d158', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {promptUser}@portos
        </span>
        <span style={{ color: '#7c6cff', marginLeft: '6px', whiteSpace: 'nowrap' }}>~ %</span>
        <input
          ref={inputRef}
          id="terminal-command-input"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            marginLeft: '8px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f5f7fa',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: 0,
          }}
        />
      </div>
    </div>
  );
}
