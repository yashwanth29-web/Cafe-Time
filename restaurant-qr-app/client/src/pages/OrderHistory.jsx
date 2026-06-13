import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RazorpayPayment from '../components/RazorpayPayment';
import { getOrderById, placeOrder, updateOrderPaymentMethod, getCafeInfo, submitReview } from '../services/api';
import { printPOSReceipt } from '../utils/printHelpers';

const OrderHistory = ({ cafeId }) => {
  const navigate = useNavigate();
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

  // Dynamic Live Tracker Success / Invoice view
  if (activeOrders.length > 0 || completedOrders.length > 0) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '20px 10px' }}>
        <div className="success-screen" style={{ width: '100%', maxWidth: '440px', padding: '24px 16px', animation: 'scaleUp 0.3s ease-out' }}>
          
          {activeOrders.length > 0 &&
          <>
              <h2 className="success-title" style={{ fontSize: '20px', fontWeight: 900, textAlign: 'center', marginBottom: '16px', color: 'var(--color-primary)' }}>
                ⏳ Active Orders Tracker
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                {activeOrders.map((order) => {
                const isServed = order.status === 'Ready' || order.status === 'Delivered' || order.status === 'Completed';
                const isPaid = order.paymentStatus === 'Paid';
                const orderStatus = order.status;

                return (
                  <div key={order._id} style={{
                    background: 'rgba(0, 0, 0, 0.02)',
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
                      {!isServed ?
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                          <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '4px', margin: '0 auto 8px auto', borderTopColor: 'var(--color-primary)' }}></div>
                          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                            {orderStatus === 'Placed' ?
                        'Waiting for kitchen acceptance...' :
                        'Our chefs are crafting your fresh order!'}
                          </p>
                        </div> :

                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                          <p style={{ fontSize: '12px', color: 'var(--color-success)', margin: 0, fontWeight: 700 }}>
                            🍽️ Served & Enjoy!
                          </p>
                        </div>
                    }

                      {/* Interactive Progress Track */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px', padding: '0 4px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 6px var(--color-primary)' }}></div>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--color-primary)' }}>Placed</span>
                        </div>
                        <div style={{ flex: 1, height: '3px', background: orderStatus !== 'Placed' ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: '1.5px' }}></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: orderStatus !== 'Placed' ? 'var(--color-primary)' : 'var(--color-border)' }}></div>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: orderStatus !== 'Placed' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>Preparing</span>
                        </div>
                        <div style={{ flex: 1, height: '3px', background: isServed ? 'var(--color-success)' : 'var(--color-border)', borderRadius: '1.5px' }}></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isServed ? 'var(--color-success)' : 'var(--color-border)' }}></div>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: isServed ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>Ready</span>
                        </div>
                      </div>

                      {/* Order Details Card */}
                      <div style={{ backgroundColor: 'rgba(0, 0, 0,0.01)', border: '1px solid rgba(0, 0, 0,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Table</span>
                          <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{order.tableNumber}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Total Amount</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Payment Status</span>
                          <span style={{ fontWeight: 800, color: 'var(--color-warning)' }}>{order.paymentStatus}</span>
                        </div>
                        {order.specialInstructions &&
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', borderTop: '1px solid rgba(0, 0, 0,0.05)', paddingTop: '4px' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Instructions:</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{order.specialInstructions}</span>
                          </div>
                      }
                        <div style={{ borderTop: '1px solid rgba(0, 0, 0,0.05)', marginTop: '6px', paddingTop: '6px' }}>
                          <span style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Items:</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {order.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                          </span>
                        </div>
                      </div>

                      {/* Payment Options */}
                      {isServed && !isPaid &&
                    <div style={{ background: 'rgba(0, 0, 0,0.02)', border: '1px solid rgba(0, 0, 0,0.05)', padding: '10px', borderRadius: '8px' }}>
                          {order.paymentMethod === 'Counter' ?
                      <div>
                              <h4 style={{ color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                🏪 Counter Payment Requested
                              </h4>
                              <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: '1.4', margin: '0 0 8px 0' }}>
                                Proceed to cashier and share <strong>Table {order.tableNumber}</strong> or order suffix.
                              </p>
                              <button
                          onClick={() => handleCancelCounterPayRequest(order._id)}
                          disabled={loading}
                          className="btn btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '11px', width: '100%', cursor: loading ? 'not-allowed' : 'pointer' }}>
                          
                                Change to Pay Online
                              </button>
                            </div> :

                      <div>
                              <h4 style={{ color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: '800', margin: '0 0 8px 0', textAlign: 'center' }}>
                                Select Payment Method
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <RazorpayPayment
                            cart={order.items.map((it) => ({ item: it, quantity: it.quantity }))}
                            tableNumber={order.tableNumber}
                            customerDetails={{
                              name: customerName || order.customerName || 'Customer',
                              email: customerEmail || order.customerEmail || 'customer@example.com',
                              phone: customerPhone || order.customerPhone || '9999999999'
                            }}
                            specialInstructions={order.specialInstructions}
                            existingOrderId={order._id}
                            cafeId={cafeId || order.cafeId || 'CD001'}
                            buttonText="Pay Online (Razorpay)"
                            onPaymentSuccess={(updatedOrder) => {
                              setActiveOrders((prev) => prev.map((o) => o._id === order._id ? updatedOrder : o));
                              triggerPaidFeedback(order._id);
                            }}
                            onPaymentError={(err) => {
                              setErrorMsg(err);
                            }} />
                          
                                
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
                              color: 'var(--color-text-primary)',
                              background: 'rgba(0, 0, 0,0.03)'
                            }}>
                            
                                  <span>🏪</span>
                                  <span>Pay at Counter</span>
                                </button>
                              </div>
                            </div>
                      }
                        </div>
                    }
                    </div>);

              })}
              </div>
            </>
          }

          {completedOrders.length > 0 &&
          <>
              <h2 className="success-title" style={{ fontSize: '20px', fontWeight: 900, textAlign: 'center', marginBottom: '16px', color: 'var(--color-success)' }}>
                ✔️ Completed Invoice & Receipt
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {completedOrders.map((order) => {
                const sub = order.totalAmount / 1.05;
                const gst = order.totalAmount - sub;
                const hasReviewed = submittedReviews.includes(order._id);

                return (
                  <div key={order._id} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Invoice Block */}
                      <div style={{
                      background: '#FAF6F0',
                      color: '#33271c',
                      border: '1px solid #E6D5C3',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      fontFamily: "'Courier New', Courier, monospace"
                    }}>
                        <div style={{ textAlign: 'center', borderBottom: '1px dashed #33271c', paddingBottom: '12px', marginBottom: '12px' }}>
                          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>{cafeInfo?.name || 'Dr. Chai Cafe'}</h3>
                          <p style={{ margin: '2px 0', fontSize: '10px' }}>{cafeInfo?.address || 'Main Road, Near Metro Station, Hyderabad'}</p>
                          {cafeInfo?.gstNumber && <p style={{ margin: '2px 0', fontSize: '10px', fontWeight: 'bold' }}>GSTIN: {cafeInfo.gstNumber}</p>}
                        </div>

                        <div style={{ fontSize: '11px', marginBottom: '12px' }}>
                          <div><strong>Invoice #:</strong> {order._id.toUpperCase()}</div>
                          <div><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</div>
                          <div><strong>Table:</strong> Table {order.tableNumber}</div>
                          <div><strong>Customer:</strong> {order.customerName || 'Customer'}</div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #33271c', borderTop: '1px solid #33271c' }}>
                              <th style={{ padding: '4px 0', textAlign: 'left' }}>Item</th>
                              <th style={{ padding: '4px 0', textAlign: 'center' }}>Qty</th>
                              <th style={{ padding: '4px 0', textAlign: 'right' }}>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, idx) =>
                          <tr key={idx}>
                                <td style={{ padding: '3px 0' }}>{item.name}</td>
                                <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '3px 0', textAlign: 'right' }}>₹{(item.price * item.quantity).toFixed(2)}</td>
                              </tr>
                          )}
                          </tbody>
                        </table>

                        <div style={{ borderTop: '1px dashed #33271c', paddingTop: '8px', textAlign: 'right', fontSize: '11px' }}>
                          <div>Subtotal (Tax Excl.): ₹{sub.toFixed(2)}</div>
                          <div>CGST (2.5%): ₹{(gst / 2).toFixed(2)}</div>
                          <div>SGST (2.5%): ₹{(gst / 2).toFixed(2)}</div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '6px' }}>
                            GRAND TOTAL: ₹{order.totalAmount.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                            Payment Method: <strong>{order.paymentMethod || 'Paid'}</strong>
                          </div>
                        </div>

                        <button
                        onClick={() => printPOSReceipt(order, null, cafeInfo)}
                        className="btn"
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '12px',
                          marginTop: '15px',
                          color: 'var(--color-text-primary)',
                          border: '1px solid #33271c',
                          background: '#33271c',
                          fontWeight: 'bold',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}>
                        
                          🖨️ Download & Print PDF Invoice
                        </button>
                      </div>

                      {/* Review Block */}
                      {!hasReviewed ?
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '16px',
                      padding: '16px',
                      fontFamily: "'Outfit', 'Inter', sans-serif"
                    }}>
                          <h4 style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: '800', margin: '0 0 10px 0', textAlign: 'center' }}>
                            ⭐ RATE YOUR EXPERIENCE
                          </h4>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                            {[1, 2, 3, 4, 5].map((star) =>
                        <span
                          key={star}
                          onClick={() => {
                            setReviewRatings((prev) => ({ ...prev, [order._id]: star }));
                          }}
                          style={{
                            fontSize: '28px',
                            cursor: 'pointer',
                            color: (reviewRatings[order._id] || 0) >= star ? '#d4af37' : '#555',
                            transition: 'color 0.2s'
                          }}>
                          
                                ★
                              </span>
                        )}
                          </div>
                          <textarea
                        placeholder="Write a quick review about the taste, service, or atmosphere..."
                        value={reviewTexts[order._id] || ''}
                        onChange={(e) => {
                          setReviewTexts((prev) => ({ ...prev, [order._id]: e.target.value }));
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          background: 'rgba(0,0,0,0.15)',
                          color: 'var(--color-text-primary)',
                          outline: 'none',
                          fontSize: '12px',
                          minHeight: '60px',
                          resize: 'vertical',
                          marginBottom: '10px'
                        }} />
                      
                          <button
                        disabled={submittingReview[order._id] || !reviewRatings[order._id]}
                        onClick={async () => {
                          setSubmittingReview((prev) => ({ ...prev, [order._id]: true }));
                          try {
                            const res = await submitReview({
                              orderId: order._id,
                              rating: reviewRatings[order._id],
                              reviewText: reviewTexts[order._id] || ''
                            });
                            if (res.success) {
                              const updatedReviews = [...submittedReviews, order._id];
                              setSubmittedReviews(updatedReviews);
                              localStorage.setItem('submittedReviews', JSON.stringify(updatedReviews));
                            } else {
                              alert('Failed to submit review.');
                            }
                          } catch (err) {
                            console.error('Review submit failed:', err);
                            alert('Connection error submitting review.');
                          } finally {
                            setSubmittingReview((prev) => ({ ...prev, [order._id]: false }));
                          }
                        }}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '10px', fontSize: '12px' }}>
                        
                            {submittingReview[order._id] ? 'Submitting...' : 'Submit Feedback'}
                          </button>
                        </div> :

                    <div style={{
                      background: 'rgba(39, 174, 96, 0.1)',
                      border: '1px dashed #27ae60',
                      borderRadius: '16px',
                      padding: '12px',
                      textAlign: 'center',
                      color: '#27ae60',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                          💚 Thank you for your feedback! Review submitted.
                        </div>
                    }
                    </div>);

              })}
              </div>
            </>
          }

          {errorMsg &&
          <div style={{ backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', color: 'var(--color-text-primary)', fontSize: '12px', padding: '10px', marginTop: '16px', borderRadius: '8px', textAlign: 'center' }}>
              ⚠️∩╕Å {errorMsg}
            </div>
          }

          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px' }}>
            View Menu
          </Link>
        </div>
      </div>);

  }


  return (
    <div className="cart-page" style={{ textAlign: 'center', padding: '100px 20px' }}>
      <h2 style={{ color: 'var(--color-primary)' }}>Order History</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '20px' }}>You have no active or recently completed orders in this session.</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
        View Menu
      </Link>
    </div>);

};

export default OrderHistory;