import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getOrders, updateOrderStatus, getInventory, getCafeInfo } from '../services/api';
import { printPOSReceipt } from '../utils/printHelpers';
import '../styles/App.css';

const CashierDashboard = () =>{
 const { logout, user } = useAuth();
 const seenPaidOrderIdsRef = useRef(new Set());
 const [searchParams] = useSearchParams();
 const tabParam = searchParams.get('tab');
 const [activeTab, setActiveTab] = useState(() =>{
 return tabParam || 'billing';
 });

 const [inventory, setInventory] = useState([]);
 const [inventoryLoading, setInventoryLoading] = useState(false);
 const [cafeInfo, setCafeInfo] = useState(null);

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

 useEffect(() =>{
 if (tabParam) {
 setActiveTab(tabParam);
 } else {
 setActiveTab('billing');
 }
 }, [tabParam]);

 const fetchInventory = async () =>{
 setInventoryLoading(true);
 try {
 const response = await getInventory();
 if (response && response.success) {
 setInventory(response.data);
 }
 } catch (error) {
 console.error('Error fetching inventory:', error);
 } finally {
 setInventoryLoading(false);
 }
 };

 useEffect(() =>{
 if (activeTab === 'inventory') {
 fetchInventory();
 }
 }, [activeTab]);

 const [orders, setOrders] = useState([]);
 const [loading, setLoading] = useState(true);
 const [errorMsg, setErrorMsg] = useState('');
 const [selectedOrder, setSelectedOrder] = useState(null);
 const [refreshCountdown, setRefreshCountdown] = useState(12);

  const playNotificationSound = () => {
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
      
    }
  };

  const speakPaymentReceived = (order) => {
    if (!('speechSynthesis' in window)) return;
    try {
      const tableInfo = order.tableNumber && order.tableNumber !== 'Takeaway' && order.tableNumber !== 'Walk-in'
        ? `for Table ${order.tableNumber}`
        : 'for Takeaway';
      const text = `Payment received ${tableInfo}. Amount: ${Math.round(order.totalAmount)} rupees.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
    }
  };

 const fetchOrders = async () =>{
 try {
 const today = new Date();
 const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
 const response = await getOrders({ date: todayStr, cafeId: user?.cafeId });
 if (response.success) {
 setOrders(response.data);
 
  // Track paid status transition
  const paidOrders = response.data.filter((o) => o.paymentStatus === 'Paid');
  if (seenPaidOrderIdsRef.current.size === 0) {
    paidOrders.forEach((o) => seenPaidOrderIdsRef.current.add(o._id));
  } else {
    const newPaidOrders = paidOrders.filter((o) => !seenPaidOrderIdsRef.current.has(o._id));
    if (newPaidOrders.length > 0) {
      playNotificationSound();
      newPaidOrders.forEach((order) => {
        speakPaymentReceived(order);
        seenPaidOrderIdsRef.current.add(order._id);
      });
    }
  }

 setErrorMsg('');
 } else {
 setErrorMsg('Failed to refresh billing orders feed.');
 }
 } catch (error) {
 console.error('Error fetching cashier orders:', error);
 setErrorMsg('Cannot connect to billing server.');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() =>{
 fetchOrders();

 const pollingInterval = setInterval(() =>{
 fetchOrders();
 setRefreshCountdown(12);
 }, 12000);

 const countdownInterval = setInterval(() =>{
 setRefreshCountdown((prev) =>prev >1 ? prev - 1 : 12);
 }, 1000);

 return () =>{
 clearInterval(pollingInterval);
 clearInterval(countdownInterval);
 };
 }, [user]);

 const handleProcessPayment = async (orderId, paymentMethod) =>{
 try {
 const response = await updateOrderStatus(orderId, {
 status: 'Completed',
 paymentStatus: 'Paid'
 });

 if (response.success) {
 alert(`Payment of ₹${selectedOrder.totalAmount.toFixed(2)} processed via ${paymentMethod}!`);
 // Update local list
 setOrders((prev) =>prev.map((o) =>o._id === orderId ? { ...o, paymentStatus: 'Paid', status: 'Completed' } : o));
 setSelectedOrder((prev) =>prev && prev._id === orderId ? { ...prev, paymentStatus: 'Paid', status: 'Completed' } : prev);
 } else {
 alert('Server failed to record payment.');
 }
 } catch (e) {
 console.error('Payment process error:', e);
 // Fallback local update
 setOrders((prev) =>prev.map((o) =>o._id === orderId ? { ...o, paymentStatus: 'Paid', status: 'Completed' } : o));
 if (selectedOrder) {
 setSelectedOrder({ ...selectedOrder, paymentStatus: 'Paid', status: 'Completed' });
 }
 alert(`[Offline Mode] Payment processed via ${paymentMethod}.`);
 }
 };

 const pendingPayments = orders.filter((o) =>o.paymentStatus !== 'Paid');
 const paidPayments = orders.filter((o) =>o.paymentStatus === 'Paid');

 const renderPendingBills = () =>{
 return (
<div>
<h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 20px 0', fontSize: '1.4rem', fontWeight: 700 }}>
 Pending Receipts ({pendingPayments.length})
</h2>

 {loading && pendingPayments.length === 0 ?
<div style={{ textAlign: 'center', padding: '50px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading billing records...</p>
</div>:
 pendingPayments.length === 0 ?
<div style={{
 padding: '50px 20px',
 textAlign: 'center',
 background: 'var(--bg-card)',
 borderRadius: '12px',
 border: '1px dashed var(--color-border)',
 color: 'var(--color-text-secondary)'
 }}>
 All customer tabs settled! No pending bills.
</div>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {pendingPayments.map((order) =>
<div
 key={order._id}
 onClick={() =>setSelectedOrder(order)}
 style={{
 background: selectedOrder?._id === order._id ? 'rgba(111, 78, 55, 0.15)' : 'var(--bg-card)',
 border: order.paymentMethod === 'Counter' ?
 '2px solid #e67e22' :
 `1px solid ${selectedOrder?._id === order._id ? 'var(--color-primary)' : 'var(--color-border)'}`,
 padding: '15px',
 borderRadius: '10px',
 cursor: 'pointer',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 transition: 'border 0.2s',
 minHeight: '60px'
 }}>
 
<div>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>Table {order.tableNumber}</strong>
 {order.paymentMethod === 'Counter' &&
<span style={{
 fontSize: '10px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 background: '#e67e22',
 padding: '2px 6px',
 borderRadius: '4px'
 }}>
  Cash Requested
</span>
 }
</div>
<span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '3px' }}>
 Order #{order._id.substring(order._id.length - 4).toUpperCase()} | {order.items.length} dishes
</span>
</div>
<div style={{ textAlign: 'right' }}>
<span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1rem', display: 'block' }}>
 ₹{order.totalAmount.toFixed(2)}
</span>
<span style={{ fontSize: '0.7rem', color: '#ff9800', background: 'rgba(255,152,0,0.1)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
 {order.paymentStatus}
</span>
</div>
</div>
)}
</div>
 }
</div>);

 };

 const renderSettledPayments = () =>{
 return (
<div>
<h2 style={{ color: '#27AE60', margin: '30px 0 20px 0', fontSize: '1.4rem', fontWeight: 700 }}>
 Settled Payments Today ({paidPayments.length})
</h2>
 {paidPayments.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>No bills settled yet.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
 {paidPayments.slice(0, 10).map((order) =>
<div key={order._id} style={{
 background: 'rgba(39,174,96,0.02)',
 border: '1px solid rgba(39,174,96,0.15)',
 padding: '12px',
 borderRadius: '8px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center'
 }}>
<div>
<span style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>Table {order.tableNumber}</span>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>
 Order ID: #{order._id.substring(order._id.length - 4).toUpperCase()}
</span>
</div>
<div style={{ textAlign: 'right' }}>
<strong style={{ color: '#27AE60', fontSize: '0.9rem' }}>₹{order.totalAmount.toFixed(2)}</strong>
<span style={{ fontSize: '0.7rem', color: '#27AE60', display: 'block' }}>Paid</span>
</div>
</div>
)}
</div>
 }
</div>);

 };

 const renderInvoiceGenerator = () =>{
 return (
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
 {selectedOrder ?
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 800 }}>
 Receipt & Invoice Generator
</h3>

 {/* Receipt Visual Mock */}
<div id="receipt-print-area" style={{
 background: '#FAF6F0',
 color: '#33271c',
 padding: '25px',
 borderRadius: '8px',
 fontFamily: "'Courier New', Courier, monospace",
 border: '1px solid #E6D5C3',
 boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
 }}>
<div style={{ textAlign: 'center', borderBottom: '1px dashed #33271c', paddingBottom: '15px', marginBottom: '15px' }}>
<h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>{cafeInfo?.name || 'Dr. Chai Cafe'}</h2>
<p style={{ margin: '4px 0', fontSize: '0.8rem' }}>{cafeInfo?.address || 'Main Road, Near Metro Station, Hyderabad'}</p>
 {cafeInfo?.gstNumber &&<p style={{ margin: '2px 0', fontSize: '0.8rem', fontWeight: 'bold' }}>GSTIN: {cafeInfo.gstNumber}</p>}
<p style={{ margin: '2px 0', fontSize: '0.8rem' }}>Tel: {cafeInfo?.supportNumber || user?.phone || '+91 9876543210'}</p>
</div>

<div style={{ fontSize: '0.85rem', marginBottom: '15px' }}>
<div><strong>Invoice #:</strong>{selectedOrder._id.toUpperCase()}</div>
<div><strong>Date:</strong>{new Date(selectedOrder.createdAt).toLocaleString()}</div>
<div><strong>Table:</strong>Table {selectedOrder.tableNumber}</div>
 {selectedOrder.customerName &&<div><strong>Customer:</strong>{selectedOrder.customerName}</div>}
</div>

<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '15px' }}>
<thead>
<tr style={{ borderBottom: '1px solid #33271c', borderTop: '1px solid #33271c' }}>
<th style={{ padding: '6px 0', textAlign: 'left' }}>Item</th>
<th style={{ padding: '6px 0', textAlign: 'center' }}>Qty</th>
<th style={{ padding: '6px 0', textAlign: 'right' }}>Price</th>
</tr>
</thead>
<tbody>
 {selectedOrder.items.map((item, idx) =>
<tr key={idx}>
<td style={{ padding: '4px 0' }}>{item.name}</td>
<td style={{ padding: '4px 0', textAlign: 'center' }}>{item.quantity}</td>
<td style={{ padding: '4px 0', textAlign: 'right' }}>₹{(item.price * item.quantity).toFixed(2)}</td>
</tr>
)}
</tbody>
</table>

<div style={{ borderTop: '1px dashed #33271c', paddingTop: '10px', textAlign: 'right', fontSize: '0.85rem' }}>
<div>Subtotal (Tax Excl.): ₹{(selectedOrder.totalAmount / 1.05).toFixed(2)}</div>
<div>CGST (2.5%): ₹{((selectedOrder.totalAmount - selectedOrder.totalAmount / 1.05) / 2).toFixed(2)}</div>
<div>SGST (2.5%): ₹{((selectedOrder.totalAmount - selectedOrder.totalAmount / 1.05) / 2).toFixed(2)}</div>
<div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginTop: '6px' }}>
 TOTAL AMOUNT: ₹{selectedOrder.totalAmount.toFixed(2)}
</div>
<div style={{ fontSize: '0.75rem', color: '#555', marginTop: '4px' }}>
 Method:<strong>{selectedOrder.paymentMethod || 'Counter'}</strong>
</div>
</div>

<div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', borderTop: '1px solid #33271c', paddingTop: '10px' }}>
 Thank you for dining with us!<br />
 Scan QR code on your next visit.
</div>
</div>

 {/* Action buttons */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
 {selectedOrder.paymentStatus !== 'Paid' ?
<div style={{ display: 'flex', gap: '10px', width: '100%' }}>
<button
 onClick={() =>handleProcessPayment(selectedOrder._id, 'Cash')}
 className="btn btn-primary touch-btn"
 style={{ flex: 1, padding: '12px', fontSize: '13px', background: '#27AE60', borderColor: '#27AE60', minHeight: '44px' }}>
 
 Settle with Cash
</button>
<button
 onClick={() =>handleProcessPayment(selectedOrder._id, 'Online Confirm')}
 className="btn btn-primary touch-btn"
 style={{ flex: 1, padding: '12px', fontSize: '13px', background: '#2980B9', borderColor: '#2980B9', minHeight: '44px' }}>
 
 Confirm Online Pay
</button>
</div>:

<div style={{ width: '100%', padding: '12px', background: 'rgba(39, 174, 96, 0.15)', color: '#27AE60', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
 Receipt Settled & Paid
</div>
 }
 
<button
 onClick={() =>printPOSReceipt(selectedOrder, user, cafeInfo)}
 className="btn btn-secondary touch-btn"
 style={{ width: '100%', padding: '12px', fontSize: '13px', minHeight: '44px' }}>
 
  Print Receipt Invoice (Thermal)
</button>
</div>

</div>:

<div style={{
 textAlign: 'center',
 padding: '100px 20px',
 color: 'var(--color-text-secondary)'
 }}>
 Select a pending bill from the list to load the receipt and invoice panel.
</div>
 }
</div>);

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
 Billing & Cashier Desk
</h2>
<p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
 Process walk-in or table orders payments and print receipt invoices.
</p>
</div>
 
<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

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
 {activeTab === 'inventory' ?
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1.2rem', fontWeight: 800 }}>Ingredient Stockroom & Availability (Read-Only)</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
 Live stock levels of raw materials and ingredients. Out of stock ingredients are automatically updated. Editing is restricted to Managers and Cafe Owners.
</p>
 {inventoryLoading ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading ingredient stock levels...</p>
</div>:
 inventory.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No ingredients found in stockroom.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
 {inventory.map((item) =>{
 const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
 const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
 const isLow = qtyVal<= reorderVal;

 let statusColor = '#2ECC71';
 if (qtyVal<= 0) statusColor = '#E74C3C';else
 if (isLow) statusColor = '#F39C12';

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
<span style={{
 backgroundColor: `${statusColor}1A`,
 border: `1px solid ${statusColor}`,
 color: statusColor,
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '10px',
 fontWeight: 'bold'
 }}>
 {qtyVal<= 0 ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'IN_STOCK'}
</span>
</div>
</div>);

 })}
</div>
 }
</div>: (

 /* Main Billing View */
<div>
 {/* Mobile Layout Switch */}
<div className="mobile-only-cashier" style={{ display: 'none' }}>
 {activeTab === 'billing' ?
 selectedOrder ?
<div>
<button
 onClick={() =>setSelectedOrder(null)}
 className="btn btn-secondary touch-btn"
 style={{ marginBottom: '15px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '5px', width: 'auto', minHeight: '44px' }}>
 
 ← Back to Bills List
</button>
 {renderInvoiceGenerator()}
</div>:

 renderPendingBills() :


 renderSettledPayments()
 }
</div>

 {/* Desktop/Tablet Layout */}
<div className="desktop-tablet-cashier" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '30px' }}>
<div>
 {renderPendingBills()}
 {renderSettledPayments()}
</div>
<div>
 {renderInvoiceGenerator()}
</div>
</div>
</div>)
 }
</div>);

};

export default CashierDashboard;