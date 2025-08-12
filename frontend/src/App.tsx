import React, { useEffect, useState } from "react";
import { Product } from "./features/catalog/types";
import { DataService } from "./services/DataService";
import { useCart } from "./hooks/useCart";
import { useOrders } from "./hooks/useOrders";
import NavBar from "./components/NavBar";
import { syncEngine } from "./services/SyncEngine";
import SyncBadge from "./components/SyncBadge";
import "./App.css";

const ROLE = (import.meta as any).env?.VITE_ROLE || "manager";
// Allowed values: cashier, kitchen, serving, manager

const CartDrawer = React.lazy(() => import("./features/cart/CartDrawer"));
const OrderBoard = React.lazy(() => import("./features/orders/OrderBoard"));
const PrintDashboard = React.lazy(() => import("./features/prints/PrintDashboard"));
const CatalogList = React.lazy(() => import("./features/catalog/CatalogList"));

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { cart, addItem, removeItem } = useCart();
  const { orders, updateStatus } = useOrders();
  const [view, setView] = useState<string>(ROLE);

  // Seed products into DataService and pull them for UI
  useEffect(() => {
    DataService.init(setProducts);
  }, []);

  // start sync engine once
  useEffect(() => {
    syncEngine.start();
  }, []);

  let content: React.ReactNode;
  if (view === "cashier") {
    content = (
      <>
        <CatalogList products={products} onAdd={addItem} />
        <CartDrawer
          products={products}
          cart={cart}
          onAdd={addItem}
          onRemove={removeItem}
          onCheckout={(cmt: string) => {
            DataService.createOrder(cart, cmt);
          }}
        />
      </>
    );
  } else if (view === "kitchen") {
    content = (
      <OrderBoard
        orders={orders}
        onAdvance={updateStatus}
        visibleStatuses={["pending", "preparing"]}
      />
    );
  } else if (view === "serving") {
    content = (
      <OrderBoard
        orders={orders}
        onAdvance={updateStatus}
        visibleStatuses={["ready"]}
      />
    );
  } else {
    content = <OrderBoard orders={orders} onAdvance={updateStatus} />;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar view={view} setView={setView} />
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          flexDirection: "row",
        }}>
        {content}
      </div>
      {(view === "cashier" || view === "kitchen") && (
        <PrintDashboard products={products} />
      )}
      <SyncBadge />
    </div>
  );
};

export default App;
