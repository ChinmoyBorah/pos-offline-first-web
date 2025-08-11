import React, { useState } from "react";
import { useOrders } from "../../hooks/useOrders";
import { DataService } from "../../services/DataService";
import { Product } from "../catalog/types";
import { printJobManager } from "../../services/PrintJobManager";

interface Props {
  products: Product[];
}

const PrintDashboard: React.FC<Props> = ({ products }) => {
  const { orders } = useOrders();
  const pending = orders.filter((o) => o.status === "pending");

  const [editing, setEditing] = useState<string | null>(null);
  const orderEditing = orders.find((o) => o.id === editing);

  const [tempItems, setTempItems] = useState<
    { productId: string; qty: number }[]
  >([]);
  const [comments, setComments] = useState("");

  const openEdit = (o: any) => {
    setEditing(o.id);
    setTempItems(o.items.map((it) => ({ ...it })));
    setComments(o.comments || "");
  };

  const applyEdit = () => {
    if (!orderEditing) return;
    DataService.modifyOrder(orderEditing.id, tempItems, comments);
    setEditing(null);
  };

  const handlePrint = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const content = order.items
      .map((it: any) => {
        const p = products.find((pr) => pr.id === it.productId);
        return `${p?.name ?? it.productId} x${it.qty}`;
      })
      .join(", ");
    printJobManager.runOnce({
      ...order,
      dest: "receipt",
      priority: "normal",
      content,
    });
  };

  return (
    <div
      style={{
        borderTop: "1px solid #ccc",
        padding: "0.5rem",
        maxHeight: "200px",
        overflowY: "auto",
      }}>
      <h4>Print Dashboard (Pending Orders)</h4>
      {pending.length === 0 && <p>No pending orders</p>}
      {pending.map((o: any) => {
        return (
          <div
            key={o.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.3rem",
            }}>
            <span>Order {o.id.slice(-6)}</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={() => handlePrint(o.id)}>Print Receipt</button>
              <button onClick={() => openEdit(o)}>Modify</button>
            </div>
          </div>
        );
      })}

      {orderEditing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <div
            style={{ background: "#fff", padding: "1rem", minWidth: "300px" }}>
            <h4>Modify Order {orderEditing.id.slice(-6)}</h4>
            {tempItems.map((it: any, idx: number) => (
              <div
                key={it.productId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.3rem",
                }}>
                <span>
                  {products.find((p) => p.id === it.productId)?.name ||
                    it.productId}
                </span>
                <input
                  type="number"
                  min={1}
                  value={it.qty}
                  onChange={(e) => {
                    const copy = [...tempItems];
                    copy[idx].qty = parseInt(e.target.value) || 1;
                    setTempItems(copy);
                  }}
                  style={{ width: "60px" }}
                />
              </div>
            ))}
            <textarea
              placeholder="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              style={{ width: "100%" }}
            />
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
              }}>
              <button onClick={() => setEditing(null)}>Cancel</button>
              <button onClick={applyEdit}>Modify Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintDashboard;
