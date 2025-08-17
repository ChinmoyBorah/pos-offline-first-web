import { Product } from "../features/catalog/types";
import { initMenu } from "./MenuService";

export type OrderStatus = "pending" | "preparing" | "ready" | "completed";

export interface Order {
  id: string;
  items: { productId: string; qty: number }[];
  status: OrderStatus;
  createdAt: number;
  updatedAt?: number | undefined;
  comments?: string;
}

// Print jobs
export interface PrintJob {
  id: string;
  orderId: string;
  dest: "receipt" | "kitchen";
  priority: number;
  html: string;
  attempts: number;
  status: "queued" | "printing" | "done" | "error";
  startedAt?: number;
  finishedAt?: number;
}

const ROLE = (import.meta as any).env?.VITE_ROLE || "generic";
const PRODUCTS_KEY = `${ROLE}_pos_products`;
const CART_KEY = `${ROLE}_pos_cart`;
const ORDERS_KEY = `${ROLE}_pos_orders`;
export const CHANGES_KEY = `${ROLE}_pos_changes`;
// Print jobs
const PRINT_KEY = `${ROLE}_pos_printJobs`;

class LocalDataService {
  private cartListeners = new Set<(cart: Record<string, number>) => void>();
  private orderListeners = new Set<(orders: Order[]) => void>();
  private printListeners = new Set<(jobs: PrintJob[]) => void>();

  //cart listeners to update the cart in the UI
  private emitCart(cart: Record<string, number>) {
    this.cartListeners.forEach((cb) => cb(cart));
  }

  private emitOrders(orders: Order[]) {
    this.orderListeners.forEach((cb) => cb(orders));
  }

  private emitPrintJobs(jobs: PrintJob[]) {
    this.printListeners.forEach((cb) => cb(jobs));
  }

  async init(setProducts: (products: Product[]) => void) {
    const cached = localStorage.getItem(PRODUCTS_KEY);
    if (!cached) {
      await initMenu();
    }
    setProducts(this.getProducts());
  }

