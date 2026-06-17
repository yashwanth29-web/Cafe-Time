import { toast } from '../components/Toast';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getOrders, getStaff, getInventory, updateInventoryItem, recordPurchase, recordWastage, getMenu, updateMenuItem, getCafeInfo } from '../services/api';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import '../styles/App.css';

const ManagerDashboard = () =>{
 const { logout, user } = useAuth();
 const [orders, setOrders] = useState([]);
 const [staffList, setStaffList] = useState([]);
 const [loading, setLoading] = useState(true);
 const [errorMsg, setErrorMsg] = useState('');
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

 const [searchParams] = useSearchParams();
 const tabParam = searchParams.get('tab');
 const [activeTab, setActiveTab] = useState(() =>{
 return tabParam || 'reports';
 });

 useEffect(() =>{
 if (tabParam) {
 setActiveTab(tabParam);
 } else {
 setActiveTab('reports');
 }
 }, [tabParam]);

 // Simulated manager states
 const [inventory, setInventory] = useState([]);

 const [attendance, setAttendance] = useState({});

 // Manager advanced inventory modals and forms
 const [showUpdateStockModal, setShowUpdateStockModal] = useState(false);
 const [showPurchaseModal, setShowPurchaseModal] = useState(false);
 const [showWastageModal, setShowWastageModal] = useState(false);
 const [selectedItem, setSelectedItem] = useState(null);
 const [stockForm, setStockForm] = useState({ quantity: 0 });
 const [purchaseForm, setPurchaseForm] = useState({ quantityAdded: 0, costPrice: 0, supplier: '', notes: '' });
 const [wastageForm, setWastageForm] = useState({ quantityWasted: 0, type: 'Wastage', reason: '' });

 // Menu states
 const [menuItems, setMenuItems] = useState([]);
 const [menuLoading, setMenuLoading] = useState(false);
 const [updatingItem, setUpdatingItem] = useState(null);
 const [showPriceModal, setShowPriceModal] = useState(false);
 const [newPrice, setNewPrice] = useState('');

 const [actionLoading, setActionLoading] = useState(false);

 // Search states
 const [menuSearch, setMenuSearch] = useState('');
 const [inventorySearch, setInventorySearch] = useState('');

 const filteredInventory = inventory.filter((item) =>
 item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
 (item.category || '').toLowerCase().includes(inventorySearch.toLowerCase())
);

 const filteredMenuItems = menuItems.filter((item) =>
 item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
 (item.category || '').toLowerCase().includes(menuSearch.toLowerCase())
);

 const fetchMenu = async (isSilent = false) =>{
  if (!isSilent) setMenuLoading(true);
  try {
  const response = await getMenu();
  if (response.success) {
  setMenuItems(response.data);
  }
  } catch (error) {
  console.error('Error fetching menu:', error);
  } finally {
  if (!isSilent) setMenuLoading(false);
  }
  };

 const handleToggleAvailability = async (item) =>{
 try {
 setActionLoading(true);
 const response = await updateMenuItem(item.id, { available: !item.available });
 if (response.success) {
 setMenuItems((prev) =>prev.map((m) =>m.id === item.id ? response.data : m));
 }
 } catch (err) {
 console.error('Error toggling availability:', err);
 toast.error('Error updating availability.');
 } finally {
 setActionLoading(false);
 }
 };

 const handleUpdatePrice = async (e) =>{
 e.preventDefault();
 if (!newPrice || parseFloat(newPrice)<= 0) {
 toast.info('Please enter a valid price.');
 return;
 }
 try {
 setActionLoading(true);
 const response = await updateMenuItem(updatingItem.id, { price: parseFloat(newPrice) });
 if (response.success) {
 setMenuItems((prev) =>prev.map((m) =>m.id === updatingItem.id ? response.data : m));
 setShowPriceModal(false);
 setUpdatingItem(null);
 setNewPrice('');
 }
 } catch (err) {
 console.error('Error updating price:', err);
 toast.error('Error updating price.');
 } finally {
 setActionLoading(false);
 }
 };

 const handleUpdateStock = async (e) =>{
 e.preventDefault();
 try {
 setActionLoading(true);
 const response = await updateInventoryItem(selectedItem._id, { quantity: stockForm.quantity });
 if (response && response.success) {
 toast.success('Stock quantity updated successfully.');
 setShowUpdateStockModal(false);
 fetchInitialData(); // reload list
 }
 } catch (error) {
 console.error('Error updating stock:', error);
 toast.error('Error updating stock quantity.');
 } finally {
 setActionLoading(false);
 }
 };

 const handleRecordPurchase = async (e) =>{
 e.preventDefault();
 try {
 setActionLoading(true);
 const response = await recordPurchase({
 itemId: selectedItem._id,
 quantityAdded: Number(purchaseForm.quantityAdded),
 costPrice: Number(purchaseForm.costPrice),
 supplier: purchaseForm.supplier,
 notes: purchaseForm.notes
 });
 if (response && response.success) {
 toast.success('Purchase recorded successfully.');
 setShowPurchaseModal(false);
 fetchInitialData(); // reload list
 }
 } catch (error) {
 console.error('Error recording purchase:', error);
 toast.error(error.response?.data?.message || 'Error recording purchase.');
 } finally {
 setActionLoading(false);
 }
 };

 const handleRecordWastage = async (e) =>{
 e.preventDefault();
 try {
 setActionLoading(true);
 const response = await recordWastage({
 itemId: selectedItem._id,
 quantityWasted: Number(wastageForm.quantityWasted),
 type: wastageForm.type,
 reason: wastageForm.reason
 });
 if (response && response.success) {
 toast.success('Wastage entry recorded successfully.');
 setShowWastageModal(false);
 fetchInitialData(); // reload list
 }
 } catch (error) {
 console.error('Error recording wastage:', error);
 toast.error(error.response?.data?.message || 'Error recording wastage.');
 } finally {
 setActionLoading(false);
 }
 };

  const fetchInitialData = async (isSilent = false) =>{
    try {
      const ordersRes = await getOrders();
      if (ordersRes.success) {
        const cafeOrders = user?.cafeId ?
          ordersRes.data.filter((order) =>!order.cafeId || order.cafeId === user.cafeId) :
          ordersRes.data;
        setOrders(cafeOrders);
      }

      const staffRes = await getStaff();
      if (staffRes.success) {
        setStaffList(staffRes.staff);
        // Initialize attendance to Present by default if not already set
        setAttendance((prev) => {
          const updated = { ...prev };
          staffRes.staff.forEach((member) => {
            if (updated[member._id] === undefined) {
              updated[member._id] = 'Present';
            }
          });
          return updated;
        });
      }

      // Fetch actual inventory from backend
      const inventoryRes = await getInventory();
      if (inventoryRes.success) {
        setInventory(inventoryRes.data);
      }

      // Fetch menu items
      await fetchMenu(isSilent);
    } catch (e) {
      console.error('Error fetching manager dashboard data:', e);
      if (!isSilent) setErrorMsg('Could not fetch operational data from backend.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() =>{
    fetchInitialData();

    // Polling every 5 seconds for real-time updates
    const pollingInterval = setInterval(() =>{
      fetchInitialData(true);
    }, 5000);

    return () =>clearInterval(pollingInterval);
  }, []);

 const handleAttendanceChange = (staffId, status) =>{
 setAttendance((prev) =>({ ...prev, [staffId]: status }));
 };

 const handleRestock = async (id, currentStock) =>{
 try {
 const response = await updateInventoryItem(id, { stock: Number(currentStock) + 50 });
 if (response && response.success) {
 setInventory((prev) =>prev.map((item) =>item._id === id ? response.data : item));
 }
 } catch (error) {
 console.error('Error restocking item:', error);
 toast.error('Error updating inventory stock');
 }
 };

 const now = new Date();
 const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

 const completedOrders = orders.filter((o) =>o.paymentStatus === 'Paid');
 const todayCompletedOrders = completedOrders.filter((o) =>new Date(o.createdAt) >= startOfToday);
 const todaySales = todayCompletedOrders.reduce((acc, curr) =>acc + curr.totalAmount, 0);

 const activeCount = orders.filter((o) =>o.status === 'Placed' || o.status === 'Preparing').length;
 const lowStockItems = inventory.filter((item) =>item.stock< item.minStock);

 return (
<div className="fade-in">
 {/* Title Bar */}
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
 Manager Station
</h2>
<p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
 Monitor sales revenue, active cooking queue, stock alerts, and employee attendance rosters.
</p>
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

 {/* Manager Summary Analytics widgets */}
<div className="stat-card-grid" style={{ marginBottom: '30px' }}>
<div className="stat-card">
<span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Today's Settle Revenue</span>
<h3 style={{ fontSize: '1.6rem', margin: '5px 0 0 0', color: '#27AE60' }}>₹{todaySales.toFixed(2)}</h3>
</div>
<div className="stat-card">
<span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Orders in Kitchen Queue</span>
<h3 style={{ fontSize: '1.6rem', margin: '5px 0 0 0', color: '#ff9800' }}>{activeCount} active</h3>
</div>
<div className="stat-card">
<span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Low Stock Ingredients</span>
<h3 style={{ fontSize: '1.6rem', margin: '5px 0 0 0', color: lowStockItems.length >0 ? '#E74C3C' : '#27AE60' }}>
 {lowStockItems.length} alerts
</h3>
</div>
</div>

 {/* Tabs Menu removed to prevent duplicate navigation */}

 {/* Tab Contents */}
 {loading ?
<div style={{ textAlign: 'center', padding: '60px 0' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading manager portal data...</p>
</div>:

<div>
 {/* TAB 1: ALL ORDERS */}
 {activeTab === 'orders' &&
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1.2rem' }}>Live Order Records</h3>
 {/* Desktop Table View */}
<div className="desktop-tablet-manager-orders" style={{ display: 'none', overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)' }}>
<th style={{ padding: '8px' }}>Order ID</th>
<th style={{ padding: '8px' }}>Table</th>
<th style={{ padding: '8px' }}>Amount</th>
<th style={{ padding: '8px' }}>Cooking Status</th>
<th style={{ padding: '8px' }}>Payment</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Print Actions</th>
</tr>
</thead>
<tbody>
 {orders.map((order) =>
<tr key={order._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)' }}>#{order._id.substring(order._id.length - 8).toUpperCase()}</td>
<td style={{ padding: '10px 8px' }}>
 Table {order.tableNumber}
 {order.paymentMethod === 'Counter' &&
<span style={{ marginLeft: '8px', color: 'var(--color-text-primary)', background: '#e67e22', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}> Cash</span>
 }
</td>
<td style={{ padding: '10px 8px', fontWeight: 'bold' }}>₹{order.totalAmount.toFixed(2)}</td>
<td style={{ padding: '10px 8px' }}>
<span style={{
 color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : order.status === 'Delivered' ? '#9b59b6' : order.status === 'Completed' ? '#27AE60' : '#7f8c8d',
 background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : order.status === 'Delivered' ? 'rgba(155,89,182,0.1)' : order.status === 'Completed' ? 'rgba(39,174,96,0.1)' : 'rgba(127,140,141,0.1)',
 padding: '3px 8px',
 borderRadius: '12px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 {order.status}
</span>
</td>
<td style={{ padding: '10px 8px' }}>
<span style={{
 color: order.paymentStatus === 'Paid' ? '#27AE60' : '#E74C3C',
 fontWeight: 'bold'
 }}>
 {order.paymentStatus}
</span>
</td>
<td style={{ padding: '10px 8px' }}>
<div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
<button onClick={() =>printKOT(order, user, cafeInfo)} style={{ background: '#34495E', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>KOT</button>
<button onClick={() =>printPOSReceipt(order, user, cafeInfo)} style={{ background: '#2980B9', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>POS</button>
</div>
</td>
</tr>
)}
</tbody>
</table>
</div>

 {/* Mobile Card View */}
<div className="mobile-only-manager-orders" style={{ display: 'none' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {orders.map((order) =>
<div key={order._id} style={{ background: 'rgba(0, 0, 0,0.02)', border: order.paymentMethod === 'Counter' ? '2px solid #e67e22' : '1px solid var(--color-border)', padding: '14px', borderRadius: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
<span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>#{order._id.substring(order._id.length - 8).toUpperCase()}</span>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
<span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Table {order.tableNumber}</span>
 {order.paymentMethod === 'Counter' &&
<span style={{ color: 'var(--color-text-primary)', background: '#e67e22', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}> Cash</span>
 }
</div>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '10px' }}>
<span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>₹{order.totalAmount.toFixed(2)}</span>
<div style={{ display: 'flex', gap: '6px' }}>
<span style={{
 color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : order.status === 'Delivered' ? '#9b59b6' : order.status === 'Completed' ? '#27AE60' : '#7f8c8d',
 background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : order.status === 'Delivered' ? 'rgba(155,89,182,0.1)' : order.status === 'Completed' ? 'rgba(39,174,96,0.1)' : 'rgba(127,140,141,0.1)',
 padding: '2px 6px',
 borderRadius: '8px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>{order.status}</span>
<span style={{
 color: order.paymentStatus === 'Paid' ? '#27AE60' : '#E74C3C',
 background: order.paymentStatus === 'Paid' ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
 padding: '2px 6px',
 borderRadius: '8px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>{order.paymentStatus}</span>
</div>
</div>
<div style={{ display: 'flex', gap: '8px', borderTop: '1px dashed var(--color-border)', paddingTop: '10px' }}>
<button onClick={() =>printKOT(order, user, cafeInfo)} style={{ flex: 1, background: '#34495E', color: 'var(--color-text-primary)', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', minHeight: '44px' }}> KOT</button>
<button onClick={() =>printPOSReceipt(order, user, cafeInfo)} style={{ flex: 1, background: '#2980B9', color: 'var(--color-text-primary)', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', minHeight: '44px' }}> POS Bill</button>
</div>
</div>
)}
</div>
</div>

</div>
 }

 {/* TAB 2: STAFF ATTENDANCE */}
 {activeTab === 'attendance' &&
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1.2rem' }}>Employee Attendance Register</h3>
 {staffList.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No staff members registered.</p>:

<>
 {/* Desktop Table View */}
<div className="desktop-tablet-manager-attendance" style={{ display: 'none', overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)' }}>
<th style={{ padding: '8px' }}>Staff Name</th>
<th style={{ padding: '8px' }}>Designated Role</th>
<th style={{ padding: '8px' }}>Contact</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Mark Attendance</th>
</tr>
</thead>
<tbody>
 {staffList.map((member) =>
<tr key={member._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
<td style={{ padding: '12px 8px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{member.name}</td>
<td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{member.staffRole}</td>
<td style={{ padding: '12px 8px' }}>{member.phone}</td>
<td style={{ padding: '12px 8px', textAlign: 'center' }}>
<select
 value={attendance[member._id] || 'Present'}
 onChange={(e) =>handleAttendanceChange(member._id, e.target.value)}
 style={{
 background: 'var(--bg-secondary)',
 border: '1px solid var(--color-border)',
 color: 'var(--color-text-primary)',
 padding: '6px 12px',
 borderRadius: '4px'
 }}>
 
<option value="Present">Present</option>
<option value="Absent">Absent</option>
<option value="Late">Late (Delayed)</option>
<option value="Off">Weekly Off</option>
</select>
</td>
</tr>
)}
</tbody>
</table>
</div>

 {/* Mobile Card View */}
<div className="mobile-only-manager-attendance" style={{ display: 'none' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {staffList.map((member) =>
<div key={member._id} style={{ background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '14px', borderRadius: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
<div>
<div style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', fontSize: '15px' }}>{member.name}</div>
<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{member.staffRole}</span>
</div>
<select
 value={attendance[member._id] || 'Present'}
 onChange={(e) =>handleAttendanceChange(member._id, e.target.value)}
 style={{
 background: 'var(--bg-secondary)',
 border: '1px solid var(--color-border)',
 color: 'var(--color-text-primary)',
 padding: '8px 12px',
 borderRadius: '6px',
 fontSize: '13px',
 minHeight: '44px'
 }}>
 
<option value="Present">Present</option>
<option value="Absent">Absent</option>
<option value="Late">Late (Delayed)</option>
<option value="Off">Weekly Off</option>
</select>
</div>
<div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
 {member.phone}
</div>
</div>
)}
</div>
</div>
</>
 }
</div>
 }

 {/* TAB 3: INVENTORY AUTOMATION */}
 {activeTab === 'inventory' &&
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1.2rem', fontWeight: 800 }}>Smart Ingredient Stockroom</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
 Operational inventory management panel. View stock levels, record restock/purchases, and track wastage logs. Cost and Selling prices are read-only.
</p>
 
<div style={{ marginBottom: '20px' }}>
<input
 type="text"
 placeholder=" Search ingredients by name or category..."
 value={inventorySearch}
 onChange={(e) =>setInventorySearch(e.target.value)}
 style={{
 width: '100%',
 padding: '12px 16px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 fontSize: '14px',
 outline: 'none'
 }} />
 
</div>

 {/* Desktop Table View */}
<div className="desktop-tablet-manager-inventory" style={{ display: 'none', overflowX: 'auto' }}>
<table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
<th style={{ padding: '8px' }}>Ingredient Name</th>
<th style={{ padding: '8px' }}>Category</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Stock Level</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Cost Price</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Selling Price</th>
<th style={{ padding: '8px' }}>Supplier</th>
<th style={{ padding: '8px' }}>Branch</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Safety Min</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
</tr>
</thead>
<tbody>
 {filteredInventory.map((item) =>{
 const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
 const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
 const isLow = qtyVal<= reorderVal;
 const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;

 let statusColor = '#2ECC71';
 if (qtyVal<= 0) statusColor = '#E74C3C';else
 if (isLow) statusColor = '#F39C12';

 return (
<tr key={item._id} style={{ borderBottom: '1px solid #432E22' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{item.name}</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{item.category || 'Ingredients'}</td>
<td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isLow ? '#E74C3C' : 'var(--color-text-primary)' }}>
 {qtyVal} {item.unit}
</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>
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
</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>₹{costPriceVal?.toFixed(2)} (R/O)</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>₹{(item.sellingPrice || 0).toFixed(2)} (R/O)</td>
<td style={{ padding: '10px 8px' }}>{item.supplier || 'N/A'}</td>
<td style={{ padding: '10px 8px' }}>{item.branch || 'Main'}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>{reorderVal} {item.unit}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>
<div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
<button
 onClick={() =>{
 setSelectedItem(item);
 setStockForm({ quantity: qtyVal });
 setShowUpdateStockModal(true);
 }}
 style={{ background: '#6F4E37', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
 
  Stock Qty
</button>
<button
 onClick={() =>{
 setSelectedItem(item);
 setPurchaseForm({
 quantityAdded: 0,
 costPrice: costPriceVal,
 supplier: item.supplier || '',
 notes: ''
 });
 setShowPurchaseModal(true);
 }}
 style={{ background: '#27AE60', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
 
 Purchase
</button>
<button
 onClick={() =>{
 setSelectedItem(item);
 setWastageForm({
 quantityWasted: 0,
 type: 'Wastage',
 reason: ''
 });
 setShowWastageModal(true);
 }}
 style={{ background: '#E74C3C', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
 
 Wastage
</button>
</div>
</td>
</tr>);

 })}
</tbody>
</table>
</div>

 {/* Mobile Card View */}
<div className="mobile-only-manager-inventory" style={{ display: 'none' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
 {filteredInventory.map((item) =>{
 const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
 const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
 const isLow = qtyVal<= reorderVal;
 const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;

 let statusColor = '#2ECC71';
 if (qtyVal<= 0) statusColor = '#E74C3C';else
 if (isLow) statusColor = '#F39C12';

 return (
<div key={item._id} style={{ background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '14px', borderRadius: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
<div>
<div style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', fontSize: '15px' }}>{item.name}</div>
<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{item.category || 'Ingredients'}</span>
</div>
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
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
<span>Stock:<strong style={{ color: isLow ? '#E74C3C' : 'var(--color-text-primary)' }}>{qtyVal} {item.unit}</strong>(Min: {reorderVal})</span>
<span>Price: ₹{costPriceVal?.toFixed(2)}</span>
</div>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
<button
 onClick={() =>{
 setSelectedItem(item);
 setStockForm({ quantity: qtyVal });
 setShowUpdateStockModal(true);
 }}
 style={{ background: '#6F4E37', color: 'var(--color-text-primary)', border: 'none', padding: '8px 4px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', minHeight: '44px' }}>
 
  Stock
</button>
<button
 onClick={() =>{
 setSelectedItem(item);
 setPurchaseForm({
 quantityAdded: 0,
 costPrice: costPriceVal,
 supplier: item.supplier || '',
 notes: ''
 });
 setShowPurchaseModal(true);
 }}
 style={{ background: '#27AE60', color: 'var(--color-text-primary)', border: 'none', padding: '8px 4px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', minHeight: '44px' }}>
 
 Purchase
</button>
<button
 onClick={() =>{
 setSelectedItem(item);
 setWastageForm({
 quantityWasted: 0,
 type: 'Wastage',
 reason: ''
 });
 setShowWastageModal(true);
 }}
 style={{ background: '#E74C3C', color: 'var(--color-text-primary)', border: 'none', padding: '8px 4px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', minHeight: '44px' }}>
 
 Wastage
</button>
</div>
</div>);

 })}
</div>
</div>

</div>
 }

 {/* TAB 4: DAILY REPORTS */}
 {activeTab === 'reports' &&
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.2rem' }}>End-of-Day Daily Statement</h3>
<div className="form-row" style={{ gap: '30px' }}>
<div style={{ borderRight: '1px solid #5C4331', paddingRight: '30px' }}>
<h4 style={{ color: 'var(--color-primary)', margin: '0 0 15px 0' }}>Sales Highlights</h4>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>Gross Sales Volume:</span>
<strong style={{ color: 'var(--color-text-primary)' }}>₹{todaySales.toFixed(2)}</strong>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>Total Ticket Orders:</span>
<strong style={{ color: 'var(--color-text-primary)' }}>{todayCompletedOrders.length} orders</strong>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>Average Ticket Value:</span>
<strong style={{ color: 'var(--color-text-primary)' }}>
 ₹{todayCompletedOrders.length >0 ? (todaySales / todayCompletedOrders.length).toFixed(2) : '0.00'}
</strong>
</div>
</div>
</div>
 
<div>
<h4 style={{ color: 'var(--color-primary)', margin: '0 0 15px 0' }}>Category Breakdown (Simulated)</h4>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>Burgers & Mains:</span>
<strong style={{ color: 'var(--color-text-primary)' }}>55%</strong>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>Espresso & Coffee:</span>
<strong style={{ color: 'var(--color-text-primary)' }}>30%</strong>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>Bakery & Desserts:</span>
<strong style={{ color: 'var(--color-text-primary)' }}>15%</strong>
</div>
</div>
</div>
</div>
</div>
 }

 {/* TAB 5: CAFE MENU (MANAGER VIEW) */}
 {activeTab === 'menu' &&
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<div>
<h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)', margin: 0, fontWeight: 800 }}>Cafe Dishes & Availability</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Update price or toggle availability status. Category and item creation are restricted to Owner.</p>
</div>
</div>

<div style={{ marginBottom: '20px' }}>
<input
 type="text"
 placeholder=" Search dishes by name or category..."
 value={menuSearch}
 onChange={(e) =>setMenuSearch(e.target.value)}
 style={{
 width: '100%',
 padding: '12px 16px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 fontSize: '14px',
 outline: 'none'
 }} />
 
</div>

 {menuLoading ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading cafe dishes...</p>
</div>:
 filteredMenuItems.length === 0 ?
<p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No menu items found.</p>:

<div className="menu-grid-admin" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
 {filteredMenuItems.map((item) =>
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
<p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0', minHeight: '36px' }}>{item.description}</p>
 {item.recipe && item.recipe.length >0 &&
<div style={{ fontSize: '11px', color: '#A0826C', marginBottom: '12px', background: 'rgba(0, 0, 0,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px dashed #5C4331' }}>
<strong>Recipe:</strong>
 {item.recipe.map((ing) =>`${ing.name} (${ing.quantity}g)`).join(', ')}
</div>
 }
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #432E22', paddingTop: '10px', marginTop: 'auto' }}>
<span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem' }}>₹{item.price.toFixed(2)}</span>
<div style={{ display: 'flex', gap: '8px' }}>
<button
 onClick={() =>{
 setUpdatingItem(item);
 setNewPrice(item.price);
 setShowPriceModal(true);
 }}
 style={{ background: '#6F4E37', color: 'var(--color-text-primary)', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
 
 ₹ Price
</button>
<button
 onClick={() =>handleToggleAvailability(item)}
 style={{
 background: item.available ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
 color: item.available ? '#2ecc71' : '#e74c3c',
 border: `1px solid ${item.available ? '#2ecc71' : '#e74c3c'}`,
 padding: '5px 10px',
 borderRadius: '4px',
 cursor: 'pointer',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 
 {item.available ? ' In Stock' : 'Out of Stock'}
</button>
</div>
</div>
</div>
</div>
)}
</div>
 }
</div>
 }

</div>
 }

 {/* MODAL: UPDATE STOCK QUANTITY */}
 {showUpdateStockModal && selectedItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Update Stock Quantity</h3>
<button onClick={() =>setShowUpdateStockModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleUpdateStock}>
<div className="modal-body">
<div className="form-group">
<span className="form-label">Ingredient:<strong>{selectedItem.name}</strong></span>
</div>
<div className="form-group">
<label htmlFor="stock-qty-input" className="form-label">Quantity ({selectedItem.unit}) *</label>
<input type="number" id="stock-qty-input" name="stock-qty-input" required value={stockForm.quantity} onChange={(e) =>setStockForm({ quantity: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowUpdateStockModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={actionLoading}>
  {actionLoading ? 'Saving...' : 'Save Changes'}
</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: RECORD PURCHASE */}
 {showPurchaseModal && selectedItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Record Purchase Entry</h3>
<button onClick={() =>setShowPurchaseModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleRecordPurchase}>
<div className="modal-body">
<div className="form-group">
<span className="form-label">Ingredient:<strong>{selectedItem.name}</strong></span>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="purchase-qty-input" className="form-label">Quantity Purchased *</label>
<input type="number" id="purchase-qty-input" name="purchase-qty-input" required min="1" value={purchaseForm.quantityAdded} onChange={(e) =>setPurchaseForm({ ...purchaseForm, quantityAdded: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="purchase-cost-input" className="form-label">Cost Price per Unit (₹) *</label>
<input type="number" step="0.001" id="purchase-cost-input" name="purchase-cost-input" required min="0.001" value={purchaseForm.costPrice} onChange={(e) =>setPurchaseForm({ ...purchaseForm, costPrice: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-group">
<label htmlFor="purchase-supplier-input" className="form-label">Supplier *</label>
<input type="text" id="purchase-supplier-input" name="purchase-supplier-input" required value={purchaseForm.supplier} onChange={(e) =>setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="purchase-notes-input" className="form-label">Notes</label>
<textarea id="purchase-notes-input" name="purchase-notes-input" value={purchaseForm.notes} onChange={(e) =>setPurchaseForm({ ...purchaseForm, notes: e.target.value })} className="form-input" rows="2" placeholder="e.g. Regular restocking"></textarea>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowPurchaseModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={actionLoading}>
  {actionLoading ? 'Saving...' : 'Save Entry'}
</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: RECORD WASTAGE */}
 {showWastageModal && selectedItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Record Wastage / Spoilage</h3>
<button onClick={() =>setShowWastageModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleRecordWastage}>
<div className="modal-body">
<div className="form-group">
<span className="form-label">Ingredient:<strong>{selectedItem.name}</strong></span>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="wastage-qty-input" className="form-label">Quantity Wasted *</label>
<input type="number" id="wastage-qty-input" name="wastage-qty-input" required min="1" value={wastageForm.quantityWasted} onChange={(e) =>setWastageForm({ ...wastageForm, quantityWasted: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="wastage-type-select" className="form-label">Wastage Type *</label>
<select id="wastage-type-select" name="wastage-type-select" value={wastageForm.type} onChange={(e) =>setWastageForm({ ...wastageForm, type: e.target.value })} className="form-input">
<option value="Wastage">Spoiled / Expired (Wastage)</option>
<option value="Damaged">Damaged / Dropped (Damaged)</option>
</select>
</div>
</div>
<div className="form-group">
<label htmlFor="wastage-reason-input" className="form-label">Reason / Notes *</label>
<input type="text" id="wastage-reason-input" name="wastage-reason-input" required value={wastageForm.reason} onChange={(e) =>setWastageForm({ ...wastageForm, reason: e.target.value })} className="form-input" placeholder="e.g. Expired, dropped tray" />
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowWastageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={actionLoading}>
  {actionLoading ? 'Saving...' : 'Save Entry'}
</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: UPDATE MENU ITEM PRICE */}
 {showPriceModal && updatingItem &&
<div className="modal-overlay">
<div className="modal-container" style={{ maxWidth: '400px' }}>
<div className="modal-header">
<h3 className="modal-title"> Update Dish Price</h3>
<button onClick={() =>{setShowPriceModal(false);setUpdatingItem(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleUpdatePrice}>
<div className="modal-body">
<div className="form-group" style={{ marginBottom: '15px' }}>
<span className="form-label">Dish Name:<strong style={{ color: 'var(--color-text-primary)' }}>{updatingItem.name}</strong></span>
</div>
<div className="form-group">
<label htmlFor="dish-price-input" className="form-label">Price (₹) *</label>
<input type="number" step="0.01" min="0.01" id="dish-price-input" name="dish-price-input" required value={newPrice} onChange={(e) =>setNewPrice(e.target.value)} className="form-input" />
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowPriceModal(false);setUpdatingItem(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={actionLoading}>
  {actionLoading ? 'Saving...' : 'Save Price'}
</button>
</div>
</form>
</div>
</div>
 }

</div>);

};

export default ManagerDashboard;