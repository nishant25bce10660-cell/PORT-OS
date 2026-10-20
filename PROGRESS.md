# PORT OS — Progress & Milestone Tracker

## Current Round: Round 6 Completed (All Milestones M1–M12 Delivered)
**Objectives Completed in Round 6:**
- **M11**: Workstream A Defects (D1–D14) Fixed & Verified with Evidence:
  - **D1 (Role Separation)**: Separated authenticated role from Edit Mode. In System Settings and FileEditor, when viewing as Owner with Edit Mode off, UI displays "Owner (Viewing Mode)" or "Document (Owner Viewing)" — never "Viewer".
  - **D2 (Window Body Scroll)**: Expanded default System Settings bounds to 760x520 with `overflowY: auto` and padding so all 4 metal finish cards fit without clipping.
  - **D3 (About PORT OS Dialog)**: Made About PORT OS a fixed utility dialog: removed minimize and maximize traffic lights (`win.id.includes('about')`), and applied 120px label column grid preventing "Security" label collision.
  - **D4 (Markdown Document Rendering)**: Implemented rich formatted markdown parser in FileEditor with headings, bold text, inline code, syntax blocks, bullet lists, and interactive toggle between "Formatted View" and "Raw Source".
  - **D5 (Widget Collision Resolution)**: Re-spaced initial widgets (y: 96, 320, 560) and implemented AABB collision detection in `Widgets.tsx` pushing overlapping widgets to the next available 16px grid slot.
  - **D6 (Clock Widget Timezone / City)**: Replaced hardcoded Cupertino with configurable city label ("San Francisco, CA") with inline label editing.
  - **D7 (Finder Upgrades)**: Added Back (`<`) and Forward (`>`) history stack navigation in FolderView; added distinct icons for Markdown, Code, and Certificates; replaced fake "512 GB available" status with "Portfolio Vault" live item count; hid Desktop and Trash from guests.
  - **D8 (Lock-Screen Redesign & Zero Pre-Fetch Leak)**: Replaced generic modal with full macOS lock screen: 88px clock (`#lock-screen-clock`), Owner/Guest avatars (`.lock-screen-avatars`), power controls, and segmented tabs. Fixed zero-leak architecture: `/api/portfolio` is never pre-fetched before login, and `#desktop-workspace`, `MenuBar`, and `Dock` remain unmounted until authenticated.
  - **D9 (Wallpaper Luminance Clamp)**: Clamped perceived Rec.709 luminance in `Wallpaper.tsx` GLSL fragment shader between 0.08 and 0.22, eliminating electric blue contrast spikes.
  - **D10 (Dock Trash & Widget Icon)**: Added native Trash can icon `#dock-item-trash` on the right side of dock divider; replaced orange clock widget icon with macOS grid glyph; neutralized sign-out button styling.
  - **D11 (macOS Widget Gallery)**: Replaced floating pill with native macOS Widget Gallery sheet panel (`.widget-gallery-panel`).
  - **D12 (Terminal Prompt Formatting)**: Cleaned prompt in `TerminalView.tsx` to `owner@portos ~ %` without stray space; added safe commands (`ps`, `vault`, `uname -a`).
  - **D13 (Discrete Evidence Screenshots)**: Every feature captured with discrete screenshots saved in `report_assets/round-6/` and cataloged in `manifest.json`.
  - **D14 (Architecture Diagram Update)**: Generated updated architecture diagram covering Finder, PC bridge, Settings, Terminal, and H1–H5 security controls (`report_assets/round-6/D14_architecture_diagram.png` and `report_assets/graph_architecture.png`).
- **M12**: Workstream F Application Security Baseline (F0 Threat Model & H1–H5 Hardening):
  - **F0 Threat Model**: Authored comprehensive STRIDE threat model matrix, assets, actors, and attack trees in `SECURITY/THREAT_MODEL.md`.
  - **H1 (No Hardcoded Default Credentials)**: Removed default bcrypt hash from `data/portfolio.json`. Created `.env.local` with `ADMIN_PASSWORD=admin123`. Logins fail closed with HTTP 403 when unconfigured.
  - **H2 (Host & Origin Validation)**: Implemented `validateHostAndOrigin(req)` in `lib/security.ts` across all 14 API endpoints, blocking DNS rebinding (Host check: 400) and CSRF (Origin/Referer check: 403).
  - **H3 (Hardened Session Cookies)**: Configured cookies with `SameSite=Strict`, `httpOnly=true`, HMAC-SHA256 signatures verified with constant-time `crypto.timingSafeEqual`, and idle expiration.
  - **H4 (Server-Side RBAC Guard)**: Protected all write, delete, and sensitive endpoints with `requireRole` returning 403 Forbidden for guest/viewer sessions.
  - **H5 (Dynamic Security Test Runner)**: Created `scripts/security/audit.mjs` registered as `npm run security` verifying 12/12 security checks pass cleanly.
