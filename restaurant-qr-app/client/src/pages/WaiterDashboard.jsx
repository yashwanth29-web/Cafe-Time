import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus, getCafeInfo, getAssetUrl } from '../services/api';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import '../styles/App.css';

const WaiterDashboard = () =>{
 const { user } = useAuth();
 
 const [cafeInfo, setCafeInfo] = useState(null);
 const [orders, setOrders] = useState([]);
 const [loading, setLoading] = useState(true);
 const [errorMsg, setErrorMsg] = useState('');
 const [refreshCountdown, setRefreshCountdown] = useState(5);

 const [showTakeOrderModal, setShowTakeOrderModal] = useState(false);
 const [takeOrderTable, setTakeOrderTable] = useState('');

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

 const fetchOrders = async () =>{
 try {
 const response = await getOrders();
 if (response.success) {
 const cafeOrders = user?.cafeId ?
 response.data.filter((order) =>!order.cafeId || order.cafeId === user.cafeId) :
 response.data;
 setOrders(cafeOrders);
 setErrorMsg('');
 } else {
 setErrorMsg('Failed to refresh waiter orders.');
 }
 } catch (error) {
 console.error('Error fetching waiter orders:', error);
 setErrorMsg('Cannot connect to live server.');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() =>{
 fetchOrders();

 const pollingInterval = setInterval(() =>{
 fetchOrders();
 setRefreshCountdown(5);
 }, 5000);

 const countdownInterval = setInterval(() =>{
 setRefreshCountdown((prev) =>prev >1 ? prev - 1 : 5);
 }, 1000);

 return () =>{
 clearInterval(pollingInterval);
 clearInterval(countdownInterval);
 };
 }, []);

 const handleStatusUpdate = async (id, newStatus) =>{
 try {
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
 alert('Error connecting to server.');
 }
 };

 const handleMarkPaid = async (id) =>{
 if (!window.confirm('Confirm that you have received payment for this order?')) {
 return;
 }
 try {
 const response = await updateOrderStatus(id, { status: 'Completed', paymentStatus: 'Paid' });
 if (response.success) {
 setOrders((prevOrders) =>
 prevOrders.map((order) =>
 order._id === id ? { ...order, status: 'Completed', paymentStatus: 'Paid' } : order
)
);
 alert('Payment marked as Completed successfully!');
 }
 } catch (error) {
 console.error('Error marking paid:', error);
 alert('Error updating payment status.');
 }
 };

 const pendingCooking = orders.filter((o) =>o.status === 'Placed' || o.status === 'Preparing');
 const readyForService = orders.filter((o) =>o.status === 'Ready');
 const awaitingPayments = orders.filter((o) =>o.paymentStatus === 'Pending' && o.status === 'Delivered');

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
 
<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
  <button
    onClick={() => setShowTakeOrderModal(true)}
    style={{
      background: 'var(--color-primary)',
      color: 'white',
      border: 'none',
      padding: '10px 16px',
      borderRadius: '8px',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}
  >
    <span style={{ fontSize: '1.2rem' }}>+</span>
    Take Order
  </button>
</div>

{showTakeOrderModal && (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  }}>
    <div style={{
      background: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
      width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>Take New Order</h3>
      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        Enter Table Number (leave blank for Takeaway):
      </p>
      <input
        autoFocus
        type="text"
        placeholder="e.g. 5"
        value={takeOrderTable}
        onChange={(e) => setTakeOrderTable(e.target.value)}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px',
          border: '1px solid var(--color-border)', marginBottom: '20px',
          background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-primary)'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}`;
          }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          onClick={() => setShowTakeOrderModal(false)}
          style={{
            padding: '10px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--color-border)', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}`}
          style={{
            padding: '10px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          Open Menu
        </button>
      </div>
    </div>
  </div>
)}
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
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
  {order.items.map((it, idx) => {
    const displayImage = it.image ? getAssetUrl(it.image) : '/images/default-food.png';
    return (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '4px 8px', borderRadius: '6px' }}>
        <img
          src={displayImage}
          alt={it.name}
          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          onError={(e) => { e.target.src = '/images/default-food.png'; }}
        />
        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          {it.quantity}x
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-primary)' }}>
          {it.name}
        </span>
      </div>
    );
  })}
</div>
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
 style={{
 background: '#27AE60',
 color: 'var(--color-text-primary)',
 padding: '10px 16px',
 borderRadius: '8px',
 fontSize: '12.5px',
 cursor: 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px'
 }}>
 Mark Paid
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
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
  {order.items.map((it, idx) => {
    const displayImage = it.image ? getAssetUrl(it.image) : '/images/default-food.png';
    return (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '4px 8px', borderRadius: '6px' }}>
        <img
          src={displayImage}
          alt={it.name}
          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          onError={(e) => { e.target.src = '/images/default-food.png'; }}
        />
        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          {it.quantity}x
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-primary)' }}>
          {it.name}
        </span>
      </div>
    );
  })}
</div>
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
 style={{
 background: '#27AE60',
 color: 'var(--color-text-primary)',
 padding: '10px 16px',
 borderRadius: '8px',
 fontSize: '12.5px',
 cursor: 'pointer',
 fontWeight: 'bold',
 border: 'none',
 minHeight: '44px'
 }}>
 
 Serve
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
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
  {order.items.map((it, idx) => {
    const displayImage = it.image ? getAssetUrl(it.image) : '/images/default-food.png';
    return (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '4px 8px', borderRadius: '6px' }}>
        <img
          src={displayImage}
          alt={it.name}
          style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          onError={(e) => { e.target.src = '/images/default-food.png'; }}
        />
        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
          {it.quantity}x
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-primary)' }}>
          {it.name}
        </span>
      </div>
    );
  })}
</div>
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