'use client';

import { createContext, useContext, useState, useCallback, useSyncExternalStore, ReactNode } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const STORAGE_KEY = 'neurotonics-cart';

function getStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// Use a module-level store for cart state to avoid setState-in-effect issues
let cartListeners: Array<() => void> = [];
let cartSnapshot: CartItem[] = getStoredCart();

function emitCartChange() {
  cartListeners.forEach(listener => listener());
}

function subscribeCart(listener: () => void) {
  cartListeners.push(listener);
  return () => {
    cartListeners = cartListeners.filter(l => l !== listener);
  };
}

function getCartSnapshot() {
  return cartSnapshot;
}

function getServerCartSnapshot() {
  return [];
}

function setCartItems(items: CartItem[]) {
  cartSnapshot = items;
  saveCart(items);
  emitCartChange();
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);

  // We keep a local state that mirrors `items` for derived values only
  // (useSyncExternalStore handles hydration without effects)
  const [, forceUpdate] = useState(0);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, qty: number = 1) => {
    const current = getCartSnapshot();
    const existing = current.find(i => i.id === item.id);
    if (existing) {
      setCartItems(current.map(i => i.id === item.id ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      setCartItems([...current, { ...item, quantity: qty }]);
    }
    forceUpdate(n => n + 1);
  }, []);

  const removeItem = useCallback((id: string) => {
    setCartItems(getCartSnapshot().filter(i => i.id !== id));
    forceUpdate(n => n + 1);
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(getCartSnapshot().filter(i => i.id !== id));
    } else {
      setCartItems(getCartSnapshot().map(i => i.id === id ? { ...i, quantity } : i));
    }
    forceUpdate(n => n + 1);
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    forceUpdate(n => n + 1);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