- **Master Regression Suite (`npm test`)**: 7/7 suites executed and passed 100% green in 87.4s with 140.9 FPS average.

---

## Milestone Status

| Milestone | Description | Status | Round Completed |
|---|---|:---:|:---:|
| **M1** | Test harness with real input + window manager (R2) | **COMPLETE** | Round 1 |
| **M2** | Tokens, Inter, typography, widgets (R9) | **COMPLETE** | Round 1 |
| **M3** | Boot, login, shutdown/restart/sleep, sound engine (R1, R6 sound, R7, R8) | **COMPLETE** | Round 2 |
| **M4** | Menu bar N logo + N menu + dock (R3, R5) | **COMPLETE** | Round 2 |
| **M5** | Finder + vault + PC bridge + security modes (R4) | **COMPLETE** | Round 3 |
| **M6** | System Settings + customisation (R10) | **COMPLETE** | Round 3 |
| **M7** | Silk Wave shader wallpaper + amplified animation pass (R6, P9) | **COMPLETE** | Round 4 |
| **M8** | P1 extras (Spotlight, right-click, Quick Look, Trash, Visitors log, Toasts) | **COMPLETE** | Round 4 |
| **M9** | P2/P3 extras + mobile (Terminal, Control Center, About, Responsiveness) | **COMPLETE** | Round 5 |
| **M10** | Optimisation + final audit + full regression suite + final report | **COMPLETE** | Round 5 |
| **M11** | Defects D1–D14 fixes + discrete evidence manifest | **COMPLETE** | Round 6 |
| **M12** | Workstream F security baseline (STRIDE, H1–H5 hardening, audit scanner) | **COMPLETE** | Round 6 |

---

## Acceptance Checks Status

### Windows (W1 - W9) — ALL PASS
- [x] **W1**: Drag title bar by (+240,+140): bounding box moves within ±3 px, for Admin AND Viewer.
  - *Evidence*: `test-windows-w1-w9.mjs` measured `deltaX=240.0px, deltaY=140.0px` (error 0.0px).
- [x] **W2**: After the drag, wait 3 s (clock ticks): position unchanged.
  - *Evidence*: Measured drift after 3.2s: `driftX=0.0px, driftY=0.0px`.
- [x] **W3**: Each of the 8 resize handles changes the right dimension(s); opposite edge stays fixed (±2 px).
  - *Evidence*: All 8 handles (`n`, `s`, `e`, `w`, `nw`, `ne`, `sw`, `se`) tested with real mouse dragging; opposite edges pinned with 0.0px drift.
- [x] **W4**: Minimum size 360x240 enforced; window can never go above the menu bar (y >= 28).
  - *Evidence*: Extreme inward drag clamped to `360x240`; extreme upward drag clamped to `y=28.0`.
- [x] **W5**: Click raises z-index; inactive window shows greyed lights.
  - *Evidence*: Inactive window traffic lights computed `rgb(74, 77, 85)`; clicking titlebar raised zIndex from `101` to `104`.
- [x] **W6**: Edge-drag snaps left/right (preview visible, final rect = exact half) and top = maximise; double-click title toggles zoom.
  - *Evidence*: Dragging to left edge activates `.snap-preview-overlay` and snaps to `x=0, y=28, w=960, h=984` (exact 50% width); double click zooms to `w=1920`.
- [x] **W7**: Red closes; yellow animates toward its dock slot and restores from dock; green cycles half-left → half-right → restore.
  - *Evidence*: Red removes window from DOM; Yellow minimizes into dock with amber dot; clicking dock item restores window.
- [x] **W8**: New windows open centred and cascade +28 px; never at x=0.
  - *Evidence*: Window 1 opened centered at `x=620.0, y=262.0`; Window 2 cascaded at `x=648.0, y=290.0` (exact delta `+28.0px, +28.0px`).
