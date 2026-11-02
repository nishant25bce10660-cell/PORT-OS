'use client';

import React, { useState, useRef } from 'react';
import { OwnerInfo } from '@/lib/types';
import Lanyard, { LanyardHandle } from './Lanyard';

interface OwnerProfileViewProps {
  owner: OwnerInfo;
  canEdit: boolean;
  onSaveOwner: (updated: OwnerInfo) => Promise<void>;
}

export default function OwnerProfileView({ owner, canEdit, onSaveOwner }: OwnerProfileViewProps) {
  const [formData, setFormData] = useState<OwnerInfo>(owner);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const lanyardRef = useRef<LanyardHandle | null>(null);

  const handleCopyEmail = () => {
    if (owner.email) {
      navigator.clipboard.writeText(owner.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      await onSaveOwner(formData);
      setStatusMsg('Saved profile successfully!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="owner-profile-view"
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        background: 'rgba(15, 17, 24, 0.94)',
        color: '#fff',
        fontFamily: 'var(--font-ui)',
        overflow: 'hidden',
      }}
    >
      {/* 3D Lanyard Interactive Physics Badge Column */}
      <div
        className="owner-lanyard-column"
        style={{
          flex: '1 1 50%',
          minWidth: '320px',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(12, 15, 22, 0.6)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
            Official Identification Badge
          </span>
        </div>

        {/* The 3D Lanyard Component centered with clean textures (no gradients) */}
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Lanyard
            ref={lanyardRef}
            frontImage="/card-front.png"
            backImage="/card-back.png"
            strapImage="/band.png"
            anchor="center"
            cardColor="#0f172a"
            strapColor="#111827"
            finish="glossy"
            metal="silver"
            size={0.64}
            strapLength={0.46}
            gravity={1.1}
            damping={0.48}
            elasticity={0.52}
            breeze={0.3}
            interactive={true}
            intro={true}
          />
        </div>

        {/* Interactive Helper Cue */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            zIndex: 10,
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.04em',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '4px 14px',
            borderRadius: '20px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          Tap badge to interact • Drag to swing
        </div>
      </div>

      {/* Profile & Credentials Column (Accessible from right side) */}
      <div
        className="owner-info-column"
        style={{
          flex: '1 1 50%',
          minWidth: '320px',
          height: '100%',
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {canEdit ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>Edit Owner Profile (Admin)</h3>
              {statusMsg && <span style={{ fontSize: '12px', color: '#34d399' }}>{statusMsg}</span>}
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Professional Title</label>
              <input
                type="text"
                id="input-owner-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bio / Summary</label>
              <textarea
                id="input-owner-bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '12px',
                  lineHeight: '1.5',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
                <input
                  type="text"
                  id="input-owner-email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Location</label>
                <input
                  type="text"
                  id="input-owner-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>GitHub URL</label>
                <input
                  type="text"
                  id="input-owner-github"
                  value={formData.github || ''}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>LinkedIn URL</label>
                <input
                  type="text"
                  id="input-owner-linkedin"
                  value={formData.linkedin || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-save-owner"
              disabled={saving}
              style={{
                padding: '10px 16px',
                background: 'var(--accent-blue)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                marginTop: '8px',
              }}
            >
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        ) : (
          <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Badge (Name avatar and heading removed per user directive) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38bdf8', fontWeight: 600 }}>
                  Role &amp; Specialization
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '4px 0 0 0' }}>
                  {owner.title || 'System Architect & Chief Engineer'}
                </h3>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                📍 {owner.location || 'Mumbai, INDIA'}
              </div>
            </div>

            {/* Direct Contact & Accessible Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Direct Contact &amp; Communication
              </span>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>✉️</span>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Primary Email</div>
                      <a
                        href={`mailto:${owner.email}`}
                        id="link-owner-email"
                        style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}
                      >
                        {owner.email}
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-copy-email"
                    onClick={handleCopyEmail}
                    style={{
                      padding: '4px 10px',
                      background: copiedEmail ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      border: copiedEmail ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: copiedEmail ? '#34d399' : '#e2e8f0',
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copiedEmail ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {owner.github && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🐙</span>
                    <a href={owner.github} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                      {owner.github}
                    </a>
                  </div>
                )}
                {owner.linkedin && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '14px' }}>💼</span>
                    <a href={owner.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                      {owner.linkedin}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Bio / Overview */}
            {owner.bio && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Overview
                </span>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: '#e2e8f0',
                  }}
                >
                  {owner.bio}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