  /** Apply change coming from server without re-queuing */
  applyRemoteChange(change: { type: string; payload: any }) {
    if (change.type === "addOrder") {
      const orders = this.getOrders();
      if (!orders.find((o) => o.id === change.payload.id)) {
        orders.push(change.payload);
        this.saveOrders(orders);
      }
    } else if (change.type === "updateOrderStatus") {
      const orders = this.getOrders();
      const idx = orders.findIndex((o) => o.id === change.payload.orderId);
      if (idx !== -1) {
        orders[idx].status = change.payload.status;
        this.saveOrders(orders);
      }
    } else if (change.type === "setProducts") {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(change.payload));
    } else if (change.type === "modifyOrder") {
      const orders = this.getOrders();
      const idx = orders.findIndex((o) => o.id === change.payload.orderId);
      if (idx !== -1) {
        orders[idx].items = change.payload.items;
        orders[idx].comments = change.payload.comments;
        orders[idx].updatedAt = Date.now();
        this.saveOrders(orders);
      }
    }
  }

  /** Utility: generate a quasi-unique id without external deps */
  private generateId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  getProducts(): Product[] {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  }

  /* Cart helpers */
  getCart(): Record<string, number> {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  }

  saveCart(cart: Record<string, number>) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    this.emitCart(cart);
  }

  clearCart() {
    localStorage.removeItem(CART_KEY);
    this.emitCart({});
  }

  subscribeCart(callback: (cart: Record<string, number>) => void) {
    this.cartListeners.add(callback);
    // push current state immediately for convenience
    callback(this.getCart());
    return () => this.cartListeners.delete(callback);
  }

  addToCart(productId: string) {
    const cart = this.getCart();
    cart[productId] = (cart[productId] || 0) + 1;
    this.saveCart(cart);
    this.queueChange({
      type: "cartAdd",
      payload: { productId },
      ts: Date.now(),
    });
  }

  removeFromCart(productId: string) {
    const cart = this.getCart();
    if (!cart[productId]) return;
    cart[productId] > 1 ? (cart[productId] -= 1) : delete cart[productId];
    this.saveCart(cart);
    this.queueChange({
      type: "cartRemove",
      payload: { productId },
      ts: Date.now(),
    });
  }

  /* Orders helpers */
  subscribeOrders(cb: (orders: Order[]) => void) {
    this.orderListeners.add(cb);
    cb(this.getOrders());
    return () => this.orderListeners.delete(cb);
  }

  getOrders(): Order[] {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  }

  private saveOrders(orders: Order[]) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    this.emitOrders(orders);
  }

  createOrder(cart: Record<string, number>, comments: string = "") {
    const items = Object.entries(cart).map(([productId, qty]) => ({
      productId,
      qty,
    }));
    if (items.length === 0) return;

    const order: Order = {
      id: this.generateId(),
      items,
      status: "pending",
      createdAt: Date.now(),
      comments,
    };

    const orders = this.getOrders();
    orders.push(order);
    this.saveOrders(orders);

    // queue change for sync
    this.queueChange({ type: "addOrder", payload: order, ts: Date.now() });

    // clear cart after checkout
    this.clearCart();
  }

  updateOrderStatus(orderId: string, status: OrderStatus) {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return;
    orders[idx].status = status;
    orders[idx].updatedAt = Date.now();
    this.saveOrders(orders);
    this.queueChange({
      type: "updateOrderStatus",
      payload: { orderId, status },
      ts: Date.now(),
    });
  }

  modifyOrder(
    orderId: string,
    items: { productId: string; qty: number }[],
    comments: string
  ) {
    const orders = this.getOrders();
    const idx = orders.findIndex(
      (o) => o.id === orderId && o.status === "pending"
    );
    if (idx === -1) return;
    orders[idx].items = items;
    orders[idx].comments = comments;
    orders[idx].updatedAt = Date.now();
    this.saveOrders(orders);
    this.queueChange({
      type: "modifyOrder",
      payload: { orderId, items, comments },
      ts: Date.now(),
    });
  }

  /* -------------------- Print job helpers -------------------- */
  getPrintJobs(): PrintJob[] {
    const raw = localStorage.getItem(PRINT_KEY);
    return raw ? (JSON.parse(raw) as PrintJob[]) : [];
  }

  savePrintJobs(jobs: PrintJob[]) {
    localStorage.setItem(PRINT_KEY, JSON.stringify(jobs));
    this.emitPrintJobs(jobs);
  }

  removePrintJob(id: string) {
    const list = this.getPrintJobs().filter((j) => j.id !== id);
    this.savePrintJobs(list);
  }

  updatePrintJobStatus(id: string, status: PrintJob["status"]) {
    const list = this.getPrintJobs();
    const idx = list.findIndex((j) => j.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    if (status === "printing") {
      list[idx].startedAt = Date.now();
    } else if (status === "done" || status === "error") {
      list[idx].finishedAt = Date.now();
    } else if (status === "queued") {
      list[idx].startedAt = undefined;
      list[idx].finishedAt = undefined;
    }
    this.savePrintJobs(list);
  }

  subscribePrintJobs(cb: (jobs: PrintJob[]) => void) {
    this.printListeners.add(cb);
    cb(this.getPrintJobs());
    return () => {
      this.printListeners.delete(cb);
    };
  }

  /* Change-queue helpers – stored for later sync with backend */
  private queueChange(change: { type: string; payload: any; ts: number }) {
    // 1. persist in localStorage (for legacy polling logic & inspection)
    const raw = localStorage.getItem(CHANGES_KEY);
    const queue = raw ? (JSON.parse(raw) as any[]) : [];
    const record = { id: this.generateId(), ...change };
    console.log("[App] postMessage → enqueueChange", record);
    queue.push(record);
    localStorage.setItem(CHANGES_KEY, JSON.stringify(queue));

    // 2. forward to the Service-Worker so background-sync can push it
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      console.log("[SW] queue length after put", queue.length);
      const send = (sw: ServiceWorker) =>
        sw.postMessage({ type: "enqueueChange", change: record });

      if (navigator.serviceWorker.controller) {
        send(navigator.serviceWorker.controller);
      } else {
        // If the page is outside the SW scope, .ready never resolves.
        // Fallback: fetch the registration explicitly.
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => {
            if (reg?.active) {
              send(reg.active);
            } else {
              // last-ditch: enumerate all registrations (multi-scope dev servers)
              navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.active && send(r.active));
              });
            }
          })
          .catch(() => {
            /* no SW yet */
          });
      }
    }
  }

  /* Rollback stub – in a real sync engine we'd match change id and undo. */
  rollbackChange(changeId: string) {
    // not yet implemented
  }
}

export const DataService = new LocalDataService();