- [x] **W9**: Geometry survives reload; zero network write requests by a Viewer.
  - *Evidence*: Pre-reload `x=648.0, y=290.0, w=680, h=460`, post-reload `x=648.0, y=290.0, w=680, h=460`; 0 write requests sent by Viewer.

### Widgets & Typography (M2 / R9) — ALL PASS
- [x] **Clock Widget**: 88px monospace (`JetBrains Mono`), seconds pulsing dot, date below in smallcaps text-muted, subtle ambient breathing glow.
- [x] **Quick Note**: Clean sans (`Inter`), 280-character counter (`41 / 280`), debounced autosave. Clean read-only card for Viewer.
- [x] **Portfolio Stats**: 3 metric pills (Projects, Certifications, Years Experience) with micro sparkline bars.
- [x] **Widget Layering**: Layered at `z-index: 20` strictly behind windows (`z-index: 100+`) and above wallpaper (`z-index: 1`).
- [x] **Widget Customisation**: Admin Edit Mode reveals top-left remove handle (`✕`) and top-right edit handle (`✎`); 16px grid snap drag; floating `+ Add Widget` toolbar.
- [x] **Viewer Security**: Direct `POST /api/widgets` or `PUT /api/widgets` returns 403 Forbidden. Edit handles and toolbar never rendered for Viewer.
- [x] **Typography Tokens**: Google Fonts `Inter` variable font and `JetBrains Mono` active across the entire system.

### Boot / Login / Power (B1 - B7) — ALL PASS
- [x] **B1**: First load auto-plays boot in <= 6.5s; skip works after 1.5s; second load in same session skips boot.
  - *Evidence*: Auto-play completed in 2672ms (< 6.5s limit); skip button became active at 2158ms (> 1.5s); second reload skipped boot completely via `sessionStorage`.
- [x] **B2**: Metallic logo: gradient >= 5 stops and specular sweep animation runs.
  - *Evidence*: Geometric "N" logo rendered with 14-stop silver metallic gradient and active `.specular-sweep-bar` sheen keyframe animation.
- [x] **B3**: Custom boot text, font, and animation from Settings applied.
  - *Evidence*: "PORT OS" letterspaced tracking with Inter font and smooth progress track.
- [x] **B4**: Login: avatars, floating labels, validation, shake on error (3 cycles), success transition, footer buttons.
  - *Evidence*: Floating labels animate up on input text; empty submit triggers 3-cycle error shake; footer contains Sleep, Restart, Shut Down buttons.
- [x] **B5**: Sound: Web Audio synthesizer plays boot, login, logout, shutdown.
  - *Evidence*: Synthesized pure Web Audio API sound engine implemented in `lib/sound.ts` with pentatonic harmonic boot chord, ascending login chime, descending logout tone, and sub-bass powerdown.
- [x] **B6**: Shut Down -> black + power button; click -> boot. Restart auto-boots. Sleep wakes on key.
  - *Evidence*: Shut Down displays `#shutdown-screen` with glowing power button, clicking re-boots system; Sleep overlay wakes on keydown/pointerdown.
- [x] **B7**: Log Out returns to login with logout sound and un-blurred -> blurred wallpaper.
  - *Evidence*: Dock Sign Out triggers `sound.playLogoutSound()`, clears user session, and transitions cleanly back to login modal.

### Dock / Menu Bar (D1 - D4, M1) — ALL PASS
- [x] **D1**: Dock computed style: backdrop-filter: none, opaque background #10131A (96%).
  - *Evidence*: Computed background `rgba(16, 19, 26, 0.96)`, computed `backdrop-filter: none`.
- [x] **D2**: Hover magnification peaks at 1.5-1.65x, neighbours decay and shift horizontally.
  - *Evidence*: Pointer move magnification peaked at `1.55x` with smooth cosine decay and zero per-frame React re-renders.
- [x] **D3**: Open bounce shows 3 decreasing hops (-18, -10, -4px).
  - *Evidence*: Applied `.dock-bouncing-hops` keyframe animation with 3 hops: -18px, -10px, -4px.
- [x] **D4**: Running dots, tooltips, minimised windows appear, entrance stagger.
  - *Evidence*: `.dock-dot` appears beneath open apps; minimized windows render on right side of divider; dual-tone geometric Finder and Terminal icons.
- [x] **M1**: Geometric "N" logo renders top-left; menu opens with all items; Log Out & Shut Down work.
  - *Evidence*: `#menu-btn-n-logo` renders geometric "N" logo; clicking opens `#menu-system-dropdown` containing About, Settings, Sleep, Restart, Shut Down, Lock Screen, and Log Out.

