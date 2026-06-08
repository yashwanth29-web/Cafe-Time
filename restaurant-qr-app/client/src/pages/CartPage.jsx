import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CartItem from '../components/CartItem';
import RazorpayPayment from '../components/RazorpayPayment';
import { getOrderById, placeOrder } from '../services/api';

const CartPage = ({ cart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState('Preparing');

  // Customer Details Form States
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Counter payment state
  const [selectedCounterPay, setSelectedCounterPay] = useState(false);

  // Totals calculations
  const subtotal = cart.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);
  const grandTotal = subtotal;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!customerName || !customerEmail || !customerPhone) {
      alert('Please fill out your contact details before placing your order.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const itemsPayload = cart.map((cartItem) => ({
        id: cartItem.item.id || cartItem.item._id,
        name: cartItem.item.name,
        price: cartItem.item.price,
        quantity: cartItem.quantity,
      }));

      const orderPayload = {
        tableNumber: tableNumber || 'Takeaway',
        items: itemsPayload,
        totalAmount: grandTotal,
        customerName,
        customerEmail,
        customerPhone
      };

      const response = await placeOrder(orderPayload);

      if (response.success) {
        setPlacedOrder(response.data);
        setOrderStatus(response.data.status);
        setSuccess(true);
        clearCart();
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

  const [voicePlayed, setVoicePlayed] = useState(false);

  // Helper to play a pleasant service alert chime using Web Audio API
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Node 1: C5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.4);
      
      // Node 2: G5
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        gain2.gain.setValueAtTime(0.15, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.6);
      }, 150);
    } catch (e) {
      console.error('Web Audio API chime failed:', e);
    }
  };

  // Helper to read voice greeting using Web Speech API
  const speakThankYou = () => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();
      
      const text = `Payment successful. Thank you for visiting CoffeeDay Cafe! Have a wonderful day.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Trigger sound and speech synthesis once payment is successful
  useEffect(() => {
    if (placedOrder && placedOrder.paymentStatus === 'Paid' && !voicePlayed) {
      playChime();
      speakThankYou();
      setVoicePlayed(true);
    }
  }, [placedOrder?.paymentStatus, voicePlayed, placedOrder]);

  // Dynamic Live Tracker Success view
  if (success && placedOrder) {
    const isServed = orderStatus === 'Served';
    const isPaid = placedOrder.paymentStatus === 'Paid';

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
          ) : isPaid ? (
            <div style={{ textAlign: 'center' }}>
              <div className="success-icon-container" style={{ backgroundColor: '#1b4d3e', color: '#85e3b2', width: '64px', height: '64px', fontSize: '32px', margin: '0 auto 20px auto', animation: 'bounce 1s infinite' }}>
                ✔
              </div>
              <h2 className="success-title" style={{ color: 'var(--color-success)', fontSize: '24px', fontWeight: 900 }}>Paid & Completed!</h2>
              <p className="success-message" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                Thank you for the payment! Your transaction is verified. We hope you enjoyed your meal at CoffeeDay Cafe!
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div className="success-icon-container" style={{ backgroundColor: '#aa820a', color: '#fff', width: '64px', height: '64px', fontSize: '32px', margin: '0 auto 20px auto' }}>
                🍽️
              </div>
              <h2 className="success-title" style={{ color: '#fff', fontSize: '22px', fontWeight: 900 }}>Served & Enjoy!</h2>
              <p className="success-message" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                Your delicious food has been served! Please select your payment method below to complete the order.
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
              <span style={{ color: 'var(--color-text-secondary)' }}>Total Amount</span>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{placedOrder.totalAmount.toFixed(2)}</span>
            </div>
            <div className="success-details-row">
              <span style={{ color: 'var(--color-text-secondary)' }}>Payment Status</span>
              <span style={{ fontWeight: 800, color: isPaid ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {placedOrder.paymentStatus}
              </span>
            </div>
            <div className="success-details-row" style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '8px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Ordered Items</span>
              <span style={{ fontWeight: 600, fontSize: '12px', textAlign: 'right', color: 'var(--color-text-primary)' }}>
                {placedOrder.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
              </span>
            </div>
          </div>

          {/* Post-Served Payment Options Selector */}
          {isServed && !isPaid && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              {selectedCounterPay ? (
                <div>
                  <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🛎️ Counter Payment Requested
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
                    Please proceed to the cashier and share your <strong>Table Number ({placedOrder.tableNumber})</strong> or <strong>Order ID ({placedOrder._id.slice(-6).toUpperCase()})</strong> to complete payment.
                  </p>
                  <button
                    onClick={() => setSelectedCounterPay(false)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '12px', width: '100%' }}
                  >
                    Change to Pay Online
                  </button>
                </div>
              ) : (
                <div>
                  <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '800', marginBottom: '12px', textAlign: 'center' }}>
                    💳 Select Payment Method
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <RazorpayPayment
                      cart={placedOrder.items.map(it => ({ item: it, quantity: it.quantity }))}
                      tableNumber={placedOrder.tableNumber}
                      customerDetails={{
                        name: customerName || placedOrder.customerName || 'Customer',
                        email: customerEmail || placedOrder.customerEmail || 'customer@example.com',
                        phone: customerPhone || placedOrder.customerPhone || '9999999999'
                      }}
                      existingOrderId={placedOrder._id}
                      buttonText="Pay Online (Razorpay)"
                      onPaymentSuccess={(updatedOrder) => {
                        setPlacedOrder(updatedOrder);
                        setOrderStatus(updatedOrder.status);
                      }}
                      onPaymentError={(err) => {
                        setErrorMsg(err);
                      }}
                    />
                    
                    <button
                      onClick={() => setSelectedCounterPay(true)}
                      className="btn btn-secondary"
                      style={{
                        padding: '12px',
                        fontSize: '14px',
                        fontWeight: '700',
                        width: '100%',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        border: '1px solid var(--color-border)',
                        color: '#fff',
                        background: 'rgba(255,255,255,0.05)'
                      }}
                    >
                      <span>🛎️</span>
                      <span>Pay at Counter</span>
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', color: '#fff', fontSize: '12px', padding: '10px', marginTop: '12px', borderRadius: '8px' }}>
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>
          )}

          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isPaid ? 'Order More Delicacies' : 'Back to Menu'}
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

            {/* Customer Details Section */}
            <div className="customer-details-card" style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--color-border)',
              padding: '16px',
              borderRadius: '12px',
              margin: '16px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0 0 4px 0', color: '#fff', letterSpacing: '0.5px' }}>
                👤 CONTACT INFORMATION
              </h4>
              
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0,0,0,0.15)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0,0,0,0.15)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <input
                  type="tel"
                  placeholder="Contact Mobile Number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0,0,0,0.15)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div className="summary-row">
              <span>Items Total</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            
            <div className="summary-row">
              <span>GST & Restaurant Charges</span>
              <span>₹0.00</span>
            </div>

            <div className="summary-row total">
              <span>Grand Total</span>
              <span className="summary-total-val">₹{grandTotal.toFixed(2)}</span>
            </div>

            {errorMsg && (
              <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: '#fff', fontSize: '13px', padding: '10px', marginTop: '15px' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <button
                onClick={handlePlaceOrder}
                className={`btn btn-primary ${(loading || cart.length === 0 || !customerName || !customerEmail || !customerPhone) ? 'btn-disabled' : ''}`}
                disabled={loading || cart.length === 0 || !customerName || !customerEmail || !customerPhone}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  fontSize: '16px',
                  fontWeight: '800',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                  color: '#fff',
                  cursor: (loading || cart.length === 0 || !customerName || !customerEmail || !customerPhone) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-rzp" style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                      marginRight: '8px'
                    }}></span>
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
