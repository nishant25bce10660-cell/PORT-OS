# PORT OS — Personal Portfolio Desktop

**A Dark macOS-Style Desktop Operating System Running in the Browser**

PORT OS is a high-performance, browser-native web operating system tailored for a personal software engineering portfolio. It features hardware-accelerated 3D graphics, spring-animated window management, a procedural Web Audio sound engine, an interactive terminal shell, and strict server-enforced role-based access control (RBAC).

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Production Build
```bash
npm run build
npm start
```

### 4. CLI Usage
```bash
# Start server and automatically launch default browser
npx portfolio

# Start server in read-only portfolio share mode
npx portfolio share
```

---

## 🔑 Authentication Roles

- **Guest / Viewer Session**:
  - Name and email validation on the login screen.
  - Grants read-only access to portfolio projects, certifications, interactive terminal, and Quick Look.
  - Server strictly shields all write routes (`POST`, `PUT`, `DELETE`), returning `403 Forbidden`.
- **Owner / Admin Session**:
  - Username: `admin`
  - Password: `admin123`
  - Grants full write access: desktop folder creation, markdown editing, widget customization with 16px grid snapping, System Settings, and local PC file bridge.

---

## 📁 Repository Structure

```
porfolio project 1/
├── app/                          # Next.js 14 App Router
│   ├── api/                      # Node.js API Routes (Server-side RBAC)
│   │   ├── auth/                 # Login (HMAC + Rate Limit) & Logout
│   │   ├── items/                # Vault files, folders, and trash management
│   │   ├── pc/                   # Allowlisted host PC file bridge (Admin only)
│   │   ├── portfolio/            # Portfolio data endpoint
│   │   ├── session/              # User role & session introspection
│   │   ├── settings/             # System settings & font upload validator
│   │   ├── telemetry/            # Visitor logging & audit
│   │   └── widgets/              # Widget state persistence
│   ├── globals.css               # Global theme & typography rules
│   ├── layout.tsx                # Root layout & HTML meta
│   └── page.tsx                  # Desktop workspace coordinator
├── bin/                          # CLI executable
│   └── portfolio.js              # "portfolio" and "portfolio share" launcher
├── components/                   # Modular React UI components
│   ├── AboutModal.tsx            # About PORT OS dialog
│   ├── BootScreen.tsx            # Animated boot emblem & progress bar
│   ├── ContextMenu.tsx           # Desktop right-click context menu
│   ├── ControlCenter.tsx         # macOS Control Center popover
│   ├── DesktopIcons.tsx          # Desktop folder & file icons
│   ├── Dock.tsx                  # Squircle dock with cosine magnification
│   ├── FileEditor.tsx            # Markdown editor with live preview
│   ├── FolderView.tsx            # macOS Finder (sidebar, toolbar, 4 view modes)
│   ├── GeometricLogo.tsx         # 14-stop metallic silver "N" mark
│   ├── LoginModal.tsx            # Lock screen login card with error shake
│   ├── MenuBar.tsx               # Top menu bar & system dropdown
│   ├── OwnerProfileView.tsx      # Owner contact & credentials
│   ├── PowerOverlay.tsx          # Shut Down, Sleep & Restart overlays
│   ├── QuickLookModal.tsx        # Spacebar file preview modal
│   ├── SpotlightModal.tsx        # Global Ctrl+K fuzzy search modal
│   ├── SystemSettings.tsx        # 5-tab system customization panel
│   ├── TerminalView.tsx          # Interactive portsh terminal shell
│   ├── ToastContainer.tsx        # Frosted notification alert banner
│   ├── Wallpaper.tsx             # Three.js GLSL Silk Wave shader
│   ├── Widgets.tsx               # Draggable clock, notes & stats widgets
│   └── Window.tsx                # 8-handle resizable window frame
├── data/                         # Persistent JSON data store
│   ├── portfolio.json            # Portfolio vault, widgets & settings
│   └── visitors.json             # Viewer session telemetry
├── lib/                          # Core system libraries & utilities
│   ├── auth.ts                   # HMAC-SHA256 cookie session tokens
│   ├── data.ts                   # Atomic JSON file I/O operations
│   ├── motion.ts                 # Spring physics & easing constants
│   ├── pc-guard.ts               # Path traversal prevention & share mode
│   ├── sound.ts                  # Web Audio API procedural synthesizer
│   ├── telemetry.ts              # Visitor access auditing
│   ├── toast.ts                  # Event-driven notification bus
│   ├── tree.ts                   # Folder hierarchy tree manipulation
│   ├── types.ts                  # TypeScript interface contracts
│   └── window-store.ts           # Window geometry & persistence helpers
├── report_assets/                # Acceptance test visual evidence
│   ├── round-1/                  # Window drag & widget hierarchy evidence
│   ├── round-2/                  # Boot, audio & dock evidence
│   ├── round-3/                  # Finder & settings evidence
│   ├── round-4/                  # Silk Wave GLSL shader & Spotlight evidence
│   ├── round-5/                  # Terminal, Control Center & FPS evidence
│   └── *.png                     # High-level architecture & audit charts
├── scripts/                      # Test automation & report generation
│   ├── build-word-report.mjs     # Generates Microsoft Word (.docx) report
│   ├── test-acceptance.mjs       # Original 13-phase acceptance audit
│   └── tests/                    # Master round test suites
│       ├── run-all-tests.mjs     # Full test suite sequential orchestrator
│       ├── test-windows-w1-w9.mjs
│       ├── test-m2-widgets-typography.mjs
│       ├── test-round2-boot-dock-menu.mjs
│       ├── test-round3-finder-settings.mjs
│       ├── test-round4-shader-spotlight.mjs
│       └── test-round5-terminal-control-mobile.mjs
├── styles/                       # CSS design tokens
│   └── tokens.css                # Color, spacing, radius & motion tokens
├── Portfolio_OS_Progress_Report.docx # Formatted Word format progress report
├── PORT_OS_PROGRESS_REPORT.md    # Companion Markdown progress report
└── PROGRESS.md                   # Round-by-round engineering tracker
```

---

## 🧪 Test Automation

Run all test suites sequentially:
```bash
npm test
```

Or run individual suites:
```bash
# Window Manager & Dragging (W1–W9)
node scripts/tests/test-windows-w1-w9.mjs

# Widgets & Design Tokens (M2)
node scripts/tests/test-m2-widgets-typography.mjs

# Boot, Audio, Dock & Menu (M3 & M4)
node scripts/tests/test-round2-boot-dock-menu.mjs

# Finder, PC Bridge & Settings (M5 & M6)
node scripts/tests/test-round3-finder-settings.mjs

# Shader Wallpaper & Spotlight (M7 & M8)
node scripts/tests/test-round4-shader-spotlight.mjs

# Terminal, Control Center & Mobile Viewports (M9 & M10)
node scripts/tests/test-round5-terminal-control-mobile.mjs
```

---

## 📊 Reports

- **Microsoft Word Report**: Open [`Portfolio_OS_Progress_Report.docx`](file:///D:/porfolio%20project%201/Portfolio_OS_Progress_Report.docx).
- **Markdown Report**: Read [`PORT_OS_PROGRESS_REPORT.md`](file:///D:/porfolio%20project%201/PORT_OS_PROGRESS_REPORT.md).
- **Milestone Tracker**: Read [`PROGRESS.md`](file:///D:/porfolio%20project%201/PROGRESS.md).
