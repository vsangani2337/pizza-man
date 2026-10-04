import { describe, it, expect } from 'vitest';
import { normalizeOrder, normalizeItems, formatMoney, formatDate } from './normalizeOrder';

const v2Order = {
  _id: '6570abcdef1234567890abcd',
  orderNumber: 'PM-AABBCCDD',
  createdAt: '2026-01-05T12:00:00.000Z',
  items: [
    {
      type: 'pizza',
      name: 'Margherita Classic',
      quantity: 2,
      unitPrice: 160,
      subtotal: 320,
      sizeName: 'Medium',
      customization: { base: 'Thin Crust', sauce: 'Marinara', cheese: 'Mozzarella', veggies: [] },
    },
  ],
  subtotal: 320,
  deliveryFee: 40,
  tax: 16,
  totalPrice: 376,
  paymentStatus: 'paid',
  status: 'In the Kitchen',
  customer: { name: 'Asha', phone: '9876543210', address: '12 MG Road' },
};

describe('normalizeOrder', () => {
  it('passes v2 multi-item orders through with stable fields', () => {
    const order = normalizeOrder(v2Order);
    expect(order.id).toBe('6570abcdef1234567890abcd');
    expect(order.orderNumber).toBe('PM-AABBCCDD');
    expect(order.items).toHaveLength(1);
    expect(order.quantity).toBe(2);
    expect(order.totalPrice).toBe(376);
    expect(order.status).toBe('In the Kitchen');
    expect(order.statusIndex).toBe(2);
    expect(order.cancelled).toBe(false);
    expect(order.customer.name).toBe('Asha');
    expect(order.summary[0]).toBe('2× Margherita Classic (Medium)');
  });

  it('does not mutate the raw order', () => {
    const snapshot = JSON.stringify(v2Order);
    normalizeOrder(v2Order);
    expect(JSON.stringify(v2Order)).toBe(snapshot);
  });

  it('marks cancelled orders and uses index -1 for unknown status', () => {
    const cancelled = normalizeOrder({ ...v2Order, status: 'Cancelled' });
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.statusIndex).toBe(-1);
  });

  it('falls back to a generated order number when missing', () => {
    const order = normalizeOrder({ ...v2Order, orderNumber: undefined });
    expect(order.orderNumber).toMatch(/^#[0-9A-F]{8}$/);
  });

  it('normalizes legacy single-item pizza orders', () => {
    const legacy = normalizeOrder({
      _id: 'legacy1234567890',
      type: 'pizza',
      pizza: { base: 'Thick Crust', sauce: 'BBQ', cheese: 'Cheddar', veggies: ['Olives'] },
      quantity: 3,
      subtotal: 450,
      totalPrice: 490,
      status: 'Delivered',
    });
    expect(legacy.items).toHaveLength(1);
    expect(legacy.items[0].type).toBe('pizza');
    expect(legacy.items[0].name).toBe('Custom Pizza');
    expect(legacy.items[0].unitPrice).toBe(150);
    expect(legacy.status).toBe('Delivered');
    expect(legacy.statusIndex).toBe(4);
  });

  it('normalizes legacy drink orders', () => {
    const legacy = normalizeOrder({
      _id: 'legacy9876543210',
      type: 'drink',
      drink: { name: 'Classic Cola' },
      quantity: 2,
      subtotal: 120,
      totalPrice: 120,
    });
    expect(legacy.items[0].name).toBe('Classic Cola');
    expect(legacy.items[0].quantity).toBe(2);
    expect(legacy.items[0].unitPrice).toBe(60);
  });
});

describe('normalizeItems', () => {
  it('keeps v2 items untouched by the legacy mapper', () => {
    const items = normalizeItems(v2Order);
    expect(items[0].productId ?? null).toBe(null);
    expect(items[0].unitPrice).toBe(160);
  });

  it('returns an empty-safe list for broken payloads', () => {
    expect(() => normalizeItems({})).not.toThrow();
  });
});

describe('formatters', () => {
  it('formats money with two decimals', () => {
    expect(formatMoney(199)).toBe('₹199.00');
    expect(formatMoney(undefined)).toBe('₹0.00');
    expect(formatMoney('42.5')).toBe('₹42.50');
  });

  it('formats valid dates and falls back for invalid input', () => {
    expect(formatDate('2026-01-05T12:00:00.000Z')).toContain('2026');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});
