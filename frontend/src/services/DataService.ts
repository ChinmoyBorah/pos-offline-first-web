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

const ROLE = (import.meta as any).env?.VITE_ROLE || "generic";
const PRODUCTS_KEY = `${ROLE}_pos_products`;
const CART_KEY = `${ROLE}_pos_cart`;
const ORDERS_KEY = `${ROLE}_pos_orders`;
export const CHANGES_KEY = `${ROLE}_pos_changes`;

class LocalDataService {
  private cartListeners = new Set<(cart: Record<string, number>) => void>();
  private orderListeners = new Set<(orders: Order[]) => void>();

  //cart listeners to update the cart in the UI
  private emitCart(cart: Record<string, number>) {
    this.cartListeners.forEach((cb) => cb(cart));
  }

  private emitOrders(orders: Order[]) {
    this.orderListeners.forEach((cb) => cb(orders));
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

  /* Change-queue helpers – stored for later sync with backend */
  private queueChange(change: { type: string; payload: any; ts: number }) {
    const raw = localStorage.getItem(CHANGES_KEY);
    const queue = raw ? (JSON.parse(raw) as any[]) : [];
    queue.push({ id: this.generateId(), ...change });
    localStorage.setItem(CHANGES_KEY, JSON.stringify(queue));
  }

  /* Rollback stub – in a real sync engine we'd match change id and undo. */
  rollbackChange(changeId: string) {
    // not yet implemented
  }
}

export const DataService = new LocalDataService();
