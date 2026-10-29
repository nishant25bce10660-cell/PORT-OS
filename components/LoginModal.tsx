'use client';

import React, { useState, useEffect } from 'react';
import GeometricLogo from './GeometricLogo';
import { sound } from '@/lib/sound';
import WarmTooltip, { WarmTooltipGroup } from './WarmTooltip';
import ReflectiveCard from './ReflectiveCard';

interface LoginModalProps {
  onLoginSuccess: (user: { role: 'viewer' | 'admin'; name?: string; email?: string; username?: string }) => void;
  onSleep?: () => void;
  onRestart?: () => void;
  onShutdown?: () => void;
}

export default function LoginModal({
  onLoginSuccess,
  onSleep,
  onRestart,
  onShutdown,
}: LoginModalProps) {
  const [selectedUser, setSelectedUser] = useState<'owner' | 'guest'>('guest');

  // Clock state for macOS lock screen
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      };
      setCurrentDate(now.toLocaleDateString('en-US', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Viewer / Guest fields
  const [viewerName, setViewerName] = useState('');
  const [viewerEmail, setViewerEmail] = useState('');

  // Owner / Admin fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Status & Animations
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccessFade, setIsSuccessFade] = useState(false);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const triggerShake = (msg: string) => {
    sound.playClickSound();
    setErrorMessage(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 550);
  };

  const handleViewerSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const name = viewerName.trim();
    const email = viewerEmail.trim();

    if (!name) {
      triggerShake('Please enter your full name.');
      return;
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      triggerShake('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'guest', name, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerShake(data.error || 'Failed to sign in as Guest');
      } else {
        sound.playLoginSuccess();
        setIsSuccessFade(true);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 320);
      }
    } catch {
      triggerShake('Network error during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const username = adminUsername.trim() || 'admin';
    const password = adminPassword;

    if (!password) {
      triggerShake('Password is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'owner', username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerShake(data.error || 'Invalid credentials.');
      } else {
        sound.playLoginSuccess();
        setIsSuccessFade(true);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 320);
      }
    } catch {
      triggerShake('Network error during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-modal-overlay"
      className={`lock-screen-container ${isSuccessFade ? 'lock-screen-fade-out' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '48px 24px 32px 24px',
        backgroundColor: 'rgba(7, 9, 13, 0.45)',
        backdropFilter: 'none',
        fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
        userSelect: 'none',
      }}
    >
      <div id="lock-screen-overlay" style={{ display: 'none' }} />

      {/* D8: 88px macOS Lock-Screen Clock */}
      <div
        id="lock-screen-clock"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '16px',
        }}
      >
        <div
          style={{
            fontSize: '88px',
            fontWeight: 200,
            letterSpacing: '-2px',
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
            fontFamily: 'var(--font-mono), monospace',
            lineHeight: 1,
          }}
        >
          {currentTime || '09:41'}
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.75)',
            letterSpacing: '0.5px',
            marginTop: '12px',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          {currentDate || 'Tuesday, October 20'}
        </div>
      </div>

      {/* D8: macOS Centered Avatars & Card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {/* Avatars Row */}
        <div
          className="lock-screen-avatars"
          role="radiogroup"
          aria-label="Select User Role"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            width: '320px',
            padding: '3px',
            border: '1px solid transparent',
            marginBottom: '28px',
            boxSizing: 'border-box',
          }}
        >
          {/* Owner Avatar (Left) */}
          <div
            id="avatar-select-owner"
            role="radio"
            aria-checked={selectedUser === 'owner'}
            aria-label="Select Owner role"
            tabIndex={selectedUser === 'owner' ? 0 : -1}
            onClick={() => {
              setSelectedUser('owner');
              setErrorMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedUser('guest');
                document.getElementById('avatar-select-guest')?.focus();
              } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setSelectedUser('owner');
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              cursor: 'pointer',
              opacity: selectedUser === 'owner' ? 1 : 0.6,
              transition: 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              outline: 'none',
            }}
          >
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                padding: '3px',
                background: selectedUser === 'owner'
                  ? 'linear-gradient(135deg, #FFFFFF, #71717A)'
                  : 'rgba(255, 255, 255, 0.15)',
                boxShadow: selectedUser === 'owner'
                  ? '0 0 22px rgba(255, 255, 255, 0.3)'
                  : 'none',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: '#12151C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <GeometricLogo size={48} />
              </div>
            </div>
            <div
              style={{
                marginTop: '10px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '-0.2px',
                lineHeight: '20px',
                height: '20px',
              }}
            >
              Nishant Singh
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginTop: '2px',
                lineHeight: '14px',
                height: '14px',
              }}
            >
              Owner
            </div>
          </div>

          {/* Guest Avatar (Right) */}
          <div
            id="avatar-select-guest"
            role="radio"
            aria-checked={selectedUser === 'guest'}
            aria-label="Select Guest role"
            tabIndex={selectedUser === 'guest' ? 0 : -1}
            onClick={() => {
              setSelectedUser('guest');
              setErrorMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedUser('owner');
                document.getElementById('avatar-select-owner')?.focus();
              } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setSelectedUser('guest');
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              cursor: 'pointer',
              opacity: selectedUser === 'guest' ? 1 : 0.6,
              transition: 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              outline: 'none',
            }}
          >
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                padding: '3px',
                background: selectedUser === 'guest'
                  ? 'linear-gradient(135deg, #E4E4E7, #52525B)'
                  : 'rgba(255, 255, 255, 0.15)',
                boxShadow: selectedUser === 'guest'
                  ? '0 0 22px rgba(255, 255, 255, 0.25)'
                  : 'none',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: '#12151C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>
            <div
              style={{
                marginTop: '10px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '-0.2px',
                lineHeight: '20px',
                height: '20px',
              }}
            >
              Guest Explorer
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginTop: '2px',
                lineHeight: '14px',
                height: '14px',
              }}
            >
              Guest
            </div>
          </div>
        </div>

        {/* Segmented Role Switcher Tabs (Crisp Rectangular Geometry, White & Grey Palette) */}
        <div
          id="login-role-switch"
          className="login-tabs-container"
          role="radiogroup"
          aria-label="Role Switch"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            width: '320px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '3px',
            marginBottom: '14px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxSizing: 'border-box',
          }}
        >
          {/* Sliding Spring Thumb */}
          <div
            id="login-switch-thumb"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '3px',
              bottom: '3px',
              left: '3px',
              width: 'calc(50% - 4px)',
              background: 'rgba(255, 255, 255, 0.22)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
              transform: selectedUser === 'owner' ? 'translate3d(0, 0, 0)' : 'translate3d(calc(100% + 2px), 0, 0)',
              transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Owner Segment (Left) */}
          <button
            id="tab-btn-admin"
            data-testid="tab-btn-owner"
            type="button"
            role="radio"
            aria-checked={selectedUser === 'owner'}
            aria-label="Owner"
            tabIndex={selectedUser === 'owner' ? 0 : -1}
            onClick={() => {
              setSelectedUser('owner');
              setErrorMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedUser('guest');
                document.getElementById('tab-btn-viewer')?.focus();
              }
            }}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: selectedUser === 'owner' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)',
              fontSize: '12px',
              fontWeight: selectedUser === 'owner' ? 600 : 500,
              cursor: 'pointer',
              transition: 'color 220ms ease',
              textAlign: 'center',
            }}
          >
            Owner
          </button>

          {/* Guest Segment (Right) */}
          <button
            id="tab-btn-viewer"
            data-testid="tab-btn-guest"
            type="button"
            role="radio"
            aria-checked={selectedUser === 'guest'}
            aria-label="Guest"
            tabIndex={selectedUser === 'guest' ? 0 : -1}
            onClick={() => {
              setSelectedUser('guest');
              setErrorMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedUser('owner');
                document.getElementById('tab-btn-admin')?.focus();
              }
            }}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: selectedUser === 'guest' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)',
              fontSize: '12px',
              fontWeight: selectedUser === 'guest' ? 600 : 500,
              cursor: 'pointer',
              transition: 'color 220ms ease',
              textAlign: 'center',
            }}
          >
            Guest
          </button>
        </div>

        {/* Input Card with Reflective Metallic Plate & Dynamic Physics (React Bits) */}
        <ReflectiveCard
          id="login-card"
          className={`login-card ${isShaking ? 'login-card-shake' : ''}`}
          theme="dark"
          tint="#ffffff"
          metalness={0.9}
          roughness={0.24}
          blurStrength={6}
          shine={1.25}
          glare={0.45}
          warp={0.35}
          warpScale={1.2}
          bevel={2.5}
          enableTilt={true}
          tiltStrength={8}
          intro={true}
          radius={12}
          width="100%"
          height="auto"
          style={{
            maxWidth: '360px',
            boxSizing: 'border-box',
          }}
        >
          {/* Card Sub-Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                {selectedUser === 'owner' ? 'Owner Authorization' : 'Guest Verification'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: selectedUser === 'owner' ? '#FFFFFF' : '#A1A1AA',
                }}
              />
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.5px' }}>
                {selectedUser === 'owner' ? 'Administrator' : 'Read-Only'}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div
              id="login-error-message"
              style={{
                background: 'rgba(255, 90, 82, 0.15)',
                border: '1px solid rgba(255, 90, 82, 0.35)',
                color: '#FF8580',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                textAlign: 'center',
                lineHeight: 1.4,
                marginBottom: '12px',
              }}
            >
              {errorMessage}
            </div>
          )}

          {selectedUser === 'owner' ? (
            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '168px', boxSizing: 'border-box' }}>
              <div className="floating-input-group">
                <input
                  id="input-admin-username"
                  aria-label="Username"
                  className="floating-input"
                  type="text"
                  placeholder=" "
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                />
                <label htmlFor="input-admin-username" className="floating-label">
                  Username
                </label>
              </div>

              <div className="floating-input-group" style={{ position: 'relative' }}>
                <input
                  id="input-admin-password"
                  aria-label="Password"
                  className="floating-input"
                  type="password"
                  placeholder=" "
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <label htmlFor="input-admin-password" className="floating-label">
                  Password
                </label>
                <button
                  id="btn-submit-owner"
                  type="submit"
                  disabled={loading}
                  aria-label="Submit Password"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.18s ease',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.24)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

              <button
                id="btn-login-admin"
                type="submit"
                disabled={loading}
                aria-label="Sign in as Owner"
                style={{
                  marginTop: '4px',
                  padding: '10px 16px',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  backgroundColor: '#FFFFFF',
                  color: '#12151C',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 #FFFFFF',
                  transition: 'all 0.18s ease',
                  opacity: loading ? 0.6 : 1,
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E4E4E7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <span>Sign in as Owner</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleViewerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '168px', boxSizing: 'border-box' }}>
              <div className="floating-input-group">
                <input
                  id="input-viewer-name"
                  aria-label="Your Full Name"
                  className="floating-input"
                  type="text"
                  placeholder=" "
                  value={viewerName}
                  onChange={(e) => setViewerName(e.target.value)}
                />
                <label htmlFor="input-viewer-name" className="floating-label">
                  Your Full Name
                </label>
              </div>

              <div className="floating-input-group">
                <input
                  id="input-viewer-email"
                  aria-label="Your Email"
                  className="floating-input"
                  type="email"
                  placeholder=" "
                  value={viewerEmail}
                  onChange={(e) => setViewerEmail(e.target.value)}
                />
                <label htmlFor="input-viewer-email" className="floating-label">
                  Your Email
                </label>
              </div>

              <button
                id="btn-login-viewer"
                type="submit"
                disabled={loading}
                aria-label="Enter as Guest"
                style={{
                  marginTop: '4px',
                  padding: '10px 16px',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  backgroundColor: '#FFFFFF',
                  color: '#12151C',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 #FFFFFF',
                  transition: 'all 0.18s ease',
                  opacity: loading ? 0.6 : 1,
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E4E4E7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <span>Enter as Guest</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>
          )}
        </ReflectiveCard>
      </div>

      {/* Footer Power Controls */}
      <div
        className="lock-screen-footer"
        style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
          <WarmTooltip content="Put system to Sleep" side="top">
            <button
              id="btn-footer-sleep"
              data-testid="btn-login-sleep"
              onClick={onSleep}
              aria-label="Sleep"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                🌙
              </div>
              <span>Sleep</span>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Restart PORT OS" side="top">
            <button
              id="btn-footer-restart"
              data-testid="btn-login-restart"
              onClick={onRestart}
              aria-label="Restart"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                🔄
              </div>
              <span>Restart</span>
            </button>
          </WarmTooltip>

          <WarmTooltip content="Power off PORT OS" side="top">
            <button
              id="btn-footer-shutdown"
              data-testid="btn-login-shutdown"
              onClick={onShutdown}
              aria-label="Shut Down"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⏻
              </div>
              <span>Shut Down</span>
            </button>
          </WarmTooltip>
        </WarmTooltipGroup>
      </div>
    </div>
  );
}
