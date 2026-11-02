'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  SystemSettings as ISystemSettings,
  DEFAULT_SETTINGS,
  CustomizationSettings,
  DEFAULT_CUSTOMIZATION,
} from '@/lib/types';
import { toastManager } from '@/lib/toast';
import { sound } from '@/lib/sound';
import CometDial from './CometDial';
import { useContextMenu, ContextMenuItem } from './ContextMenu';

interface SystemSettingsProps {
  settings: ISystemSettings;
  canEdit: boolean;
  isAdmin?: boolean;
  onSaveSettings: (nextSettings: Partial<ISystemSettings>) => Promise<void>;
  onResetDefaults?: () => Promise<void>;
}

type TabKey = 'general' | 'customization' | 'appearance' | 'boot' | 'fonts' | 'security';

export default function SystemSettings({
  settings: initialSettings,
  canEdit,
  isAdmin = false,
  onSaveSettings,
  onResetDefaults,
}: SystemSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // Ensure non-admins are restricted from admin-only tabs
  useEffect(() => {
    if (!isAdmin && (activeTab === 'customization' || activeTab === 'appearance' || activeTab === 'boot' || activeTab === 'fonts')) {
      setActiveTab('general');
    }
  }, [isAdmin, activeTab]);
  const [formData, setFormData] = useState<ISystemSettings>(() => {
    const s = initialSettings || DEFAULT_SETTINGS;
    if (!s.customization) {
      return { ...s, customization: DEFAULT_CUSTOMIZATION };
    }
    return s;
  });
  const formDataRef = useRef<ISystemSettings>(formData);
  formDataRef.current = formData;
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fontUploadError, setFontUploadError] = useState<string | null>(null);
  const [fontUploadSuccess, setFontUploadSuccess] = useState<string | null>(null);

  const [visitors, setVisitors] = useState<Array<{ id: string; name: string; email: string; ip: string; timestamp: string }>>([]);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [masterVolume, setMasterVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const saveVolumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted master volume
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('portos_master_volume');
      if (saved) {
        const v = parseFloat(saved);
        if (!isNaN(v) && isFinite(v)) {
          const clamped = Math.max(0, Math.min(1, v));
          setMasterVolume(clamped);
          sound.setMasterVolume(clamped);
        }
      }
    }
  }, []);

  const handleVolumeChangeEnd = (val: number) => {
    const v = Math.max(0, Math.min(1, val / 100));
    if (typeof window !== 'undefined') {
      localStorage.setItem('portos_master_volume', v.toString());
    }
    if (canEdit && isAdmin) {
      if (saveVolumeTimeoutRef.current) clearTimeout(saveVolumeTimeoutRef.current);
      saveVolumeTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appearance: { volume: v } }),
          });
        } catch {}
      }, 300);
    }
  };

  // Sync incoming settings
  useEffect(() => {
    if (initialSettings) {
      setFormData((prev) => {
        const nextState = {
          ...initialSettings,
          customization: {
            ...DEFAULT_CUSTOMIZATION,
            ...(initialSettings.customization || {}),
            effects: prev.customization?.effects || initialSettings.customization?.effects || DEFAULT_CUSTOMIZATION.effects,
          },
        };
        delete (nextState.customization as any).desktopWallpaper;
        delete (nextState.customization as any).lockScreenWallpaper;
        delete (nextState.customization as any).wallpaperDesktop;
        delete (nextState.customization as any).wallpaperLockScreen;
        formDataRef.current = nextState;
        return nextState;
      });
    }
  }, [initialSettings]);

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

  const handleCustomizationChange = <K extends keyof CustomizationSettings>(
    category: K,
    patch: Partial<CustomizationSettings[K]> | CustomizationSettings[K]
  ) => {
    if (!canEdit || !isAdmin) return;
    setFormData((prev) => {
      const curCat = (prev.customization?.[category] || DEFAULT_CUSTOMIZATION[category]) as any;
      const nextCat = typeof patch === 'object' && !Array.isArray(patch) ? { ...curCat, ...patch } : patch;
      const nextCustomization: CustomizationSettings = {
        ...(prev.customization || DEFAULT_CUSTOMIZATION),
        [category]: nextCat,
      };
      delete (nextCustomization as any).desktopWallpaper;
      delete (nextCustomization as any).lockScreenWallpaper;
      delete (nextCustomization as any).wallpaperDesktop;
      delete (nextCustomization as any).wallpaperLockScreen;
      delete (nextCustomization as any).customWallpaperData;

      // Also mirror to viewer local storage for instant personal persistence
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('portos_customization', JSON.stringify(nextCustomization));
        } catch {}
      }

      // Immediately propagate visual effects to desktop
      if (category === 'effects') {
        onSaveSettings({
          customization: nextCustomization,
        }).catch(() => {});
      }

      const nextState = {
        ...prev,
        customization: nextCustomization,
      };
      formDataRef.current = nextState;
      return nextState;
    });
  };

  const handleBootChange = (field: keyof ISystemSettings['boot'], value: string) => {
    if (!canEdit || !isAdmin) return;
    setFormData((prev) => {
      const next = {
        ...prev,
        boot: { ...prev.boot, [field]: value },
      };
      formDataRef.current = next;
      return next;
    });
  };

  const handleSave = async () => {
    if (!canEdit || !isAdmin) {
      toastManager.notify({
        type: 'warning',
        title: 'Customization Restricted',
        message: 'Only the administrator/owner can modify system settings.',
      });
      return;
    }
    const rawData = formDataRef.current;
    const currentData: ISystemSettings = {
      ...rawData,
      customization: rawData.customization ? { ...rawData.customization } : DEFAULT_CUSTOMIZATION,
      appearance: rawData.appearance ? { ...rawData.appearance } : DEFAULT_SETTINGS.appearance,
    };
    if (currentData.customization) {
      delete (currentData.customization as any).desktopWallpaper;
      delete (currentData.customization as any).lockScreenWallpaper;
      delete (currentData.customization as any).wallpaperDesktop;
      delete (currentData.customization as any).wallpaperLockScreen;
      delete (currentData.customization as any).customWallpaperData;
    }
    if (currentData.appearance) {
      delete (currentData.appearance as any).wallpaper;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveSettings(currentData);
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
    if (!canEdit || !isAdmin) return;
    if (confirm('Reset all settings to default values?')) {
      const def = { ...DEFAULT_SETTINGS, customization: DEFAULT_CUSTOMIZATION };
      setFormData(def);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('portos_customization');
        localStorage.removeItem('portos_desktop_icons');
      }
      if (onResetDefaults) {
        await onResetDefaults();
      } else {
        await onSaveSettings(def);
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



  // Font Upload with base64 conversion & validation
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
          if (json.cssFontFace) {
            const style = document.createElement('style');
            style.textContent = json.cssFontFace;
            document.head.appendChild(style);
          }
          handleCustomizationChange('clock', { fontFamily: json.fontName });
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

  const currentCustom = formData.customization || DEFAULT_CUSTOMIZATION;

  // Active tab check (customization & appearance share same view)
  const isCustomizationTab = activeTab === 'customization' || activeTab === 'appearance';

  const { openContextMenu } = useContextMenu();

  const handleContextMenuSettings = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'ctx-settings-general',
        label: 'General / System Info',
        action: () => setActiveTab('general'),
      },
    ];

    if (isAdmin) {
      items.push(
        {
          id: 'ctx-settings-customization',
          label: 'Customization & Effects',
          action: () => setActiveTab('customization'),
        },
        {
          id: 'ctx-settings-boot',
          label: 'Boot Sequence Settings',
          action: () => setActiveTab('boot'),
        },
        {
          id: 'ctx-settings-fonts',
          label: 'Font Management',
          action: () => setActiveTab('fonts'),
        }
      );
    }

    items.push({
      id: 'ctx-settings-security',
      label: 'Security & Access Logs',
      action: () => setActiveTab('security'),
    });

    if (canEdit && isAdmin) {
      items.push({ id: 'ctx-div-reset', label: '', isDivider: true });
      items.push({
        id: 'ctx-settings-reset',
        label: 'Reset All Settings to Defaults',
        danger: true,
        action: () => handleReset(),
      });
    }

    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      title: 'System Settings',
      items,
    });
  };

  return (
    <div
      className="system-settings-window"
      id="system-settings-root"
      onContextMenu={handleContextMenuSettings}
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
          width: '190px',
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
            {isAdmin ? 'Owner (Authorized Admin)' : 'Guest Explorer (Viewer)'}
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

        {/* Consolidated Customization Tab (Aliases Appearance for legacy checks) - ADMIN ONLY */}
        {isAdmin && (
          <button
            type="button"
            data-tab="customization"
            data-alias="appearance"
            id="settings-tab-customization"
            className={`settings-tab-btn ${isCustomizationTab ? 'is-active' : ''}`}
            onClick={() => setActiveTab('customization')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              color: isCustomizationTab ? '#fff' : 'var(--text-secondary)',
              background: isCustomizationTab ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span>🎨</span> Customization
          </button>
        )}

        {/* Boot Tab - ADMIN ONLY */}
        {isAdmin && (
          <button
            type="button"
            data-tab="boot"
            id="settings-tab-boot"
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
        )}

        {/* Fonts Tab - ADMIN ONLY */}
        {isAdmin && (
          <button
            type="button"
            data-tab="fonts"
            id="settings-tab-fonts"
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
        )}

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              General Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.general.name}
                  onChange={(e) => handleGeneralChange('name', e.target.value)}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bio / Summary</label>
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
                    resize: 'none',
                  }}
                />
              </div>

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

        {/* CONSOLIDATED CUSTOMIZATION TAB - ADMIN ONLY */}
        {isAdmin && isCustomizationTab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              System Customization & Personalization
            </h3>

            {/* Section 7: Advanced Clock Customization */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>3. Advanced Clock Customization</label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hours Color</label>
                  <input
                    id="clock-color-hours"
                    type="color"
                    value={currentCustom.clock.hoursColor}
                    onChange={(e) => handleCustomizationChange('clock', { hoursColor: e.target.value })}
                    style={{ width: '100%', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Colon Color</label>
                  <input
                    id="clock-color-colon"
                    type="color"
                    value={currentCustom.clock.colonColor}
                    onChange={(e) => handleCustomizationChange('clock', { colonColor: e.target.value })}
                    style={{ width: '100%', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Minutes Color</label>
                  <input
                    id="clock-color-minutes"
                    type="color"
                    value={currentCustom.clock.minutesColor}
                    onChange={(e) => handleCustomizationChange('clock', { minutesColor: e.target.value })}
                    style={{ width: '100%', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Seconds Color</label>
                  <input
                    id="clock-color-seconds"
                    type="color"
                    value={currentCustom.clock.secondsColor}
                    onChange={(e) => handleCustomizationChange('clock', { secondsColor: e.target.value })}
                    style={{ width: '100%', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Digit Size</label>
                  <select
                    id="clock-digit-size-select"
                    value={currentCustom.clock.digitSize}
                    onChange={(e) => handleCustomizationChange('clock', { digitSize: e.target.value as any })}
                    style={{
                      background: '#1a1e29',
                      backgroundColor: '#1a1e29',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#ffffff',
                      colorScheme: 'dark',
                      fontSize: '12px',
                    }}
                  >
                    <option value="small" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Compact (Small)</option>
                    <option value="medium" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Standard (Medium)</option>
                    <option value="large" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Poster (Large)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Time Format</label>
                  <select
                    value={currentCustom.clock.is24Hour ? '24' : '12'}
                    onChange={(e) => handleCustomizationChange('clock', { is24Hour: e.target.value === '24' })}
                    style={{
                      background: '#1a1e29',
                      backgroundColor: '#1a1e29',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#ffffff',
                      colorScheme: 'dark',
                      fontSize: '12px',
                    }}
                  >
                    <option value="12" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>12-Hour (AM/PM)</option>
                    <option value="24" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>24-Hour (Military)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Location / Zone</label>
                  <input
                    type="text"
                    value={currentCustom.clock.locationLabel}
                    onChange={(e) => handleCustomizationChange('clock', { locationLabel: e.target.value })}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    id="checkbox-show-seconds"
                    type="checkbox"
                    checked={currentCustom.clock.showSeconds}
                    onChange={(e) => handleCustomizationChange('clock', { showSeconds: e.target.checked })}
                  />
                  <span>Show Seconds (:SS)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    id="checkbox-show-date"
                    type="checkbox"
                    checked={currentCustom.clock.showDate}
                    onChange={(e) => handleCustomizationChange('clock', { showDate: e.target.checked })}
                  />
                  <span>Show Date Label</span>
                </label>
              </div>
            </div>

            {/* Section: Desktop Folder Placement (Round 18 Step 8) */}
            <div
              id="settings-section-desktop-side"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Desktop Folder Placement</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Position folders in a single column along chosen edge with auto-adjusting hover
                  </div>
                </div>
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '2px' }}>
                  {(['left', 'right'] as const).map((side) => {
                    const isCur = ((currentCustom as any).desktopSide || 'right') === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        id={`segmented-desktop-side-${side}`}
                        className={`segmented-btn ${isCur ? 'is-selected' : ''}`}
                        onClick={() => handleCustomizationChange('desktopSide' as any, side)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '4px',
                          border: 'none',
                          background: isCur ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                          color: isCur ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)',
                          fontSize: '11.5px',
                          fontWeight: isCur ? 600 : 500,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {side === 'left' ? '◧ Left Side' : '◨ Right Side'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 6: Advanced Visual Effects Library */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>4. Apple & WebGL Visual Effects Library</label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { key: 'glassmorphism', label: 'Glassmorphism Card', desc: 'Frosted backdrop blur & satin border' },
                  { key: 'liquidGlass', label: 'Liquid Glass', desc: 'Layered translucency & refractive sheen' },
                  { key: 'ambientGlow', label: 'Ambient Glow', desc: 'Volumetric color spill around active cards' },
                ].map((eff) => {
                  const isEnabled = (currentCustom.effects as any)[eff.key];
                  return (
                    <div
                      key={eff.key}
                      id={`effect-card-${eff.key}`}
                      className="effect-toggle-card"
                      data-effect={eff.key}
                      onClick={() => {
                        const curEff = (formDataRef.current.customization?.effects || DEFAULT_CUSTOMIZATION.effects) as any;
                        const isEn = !!curEff[eff.key];
                        handleCustomizationChange('effects', {
                          [eff.key]: !isEn,
                        } as any);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isEnabled ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                        border: isEnabled ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span id={`toggle-fx-${eff.key}`} data-enabled={isEnabled ? 'true' : 'false'} style={{ display: 'none' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{eff.label}</span>
                        <span style={{ fontSize: '10px', color: isEnabled ? '#38bdf8' : '#9ca3af' }}>
                          {isEnabled ? '● Active' : '○ Off'}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{eff.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 5: Master Audio & Sound Feedback (Replacing Control Center per Q2 & VF-06) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>5. Master Audio & System Feedback</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Master Volume
                  </div>
                  <CometDial
                    className="dial-master-volume"
                    value={Math.round(masterVolume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    label="Master Volume"
                    size={96}
                    accent="#38bdf8"
                    ink="#ffffff"
                    disabled={isMuted}
                    onChange={(val) => {
                      const v = val / 100;
                      setMasterVolume(v);
                      sound.setMasterVolume(v);
                    }}
                    onChangeEnd={handleVolumeChangeEnd}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      id="checkbox-sound-mute"
                      type="checkbox"
                      checked={isMuted}
                      onChange={(e) => {
                        setIsMuted(e.target.checked);
                        sound.setMuted(e.target.checked);
                      }}
                    />
                    <span>Mute Sound Effects</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => sound.playClickSound()}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Test Chime
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3 & 8: Desktop Icons & Widget Sizing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Desktop Icons Sizing</label>
                <select
                  value={Array.isArray(currentCustom.desktopIcons) ? 'medium' : currentCustom.desktopIcons?.size || 'medium'}
                  onChange={(e) =>
                    handleCustomizationChange('desktopIcons', {
                      ...(Array.isArray(currentCustom.desktopIcons) ? {} : currentCustom.desktopIcons),
                      size: e.target.value as any,
                    })
                  }
                  style={{
                    background: '#1a1e29',
                    backgroundColor: '#1a1e29',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    fontSize: '12px',
                  }}
                >
                  <option value="small" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Compact (40px)</option>
                  <option value="medium" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Standard (48px)</option>
                  <option value="large" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Spacious (56px)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Widgets Sizing Mode</label>
                <select
                  value={currentCustom.clock.sizeMode}
                  onChange={(e) =>
                    handleCustomizationChange('clock', {
                      sizeMode: e.target.value as any,
                    })
                  }
                  style={{
                    background: '#1a1e29',
                    backgroundColor: '#1a1e29',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    fontSize: '12px',
                  }}
                >
                  <option value="auto" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Auto (Intrinsic Content Sizing)</option>
                  <option value="compact" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Compact Size</option>
                  <option value="standard" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Standard Size</option>
                  <option value="expanded" style={{ backgroundColor: '#1a1e29', color: '#ffffff' }}>Expanded Size</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* BOOT TAB - ADMIN ONLY */}
        {isAdmin && activeTab === 'boot' && (
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
                      height: '70px',
                      borderRadius: '8px',
                      background: finish.color,
                      border: formData.boot.metalFinish === finish.id ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: canEdit ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#07090D',
                      boxShadow: formData.boot.metalFinish === finish.id ? '0 0 12px rgba(255, 255, 255, 0.4)' : 'none',
                    }}
                  >
                    {finish.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FONTS TAB - ADMIN ONLY */}
        {isAdmin && activeTab === 'fonts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              Typography & Custom Fonts
            </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500 }}>Upload TTF/WOFF/WOFF2 Font File</label>
                <input
                  type="file"
                  disabled={!canEdit}
                  accept=".ttf,.woff,.woff2,font/ttf,font/woff,font/woff2"
                  onChange={handleFontFileSelected}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                {fontUploadError && <span style={{ fontSize: '11px', color: '#ff5a52' }}>{fontUploadError}</span>}
                {fontUploadSuccess && <span style={{ fontSize: '11px', color: '#35d0ba' }}>{fontUploadSuccess}</span>}
              </div>
            </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Security, RBAC & Telemetry</h3>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleClearVisitors}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 90, 82, 0.2)',
                    border: '1px solid rgba(255, 90, 82, 0.4)',
                    color: '#ff5a52',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Clear Telemetry
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Role</div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', color: isAdmin ? '#38bdf8' : '#a78bfa' }}>
                  {isAdmin ? 'Owner (Admin)' : 'Guest (Read-Only)'}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RBAC Status</div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', color: '#35d0ba' }}>
                  Enforced (Server-Side)
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Host Guard</div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', color: '#38bdf8' }}>
                  Active (CSRF Guard)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Visitor Audit Log ({visitors.length})</div>
              {loadingVisitors ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading telemetry records...</div>
              ) : visitors.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No visitor logs recorded.</div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Timestamp</th>
                        <th style={{ padding: '6px 8px' }}>Name</th>
                        <th style={{ padding: '6px 8px' }}>Email</th>
                        <th style={{ padding: '6px 8px' }}>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.map((v) => (
                        <tr key={v.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{new Date(v.timestamp).toLocaleTimeString()}</td>
                          <td style={{ padding: '6px 8px' }}>{v.name}</td>
                          <td style={{ padding: '6px 8px' }}>{v.email}</td>
                          <td style={{ padding: '6px 8px', color: '#38bdf8' }}>{v.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions (Save / Reset) */}
        {canEdit && isAdmin && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '14px',
              marginTop: 'auto',
            }}
          >
            <button
              type="button"
              id="btn-settings-reset"
              onClick={handleReset}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f5f7fa',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Reset to Defaults
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {saveMessage && <span style={{ fontSize: '11px', color: '#35d0ba' }}>{saveMessage}</span>}
              <button
                type="button"
                id="btn-settings-save"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  background: '#007aff',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(0, 122, 255, 0.4)',
                }}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
