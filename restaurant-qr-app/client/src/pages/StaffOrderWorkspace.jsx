import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { getOrders, updateOrderStatus, getInventory, reportShortage, getMenu, getAssetUrl, getCafeInfo, getPaymentInfo } from '../services/api';
import socket, { connectSocket } from '../socket';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/App.css';

const StaffOrderWorkspace = () => {
  const { user } = useAuth();
  const { activeBranchId, branches } = useBranch();
  
  const [cafeInfo, setCafeInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  
  const seenOrderIdsRef = useRef(new Set());
  const seenPaidOrderIdsRef = useRef(new Set());
  
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'orders';
  const subTabParam = searchParams.get('sub') || 'all';
  
  // Local state for modals & sub-menus
  const [showTakeOrderModal, setShowTakeOrderModal] = useState(false);
  const [takeOrderTable, setTakeOrderTable] = useState('');
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [selectedItemForShortage, setSelectedItemForShortage] = useState(null);
  const [shortageReason, setShortageReason] = useState('');
  
  const [paymentInfo, setPaymentInfo] = useState({ enableUpi: false, upiId: '' });
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiOrder, setUpiOrder] = useState(null);
  
  // Fetch Cafe Details & Payment Info
  useEffect(() => {
    const fetchCafeAndPayment = async () => {
      if (user?.cafeId) {
        try {
          const res = await getCafeInfo(user.cafeId);
          if (res.success) {
            setCafeInfo(res.data);
          }
          if (activeBranchId) {
            const payRes = await getPaymentInfo();
            if (payRes.success && payRes.data) {
              setPaymentInfo(payRes.data);
            }
          }
        } catch (e) {
          console.error('Error fetching cafe or payment info:', e);
        }
      }
    };
    fetchCafeAndPayment();
  }, [user, activeBranchId]);
  
  // Audio chimes
  const playNotificationSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioContext.currentTime); // A5
        gain2.gain.setValueAtTime(0.15, audioContext.currentTime);
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.18);
      }, 130);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }, []);
  
  // Web Speech synthesis
  const speakText = useCallback((text) => {
    if (!soundEnabledRef.current || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed:', e);
    }
  }, []);

  const userCafeId = user?.cafeId;

  // Fetch initial orders
  const fetchWorkspaceOrders = useCallback(async () => {
    if (!userCafeId || !activeBranchId) return;
    try {
      setErrorMsg('');
      const response = await getOrders({ active: true, cafeId: userCafeId, branchId: activeBranchId });
      if (response.success) {
        setOrders(response.data);
        
        // Track seen orders to avoid chime alerts for existing orders on load
        const activeOrders = response.data.filter(o => o.status === 'Placed' || o.status === 'Preparing');
        const paidOrders = response.data.filter(o => o.paymentStatus === 'Paid');
        
        if (seenOrderIdsRef.current.size === 0) {
          activeOrders.forEach(o => seenOrderIdsRef.current.add(o._id));
        }
        if (seenPaidOrderIdsRef.current.size === 0) {
          paidOrders.forEach(o => seenPaidOrderIdsRef.current.add(o._id));
        }
      } else {
        setErrorMsg('Failed to refresh order queue.');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setErrorMsg('Cannot connect to order service feed.');
    } finally {
      setLoading(false);
    }
  }, [userCafeId, activeBranchId]);

  // Load inventory list
  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const response = await getInventory();
      if (response && response.success) {
        setInventory(response.data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  // Load menu items
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const response = await getMenu();
      if (response && response.success) {
        setMenuItems(response.data);
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // Sync tab data fetches
  useEffect(() => {
    if (tabParam === 'inventory') {
      fetchInventory();
    } else if (tabParam === 'menu') {
      fetchMenu();
    }
  }, [tabParam, fetchInventory, fetchMenu, activeBranchId]);

  // Connect socket and register listeners
  useEffect(() => {
    setOrders([]);
    setLoading(true);
    fetchWorkspaceOrders();

    if (userCafeId && activeBranchId) {
      connectSocket(userCafeId, activeBranchId);

      const handleOrderCreated = (newOrder) => {
        setOrders((prev) => {
          if (prev.some((o) => o._id === newOrder._id)) return prev;
          
          if (!seenOrderIdsRef.current.has(newOrder._id)) {
            seenOrderIdsRef.current.add(newOrder._id);
            playNotificationSound();
            const tableMsg = newOrder.tableNumber && newOrder.tableNumber !== 'Takeaway' && newOrder.tableNumber !== 'Walk-in'
              ? `for Table ${newOrder.tableNumber}`
              : 'for Takeaway';
            speakText(`New order received ${tableMsg}.`);
          }
          return [newOrder, ...prev];
        });
      };

      const handleOrderUpdated = (updatedOrder) => {
        setOrders((prev) => {
          const index = prev.findIndex((o) => o._id === updatedOrder._id);
          
          // Sound updates for payments
          if (updatedOrder.paymentStatus === 'Paid' && !seenPaidOrderIdsRef.current.has(updatedOrder._id)) {
            seenPaidOrderIdsRef.current.add(updatedOrder._id);
            playNotificationSound();
            const tableMsg = updatedOrder.tableNumber && updatedOrder.tableNumber !== 'Takeaway' && updatedOrder.tableNumber !== 'Walk-in'
              ? `for Table ${updatedOrder.tableNumber}`
              : 'for Takeaway';
            speakText(`Payment received ${tableMsg}. Amount ${Math.round(updatedOrder.totalAmount)} rupees.`);
          }

          if (index !== -1) {
            // Keep in local list if still active, otherwise filter completed
            if (updatedOrder.status === 'Completed' || updatedOrder.paymentStatus === 'Paid') {
              return prev.filter((o) => o._id !== updatedOrder._id);
            }
            return prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o));
          } else {
            // If new to active orders list (e.g. state transitioned back)
            if (updatedOrder.status !== 'Completed' && updatedOrder.paymentStatus !== 'Paid') {
              return [updatedOrder, ...prev];
            }
            return prev;
          }
        });
      };

      socket.on('order_created', handleOrderCreated);
      socket.on('order_updated', handleOrderUpdated);

      // Graceful poll if socket goes down
      const pollTimer = setInterval(() => {
        if (socket && !socket.connected) {
          fetchWorkspaceOrders();
        }
      }, 10000);

      return () => {
        socket.off('order_created', handleOrderCreated);
        socket.off('order_updated', handleOrderUpdated);
        clearInterval(pollTimer);
      };
    }
  }, [userCafeId, activeBranchId, fetchWorkspaceOrders, playNotificationSound, speakText]);

  // Status updates
  const handleStatusTransition = async (orderId, targetStatus, payload = {}) => {
    let originalOrders;
    
    // Optimistic state update
    setOrders((prev) => {
      originalOrders = prev;
      
      return prev.map((o) => {
        if (o._id === orderId) {
          const updatedObj = { ...o, status: targetStatus, ...payload };
          const nowStr = new Date().toISOString();
          
          if (targetStatus === 'Preparing') {
            updatedObj.preparingBy = user?._id || null;
            updatedObj.preparingByName = user?.name || 'Staff';
            updatedObj.preparingAt = nowStr;
          } else if (targetStatus === 'Ready') {
            updatedObj.readyBy = user?._id || null;
            updatedObj.readyByName = user?.name || 'Staff';
            updatedObj.readyAt = nowStr;
          } else if (targetStatus === 'Delivered') {
            updatedObj.servedBy = user?._id || null;
            updatedObj.servedByName = user?.name || 'Staff';
            updatedObj.servedAt = nowStr;
          } else if (targetStatus === 'Completed') {
            updatedObj.paidBy = user?._id || null;
            updatedObj.paidByName = user?.name || 'Staff';
            updatedObj.paidAt = nowStr;
            updatedObj.paymentStatus = 'Paid';
            if (payload.paymentMethod) {
              updatedObj.paymentMethod = payload.paymentMethod;
            } else if (o.paymentMethod === 'Pending' || !o.paymentMethod) {
              updatedObj.paymentMethod = 'Cash';
            }
          }
          return updatedObj;
        }
        return o;
      }).filter((o) => o.status !== 'Completed' || o.paymentStatus === 'Pending');
    });

    try {
      const res = await updateOrderStatus(orderId, { status: targetStatus, ...payload });
      if (res.success) {
        setOrders((prev) => {
          const isStillActive = res.data.status !== 'Completed' || res.data.paymentStatus === 'Pending';
          if (isStillActive) {
            if (prev.some((o) => o._id === orderId)) {
              return prev.map((o) => (o._id === orderId ? { ...o, ...res.data } : o));
            } else {
              return [res.data, ...prev];
            }
          } else {
            return prev.filter((o) => o._id !== orderId);
          }
        });
      } else {
        if (originalOrders) setOrders(originalOrders);
        alert(res.message || 'Status transition failed.');
      }
    } catch (err) {
      console.error('Error changing status:', err);
      if (originalOrders) setOrders(originalOrders);
      alert(err.response?.data?.message || 'Server permission error.');
    }
  };

  // Mark order as paid
  const handleCollectPayment = async (orderId, paymentMethod) => {
    if (!window.confirm(`Confirm payment received via ${paymentMethod}?`)) return;
    await handleStatusTransition(orderId, 'Completed', { paymentStatus: 'Paid', paymentMethod });
  };

  // Report item shortage
  const handleShortageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForShortage || !shortageReason) return;
    try {
      const res = await reportShortage({ itemId: selectedItemForShortage._id, reason: shortageReason });
      if (res && res.success) {
        alert('Shortage reported successfully.');
        setShowShortageModal(false);
        setShortageReason('');
        fetchInventory();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to report shortage.');
    }
  };

  // Active branch context
  const currentBranch = useMemo(() => {
    return branches?.find((b) => b.branchId === activeBranchId) || null;
  }, [branches, activeBranchId]);

  const isUnifiedMode = currentBranch ? !!currentBranch.unifiedStaffMode : false;
  const userRole = (user?.role || '').toLowerCase();

  // Permission helpers
  const canPrepare = isUnifiedMode || ['admin', 'owner', 'manager', 'chef'].includes(userRole);
  const canServe = isUnifiedMode || ['admin', 'owner', 'manager', 'waiter'].includes(userRole);
  const canCollect = isUnifiedMode || ['admin', 'owner', 'manager', 'waiter', 'cashier'].includes(userRole);

  // Filter orders by sub-tab columns
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (subTabParam === 'all') return true;
      if (subTabParam === 'placed') return o.status === 'Placed';
      if (subTabParam === 'preparing') return o.status === 'Preparing';
      if (subTabParam === 'ready') return o.status === 'Ready';
      if (subTabParam === 'unpaid') return (o.status === 'Delivered' || o.status === 'Completed') && o.paymentStatus === 'Pending';
      return true;
    });
  }, [orders, subTabParam]);

  // Statistics summaries
  const stats = useMemo(() => {
    return {
      placed: orders.filter((o) => o.status === 'Placed').length,
      preparing: orders.filter((o) => o.status === 'Preparing').length,
      ready: orders.filter((o) => o.status === 'Ready').length,
      unpaid: orders.filter((o) => (o.status === 'Delivered' || o.status === 'Completed') && o.paymentStatus === 'Pending').length,
      all: orders.length
    };
  }, [orders]);

  // Completed payments log (receipt history)
  const [completedLogs, setCompletedLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchCompletedLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      // Query todays completed orders by fetching server data
      const res = await getOrders({ active: false, cafeId: user?.cafeId, branchId: activeBranchId });
      if (res.success) {
        setCompletedLogs(res.data.filter(o => o.status === 'Completed' || o.paymentStatus === 'Paid'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  }, [user, activeBranchId]);

  useEffect(() => {
    if (tabParam === 'receipts') {
      fetchCompletedLogs();
    }
  }, [tabParam, fetchCompletedLogs]);

  return (
    <div className="workspace-wrapper">
      
      {/* Upper Information Header */}
      <div className="workspace-header-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            📍 {currentBranch?.branchName || 'Workspace'}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Logged in: <strong>{user?.name}</strong> ({userRole.toUpperCase()})
          </span>
        </div>

        {/* Unified mode status banner & Action button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', width: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: isUnifiedMode ? 'rgba(76, 175, 80, 0.12)' : 'rgba(122, 99, 84, 0.08)',
            border: `1px solid ${isUnifiedMode ? 'var(--color-success)' : 'var(--color-border)'}`,
            padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold',
            color: 'var(--color-text-primary)', whiteSpace: 'nowrap'
          }}>
            <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: isUnifiedMode ? 'var(--color-success)' : 'var(--color-text-secondary)', display: 'inline-block' }} />
            Unified Mode: {isUnifiedMode ? 'ON' : 'OFF'}
          </div>

          <button
            onClick={() => setShowTakeOrderModal(true)}
            style={{
              background: 'var(--color-primary)', color: 'white', border: 'none',
              padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12.5px', transition: 'var(--transition-smooth)', whiteSpace: 'nowrap'
            }}
          >
            <span>➕</span> Take Order
          </button>
        </div>
      </div>

      {/* sound preferences & status overview widgets */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
        
        {/* Navigation Tabs */}
        <div className="scrollable-tabs-container" style={{ background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', width: '100%', maxWidth: 'max-content' }}>
          <button
            onClick={() => setSearchParams({ tab: 'orders', sub: subTabParam })}
            style={{
              flexShrink: 0,
              background: tabParam === 'orders' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'orders' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            📋 Live Queue
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'receipts' })}
            style={{
              flexShrink: 0,
              background: tabParam === 'receipts' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'receipts' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            📝 Completed (Today)
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'menu' })}
            style={{
              flexShrink: 0,
              background: tabParam === 'menu' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'menu' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            🍽️ Cafe Menu
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'inventory' })}
            style={{
              flexShrink: 0,
              background: tabParam === 'inventory' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'inventory' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            📦 Ingredient Stock
          </button>
        </div>

        {/* Sound toggle controls */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            flexShrink: 0,
            background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '12px',
            padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: 'bold'
          }}
        >
          {soundEnabled ? '🔊 Sound Alerts ON' : '🔇 Mute Alerts'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: 'var(--color-danger-bg)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-text-primary)', padding: '14px 18px', borderRadius: '8px', fontSize: '13.5px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ======================= TAB 1: LIVE QUEUE ======================= */}
      {tabParam === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Sub Tab Queue Filter Indicators */}
          <div className="scrollable-tabs-container" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
            {[
              { id: 'all', label: 'All Orders', count: stats.all, color: 'var(--color-text-primary)' },
              { id: 'placed', label: 'Placed / New', count: stats.placed, color: '#3498db' },
              { id: 'preparing', label: 'Preparing', count: stats.preparing, color: '#ff9800' },
              { id: 'ready', label: 'Ready to Serve', count: stats.ready, color: '#2ecc71' },
              { id: 'unpaid', label: 'Awaiting Payment', count: stats.unpaid, color: '#9b59b6' }
            ].map((col) => (
              <button
                key={col.id}
                onClick={() => setSearchParams({ tab: 'orders', sub: col.id })}
                style={{
                  flexShrink: 0,
                  background: subTabParam === col.id ? 'var(--color-border)' : 'var(--bg-card)',
                  color: col.color, border: '1px solid var(--color-border)', padding: '8px 14px',
                  borderRadius: '10px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {col.label} <span style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>{col.count}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 12px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading workspace queue...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg-card)', border: '1px dashed var(--color-border)', borderRadius: '16px', color: 'var(--color-text-secondary)', fontSize: '14.5px' }}>
              🎉 No orders found in this category. Queue is empty!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
              {filteredOrders.map((order) => {
                const isUnpaid = order.status === 'Delivered' && order.paymentStatus === 'Pending';
                const ageMinutes = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                
                return (
                  <div
                    key={order._id}
                    style={{
                      background: 'var(--bg-card)', border: `1px solid ${isUnpaid ? '#ff9800' : 'var(--color-border)'}`,
                      borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px',
                      boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
                      borderWidth: isUnpaid ? '2px' : '1px'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>Table {order.tableNumber}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          #{order._id.substring(order._id.length - 6).toUpperCase()} · placed {ageMinutes}m ago
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                        color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : '#9b59b6',
                        background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : 'rgba(155,89,182,0.1)'
                      }}>
                        {order.status}
                      </span>
                    </div>

                    {/* Special Instructions */}
                    {order.specialInstructions && (
                      <div style={{ background: 'var(--color-warning-bg)', borderLeft: '3px solid var(--color-warning)', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--color-text-primary)' }}>
                        ✍️ <em>"{order.specialInstructions}"</em>
                      </div>
                    )}

                    {/* Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                      {order.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            <strong>{it.quantity}x</strong> {it.name}
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline Audit Logs */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '10px', fontSize: '11.5px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {order.preparingByName && <div>👨‍🍳 Preparing by: <strong>{order.preparingByName}</strong></div>}
                      {order.readyByName && <div>Ready by: <strong>{order.readyByName}</strong></div>}
                      {order.servedByName && <div>Served by: <strong>{order.servedByName}</strong></div>}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: 'auto', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Amount Due</span>
                        <strong style={{ fontSize: '1.1rem', color: '#27AE60' }}>₹{order.totalAmount}</strong>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        
                        {/* Print KOT helper */}
                        <button
                          onClick={() => printKOT(order, user, currentBranch)}
                          style={{
                            background: '#7f8c8d', color: 'white', border: 'none', padding: '6px 10px',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                          }}
                        >
                          🖨️ KOT
                        </button>

                        {/* Placed status actions */}
                        {order.status === 'Placed' && (
                          <button
                            disabled={!canPrepare}
                            onClick={() => handleStatusTransition(order._id, 'Preparing')}
                            style={{
                              background: canPrepare ? '#ff9800' : '#bdc3c7',
                              color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px',
                              cursor: canPrepare ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                            }}
                          >
                            🍳 Start Cooking
                          </button>
                        )}

                        {/* Preparing status actions */}
                        {order.status === 'Preparing' && (
                          <button
                            disabled={!canPrepare}
                            onClick={() => handleStatusTransition(order._id, 'Ready')}
                            style={{
                              background: canPrepare ? '#2ecc71' : '#bdc3c7',
                              color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px',
                              cursor: canPrepare ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                            }}
                          >
                            ✔️ Mark Ready
                          </button>
                        )}

                        {/* Ready status actions */}
                        {order.status === 'Ready' && (
                          <button
                            disabled={!canServe}
                            onClick={() => handleStatusTransition(order._id, 'Delivered')}
                            style={{
                              background: canServe ? '#9b59b6' : '#bdc3c7',
                              color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px',
                              cursor: canServe ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                            }}
                          >
                            🚀 Serve Order
                          </button>
                        )}

                        {/* Delivered / unpaid status actions */}
                        {isUnpaid && (
                          <>
                            <button
                              disabled={!canCollect}
                              onClick={() => printPOSReceipt(order, user, cafeInfo, currentBranch)}
                              style={{
                                background: '#2980b9', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold'
                              }}
                            >
                              POS
                            </button>
                            <button
                              disabled={!canCollect}
                              onClick={() => {
                                if (paymentInfo.enableUpi && paymentInfo.upiId) {
                                  setUpiOrder(order);
                                  setShowUpiModal(true);
                                } else {
                                  handleCollectPayment(order._id, 'UPI');
                                }
                              }}
                              style={{
                                background: '#27ae60', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '8px', cursor: canCollect ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                              }}
                            >
                              Collect UPI
                            </button>
                            <button
                              disabled={!canCollect}
                              onClick={() => handleCollectPayment(order._id, 'Cash')}
                              style={{
                                background: '#e67e22', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '8px', cursor: canCollect ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                              }}
                            >
                              Collect Cash
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 2: COMPLETED LOGS ======================= */}
      {tabParam === 'receipts' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            🧾 Today's Completed Bills
          </h3>

          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
              <p>Loading receipts...</p>
            </div>
          ) : completedLogs.length === 0 ? (
            <div style={{ padding: '40px 0', textStyle: 'italic', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              No completed bills logged for today yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {completedLogs.map((log) => (
                <div
                  key={log._id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)', padding: '12px 18px', borderRadius: '12px'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--color-text-primary)', fontSize: '13.5px' }}>Table {log.tableNumber}</strong>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '2px' }}>
                      Bill ID: #{log._id.toUpperCase()} · Paid via {log.paymentMethod || 'Cash'} at {log.paidAt ? new Date(log.paidAt).toLocaleTimeString() : new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong style={{ color: '#27ae60', fontSize: '14px' }}>₹{log.totalAmount}</strong>
                    <button
                      onClick={() => printPOSReceipt(log, user, cafeInfo, currentBranch)}
                      style={{
                        background: 'var(--color-primary)', color: 'white', border: 'none',
                        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                      }}
                    >
                      Reprint POS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 3: CAFE MENU ======================= */}
      {tabParam === 'menu' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            📖 Cafe Menu & Recipes
          </h3>

          {menuLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
              <p>Loading menu...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {menuItems.map((item) => (
                <div key={item._id} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <img
                    src={item.image ? getAssetUrl(item.image) : '/images/default-food.png'}
                    alt={item.name}
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = '/images/default-food.png'; }}
                  />
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>{item.name}</strong>
                      <span style={{ color: '#27ae60', fontSize: '13px', fontWeight: 'bold' }}>₹{item.price}</span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', minHeight: '34px', display: 'block' }}>
                      {item.description || 'No recipe details uploaded.'}
                    </span>
                    
                    {/* Chef stock outage reporter */}
                    {['chef', 'admin', 'owner', 'manager'].includes(userRole) && (
                      <button
                        onClick={() => { setSelectedItemForShortage(item); setShowShortageModal(true); }}
                        style={{
                          background: 'transparent', border: '1px dashed var(--color-danger)', color: 'var(--color-danger)',
                          padding: '6px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginTop: '6px'
                        }}
                      >
                        ⚠️ Report Out of Stock
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 4: INGREDIENT STOCK ======================= */}
      {tabParam === 'inventory' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            📦 Ingredient Stock Levels
          </h3>

          {inventoryLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
              <p>Loading inventory...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              No inventory ingredients configured.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Item Name</th>
                  <th style={{ padding: '10px 8px' }}>Stock Level</th>
                  <th style={{ padding: '10px 8px' }}>Min Alert Level</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv) => {
                  const isLow = inv.stockLevel <= inv.minLevelAlert;
                  return (
                    <tr key={inv._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{inv.name}</td>
                      <td style={{ padding: '10px 8px' }}>{inv.stockLevel} {inv.unit || 'units'}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{inv.minLevelAlert} {inv.unit}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          background: isLow ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                          color: isLow ? 'var(--color-danger)' : 'var(--color-success)',
                          padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold'
                        }}>
                          {isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ======================= MODAL: TAKE ORDER ======================= */}
      {showTakeOrderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>Take New Order</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Enter Table Number (leave blank for takeaway / walk-in):
            </p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. 8"
              value={takeOrderTable}
              onChange={(e) => setTakeOrderTable(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid var(--color-border)', marginBottom: '20px',
                background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)',
                fontFamily: 'inherit', outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`;
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => { setShowTakeOrderModal(false); setTakeOrderTable(''); }}
                style={{
                  padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                  background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px',
                  color: 'var(--color-text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`}
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: 'none',
                  background: 'var(--color-primary)', color: 'white', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '12.5px'
                }}
              >
                Open Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REPORT INGREDIENT SHORTAGE ======================= */}
      {showShortageModal && selectedItemForShortage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <form onSubmit={handleShortageSubmit} style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>⚠️ Report Out of Stock</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Are you sure <strong>{selectedItemForShortage.name}</strong> is out of stock? Enter a reason for the log:
            </p>
            <input
              required
              autoFocus
              type="text"
              placeholder="e.g. Out of milk supply"
              value={shortageReason}
              onChange={(e) => setShortageReason(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => { setShowShortageModal(false); setSelectedItemForShortage(null); setShortageReason(''); }}
                style={{
                  padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                  background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px',
                  color: 'var(--color-text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: 'none',
                  background: 'var(--color-danger)', color: 'white', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '12.5px'
                }}
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
      {showUpiModal && upiOrder && paymentInfo.upiId && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>Scan to Pay</h3>
            <p style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '20px' }}>Ask the customer to scan this QR code with their UPI app (GPay, PhonePe, Paytm).</p>
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
              <QRCodeSVG 
                value={`upi://pay?pa=${paymentInfo.upiId}&pn=${encodeURIComponent(cafeInfo?.name || 'Cafe')}&am=${upiOrder.totalAmount}&cu=INR&tn=Order%20${upiOrder.orderNumber}`} 
                size={200} 
                level="M" 
                includeMargin={true}
              />
            </div>
            
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#2c3e50', marginBottom: '8px' }}>
              ₹{upiOrder.totalAmount.toFixed(2)}
            </div>
            <div style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '24px' }}>
              Order #{upiOrder.orderNumber}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  handleCollectPayment(upiOrder._id, 'UPI');
                  setShowUpiModal(false);
                }}
                style={{ padding: '14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                Confirm Payment Received
              </button>
              <button 
                onClick={() => setShowUpiModal(false)}
                style={{ padding: '12px', background: '#ecf0f1', color: '#7f8c8d', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffOrderWorkspace;

