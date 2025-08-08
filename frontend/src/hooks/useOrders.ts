import { useCallback, useEffect, useState } from 'react';
import { DataService, Order, OrderStatus } from '../services/DataService';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(DataService.getOrders());

  useEffect(() => {
    const unsub = DataService.subscribeOrders(setOrders);
    return unsub;
  }, []);

  const updateStatus = useCallback((orderId: string, status: OrderStatus) => {
    DataService.updateOrderStatus(orderId, status);
  }, []);

  return { orders, updateStatus };
} 