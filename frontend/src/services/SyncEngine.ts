import { DataService, CHANGES_KEY } from "./DataService";

const ROLE = (import.meta as any).env?.VITE_ROLE || "generic";

export type SyncStatus = "idle" | "syncing" | "error";

class SyncEngine {
  private static META_KEY = `${ROLE}_pos_sync_meta`;
  private status: SyncStatus = "idle";
  private listeners = new Set<(s: SyncStatus) => void>();
  private timerId: number | undefined;
  private backoff = 5000; // start at 5s
  private API_BASE =
    (import.meta as any).env?.VITE_API_URL || "http://localhost:5000";

  private get lastSyncAt() {
    const raw = localStorage.getItem(SyncEngine.META_KEY);
    return raw ? (JSON.parse(raw).lastSyncAt as number) : 0;
  }
  private set lastSyncAt(val: number) {
    localStorage.setItem(
      SyncEngine.META_KEY,
      JSON.stringify({ lastSyncAt: val })
    );
  }

  start() {
    if (this.timerId) return; // already running
    // window.addEventListener("online", () => this.tick());
    this.timerId = window.setInterval(() => this.tick(), 15000);
    this.tick(); // immediate attempt
  }

  subscribe(cb: (s: SyncStatus) => void) {
    this.listeners.add(cb);
    cb(this.status);
    return () => this.listeners.delete(cb);
  }

  private setStatus(s: SyncStatus) {
    if (this.status !== s) {
      this.status = s;
      this.listeners.forEach((cb) => cb(s));
    }
  }

  private async tick() {
    if (!navigator.onLine) return;
    const queueRaw = localStorage.getItem(CHANGES_KEY);
    const queue = queueRaw ? (JSON.parse(queueRaw) as any[]) : [];
    // Always attempt a pull; push only if we have queued changes

    this.setStatus("syncing");
    try {
      const res = await fetch(`${this.API_BASE}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: queue,
          lastSyncAt: this.lastSyncAt,
          role: ROLE,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // remove accepted ids from queue
      const remaining = queue.filter(
        (c: any) => !data.acceptedIds.includes(c.id)
      );
      localStorage.setItem(CHANGES_KEY, JSON.stringify(remaining));

      // apply server changes
      const serverChanges = data.serverChanges as any[];
      serverChanges
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach((ch) => DataService.applyRemoteChange(ch));

      // determine latest timestamp among received changes or keep current
      const maxTs = serverChanges.reduce(
        (m, ch) => (ch.serverTs && ch.serverTs > m ? ch.serverTs : m),
        this.lastSyncAt
      );
      this.lastSyncAt = maxTs;
      this.setStatus("idle");
      // this.backoff = 5000; // reset
    } catch (err) {
      console.error("Sync failed", err);
      this.setStatus("error");
      // exponential backoff handled by not doing anything; tick will try again on next interval
      // this.backoff = Math.min(this.backoff * 2, 60000);
    }
  }
}

export const syncEngine = new SyncEngine();
