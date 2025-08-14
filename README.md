# Offline-First POS – Developer Walkthrough

_A real-world coding exercise turned into a tiny but fully working Point-of-Sale system that keeps running even when the Wi-Fi dies._

---

## 1. Why this project exists

> Food-truck crews don’t care about databases, they care about taking orders while the truck is parked in a dead-zone.  
> My goal was to prove that a React PWA + a 90-line Node server can do just that – with zero third-party services.

---

## 2. Birds-eye view

```
┌─────────────┐   LocalStorage   ┌───────────────┐
│  React APP  │  ←→  SyncEngine ←→  Express-LowDB │
└─────────────┘  (every 10 s)   └───────────────┘
```

- **Roles** – separate builds (`VITE_ROLE`) so each tablet only shows its own UI (Cashier, Kitchen, Serving, Manager).
- **Data** – persisted locally first, then synced; the server is just a mailbox for change-logs.
- **Printing** – a micro-queue in LocalStorage processed one job at a time; can be swapped for a server queue later.

---

## 3. Front-end anatomy (per role)

| Role    | Screen         | Main Components             |
| ------- | -------------- | --------------------------- |
| Cashier | Catalog + Cart | `CatalogList`, `CartDrawer` |
| Kitchen | Prep board     | `OrderBoard`                |
| Serving | Runner board   | `OrderBoard`                |
| Manager | Overview board | `OrderBoard`                |

Each build boots `SyncEngine.start()` exactly once, draws a tiny tree, and shows a live `SyncBadge` (green / yellow / red).

### 3.1 Local buckets (all prefixed by role)

```
<ROLE>_pos_products   // static menu
<ROLE>_pos_orders     // [{ id, items, status }]
<ROLE>_pos_changes    // FIFO change log for /sync
<ROLE>_pos_printJobs  // tiny local print queue
```

### 3.2 Sync loop in one Tweet

```ts
setInterval(tick, 10_000);
async function tick() {
  const payload = { changes, lastSyncAt };
  const { serverChanges, acceptedIds } = await post("/sync", payload);
  remove(acceptedIds); // clears local queue
  apply(serverChanges); // DataService.applyRemoteChange
  lastSyncAt = maxTS(serverChanges);
}
```

_Every mutation is a 200-byte JSON delta, so polling stays cheap even on 2G tethering._

---

## 4. Printing story (cashier & kitchen)

1. **Queue** – `DataService.savePrintJobs()` stores jobs locally; status is `queued → printing → done|error`.
2. **Runner** – `PrintJobManager` polls every 6 s, grabs the first `queued` job that belongs to its role (`handlesDest()`), simulates a 5 s print, then marks ✔ or ✖.
3. **UI** – `PrintDashboard` shows one spinner, grey dots for queued, green ✔, red ✖ + Retry.
4. **Mock failure** – developers call `PrintConfig.failOnce()` in the console – user never sees the toggle.

---

## 5. Why LocalStorage and not IndexedDB?

- **Speed to code** – one `setItem`, done.
- **Data volume** – orders are a few KB each; 5 MB covers thousands of tickets.
- **Extra-safety** – startup guard checks `Blob(Object.values(localStorage)).size`; if >4 MB we push pending changes, wipe old orders, and re-sync.
  _When the menu grows to 50 k items we swap in Dexie/IndexedDB – all domain code stays the same._

---

## 6. What happens offline?

1. Cashier loses Wi-Fi, keeps selling – changes queue locally.
2. Kitchen tablet still online, keeps prepping.
3. Cashier reconnects → `SyncEngine` pushes its backlog; server echoes to kitchen → boards converge.
   _The truck can run all day without signal; once one tablet gets 3G the fleet catches up._

---


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


Open the two URLs side-by-side; place orders offline, watch them sync when you bring Wi-Fi back. Hit the print buttons and enjoy the little spinner doing its job.

---

## 9. What I’d polish next (if this were production)

- Switch to IndexedDB via Dexie, add full-text index for 10 k-item menus.
- Replace local print queue with REST + a small printer agent.
- Add SSE for near-instant kitchen <-> cashier updates.
- Wrap everything in Cypress e2e tests (offline/online scenarios).

_But for a weekend prototype, this code gets the truck rolling and keeps it rolling when the network doesn’t._










<h2>Below is the implementation strategies for an offline-capable Point-of-Sale system.</h2>


<h3>High level Implementation Strategy – Single-App / Multi-View</h3>

  <h4>Architecture</h4>

    - <b>Frontend</b>: One React App with four internal views (Cashier, Kitchen, Serving, Manager). The views are based on ROLE that is injected at build time. All apps hosts on different port and mantains role based localStorage entries for isolation and simplicity.

    - <b>Data Layer</b>: shared `DataService` + `SyncEngine` for managing local data and background push/pull with the backend for syncing.

    - <b>Persistence</b>:
      LocalStorage keys depends on role (`{ROLE}_pos_products`, `{ROLE}_pos_cart`, `{ROLE}_pos_orders`, `pos_changes`) so that each of them can be tested on one browser.

    - <b>Backend</b>: tiny Node/Express server with LowDB and a `/sync` and `/menu` public endpoint.

    ```
    ┌─────────────┐               ┌───────────────┐
    │ React APP  │  ↔  /sync  ↔  │  Express API -lowDb │
    └─────────────┘               └───────────────┘

    ```

  <h4>Key Technical Pivots</h4>

  1. **Role-scoped LocalStorage**

    ```ts
    const ROLE = import.meta.env.VITE_ROLE; // 'cashier', 'kitchen', ...
    const PRODUCTS_KEY = `${ROLE}_pos_products`;
    ```

    Each app writes to its own namespace in localStorage (e.g. `cashier_pos_cart`).

  2. **Prefixed sync meta** – per-role last-sync timestamps (`cashier_pos_sync_meta`).
  3. **Change Queue** – every queued change carries its `role` for backend auditing. (`cashier_pos_changes`)

  4. **Build-time injection**

    ```bash
    # Cashier
    VITE_ROLE=cashier npm run dev -- --port 5173
    # Kitchen
    VITE_ROLE=kitchen npm run dev -- --port 5174
    ```


