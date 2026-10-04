import { Modal } from './Modal';
import { formatMoney, formatDate } from '../utils/normalizeOrder';
import './Receipt.css';

/** Printable order receipt — uses @media print rules in Receipt.css. */
export const Receipt = ({ open, order, storeName = 'Pizza Man', onClose }) => {
  if (!order) return null;

  const print = () => window.print();

  return (
    <Modal
      open={open}
      title={`Receipt · ${order.orderNumber}`}
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={print}>🖨 Print / Save PDF</button>
        </>
      }
    >
      <div className="receipt-print">
        <div className="receipt-head">
          <span className="receipt-brand">🍕 {storeName}</span>
          <span className="receipt-sub">Order receipt</span>
        </div>

        <div className="receipt-meta">
          <div><span>Order</span><strong>{order.orderNumber}</strong></div>
          <div><span>Date</span><strong>{formatDate(order.createdAt)}</strong></div>
          <div><span>Status</span><strong>{order.status}</strong></div>
          <div><span>Payment</span><strong>{order.paymentStatus}</strong></div>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={`${item.name}-${index}`}>
                <td>
                  {item.name}
                  {item.sizeName ? ` (${item.sizeName})` : ''}
                </td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-charges">
          <div><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div><span>Delivery fee</span><span>{formatMoney(order.deliveryFee)}</span></div>
          <div><span>Tax</span><span>{formatMoney(order.tax)}</span></div>
          {order.discount > 0 && <div><span>Discount</span><span>− {formatMoney(order.discount)}</span></div>}
          <div className="receipt-total"><span>Total</span><span>{formatMoney(order.totalPrice)}</span></div>
        </div>

        {order.customer && (
          <div className="receipt-customer">
            <strong>{order.customer.name}</strong>
            <span>{order.customer.phone}</span>
            <span>{order.customer.address}</span>
          </div>
        )}

        {order.paymentId && <div className="receipt-payment-id">Payment ID: {order.paymentId}</div>}

        <div className="receipt-thanks">Thank you for ordering! 🍕</div>
      </div>
    </Modal>
  );
};

export default Receipt;
