/* eslint-disable no-restricted-globals */
import { openDB } from "idb";

const dbPromise = openDB("pos-bg-sync", 1, {
  upgrade(db) {
    db.createObjectStore("kv");
  },
});

const KEY = "changeQueue";
const API = "http://localhost:5000";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

self.addEventListener("message", async (e) => {
  console.log("[SW] message received", e.data);
  if (e.data?.type !== "enqueueChange") return;
  const db = await dbPromise;
  const q = (await db.get("kv", KEY)) || [];
  q.push(e.data.change);
  await db.put("kv", q, KEY);
  console.log("[SW] queue length after put", q.length);
  self.registration.sync?.register("bg-push");
});

self.addEventListener("sync", (e) => {
  if (e.tag === "bg-push") e.waitUntil(push());
});

async function push() {
  const db = await dbPromise;
  const q = (await db.get("kv", KEY)) || [];
  if (!q.length) return;
  try {
    const r = await fetch(`${API}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: q, lastSyncAt: 0, role: "generic" }),
    });
    const { serverChanges, acceptedIds } = await r.json();
    await db.put(
      "kv",
      q.filter((c) => !acceptedIds.includes(c.id)),
      KEY
    );

    const clients = await self.clients.matchAll();
    clients.forEach((c) =>
      c.postMessage({ type: "serverChanges", changes: serverChanges })
    );
  } catch (err) {
    console.error("SW push failed", err);
  }
}
