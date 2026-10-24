'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PortfolioData, FolderItem, FileItem, Item } from '@/lib/types';
import PortOSIcon from '@/components/icons/PortOSIcon';
import { getIconKindForFile, getIconKindForFolder } from '@/components/icons/iconRegistry';

export interface SpotlightItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Applications' | 'Documents & Projects' | 'System Actions';
  icon: React.ReactNode;
  onSelect: () => void;
}

interface SpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioData: PortfolioData | null;
  isAdmin: boolean;
  onOpenProjects: () => void;
  onOpenCertEducation: () => void;
  onOpenOwnersData: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenWidgets: () => void;
  onOpenFile: (file: FileItem) => void;
  onOpenFolder: (folder: FolderItem) => void;
  onNewFolder: () => void;
  onSleep: () => void;
  onRestart: () => void;
  onShutdown: () => void;
  onSignOut: () => void;
  onOpenTerminal?: () => void;
  onOpenAbout?: () => void;
}

export default function SpotlightModal({
  isOpen,
  onClose,
  portfolioData,
  isAdmin,
  onOpenProjects,
  onOpenCertEducation,
  onOpenOwnersData,
  onOpenSettings,
  onOpenWidgets,
  onOpenFile,
  onOpenFolder,
  onNewFolder,
  onSleep,
  onRestart,
  onShutdown,
  onSignOut,
  onOpenTerminal,
  onOpenAbout,
}: SpotlightModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build searchable items
  const allItems: SpotlightItem[] = useMemo(() => {
    const items: SpotlightItem[] = [];

    // 1. Applications
    items.push({
      id: 'app-projects',
      title: 'Projects',
      subtitle: 'Browse portfolio projects & source code',
      category: 'Applications',
      icon: <PortOSIcon kind="projects" size={22} />,
      onSelect: onOpenProjects,
    });

    items.push({
      id: 'app-cert-edu',
      title: 'Certification & Education',
      subtitle: 'View credentials, degrees, and certificates',
      category: 'Applications',
      icon: <PortOSIcon kind="cert-education" size={22} />,
      onSelect: onOpenCertEducation,
    });

    items.push({
      id: 'app-owner',
      title: "Owner's Data",
      subtitle: 'About Me, bio, and contact information',
      category: 'Applications',
      icon: <PortOSIcon kind="owners-data" size={22} />,
      onSelect: onOpenOwnersData,
    });

    items.push({
      id: 'app-settings',
      title: 'System Settings',
      subtitle: 'Appearance, Wallpapers, Boot, and Fonts',
      category: 'Applications',
      icon: <PortOSIcon kind="settings" size={22} />,
      onSelect: () => onOpenSettings(),
    });

    items.push({
      id: 'app-widgets',
      title: 'Widgets Manager',
      subtitle: 'Configure desktop clocks, notes, and stats',
      category: 'Applications',
      icon: <PortOSIcon kind="widgets" size={22} />,
      onSelect: onOpenWidgets,
    });

    if (onOpenTerminal) {
      items.push({
        id: 'app-terminal',
        title: 'Terminal',
        subtitle: 'Interactive command-line shell (portsh v1.0)',
        category: 'Applications',
        icon: <PortOSIcon kind="terminal" size={22} />,
        onSelect: onOpenTerminal,
      });
    }

    if (onOpenAbout) {
      items.push({
        id: 'app-about',
        title: 'About PORT OS',
        subtitle: 'Hardware, software, and kernel version',
        category: 'Applications',
        icon: <PortOSIcon kind="about" size={22} />,
        onSelect: onOpenAbout,
      });
    }

    // 2. Documents & Projects from portfolioData.root
    if (portfolioData?.root) {
      const traverse = (itemList: Item[], pathPrefix = '') => {
        for (const it of itemList) {
          if (it.kind === 'file') {
            const file = it as FileItem;
            items.push({
              id: `doc-${file.id}`,
              title: file.name,
              subtitle: pathPrefix ? `${pathPrefix} • Markdown Document` : 'Markdown Document',
              category: 'Documents & Projects',
              icon: <PortOSIcon kind={getIconKindForFile(file.name)} size={22} />,
              onSelect: () => onOpenFile(file),
            });
          } else if (it.kind === 'folder') {
            const folder = it as FolderItem;
            items.push({
              id: `folder-${folder.id}`,
              title: folder.name,
              subtitle: pathPrefix ? `${pathPrefix} • Folder` : 'Folder',
              category: 'Documents & Projects',
              icon: <PortOSIcon kind={getIconKindForFolder(folder.id, folder.name)} size={22} />,
              onSelect: () => onOpenFolder(folder),
            });
            if (folder.children && folder.children.length > 0) {
              traverse(folder.children, `${pathPrefix ? pathPrefix + ' / ' : ''}${folder.name}`);
            }
          }
        }
      };
      traverse(portfolioData.root);
    }

    // 3. System Actions
    if (isAdmin) {
      items.push({
        id: 'action-new-folder',
        title: 'New Folder',
        subtitle: 'Create a new folder on the desktop',
        category: 'System Actions',
        icon: <PortOSIcon kind="folder" size={22} />,
        onSelect: onNewFolder,
      });
    }

    items.push({
      id: 'action-wallpaper',
      title: 'Change Wallpaper',
      subtitle: 'Open System Settings Appearance tab',
      category: 'System Actions',
      icon: <PortOSIcon kind="settings" size={22} />,
      onSelect: () => onOpenSettings('appearance'),
    });

    items.push({
      id: 'action-sleep',
      title: 'Sleep',
      subtitle: 'Put PORT OS into low-power sleep mode',
      category: 'System Actions',
      icon: <PortOSIcon kind="lock" size={22} />,
      onSelect: onSleep,
    });

    items.push({
      id: 'action-restart',
      title: 'Restart PORT OS',
      subtitle: 'Reboot the operating system session',
      category: 'System Actions',
      icon: <PortOSIcon kind="power" size={22} />,
      onSelect: onRestart,
    });

    items.push({
      id: 'action-shutdown',
      title: 'Shut Down',
      subtitle: 'Power down PORT OS',
      category: 'System Actions',
      icon: <PortOSIcon kind="power" size={22} />,
      onSelect: onShutdown,
    });

    items.push({
      id: 'action-logout',
      title: 'Log Out',
      subtitle: 'Exit current user session',
      category: 'System Actions',
      icon: <PortOSIcon kind="power" size={22} />,
      onSelect: onSignOut,
    });

    return items;
  }, [
    portfolioData,
    isAdmin,
    onOpenProjects,
    onOpenCertEducation,
    onOpenOwnersData,
    onOpenSettings,
    onOpenWidgets,
    onOpenFile,
    onOpenFolder,
    onNewFolder,
    onSleep,
    onRestart,
    onShutdown,
    onSignOut,
  ]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allItems;
    }
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Clamp selectedIndex
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          selected.onSelect();
          onClose();
        }
      }
    },
    [filteredItems, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      id="spotlight-modal"
      className="spotlight-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        className="spotlight-card"
        style={{
          width: '90%',
          maxWidth: '640px',
          background: 'rgba(22, 26, 35, 0.96)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
          backdropFilter: 'blur(30px)',
          animation: 'spotlightPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            gap: '12px',
          }}
        >
          {/* Magnifying Glass Icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#7C6CFF', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>

          <input
            ref={inputRef}
            id="spotlight-search-input"
            type="text"
            placeholder="Spotlight Search (apps, documents, actions)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '17px',
              fontFamily: 'inherit',
              lineHeight: '24px',
            }}
          />

          <kbd
            style={{
              padding: '2px 6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '5px',
              color: '#a9b1bf',
              fontSize: '11px',
              fontFamily: 'inherit',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            padding: '8px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: '#7d8696',
                fontSize: '13px',
              }}
            >
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`spotlight-result-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(124, 108, 255, 0.22)' : 'transparent',
                    border: isSelected ? '1px solid rgba(124, 108, 255, 0.4)' : '1px solid transparent',
                    transition: 'background 0.1s ease',
                    gap: '12px',
                  }}
                >
                  <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: isSelected ? '#ffffff' : '#f5f7fa',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: isSelected ? '#d1d5db' : '#7d8696',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.subtitle}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: isSelected ? '#a5b4fc' : '#4b5563',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(14, 17, 23, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#7d8696',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <span>
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px' }}>↑↓</kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px' }}>↵</kbd>{' '}
              Open
            </span>
          </div>
          <span>PORT OS Spotlight</span>
        </div>
      </div>
    </div>
  );
}
