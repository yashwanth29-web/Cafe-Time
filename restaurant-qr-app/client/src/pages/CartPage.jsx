import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartItem from '../components/CartItem';
import { getOrderById, placeOrder, updateOrderPaymentMethod, getCafeInfo, submitReview, getPaymentInfo, getMenu } from '../services/api';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import { useAuth } from '../context/AuthContext';
import socket, { connectSocket } from '../socket';

const CartPage = ({ cart, addToCart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber, cafeId, branchId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const isStaffPOS = Boolean(
    searchParams.get('source') === 'staff' ||
    sessionStorage.getItem('orderSource') === 'staff' ||
    (user && ['admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff', 'super_admin'].includes(user?.role?.toLowerCase()))
  );
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  // In-Cart Add Items Modal State
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [addItemsSearch, setAddItemsSearch] = useState('');
  const [addItemsCategory, setAddItemsCategory] = useState('all');

  const handleOpenAddItemsModal = async () => {
    setShowAddItemsModal(true);
    if (menuItems.length === 0) {
      setLoadingMenu(true);
      try {
        const menuRes = await getMenu();
        const items = Array.isArray(menuRes?.data) ? menuRes.data : Array.isArray(menuRes) ? menuRes : [];
        setMenuItems(items);
      } catch (err) {
        console.error('Failed to load menu in cart modal:', err);
      } finally {
        setLoadingMenu(false);
      }
    }
  };

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

  // Fetch active orders on mount (customer QR mode only)
  useEffect(() => {
    if (isStaffPOS) {
      sessionStorage.setItem('orderSource', 'staff');
      setSuccess(false);
      return;
    }
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
          name: isStaffPOS ? (user?.name || 'Staff') : (customerName || 'Guest Customer'),
          email: isStaffPOS ? (user?.email || 'staff@cafesystem.local') : (customerEmail || ''),
          phone: isStaffPOS ? (user?.phone || '0000000000') : (customerPhone || '')
        },
        items: itemsPayload,
        totalAmount: grandTotal,
        customerName: isStaffPOS ? (user?.name || 'Staff') : (customerName || 'Guest Customer'),
        customerEmail: isStaffPOS ? (user?.email || 'staff@cafesystem.local') : (customerEmail || ''),
        customerPhone: isStaffPOS ? (user?.phone || '0000000000') : (customerPhone || ''),
        specialInstructions,
        source: isStaffPOS ? 'STAFF' : 'QR',
        orderSource: isStaffPOS ? 'STAFF' : 'QR',
        staffId: isStaffPOS && user ? user._id : undefined
      };

      const response = await placeOrder(orderPayload);

      if (response.success) {
        clearCart();
        sessionStorage.removeItem('orderSource');

        // ==========================================
        // 1. STAFF ORDER FLOW -> RETURN TO WORKSPACE
        // ==========================================
        if (isStaffPOS) {
          if (response.data) {
            try {
              printKOT(response.data, user, cafeInfo, null);
            } catch (printErr) {
              console.error('Error auto-printing KOT:', printErr);
            }
          }
          if (user?.role?.toLowerCase() === 'manager') {
            navigate('/manager/dashboard');
          } else if (user?.role?.toLowerCase() === 'owner' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'super_admin') {
            navigate('/owner/dashboard');
          } else {
            navigate('/staff/workspace');
          }
          return;
        }

        // ==========================================
        // 2. CUSTOMER QR FLOW -> REMAIN ON TRACKER
        // ==========================================
        const newOrder = response.data;

        // Persist to both localStorage and sessionStorage so orders remain accessible if tab is closed/reloaded
        const localActive = JSON.parse(localStorage.getItem('customer_active_order_ids') || '[]');
        const sessionActive = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
        const activeIds = Array.from(new Set([...localActive, ...sessionActive]));

        if (newOrder && newOrder._id && !activeIds.includes(newOrder._id)) {
          activeIds.unshift(newOrder._id);
          localStorage.setItem('customer_active_order_ids', JSON.stringify(activeIds));
          sessionStorage.setItem('activeOrderIds', JSON.stringify(activeIds));
        }

        // Navigate directly to customer order tracking page (/history) with newOrder
        const historyUrl = resolvedTableNumber && resolvedTableNumber !== 'Takeaway'
          ? `/history?table=${encodeURIComponent(resolvedTableNumber)}&cafeId=${encodeURIComponent(resolvedCafeId)}&branchId=${encodeURIComponent(resolvedBranchId)}`
          : '/history';
        navigate(historyUrl, { state: { newOrder } });
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

  const handleBackToMenu = () => {
    const params = new URLSearchParams();
    const currentTable = tableNumber || sessionStorage.getItem('tableNumber') || localStorage.getItem('customerTableNumber');
    const currentCafe = cafeId || sessionStorage.getItem('cafeId') || localStorage.getItem('customerCafeId');
    const currentBranch = branchId || sessionStorage.getItem('branchId') || localStorage.getItem('customerBranchId');
    const isStaffOrder = searchParams.get('source') === 'staff' || isStaffPOS;

    if (currentTable) params.set('table', currentTable);
    if (isStaffOrder) params.set('source', 'staff');
    if (currentCafe) params.set('cafeId', currentCafe);
    if (currentBranch) params.set('branchId', currentBranch);

    const search = params.toString();
    navigate(search ? `/?${search}` : '/menu');
  };

  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty-icon">🛒</div>
          <p className="cart-empty-text">Your cart is currently empty.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
            {isStaffPOS && (
              <button
                onClick={() => {
                  sessionStorage.removeItem('orderSource');
                  if (user?.role?.toLowerCase() === 'manager') {
                    navigate('/manager/dashboard');
                  } else if (user?.role?.toLowerCase() === 'owner' || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'super_admin') {
                    navigate('/owner/dashboard');
                  } else {
                    navigate('/staff/workspace');
                  }
                }}
                className="btn btn-secondary"
                style={{ cursor: 'pointer', background: 'var(--bg-secondary)', fontWeight: 700 }}
              >
                🏠 Return to Workspace
              </button>
            )}
            <button
              onClick={handleOpenAddItemsModal}
              style={{
                background: 'rgba(52, 152, 219, 0.15)',
                color: '#2980b9',
                border: '1px solid rgba(52, 152, 219, 0.4)',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ➕ Add Items
            </button>
            <button onClick={handleBackToMenu} className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              ← Browse Menu
            </button>
          </div>
        </div>
        {showAddItemsModal && renderAddItemsModal()}
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleBackToMenu}
            aria-label="Back to Menu"
            title="Back to Menu"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-primary)',
              fontSize: '18px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            ←
          </button>
          <h2 className="cart-title" style={{ margin: 0, fontSize: '1.25rem' }}>Your Order Cart</h2>
        </div>

        <button
          onClick={handleOpenAddItemsModal}
          style={{
            background: 'rgba(52, 152, 219, 0.12)',
            color: '#2980b9',
            border: '1px solid rgba(52, 152, 219, 0.3)',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'inherit',
            flexShrink: 0
          }}
          title="Add items to cart"
        >
          ➕ Add Items
        </button>
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

          <button
            onClick={handleOpenAddItemsModal}
            style={{
              width: '100%',
              padding: '11px',
              border: '1px dashed rgba(52, 152, 219, 0.45)',
              borderRadius: '10px',
              background: 'rgba(52, 152, 219, 0.08)',
              color: '#2980b9',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '10px',
              fontFamily: 'inherit'
            }}
          >
            ➕ Add Items
          </button>
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

            {/* 1-Tap Quick Note Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '2px 0 2px 0' }}>
              {['☕ Extra Hot', '🧊 Less Ice', '🍬 Less Sugar', '🥛 Extra Milk', '🌶️ Make Spicy'].map((tag) => {
                const cleanTag = tag.replace(/^[^\s]+\s/, '');
                const isIncluded = specialInstructions.includes(cleanTag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isIncluded) {
                        setSpecialInstructions(prev => prev.replace(cleanTag, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim());
                      } else {
                        setSpecialInstructions(prev => (prev ? `${prev}, ${cleanTag}` : cleanTag));
                      }
                    }}
                    style={{
                      background: isIncluded ? 'var(--color-primary)' : 'var(--bg-secondary)',
                      color: isIncluded ? '#ffffff' : 'var(--color-text-primary)',
                      border: `1px solid ${isIncluded ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: '16px',
                      padding: '4px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontFamily: 'inherit'
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

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
                background: 'rgba(0,0,0,0.03)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                fontSize: '13px',
                minHeight: '50px',
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
                isStaffPOS ? 'Place Staff Order & Print KOT 🖨️' : 'Place Order'
              )}
            </button>
          </div>
        </div>
      </div>

      {showAddItemsModal && renderAddItemsModal()}
    </div>
  );

  function renderAddItemsModal() {
    const categories = ['all', ...Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)))];
    const filteredItems = menuItems.filter(m => {
      const matchCat = addItemsCategory === 'all' || m.category === addItemsCategory;
      const matchSearch = !addItemsSearch || 
        m.name?.toLowerCase().includes(addItemsSearch.toLowerCase()) || 
        (m.category && m.category.toLowerCase().includes(addItemsSearch.toLowerCase()));
      return matchCat && matchSearch && m.isAvailable !== false;
    });

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '16px'
      }}>
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--color-text-primary, #1e293b)',
          borderRadius: '16px',
          width: '100%', maxWidth: '520px',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}>
          {/* Modal Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>➕ Add Items to Cart</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748b)', display: 'block', marginTop: '2px' }}>
                {totalItems} item{totalItems === 1 ? '' : 's'} in cart (₹{subtotal.toFixed(2)})
              </span>
            </div>
            <button
              onClick={() => setShowAddItemsModal(false)}
              style={{
                background: 'rgba(0,0,0,0.06)', border: 'none',
                width: '32px', height: '32px', borderRadius: '50%',
                fontSize: '16px', color: 'var(--color-text-primary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search dish or category..."
                value={addItemsSearch}
                onChange={(e) => setAddItemsSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 36px 10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  background: 'var(--bg-secondary, #f8fafc)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {addItemsSearch && (
                <button
                  onClick={() => setAddItemsSearch('')}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category horizontal chips */}
            {categories.length > 2 && (
              <div style={{
                display: 'flex', gap: '6px', overflowX: 'auto',
                marginTop: '10px', paddingBottom: '4px', scrollbarWidth: 'none'
              }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAddItemsCategory(cat)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      border: '1px solid',
                      borderColor: addItemsCategory === cat ? 'var(--color-primary, #ff6b08)' : 'var(--color-border, #e2e8f0)',
                      background: addItemsCategory === cat ? 'var(--color-primary, #ff6b08)' : 'transparent',
                      color: addItemsCategory === cat ? '#ffffff' : 'var(--color-text-secondary, #64748b)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      textTransform: 'capitalize'
                    }}
                  >
                    {cat === 'all' ? 'All Dishes' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Menu Items List */}
          <div style={{
            padding: '12px 16px', overflowY: 'auto', flex: 1,
            display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            {loadingMenu ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-secondary)' }}>
                ⏳ Loading menu...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-secondary)' }}>
                No dishes found matching "{addItemsSearch}".
              </div>
            ) : (
              filteredItems.map(m => {
                const itemId = m._id || m.id;
                const cartEntry = cart.find(c => (c.item._id || c.item.id) === itemId);
                const qty = cartEntry ? cartEntry.quantity : 0;

                return (
                  <div
                    key={itemId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      background: qty > 0 ? 'rgba(52, 152, 219, 0.05)' : 'var(--bg-secondary, #fafafa)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-text-primary)' }}>
                          {m.name}
                        </span>
                        {m.category && (
                          <span style={{
                            fontSize: '10px',
                            background: 'rgba(0,0,0,0.06)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            color: 'var(--color-text-secondary)'
                          }}>
                            {m.category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary, #ff6b08)', marginTop: '2px' }}>
                        ₹{m.price}
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div>
                      {qty === 0 ? (
                        <button
                          onClick={() => {
                            if (addToCart) {
                              addToCart(m);
                            } else {
                              increaseQuantity(itemId);
                            }
                          }}
                          style={{
                            background: 'rgba(52, 152, 219, 0.12)',
                            color: '#2980b9',
                            border: '1px solid rgba(52, 152, 219, 0.35)',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ➕ Add
                        </button>
                      ) : (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(52, 152, 219, 0.12)',
                          padding: '3px 6px',
                          borderRadius: '8px',
                          border: '1px solid rgba(52, 152, 219, 0.35)'
                        }}>
                          <button
                            onClick={() => decreaseQuantity(itemId)}
                            style={{
                              background: '#2980b9', color: '#fff',
                              border: 'none', width: '24px', height: '24px',
                              borderRadius: '6px', cursor: 'pointer',
                              fontWeight: 900, fontSize: '14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            −
                          </button>
                          <span style={{ fontWeight: 800, fontSize: '13px', minWidth: '18px', textAlign: 'center', color: '#2980b9' }}>
                            {qty}
                          </span>
                          <button
                            onClick={() => increaseQuantity(itemId)}
                            style={{
                              background: '#2980b9', color: '#fff',
                              border: 'none', width: '24px', height: '24px',
                              borderRadius: '6px', cursor: 'pointer',
                              fontWeight: 900, fontSize: '14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary, #f8fafc)'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>Total In Cart</span>
              <strong style={{ fontSize: '15px', color: 'var(--color-primary, #ff6b08)' }}>₹{subtotal.toFixed(2)}</strong>
            </div>
            <button
              onClick={() => setShowAddItemsModal(false)}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary, #ff6b08) 0%, var(--color-primary-hover, #e05d00) 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Done / View Cart ({totalItems})
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default CartPage;
