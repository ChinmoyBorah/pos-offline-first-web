# Lightweight Offline-First POS

How to run in development environment:

1. git clone https://github.com/ChinmoyBorah/pos-offline-first-web.git
2. Go to /frontend directory
3. npm install
4. Spin multiple versions of the app based on role -> cashier, kitchen, service
   VITE_ROLE=cashier npm run dev -- --port 5174
   VITE_ROLE=kitchen npm run dev -- --port 5175
   VITE_ROLE=cashier npm run dev -- --port 5176
   VITE_ROLE=cashier npm run dev -- --port 5177
5. Go to server directory
6. npm install and npm run dev

<h2>Below is the implementation strategies for an offline-capable Point-of-Sale system.</h2>

---

<h3>High level Implementation Strategy – Single-App / Multi-View</h3>

    Architecture

    - **Frontend**: one React PWA with four internal views (Cashier, Kitchen, Serving, Manager) toggled by a top navigation bar. Role based isolation of apps*.

    - **Data Layer**: shared `DataService` (LocalStorage) + `SyncEngine` for background push/pull with the backend.
    - **Persistence**:

      LocalStorage keys (`pos_products`, `pos_cart`, `pos_orders`, `pos_changes`).

    - **Backend**: tiny Node/Express server with LowDB and a `/sync` endpoint.

    ```
    ┌─────────────┐               ┌───────────────┐
    │ React PWA   │  ↔  /sync  ↔  │  Express API  │
    └─────────────┘               └───────────────┘

    ```

<h3>Role based Strategy – Role-Isolated Apps</h3>

High-Level Structure

```
apps -> Run multiple versions of the app based on role -> cashier, kitchen, service
  cashier-pwa/     # order entry & payment
  kitchen-pwa/     # prepare board (Pending → Ready)
  serving-pwa/     # runner board (Ready → Completed)
  manager-pwa/     # overview & analytics

packages ->
  features/        # shared OfflineDataStore + SyncEngine

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
   VITE_ROLE=cashier npm run dev -- --port 5173
   # Kitchen
   VITE_ROLE=kitchen npm run dev -- --port 5174
   ```

---

db.json init

// {
// "products": [],
// "orders": [],
// "changes": []
// }

---

<h2>Below is a deep-dive explanation of the current lightweight POS prototype, walking through the entire data journey—from a tap on the “Add” button to the moment every device converges.</h2>

────────────────────────────────────────

1. Front-End Flow (per role)
   ────────────────────────────────────────
   A. UI composition  
    • The React tree is extremely thin:  
    Cashier → `CatalogList` + `CartDrawer`  
    Kitchen → `OrderBoard` (Pending, Preparing)  
    Serving → `OrderBoard` (Ready)  
    Manager → `OrderBoard` (all)  
    • Each app starts `syncEngine.start()` once and shows a `SyncBadge` with the
   current status (`idle`, `syncing`, `error`).

B. User interaction sequence (Cashier example)

1.  User taps “Add” next to a product  
    → `CatalogList` calls `DataService.addToCart(productId)`
2.  `addToCart()`  
     • Reads current cart from LocalStorage  
     • Mutates it in memory, persists it back (`<ROLE>_pos_cart`)  
     • Emits `cartListeners` so the UI updates instantly  
     • Appends a **change object** to the queue (`<ROLE>_pos_changes`)  
     `json
{ "id":"1693502921-abc", "type":"cartAdd",
  "payload":{ "productId":"1" }, "ts":1693502921 }
` 3. User hits “Checkout”  
     → `createOrder(cart)`  
     • Builds an `order` object `{ id, items, status:'pending', ts }`  
     • Saves the order to `<ROLE>_pos_orders`  
     • Queues an `addOrder` change  
     • Clears the cart (and emits event so drawer empties)

C. Role isolation  
 All keys are prefixed by `VITE_ROLE` (`cashier_pos_cart`, `kitchen_pos_orders`, …) so no two roles ever overwrite each other’s cache.

