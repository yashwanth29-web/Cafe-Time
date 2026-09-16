import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartItem from '../components/CartItem';
import { getOrderById, placeOrder, updateOrderPaymentMethod, getCafeInfo, submitReview, getPaymentInfo } from '../services/api';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import { useAuth } from '../context/AuthContext';
import socket, { connectSocket } from '../socket';

const CartPage = ({ cart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber, cafeId, branchId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = sessionStorage.getItem('orderSource') === 'staff';
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
  const [paymentConfig, setPaymentConfig] = useState(null);

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
        const searchParams = new URLSearchParams(window.location.search);
        const id = cafeId || searchParams.get('cafeId') || sessionStorage.getItem('cafeId');
        if (!id) return;
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

  // Fetch branch-specific PaymentConfig details on mount / cafeId change
  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const currentCafeId = cafeId || searchParams.get('cafeId') || sessionStorage.getItem('cafeId');
        const currentBranchId = searchParams.get('branchId') || sessionStorage.getItem('branchId') || localStorage.getItem('activeBranchId');
        const res = await getPaymentInfo({ cafeId: currentCafeId, branchId: currentBranchId });
        if (res.success) {
          setPaymentConfig(res.data);
        }
      } catch (e) {
        console.error('Error fetching payment config:', e);
      }
    };
    fetchPaymentConfig();
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
      const cafeNameStr = cafeInfo?.name || 'Our Cafe';
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

  // Real-time order status updates via Socket.IO
  useEffect(() => {
    if (!success || (activeOrders.length === 0 && completedOrders.length === 0)) return;
    
    // Auto-connect to cafe room
    connectSocket(cafeId, localStorage.getItem('activeBranchId') || sessionStorage.getItem('branchId') || 'default');

    const handleOrderUpdated = (updatedOrder) => {
      // Check if this updated order belongs to this customer's session
      const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
      const currentCompIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');
      
      if (activeIds.includes(updatedOrder._id) || currentCompIds.includes(updatedOrder._id)) {
        if (updatedOrder.paymentStatus === 'Paid' || updatedOrder.status === 'Completed') {
          // Move from active to completed
          const newActiveIds = activeIds.filter((x) => x !== updatedOrder._id);
          sessionStorage.setItem('activeOrderIds', JSON.stringify(newActiveIds));
          
          if (!currentCompIds.includes(updatedOrder._id)) {
            sessionStorage.setItem('completedOrderIds', JSON.stringify([...currentCompIds, updatedOrder._id]));
          }
          
          triggerPaidFeedback(updatedOrder._id);
          localStorage.removeItem('customerName');
          localStorage.removeItem('customerEmail');
          localStorage.removeItem('customerPhone');

          setActiveOrders(prev => prev.filter(o => o._id !== updatedOrder._id));
          setCompletedOrders(prev => {
            if (prev.some(o => o._id === updatedOrder._id)) return prev;
            return [...prev, updatedOrder];
          });
        } else {
          // Just update active order status
          setActiveOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
        }
      }
    };

    socket.on('order_updated', handleOrderUpdated);

    return () => {
      socket.off('order_updated', handleOrderUpdated);
    };
  }, [success, activeOrders.length, completedOrders.length, cafeId]);

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
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.item.price * item.quantity, 0);
  const gstRate = paymentConfig?.gstPercentage ?? (cafeInfo?.gstPercentage ?? (paymentConfig?.taxRate ?? (cafeInfo?.gstRate ?? 0)));
  const gstAmount = Number(((subtotal * gstRate) / 100).toFixed(2));
  const platformCharge = paymentConfig?.platformFee ?? (cafeInfo?.platformFee ?? (paymentConfig?.platformCharge ?? (cafeInfo?.serviceChargeRate ?? 0)));
  const grandTotal = Number((subtotal + gstAmount + platformCharge).toFixed(2));

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const itemsPayload = cart.map((cartItem) => ({
        id: cartItem.item.id || cartItem.item._id,
        name: cartItem.item.name,
        price: cartItem.item.price,
        quantity: cartItem.quantity,
        image: cartItem.item.image || '/images/default-food.png'
      }));

      const resolvedCafeId = cafeId || user?.cafeId || sessionStorage.getItem('cafeId') || localStorage.getItem('customerCafeId') || 'CD001';
      const resolvedBranchId = branchId || user?.assignedBranch || user?.branchId || sessionStorage.getItem('branchId') || localStorage.getItem('customerBranchId') || 'default';
      const resolvedTableNumber = tableNumber || sessionStorage.getItem('tableNumber') || localStorage.getItem('customerTableNumber') || 'Takeaway';

      const orderPayload = {
        cafeId: resolvedCafeId,
        branchId: resolvedBranchId,
        tableId: resolvedTableNumber ? `T${String(resolvedTableNumber).replace(/^(table[- ]?|t)/i, '')}` : 'Takeaway',
        tableNumber: resolvedTableNumber,
        customer: {
          name: isStaff ? (user?.name || 'Staff') : 'Guest Customer',
          email: isStaff ? (user?.email || 'staff@cafesystem.local') : '',
          phone: isStaff ? (user?.phone || '0000000000') : ''
        },
        items: itemsPayload,
        totalAmount: grandTotal,
        customerName: isStaff ? (user?.name || 'Staff') : 'Guest Customer',
        customerEmail: isStaff ? (user?.email || 'staff@cafesystem.local') : '',
        customerPhone: isStaff ? (user?.phone || '0000000000') : '',
        specialInstructions,
        source: isStaff ? 'STAFF' : 'QR',
        staffId: isStaff && user ? user._id : undefined
      };

      const response = await placeOrder(orderPayload);

      if (response.success) {
        clearCart();
        sessionStorage.removeItem('orderSource');

        if (isStaff && response.data) {
          try {
            printKOT(response.data, user, cafeInfo, null);
          } catch (printErr) {
            console.error('Error auto-printing KOT:', printErr);
          }
        }

        if (isStaff) {
          setTimeout(() => {
            window.location.href = '/staff/workspace';
          }, 600);
          return;
        }

        const newOrder = response.data;

        // Add to activeOrderIds ONLY in sessionStorage (no cross-day localStorage pollution)
        const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
        if (!activeIds.includes(newOrder._id)) {
          activeIds.unshift(newOrder._id);
          sessionStorage.setItem('activeOrderIds', JSON.stringify(activeIds));
        }

        // Navigate directly to history with newOrder in state for INSTANT, zero-flicker rendering
        navigate('/history', { state: { newOrder } });
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

  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <p className="cart-empty-text">Your cart is currently empty.</p>
          <Link to="/menu" className="btn btn-secondary">
            Browse Delicious Menu
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

      {errorMsg && (
        <div className="alert alert-danger" style={{ margin: '0 0 16px 0', backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-text-primary)', fontSize: '13px', padding: '10px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="cart-layout">
        {/* Cart Items List */}
        <div className="cart-items-section">
          {cart.map((cartItem) => (
            <CartItem
              key={cartItem.item.id || cartItem.item._id}
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

          {/* Special Instructions Note */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.02)',
            border: '1px solid var(--color-border)',
            padding: '12px 14px',
            borderRadius: '12px',
            margin: '14px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <label htmlFor="special-instructions" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📝</span> Special Instructions (Optional)
            </label>
            <textarea
              id="special-instructions"
              name="specialInstructions"
              autoComplete="off"
              placeholder="e.g. Less sugar, make it spicy..."
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
                minHeight: '55px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div className="summary-row">
            <span>Items Total ({totalItems})</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          
          {gstRate > 0 && (
            <div className="summary-row">
              <span>GST ({gstRate}%)</span>
              <span>₹{gstAmount.toFixed(2)}</span>
            </div>
          )}

          {platformCharge > 0 && (
            <div className="summary-row">
              <span>Platform Charge</span>
              <span>₹{platformCharge.toFixed(2)}</span>
            </div>
          )}

          <div className="summary-row total">
            <span>Grand Total</span>
            <span className="summary-total-val">₹{grandTotal.toFixed(2)}</span>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              onClick={handlePlaceOrder}
              className={`btn btn-primary ${loading || cart.length === 0 ? 'btn-disabled' : ''}`}
              disabled={loading || cart.length === 0}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: '16px',
                fontWeight: '800',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                color: 'var(--color-text-primary)',
                cursor: loading || cart.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-rzp" style={{
                    width: '20px',
                    height: '20px',
                    border: '3px solid rgba(0, 0, 0, 0.3)',
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
    </div>
  );
};

export default CartPage;