<h2>Below is a deep-dive explanation of the current lightweight POS prototype, walking through the entire data journey—from a tap on the “Add” button to the moment every device converges.</h2>



A. Front-End Flow (per role)
 
   A. UI composition  
    • The React tree is extremely thin:  
    Cashier → `CatalogList` + `CartDrawer`  
    Kitchen → `OrderBoard` (Pending, Preparing)  
    Serving → `OrderBoard` (Ready)  
    Manager → `OrderBoard` (all)  
    • Each app starts `syncEngine.start()` once and shows a `SyncBadge` with the
   current status (`idle`, `syncing`, `error`).

B. User interaction sequence

  Cashier APP:
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
        `

    3. User hits “Checkout”  
        → `createOrder(cart)`  
        • Builds an `order` object `{ id, items, status:'pending', ts }`  
        • Saves the order to `<ROLE>_pos_orders`  
        • Queues an `addOrder` change  
        • Clears the cart (and emits event so drawer empties)
    
   Kitchen App
    1. Calls /sync api with empty change array to fetch order changes from cashier/manager apps
    2. Applies the changes to create/update or modify orders.
    3. Displays the orders according to their status -> Pending, preparing
    4. Modifies the status of the order or Marks it as complete
    5. Appends change object to the queue and emits listeners to update UI instantly
    6. Again call sync api with its change queue to change them on remote devices/

    The same pattern of data storage and syncing will be seen in other apps as well.

C. LocalStorage Buckets & Queuing Rules


    | Key (per-role) | Contents |

    | `<ROLE>_pos_products` | Seed product catalog (array of objects) |
    | `<ROLE>_pos_orders` | Array of orders with status |
    | `<ROLE>_pos_changes` | **FIFO change log** (objects with `id`, `type`, `payload`, `ts`) |
    | `<ROLE>_pos_sync_meta` | `{ lastSyncAt: number }` |

    Queuing rules  
    • Every _mutation_ goes through `queueChange()` which pushes the queued changes and
    never blocks the UI.  
    • Each change gains a local timeStamp `ts = Date.now()` so devices can order them
    without a central counter.  
    • No change is ever removed until the backend acknowledges (`acceptedIds`).

D. Synchronisation Loop


    a. Front-End (`SyncEngine`)

        ```
        tick() every 10 s or on "online" event or during page reload:
        1. Read queue   →   changes []
        2. POST /sync   →   { changes, lastSyncAt }
        3. On success:
          • remove acceptedIds from queue
          • apply serverChanges via DataService.applyRemoteChange()
          • lastSyncAt = max( lastSyncAt, ...serverChanges.ts )
        ```

        Why it works:
        • By always calling `/sync` (even with an empty queue) each app performs a pure <b>pull</b> even when it has nothing to push syncing remote changes , if there are any.
        • We use lastSyncAt, calculated from change's server timestamp,  denoting the last time the particular client was synced, so server knows which changes are already synced and it also doesnot cause issue when multiple devices sync at different time and creates/modifies orders at different time.

    b.  Backend (`POST /sync`)

       1. When server receives sync changes from a device, it queues it in its own storage(lowDb).
       2. It mantains a timestamp for each changes, so it can identify which client/changes was synced when.
       3. It sends back the changes it had queued since that last time the client was synced, along with the server timestamps for the changes, so that client can calculate the maximum time/lastSyncTime to store and send  on subsequent sync request. 

    
    C.  Conflict & Convergence
    • Add order data is append-only so it never conflicts.
    • Status updates of orders : update with last timestamp wins.
    . Modify order: update with last timestamp wins.
    • Because all replicas apply the exact same deterministic rules, they inevitably
      converge after exchanging their change logs.

    ────────────────────────────────────────

E.  End-to-End Timeline Example( cashier and kitchen)
    ────────────────────────────────────────
    1️⃣ Cashier (offline) queues changes  
    2️⃣ Cashier goes online → pushes change → server stores -> sends lastSyncTime.  
    3️⃣ Kitchen is still offline (queue empty)  
    4️⃣ Kitchen regains connectivity → polls /sync request with no changes and lastSyncTime of 0. Server responds with change queue gained from cashier.  
    5️⃣ Kitchen applies order, sets `lastSyncAt` as maximum server timestamp of changes from cashier app 
    6️⃣ Kitchen marks “preparing”, queues updatestatus change locally 
    7️⃣ Kitchen online → push status update changes in queue 
    8️⃣ Cashier polls with empty change queue(as there are no new changes to sync from cashier side) and lastSyncTime 
     Cashier board updates.

    Result: both devices hold identical order lists and statuses.

    ────────────────────────────────────────

    With this architecture you can unplug any device for hours, clear _another_
    device’s storage, or run them with different system clocks, and they will still
    reconcile the moment at least one of them gets back online.

