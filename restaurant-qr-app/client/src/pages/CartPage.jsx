import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartItem from '../components/CartItem';
import RazorpayPayment from '../components/RazorpayPayment';
import { getOrderById, placeOrder, updateOrderPaymentMethod, getCafeInfo, submitReview } from '../services/api';
import { printPOSReceipt } from '../utils/printHelpers';
import { useAuth } from '../context/AuthContext';

const CartPage = ({ cart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber, cafeId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isUserStaff = user && ['admin', 'owner', 'manager', 'waiter', 'cashier', 'staff'].includes(user.role);
  const isStaff = isUserStaff || sessionStorage.getItem('orderSource') === 'staff';
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  // Special Instructions State
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Cafe Details State
  const [cafeInfo, setCafeInfo] = useState(null);

  // Review states
  const [submittedReviews, setSubmittedReviews] = useState(() => {
    return JSON.parse(localStorage.getItem('submittedReviews') || '[]');
  });
  const [reviewRatings, setReviewRatings] = useState({});
  const [reviewTexts, setReviewTexts] = useState({});
  const [submittingReview, setSubmittingReview] = useState({});

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

  // Fetch Cafe Details on mount
  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const id = cafeId || sessionStorage.getItem('cafeId') || 'CD001';
        const res = await getCafeInfo(id);
        if (res.success) {
          setCafeInfo(res.data);
        }
      } catch (e) {
        console.error('Error fetching cafe info:', e);
      }
    };
    fetchCafe();
  }, [cafeId]);

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
      const cafeNameStr = cafeInfo?.name || 'CoffeeDay Cafe';
      const text = `Payment successful. Thank you for visiting ${cafeNameStr}! Have a wonderful day.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  const triggerPaidFeedback = (orderId) => {
    setVoicedOrderIds((prev) => {
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
      const completedIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');
      if (activeIds.length === 0 && completedIds.length === 0) {
        setSuccess(false);
        return;
      }

      setLoadingOrders(true);
      const fetchedActive = [];
      const fetchedCompleted = [];
      let updatedIds = [...activeIds];
      let updatedCompIds = [...completedIds];

      for (const id of activeIds) {
        try {
          const res = await getOrderById(id);
          if (res.success) {
            if (res.data.paymentStatus !== 'Paid' && res.data.status !== 'Completed') {
              fetchedActive.push(res.data);
            } else {
              fetchedCompleted.push(res.data);
              // Remove paid orders from active list in session storage so we don't keep polling them
              updatedIds = updatedIds.filter((x) => x !== id);
              if (!updatedCompIds.includes(id)) updatedCompIds.push(id);
              if (!voicedOrderIds.includes(id)) {
                triggerPaidFeedback(id);
              }
              // Clear customer details on completion
              localStorage.removeItem('customerName');
              localStorage.removeItem('customerEmail');
              localStorage.removeItem('customerPhone');
            }
          }
        } catch (error) {
          console.error('Error fetching active order:', id, error);
        }
      }

      // Also fetch completed
      for (const cid of completedIds) {
        try {
          const res = await getOrderById(cid);
          if (res.success) fetchedCompleted.push(res.data);
        } catch(e) {}
      }

      sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));
      sessionStorage.setItem('completedOrderIds', JSON.stringify(updatedCompIds));

      if (fetchedActive.length > 0 || fetchedCompleted.length > 0) {
        if (fetchedActive.length > 0) setActiveOrders(fetchedActive);
        if (fetchedCompleted.length > 0) setCompletedOrders(fetchedCompleted);
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
    if (!success || activeOrders.length === 0 && completedOrders.length === 0) return;

    const pollInterval = setInterval(async () => {
      const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
      if (activeIds.length === 0 && activeOrders.length === 0) {
        return;
      }

      let changed = false;
      const updatedList = [];
      const newlyCompleted = [];
      let updatedIds = [...activeIds];
      const currentCompIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');
      let updatedCompIds = [...currentCompIds];

      for (const order of activeOrders) {
        try {
          const res = await getOrderById(order._id);
          if (res.success) {
            if (res.data.paymentStatus === 'Paid' || res.data.status === 'Completed') {
              updatedIds = updatedIds.filter((x) => x !== order._id);
              if (!updatedCompIds.includes(order._id)) updatedCompIds.push(order._id);
              newlyCompleted.push(res.data);
              changed = true;
              triggerPaidFeedback(order._id);
              // Clear customer details on completion
              localStorage.removeItem('customerName');
              localStorage.removeItem('customerEmail');
              localStorage.removeItem('customerPhone');
            } else {
              updatedList.push(res.data);
              if (
              res.data.status !== order.status ||
              res.data.paymentStatus !== order.paymentStatus ||
              res.data.paymentMethod !== order.paymentMethod)
              {
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

      if (changed || newlyCompleted.length > 0) {
        sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));
        sessionStorage.setItem('completedOrderIds', JSON.stringify(updatedCompIds));
        if (updatedList.length > 0) {
          setActiveOrders(updatedList);
        } else {
          setActiveOrders([]);
        }
        if (newlyCompleted.length > 0) {
          setCompletedOrders((prev) => {
            const ids = prev.map((o) => o._id);
            const filteredNew = newlyCompleted.filter((o) => !ids.includes(o._id));
            return [...prev, ...filteredNew];
          });
        }
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [success, activeOrders, completedOrders]);

  const handleCounterPayRequest = async (orderId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await updateOrderPaymentMethod(orderId, 'Counter');
      if (response.success) {
        setActiveOrders((prev) => prev.map((o) => o._id === orderId ? response.data : o));
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
        setActiveOrders((prev) => prev.map((o) => o._id === orderId ? response.data : o));
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
    
    if (!isStaff && (!customerName || !customerEmail || !customerPhone)) {
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
        quantity: cartItem.quantity
      }));

      const orderPayload = {
        tableNumber: tableNumber || 'Takeaway',
        items: itemsPayload,
        totalAmount: grandTotal,
        customerName: customerName || (isStaff ? 'Walk-in Customer' : ''),
        customerEmail: customerEmail || (isStaff ? 'walkin@cafesystem.local' : ''),
        customerPhone: customerPhone || (isStaff ? '0000000000' : ''),
        specialInstructions,
        cafeId: cafeId || 'CD001',
        source: isStaff ? 'STAFF' : 'QR',
        staffId: isStaff && user ? user._id : undefined
      };

      const response = await placeOrder(orderPayload);

      if (response.success) {
        clearCart();
        sessionStorage.removeItem('orderSource');

        if (isStaff) {
          window.location.href = '/waiter/dashboard';
          return;
        }

        // Add to activeOrderIds in sessionStorage
        const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
        if (!activeIds.includes(response.data._id)) {
          activeIds.push(response.data._id);
          sessionStorage.setItem('activeOrderIds', JSON.stringify(activeIds));
        }

        navigate('/history');
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

  return (
    <div className="cart-page">
      <div className="cart-header">
        <h2 className="cart-title">Your Order Cart</h2>
      </div>

      {cart.length === 0 ?
      <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <p className="cart-empty-text">Your cart is currently empty.</p>
          <Link to="/" className="btn btn-secondary">
            Browse Delicious Menu
          </Link>
        </div> :

      <div className="cart-layout">
          {/* Cart Items List */}
          <div className="cart-items-section">
            {cart.map((cartItem) =>
          <CartItem
            key={cartItem.item.id}
            item={cartItem}
            increaseQuantity={increaseQuantity}
            decreaseQuantity={decreaseQuantity}
            removeFromCart={removeFromCart} />

          )}
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
            {!isStaff && (
              <div className="customer-details-card" style={{
              background: 'rgba(0, 0, 0, 0.02)',
              border: '1px solid var(--color-border)',
              padding: '16px',
              borderRadius: '12px',
              margin: '16px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', margin: '0', color: 'var(--color-text-primary)', letterSpacing: '0.5px' }}>
                    👤 CONTACT INFORMATION
                  </h4>
                  {(customerName || customerEmail || customerPhone) &&
                <button
                  type="button"
                  onClick={() => {
                    setCustomerName('');
                    setCustomerEmail('');
                    setCustomerPhone('');
                    localStorage.removeItem('customerName');
                    localStorage.removeItem('customerEmail');
                    localStorage.removeItem('customerPhone');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: '0'
                  }}>
                  
                      Reset Details
                    </button>
                }
                </div>
                
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
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    fontSize: '13px'
                  }} />
                
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
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    fontSize: '13px'
                  }} />
                
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
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    fontSize: '13px'
                  }} />
                
                </div>

                <div>
                  <textarea
                  placeholder="Special Instructions (e.g. Less sugar, make it spicy...)"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0,0,0,0.15)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    fontSize: '13px',
                    minHeight: '60px',
                    resize: 'vertical'
                  }} />
                
                </div>
              </div>
            )}

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

            {errorMsg &&
          <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-text-primary)', fontSize: '13px', padding: '10px', marginTop: '15px' }}>
                ⚠️ {errorMsg}
              </div>
          }

            <div style={{ marginTop: '24px' }}>
              <button
              onClick={handlePlaceOrder}
              className={`btn btn-primary ${loading || cart.length === 0 || (!isStaff && (!customerName || !customerEmail || !customerPhone)) ? 'btn-disabled' : ''}`}
              disabled={loading || cart.length === 0 || (!isStaff && (!customerName || !customerEmail || !customerPhone))}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: '16px',
                fontWeight: '800',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                color: 'var(--color-text-primary)',
                cursor: loading || cart.length === 0 || (!isStaff && (!customerName || !customerEmail || !customerPhone)) ? 'not-allowed' : 'pointer'
              }}>
              
                {loading ?
              <>
                    <span className="spinner-rzp" style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid rgba(0, 0, 0,0.3)',
                  borderTop: '3px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                  marginRight: '8px'
                }}></span>
                    Placing order...
                  </> :

              'Place Order'
              }
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default CartPage;