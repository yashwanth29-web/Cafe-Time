import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CartItem from '../components/CartItem';
import RazorpayPayment from '../components/RazorpayPayment';
import { getOrderById, placeOrder, updateOrderPaymentMethod } from '../services/api';

const CartPage = ({ cart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber, cafeId }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeOrders, setActiveOrders] = useState([]);

  // Customer Details Form States
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('customerName') || '');
  const [customerEmail, setCustomerEmail] = useState(() => localStorage.getItem('customerEmail') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('customerPhone') || '');

  // Keep contact details in localStorage for convenience on future visits
  useEffect(() => {
    if (customerName) localStorage.setItem('customerName', customerName);
  }, [customerName]);
  useEffect(() => {
    if (customerEmail) localStorage.setItem('customerEmail', customerEmail);
  }, [customerEmail]);
  useEffect(() => {
    if (customerPhone) localStorage.setItem('customerPhone', customerPhone);
  }, [customerPhone]);

  // Voiced/audio feedback state to prevent duplicates
  const [voicedOrderIds, setVoicedOrderIds] = useState([]);

  // Helper to play a pleasant service alert chime using Web Audio API
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
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
      
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime);
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
      window.speechSynthesis.cancel();
      const text = `Payment successful. Thank you for visiting CoffeeDay Cafe! Have a wonderful day.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  const triggerPaidFeedback = (orderId) => {
    setVoicedOrderIds(prev => {
      if (prev.includes(orderId)) return prev;
      playChime();
      speakThankYou();
      return [...prev, orderId];
    });
  };

  // Fetch active orders on mount
  useEffect(() => {
    const fetchActiveOrders = async () => {
      const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
      if (activeIds.length === 0) {
        setSuccess(false);
        return;
      }

      setLoadingOrders(true);
      const fetched = [];
      let updatedIds = [...activeIds];

      for (const id of activeIds) {
        try {
          const res = await getOrderById(id);
          if (res.success) {
            if (res.data.paymentStatus !== 'Paid') {
              fetched.push(res.data);
            } else {
              // Remove paid orders from active list
              updatedIds = updatedIds.filter(x => x !== id);
              if (!voicedOrderIds.includes(id)) {
                triggerPaidFeedback(id);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching active order:', id, error);
        }
      }

      sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));

      if (fetched.length > 0) {
        setActiveOrders(fetched);
        setSuccess(true);
      } else {
        setSuccess(false);
      }
      setLoadingOrders(false);
    };

    fetchActiveOrders();
  }, []);

  // Poll order status if order was successfully placed
  useEffect(() => {
    if (!success || activeOrders.length === 0) return;

    const pollInterval = setInterval(async () => {
      const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
      if (activeIds.length === 0) {
        setSuccess(false);
        return;
      }

      let changed = false;
      const updatedList = [];
      let updatedIds = [...activeIds];

      for (const order of activeOrders) {
        try {
          const res = await getOrderById(order._id);
          if (res.success) {
            if (res.data.paymentStatus === 'Paid') {
              updatedIds = updatedIds.filter(x => x !== order._id);
              changed = true;
              triggerPaidFeedback(order._id);
            } else {
              updatedList.push(res.data);
              if (
                res.data.status !== order.status ||
                res.data.paymentStatus !== order.paymentStatus ||
                res.data.paymentMethod !== order.paymentMethod
              ) {
                changed = true;
              }
            }
          } else {
            updatedList.push(order);
          }
        } catch (error) {
          console.error('Error polling order:', order._id, error);
          updatedList.push(order);
        }
      }

      if (changed) {
        sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));
        if (updatedList.length > 0) {
          setActiveOrders(updatedList);
        } else {
          setActiveOrders([]);
          setSuccess(false);
        }
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [success, activeOrders]);

  const handleCounterPayRequest = async (orderId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await updateOrderPaymentMethod(orderId, 'Counter');
      if (response.success) {
        setActiveOrders(prev => prev.map(o => o._id === orderId ? response.data : o));
      } else {
        setErrorMsg(response.message || 'Failed to request counter payment.');
      }
    } catch (error) {
      console.error('Counter payment request failed:', error);
      setErrorMsg('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCounterPayRequest = async (orderId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await updateOrderPaymentMethod(orderId, 'Pending');
      if (response.success) {
        setActiveOrders(prev => prev.map(o => o._id === orderId ? response.data : o));
      } else {
        setErrorMsg(response.message || 'Failed to cancel counter payment.');
      }
    } catch (error) {
      console.error('Cancel counter payment failed:', error);
      setErrorMsg('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        customerPhone,
        cafeId: cafeId || 'CD001'
      };

      const response = await placeOrder(orderPayload);

      if (response.success) {
        clearCart();
        
        // Add to activeOrderIds in sessionStorage
        const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
        if (!activeIds.includes(response.data._id)) {
          activeIds.push(response.data._id);
          sessionStorage.setItem('activeOrderIds', JSON.stringify(activeIds));
        }

        setActiveOrders(prev => [...prev.filter(o => o._id !== response.data._id), response.data]);
        setSuccess(true);
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

  // Dynamic Live Tracker Success view
  if (success && activeOrders.length > 0) {

    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '20px 10px' }}>
        <div className="success-screen" style={{ width: '100%', maxWidth: '440px', padding: '24px 16px', animation: 'scaleUp 0.3s ease-out' }}>
          
          <h2 className="success-title" style={{ fontSize: '22px', fontWeight: 900, textAlign: 'center', marginBottom: '20px', color: 'var(--color-primary)' }}>
            Active Orders Tracker
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {activeOrders.map((order) => {
              const isServed = order.status === 'Ready' || order.status === 'Delivered' || order.status === 'Completed';
              const isPaid = order.paymentStatus === 'Paid';
              const orderStatus = order.status;

              return (
                <div key={order._id} style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {/* Status Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-secondary)' }}>
                      ID: #{order._id.slice(-6).toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: isServed ? 'var(--color-success)' : 'var(--color-primary)',
                      background: isServed ? 'rgba(40,167,69,0.1)' : 'rgba(224,142,39,0.1)',
                      padding: '4px 8px',
                      borderRadius: '12px'
                    }}>
                      {orderStatus}
                    </span>
                  </div>

                  {/* Visual Status Header */}
                  {!isServed ? (
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '4px', margin: '0 auto 8px auto', borderTopColor: 'var(--color-primary)' }}></div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        {orderStatus === 'Placed'
                          ? 'Waiting for kitchen acceptance...'
                          : 'Our chefs are crafting your fresh order!'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--color-success)', margin: 0, fontWeight: 700 }}>
                        🍽️ Served & Enjoy!
                      </p>
                    </div>
                  )}

                  {/* Interactive Progress Track */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px', padding: '0 4px' }}>
                    {/* Step 1: Placed */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 6px var(--color-primary)' }}></div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--color-primary)' }}>Placed</span>
                    </div>
                    {/* Bar 1 */}
                    <div style={{ flex: 1, height: '3px', background: (orderStatus !== 'Placed') ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: '1.5px' }}></div>
                    {/* Step 2: Preparing */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (orderStatus !== 'Placed') ? 'var(--color-primary)' : 'var(--color-border)' }}></div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: (orderStatus !== 'Placed') ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>Preparing</span>
                    </div>
                    {/* Bar 2 */}
                    <div style={{ flex: 1, height: '3px', background: isServed ? 'var(--color-success)' : 'var(--color-border)', borderRadius: '1.5px' }}></div>
                    {/* Step 3: Ready */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isServed ? 'var(--color-success)' : 'var(--color-border)' }}></div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: isServed ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>Ready</span>
                    </div>
                  </div>

                  {/* Order Details Card */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Table</span>
                      <span style={{ fontWeight: 800, color: '#fff' }}>{order.tableNumber}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Total Amount</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Payment Status</span>
                      <span style={{ fontWeight: 800, color: 'var(--color-warning)' }}>{order.paymentStatus}</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '6px', paddingTop: '6px' }}>
                      <span style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Items:</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {order.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Payment Options */}
                  {isServed && !isPaid && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                      {order.paymentMethod === 'Counter' ? (
                        <div>
                          <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🛎️ Counter Payment Requested
                          </h4>
                          <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: '1.4', margin: '0 0 8px 0' }}>
                            Proceed to cashier and share <strong>Table {order.tableNumber}</strong> or order suffix.
                          </p>
                          <button
                            onClick={() => handleCancelCounterPayRequest(order._id)}
                            disabled={loading}
                            className="btn btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '11px', width: '100%', cursor: loading ? 'not-allowed' : 'pointer' }}
                          >
                            Change to Pay Online
                          </button>
                        </div>
                      ) : (
                        <div>
                          <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: '800', margin: '0 0 8px 0', textAlign: 'center' }}>
                            Select Payment Method
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <RazorpayPayment
                              cart={order.items.map(it => ({ item: it, quantity: it.quantity }))}
                              tableNumber={order.tableNumber}
                              customerDetails={{
                                name: customerName || order.customerName || 'Customer',
                                email: customerEmail || order.customerEmail || 'customer@example.com',
                                phone: customerPhone || order.customerPhone || '9999999999'
                              }}
                              existingOrderId={order._id}
                              cafeId={cafeId || order.cafeId || 'CD001'}
                              buttonText="Pay Online (Razorpay)"
                              onPaymentSuccess={(updatedOrder) => {
                                setActiveOrders(prev => prev.map(o => o._id === order._id ? updatedOrder : o));
                                triggerPaidFeedback(order._id);
                              }}
                              onPaymentError={(err) => {
                                setErrorMsg(err);
                              }}
                            />
                            
                            <button
                              onClick={() => handleCounterPayRequest(order._id)}
                              disabled={loading}
                              className="btn btn-secondary"
                              style={{
                                padding: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                width: '100%',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                border: '1px solid var(--color-border)',
                                color: '#fff',
                                background: 'rgba(255,255,255,0.03)'
                              }}
                            >
                              <span>🛎️</span>
                              <span>Pay at Counter</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', color: '#fff', fontSize: '12px', padding: '10px', marginTop: '16px', borderRadius: '8px', textAlign: 'center' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px' }}>
            Order More Delicacies
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
