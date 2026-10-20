# PORT OS — Security Threat Model (F0)

**Version:** 1.0.0  
**Scope:** PORT OS Web Application, Local PC Bridge API, Zustand Desktop Shell, CLI Tunnel Engine  
**Author:** Security & Core Engineering Team  

---

## 1. System Overview & Asset Inventory

PORT OS is a personal desktop portfolio operating system running in the browser with Next.js App Router and Node.js backend. In Owner mode, PORT OS bridges with the owner's local filesystem for vault file imports and administrative customization. In Guest/Viewer mode or Share (Tunnel) mode, it serves as a hardened, read-only interactive portfolio.

### Critical Assets:
| Asset ID | Asset Description | Confidentiality | Integrity | Availability |
|---|---|:---:|:---:|:---:|
| **A1** | Owner Host Filesystem (`/api/pc/*`) | **CRITICAL** | **CRITICAL** | MEDIUM |
| **A2** | Portfolio Data Vault (`data/portfolio.json`) | MEDIUM | **HIGH** | **HIGH** |
| **A3** | Admin Authentication & Passwords | **CRITICAL** | **CRITICAL** | **HIGH** |
| **A4** | Session Integrity & Auth HMAC Secret | **CRITICAL** | **CRITICAL** | **HIGH** |
| **A5** | Visitor Telemetry & PII (`data/visitors.json`) | **HIGH** | MEDIUM | MEDIUM |
| **A6** | Client-Side Shell & Shader Runtime | LOW | MEDIUM | **HIGH** |

---

## 2. Threat Actors & Capabilities

1. **TA-1: Malicious Third-Party Websites (Cross-Origin)**
   - Capabilities: Can execute JavaScript in the owner's browser while PORT OS is running locally on `localhost:3000`.
   - Vectors: Cross-Site Request Forgery (CSRF), Cross-Origin Resource Sharing (CORS) exploitation, and DNS Rebinding.
2. **TA-2: Unauthenticated Internet Visitors (Public/Tunnel Mode)**
   - Capabilities: Can connect to PORT OS via `portfolio share` tunnels or public network interfaces.
   - Vectors: Brute-force attacks against admin login, parameter tampering, path traversal, CSV/XSS injection in visitor telemetry.
3. **TA-3: Authenticated Guest / Viewer**
   - Capabilities: Holds a valid guest session token.
   - Vectors: Privilege escalation attempts to call write routes (`PUT /api/portfolio`, `POST /api/items`, `DELETE /api/items/trash`), bypassing UI restrictions.
4. **TA-4: Rogue Local Processes**
   - Capabilities: Other processes running under the same user on the owner's machine.
   - Vectors: Connecting to loopback ports, monitoring unencrypted file writes.

---

## 3. STRIDE Threat Analysis Matrix

| Threat Category | Threat Scenario | Impact | Mitigation / Hardening Control |
|---|---|---|---|
| **Spoofing** | Attacker crafts a forged `portos_session` HMAC cookie. | Unauthorized Admin takeover | Constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`), randomized cookie secret fallback, and strict payload expiration checks. |
| **Spoofing** | Attacker spoofs `Host` header to execute DNS Rebinding attacks. | Remote website accesses local PC API | `validateHostAndOrigin`: Strict loopback hostname enforcement (`localhost`, `127.0.0.1`, `::1`). Requests with non-loopback hosts rejected with HTTP 400. |
| **Tampering** | Attacker issues cross-origin `POST`/`PUT` requests via user's browser. | Unauthorized filesystem mutation | `SameSite=Strict` cookies + `validateHostAndOrigin` Origin/Referer check on all mutating methods (`POST`, `PUT`, `DELETE`). Cross-origin requests rejected with HTTP 403. |
| **Tampering** | Guest user submits malicious filename with `../` traversal in PC bridge or vault. | Arbitrary file read/overwrite | Strict allowlist roots for PC browse/read (`lib/pc-guard.ts`), `path.resolve` verification, and traversal pattern blocking (HTTP 403). |
| **Repudiation** | Attacker clears visitor logs or accesses administrative settings without trace. | Loss of audit trail | Server-side RBAC guard requiring `role === 'admin'` for `GET`/`DELETE` `/api/telemetry/visitors`. |
| **Information Disclosure** | Portfolio API response exposes owner's password hash or local filesystem paths. | Credential compromise | Dynamic sanitization in `GET /api/portfolio`: `passwordHash` field stripped; unauthenticated pre-fetch blocked (D8). |
| **Information Disclosure** | PC bridge routes exposed when server is shared publicly via tunnel (`portfolio share`). | Arbitrary local file reading by public users | Fail-closed share mode guard (`isShareModeActive()`): `/api/pc/*` routes and admin login immediately return HTTP 403 when tunnel is active. |
| **Denial of Service** | Attacker spams login endpoint to overwhelm CPU via bcrypt hashing. | CPU starvation | IP-based rate limiting (5 failed attempts per 60s sliding window) returning HTTP 429. Font upload size capped at 2MB with magic byte validation. |
| **Elevation of Privilege** | Guest user submits `PUT /api/widgets` or `PUT /api/settings` to rewrite owner configs. | Full portfolio defacement | Strict server-side RBAC checking `session.role === 'admin'`. UI state (`editMode`) does not grant server-side write capability. |

---

## 4. Attack Trees & Defensive Depth

### Attack Tree 1: Local PC Bridge Compromise via Malicious Web Page
```
[Goal: Read Arbitrary File from Owner's PC]
  ├── Path A: DNS Rebinding
  │     ├── Register domain resolving to 127.0.0.1
  │     ├── Target requests to http://malicious-domain:3000/api/pc/read
  │     └── [BLOCKED by validateHostAndOrigin: Host header != loopback, returns 400]
  │
  ├── Path B: Cross-Origin Fetch / CSRF
  │     ├── Malicious website sends fetch('http://localhost:3000/api/pc/read')
  │     ├── [BLOCKED by SameSite=Strict cookies: session cookie omitted]
  │     └── [BLOCKED by validateHostAndOrigin: Origin header != loopback, returns 403]
  │
  └── Path C: Path Traversal
        ├── Attacker attempts GET /api/pc/read?path=../../Windows/System32/cmd.exe
        └── [BLOCKED by lib/pc-guard.ts: path outside allowlisted roots, returns 403]
```

### Attack Tree 2: Unauthorized Admin Takeover
```
[Goal: Obtain Admin Privilege]
  ├── Path A: Hardcoded Default Credentials
  │     └── [ELIMINATED: Zero default password hashes in repository or data files]
  │     └── [FAIL-CLOSED: Unconfigured admin logins return HTTP 403]
  │
  ├── Path B: Session Token Forgery
  │     └── [BLOCKED: HMAC-SHA256 signature with secret key, timingSafeEqual comparison]
  │
  └── Path C: UI State Manipulation (D1 Defect Fix)
        └── [BLOCKED: Client editMode is purely aesthetic; server strictly enforces session.role]
```

---

## 5. Security Regression Verification Protocol

All security controls are verified continuously via automated regression harnesses:
1. `npm test` runs comprehensive defect and security suite `scripts/tests/test-round6-defects-and-security.mjs`.
2. `node scripts/security/audit.mjs` runs automated static AST scans, dependency vulnerability checks, and dynamic fuzzing tests.
