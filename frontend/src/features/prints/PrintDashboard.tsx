/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import React, { useState } from "react";
import { useOrders } from "../../hooks/useOrders";
import { DataService } from "../../services/DataService";
import { Product } from "../catalog/types";
import { printJobManager } from "../../services/PrintJobManager";
import { usePrintJobs } from "../../hooks/usePrintJobs";
import { PrintJob } from "../../services/DataService";
const ROLE = (import.meta as any).env?.VITE_ROLE || "manager";
const DEFAULT_DEST: "receipt" | "kitchen" =
  ROLE === "kitchen" ? "kitchen" : "receipt";

interface Props {
  products: Product[];
  showModify?: boolean;
  onBack: () => void;
}

const PrintDashboard: React.FC<Props> = ({
  products,
  showModify = true,
  onBack,
}) => {
  const { orders } = useOrders();
  const { jobs } = usePrintJobs();
  const pending = orders.filter((o) => o.status === "pending");

  const [editing, setEditing] = useState<string | null>(null);
  const orderEditing = orders.find((o) => o.id === editing);

  const [tempItems, setTempItems] = useState<
    { productId: string; qty: number }[]
  >([]);
  const [comments, setComments] = useState("");
  // const [now, setNow] = useState(Date.now());

  // React.useEffect(() => {
  //   const id = setInterval(() => setNow(Date.now()), 300);
  //   return () => clearInterval(id);
  // }, []);

  const openEdit = (o: any) => {
    setEditing(o.id);
    setTempItems(o.items.map((it: any) => ({ ...it })));
    setComments(o.comments || "");
  };

  const applyEdit = () => {
    if (!orderEditing) return;
    const fresh = orders.find((o) => o.id === orderEditing.id);
    if (!fresh || fresh.status !== "pending") {
      alert("Order is already being prepared and cannot be modified");
      setEditing(null);
      return;
    }
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
    const html = `<h3>Receipt</h3><p>${content}</p>`;
    printJobManager.add({
      orderId: order.id,
      dest: DEFAULT_DEST,
      priority: 1,
      html,
    });
  };

  return (
    <div
      style={{
        borderTop: "1px solid #ccc",
        padding: "1rem 2rem",
        maxHeight: "100vh",
        overflowY: "auto",
        flexGrow: 1,
      }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
        <h4 style={{ margin: 0 }}>
          {ROLE === "cashier"
            ? "Order Dashboard"
            : "Print Dashboard (Pending Orders)"}
        </h4>
        <button onClick={onBack}>Back</button>
      </div>

      {/* Print progress section */}
      <div
        style={{
          border: "1px solid black",
          marginTop: "20px",
          padding: "10px",
        }}>
        <h5 style={{ marginTop: 0 }}>Print Progress</h5>
        {jobs.length === 0 && <p>No print jobs</p>}
        {jobs.map((j: PrintJob) => {
          const color =
            j.status === "done"
              ? "#2ecc71"
              : j.status === "error"
              ? "#e74c3c"
              : "#3498db"; // spinner color
          return (
            <div
              key={j.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.6rem",
              }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}>
                {j.status === "printing" ? (
                  <span className="spinner" style={{ borderTopColor: color }} />
                ) : j.status === "queued" ? (
                  <span className="idle-circle" />
                ) : j.status === "done" ? (
                  <span style={{ color }}>✔</span>
                ) : (
                  <span style={{ color }}>✖</span>
                )}
                <span>
                  #{j.orderId.slice(-6)} – {j.dest}
                </span>
              </div>
              {j.status === "error" && (
                <button onClick={() => printJobManager.retry(j.id)}>
                  Retry
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pending orders section */}
      <div
        style={{
          padding: "10px",
          border: "1px solid black",
          marginTop: "20px",
        }}>
        <h5 style={{ marginTop: 0 }}>Pending Orders Data</h5>
        {pending.length === 0 && <p>No pending orders</p>}
        {pending.map((o: any) => {
          return (
            <div
              key={o.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                margin: "1rem 0",
              }}>
              <div>
                <strong>Order {o.id.slice(-6)}</strong>
                <div style={{ fontSize: "0.8rem" }}>
                  {/* eslint-disable-next-line @typescript-eslint/explicit-function-return-type */}
                  {o.items
                    .map((it: any) => {
                      const p = products.find((pr) => pr.id === it.productId);
                      return `${p?.name ?? it.productId} x${it.qty}`;
                    })
                    .join(", ")}
                  {o.comments && <em> – {o.comments}</em>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <button onClick={() => handlePrint(o.id)}>Print Receipt</button>
                {showModify && (
                  <button onClick={() => openEdit(o)}>Modify</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Other orders (cashier only): preparing, ready, completed – read-only */}
      {ROLE === "cashier" && (
        <div
          style={{
            padding: "10px",
            border: "1px solid black",
            marginTop: "20px",
          }}>
          <h5 style={{ marginTop: 0 }}>Other Orders</h5>
          {(["preparing", "ready", "completed"] as const).map((st) => {
            const list = orders.filter((ord) => ord.status === st);
            if (list.length === 0) return null;
            return (
              <div key={st} style={{ marginTop: "10px" }}>
                <strong style={{ textTransform: "capitalize" }}>{st}</strong>
                {list.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      margin: "0.5rem 0",
                    }}>
                    <div>
                      <span>
                        <strong>Order {o.id.slice(-6)}</strong>
                      </span>
                      <div style={{ fontSize: "0.8rem" }}>
                        {o.items
                          .map((it: any) => {
                            const p = products.find(
                              (pr) => pr.id === it.productId
                            );
                            return `${p?.name ?? it.productId} x${it.qty}`;
                          })
                          .join(", ")}
                        {o.comments && <em> – {o.comments}</em>}
                      </div>
                    </div>
                    {/* No actions (no print/modify) for non-pending */}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

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
            style={{
              background: "#fff",
              padding: "1rem",
              minWidth: "300px",
            }}>
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