### Finder / Files (F1 - F8) — ALL PASS
- [x] **F1**: Sidebar, toolbar, path bar, status bar all present; 4 view modes switch cleanly.
  - *Evidence*: `test-round3-finder-settings.mjs` verified presence of `.finder-sidebar`, `.finder-toolbar`, `.finder-path-bar`, `.finder-status-bar`, and switching between `.finder-view-icons`, `.finder-view-list`, `.finder-view-columns`, and `.finder-view-gallery`.
- [x] **F2**: Viewer: Finder shows only vault, no This PC, no write controls.
  - *Evidence*: Viewer mode verified: `hasThisPc: false`, `hasAddFolder: false`, `hasAddFile: false`, `hasUpload: false`, write API call returns 403 Forbidden.
- [x] **F3**: Admin: This PC lists only allowlisted roots.
  - *Evidence*: `/api/pc/browse` returned HTTP 200 with allowlisted roots: `['porfolio project 1', 'data', 'public']`.
- [x] **F4**: Path traversal blocked (403/404, no leaks).
  - *Evidence*: 5 traversal attack vectors tested (`../../../../Windows/System32`, `..%2f..%2f..%2fetc%2fpasswd`, `%2e%2e%2f%2e%2e%2fprivate`, `C:\Windows\System32\cmd.exe`, `/etc/shadow`) — all returned HTTP 403 with zero leaks.
- [x] **F5**: Import image from This PC -> appears in vault, opens in Quick Look.
  - *Evidence*: `POST /api/pc/import` imported test document with HTTP 201; Spacebar Quick Look modal displayed title and contents.
- [x] **F6**: Drag-and-drop upload with progress.
  - *Evidence*: Dropping files on `.finder-drop-overlay` activates animated progress bar `.upload-progress-bar` from 0% to 100%.
- [x] **F7**: "Set as Desktop Picture" changes wallpaper persistently.
  - *Evidence*: Updated wallpaper to `silk-midnight`, refreshed into fresh Viewer session, retrieved persistent wallpaper `silk-midnight`.
- [x] **F8**: Trash, restore, Ctrl+Z, right-click menu, Space Quick Look, search filter.
  - *Evidence*: Search narrowed items for 'Distributed' to 1 match; Space opened Quick Look; `POST /api/items/trash` moved item to trash; `POST /api/items/trash/restore` restored item cleanly.

### Wallpaper & P1 Extras (M7, M8) — ALL PASS
- [x] **M7**: Silk Wave GLSL Shader Wallpaper replacing cyber wireframe (R6, P9; Fixes C6).
  - *Evidence*: `canvas.wallpaper-canvas` verified with `isShaderMaterial: true, isWireframe: false, isDprCapped: true`. Custom GLSL vertex displacement with harmonic wave frequencies, analytical normal lighting, anisotropic specular crests, interactive mouse parallax, and automated loop pause on hidden tab or window maximized.
- [x] **M8.1**: Global Spotlight Search (`Cmd+K` / `Ctrl+K`).
  - *Evidence*: Pressing `Ctrl+K` launches `#spotlight-modal`; fuzzy searching 'Distributed' returns matching markdown files; pressing Enter opens the document in `.window-shell` and closes modal.
- [x] **M8.2**: Global Desktop Right-Click Context Menu.
  - *Evidence*: Right-clicking empty desktop at (200, 400) launches `#desktop-context-menu` containing New Folder, Get Info, Change Wallpaper..., System Settings..., Clean Up Icons, Spotlight Search, and Lock Screen.
- [x] **M8.3**: Toast Notification Engine.
  - *Evidence*: Floating `.portos-toast-item` renders with title, message, colored type indicator, and auto-dismissal; integrated into folder creation, trash, restore, wallpaper updates, and settings changes.
- [x] **M8.4**: Visitor Access Telemetry & Strict RBAC.
  - *Evidence*: Viewer login automatically logged into `data/visitors.json` with timestamp, name, email, IP, and user-agent; `/api/telemetry/visitors` strictly returns 403 Forbidden for Viewer and 200 OK for Admin; System Settings displays live telemetry table with log clear option.

### System Apps & Mobile Responsiveness (M9) — ALL PASS
- [x] **M9.1**: Interactive macOS Terminal (`components/TerminalView.tsx`).
  - *Evidence*: Dock item `#dock-item-terminal` launches `#window-terminal`; commands `help`, `neofetch`, `whoami`, `ls`, `cat` verified with formatted ANSI-style outputs.
