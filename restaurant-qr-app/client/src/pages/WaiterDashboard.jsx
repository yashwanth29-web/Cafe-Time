import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus, getCafeInfo } from '../services/api';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import '../styles/App.css';
import { useToast, confirm } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';

const WaiterDashboard = () =>{
 const { user } = useAuth();
 const navigate = useNavigate();
 const toast = useToast();
 const { socket, reconnectTrigger } = useSocket();
 
 const [cafeInfo, setCafeInfo] = useState(null);
 const [orders, setOrders] = useState([]);
 const [loading, setLoading] = useState(true);
 const [errorMsg, setErrorMsg] = useState('');
 const [updatingOrders, setUpdatingOrders] = useState({});

 useEffect(() =>{
 const fetchCafe = async () =>{
 if (user?.cafeId) {
 try {
 const res = await getCafeInfo(user.cafeId);
 if (res.success) {
 setCafeInfo(res.data);
 }
 } catch (e) {
 console.error('Error fetching cafe info:', e);
 }
 }
 };
 fetchCafe();
 }, [user]);

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
        setOrders(cafeOrders);
        setErrorMsg('');
      } else {
        setErrorMsg('Failed to refresh waiter orders.');
      }
    } catch (error) {
      console.error('Error fetching waiter orders:', error);
      setErrorMsg('Server connection issues.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [user?.cafeId, user?.role, user?.assignedBranch, user?.branchId]);

  // Fetch initial orders and set up 30-second hybrid polling
  useEffect(() => {
    fetchOrders();

    const pollingInterval = setInterval(() => {
      console.log('[POLLING] Waiter Dashboard: Running 60s recovery check...');
      fetchOrders(true);
    }, 60000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [fetchOrders]);

  // One-off REST sync on reconnect
  useEffect(() => {
    if (reconnectTrigger > 0) {
      console.log('[SOCKET] Waiter Dashboard: Reconnection detected. Triggering recovery sync.');
      fetchOrders(true);
    }
  }, [reconnectTrigger, fetchOrders]);

  // Socket Event Listeners with versioning and isolation checks
  useEffect(() => {
    if (!socket) return;

    const handleOrderCreated = (newOrder) => {
      console.log('[SOCKET] Waiter received orderCreated:', newOrder);
      if (!newOrder || !newOrder._id) return;

      const staffBranchId = user?.assignedBranch || user?.branchId;
      if (staffBranchId && String(newOrder.branchId) !== String(staffBranchId)) return;
      if (user?.cafeId && newOrder.cafeId !== user.cafeId) return;

      setOrders(prev => {
        if (prev.find(o => o._id === newOrder._id)) return prev;
        return [newOrder, ...prev];
      });
    };

    const handleOrderUpdated = (updatedOrder) => {
      console.log('[SOCKET] Waiter received orderUpdated:', updatedOrder);
      if (!updatedOrder || !updatedOrder._id) return;

      const staffBranchId = user?.assignedBranch || user?.branchId;
      if (staffBranchId && String(updatedOrder.branchId) !== String(staffBranchId)) return;
      if (user?.cafeId && updatedOrder.cafeId !== user.cafeId) return;

      setOrders(prev => {
        return prev.map(o => {
          if (o._id === updatedOrder._id) {
            const incomingTime = new Date(updatedOrder.updatedAt || 0).getTime();
            const existingTime = new Date(o.updatedAt || 0).getTime();
            if (incomingTime <= existingTime) {
              console.log('[SOCKET] Waiter: Ignored stale event for:', updatedOrder._id);
              return o;
            }
            return updatedOrder;
          }
          return o;
        });
      });
    };

    socket.on('orderCreated', handleOrderCreated);
    socket.on('orderUpdated', handleOrderUpdated);
    socket.on('paymentCompleted', handleOrderUpdated);

    return () => {
      socket.off('orderCreated', handleOrderCreated);
      socket.off('orderUpdated', handleOrderUpdated);
      socket.off('paymentCompleted', handleOrderUpdated);
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
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error connecting to server.');
    } finally {
      setUpdatingOrders(prev => ({ ...prev, [id]: false }));
    }
  }, [toast]);

  const handleMarkPaid = useCallback(async (id) => {
    if (!(await confirm('Confirm that you have received payment for this order?'))) {
      return;
    }
    try {
      setUpdatingOrders(prev => ({ ...prev, [id]: true }));
      const response = await updateOrderStatus(id, { status: 'Completed', paymentStatus: 'Paid' });
      if (response.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === id ? { ...order, status: 'Completed', paymentStatus: 'Paid' } : order
          )
        );
        toast.success('Payment marked as Completed successfully!');
      }
    } catch (error) {
      console.error('Error marking paid:', error);
      toast.error('Error updating payment status.');
    } finally {
      setUpdatingOrders(prev => ({ ...prev, [id]: false }));
    }
  }, [toast]);

  const pendingCooking = useMemo(() => orders.filter((o) => o.status === 'Placed' || o.status === 'Preparing'), [orders]);
  const readyForService = useMemo(() => orders.filter((o) => o.status === 'Ready'), [orders]);
  const awaitingPayments = useMemo(() => orders.filter((o) => o.paymentStatus === 'Pending' && o.status === 'Delivered'), [orders]);

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
 Live Order Pipeline
</h2>

</div>
 
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

 {loading ? (
<div style={{ textAlign: 'center', padding: '100px 0' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Connecting to waiter service feed...</p>
</div>
) : (
<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
 {/* Awaiting Payments Column */}
 {awaitingPayments.length >0 &&
<div style={{ marginBottom: '10px' }}>
<h3 style={{ color: '#ff9800', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 152, 0, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
 Awaiting Payment ({awaitingPayments.length})
</h3>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {awaitingPayments.map((order) =>{
 const wantsCash = order.paymentMethod === 'Counter';
 return (
<div key={order._id} style={{
 background: wantsCash ? 'rgba(255, 152, 0, 0.05)' : 'rgba(0, 0, 0, 0.02)',
 border: wantsCash ? '2px dashed #ff9800' : '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '12px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 flexWrap: 'wrap',
 gap: '12px'
 }}>
<div>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>Table {order.tableNumber}</strong>
 {wantsCash ? (
<span style={{
 fontSize: '11px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 background: '#e67e22',
 padding: '2px 6px',
 borderRadius: '4px',
 boxShadow: '0 0 6px rgba(230,126,34,0.5)'
 }}>
  Awaiting Cash
</span>
) : (
<span style={{
 fontSize: '11px',
 fontWeight: 'bold',
 color: 'var(--color-text-secondary)',
 background: 'rgba(0,0,0,0.05)',
 padding: '2px 6px',
 borderRadius: '4px',
 border: '1px solid var(--color-border)'
 }}>
 Eating / Unpaid
</span>
)}
</div>
<span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '4px' }}>
 Order #{order._id.substring(order._id.length - 4).toUpperCase()} | Total:<strong style={{ color: '#2ecc71' }}>₹{order.totalAmount}</strong>
</span>
<span style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', display: 'block', marginTop: '2px' }}>
 {order.items.map((it) =>`${it.quantity}x ${it.name}`).join(', ')}
</span>
</div>
<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
<button
 onClick={() =>printPOSReceipt(order, user, cafeInfo)}
 className="touch-btn"
 style={{
 background: '#2980B9',
 color: 'var(--color-text-primary)',
 padding: '10px 12px',
 borderRadius: '8px',
 fontSize: '12px',
 cursor: 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px'
 }}>
  Print POS
</button>
<button
 onClick={() =>handleMarkPaid(order._id)}
 className="touch-btn"
 disabled={updatingOrders[order._id]}
 style={{
 background: '#27AE60',
 color: 'var(--color-text-primary)',
 padding: '10px 16px',
 borderRadius: '8px',
 fontSize: '12.5px',
 cursor: updatingOrders[order._id] ? 'not-allowed' : 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px',
 opacity: updatingOrders[order._id] ? 0.7 : 1
 }}>
 {updatingOrders[order._id] ? 'Saving...' : 'Mark Paid'}
</button>
</div>
</div>
);
 })}
</div>
</div>
 }

 {/* Ready for Service Column */}
<div>
<h3 style={{ color: '#27AE60', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(39, 174, 96, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
  Prepared & Ready to Serve ({readyForService.length})
</h3>
 
 {readyForService.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '10px 0' }}>No orders currently waiting to be delivered.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {readyForService.map((order) =>
<div key={order._id} style={{
 background: 'rgba(39, 174, 96, 0.05)',
 border: order.paymentMethod === 'Counter' ? '2px solid #ff9800' : '1px solid rgba(39, 174, 96, 0.3)',
 borderRadius: '8px',
 padding: '12px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 flexWrap: 'wrap',
 gap: '12px'
 }}>
<div>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>Table {order.tableNumber}</strong>
 {order.paymentMethod === 'Counter' &&
<span style={{
 fontSize: '11px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 background: '#e67e22',
 padding: '2px 6px',
 borderRadius: '4px',
 boxShadow: '0 0 6px rgba(230,126,34,0.5)'
 }}>
  Cash Requested
</span>
 }
</div>
<span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '3px' }}>
 Order #{order._id.substring(order._id.length - 4).toUpperCase()} | {order.items.length} items
</span>
</div>
<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
<button
 onClick={() =>printKOT(order, user, cafeInfo)}
 className="touch-btn"
 style={{
 background: '#34495E',
 color: 'var(--color-text-primary)',
 padding: '10px 12px',
 borderRadius: '8px',
 fontSize: '12px',
 cursor: 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px'
 }}>
 
  KOT
</button>
<button
 onClick={() =>printPOSReceipt(order, user, cafeInfo)}
 className="touch-btn"
 style={{
 background: '#2980B9',
 color: 'var(--color-text-primary)',
 padding: '10px 12px',
 borderRadius: '8px',
 fontSize: '12px',
 cursor: 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px'
 }}>
 
  POS
</button>
<button
 onClick={() =>handleStatusUpdate(order._id, 'Delivered')}
 className="touch-btn"
 disabled={updatingOrders[order._id]}
 style={{
 background: '#27AE60',
 color: 'var(--color-text-primary)',
 padding: '10px 16px',
 borderRadius: '8px',
 fontSize: '12.5px',
 cursor: updatingOrders[order._id] ? 'not-allowed' : 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px',
 opacity: updatingOrders[order._id] ? 0.7 : 1
 }}>
 {updatingOrders[order._id] ? 'Serving...' : 'Serve'}
</button>
</div>
</div>
)}
</div>
 }
</div>

 {/* Cooking in Kitchen Column */}
<div style={{ marginTop: '20px' }}>
<h3 style={{ color: '#ff9800', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 152, 0, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
 Currently Cooking in Kitchen ({pendingCooking.length})
</h3>
 
 {pendingCooking.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '10px 0' }}>No orders currently being cooked.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {pendingCooking.map((order) =>
<div key={order._id} style={{
 background: 'rgba(0, 0, 0,0.01)',
 border: order.paymentMethod === 'Counter' ? '2px solid #ff9800' : '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '12px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 flexWrap: 'wrap',
 gap: '12px'
 }}>
<div>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>Table {order.tableNumber}</strong>
 {order.paymentMethod === 'Counter' &&
<span style={{
 fontSize: '10px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 background: '#e67e22',
 padding: '1px 5px',
 borderRadius: '4px'
 }}>
  Cash
</span>
 }
</div>
<span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '3px' }}>
 Order #{order._id.substring(order._id.length - 4).toUpperCase()} | Status: {order.status === 'Placed' ? 'Placed' : 'Preparing...'}
</span>
</div>
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
<button
 onClick={() =>printKOT(order, user, cafeInfo)}
 className="touch-btn"
 style={{
 background: '#34495E',
 color: 'var(--color-text-primary)',
 padding: '8px 10px',
 borderRadius: '6px',
 fontSize: '11px',
 cursor: 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px'
 }}>
 
  KOT
</button>
<span style={{ fontSize: '0.75rem', color: order.status === 'Placed' ? '#3498db' : '#ff9800', fontWeight: 'bold' }}>
 {order.status === 'Placed' ? ' Placed' : ' Preparing'}
</span>
</div>
</div>
)}
</div>
 }
</div>
</div>
)}
</div>
);
};

export default WaiterDashboard;