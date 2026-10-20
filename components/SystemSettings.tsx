'use client';

import React, { useState, useEffect } from 'react';
import { SystemSettings as ISystemSettings, DEFAULT_SETTINGS } from '@/lib/types';
import { toastManager } from '@/lib/toast';

interface SystemSettingsProps {
  settings: ISystemSettings;
  canEdit: boolean;
  isAdmin?: boolean;
  onSaveSettings: (nextSettings: Partial<ISystemSettings>) => Promise<void>;
  onResetDefaults?: () => Promise<void>;
}

type TabKey = 'general' | 'appearance' | 'boot' | 'fonts' | 'security';

export default function SystemSettings({
  settings: initialSettings,
  canEdit,
  isAdmin = false,
  onSaveSettings,
  onResetDefaults,
}: SystemSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [formData, setFormData] = useState<ISystemSettings>(initialSettings || DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fontUploadError, setFontUploadError] = useState<string | null>(null);
  const [fontUploadSuccess, setFontUploadSuccess] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<Array<{ id: string; name: string; email: string; ip: string; timestamp: string }>>([]);
  const [loadingVisitors, setLoadingVisitors] = useState(false);

  // Load telemetry when Security tab is active
  useEffect(() => {
    if (activeTab === 'security' && canEdit) {
      setLoadingVisitors(true);
      fetch('/api/telemetry/visitors')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.visitors)) {
            setVisitors(data.visitors);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingVisitors(false));
    }
  }, [activeTab, canEdit]);

  const handleGeneralChange = (field: keyof ISystemSettings['general'], value: string) => {
    if (!canEdit) return;
    setFormData((prev) => ({
      ...prev,
      general: { ...prev.general, [field]: value },
    }));
  };

  const handleAppearanceChange = (field: keyof ISystemSettings['appearance'], value: string) => {
    if (!canEdit) return;
    setFormData((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, [field]: value },
    }));
  };

  const handleBootChange = (field: keyof ISystemSettings['boot'], value: string) => {
    if (!canEdit) return;
    setFormData((prev) => ({
      ...prev,
      boot: { ...prev.boot, [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveSettings(formData);
      setSaveMessage('Settings saved successfully');
      toastManager.notify({
        type: 'success',
        title: 'System Settings',
        message: 'Settings saved and applied successfully',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage('Error saving settings');
      toastManager.notify({
        type: 'error',
        title: 'Settings Error',
        message: 'Failed to persist settings changes',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canEdit) return;
    if (confirm('Reset all settings to default values?')) {
      setFormData(DEFAULT_SETTINGS);
      if (onResetDefaults) {
        await onResetDefaults();
      } else {
        await onSaveSettings(DEFAULT_SETTINGS);
      }
      setSaveMessage('Settings reset to defaults');
      toastManager.notify({
        type: 'info',
        title: 'System Reset',
        message: 'All system settings restored to default values',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleClearVisitors = async () => {
    if (!canEdit) return;
    try {
      const res = await fetch('/api/telemetry/visitors', { method: 'DELETE' });
      if (res.ok) {
        setVisitors([]);
        toastManager.notify({
          type: 'success',
          title: 'Telemetry Cleared',
          message: 'Visitor access logs have been reset',
        });
      }
    } catch {
      toastManager.notify({
        type: 'error',
        title: 'Telemetry Error',
        message: 'Failed to clear visitor records',
      });
    }
  };

  // S2: Font Upload with base64 conversion & validation
  const handleFontFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setFontUploadError(null);
    setFontUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/settings/font', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fontName: file.name.replace(/\.[^/.]+$/, ''),
            fileBase64: base64Data,
            sizeBytes: file.size,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          setFontUploadError(json.error || 'Failed to upload font');
        } else {
          setFontUploadSuccess(`Installed font: ${json.fontName}`);
          // Inject @font-face live into document
          if (json.cssFontFace) {
            const style = document.createElement('style');
            style.textContent = json.cssFontFace;
            document.head.appendChild(style);
          }
          // Set as active font
          handleAppearanceChange('font', json.fontName);
        }
      } catch (err: any) {
        setFontUploadError(err.message || 'Font upload failed');
      }
    };
    reader.readAsDataURL(file);
  };

  const bootAnimations = [
    { id: 'classic', label: 'Classic Fade', desc: 'Smooth elegant macOS typography fade' },
    { id: 'cyber', label: 'Scanline Cyber', desc: 'Retrofuturistic scanline beam sweep' },
    { id: 'matrix', label: 'Matrix Stream', desc: 'Digital rain cascading glyph flow' },
    { id: 'bloom', label: 'Quantum Bloom', desc: 'Particle burst and radial luminescence' },
    { id: 'pulse', label: 'Minimal Pulse', desc: 'Pure sub-bass geometric heart pulse' },
  ];

  const metalFinishes = [
    { id: 'silver', label: 'Silver', color: 'linear-gradient(135deg, #e2e8f0, #94a3b8)' },
    { id: 'space-gray', label: 'Space Gray', color: 'linear-gradient(135deg, #64748b, #334155)' },
    { id: 'gold', label: 'Champagne Gold', color: 'linear-gradient(135deg, #fef08a, #ca8a04)' },
    { id: 'midnight', label: 'Midnight Blue', color: 'linear-gradient(135deg, #38bdf8, #0369a1)' },
  ];

  return (
    <div
      className="system-settings-window"
      id="system-settings-root"
      style={{
        display: 'flex',
        height: '100%',
        background: 'rgba(20, 22, 30, 0.95)',
        color: '#fff',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Settings Sidebar */}
      <div
        className="settings-sidebar"
        style={{
          width: '180px',
          background: 'rgba(15, 17, 23, 0.85)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ padding: '0 8px 12px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>System Settings</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {isAdmin
              ? (canEdit ? 'Owner (Edit Mode Active)' : 'Owner (Viewing Mode)')
              : 'Guest Explorer (Read-Only)'}
          </div>
        </div>

        <button
          type="button"
          data-tab="general"
          className={`settings-tab-btn ${activeTab === 'general' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('general')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '12px',
            color: activeTab === 'general' ? '#fff' : 'var(--text-secondary)',
            background: activeTab === 'general' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>👤</span> General
        </button>

        <button
          type="button"
          data-tab="appearance"
          className={`settings-tab-btn ${activeTab === 'appearance' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('appearance')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '12px',
            color: activeTab === 'appearance' ? '#fff' : 'var(--text-secondary)',
            background: activeTab === 'appearance' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>🎨</span> Appearance
        </button>

        <button
          type="button"
          data-tab="boot"
          className={`settings-tab-btn ${activeTab === 'boot' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('boot')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '12px',
            color: activeTab === 'boot' ? '#fff' : 'var(--text-secondary)',
            background: activeTab === 'boot' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>⚡</span> Boot
        </button>

        <button
          type="button"
          data-tab="fonts"
          className={`settings-tab-btn ${activeTab === 'fonts' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('fonts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '12px',
            color: activeTab === 'fonts' ? '#fff' : 'var(--text-secondary)',
            background: activeTab === 'fonts' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>🔤</span> Fonts
        </button>

        <button
          type="button"
          data-tab="security"
          className={`settings-tab-btn ${activeTab === 'security' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('security')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '12px',
            color: activeTab === 'security' ? '#fff' : 'var(--text-secondary)',
            background: activeTab === 'security' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span>🔒</span> Security
        </button>
      </div>

      {/* Main Settings Panel */}
      <div
        className="settings-content-panel"
        style={{
          flex: 1,
          padding: '24px 28px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              Owner & Portfolio Profile
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Full Name</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.general.ownerName}
                onChange={(e) => handleGeneralChange('ownerName', e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Professional Title</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.general.title}
                onChange={(e) => handleGeneralChange('title', e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bio / Statement</label>
              <textarea
                rows={3}
                disabled={!canEdit}
                value={formData.general.bio}
                onChange={(e) => handleGeneralChange('bio', e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  disabled={!canEdit}
                  value={formData.general.email}
                  onChange={(e) => handleGeneralChange('email', e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '7px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Location</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.general.location}
                  onChange={(e) => handleGeneralChange('location', e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '7px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === 'appearance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              Desktop Appearance & Wallpaper
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>System Wallpaper</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { id: 'wave-shader', label: 'Silk Wave (Dynamic)', bg: 'linear-gradient(135deg, #060913, #13274f, #2563eb)' },
                  { id: 'silk-midnight', label: 'Midnight Blue', bg: 'linear-gradient(135deg, #040814, #0e2a56, #1d4ed8)' },
                  { id: 'deep-space', label: 'Deep Space', bg: 'linear-gradient(135deg, #060514, #1d1145, #5b21b6)' },
                  { id: 'obsidian', label: 'Obsidian Silk', bg: 'linear-gradient(135deg, #07080a, #161a22, #2f3644)' },
                  { id: 'aurora', label: 'Aurora Teal', bg: 'linear-gradient(135deg, #021312, #064e43, #0d9488)' },
                ].map((wp) => (
                  <div
                    key={wp.id}
                    onClick={() => handleAppearanceChange('wallpaper', wp.id)}
                    style={{
                      height: '80px',
                      borderRadius: '8px',
                      background: wp.bg,
                      border: formData.appearance.wallpaper === wp.id ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: canEdit ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: '8px',
                      fontSize: '11px',
                      color: '#fff',
                      boxShadow: formData.appearance.wallpaper === wp.id ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                    }}
                  >
                    {wp.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>Accent Color</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['#38bdf8', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'].map((color) => (
                  <div
                    key={color}
                    onClick={() => handleAppearanceChange('accentColor', color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: color,
                      cursor: canEdit ? 'pointer' : 'default',
                      border: formData.appearance.accentColor === color ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: formData.appearance.accentColor === color ? `0 0 8px ${color}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BOOT TAB (S3) */}
        {activeTab === 'boot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              Boot Experience & Metal Finishes
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>Boot Text</label>
              <input
                type="text"
                disabled={!canEdit}
                value={formData.boot.bootText}
                onChange={(e) => handleBootChange('bootText', e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>5 Boot Text Animations</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {bootAnimations.map((anim) => (
                  <div
                    key={anim.id}
                    data-anim={anim.id}
                    className={`boot-anim-option ${formData.boot.bootAnimation === anim.id ? 'is-selected' : ''}`}
                    onClick={() => handleBootChange('bootAnimation', anim.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: formData.boot.bootAnimation === anim.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: formData.boot.bootAnimation === anim.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{anim.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{anim.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>Logo Metal Finishes</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {metalFinishes.map((finish) => (
                  <div
                    key={finish.id}
                    data-finish={finish.id}
                    className={`metal-finish-option ${formData.boot.metalFinish === finish.id ? 'is-selected' : ''}`}
                    onClick={() => handleBootChange('metalFinish', finish.id)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: formData.boot.metalFinish === finish.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: canEdit ? 'pointer' : 'default',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: finish.color,
                        margin: '0 auto 6px auto',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      }}
                    />
                    <div style={{ fontSize: '11px' }}>{finish.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {canEdit && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  id="btn-reset-defaults"
                  onClick={handleReset}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Reset to Defaults
                </button>
              </div>
            )}
          </div>
        )}

        {/* FONTS TAB (S2) */}
        {activeTab === 'fonts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              System Fonts & Custom Typography
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500 }}>Active Font Family</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['Inter', 'JetBrains Mono'].map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => handleAppearanceChange('font', font)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      background: formData.appearance.font === font ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                      border: formData.appearance.font === font ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: canEdit ? 'pointer' : 'default',
                    }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>

            {canEdit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500 }}>Upload Custom Font (TTF, WOFF, WOFF2 &le; 2MB)</label>
                <input
                  type="file"
                  id="font-file-input"
                  accept=".ttf,.woff,.woff2,.otf"
                  onChange={handleFontFileSelected}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                  }}
                />
                {fontUploadError && (
                  <div style={{ color: '#f87171', fontSize: '11px' }}>{fontUploadError}</div>
                )}
                {fontUploadSuccess && (
                  <div style={{ color: '#34d399', fontSize: '11px' }}>{fontUploadSuccess}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              Security & Access Control
            </h3>

            <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Server-Enforced RBAC</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                All file modifications, widget updates, and system configuration endpoints reject Viewer requests with HTTP 403 Forbidden.
              </div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Rate Limiting & Authentication</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Failed logins are rate-limited to 5 attempts per minute with HTTP 429 Too Many Requests. Cookies use httpOnly + SameSite=Lax.
              </div>
            </div>

            {/* M8.4: Visitor Access Telemetry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Visitor Access Telemetry</span>
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'rgba(124, 108, 255, 0.2)',
                      color: '#a5b4fc',
                      padding: '2px 6px',
                      borderRadius: '999px',
                      fontWeight: 600,
                    }}
                  >
                    {visitors.length} {visitors.length === 1 ? 'Session' : 'Sessions'}
                  </span>
                </div>

                {canEdit && visitors.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearVisitors}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    Clear Logs
                  </button>
                )}
              </div>

              {!canEdit ? (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                  }}
                >
                  Visitor telemetry is restricted to authenticated administrators.
                </div>
              ) : loadingVisitors ? (
                <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  Loading visitor telemetry...
                </div>
              ) : visitors.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    textAlign: 'center',
                  }}
                >
                  No visitor access records logged yet.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '11px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#a9b1bf' }}>
                        <th style={{ padding: '6px 10px', fontWeight: 600 }}>Visitor</th>
                        <th style={{ padding: '6px 10px', fontWeight: 600 }}>Email</th>
                        <th style={{ padding: '6px 10px', fontWeight: 600 }}>IP</th>
                        <th style={{ padding: '6px 10px', fontWeight: 600 }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.map((v) => (
                        <tr
                          key={v.id}
                          style={{
                            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                            color: '#f5f7fa',
                          }}
                        >
                          <td style={{ padding: '6px 10px', fontWeight: 500 }}>{v.name}</td>
                          <td style={{ padding: '6px 10px', color: '#38bdf8' }}>{v.email}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#9ca3af' }}>
                            {v.ip}
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                            {new Date(v.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save button and status */}
        {canEdit && (
          <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              id="btn-save-settings"
              disabled={saving}
              onClick={handleSave}
              style={{
                padding: '7px 18px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--accent-blue)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saveMessage && (
              <span style={{ fontSize: '11px', color: '#34d399' }}>{saveMessage}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