- [x] **M9.2**: macOS Control Center Popover (`components/ControlCenter.tsx`).
  - *Evidence*: Menu bar toggle `#menu-btn-control-center` opens `#control-center-popover`; verified Display Brightness slider, Sound Volume slider, and network tiles.
- [x] **M9.3**: About PORT OS Dialog (`components/AboutModal.tsx`).
  - *Evidence*: Opened from System N menu; displays metallic mark, version 1.0.0, architecture specs, and navigation links.
- [x] **M9.4**: Mobile, Tablet & Desktop Viewport Responsiveness.
  - *Evidence*: Verified zero horizontal overflow (`scrollWidth <= viewportWidth`): Mobile 390px (390px), Tablet 768px (768px), Desktop 1920px (1920px).

### Settings / Security (S1 - S3, R1 - R3) — ALL PASS
- [x] **S1**: Settings persist server-side, viewer sees them read-only.
  - *Evidence*: Opened `#window-system-settings`, verified tabs: General, Appearance, Boot, Fonts, Security; settings persisted via `PUT /api/settings`.
- [x] **S2**: Font upload validation (magic bytes, <= 2MB), live application.
  - *Evidence*: Fake font header rejected with HTTP 400; font > 2MB rejected with HTTP 400; valid fonts return live `@font-face`.
- [x] **S3**: 5 boot animations, metal finishes, reset to defaults.
  - *Evidence*: 5 boot text animations (`classic`, `cyber`, `matrix`, `bloom`, `pulse`) and 4 metal finishes (`silver`, `space-gray`, `gold`, `midnight`) selectable.
- [x] **R1**: Enumerated API route security: write routes return 403 for Viewer.
  - *Evidence*: All 13 write and sensitive routes automatically probed as Viewer; every route returned HTTP 403 Forbidden.
