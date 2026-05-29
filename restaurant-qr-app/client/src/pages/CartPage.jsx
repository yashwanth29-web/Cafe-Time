import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CartItem from '../components/CartItem';
import { placeOrder, getOrderById } from '../services/api';

const CartPage = ({ cart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState('Preparing');

  // Totals calculations
  const subtotal = cart.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);
  const grandTotal = subtotal;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);
    setErrorMsg('');

    try {
      // Reformat items
      const itemsPayload = cart.map((cartItem) => ({
        id: cartItem.item.id,
        name: cartItem.item.name,
        price: cartItem.item.price,
        quantity: cartItem.quantity,
      }));

      const orderPayload = {
        tableNumber: tableNumber || 'Takeaway',
        items: itemsPayload,
        totalAmount: grandTotal,
      };

      const response = await placeOrder(orderPayload);

      if (response.success) {
        setPlacedOrder(response.data);
        setOrderStatus(response.data.status);
        setSuccess(true);
        clearCart(); // Clear cart state
      } else {
        setErrorMsg(response.message || 'Failed to place order. Please try again.');
      }
    } catch (error) {
      console.error('Order placement failed:', error);
      setErrorMsg(error.response?.data?.message || 'Server connection error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Poll order status if order was successfully placed
  useEffect(() => {
    if (!success || !placedOrder) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await getOrderById(placedOrder._id);
        if (response.success) {
          setPlacedOrder(response.data);
          setOrderStatus(response.data.status);
        }
      } catch (error) {
        console.error('Failed to poll order status:', error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [success, placedOrder]);

  // Dynamic Live Tracker Success view
  if (success && placedOrder) {
    const isServed = orderStatus === 'Served';

    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '20px 10px' }}>
        <div className="success-screen" style={{ width: '100%', maxWidth: '440px', padding: '32px 24px', animation: 'scaleUp 0.3s ease-out' }}>
          
          {/* Visual Status Header */}
          {!isServed ? (
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: '60px', height: '60px', borderWidth: '5px', margin: '0 auto 20px auto', borderTopColor: 'var(--color-primary)' }}></div>
              <h2 className="success-title" style={{ fontSize: '22px', fontWeight: 900 }}>Chef is Preparing!</h2>
              <p className="success-message" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                Your order is currently active in the kitchen feed. Our chefs are crafting your fresh order!
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div className="success-icon-container" style={{ backgroundColor: '#1b4d3e', color: '#85e3b2', width: '64px', height: '64px', fontSize: '32px', margin: '0 auto 20px auto', animation: 'bounce 1s infinite' }}>
                ✔
              </div>
              <h2 className="success-title" style={{ color: 'var(--color-success)', fontSize: '24px', fontWeight: 900 }}>Served & Enjoy!</h2>
              <p className="success-message" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                Your delicious food has been served! We hope you have an amazing time at CoffeeDay Cafe.
              </p>
            </div>
          )}

          {/* Interactive Progress Track */}
          <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '8px', marginBottom: '28px', padding: '0 8px' }}>
            {/* Step 1: Received & Preparing */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                boxShadow: '0 0 8px var(--color-primary)'
              }}></div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-primary)' }}>🍳 Preparing</span>
            </div>

            {/* Connecting Bar */}
            <div style={{ flex: 2, height: '4px', background: isServed ? 'var(--color-success)' : 'var(--color-border)', borderRadius: '2px', transition: 'background 0.5s ease' }}></div>

            {/* Step 2: Served */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isServed ? 'var(--color-success)' : 'var(--color-border)',
                boxShadow: isServed ? '0 0 8px var(--color-success)' : 'none',
                transition: 'background 0.5s ease'
              }}></div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isServed ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>🍽️ Served</span>
            </div>
          </div>
          
          {/* Order Details Card */}
          <div className="success-details" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
            <div className="success-details-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Order ID</span>
              <span style={{ fontWeight: 600, fontSize: '10px', color: 'var(--color-secondary)' }}>{placedOrder._id}</span>
            </div>
            <div className="success-details-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Table</span>
              <span style={{ fontWeight: 800, color: '#fff' }}>{placedOrder.tableNumber}</span>
            </div>
            <div className="success-details-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Total Paid</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>${placedOrder.totalAmount.toFixed(2)}</span>
            </div>
            <div className="success-details-row" style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Ordered Items</span>
              <span style={{ fontWeight: 600, fontSize: '12px', textAlign: 'right', color: 'var(--color-text-primary)' }}>
                {placedOrder.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
              </span>
            </div>
          </div>

          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isServed ? 'Order More Delicacies' : 'Back to Menu'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header">
        <h2 className="cart-title">Your Order Cart</h2>
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <p className="cart-empty-text">Your cart is currently empty.</p>
          <Link to="/" className="btn btn-secondary">
            Browse Delicious Menu
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Cart Items List */}
          <div className="cart-items-section">
            {cart.map((cartItem) => (
              <CartItem
                key={cartItem.item.id}
                item={cartItem}
                increaseQuantity={increaseQuantity}
                decreaseQuantity={decreaseQuantity}
                removeFromCart={removeFromCart}
              />
            ))}
          </div>

          {/* Cart Summary Panel */}
          <div className="cart-summary-card">
            <h3 className="summary-title">Order Summary</h3>
            
            <div className="table-selector-section">
              <span className="table-selector-label">Ordering For</span>
              <div className="table-selector-val">
                {tableNumber ? `Table Number: ${tableNumber}` : 'Takeaway / Walk-in'}
              </div>
            </div>

            <div className="summary-row">
              <span>Items Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="summary-row">
              <span>GST & Restaurant Charges</span>
              <span>$0.00</span>
            </div>

            <div className="summary-row total">
              <span>Grand Total</span>
              <span className="summary-total-val">${grandTotal.toFixed(2)}</span>
            </div>

            {errorMsg && (
              <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: '#fff', fontSize: '13px', padding: '10px', marginTop: '15px' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <button
                onClick={handlePlaceOrder}
                className={`btn btn-primary ${(loading || cart.length === 0) ? 'btn-disabled' : ''}`}
                disabled={loading || cart.length === 0}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Placing order...
                  </>
                ) : (
                  'Place Order'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
