import React from 'react';
import { Product } from '../catalog/types';

interface Props {
  products: Product[];
  cart: Record<string, number>;
  onAdd: (productId: string) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<Props> = ({ products, cart, onAdd, onRemove, onCheckout }) => {
  const cartItems = Object.entries(cart)
    .map(([productId, qty]) => {
      const product = products.find(p => p.id === productId);
      if (!product) return null; // product list not loaded yet or missing
      return { product, qty };
    })
    .filter((item): item is { product: Product; qty: number } => item !== null);

  const total = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );

  return (
    <div
      style={{
        width: '300px',
        borderLeft: '1px solid #ddd',
        padding: '1rem',
        overflowY: 'auto'
      }}
    >
      <h2>Cart</h2>
      {cartItems.length === 0 && <p>No items yet.</p>}
      {cartItems.map(({ product, qty }) => (
        <div
          key={product.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}
        >
          <span>
            {product.name} x {qty}
          </span>
          <div>
            <button onClick={() => onRemove(product.id)}>-</button>
            <button onClick={() => onAdd(product.id)}>+</button>
          </div>
        </div>
      ))}
      <hr />
      <h3>Total: ${total.toFixed(2)}</h3>
      <button disabled={cartItems.length === 0} onClick={onCheckout}>
        Checkout
      </button>
    </div>
  );
};

export default CartDrawer; 