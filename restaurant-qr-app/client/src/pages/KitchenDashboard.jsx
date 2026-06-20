import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus, getInventory, reportShortage, getMenu, getAssetUrl } from '../services/api';
import OrderCard from '../components/OrderCard';
import '../styles/App.css';

const KitchenDashboard = () =>{
 const { logout, user } = useAuth();
 const [orders, setOrders] = useState([]);
 const [loading, setLoading] = useState(true);
 const [errorMsg, setErrorMsg] = useState('');
 const [refreshCountdown, setRefreshCountdown] = useState(12);
 const [soundEnabled, setSoundEnabled] = useState(true);
 const [previousActiveCount, setPreviousActiveCount] = useState(0);

 // Tab & Inventory state
 const [searchParams] = useSearchParams();
 const tabParam = searchParams.get('tab');
 const [activeTab, setActiveTab] = useState(() =>{
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

 const handleReportShortageSubmit = async (e) =>{
 e.preventDefault();
 try {
 const response = await reportShortage({
 itemId: selectedItemForShortage._id,
 reason: shortageReason
 });
 if (response && response.success) {
 alert('Stock shortage reported successfully.');
 setShowShortageModal(false);
 setShortageReason('');
 fetchInventory(); // refresh inventory list
 }
 } catch (error) {
 console.error('Error reporting shortage:', error);
 alert(error.response?.data?.message || 'Error reporting shortage.');
 }
 };

 useEffect(() =>{
 if (tabParam) {
 setActiveTab(tabParam);
 } else {
 setActiveTab('cooking');
 }
 }, [tabParam]);

 const fetchInventory = async () =>{
 setInventoryLoading(true);
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
 setInventoryLoading(false);
 }
 };

 const fetchMenu = async () =>{
 setMenuLoading(true);
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
 setMenuLoading(false);
 }
 };

 useEffect(() =>{
 if (activeTab === 'inventory') {
 fetchInventory();
 }
 if (activeTab === 'menu') {
 fetchMenu();
 }
 }, [activeTab]);

 // Play notification sound for new orders
 const playNotificationSound = () =>{
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

 // Play a second beep slightly later for double-tone alert
 setTimeout(() =>{
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

 const fetchOrders = async () =>{
  try {
  const response = await getOrders({ active: true, cafeId: user?.cafeId });
  if (response.success) {
  setOrders(response.data);

  // Alert sound check for new active orders
  const currentActiveCount = response.data.filter((o) =>o.status === 'Placed' || o.status === 'Preparing').length;
  if (currentActiveCount >previousActiveCount) {
  playNotificationSound();
  }
  setPreviousActiveCount(currentActiveCount);
  setErrorMsg('');
  } else {
  setErrorMsg('Failed to refresh kitchen orders feed.');
  }
  } catch (error) {
  console.error('Error fetching kitchen orders:', error);
  setErrorMsg('Cannot connect to live orders server.');
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
  }, [previousActiveCount, user]);

 const handleStatusUpdate = async (id, newStatus) =>{
 try {
 const response = await updateOrderStatus(id, newStatus);
 if (response.success) {
 setOrders((prevOrders) =>
 prevOrders.map((order) =>
 order._id === id ? { ...order, status: newStatus } : order
)
);
 } else {
 alert('Failed to update status');
 }
 } catch (error) {
 console.error('Error updating status:', error);
 alert('Error connecting to server.');
 }
 };

 const activeOrders = orders.filter((order) =>order.status === 'Placed' || order.status === 'Preparing');
 const readyOrders = orders.filter((order) =>order.status === 'Ready'); // Ready corresponds to ready in this flow

 const renderActiveCookingQueue = () =>{
 if (loading && activeOrders.length === 0) {
 return (
<div style={{ textAlign: 'center', padding: '50px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading kitchen board...</p>
</div>);

 }

 if (activeOrders.length === 0) {
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
</div>);

 }

 return (
<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
 {activeOrders.map((order) =>
<div key={order._id} style={{
 background: 'var(--bg-card)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '20px',
 position: 'relative'
 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
<div>
<span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
 Table {order.tableNumber}
 {order.source === 'STAFF' && <span style={{ background: '#3498db', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>STAFF</span>}
</span>
<h3 style={{ margin: '4px 0 0 0', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
 Order #{order._id.substring(order._id.length - 6).toUpperCase()}
</h3>
</div>
<span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
 {new Date(order.createdAt).toLocaleTimeString()}
</span>
</div>

 {/* KOT Itemized Listing */}
<div style={{ margin: '15px 0', borderTop: '1px dashed #5C4331', paddingTop: '10px' }}>
<div style={{ fontSize: '0.75rem', color: '#A0826C', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
 KOT (Kitchen Order Ticket)
</div>
 {order.items.map((item, idx) => {
    const displayImage = item.image ? getAssetUrl(item.image) : '/images/default-food.png';
    return (
      <div key={idx} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '10px 0',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '8px 12px',
        borderRadius: '8px'
      }}>
        {/* Visual Image container with fallback */}
        <div style={{
          position: 'relative',
          width: '70px',
          height: '70px',
          borderRadius: '6px',
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--color-border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img
            src={displayImage}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.src = '/images/default-food.png'; }}
          />
        </div>

        {/* Visual content: bold quantity badge + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            background: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            fontSize: '1.05rem',
            fontWeight: '900',
            padding: '4px 10px',
            borderRadius: '6px',
            boxShadow: '0 2px 5px rgba(255,107,8,0.2)',
            display: 'inline-block',
            minWidth: '24px',
            textAlign: 'center'
          }}>
            {item.quantity}x
          </span>
          <span style={{
            fontSize: '1.0rem',
            fontWeight: '800',
            color: 'var(--color-text-primary)'
          }}>
            {item.name}
          </span>
        </div>
      </div>
    );
  })}
</div>

<div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px', flexWrap: 'wrap' }}>
 {order.status === 'Placed' ?
<button
 onClick={() =>handleStatusUpdate(order._id, 'Preparing')}
 className="btn btn-primary touch-btn"
 style={{ width: 'auto', padding: '10px 18px', fontSize: '13px', background: '#E67E22', borderColor: '#E67E22', minHeight: '44px' }}>
 
 Accept Order
</button>:

<button
 onClick={() =>handleStatusUpdate(order._id, 'Ready')}
 className="btn btn-primary touch-btn"
 style={{ width: 'auto', padding: '10px 18px', fontSize: '13px', background: '#27AE60', borderColor: '#27AE60', minHeight: '44px' }}>
 
 Mark Ready
</button>
 }
<button
 onClick={() =>{
 window.print();
 }}
 className="btn btn-secondary touch-btn"
 style={{ width: 'auto', padding: '10px 18px', fontSize: '13px', minHeight: '44px' }}>
 
  Print KOT
</button>
</div>
</div>
)}
</div>);

 };

 const renderServedReadyQueue = () =>{
 if (readyOrders.length === 0) {
 return (
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>No orders served yet.</p>);

 }

 return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {readyOrders.slice(0, 10).map((order) =>
<div key={order._id} style={{
 background: 'rgba(39, 174, 96, 0.05)',
 border: '1px solid rgba(39, 174, 96, 0.2)',
 borderRadius: '8px',
 padding: '12px'
 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
<span style={{ color: '#27AE60', fontWeight: 'bold' }}>Table {order.tableNumber}</span>
<button
 onClick={() =>handleStatusUpdate(order._id, 'Preparing')}
 style={{ background: 'transparent', border: 'none', color: '#ff9800', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
 
 ↩ Reopen
</button>
</div>
<div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
 Order #{order._id.substring(order._id.length - 4).toUpperCase()}
</div>
</div>
)}
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
<button type="button" onClick={() =>setShowShortageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Send Alert</button>
</div>
</form>
</div>
</div>
 }

</div>);

};

export default KitchenDashboard;