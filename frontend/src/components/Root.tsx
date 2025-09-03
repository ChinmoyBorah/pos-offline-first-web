import React, { MutableRefObject, useEffect, useRef, useState } from "react";
import { Product } from "../features/catalog/types";
import { DataService } from "../services/DataService";
import { useCart } from "../hooks/useCart";
import { useOrders } from "../hooks/useOrders";
import { syncEngine } from "../services/SyncEngine";
import Layout from "./Layout";

const ROLE = (import.meta as any).env?.VITE_ROLE || "manager";
// Allowed values: cashier, kitchen, serving, manager

const CartDrawer = React.lazy(() => import("../features/cart/CartDrawer"));
const OrderBoard = React.lazy(() => import("../features/orders/OrderBoard"));
const PrintDashboard = React.lazy(
    () => import("../features/prints/PrintDashboard")
);
const CatalogList = React.lazy(() => import("../features/catalog/CatalogList"));

const Root: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const { cart, addItem, removeItem } = useCart();
    const { orders, updateStatus } = useOrders();
    const [dashboard, setDashboard] = useState(false);

    // Seed products into DataService and pull them for UI
    useEffect(() => {
        DataService.init(setProducts);
    }, []);

    // start sync engine once
    useEffect(() => {
        syncEngine.start();
    }, []);

    if (dashboard) {
        const mod = ROLE === "cashier";
        return (
            <Layout setDashboard={setDashboard} view={ROLE}>
            <PrintDashboard
                products={products}
                showModify={mod}
                onBack={() => setDashboard(false)}
            />
            </Layout>
        );
    }

    if (ROLE == "cashier") {
        return (
            <Layout setDashboard={setDashboard} view={ROLE}>
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
            </Layout>
        );
    }

    if (ROLE == "kitchen") {
        return (
            <Layout setDashboard={setDashboard} view={ROLE}>
                <OrderBoard
                    view={ROLE}
                    orders={orders}
                    onAdvance={updateStatus}
                    visibleStatuses={["pending", "preparing"]}
                    onOpenDashboard={() => setDashboard(true)}
                />
            </Layout>
        );
    }

    if (ROLE == "serving") {
        return (
            <Layout setDashboard={setDashboard} view={ROLE}>
                <OrderBoard
                    view={ROLE}
                    orders={orders}
                    onAdvance={updateStatus}
                    visibleStatuses={["ready"]}
                    onOpenDashboard={() => setDashboard(true)}
                />
            </Layout>
        );
    }

    return (
        <Layout setDashboard={setDashboard} view={ROLE}>
            <OrderBoard
                view={ROLE}
                orders={orders}
                onAdvance={updateStatus}
                onOpenDashboard={() => setDashboard(true)}
            />
        </Layout>
    );

};

export default Root;
