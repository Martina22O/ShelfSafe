/**
 * Context: SaleCartContext
 * In-memory cart for recorded sales during an active session.
 * Cleared on sign out or when sale is completed/cancelled.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SaleCartItem } from '../types/inventory';
import { supabase } from '../services/supabase';

export type AddItemResult =
  | { success: true }
  | { success: false; reason: 'no_sellable_units' | 'limit_reached'; message: string; limit?: number };

interface SaleCartContextValue {
  items: SaleCartItem[];
  addItem: (product: {
    id: string;
    name: string;
    barcode: string | null;
    price: number;
    sellable_units: number;
  }) => AddItemResult;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const SaleCartContext = createContext<SaleCartContextValue | undefined>(undefined);

export function SaleCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SaleCartItem[]>([]);

  // Clear cart whenever user signs out
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setItems([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addItem = (product: {
    id: string;
    name: string;
    barcode: string | null;
    price: number;
    sellable_units: number;
  }): AddItemResult => {
    if (product.sellable_units <= 0) {
      return {
        success: false,
        reason: 'no_sellable_units',
        message: 'No sellable units for this product',
      };
    }

    const existingIndex = items.findIndex((i) => i.productId === product.id);

    if (existingIndex >= 0) {
      const current = items[existingIndex];
      if (current.quantity >= product.sellable_units) {
        return {
          success: false,
          reason: 'limit_reached',
          message: `Only ${product.sellable_units} sellable units`,
          limit: product.sellable_units,
        };
      }

      setItems((prev) => {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1,
          sellableUnits: product.sellable_units,
        };
        return next;
      });
      return { success: true };
    }

    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        sellableUnits: product.sellable_units,
        quantity: 1,
      },
    ]);
    return { success: true };
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const clamped = Math.max(1, quantity);
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  return (
    <SaleCartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </SaleCartContext.Provider>
  );
}

export function useSaleCart(): SaleCartContextValue {
  const context = useContext(SaleCartContext);
  if (!context) {
    throw new Error('useSaleCart must be used within a SaleCartProvider');
  }
  return context;
}
