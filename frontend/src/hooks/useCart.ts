import { useCallback, useEffect, useState } from 'react';
import { DataService } from '../services/DataService';

export function useCart() {
  const [cart, setCart] = useState<Record<string, number>>(DataService.getCart());

  useEffect(() => {
    const unsubscribe = DataService.subscribeCart(setCart);
    return unsubscribe;
  }, []);

  const addItem = useCallback((productId: string) => {
    DataService.addToCart(productId);
  }, []);

  const removeItem = useCallback((productId: string) => {
    DataService.removeFromCart(productId);
  }, []);

  const clearCart = useCallback(() => {
    DataService.clearCart();
  }, []);

  return {
    cart,
    addItem,
    removeItem,
    clearCart
  };
} 