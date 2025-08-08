import React, { useEffect, useState } from 'react';
import CatalogList from './features/catalog/CatalogList';
import CartDrawer from './features/cart/CartDrawer';
import OrderBoard from './features/orders/OrderBoard';
import { Product } from './features/catalog/types';
import { initialProducts } from './data/mockProducts';
import { DataService } from './services/DataService';
import { useCart } from './hooks/useCart';
import { useOrders } from './hooks/useOrders';
import NavBar from './components/NavBar';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { cart, addItem, removeItem } = useCart();
  const { orders, updateStatus } = useOrders();

  const [view, setView] = useState<string>('cashier');

  // Seed products into DataService and pull them for UI
  useEffect(() => {
    (async () => {
      await DataService.init(initialProducts);
      setProducts(DataService.getProducts());
    })();
  }, []);

  let content: React.ReactNode;
  if (view === 'cashier') {
    content = (
      <>
        <CatalogList products={products} onAdd={addItem} />
        <CartDrawer
          products={products}
          cart={cart}
          onAdd={addItem}
          onRemove={removeItem}
          onCheckout={() => DataService.createOrder(cart)}
        />
      </>
    );
  } else if (view === 'kitchen') {
    content = (
      <OrderBoard
        orders={orders}
        onAdvance={updateStatus}
        visibleStatuses={['pending', 'preparing']}
      />
    );
  } else if (view === 'serving') {
    content = (
      <OrderBoard
        orders={orders}
        onAdvance={updateStatus}
        visibleStatuses={['ready']}
      />
    );
  } else {
    content = (
      <OrderBoard orders={orders} onAdvance={updateStatus} />
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar view={view} setView={setView} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>{content}</div>
    </div>
  );
};

export default App; 