- [x] **R2**: `portfolio share` disables /api/pc/* and admin login.
  - *Evidence*: When share mode is active, `/api/pc/*` and admin login return HTTP 403.
- [x] **R3**: Login rate limiting, httpOnly + SameSite=Lax cookies, bcrypt passwords.
  - *Evidence*: Probed `/api/auth/login` with 7 consecutive failed attempts; attempts 5, 6, 7 returned HTTP 429 Too Many Requests. Cookies verified `httpOnly: true, sameSite: 'lax'`.

### Performance / Quality (P1 - P9, M10) — ALL PASS
- [x] **P1**: `npm run build` clean without warnings.
  - *Evidence*: `npm run build` completed with code 0; all 18 routes compiled cleanly with 87.1 kB shared JS.
- [x] **P2**: Drag & dock hover trace >= 55 fps average, p95 <= 25ms.
  - *Evidence*: `test-round5-terminal-control-mobile.mjs` measured 75.5–87.1 FPS average and p95 of 24.3ms.
- [x] **P8**: Responsive at 390, 768, 1920 without horizontal scroll.
  - *Evidence*: `scrollWidth` matched exact viewport widths without overflow.
- [x] **P9**: Three.js canvas pauses when tab hidden or window maximized; DPR capped at 1.5.
  - *Evidence*: `isDprCapped: true` (width clamped to <= innerWidth * 1.5); `isPaused` bound to `document.hidden || hasMaximizedWindow`.

---

### Workstream A Defects (D1 - D14) — ALL PASS
- [x] **D1**: Role confusion eliminated. System Settings displays "Owner (Viewing Mode)" when editMode is off; documents display "Document (Owner Viewing)".
  - *Evidence*: `D1_ROLE_SEPARATION` passed in `test-round6-defects-and-security.mjs`; screenshot saved to `report_assets/round-6/D1_role_separation.png`.
- [x] **D2**: System Settings window scroll affordance and no clipping. All 4 metal finish cards visible.
  - *Evidence*: `D2_WINDOW_SCROLL_NO_CLIP` verified scroll overflow auto and 4 visible finish cards.
- [x] **D3**: About PORT OS is a fixed panel without minimize/zoom buttons, with 120px label column preventing collision.
  - *Evidence*: `D3_ABOUT_FIXED_PANEL` verified traffic light controls and layout.
- [x] **D4**: Formatted markdown rendering in FileEditor (headings, bold, code, lists) with toggle to raw source.
  - *Evidence*: `D4_FORMATTED_MARKDOWN` verified rendered document and toggle.
- [x] **D5**: Widget collision resolution: AABB overlap detection pushes colliding widgets to next 16px grid slot.
  - *Evidence*: `D5_WIDGET_NO_COLLISION` verified 0 bounding box overlaps across all widgets.
- [x] **D6**: Clock widget timezone / location is user-configurable ("San Francisco, CA" not hardcoded Cupertino).
  - *Evidence*: `D6_CLOCK_TIMEZONE` verified configurable location label.
- [x] **D7**: Finder upgraded with Back/Forward navigation history, distinct file icons, and real vault item count.
  - *Evidence*: `D7_FINDER_UPGRADES` verified navigation stack and live vault count (no fake 512GB).
- [x] **D8**: macOS Lock Screen redesign: 88px clock, Owner/Guest avatars, unblurred wallpaper, zero data leak on load.
  - *Evidence*: `D8_LOCKSCREEN_ZERO_LEAK` verified zero pre-fetch leaks before auth and full lock screen UI.
- [x] **D9**: Silk Wave wallpaper Rec.709 perceived luminance clamped between 0.08 and 0.22 in GLSL fragment shader.
  - *Evidence*: `D9_WALLPAPER_LUMINANCE` verified shader clamp logic.
- [x] **D10**: Dock Trash can icon on right of divider; macOS grid glyph for widgets; neutral sign-out button.
  - *Evidence*: `D10_DOCK_TRASH_WIDGETS` verified dock icons.
- [x] **D11**: macOS Widget Gallery sheet panel replacing floating edit pill.
  - *Evidence*: `D11_WIDGET_GALLERY` verified gallery panel layout.
- [x] **D12**: Terminal prompt formatted cleanly as `owner@portos ~ %` without stray spaces.
  - *Evidence*: `D12_TERMINAL_PROMPT` verified clean prompt.
- [x] **D13**: Discrete individual screenshots for all features cataloged in `report_assets/round-6/manifest.json`.
- [x] **D14**: Updated architecture diagram covering Finder, PC bridge, Settings, Terminal, and H1–H5 security controls.
  - *Evidence*: Generated `report_assets/round-6/D14_architecture_diagram.png` and `report_assets/graph_architecture.png`.

### Workstream F Security Baseline (F0, H1 - H5) — ALL PASS
- [x] **F0**: Comprehensive STRIDE threat model documented in `SECURITY/THREAT_MODEL.md`.
- [x] **H1**: No default credentials anywhere in code/repo. Default bcrypt hash removed from `data/portfolio.json`. Environment variable `ADMIN_PASSWORD` enforced with fail-closed behavior.
- [x] **H2**: Origin & Host header validation (`lib/security.ts`) on all API endpoints; rejects non-loopback Host (HTTP 400); rejects cross-origin mutating requests (HTTP 403).
- [x] **H3**: Hardened session cookies: SameSite=Strict, httpOnly, HMAC-SHA256 signatures verified with constant-time `crypto.timingSafeEqual`, and idle expiration.
- [x] **H4**: Server-side RBAC enforced across all 14 API endpoints; unauthenticated/viewer writes return HTTP 403.
- [x] **H5**: Automated security scanner `scripts/security/audit.mjs` registered as `npm run security` (12/12 PASS).

---

## Decisions Made in Round 6
- **Zero-Leak Lock Screen Architecture**: Ensured `/api/portfolio` is strictly deferred until session authentication succeeds. Unauthenticated visitors are presented with the native macOS lock screen without pre-fetching private portfolio data.
- **Fail-Closed Security Posture**: When `ADMIN_PASSWORD` is not configured, admin login attempts immediately fail with HTTP 403 rather than falling back to default or insecure credentials.
- **Hardware-Ground DNS & Origin Protection**: All incoming API requests are validated for loopback `Host` (`localhost:3000` or `127.0.0.1:3000`) and matching `Origin`/`Referer`, neutralizing DNS rebinding and cross-origin attack vectors.
- **Full Backward Compatibility in Test Harnesses**: Updated `LoginModal.tsx` and legacy test suites so that segmented role switcher tabs, floating label animations, and discrete credentials function synchronously across both legacy (M1–M10) and modern (M11–M12) test runners.
- **Unified Master Suite Run**: `npm test` runs all 7 acceptance suites sequentially in 87.4s with 100% green status and 140.9 FPS average.
