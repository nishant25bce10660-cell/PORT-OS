'use client';

import React from 'react';

interface DesktopIconsProps {
  editMode: boolean;
  onOpenProjects: () => void;
  onOpenCertEducation: () => void;
  onOpenOwnersData: () => void;
  onNewFolder: () => void;
}

export default function DesktopIcons({
  editMode,
  onOpenProjects,
  onOpenCertEducation,
  onOpenOwnersData,
  onNewFolder,
}: DesktopIconsProps) {
  return (
    <div className="desktop-icons-column">
      {/* 1. Projects */}
      <div
        className="desktop-icon-item"
        id="desktop-item-projects"
        onClick={onOpenProjects}
        onDoubleClick={onOpenProjects}
        tabIndex={0}
      >
        <div className="desktop-icon-graphic">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            {/* macOS folder background */}
            <path
              d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z"
              fill="#007aff"
              fillOpacity="0.85"
            />
            {/* Folder tab */}
            <path
              d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z"
              fill="url(#folderGrad1)"
            />
            {/* Code symbol </> */}
            <path
              d="M19 23L14 28L19 33M29 23L34 28L29 33M26 21L22 35"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="folderGrad1" x1="24" y1="13" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="1" stopColor="#0284c7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="desktop-icon-label">Projects</span>
      </div>

      {/* 2. Certification & Education */}
      <div
        className="desktop-icon-item"
        id="desktop-item-cert-education"
        onClick={onOpenCertEducation}
        onDoubleClick={onOpenCertEducation}
        tabIndex={0}
      >
        <div className="desktop-icon-graphic">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path
              d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z"
              fill="#8b5cf6"
              fillOpacity="0.85"
            />
            <path
              d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z"
              fill="url(#folderGrad2)"
            />
            {/* Graduation Cap */}
            <path
              d="M24 21L14 26L24 31L34 26L24 21Z"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M17 27.5V33C17 35 20.134 36.5 24 36.5C27.866 36.5 31 35 31 33V27.5"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="folderGrad2" x1="24" y1="13" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a78bfa" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="desktop-icon-label">Certification & Education</span>
      </div>

      {/* 3. Owner's Data */}
      <div
        className="desktop-icon-item"
        id="desktop-item-owners-data"
        onClick={onOpenOwnersData}
        onDoubleClick={onOpenOwnersData}
        tabIndex={0}
      >
        <div className="desktop-icon-graphic">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path
              d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z"
              fill="#10b981"
              fillOpacity="0.85"
            />
            <path
              d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z"
              fill="url(#folderGrad3)"
            />
            {/* User icon */}
            <circle cx="24" cy="24" r="4.5" stroke="#ffffff" strokeWidth="2" />
            <path
              d="M17 34C17 31 20 29.5 24 29.5C28 29.5 31 31 31 34"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="folderGrad3" x1="24" y1="13" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34d399" />
                <stop offset="1" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="desktop-icon-label">Owner&apos;s Data</span>
      </div>

      {/* 4. New Folder icon in Edit mode */}
      {editMode && (
        <div
          className="desktop-icon-item"
          id="desktop-item-new-folder"
          onClick={onNewFolder}
          onDoubleClick={onNewFolder}
          tabIndex={0}
        >
          <div className="desktop-icon-graphic">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M6 10C6 8.34315 7.34315 7 9 7H18.5858C19.3815 7 20.1446 7.31607 20.7071 7.87868L23.1213 10.2929C23.6839 10.8554 24.447 11.1716 25.2426 11.1716H39C40.6569 11.1716 42 12.5147 42 14.1716V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V10Z"
                fill="#f59e0b"
                fillOpacity="0.85"
              />
              <path
                d="M6 16C6 14.3431 7.34315 13 9 13H39C40.6569 13 42 14.3431 42 16V37C42 38.6569 40.6569 40 39 40H9C7.34315 40 6 38.6569 6 37V16Z"
                fill="url(#folderGrad4)"
              />
              {/* Plus icon */}
              <path
                d="M24 22V32M19 27H29"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="folderGrad4" x1="24" y1="13" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="desktop-icon-label">+ New Folder</span>
        </div>
      )}
    </div>
  );
}
