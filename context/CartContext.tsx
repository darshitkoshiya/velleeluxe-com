'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, Product } from '@/lib/types';
import { MAX_QUANTITY_PER_ITEM } from '@/lib/utils';

const STORAGE_KEY = 'vl-cart-v1';

export interface CartContextValue {
  items: CartItem[];
  addItem: (product: Product, size: string, quantity?: number) => void;
  removeItem: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  /** False until the saved cart has been read from localStorage. */
  hydrated: boolean;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.size === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.product === 'object' &&
    item.product !== null &&
    typeof item.product.id === 'string' &&
    typeof item.product.price === 'number'
  );
}

function readStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

const clampQuantity = (quantity: number) => Math.max(1, Math.min(MAX_QUANTITY_PER_ITEM, Math.floor(quantity)));

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load the saved cart once, in the browser.
  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);

    // Keep multiple open tabs in sync.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setItems(readStoredCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Save whenever the cart changes (after the initial load).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or disabled (private mode) — cart still works for this visit.
    }
  }, [items, hydrated]);

  const addItem = useCallback((product: Product, size: string, quantity = 1) => {
    setItems((current) => {
      const index = current.findIndex((i) => i.product.id === product.id && i.size === size);
      if (index === -1) {
        return [...current, { product, size, quantity: clampQuantity(quantity) }];
      }
      const next = [...current];
      next[index] = { product, size, quantity: clampQuantity(next[index].quantity + quantity) };
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string, size: string) => {
    setItems((current) => current.filter((i) => !(i.product.id === productId && i.size === size)));
  }, []);

  const updateQuantity = useCallback((productId: string, size: string, quantity: number) => {
    setItems((current) => {
      if (quantity < 1) {
        return current.filter((i) => !(i.product.id === productId && i.size === size));
      }
      return current.map((i) =>
        i.product.id === productId && i.size === size ? { ...i, quantity: clampQuantity(quantity) } : i,
      );
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    return {
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      subtotal,
      hydrated,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    };
  }, [items, addItem, removeItem, updateQuantity, clearCart, hydrated, isDrawerOpen, openDrawer, closeDrawer]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
