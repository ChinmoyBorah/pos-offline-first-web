import React, { Suspense, useEffect, useState } from "react";
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
const PrintDashboard = React.lazy(
  () => import("./features/prints/PrintDashboard")
);
const CatalogList = React.lazy(() => import("./features/catalog/CatalogList"));

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { cart, addItem, removeItem } = useCart();
  const { orders, updateStatus } = useOrders();
  const [view, setView] = useState<string>(ROLE);
  const [dashboard, setDashboard] = useState(false);

  // Seed products into DataService and pull them for UI
  useEffect(() => {
    DataService.init(setProducts);
  }, []);

  // start sync engine once
  useEffect(() => {
    syncEngine.start();
  }, []);

  const renderContent = (): React.ReactNode => {
    if (dashboard) {
      const mod = ROLE === "cashier";
      return (
        <PrintDashboard
          products={products}
          showModify={mod}
          onBack={() => setDashboard(false)}
        />
      );
    }
    // lock to ROLE – ignore other values
    switch (ROLE) {
      case "cashier":
        return (
          <>
            <CatalogList
              products={products}
              onAdd={addItem}
              onOpenDashboard={() => setDashboard(true)}
            />
            {Object.keys(cart).length > 0 && (
              <CartDrawer
                products={products}
                cart={cart}
                onAdd={addItem}
                onRemove={removeItem}
                onCheckout={(c) => DataService.createOrder(cart, c)}
              />
            )}
          </>
        );

      case "kitchen":
        return (
          <OrderBoard
            view={ROLE}
            orders={orders}
            onAdvance={updateStatus}
            visibleStatuses={["pending", "preparing"]}
            onOpenDashboard={() => setDashboard(true)}
          />
        );

      case "serving":
        return (
          <OrderBoard
            view={ROLE}
            orders={orders}
            onAdvance={updateStatus}
            visibleStatuses={["ready"]}
            onOpenDashboard={() => setDashboard(true)}
          />
        );

      default:
        return (
          <OrderBoard
            view={ROLE}
            orders={orders}
            onAdvance={updateStatus}
            onOpenDashboard={() => setDashboard(true)}
          />
        );
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar view={ROLE} setView={setView} setDashboard={setDashboard} />
      <Suspense fallback={<div>Loading...</div>}>
        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            flexDirection: "row",
          }}>
          {renderContent()}
        </div>
      </Suspense>
      {/* {dashboard && (
        <button onClick={() => setDashboard(false)}>Back to Catalog</button>
      )} */}
      <SyncBadge />
    </div>
  );
};

export default App;
