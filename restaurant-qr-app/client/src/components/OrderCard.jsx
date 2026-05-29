import React from 'react';

const OrderCard = ({ order, onStatusUpdate }) => {
  const { _id, tableNumber, items, totalAmount, status, createdAt } = order;

  // Format time
  const formatTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="order-card">
      <div className="order-card-header">
        <span className="order-table">Table {tableNumber}</span>
        <span className="order-time">{formatTime(createdAt)}</span>
      </div>
      
      <div className="order-items-list">
        {items.map((item, idx) => (
          <div key={idx} className="order-item-row">
            <span>
              {item.name} <span className="order-item-qty">x{item.quantity}</span>
            </span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      
      <div className="order-card-footer">
        <span className="order-total-label">Total Amount:</span>
        <span className="order-total-amount">${totalAmount.toFixed(2)}</span>
      </div>
      
      <div className="order-actions">
        {status === 'Preparing' ? (
          <button 
            onClick={() => onStatusUpdate(_id, 'Served')}
            className="btn btn-action btn-action-ready"
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}
          >
            🍽️ Serve Order
          </button>
        ) : (
          <button 
            className="btn btn-action btn-disabled"
            disabled
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 'bold', backgroundColor: '#1b4d3e', color: '#85e3b2', border: '1px solid #2e7d63' }}
          >
            ✓ Served & Completed
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
