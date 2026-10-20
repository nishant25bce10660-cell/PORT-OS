'use client';

import React, { useState } from 'react';
import { OwnerInfo } from '@/lib/types';

interface OwnerProfileViewProps {
  owner: OwnerInfo;
  canEdit: boolean;
  onSaveOwner: (updated: OwnerInfo) => Promise<void>;
}

export default function OwnerProfileView({ owner, canEdit, onSaveOwner }: OwnerProfileViewProps) {
  const [formData, setFormData] = useState<OwnerInfo>(owner);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', background: 'rgba(22, 23, 30, 0.85)' }}>
      {canEdit ? (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Edit Owner Profile (Admin)</h3>
            {statusMsg && <span style={{ fontSize: '12px', color: '#34d399' }}>{statusMsg}</span>}
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name</label>
            <input
              type="text"
              id="input-owner-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              rows={4}
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
        <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Avatar Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                color: '#fff',
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.35)',
              }}
            >
              👨‍💻
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                {owner.name}
              </h2>
              <p style={{ fontSize: '13px', color: '#93c5fd', fontWeight: 500, marginTop: '2px' }}>
                {owner.title}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                📍 {owner.location}
              </p>
            </div>
          </div>

          {/* Bio */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#e2e8f0',
            }}
          >
            {owner.bio}
          </div>

          {/* Contact Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Direct Contact & Socials
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>✉️</span>
                <span style={{ color: '#fff' }}>{owner.email}</span>
              </div>
              {owner.github && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>🐙</span>
                  <a href={owner.github} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                    {owner.github}
                  </a>
                </div>
              )}
              {owner.linkedin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>💼</span>
                  <a href={owner.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                    {owner.linkedin}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