──────────────────────────────────────── 2. LocalStorage Buckets & Queuing Rules
────────────────────────────────────────
| Key (per-role) | Contents |
|---------------------------|-------------------------------------------|
| `<ROLE>_pos_products` | Seed product catalog (array of objects) |
| `<ROLE>_pos_cart` | `{ productId → qty }` map |
| `<ROLE>_pos_orders` | Array of orders with status |
| `<ROLE>_pos_changes` | **FIFO change log** (objects with `id`, `type`, `payload`, `ts`) |
| `<ROLE>_pos_sync_meta` | `{ lastSyncAt: number }` |

Queuing rules  
 • Every _mutation_ goes through `queueChange()` which pushes the mini-delta and
never blocks the UI.  
 • Each change gains a Lamport-style `ts = Date.now()` so devices can order them
without a central counter.  
 • No change is ever removed until the backend acknowledges (`acceptedIds`).

──────────────────────────────────────── 3. Synchronisation Loop
────────────────────────────────────────
A. Front-End (`SyncEngine`)

    ```
    tick() every 15 s or on navigator.onLine:
    1. Read queue   →   changes []
    2. POST /sync   →   { changes, lastSyncAt }
    3. On success:
      • remove acceptedIds from queue
      • apply serverChanges via DataService.applyRemoteChange()
      • lastSyncAt = max( lastSyncAt, ...serverChanges.ts )
    ```

    Why it works:
    • By always calling `/sync` (even with an empty queue) each app performs a pure **pull** when it has nothing to push—solving the “Kitchen never refreshes” bug.
    • Clock skew cannot drop updates because we advance `lastSyncAt` using the
      timestamp embedded in the data, not the device clock.

    B.  Backend (`POST /sync`)

    Pseudo-code inside `server.js`:

    ```js
    app.post('/sync', async (req, res) => {
      const { changes=[], lastSyncAt=0 } = req.body;

      // 1. Persist inbound changes
      for (c of changes) {
        db.data.changes.push(c);
        switch(c.type) {
          case 'addOrder':          db.data.orders.push(c.payload);           break;
          case 'updateOrderStatus': updateStatus(c.payload);                  break;
          /* other types ... */
        }
      }
      await db.write();

      // 2. Compose outbound payload
      const serverChanges = db.data.changes.filter(c => c.ts > lastSyncAt);

      res.json({ serverChanges, acceptedIds: changes.map(c => c.id) });
    });
    ```

    Important details
    • **Idempotency**: repeating the same change ID is harmless because we always
      *upsert*.
    • **Partial sync**: `lastSyncAt` acts like a cursor—only newer changes are sent,
      so payload stays small even with a large history.
    • **Stateless clients**: the server never stores per-device cursors; each device
      tells the server where it left off.

    C.  Conflict & Convergence
    • Financial data is append-only (`addOrder`) so it never conflicts.
    • Status updates: latest timestamp wins (`updateOrderStatus`).
    • Because all replicas apply the exact same deterministic rules, they inevitably
      converge after exchanging their change logs.

    ────────────────────────────────────────

4.  End-to-End Timeline Example
    ────────────────────────────────────────
    1️⃣ Cashier (offline) queues `addOrder (ts=100)`  
    2️⃣ Cashier goes online → pushes change → server stores & echoes  
    3️⃣ Kitchen is still offline (queue empty)  
    4️⃣ Kitchen regains connectivity → sends `changes:[] , lastSyncAt:0`  
     Server responds with `[ addOrder@100 ]`  
    5️⃣ Kitchen applies order, sets `lastSyncAt=100`  
    6️⃣ Kitchen marks “preparing”, queues `updateOrderStatus@120`  
    7️⃣ Kitchen online → push status update  
    8️⃣ Cashier tick (queue empty) → asks for changes since 100 → gets status@120  
     Cashier board updates.

    Result: both devices hold identical order lists and statuses.

    ────────────────────────────────────────

