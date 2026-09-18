# 📴 Offline Login — Technical Documentation

**Feature:** Secure Offline Authentication for Paramedics / Clinical Staff  
**Version:** 1.0  
**Last Updated:** June 2026  
**Applies to:** HealthCare ePCR Frontend (React + Vite + Redux)

---

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [How It Works — Big Picture](#2-how-it-works--big-picture)
3. [Security Design](#3-security-design)
4. [File-by-File Breakdown](#4-file-by-file-breakdown)
5. [Full Login Flow Diagrams](#5-full-login-flow-diagrams)
6. [State Management](#6-state-management)
7. [UI Behaviour](#7-ui-behaviour)
8. [HIPAA Compliance Notes](#8-hipaa-compliance-notes)
9. [Limitations](#9-limitations)
10. [Testing Guide](#10-testing-guide)

---

## 1. Overview

Paramedics operate in remote or underground environments where internet connectivity
is unreliable or unavailable. Without offline support, the app crashes at the login
screen — making it completely unusable in the field.

This feature allows **clinical staff (paramedics, nurses, physicians)** to:

- ✅ Open the app without internet
- ✅ Sign in using **locally cached credentials**
- ✅ Navigate to the dashboard and work
- ✅ Have their data automatically synced when connectivity returns
- ❌ Patient OTP login **cannot** work offline (OTP requires a live SMS/email delivery)

> **HIPAA Note:** No patient data (PHI) is ever stored offline.
> Only a cryptographic hash of the staff member's password is stored,
> never the password itself.

---

## 2. How It Works — Big Picture

The feature uses **3 layers** working together:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Network Detection                                    │
│  Knows instantly when internet is lost or restored              │
│  Tools: window.online / window.offline browser events           │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│  LAYER 2 — Offline Credential Vault  (offlineAuth.js)           │
│  Stores a PBKDF2 hash of the password (100,000 SHA-256 rounds)  │
│  Lives in sessionStorage — wiped when browser tab closes        │
│  Vault auto-expires after 8 hours                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│  LAYER 3 — Auth State Preservation  (authSlice.js)              │
│  checkAuth distinguishes "network error" from "401 Unauthorized"│
│  On network error: keeps existing session alive as isOfflineSession│
│  On 401: logs user out as normal                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Security Design

### 3.1 What is PBKDF2?

**PBKDF2** (Password-Based Key Derivation Function 2) is a cryptographic algorithm
used by banks, governments, and password managers to store passwords securely.

Instead of storing your password directly, it does this:

```
password + random_salt
        ↓
  Run SHA-256 × 100,000 times
        ↓
  256-bit hash string
  (e.g. "7c2b4f9a...")
```

- The **hash** cannot be reversed back into the original password
- The **salt** is random every time → two users with the same password get different hashes
- 100,000 iterations means cracking takes **years** even with modern GPUs

### 3.2 What is Stored vs What is NOT Stored

| Data | Stored? | Where | Notes |
|------|---------|-------|-------|
| Raw password | ❌ Never | — | Never touches storage |
| PBKDF2 hash | ✅ Yes | `sessionStorage` | Cannot be reversed |
| Random salt | ✅ Yes | `sessionStorage` | Needed to verify hash |
| User profile (name, role, org) | ✅ Yes | `sessionStorage` | No clinical/patient data |
| JWT access token | ✅ Yes | `sessionStorage` | From last online login |
| Patient records | ❌ Never | — | PHI never stored offline |
| Patient names/DOB | ❌ Never | — | PHI never stored offline |

### 3.3 Why sessionStorage and NOT localStorage?

| Storage | Survives browser close? | Risk if device stolen |
|---------|------------------------|----------------------|
| `localStorage` | ✅ Yes (persists forever) | 🔴 HIGH — attacker can read it |
| `sessionStorage` | ❌ No (cleared on tab close) | 🟢 LOW — gone when browser closes |

A paramedic finishing a shift closes the browser → vault is instantly wiped.
A stolen device shows no credentials in storage.

### 3.4 Vault Expiry (8-Hour Limit)

The vault has a hard timestamp:

```
Vault seeded at:  09:00 AM
Vault expires at: 05:00 PM  (09:00 + 8 hours)

At 05:01 PM → offline login attempt is rejected
Message shown: "Offline access expired. Please reconnect to the internet."
```

Why 8 hours? A typical paramedic shift is 8–12 hours. This limits the window
during which a stolen device could be used.

---

## 4. File-by-File Breakdown

### 4.1 `src/utils/offlineAuth.js` — The Vault

**Purpose:** Manages the entire offline credential lifecycle.

**Exported Functions:**

| Function | Parameters | Returns | What It Does |
|----------|-----------|---------|--------------|
| `seedOfflineVault(email, password, userProfile)` | email, plaintext password, user object | `Promise<void>` | Called after successful online login. Hashes password + stores vault in sessionStorage. |
| `attemptOfflineLogin(email, password)` | email, plaintext password | `Promise<{ success, user? reason? }>` | Verifies entered credentials against stored hash. |
| `isOfflineLoginAvailable()` | — | `boolean` | Quick check if vault exists (reads localStorage flag only — no PHI). |
| `getOfflineCachedEmail()` | — | `string \| null` | Returns cached email for form pre-fill. |
| `getOfflineCachedName()` | — | `string \| null` | Returns "John Smith" for greeting in offline banner. |
| `clearOfflineVault()` | — | `void` | Wipes vault from sessionStorage + localStorage flag. Called on logout. |

**Vault Data Structure (stored in sessionStorage):**

```json
{
  "email": "john.smith@ems.org",
  "salt": "a3f9c2e1d84b7f60...",
  "hashHex": "7c2b4f9a1e3d8...",
  "profile": {
    "userId": 42,
    "id": 42,
    "firstName": "John",
    "lastName": "Smith",
    "role": "PARAMEDIC",
    "organizationId": 7,
    "accessToken": "eyJhbGci...",
    "refreshToken": "dGhpcyBp...",
    "isOfflineSession": false,
    "seededAt": 1751234567890
  }
}
```

---

### 4.2 `src/pages/Login.jsx` — The Login Page

**What changed:**

#### New state variables:
```js
const [isOnline, setIsOnline]                 = useState(navigator.onLine);
const [offlineAvailable, setOfflineAvailable] = useState(false);
const [cachedName, setCachedName]             = useState('');
```

#### Network event listeners (useEffect):
```js
window.addEventListener('online',  () => setIsOnline(true));
window.addEventListener('offline', () => setIsOnline(false));
```
These fire immediately when the network changes — no polling, no delay.

#### Vault check on mount (useEffect):
```js
if (isOfflineLoginAvailable()) {
  setEmail(getOfflineCachedEmail());   // pre-fills the email field
  setCachedName(getOfflineCachedName()); // for the greeting
}
```

#### Modified `handleStaffSubmit`:

```
User clicks "Sign In"
         │
         ▼
  isOnline === false ?
    │           │
   YES          NO
    │           │
    ▼           ▼
  attemptOfflineLogin()    POST /api/auth/login (existing)
    │                                │
    ├── success → loginSuccess()     ├── success → seedOfflineVault() (silent)
    │             navigate /dashboard│             loginSuccess()
    │                                │             navigate /dashboard
    └── fail → show error message    └── fail → show error message
         (no_vault / wrong_password
          / vault_expired)
```

#### Vault seeding after online login:
```js
// After successful online login:
seedOfflineVault(email, password, userProfile).catch(() => {});
// .catch() ensures vault errors never break the login flow
```

---

### 4.3 `src/store/slices/authSlice.js` — Auth State

**What changed:**

#### New state field:
```js
isOfflineSession: false  // true when logged in via cached vault
```

#### Modified `checkAuth` thunk — catch block:

**Before (original):**
```js
} catch (error) {
  if (error.response?.status === 429) { ... }
  continue; // silently skip all errors including network errors
}
```

**After:**
```js
} catch (error) {
  if (error.response?.status === 429) { ... }

  // NEW: Network error = no error.response at all
  if (!error.response) {
    const existingUser = getState().auth.user;
    if (existingUser) {
      // User was previously logged in → keep them logged in offline
      return { ...existingUser, isOfflineSession: true };
    }
    return rejectWithValue('network_offline');
  }
  continue;
}
```

**Why this matters:**  
When the app loads and calls `checkAuth()`, if the device is offline, the request
fails with a network error. Previously this caused `checkAuth.rejected` to fire →
clearing the user → logging them out. Now it returns their cached profile + marks
the session as offline.

#### Modified `checkAuth.rejected`:
```js
// NEW: Don't wipe state if rejection was purely due to no internet
if (action.payload === 'network_offline') {
  state.isInitializing = false;
  state.isChecking = false;
  return; // ← user state untouched
}
// Only clear user on explicit 401 rejection
state.user = null;
```

#### New actions & selectors:
```js
setOfflineSession(state, action) { ... }   // clear the offline flag when back online

export const selectIsOfflineSession = (s) => s.auth.isOfflineSession || false;
```

---

### 4.4 `src/components/common/OfflineBanner.jsx` — Visual Indicator

**Purpose:** Fixed top banner always visible across all pages.

**Logic:**
```
isOnline === false  OR  isOfflineSession === true
           ↓
   Show amber banner:
   "📴 Offline Mode — Signed in with cached credentials..."

isOnline becomes true again
           ↓
   Show green banner for 4 seconds:
   "✅ Back online! Connection restored successfully."
           ↓
   After 4 seconds → banner disappears
```

**Renders in:** `App.jsx` → `<BrowserRouter>` root level  
**Position:** `fixed top-0` — always visible, above all content  
**Animation:** Framer Motion spring animation (slides down from top)

---

### 4.5 `src/App.jsx` — Root Mount

Single line added:
```jsx
const App = () => (
  <BrowserRouter>
    <OfflineBanner />   {/* ← added here */}
    <AppRoutes />
  </BrowserRouter>
);
```

Placing `<OfflineBanner />` here ensures it appears on **every route** —
login page, dashboard, EPCR forms, everywhere.

---

## 5. Full Login Flow Diagrams

### 5.1 First-Time Online Login (Vault Seeding)

```
Paramedic opens app (has internet)
          │
          ▼
    Login page loads
    isOnline = true
    "Online" green pill shown
          │
          ▼
  Enters email + password → clicks "Sign In"
          │
          ▼
  POST /api/auth/login → Spring Boot backend
          │
    ┌─────┴─────┐
   200 OK      401/400
    │            │
    ▼            ▼
  loginSuccess() "Invalid credentials" error
    │
    ▼
  seedOfflineVault(email, password, userProfile)
  [runs silently in background, doesn't block UI]
    │
    ├── Generate random salt (16 bytes)
    ├── PBKDF2(password + salt, 100,000 rounds, SHA-256)
    ├── Store { email, salt, hash, profile } in sessionStorage
    └── Set localStorage flag "offline available = 1"
    │
    ▼
  navigate('/dashboard')
  ✅ Done — vault is now seeded for offline use
```

---

### 5.2 Subsequent Offline Login

```
Paramedic opens app (NO internet)
          │
          ▼
  App loads → checkAuth() called
    │
    ▼
  GET /api/auth/me → fails (network error)
    │
    ├── error.response = undefined (network error, not 401)
    │
    ▼
  existingUser in Redux state?
    │           │
   YES          NO
    │           │
    ▼           ▼
  Return { ...user,     rejectWithValue('network_offline')
           isOfflineSession: true }     │
    │                                   ▼
    ▼                         isInitializing = false
  checkAuth.fulfilled()       User = null (was never logged in)
  state.isOfflineSession = true  Navigate to /login
  User stays logged in
    │
    ▼
  navigate('/dashboard')  ← existing user bypasses login entirely
  Amber banner appears at top of every page
```

```
Paramedic opens app (NO internet) — not previously logged in this session
          │
          ▼
  Login page loads
  isOnline = false
  isOfflineLoginAvailable() = true (vault exists in sessionStorage)
    │
    ▼
  Email field auto-filled from vault
  "Offline Mode" amber banner shown inside login card
  "Welcome back, John." shown
  Button shows "📴 Sign In Offline"
          │
          ▼
  Enters password → clicks "📴 Sign In Offline"
          │
          ▼
  attemptOfflineLogin(email, password)
    │
    ├── Vault found? Yes
    ├── Email matches? Yes
    ├── PBKDF2(entered_password + stored_salt) = stored_hash? 
    │         │                    │
    │        YES                   NO
    │         │                    │
    │         ▼                    ▼
    │   { success: true, user }   { success: false, reason: 'wrong_password' }
    │         │                    │
    │         ▼                    ▼
    │   loginSuccess(user)       Show error: "Incorrect password"
    │   isOfflineSession = true
    │   navigate('/dashboard')
    │
    └── Vault expired (>8 hours)?
              │
              ▼
        clearOfflineVault()
        { success: false, reason: 'vault_expired' }
              │
              ▼
        Show: "Offline access expired (8-hour limit).
               Please reconnect to the internet to sign in."
```

---

### 5.3 Reconnection Flow

```
Paramedic comes back online (internet restored)
          │
          ▼
  window 'online' event fires
          │
    ┌─────┴─────────────────────────┐
    │                               │
    ▼                               ▼
  OfflineBanner.jsx              Login.jsx (if on login page)
  isOnline = true                isOnline = true
  Show green "Back online" flash Button changes back to "Sign In"
  Auto-hide after 4 seconds      Offline amber notice disappears
    │
    ▼
  (If user is on dashboard)
  Redux state still has isOfflineSession = true
  Next API call will succeed → checkAuth called → isOfflineSession cleared
```

---

## 6. State Management

### Redux `auth` slice state shape:

```js
{
  user: {
    userId: 42,
    id: 42,
    firstName: "John",
    lastName: "Smith",
    email: "john@ems.org",
    role: "PARAMEDIC",
    organizationId: 7,
    accessToken: "eyJhbGci...",
    refreshToken: "dGhpcyBp...",
    isOfflineSession: true,   // ← NEW field
  },
  isAuthenticated: true,
  isInitializing: false,
  isChecking: false,
  isOfflineSession: true,     // ← NEW field (mirrors user.isOfflineSession)
}
```

### Available selectors:

```js
import {
  selectAuth,
  selectUser,
  selectRole,
  selectIsAuthenticated,
  selectIsInitializing,
  selectIsOfflineSession,   // ← NEW
} from '../store/slices/authSlice';
```

### Available actions:

```js
import {
  loginSuccess,
  logout,
  setOfflineSession,    // ← NEW — dispatch(setOfflineSession(false)) to clear offline mode
} from '../store/slices/authSlice';
```

---

## 7. UI Behaviour

### Login Page Changes

| Condition | What Paramedic Sees |
|-----------|-------------------|
| Online, no vault | Normal login form, green "Online" pill |
| Online, vault exists | Normal login form, green "Online" pill |
| Offline, no vault | Amber "Offline Mode" notice: "You must sign in online first" — button disabled |
| Offline, vault exists | Amber notice with name greeting, email pre-filled, button says "📴 Sign In Offline" |
| Wrong password (offline) | "Incorrect password. Please try again." |
| Vault expired (offline) | "Offline access expired (8-hour limit). Please reconnect." |

### Global Banner (All Pages)

| Condition | Banner |
|-----------|--------|
| Online + normal session | No banner |
| Offline (network down) | 🟠 Amber: "No internet connection — working in offline mode." |
| Online + isOfflineSession | 🟠 Amber: "📴 Offline Mode — Signed in with cached credentials." |
| Just reconnected (4 sec) | 🟢 Green: "✅ Back online! Connection restored successfully." |

---

## 8. HIPAA Compliance Notes

| Requirement | How It's Met |
|-------------|-------------|
| No PHI stored offline | Only staff profile (name, role, org ID) cached. No patient data. |
| Credentials not stored in plaintext | PBKDF2 hash only — password never stored |
| Session expires | Vault has 8-hour hard expiry |
| Session cleared on close | sessionStorage auto-wipes on browser/tab close |
| Audit trail | Offline sessions tagged `isOfflineSession: true` — can be logged separately |
| Patient OTP blocked offline | OTP flow always requires network — no offline patient login |

---

## 9. Limitations

| Limitation | Reason | Workaround |
|-----------|--------|------------|
| Must log in online at least once | Vault must be seeded | Paramedics log in at station before going to field |
| Vault lost if browser closed | sessionStorage by design (HIPAA) | Log in again online |
| Offline session limited to 8 hours | Security expiry | Refresh by connecting briefly |
| AI suggestions unavailable offline | Gemini API requires network | Clear "unavailable offline" message shown |
| New data not available offline | Requires server | Read-only from last cached state |
| Patient OTP login unavailable offline | OTP requires live delivery | Patients always need connectivity |

---

## 10. Testing Guide

### Manual Testing Steps

**Test 1 — Vault Seeding (happy path)**
1. Run `npm run dev`
2. Open Chrome → go to `http://localhost:5173/login`
3. Sign in with valid staff credentials
4. After login, open DevTools → Application → Session Storage
5. Look for key `epcr.offline.vault` → verify it exists with email, salt, hashHex fields
6. ✅ Also check Local Storage for `epcr.offline.available = 1`

**Test 2 — Offline Login**
1. Sign in online first (to seed vault)
2. DevTools → Network tab → select **Offline** from throttle dropdown
3. Refresh the page
4. Go to `/login` — you should see: Offline pill, amber notice, email pre-filled
5. Enter your correct password → click "📴 Sign In Offline"
6. ✅ Should navigate to `/dashboard` with amber banner at top

**Test 3 — Wrong Password Offline**
1. Follow Test 2 steps 1-4
2. Enter a WRONG password
3. ✅ Should show: "Incorrect password. Please try again."

**Test 4 — No Vault (first use offline)**
1. Clear sessionStorage (DevTools → Application → Session Storage → clear)
2. Set Network to Offline
3. Open `/login`
4. ✅ Amber notice should say "No cached credentials found"
5. ✅ "Sign In Offline" button should be disabled/greyed out

**Test 5 — Reconnection Banner**
1. Set Network to Offline
2. Open app → notice amber banner
3. Switch Network back to Online
4. ✅ Green "Back online!" banner appears for 4 seconds then fades

**Test 6 — App Load While Offline (Already Logged In)**
1. Sign in online
2. Set Network to Offline
3. Refresh the page (F5)
4. ✅ App should load, show the dashboard (NOT the login page)
5. ✅ Amber "Offline Mode" banner visible at top

**Test 7 — Vault Expiry Simulation**
1. Open DevTools → Application → Session Storage → `epcr.offline.vault`
2. Edit the JSON: change `seededAt` to a timestamp > 8 hours ago
   ```
   "seededAt": 1000000000000
   ```
3. Set Network to Offline → try to log in
4. ✅ Should show: "Offline access expired (8-hour limit)..."

---

## Architecture Decision Record

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Password storage | PBKDF2 hash | Plaintext / bcrypt (server-side) | PBKDF2 works in browser natively via Web Crypto API |
| Session storage | sessionStorage | localStorage / IndexedDB | sessionStorage auto-clears on tab close → HIPAA-safe |
| Offline detection | browser events | polling / navigator.onLine only | Events are instant; `navigator.onLine` can be stale |
| Vault expiry | 8 hours | 24 hours / no expiry | Matches shift length; limits attack window |
| PHI caching | None | Cache API responses | Zero PHI risk; HIPAA compliant |
| Patient offline login | Blocked | Allow via cached OTP | OTP is time-sensitive; cannot be safely cached |

---

## 📈 HIPAA Offline Audit Logging Integration

To maintain absolute compliance, user activities performed during an offline session (such as offline authentication successes or failures) are buffered locally and subsequently synchronized back to the central server when the connection is restored.

### 1. Audit Log Buffer Queue
The client-side buffer is managed by [offlineAudit.js](file:///d:/HealthCareFrontEnd/src/utils/offlineAudit.js):
- Writes audit log entries to `localStorage` under the key `epcr.offline.audit.queue` to ensure logs survive browser/tab closure.
- Captures exact device-level local timestamps (`timestamp`) for forensic audit fidelity.

### 2. Auto-Synchronization
- As soon as the network transitions back to `online`, the [OfflineBanner](file:///d:/HealthCareFrontEnd/src/components/common/OfflineBanner.jsx) intercepts the connection trigger and initiates the synchronization process.
- The logs are dispatched to the backend via a bulk API request: `POST /api/audit/logs/bulk`.
- Once the backend returns a `200 OK`, the local client queue is wiped clean to prevent duplicate uploads.

### 3. Backend Endpoints
- **AuditLogService** (`saveAllLogs` method): Processes the uploaded batch of logs and saves them to MongoDB (`audit_logs` collection) while maintaining the original offline device timestamps.
- **AuditLogController** (`POST /api/audit/logs/bulk` mapping): Accepts batch uploads from client applications.

