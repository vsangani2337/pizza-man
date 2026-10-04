/**
 * Normalizes both v2 multi-item orders and legacy single-item orders into
 * one stable shape for MyOrders + admin Orders. Never mutates the input.
 */
const legacyItems = (raw) => {
  const quantity = raw.quantity || 1;
  if (raw.type === 'drink') {
    return [{
      type: 'drink',
      name: raw.drink?.name || 'Drink',
      image: '',
      sizeName: null,
      customization: null,
      quantity,
      unitPrice: (raw.subtotal || 0) / quantity,
      subtotal: raw.subtotal || 0,
    }];
  }
  return [{
    type: 'pizza',
    name: 'Custom Pizza',
    image: '',
    sizeName: raw.pizza?.sizeName || null,
    customization: raw.pizza || null,
    quantity,
    unitPrice: (raw.subtotal || 0) / quantity,
    subtotal: raw.subtotal || 0,
  }];
};

export const normalizeItems = (raw) => {
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    return raw.items.map((item) => ({
      type: item.type,
      name: item.name,
      image: item.image || '',
      productId: item.productId || null,
      size: item.size || null,
      sizeName: item.sizeName || null,
      customization: item.customization || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));
  }
  return legacyItems(raw);
};

export const STATUS_FLOW = [
  'Order Placed',
  'Order Received',
  'In the Kitchen',
  'Sent to Delivery',
  'Delivered',
];

export const normalizeOrder = (raw) => {
  const items = normalizeItems(raw);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: raw._id,
    orderNumber: raw.orderNumber || `#${String(raw._id).slice(-8).toUpperCase()}`,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    items,
    quantity,
    summary: items.map((item) => `${item.quantity}× ${item.name}${item.sizeName ? ` (${item.sizeName})` : ''}`),
    subtotal: raw.subtotal ?? 0,
    deliveryFee: raw.deliveryFee ?? 0,
    tax: raw.tax ?? 0,
    discount: raw.discount ?? 0,
    totalPrice: raw.totalPrice ?? 0,
    paymentStatus: raw.paymentStatus || 'paid',
    paymentId: raw.razorpayPaymentId || null,
    status: raw.status || 'Order Placed',
    cancelled: raw.status === 'Cancelled',
    statusIndex: STATUS_FLOW.indexOf(raw.status),
    customer: raw.customer || null,
    user: raw.user || null,
    raw,
  };
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/** "October 3, 2026 • 8:50 PM" — order detail header. */
export const formatOrderStamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${day} • ${time}`;
};

/** "3 Oct • 8:50 PM" — compact sidebar/meta variant. */
export const formatOrderMeta = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${day} • ${time}`;
};

export const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;
