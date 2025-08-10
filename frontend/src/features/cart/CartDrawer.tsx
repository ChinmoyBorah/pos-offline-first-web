import React from "react";
import { Product } from "../catalog/types";
import styles from "./cartDrawer.module.css";

interface Props {
  products: Product[];
  cart: Record<string, number>;
  onAdd: (productId: string) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<Props> = ({
  products,
  cart,
  onAdd,
  onRemove,
  onCheckout,
}) => {
  const cartItems = Object.entries(cart)
    .map(([productId, qty]) => {
      const product = products.find((p) => p.id === productId);
      return { ...product, qty };
    })
    .filter(
      (
        item
      ): item is { id: string; name: string; price: number; qty: number } =>
        item !== null
    );

  const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className={styles.cartContainer}>
      <h2>Cart</h2>
      {cartItems.length === 0 && <p>No items yet.</p>}
      {cartItems.map(({ id, name, qty }) => (
        <div
          key={id}
          className={styles.cartContent}>
          <span>
            {name} x {qty}
          </span>
          <div>
            <button onClick={() => onRemove(id)}>-</button>
            <button onClick={() => onAdd(id)}>+</button>
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
