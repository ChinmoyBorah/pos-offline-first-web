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

  <h4>Architecture</h4>

    - <b>Frontend</b>: One React App with four internal views (Cashier, Kitchen, Serving, Manager). The views are based on ROLE that is injected at build time. All apps hosts on different port and mantains role based localStorage entries for isolation and simplicity.

    - <b>Data Layer</b>: shared `DataService` + `SyncEngine` for managing local data and background push/pull with the backend for syncing.

    - <b>Persistence</b>:
      LocalStorage keys depends on role (`{ROLE}_pos_products`, `{ROLE}_pos_cart`, `{ROLE}_pos_orders`, `pos_changes`) so that each of them can be tested on one browser.

    - <b>Backend</b>: tiny Node/Express server with LowDB and a `/sync` and `/menu` public endpoint.

    ```
    ┌─────────────┐               ┌───────────────┐
    │ React APP  │  ↔  /sync  ↔  │  Express API  │
    └─────────────┘               └───────────────┘

    ```

  <h4>Role based Strategy – Role-Isolated Apps</h4>

  ### Key Technical Pivots

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
────────────────────────────────────────
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
────────────────────────────────────────
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



## 🔹 Print Feature Implementation Strategy

The printing subsystem is **fully modular**, both cashier and kitchen apps can adopt, swap or extend it without touching business logic. I have made the implementation simple. Consideration:  Only one device is connected to each printer

### Core Building Blocks

1. **UI Components**  
   • `PrintDashboard` subscribes to `usePrintJobs()`.
   . When a user(cashier or kitchen) starts printing receipts, they are queued.
   . Printing happens one at a time untill all of the jobs are completed
   • Spinner for active job, idle dot for queued, ✔ / ✖  for outcome.  
   • Retry button only when `status === "error"`.
   . On retry it will be added to the end of the queue and will wait for other printjobs in line to finish.

### Customisation & Re-use

_Failure Simulation_ – lives **only** in `PrintConfig`; production builds can tree-shake it out or guard with `process.env.NODE_ENV`.

