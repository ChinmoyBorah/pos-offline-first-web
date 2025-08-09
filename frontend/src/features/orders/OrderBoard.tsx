import React from "react";
import { Order, OrderStatus, DataService } from "../../services/DataService";

interface Props {
  orders: Order[];
  onAdvance: (orderId: string, nextStatus: OrderStatus) => void;
  visibleStatuses?: OrderStatus[]; // optional filter for stakeholder views
}

const statusFlow: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "completed",
];

const OrderBoard: React.FC<Props> = ({
  orders,
  onAdvance,
  visibleStatuses,
}) => {
  console.log("Orders", orders);
  return (
    <div style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>
      <h2>Orders</h2>
      {(visibleStatuses ?? statusFlow).map((status) => (
        <div key={status} style={{ marginBottom: "1rem" }}>
          <h3 style={{ textTransform: "capitalize" }}>{status}</h3>
          {orders.filter((o) => o.status === status).length === 0 && (
            <p>No orders</p>
          )}
          {orders
            .filter((o) => o.status === status)
            .sort((a, b) => {
              return a.status == "pending" && b.status == "pending"
                ? a.createdAt - b.createdAt
                : (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
            })
            .map((o) => {
              const currentIndex = statusFlow.indexOf(o.status);
              const nextStatus = statusFlow[currentIndex + 1];
              return (
                <div
                  key={o.id}
                  style={{
                    border: "1px solid #ccc",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                  }}>
                  <div>ID: {o.id.slice(-6)}</div>
                  <ul style={{ margin: "0.25rem 0 0.5rem 1rem", padding: 0 }}>
                    {o.items.map((it) => {
                      const product = DataService.getProducts().find(
                        (p) => p.id === it.productId
                      );
                      const label = product ? product.name : it.productId;
                      return (
                        <li key={it.productId} style={{ listStyle: "disc" }}>
                          {label} x {it.qty}
                        </li>
                      );
                    })}
                  </ul>
                  {nextStatus && (
                    <button
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => onAdvance(o.id, nextStatus)}>
                      Mark {nextStatus}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
};

export default OrderBoard;
