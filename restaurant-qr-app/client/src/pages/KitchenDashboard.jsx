import { toast } from '../components/Toast';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus, getInventory, reportShortage, getMenu } from '../services/api';
import OrderCard from '../components/OrderCard';
import '../styles/App.css';
import { useSocket } from '../hooks/useSocket';

const formatTimeAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  return `${diffMins} mins ago`;
};

const getSourceLabel = (source) => {
  switch (source) {
    case 'QR':
      return 'QR';
    case 'MANUAL':
      return 'Manual';
    case 'TAKEAWAY':
      return 'Takeaway';
    case 'WALK_IN':
      return 'Walk-In';
    case 'DINE_IN':
      return 'Dine-In';
    default:
      return source || 'QR';
  }
};

const getSourceBadgeStyle = (source) => {
  switch (source) {
    case 'QR':
      return { bg: 'rgba(52, 152, 219, 0.12)', color: '#3498db', border: 'rgba(52, 152, 219, 0.3)' };
    case 'MANUAL':
      return { bg: 'rgba(155, 89, 182, 0.12)', color: '#9b59b6', border: 'rgba(155, 89, 182, 0.3)' };
    case 'TAKEAWAY':
      return { bg: 'rgba(230, 126, 34, 0.12)', color: '#e67e22', border: 'rgba(230, 126, 34, 0.3)' };
    case 'WALK_IN':
      return { bg: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', border: 'rgba(46, 204, 113, 0.3)' };
    case 'DINE_IN':
      return { bg: 'rgba(26, 188, 156, 0.12)', color: '#1abc9c', border: 'rgba(26, 188, 156, 0.3)' };
    default:
      return { bg: 'rgba(52, 152, 219, 0.12)', color: '#3498db', border: 'rgba(52, 152, 219, 0.3)' };
  }
};

const getTableStatusAndColor = (tableOrders) => {
  const activeOrders = tableOrders.filter(o => ['Placed', 'Preparing', 'Ready'].includes(o.status));
  if (activeOrders.length === 0) {
    return { status: 'Completed', color: '#7f8c8d', bgColor: 'rgba(127,140,141,0.02)', borderColor: '#7f8c8d' };
  }

  const statuses = activeOrders.map(o => o.status);
  const uniqueStatuses = [...new Set(statuses)];

  if (uniqueStatuses.length === 1) {
    const status = uniqueStatuses[0];
    if (status === 'Placed') {
      return { status: 'Pending', color: '#f1c40f', bgColor: 'rgba(241,196,15,0.03)', borderColor: '#f1c40f' };
    }
    if (status === 'Preparing') {
      return { status: 'Preparing', color: '#3498db', bgColor: 'rgba(52,152,219,0.03)', borderColor: '#3498db' };
    }
    if (status === 'Ready') {
      return { status: 'Ready', color: '#2ecc71', bgColor: 'rgba(46,204,113,0.03)', borderColor: '#2ecc71' };
    }
  }

  return { status: 'Mixed', color: '#9b59b6', bgColor: 'rgba(155,89,182,0.03)', borderColor: '#9b59b6' };
};

const KitchenDashboard = () => {
  const { logout, user } = useAuth();
  const { socket, reconnectTrigger } = useSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingOrders, setUpdatingOrders] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const previousActiveCountRef = useRef(0);
  
  // Real-time highlight and collapsible state
  const [newOrdersMap, setNewOrdersMap] = useState({});
  const [collapsedTables, setCollapsedTables] = useState({});

  // Tab & Inventory state
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => {
    return tabParam || 'cooking';
  });

  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');

  // Menu states
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');

  const [showShortageModal, setShowShortageModal] = useState(false);
  const [selectedItemForShortage, setSelectedItemForShortage] = useState(null);
  const [shortageReason, setShortageReason] = useState('');

  const toggleTableCollapse = (tableNum) => {
    setCollapsedTables((prev) => ({
      ...prev,
      [tableNum]: !prev[tableNum]
    }));
  };

  const handleReportShortageSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const response = await reportShortage({
        itemId: selectedItemForShortage._id,
        reason: shortageReason
      });
      if (response && response.success) {
        toast.success('Stock shortage reported successfully.');
        setShowShortageModal(false);
        setShortageReason('');
        fetchInventory(); // refresh inventory list
      }
    } catch (error) {
      console.error('Error reporting shortage:', error);
      toast.error(error.response?.data?.message || 'Error reporting shortage.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('cooking');
    }
  }, [tabParam]);

  const fetchInventory = useCallback(async (isSilent = false) => {
    if (!isSilent) setInventoryLoading(true);
    try {
      const response = await getInventory();
      if (response && response.success) {
        setInventory(response.data);
        setInventoryError('');
      } else {
        setInventoryError('Failed to load inventory.');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setInventoryError('Cannot connect to inventory database.');
    } finally {
      if (!isSilent) setInventoryLoading(false);
    }
  }, []);

  const fetchMenu = useCallback(async (isSilent = false) => {
    if (!isSilent) setMenuLoading(true);
    try {
      const response = await getMenu();
      if (response && response.success) {
        setMenuItems(response.data);
        setMenuError('');
      } else {
        setMenuError('Failed to load menu items.');
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      setMenuError('Cannot connect to menu database.');
    } finally {
      if (!isSilent) setMenuLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventory();
    }
    if (activeTab === 'menu') {
      fetchMenu();
    }
  }, [activeTab]);

  // Play notification sound for new orders
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);

      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioContext.currentTime); // A5
        gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.2);
      }, 150);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const fetchOrders = useCallback(async (isSilent = false) => {
    try {
      const response = await getOrders();
      if (response.success) {
        const isStaff = ['waiter', 'chef', 'cashier', 'staff'].includes((user?.role || '').toLowerCase());
        const staffBranchId = user?.assignedBranch || user?.branchId;
        const cafeOrders = response.data.filter((order) => {
          if (user?.cafeId && order.cafeId && order.cafeId !== user.cafeId) {
            return false;
          }
          if (isStaff && staffBranchId && order.branchId) {
            return String(order.branchId) === String(staffBranchId);
          }
          return true;
        });

        // Check for new orders to toast and highlight
        setOrders((prevOrders) => {
          if (prevOrders.length > 0) {
            const oldIds = prevOrders.map(o => o._id);
            const brandNewOrders = cafeOrders.filter(o => !oldIds.includes(o._id));
            if (brandNewOrders.length > 0) {
              const now = Date.now();
              setNewOrdersMap((prevMap) => {
                const updated = { ...prevMap };
                brandNewOrders.forEach(o => {
                  updated[o._id] = now;
                  toast.success(`New order received for Table ${o.tableNumber || 'Takeaway'}`);
                });
                return updated;
              });
            }
          }
          return cafeOrders;
        });

        // Alert sound check for new active orders
        const currentActiveCount = cafeOrders.filter((o) => o.status === 'Placed' || o.status === 'Preparing').length;
        if (currentActiveCount > previousActiveCountRef.current) {
          playNotificationSound();
        }
        previousActiveCountRef.current = currentActiveCount;
        setErrorMsg('');
      } else {
        setErrorMsg('Failed to refresh kitchen orders feed.');
      }
    } catch (error) {
      console.error('Error fetching kitchen orders:', error);
      setErrorMsg('Cannot connect to live orders server.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [user?.cafeId, user?.role, user?.assignedBranch, user?.branchId]);

  // Fetch initial data and set up 30-second hybrid polling
  useEffect(() => {
    fetchOrders();
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'menu') fetchMenu();

    const pollingInterval = setInterval(() => {
      console.log('[POLLING] Kitchen Dashboard: Running 60s recovery check...');
      fetchOrders(true);
      if (activeTab === 'inventory') {
        fetchInventory(true);
      }
      if (activeTab === 'menu') {
        fetchMenu(true);
      }
    }, 60000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [fetchOrders, fetchInventory, fetchMenu, activeTab]);

  // One-off REST sync on reconnect
  useEffect(() => {
    if (reconnectTrigger > 0) {
      console.log('[SOCKET] Kitchen Dashboard: Reconnection detected. Triggering recovery sync.');
      fetchOrders(true);
      fetchInventory(true);
      fetchMenu(true);
    }
  }, [reconnectTrigger, fetchOrders, fetchInventory, fetchMenu]);

  // Socket Event Listeners with versioning and isolation checks
  useEffect(() => {
    if (!socket) return;

    const handleOrderCreated = (newOrder) => {
      console.log('[SOCKET] Kitchen received orderCreated:', newOrder);
      if (!newOrder || !newOrder._id) return;

      const staffBranchId = user?.assignedBranch || user?.branchId;
      if (staffBranchId && String(newOrder.branchId) !== String(staffBranchId)) return;
      if (user?.cafeId && newOrder.cafeId !== user.cafeId) return;

      toast.success(`New order received for Table ${newOrder.tableNumber || 'Takeaway'}`);
      playNotificationSound();

      setOrders(prev => {
        if (prev.find(o => o._id === newOrder._id)) return prev;
        return [newOrder, ...prev];
      });
    };

    const handleOrderUpdated = (updatedOrder) => {
      console.log('[SOCKET] Kitchen received orderUpdated:', updatedOrder);
      if (!updatedOrder || !updatedOrder._id) return;

      const staffBranchId = user?.assignedBranch || user?.branchId;
      if (staffBranchId && String(updatedOrder.branchId) !== String(staffBranchId)) return;
      if (user?.cafeId && updatedOrder.cafeId !== user.cafeId) return;

      setOrders(prev => {
        return prev.map(o => {
          if (o._id === updatedOrder._id) {
            const incomingTime = new Date(updatedOrder.updatedAt || 0).getTime();
            const existingTime = new Date(o.updatedAt || 0).getTime();
            if (incomingTime <= existingTime) return o;
            return updatedOrder;
          }
          return o;
        });
      });
    };

    const handleInventoryUpdated = (updatedItems) => {
      console.log('[SOCKET] Kitchen received inventoryUpdated:', updatedItems);
      if (!Array.isArray(updatedItems)) return;

      setInventory(prev => {
        if (prev.length === 0) return prev;
        return prev.map(item => {
          const match = updatedItems.find(p => String(p._id) === String(item._id));
          if (match) {
            const incomingTime = new Date(match.updatedAt || 0).getTime();
            const existingTime = new Date(item.updatedAt || 0).getTime();
            if (incomingTime <= existingTime) return item;
            return {
              ...item,
              quantity: match.quantity,
              stock: match.quantity,
              updatedAt: match.updatedAt
            };
          }
          return item;
        });
      });
    };

    const handleMenuAvailabilityUpdated = (payload) => {
      console.log('[SOCKET] Kitchen received menuAvailabilityUpdated:', payload);
      if (!payload || !payload._id) return;

      setMenuItems(prev => {
        if (prev.length === 0) return prev;
        return prev.map(item => {
          if (String(item._id) === String(payload._id)) {
            const incomingTime = new Date(payload.updatedAt || 0).getTime();
            const existingTime = new Date(item.updatedAt || 0).getTime();
            if (incomingTime <= existingTime) return item;
            return {
              ...item,
              available: payload.available,
              price: payload.price !== undefined ? payload.price : item.price,
              updatedAt: payload.updatedAt
            };
          }
          return item;
        });
      });
    };

    socket.on('orderCreated', handleOrderCreated);
    socket.on('orderUpdated', handleOrderUpdated);
    socket.on('paymentCompleted', handleOrderUpdated);
    socket.on('inventoryUpdated', handleInventoryUpdated);
    socket.on('menuAvailabilityUpdated', handleMenuAvailabilityUpdated);

    return () => {
      socket.off('orderCreated', handleOrderCreated);
      socket.off('orderUpdated', handleOrderUpdated);
      socket.off('paymentCompleted', handleOrderUpdated);
      socket.off('inventoryUpdated', handleInventoryUpdated);
      socket.off('menuAvailabilityUpdated', handleMenuAvailabilityUpdated);
    };
  }, [socket, user]);

  const handleStatusUpdate = useCallback(async (id, newStatus) => {
    try {
      setUpdatingOrders(prev => ({ ...prev, [id]: true }));
      const response = await updateOrderStatus(id, newStatus);
      if (response.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === id ? { ...order, status: newStatus } : order
          )
        );
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error connecting to server.');
    } finally {
      setUpdatingOrders(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  const activeOrders = useMemo(() => orders.filter((order) => order.status === 'Placed' || order.status === 'Preparing'), [orders]);
  const readyOrders = useMemo(() => orders.filter((order) => order.status === 'Ready'), [orders]);

  const renderTableGroup = (tableNum, tableOrders, isCompleted = false) => {
    const now = Date.now();
    const hasNewOrder = tableOrders.some(o => newOrdersMap[o._id] && (now - newOrdersMap[o._id] < 10000));
    const newOrdersCount = tableOrders.filter(o => newOrdersMap[o._id] && (now - newOrdersMap[o._id] < 10000)).length;

    const activeOrdersForTable = tableOrders.filter(o => ['Placed', 'Preparing', 'Ready'].includes(o.status));
    const totalActive = activeOrdersForTable.length;
    const estimatedBill = activeOrdersForTable.reduce((sum, o) => sum + o.totalAmount, 0);

    const lastOrderOrder = tableOrders.reduce((latest, o) => {
      if (!latest) return o;
      return new Date(o.createdAt) > new Date(latest.createdAt) ? o : latest;
    }, null);
    const lastOrderTimeStr = lastOrderOrder ? formatTimeAgo(lastOrderOrder.createdAt) : '';

    const { status, color, bgColor } = getTableStatusAndColor(tableOrders);
    
    // Auto-collapse completed tables; active tables default to open
    const isCollapsed = isCompleted
      ? collapsedTables[tableNum] !== true
      : collapsedTables[tableNum] === true;

    const pendingCount = tableOrders.filter(o => o.status === 'Placed').length;
    const preparingCount = tableOrders.filter(o => o.status === 'Preparing').length;
    const readyCount = tableOrders.filter(o => o.status === 'Ready').length;
    const servedCount = tableOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed').length;

    return (
      <div
        key={tableNum}
        className={`table-group-card table-status-${status.toLowerCase()} ${hasNewOrder ? 'table-group-highlight' : ''}`}
        style={{
          borderLeft: `6px solid ${color}`,
          background: isCompleted ? 'rgba(127, 140, 141, 0.02)' : bgColor,
          borderColor: hasNewOrder ? '#ff6b08' : color
        }}
      >
        <div
          onClick={() => toggleTableCollapse(tableNum)}
          style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            borderBottom: isCollapsed ? 'none' : '1px solid var(--color-border)',
            background: 'rgba(0, 0, 0, 0.05)',
            flexWrap: 'wrap',
            gap: '12px',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-text-primary)' }}>
                Table {tableNum}
              </span>
              {hasNewOrder && (
                <span style={{
                  background: '#ff6b08',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  boxShadow: '0 0 8px rgba(255,107,8,0.6)'
                }}>
                  +{newOrdersCount} New Order
                </span>
              )}
              <span style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: color,
                background: `rgba(0, 0, 0, 0.1)`,
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid ${color}`
              }}>
                {status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12.5px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
              <span>Active Orders: <strong>{totalActive}</strong></span>
              {estimatedBill > 0 && (
                <span>Revenue: <strong>₹{estimatedBill.toFixed(2)}</strong></span>
              )}
              {lastOrderTimeStr && (
                <span>Last Order: <strong>{lastOrderTimeStr}</strong></span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {pendingCount > 0 && <span className="status-badge pending">{pendingCount} Pending</span>}
              {preparingCount > 0 && <span className="status-badge preparing">{preparingCount} Preparing</span>}
              {readyCount > 0 && <span className="status-badge ready">{readyCount} Ready</span>}
              {servedCount > 0 && <span className="status-badge served">{servedCount} Served</span>}
            </div>
            
            <span style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)' }}>
              {isCollapsed ? '▼' : '▲'}
            </span>
          </div>
        </div>

        {!isCollapsed && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[...tableOrders]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((order) => {
                const isOrderNew = newOrdersMap[order._id] && (now - newOrdersMap[order._id] < 10000);
                return (
                  <div
                    key={order._id}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: isOrderNew ? '2px solid #ff6b08' : '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '16px',
                      position: 'relative'
                    }}
                  >
                    {isOrderNew && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: '#ff6b08',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        boxShadow: '0 0 6px rgba(255,107,8,0.4)'
                      }}>
                        NEW
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                          Order #{order._id.substring(order._id.length - 6).toUpperCase()}
                        </h4>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '2px' }}>
                          Customer: {order.customerName || 'Guest'} ({order.customerPhone || 'No phone'})
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: getSourceBadgeStyle(order.orderSource).bg,
                            color: getSourceBadgeStyle(order.orderSource).color,
                            border: `1px solid ${getSourceBadgeStyle(order.orderSource).border}`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}>
                            Source: {getSourceLabel(order.orderSource)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          color: order.status === 'Placed' ? '#f1c40f' : order.status === 'Preparing' ? '#3498db' : order.status === 'Ready' ? '#2ecc71' : '#7f8c8d',
                          background: order.status === 'Placed' ? 'rgba(241,196,15,0.1)' : order.status === 'Preparing' ? 'rgba(52,152,219,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : 'rgba(127,140,141,0.1)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {order.status === 'Placed' ? 'Pending' : order.status}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div style={{ margin: '12px 0', borderTop: '1px dashed var(--color-border)', paddingTop: '10px' }}>
                      {order.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                          <span>
                            <strong>{item.quantity}x</strong> {item.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.specialInstructions && (
                      <div style={{
                        background: 'rgba(230,126,34,0.08)',
                        borderLeft: '3px solid #E67E22',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '12.5px',
                        color: '#E67E22',
                        marginBottom: '12px'
                      }}>
                        💡 <strong>Instructions:</strong> {order.specialInstructions}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                        Total Amount: ₹{order.totalAmount.toFixed(2)}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {order.status === 'Placed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order._id, 'Preparing'); }}
                            className="btn btn-primary touch-btn"
                            disabled={updatingOrders[order._id]}
                            style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', background: '#e67e22', borderColor: '#e67e22', minHeight: '40px' }}
                          >
                            {updatingOrders[order._id] ? 'Accepting...' : 'Accept Order'}
                          </button>
                        )}
                        
                        {order.status === 'Preparing' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order._id, 'Ready'); }}
                            className="btn btn-primary touch-btn"
                            disabled={updatingOrders[order._id]}
                            style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', background: '#27ae60', borderColor: '#27ae60', minHeight: '40px' }}
                          >
                            {updatingOrders[order._id] ? 'Updating...' : 'Mark Ready'}
                          </button>
                        )}

                        {order.status === 'Ready' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order._id, 'Delivered'); }}
                            className="btn btn-primary touch-btn"
                            disabled={updatingOrders[order._id]}
                            style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', background: '#9b59b6', borderColor: '#9b59b6', minHeight: '40px' }}
                          >
                            {updatingOrders[order._id] ? 'Serving...' : 'Mark Served'}
                          </button>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); window.print(); }}
                          className="btn btn-secondary touch-btn"
                          style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', minHeight: '40px' }}
                        >
                          Print KOT
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  const renderActiveCookingQueue = () => {
    if (loading && orders.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading kitchen board...</p>
        </div>
      );
    }

    const tableGroups = {};
    orders.forEach(o => {
      const t = o.tableNumber || 'Takeaway';
      if (!tableGroups[t]) {
        tableGroups[t] = [];
      }
      tableGroups[t].push(o);
    });

    const activeTables = [];
    const completedTablesList = [];

    Object.entries(tableGroups).forEach(([tableNum, tOrders]) => {
      const hasActive = tOrders.some(o => ['Placed', 'Preparing', 'Ready'].includes(o.status));
      if (hasActive) {
        activeTables.push(tableNum);
      } else if (tOrders.length > 0) {
        completedTablesList.push(tableNum);
      }
    });

    // Sort active tables: oldest active order first (min wait time)
    activeTables.sort((a, b) => {
      const minA = Math.min(...tableGroups[a].filter(o => ['Placed', 'Preparing', 'Ready'].includes(o.status)).map(o => new Date(o.createdAt).getTime()));
      const minB = Math.min(...tableGroups[b].filter(o => ['Placed', 'Preparing', 'Ready'].includes(o.status)).map(o => new Date(o.createdAt).getTime()));
      return minA - minB;
    });

    // Sort completed tables: newest first
    completedTablesList.sort((a, b) => {
      const maxA = Math.max(...tableGroups[a].map(o => new Date(o.createdAt).getTime()));
      const maxB = Math.max(...tableGroups[b].map(o => new Date(o.createdAt).getTime()));
      return maxB - maxA;
    });

    if (activeTables.length === 0 && completedTablesList.length === 0) {
      return (
        <div style={{
          padding: '80px 20px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px dashed var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontSize: '1.1rem'
        }}>
          All orders prepared! Kitchen is clean.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {activeTables.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔥 Active Tables ({activeTables.length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activeTables.map(tableNum => renderTableGroup(tableNum, tableGroups[tableNum], false))}
            </div>
          </div>
        )}

        {completedTablesList.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
            <h3 style={{ color: 'var(--color-text-secondary)', marginBottom: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✅ Completed Tables ({completedTablesList.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {completedTablesList.map(tableNum => renderTableGroup(tableNum, tableGroups[tableNum], true))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderServedReadyQueue = () => {
    if (readyOrders.length === 0) {
      return (
        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>No orders served yet.</p>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {readyOrders.slice(0, 10).map((order) => (
          <div key={order._id} style={{
            background: 'rgba(39, 174, 96, 0.05)',
            border: '1px solid rgba(39, 174, 96, 0.2)',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#27AE60', fontWeight: 'bold' }}>Table {order.tableNumber}</span>
              <button
                onClick={() => handleStatusUpdate(order._id, 'Preparing')}
                style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
              >
                ↩ Reopen
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Order #{order._id.substring(order._id.length - 4).toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
<div className="fade-in">
 {/* Title & Controls Bar */}
<div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 borderBottom: '1px solid var(--color-border)',
 paddingBottom: '16px',
 marginBottom: '24px',
 flexWrap: 'wrap',
 gap: '12px'
 }}>
<div>
<h2 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
 {activeTab === 'inventory' ? ' Ingredient Stockroom' : activeTab === 'menu' ? ' Cafe Menu & Recipes' : '‍ Kitchen Display Screen'}
</h2>
<p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
 {activeTab === 'inventory' ?
 'Read-only raw material inventory levels. Stock replenishment is managed by Manager / Owner roles.' :
 activeTab === 'menu' ?
 'Read-only catalog of cafe menu dishes and mapped ingredient recipes.' :
 'Real-time preparation feed for active cooking tickets.'}
</p>
</div>
 
 {activeTab !== 'inventory' && activeTab !== 'menu' &&
<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
<button
 onClick={() =>setSoundEnabled(!soundEnabled)}
 style={{
 backgroundColor: soundEnabled ? 'rgba(39, 174, 96, 0.15)' : 'rgba(139, 79, 57, 0.15)',
 color: soundEnabled ? '#2ecc71' : '#E67E22',
 border: `1px solid ${soundEnabled ? '#2ecc71' : '#E67E22'}`,
 padding: '8px 16px',
 borderRadius: '8px',
 fontSize: '13px',
 fontWeight: '700',
 cursor: 'pointer',
 transition: 'all 0.2s'
 }}>
 
 {soundEnabled ? ' Notification Sound: On' : ' Notification Sound: Off'}
</button>
 

</div>
 }
</div>

 {errorMsg &&
<div style={{
 backgroundColor: 'var(--color-danger-bg)',
 borderLeft: '4px solid var(--color-danger)',
 color: 'var(--color-text-primary)',
 padding: '15px',
 borderRadius: '6px',
 marginBottom: '20px'
 }}>
  {errorMsg}
</div>
 }

 {activeTab === 'inventory' ?
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1.2rem' }}>Smart Ingredient Stockroom (Read-Only)</h3>
 {inventoryLoading ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading ingredient stock levels...</p>
</div>:
 inventoryError ?
<p style={{ color: '#E74C3C', fontStyle: 'italic' }}>{inventoryError}</p>:
 inventory.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No ingredients found in stockroom.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
 {inventory.map((item) =>{
 const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
 const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
 const isLow = qtyVal< reorderVal;
 return (
<div
 key={item._id}
 style={{
 background: 'rgba(0, 0, 0,0.01)',
 border: `1px solid ${isLow ? '#E74C3C' : 'var(--color-border)'}`,
 padding: '16px',
 borderRadius: '8px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center'
 }}>
 
<div>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{item.name}</strong>
<div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
 Current Stock:<span style={{ color: isLow ? '#E74C3C' : 'var(--color-text-primary)', fontWeight: 'bold' }}>{qtyVal} {item.unit}</span>| Safety Min: {reorderVal} {item.unit}
</div>
</div>
 
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 {isLow &&
<span style={{ color: '#E74C3C', fontWeight: 'bold', fontSize: '0.75rem', background: 'rgba(231,76,60,0.1)', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
  Low Stock Alert
</span>
 }
<button
 onClick={() =>{
 setSelectedItemForShortage(item);
 setShortageReason('Kitchen stock running low');
 setShowShortageModal(true);
 }}
 style={{
 background: 'rgba(230, 126, 34, 0.15)',
 color: '#E67E22',
 border: '1px solid #E67E22',
 padding: '6px 12px',
 borderRadius: '6px',
 cursor: 'pointer',
 fontSize: '11px',
 fontWeight: 'bold',
 transition: 'all 0.2s'
 }}
 onMouseEnter={(e) =>{e.currentTarget.style.background = '#E67E22';e.currentTarget.style.color = '#fff';}}
 onMouseLeave={(e) =>{e.currentTarget.style.background = 'rgba(230, 126, 34, 0.15)';e.currentTarget.style.color = '#E67E22';}}>
 
  Report Shortage
</button>
</div>
</div>);

 })}
</div>
 }
</div>:
 activeTab === 'menu' ?
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1.2rem' }}>Cafe Dishes & Ingredient Recipes (Read-Only)</h3>
 {menuLoading ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading cafe dishes...</p>
</div>:
 menuError ?
<p style={{ color: '#E74C3C', fontStyle: 'italic' }}>{menuError}</p>:
 menuItems.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No menu items found.</p>:

<div className="menu-grid-admin" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
 {menuItems.map((item) =>
<div key={item.id} className={`admin-menu-card ${!item.available ? 'unavailable' : ''}`} style={{
 background: '#1F140E',
 border: '1px solid var(--color-border)',
 borderRadius: '10px',
 overflow: 'hidden',
 display: 'flex',
 flexDirection: 'column'
 }}>
<div className="admin-menu-info" style={{ padding: '15px', display: 'flex', flexDirection: 'column', height: '100%' }}>
<div style={{ flexGrow: 1 }}>
<span style={{ fontSize: '11px', background: 'var(--color-primary)', color: 'var(--color-text-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
 {item.category}
</span>
<h4 style={{ color: 'var(--color-text-primary)', margin: '8px 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>{item.name}</h4>
<p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>{item.description}</p>
 
<div style={{ fontSize: '12px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
 Prep Time:<strong>{item.preparationTime || 10} minutes</strong>
</div>

 {item.recipe && item.recipe.length >0 ?
<div style={{ fontSize: '11px', color: '#A0826C', marginBottom: '12px', background: 'rgba(0, 0, 0,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px dashed #5C4331' }}>
<strong>Mapped Recipe:</strong>
<ul style={{ margin: '4px 0 0 15px', padding: 0 }}>
 {item.recipe.map((ing, idx) =>
<li key={idx}>{ing.name}: {ing.quantity}g</li>
)}
</ul>
</div>:

<div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: '12px' }}>
 No recipe ingredients mapped.
</div>
 }
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #432E22', paddingTop: '10px', marginTop: 'auto' }}>
<span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem' }}>₹{(item.price || 0).toFixed(2)}</span>
<span style={{
 backgroundColor: item.available ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
 color: item.available ? '#2ecc71' : '#e74c3c',
 padding: '3px 8px',
 borderRadius: '4px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 {item.available ? 'Available' : 'Out of Stock'}
</span>
</div>
</div>
</div>
)}
</div>
 }
</div>: (

 /* Main Cooking Grid */
<div>
 {/* Mobile Layout: switch column based on activeTab */}
<div className="mobile-only-kitchen" style={{ display: 'none' }}>
 {activeTab === 'cooking' ?
<div>
<h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 20px 0', fontSize: '1.4rem', fontWeight: 700 }}>
 Active cooking queue ({activeOrders.length})
</h2>
 {renderActiveCookingQueue()}
</div>:

<div>
<h2 style={{ color: '#27AE60', margin: '0 0 20px 0', fontSize: '1.4rem', fontWeight: 700 }}>
 Served / Ready ({readyOrders.length})
</h2>
 {renderServedReadyQueue()}
</div>
 }
</div>

 {/* Desktop/Tablet Layout: Split Grid */}
<div className="desktop-tablet-kitchen" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
 {/* Preparing Column */}
<div>
<h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 20px 0', fontSize: '1.4rem', fontWeight: 700 }}>
 Active cooking queue ({activeOrders.length})
</h2>
 {renderActiveCookingQueue()}
</div>

 {/* Ready / Served Column */}
<div style={{ borderLeft: '1px solid #5C4331', paddingLeft: '30px' }}>
<h2 style={{ color: '#27AE60', margin: '0 0 20px 0', fontSize: '1.4rem', fontWeight: 700 }}>
 Served / Ready ({readyOrders.length})
</h2>
 {renderServedReadyQueue()}
</div>
</div>
</div>)
 }
 {/* MODAL: REPORT SHORTAGE */}
 {showShortageModal && selectedItemForShortage &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Report Stock Shortage</h3>
<button onClick={() =>setShowShortageModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleReportShortageSubmit}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Ingredient:<strong>{selectedItemForShortage.name}</strong></label>
<p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
 Current registered stock is {selectedItemForShortage.stock} {selectedItemForShortage.unit}.
</p>
</div>
<div className="form-group">
<label className="form-label">Reason for shortage alert *</label>
<input
 type="text"
 required
 value={shortageReason}
 onChange={(e) =>setShortageReason(e.target.value)}
 className="form-input"
 placeholder="e.g. Expired, high consumption today, supplier delay" />
 
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowShortageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }} disabled={actionLoading}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={actionLoading}>
  {actionLoading ? 'Sending Alert...' : 'Send Alert'}
</button>
</div>
</form>
</div>
</div>
 }

</div>);

};

export default KitchenDashboard;