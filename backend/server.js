import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import bodyParser from "body-parser";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapter = new JSONFile(path.join(__dirname, "db.json"));
const db = new Low(adapter, { products: [], orders: [], changes: [] });

async function start() {
  let serverTs = Date.now();
  await db.read();
  if (!db.data) {
    db.data = { products: [], orders: [], changes: [] };
  } else {
    db.data.products = db.data.products || [];
    db.data.orders = db.data.orders || [];
    db.data.changes = db.data.changes || [];
  }
  await db.write();

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  app.get("/products", (req, res) => {
    res.json(db.data.products);
  });

  app.post("/sync", async (req, res) => {
    const { changes = [], lastSyncAt = 0, role = "generic" } = req.body;
    serverTs = Date.now();
    // Accept incoming changes
    for (const change of changes) {
      change.serverTs = serverTs;
      db.data.changes.push(change);
      if (change.type === "addOrder") {
        db.data.orders.push(change.payload);
      } else if (change.type === "updateOrderStatus") {
        const { orderId, status } = change.payload;
        const order = db.data.orders.find((o) => o.id === orderId);
        if (order) order.status = status;
      }
    }

    await db.write();

    const serverChanges = db.data.changes.filter(
      (c) => c.serverTs > lastSyncAt
    );
    res.json({ serverChanges, acceptedIds: changes.map((c) => c.id) });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`API running on http://localhost:${PORT}`)
  );
}

start().catch((err) => {
  console.error("Failed to start server", err);
});
