# Lightweight Offline-First POS

This repository contains two successive implementation strategies for an offline-capable Point-of-Sale system.

---

## <h2>1st Implementation Strategy – Single-App / Multi-View</h2>

### Architecture

- **Frontend**: one React PWA with four internal views (Cashier, Kitchen, Serving, Manager) toggled by a top navigation bar.
- **Data Layer**: shared `DataService` (LocalStorage) + `SyncEngine` for background push/pull with the backend.
- **Persistence**:
  LocalStorage keys (`pos_products`, `pos_cart`, `pos_orders`, `pos_changes`).
- **Backend**: tiny Node/Express server with LowDB and a `/sync` endpoint.

```
┌─────────────┐               ┌───────────────┐
│ React PWA   │  ↔  /sync  ↔  │  Express API  │
└─────────────┘               └───────────────┘
```

### Strengths

✔ Rapid scaffold (single code-base).  
✔ Full offline loop demonstrated (queue → reconnect → sync).  
✔ Zero navigation—stakeholder UIs live in one app.


<h3>Issues Discovered</h3>

1. LocalStorage is global per origin; all views shared the same bucket.  
   → Clearing storage on one device erased data for the others.
2. Hard to test real multi-device scenarios (everything in one tab).
3. No audit trail of which ROLE authored a change.

---


## <h2>2nd Implementation Strategy – Role-Isolated Apps</h2>

### High-Level Structure

```
apps/
  cashier-pwa/     # order entry & payment
  kitchen-pwa/     # prepare board (Pending → Ready)
  serving-pwa/     # runner board (Ready → Completed)
  manager-pwa/     # overview & analytics

packages/
  core-sdk/        # shared OfflineDataStore + SyncEngine
```

### Key Technical Pivots

1. **Role-scoped LocalStorage**

   ```ts
   const ROLE = import.meta.env.VITE_ROLE; // 'cashier', 'kitchen', ...
   const PRODUCTS_KEY = `${ROLE}_pos_products`;
   ```

   Each app writes to its own namespace (e.g. `cashier_pos_cart`).

2. **Prefixed sync meta** – per-role last-sync timestamps (`cashier_pos_sync_meta`).
3. **Change provenance** – every queued change carries its `role` for backend auditing.

4. **Build-time injection**
   ```bash
   # Cashier
   VITE_ROLE=cashier pnpm --filter cashier-pwa dev --port 5173
   # Kitchen
   VITE_ROLE=kitchen pnpm --filter kitchen-pwa dev --port 5174
   ```

### Benefits Gained

✔ Device isolation—clearing one tablet never affects others.  
✔ Realistic QA across multiple browser profiles.  
✔ Clear audit trail.  
✔ Still one shared SDK; fixes propagate everywhere.

### Next Steps

- Scaffold `apps/*` folders and adjust UI per role.
- Add `role` field to queued change objects (optional).
- (Nice-to-have) server push for instant cross-device updates.
- CI matrix to build & deploy four static bundles.

---

> **Tip:** run `pnpm dev` from each role directory with its own `VITE_ROLE` to emulate multiple devices on localhost.

db.json init

// {
// "products": [],
// "orders": [],
// "changes": []
// }

---

## Recent Bug-Fix Log

### 1. Kitchen app never received new orders when it had no local changes

**Symptom** – A fresh Kitchen app (empty change-queue) stayed out-of-date until it generated its own write.

**Root cause** – `SyncEngine.tick()` returned early when `queue.length === 0`, so it never performed a **pull-only** sync.

**Fix** – Removed the guard. `tick()` now always calls `/sync`; it simply sends an empty `changes: []` array when it has nothing to push.

> Result: every replica polls the backend on the 15 s interval (or on `online` event) and receives remote updates even if it hasn’t produced local writes.

### 2. Intermittent missing orders due to device-clock skew

**Symptom** – Some orders synced, others didn’t. One device might show 3 orders while another showed only 2.

**Root cause** – After a successful sync we stored `lastSyncAt = Date.now()`. If a device’s clock was _ahead_ of the server (or another device) it would subsequently request changes “since the future”, filtering out legitimate updates.

**Fix** – `SyncEngine` now sets `lastSyncAt` to the **maximum `ts` field** found in the `serverChanges` array returned by the backend. This makes the checkpoint deterministic and clock-agnostic.

> Result: all replicas converge regardless of client clock skew; every change carries its own logical timestamp (`ts`), and `lastSyncAt` advances monotonically based on data, not wall-time.
