import React from "react";
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

  const handlePrint = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const content = order.items
      .map((it) => {
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
      {pending.map((o) => {
        return (
          <div
            key={o.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.3rem",
            }}>
            <span>Order {o.id.slice(-6)}</span>
            <button onClick={() => handlePrint(o.id)}>Print Receipt</button>
          </div>
        );
      })}
    </div>
  );
};

export default PrintDashboard;
