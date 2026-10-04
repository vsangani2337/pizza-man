import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

const STORAGE_KEY = 'pizza-cart-v2';
const MAX_LINE_QTY = 50;
const MAX_LINES = 20;

const CartContext = createContext(null);

const sortNames = (list) => [...(list || [])].map((n) => String(n).toLowerCase()).sort();

/** Stable identity for a cart line: identical configs merge, different ones don't. */
export const cartLineKey = (item) => {
  if (item.type === 'drink') return `drink|${item.name.toLowerCase()}`;
  if (item.productId) return `pizza|p|${item.productId}|${item.size || 'medium'}`;
  const c = item.customization || {};
  return [
    'pizza|custom',
    item.size || 'medium',
    (c.base || '').toLowerCase(),
    (c.sauce || '').toLowerCase(),
    (c.cheese || '').toLowerCase(),
    sortNames(c.veggies).join('+'),
    sortNames(c.addons).join('+'),
  ].join('|');
};

/** Cart lines → the payload the pricing API expects (never includes prices). */
export const buildQuotePayload = (items) =>
  items.map((item) => {
    if (item.type === 'drink') {
      return { type: 'drink', name: item.name, quantity: item.quantity };
    }
    if (item.productId) {
      return { type: 'pizza', productId: item.productId, size: item.size, quantity: item.quantity };
    }
    const c = item.customization || {};
    return {
      type: 'pizza',
      base: c.base,
      sauce: c.sauce,
      cheese: c.cheese,
      veggies: c.veggies || [],
      addons: c.addons || [],
      size: item.size,
      quantity: item.quantity,
    };
  });

const hydrate = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.name && item.quantity >= 1)
      .map((item) => ({ ...item, quantity: Math.min(item.quantity, MAX_LINE_QTY) }))
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD': {
      const incoming = action.item;
      const key = cartLineKey(incoming);
      const existing = state.find((item) => cartLineKey(item) === key);
      if (existing) {
        return state.map((item) =>
          cartLineKey(item) === key
            ? { ...item, quantity: Math.min(item.quantity + incoming.quantity, MAX_LINE_QTY) }
            : item
        );
      }
      if (state.length >= MAX_LINES) return state;
      return [...state, { ...incoming, key }];
    }
    case 'SET_QTY': {
      if (action.quantity < 1) return state.filter((item) => (item.key || cartLineKey(item)) !== action.key);
      return state.map((item) =>
        (item.key || cartLineKey(item)) === action.key
          ? { ...item, quantity: Math.min(action.quantity, MAX_LINE_QTY) }
          : item
      );
    }
    case 'REMOVE':
      return state.filter((item) => (item.key || cartLineKey(item)) !== action.key);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [items, dispatch] = useReducer(reducer, undefined, hydrate);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage full/unavailable — cart still works in memory
    }
  }, [items]);

  const value = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Math.round(items.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0) * 100) / 100;

    return {
      items,
      itemCount,
      subtotal,
      addItem: (item) => dispatch({ type: 'ADD', item }),
      setQuantity: (key, quantity) => dispatch({ type: 'SET_QTY', key, quantity }),
      removeItem: (key) => dispatch({ type: 'REMOVE', key }),
      clearCart: () => dispatch({ type: 'CLEAR' }),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
