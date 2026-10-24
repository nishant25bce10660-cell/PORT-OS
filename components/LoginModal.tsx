'use client';

import React, { useState, useEffect } from 'react';
import GeometricLogo from './GeometricLogo';
import { sound } from '@/lib/sound';

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
          style={{
            display: 'flex',
            gap: '36px',
            marginBottom: '28px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Owner Avatar */}
          <div
            id="avatar-select-owner"
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedUser('owner');
              setErrorMessage(null);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              opacity: selectedUser === 'owner' ? 1 : 0.55,
              transform: selectedUser === 'owner' ? 'scale(1.05)' : 'scale(0.95)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                padding: '3px',
                background: selectedUser === 'owner'
                  ? 'linear-gradient(135deg, #7C6CFF, #35D0BA)'
                  : 'rgba(255, 255, 255, 0.15)',
                boxShadow: selectedUser === 'owner'
                  ? '0 0 24px rgba(124, 108, 255, 0.45)'
                  : 'none',
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
              }}
            >
              Nishant Singh
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.55)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginTop: '2px',
              }}
            >
              Owner
            </div>
          </div>

          {/* Guest Avatar */}
          <div
            id="avatar-select-guest"
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedUser('guest');
              setErrorMessage(null);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              opacity: selectedUser === 'guest' ? 1 : 0.55,
              transform: selectedUser === 'guest' ? 'scale(1.05)' : 'scale(0.95)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                padding: '3px',
                background: selectedUser === 'guest'
                  ? 'linear-gradient(135deg, #35D0BA, #7C6CFF)'
                  : 'rgba(255, 255, 255, 0.15)',
                boxShadow: selectedUser === 'guest'
                  ? '0 0 24px rgba(53, 208, 186, 0.45)'
                  : 'none',
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
              }}
            >
              Guest Explorer
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.55)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginTop: '2px',
              }}
            >
              Viewer
            </div>
          </div>
        </div>

        {/* Segmented Role Switcher Tabs */}
        <div
          className="login-tabs-container"
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '3px',
            marginBottom: '14px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <button
            id="tab-btn-viewer"
            type="button"
            onClick={() => {
              setSelectedUser('guest');
              setErrorMessage(null);
            }}
            style={{
              padding: '5px 16px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: selectedUser === 'guest' ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
              color: selectedUser === 'guest' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Viewer
          </button>
          <button
            id="tab-btn-admin"
            type="button"
            onClick={() => {
              setSelectedUser('owner');
              setErrorMessage(null);
            }}
            style={{
              padding: '5px 16px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: selectedUser === 'owner' ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
              color: selectedUser === 'owner' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Admin
          </button>
        </div>

        {/* Input Card with Shake */}
        <div
          id="login-card"
          className={`login-card ${isShaking ? 'login-card-shake' : ''}`}
          style={{
            width: '100%',
            maxWidth: '360px',
            background: 'rgba(24, 28, 37, 0.75)',
            backdropFilter: 'blur(30px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {errorMessage && (
            <div
              id="login-error-message"
              style={{
                background: 'rgba(255, 90, 82, 0.15)',
                border: '1px solid rgba(255, 90, 82, 0.35)',
                color: '#FF5A52',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {errorMessage}
            </div>
          )}

          {selectedUser === 'owner' ? (
            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'var(--accent, #7C6CFF)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.2s',
                    opacity: loading ? 0.6 : 1,
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
                style={{
                  marginTop: '4px',
                  padding: '10px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: 'var(--accent, #7C6CFF)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'opacity 0.2s',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <span>Sign In (Owner)</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleViewerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                style={{
                  marginTop: '4px',
                  padding: '10px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: 'var(--accent, #7C6CFF)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'opacity 0.2s',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <span>Explore Portfolio</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>
          )}
        </div>
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
        <button
          id="btn-footer-sleep"
          data-testid="btn-login-sleep"
          onClick={onSleep}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🌙
          </div>
          <span>Sleep</span>
        </button>

        <button
          id="btn-footer-restart"
          data-testid="btn-login-restart"
          onClick={onRestart}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🔄
          </div>
          <span>Restart</span>
        </button>

        <button
          id="btn-footer-shutdown"
          data-testid="btn-login-shutdown"
          onClick={onShutdown}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⏻
          </div>
          <span>Shut Down</span>
        </button>
      </div>
    </div>
  );
}
