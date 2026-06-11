import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { getOrders, updateOrderStatus, getInventory } from '../services/api';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import '../styles/App.css';

const WaiterDashboard = () => {
  const { logout, user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => {
    return tabParam || 'tables';
  });
  
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('tables');
    }
  }, [tabParam]);

  const fetchInventory = async () => {
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

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventory();
    }
  }, [activeTab]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshCountdown, setRefreshCountdown] = useState(5);
  
  // Custom interactive mock elements for premium aesthetics
  const [tables, setTables] = useState([
    { id: 1, label: 'Table 1', status: 'occupied', customers: 3 },
    { id: 2, label: 'Table 2', status: 'free', customers: 0 },
    { id: 3, label: 'Table 3', status: 'dirty', customers: 0 },
    { id: 4, label: 'Table 4', status: 'occupied', customers: 2 },
    { id: 5, label: 'Table 5', status: 'free', customers: 0 }
  ]);
  const [assistanceRequests, setAssistanceRequests] = useState([
    { id: 101, table: '3', request: 'Wants to order custom drinks', time: '2 mins ago' },
    { id: 102, table: '1', request: 'Requested drinking water', time: 'Just now' }
  ]);

  const fetchOrders = async () => {
    try {
      const response = await getOrders();
      if (response.success) {
        const cafeOrders = user?.cafeId 
          ? response.data.filter(order => !order.cafeId || order.cafeId === user.cafeId)
          : response.data;
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

  useEffect(() => {
    fetchOrders();

    const pollingInterval = setInterval(() => {
      fetchOrders();
      setRefreshCountdown(5);
    }, 5000);

    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => (prev > 1 ? prev - 1 : 5));
    }, 1000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
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

  const handleMarkPaid = async (id) => {
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

  const toggleTableStatus = (id) => {
    setTables(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'free' ? 'occupied' : t.status === 'occupied' ? 'dirty' : 'free';
        const nextCustomers = nextStatus === 'occupied' ? 2 : 0;
        return { ...t, status: nextStatus, customers: nextCustomers };
      }
      return t;
    }));
  };

  const resolveRequest = (id) => {
    setAssistanceRequests(prev => prev.filter(r => r.id !== id));
  };

  const pendingCooking = orders.filter(o => o.status === 'Placed' || o.status === 'Preparing');
  const readyForService = orders.filter(o => o.status === 'Ready');
  const pendingCashPayments = orders.filter(o => o.paymentStatus === 'Pending' && o.paymentMethod === 'Counter');

  const renderOrderPipeline = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {/* Pending Cash Payments Column */}
        {pendingCashPayments.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ color: '#ff9800', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 152, 0, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
              💵 Pending Cash Payments ({pendingCashPayments.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingCashPayments.map(order => (
                <div key={order._id} style={{
                  background: 'rgba(255, 152, 0, 0.05)',
                  border: '2px dashed #ff9800',
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
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Table {order.tableNumber}</strong>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: '#fff',
                        background: '#e67e22',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        boxShadow: '0 0 6px rgba(230,126,34,0.5)'
                      }}>
                        🛎️ Cash Payment Requested
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '4px' }}>
                      Order #{order._id.substring(order._id.length - 4).toUpperCase()} | Total: <strong style={{ color: '#2ecc71' }}>₹{order.totalAmount}</strong>
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#fff', display: 'block', marginTop: '2px' }}>
                      {order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => printPOSReceipt(order)}
                      className="touch-btn"
                      style={{
                        background: '#2980B9',
                        color: '#fff',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: 'none',
                        minHeight: '44px'
                      }}
                    >
                      🖨️ Bill
                    </button>
                    <button
                      onClick={() => handleMarkPaid(order._id)}
                      className="touch-btn"
                      style={{
                        background: '#27AE60',
                        color: '#fff',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: 'none',
                        minHeight: '44px'
                      }}
                    >
                      💵 Payment Completed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ready for Service Column */}
        <div>
          <h3 style={{ color: '#27AE60', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(39, 174, 96, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
            🛎️ Prepared & Ready to Serve ({readyForService.length})
          </h3>
          
          {readyForService.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '10px 0' }}>No orders currently waiting to be delivered.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {readyForService.map(order => (
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
                      <strong style={{ color: '#fff', fontSize: '0.9rem' }}>Table {order.tableNumber}</strong>
                      {order.paymentMethod === 'Counter' && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#fff',
                          background: '#e67e22',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          boxShadow: '0 0 6px rgba(230,126,34,0.5)'
                        }}>
                          🛎️ Cash Payment Requested
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '3px' }}>
                      Order #{order._id.substring(order._id.length - 4).toUpperCase()} | {order.items.length} items
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => printKOT(order)}
                      className="touch-btn"
                      style={{
                        background: '#34495E',
                        color: '#fff',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: 'none',
                        minHeight: '44px'
                      }}
                    >
                      🖨️ KOT
                    </button>
                    <button
                      onClick={() => printPOSReceipt(order)}
                      className="touch-btn"
                      style={{
                        background: '#2980B9',
                        color: '#fff',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: 'none',
                        minHeight: '44px'
                      }}
                    >
                      🖨️ POS
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(order._id, 'Delivered')}
                      className="touch-btn"
                      style={{
                        background: '#27AE60',
                        color: '#fff',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: 'none',
                        minHeight: '44px'
                      }}
                    >
                      ✓ Serve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cooking in Kitchen Column */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ color: '#ff9800', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 152, 0, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
            🍳 Currently Cooking in Kitchen ({pendingCooking.length})
          </h3>
          
          {pendingCooking.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem', padding: '10px 0' }}>No orders currently being cooked.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingCooking.map(order => (
                <div key={order._id} style={{
                  background: 'rgba(255,255,255,0.01)',
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
                      <strong style={{ color: '#E6D5C3', fontSize: '0.9rem' }}>Table {order.tableNumber}</strong>
                      {order.paymentMethod === 'Counter' && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: '#fff',
                          background: '#e67e22',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          🛎️ Cash
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '3px' }}>
                      Order #{order._id.substring(order._id.length - 4).toUpperCase()} | Status: {order.status === 'Placed' ? 'Placed' : 'Preparing...'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => printKOT(order)}
                      className="touch-btn"
                      style={{
                        background: '#34495E',
                        color: '#fff',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        border: 'none',
                        minHeight: '44px'
                      }}
                    >
                      🖨️ KOT
                    </button>
                    <span style={{ fontSize: '0.75rem', color: order.status === 'Placed' ? '#3498db' : '#ff9800', fontWeight: 'bold' }}>
                      {order.status === 'Placed' ? '⏳ Placed' : '🍳 Preparing'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            🏃‍♂️ Waiter Station & Service Desk
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Manage tables, handle assistance calls, and serve food orders.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            Refresh in: <strong style={{ color: 'var(--color-primary)' }}>{refreshCountdown}s</strong>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--color-danger-bg)',
          borderLeft: '4px solid var(--color-danger)',
          color: '#fff',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {activeTab === 'inventory' ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.2rem', fontWeight: 800 }}>📦 Ingredient Stockroom & Availability (Read-Only)</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
            Live stock levels of raw materials and ingredients. Out of stock ingredients are automatically updated. Editing is restricted to Managers and Cafe Owners.
          </p>
          {inventoryLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading ingredient stock levels...</p>
            </div>
          ) : inventory.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No ingredients found in stockroom.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {inventory.map(item => {
                const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
                const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
                const isLow = qtyVal <= reorderVal;
                
                let statusColor = '#2ECC71';
                if (qtyVal <= 0) statusColor = '#E74C3C';
                else if (isLow) statusColor = '#F39C12';

                return (
                  <div 
                    key={item._id}
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: `1px solid ${isLow ? '#E74C3C' : 'var(--color-border)'}`,
                      padding: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{item.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                        Current Stock: <span style={{ color: isLow ? '#E74C3C' : '#fff', fontWeight: 'bold' }}>{qtyVal} {item.unit}</span> | Safety Min: {reorderVal} {item.unit}
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
                        {qtyVal <= 0 ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'IN_STOCK'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Connecting to waiter service feed...</p>
        </div>
      ) : activeTab === 'requests' ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.2rem', fontWeight: 700 }}>
            🔔 Assistance Requests ({assistanceRequests.length})
          </h3>
          
          {assistanceRequests.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>No pending requests.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assistanceRequests.map(req => (
                <div key={req.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong style={{ color: '#ff9800', fontSize: '0.9rem' }}>Table {req.table}</strong>
                    <p style={{ margin: '3px 0 0 0', color: '#E6D5C3', fontSize: '0.85rem' }}>{req.request}</p>
                    <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>{req.time}</span>
                  </div>
                  <button
                    onClick={() => resolveRequest(req.id)}
                    className="touch-btn"
                    style={{
                      background: '#27AE60',
                      color: '#fff',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      border: 'none'
                    }}
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'orders' ? (
        /* Mobile Dedicated Order Pipeline Tab */
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
          <h2 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 800 }}>
            📋 Live Order Pipeline
          </h2>
          {renderOrderPipeline()}
        </div>
      ) : (
        /* activeTab === 'tables' */
        <div>
          {/* Mobile Layout: Stacked view of tables status */}
          <div className="mobile-only-tables" style={{ display: 'none' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 700 }}>
                🍽️ Dining Tables Status (Tap to Cycle)
              </h3>
              <div className="table-card-grid">
                {tables.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => toggleTableStatus(t.id)}
                    style={{
                      background: t.status === 'free' ? 'rgba(39, 174, 96, 0.1)' : t.status === 'occupied' ? 'rgba(230, 126, 34, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                      border: `1px solid ${t.status === 'free' ? '#27AE60' : t.status === 'occupied' ? '#E67E22' : '#E74C3C'}`,
                      padding: '16px 8px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      minHeight: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <strong style={{ display: 'block', color: '#fff', fontSize: '1rem' }}>{t.label}</strong>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: t.status === 'free' ? '#2ecc71' : t.status === 'occupied' ? '#f39c12' : '#e74c3c',
                      textTransform: 'uppercase',
                      fontWeight: 'bold',
                      display: 'block',
                      marginTop: '4px'
                    }}>
                      {t.status}
                    </span>
                    {t.customers > 0 && <span style={{ fontSize: '0.75rem', color: '#A0826C', marginTop: '2px' }}>👤 {t.customers} guests</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop/Tablet Layout: Split Grid View */}
          <div className="desktop-tablet-tables" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '30px' }}>
            {/* Left Side: Tables Status & Requests */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 700 }}>
                  🍽️ Dining Tables Status (Click to Cycle)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '10px' }}>
                  {tables.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => toggleTableStatus(t.id)}
                      style={{
                        background: t.status === 'free' ? 'rgba(39, 174, 96, 0.1)' : t.status === 'occupied' ? 'rgba(230, 126, 34, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                        border: `1px solid ${t.status === 'free' ? '#27AE60' : t.status === 'occupied' ? '#E67E22' : '#E74C3C'}`,
                        padding: '12px 6px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.1s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <strong style={{ display: 'block', color: '#fff', fontSize: '0.9rem' }}>{t.label}</strong>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        color: t.status === 'free' ? '#2ecc71' : t.status === 'occupied' ? '#f39c12' : '#e74c3c',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        display: 'block',
                        marginTop: '4px'
                      }}>
                        {t.status}
                      </span>
                      {t.customers > 0 && <span style={{ fontSize: '0.7rem', color: '#A0826C' }}>👤 {t.customers} guests</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Requests box */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 700 }}>
                  🔔 Assistance Requests ({assistanceRequests.length})
                </h3>
                {assistanceRequests.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.85rem' }}>No pending requests.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {assistanceRequests.map(req => (
                      <div key={req.id} style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <strong style={{ color: '#ff9800', fontSize: '0.85rem' }}>Table {req.table}</strong>
                          <p style={{ margin: '3px 0 0 0', color: '#E6D5C3', fontSize: '0.8rem' }}>{req.request}</p>
                          <span style={{ fontSize: '0.7rem', color: '#A0826C' }}>{req.time}</span>
                        </div>
                        <button
                          onClick={() => resolveRequest(req.id)}
                          style={{
                            background: '#27AE60',
                            color: '#fff',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Order Pipeline */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '12px' }}>
              <h2 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 800 }}>
                📋 Live Order Pipeline
              </h2>
              {renderOrderPipeline()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaiterDashboard;
