import Icon from './Icon';

const STATUS_CLASS = {
  'Order Placed': 'badge-placed',
  'Order Received': 'badge-received',
  'In the Kitchen': 'badge-kitchen',
  'Sent to Delivery': 'badge-delivery',
  Delivered: 'badge-delivered',
  Cancelled: 'badge-cancelled',
};

const STATUS_ICON = {
  'Order Placed': 'package',
  'Order Received': 'check',
  'In the Kitchen': 'chef',
  'Sent to Delivery': 'car',
  Delivered: 'location',
  Cancelled: 'close',
};

const PAYMENT_CLASS = {
  paid: 'badge-delivered',
  failed: 'badge-cancelled',
  pending: 'badge-placed',
  refunded: 'badge-received',
};

const PAYMENT_ICON = {
  paid: 'check',
  failed: 'close',
  pending: 'clock',
  refunded: 'refresh',
};

export const statusBadgeClass = (status) => STATUS_CLASS[status] || 'badge-neutral';
export const paymentBadgeClass = (status) => PAYMENT_CLASS[status] || 'badge-neutral';

/** Single source of truth for order/payment status pills. */
const StatusBadge = ({ status, kind = 'order', dot = false, size = 'md', icon = false }) => {
  const className = kind === 'payment' ? paymentBadgeClass(status) : statusBadgeClass(status);
  const label = kind === 'payment' && status ? String(status).toUpperCase() : status;
  const glyph = kind === 'payment' ? PAYMENT_ICON[status] : STATUS_ICON[status];

  return (
    <span className={`badge ${className} ${dot ? 'badge-dot' : ''} ${size === 'lg' ? 'badge-lg' : ''}`}>
      {icon && glyph ? <Icon name={glyph} size={size === 'lg' ? 14 : 13} strokeWidth={2.1} className="badge-icon" /> : null}
      {label}
    </span>
  );
};

export default StatusBadge;