5.  Files to Inspect
    ────────────────────────────────────────
    Frontend

    ```
    packages/core-sdk/DataService.ts    // storage & queue
    packages/core-sdk/SyncEngine.ts     // network loop
    apps/cashier-pwa/src/...            // role UIs
    ```

    Backend

    ```
    backend/server.js                   // 80 lines, Express + lowdb
    backend/db.json                     // flat JSON store
    ```

    With this architecture you can unplug any device for hours, clear _another_
    device’s storage, or run them with different system clocks, and they will still
    reconcile the moment at least one of them gets back online.

    <h2>Issues with present sync method</h2>

       <h3>1st issue: Issue Description</h3>

       <section>
       There are 2 issues in this implementation of lastSyncAt:
           Suppose we are creating orders from cashier and kitchen app in the order:
             1. cashier app adds item no 1
             2. kitchen app adds item no 2
             3. cashier app adds item no 3

           Now Suppose kitchen app starts syncing first then cashier app. On kitchen app sync, it updates the lastSyncAt to timestamp of item 2 and server returns the app only changes for item 2.Hence it cannot sync with cashier app yet.

           When cashier app syncs, it will update lastSyncAt to timestamp of item 3 and server will return all changes hence it will also sync with kitchen app.

           Now when kitchen app goes to sync with cashier app, server will only send the item 3 of kitchen app as it is the only one with timestamp greater than lastSyncAt of kitchen app.
           </section>


         <h3>2st issue: Issue Description</h3>
           Dependence on client-supplied timestamps -> if the clients have clocks that doesnot have the same time -> missing order during sync

           Solution: <b>server-assigned timeStamps</b>

             Server will maintain time when the sync happens, and will append that time to the change object before pushing it to the server changes array.
             in client, It will maintain the sync time of the change that was synced last
             Then server will serve the client with changes that synced only after the lastSync time of client.





## 🔹 Print Feature Implementation Strategy

The printing subsystem is **fully modular** so each role-app can adopt, swap or extend it without touching business logic.

### Core Building Blocks

1. **`services/PrintConfig.ts`**  
   Central toggle & parameters.

   ```ts
   PrintConfig.failOnce(); // Next job will be forced to error once
   PrintConfig.shouldFailNext; // Runtime flag (reset automatically)
   ```

   • Can be enriched with timeouts, destinations, custom templates, etc.  
   • Auto-attached to `window` for dev-console usage; no UI exposure.

2. **`services/DataService.ts`** (print section)  
   Persistent LocalStorage bucket `<ROLE>_pos_printJobs` + listeners.  
   CRUD helpers: `getPrintJobs`, `savePrintJobs`, `updatePrintJobStatus`, `removePrintJob`, `subscribePrintJobs`.

3. **`services/PrintJobManager.ts`**  
   Stateless runner that:
   • polls every 4 s, picks first `queued` job that current role handles.  
   • flips it → `printing`; waits `PROCESS_TIME` (5 s).  
   • checks `PrintConfig.consumeFailFlag()` → decides _error_ vs _done_.  
   • auto-removes success rows after 2 s.  
   • exposes `add(job)` and `retry(id)`.

4. **`hooks/usePrintJobs.ts`**  
   Tiny React hook → realtime list for UI.

5. **UI Components**  
   • `PrintDashboard` subscribes to `usePrintJobs()`.  
   • Spinner for active job, idle dot for queued, ✔ / ✖ outcome.  
   • Retry button only when `status === "error"`.

### Customisation & Re-use

_Templates_ – `PrintJob.html` field stores raw HTML. Swap in another renderer or use a template factory per destination.

_Destinations_ – extend `handlesDest()` to map new printer roles.

_Failure Simulation_ – lives **only** in `PrintConfig`; production builds can tree-shake it out or guard with `process.env.NODE_ENV`.

```ts
// example: always fail kitchen prints in staging
if (import.meta.env.MODE === "staging" && job.dest === "kitchen") {
  PrintConfig.failOnce();
}
```

### Sequence Diagram

```
Catalog → createOrder   ──► DataService.addPrintJob() ──► LocalStorage
                          ▲                               │
          PrintJobManager ◄──────── tick() ───────────────┘
              │ printing                               (5s)
              ▼
          updatePrintJobStatus('done') ───► listener ───► UI ✔
          removePrintJob() after 2s
```

The design ensures **one job at a time**, offline persistence, dev-only failure hooks and minimal coupling – any frontend or backend can drop-in a new `PrintJobManager` while keeping the storage & config contracts intact.
