'use client';

/**
 * Wishlist store (Zustand), saved in the browser under "vl-wishlist-v1".
 *
 * Whole Product objects are stored so the wishlist page can render instantly
 * without fetching the catalogue. Hydration from localStorage is deferred until
 * after the first client render (see useWishlist) to avoid SSR mismatches.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '@/lib/types';

export const WISHLIST_STORAGE_KEY = 'vl-wishlist-v1';

interface WishlistState {
  items: Product[];
  /** True once saved items have been read from localStorage. */
  hasHydrated: boolean;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Product) => void;
  isWishlisted: (productId: string) => boolean;
  clearWishlist: () => void;
  setHasHydrated: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      addItem: (product) => {
        if (get().items.some((item) => item.id === product.id)) return;
        set({ items: [product, ...get().items] });
      },
      removeItem: (productId) => set({ items: get().items.filter((item) => item.id !== productId) }),
      toggleItem: (product) => {
        if (get().isWishlisted(product.id)) get().removeItem(product.id);
        else get().addItem(product);
      },
      isWishlisted: (productId) => get().items.some((item) => item.id === productId),
      clearWishlist: () => set({ items: [] }),
      setHasHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: WISHLIST_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => {
        // Older builds saved a plain array of IDs under the same key — ignore that shape.
        const saved = persisted as { items?: unknown } | undefined;
        const items = Array.isArray(saved?.items)
          ? (saved.items as Product[]).filter((item) => item && typeof item.id === 'string')
          : [];
        return { ...current, items };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    },
  ),
);

/**
 * Wishlist hook for components. Reads saved items from localStorage after mount.
 * `loading` is true until that has happened.
 */
export function useWishlist() {
  const items = useWishlistStore((state) => state.items);
  const hasHydrated = useWishlistStore((state) => state.hasHydrated);
  const addItem = useWishlistStore((state) => state.addItem);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const toggleItem = useWishlistStore((state) => state.toggleItem);
  const clearWishlist = useWishlistStore((state) => state.clearWishlist);

  useEffect(() => {
    if (!useWishlistStore.getState().hasHydrated) void useWishlistStore.persist.rehydrate();
  }, []);

  // Derived from `items` so components re-render when the list changes.
  const isWishlisted = (productId: string) => items.some((item) => item.id === productId);

  return { items, isWishlisted, addItem, removeItem, toggleItem, clearWishlist, loading: !hasHydrated };
}

export default useWishlistStore;
