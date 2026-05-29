import React, { useEffect, useState } from 'react';
import { 
  getOrders, 
  updateOrderStatus, 
  getMenu, 
  createMenuItem, 
  updateMenuItem, 
  deleteMenuItem 
} from '../services/api';
import OrderCard from '../components/OrderCard';

const OwnerDashboard = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'menu'

  // Order dashboard states
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [refreshCountdown, setRefreshCountdown] = useState(5);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedQrTable, setSelectedQrTable] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Menu management states
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');
  
  // Modals / Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: 'Burgers',
    description: '',
    available: true,
    image: ''
  });

  const [editingItem, setEditingItem] = useState(null);

  // Unique list of categories in the database for suggestions
  const presetCategories = ['Burgers', 'Pizzas', 'Pasta', 'Drinks', 'Sandwiches', 'Desserts', 'Appetizers'];

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      const response = await getOrders();
      if (response.success) {
        setOrders(response.data);
        setOrdersError('');
      } else {
        setOrdersError('Failed to refresh orders.');
      }
    } catch (error) {
      console.error('Error fetching dashboard orders:', error);
      setOrdersError('Cannot connect to local server orders feed.');
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch menu from API
  const fetchMenu = async () => {
    setMenuLoading(true);
    try {
      const response = await getMenu();
      if (response.success) {
        setMenuItems(response.data);
        setMenuError('');
      } else {
        setMenuError('Failed to load cafe menu.');
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
      setMenuError('Cannot connect to local server menu database.');
    } finally {
      setMenuLoading(false);
    }
  };

  // Initial load + Polling effect for orders
  useEffect(() => {
    fetchOrders();
    fetchMenu(); // Also pull menu once initially

    const pollingInterval = setInterval(() => {
      if (activeTab === 'orders') {
        fetchOrders();
        setRefreshCountdown(5);
      }
    }, 5000);

    // Countdown effect for visual feedback
    const countdownInterval = setInterval(() => {
      if (activeTab === 'orders') {
        setRefreshCountdown((prev) => (prev > 1 ? prev - 1 : 5));
      }
    }, 1000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(countdownInterval);
    };
  }, [activeTab]);

  // Handle order status update
  const handleStatusUpdate = async (id, newStatus) => {
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
      console.error('Failed updating status:', error);
      alert('Error connecting to backend database.');
    }
  };

  // Menu Item: Toggle availability instantly
  const handleToggleAvailability = async (item) => {
    const updatedStatus = !item.available;
    try {
      const response = await updateMenuItem(item.id, { available: updatedStatus });
      if (response.success) {
        setMenuItems((prevItems) =>
          prevItems.map((m) =>
            m.id === item.id ? { ...m, available: updatedStatus } : m
          )
        );
      } else {
        alert('Failed to update availability status.');
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
      alert('Failed to connect to server.');
    }
  };

  // Menu Item: Delete
  const handleDeleteMenuItem = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this menu item?')) {
      try {
        const response = await deleteMenuItem(id);
        if (response.success) {
          setMenuItems((prevItems) => prevItems.filter((item) => item.id !== id));
        } else {
          alert('Failed to delete menu item.');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to connect to server.');
      }
    }
  };

  // Menu Item: Add
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price || !newItem.category || !newItem.description) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      const response = await createMenuItem(newItem);
      if (response.success) {
        setMenuItems((prevItems) => [...prevItems, response.data]);
        setShowAddModal(false);
        // Reset form
        setNewItem({
          name: '',
          price: '',
          category: 'Burgers',
          description: '',
          available: true,
          image: ''
        });
      } else {
        alert('Failed to create menu item.');
      }
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Failed to connect to server.');
    }
  };

  // Menu Item: Edit submit
  const handleEditMenuItem = async (e) => {
    e.preventDefault();
    if (!editingItem.name || !editingItem.price || !editingItem.category || !editingItem.description) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      const response = await updateMenuItem(editingItem.id, editingItem);
      if (response.success) {
        setMenuItems((prevItems) =>
          prevItems.map((m) => (m.id === editingItem.id ? response.data : m))
        );
        setShowEditModal(false);
        setEditingItem(null);
      } else {
        alert('Failed to update menu item.');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to connect to server.');
    }
  };

  // Helper to copy table URL
  const handleCopyUrl = (table) => {
    const url = `${window.location.origin}/?table=${table}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Segment orders
  const activeOrders = orders.filter((order) => order.status === 'Preparing');
  const servedOrders = orders.filter((order) => order.status === 'Served');

  const tablesList = ['1', '2', '3', '4', '5'];

  return (
    <div className="owner-dashboard" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Dashboard Style Overrides (Scoped locally as a neat React styling block) */}
      <style>{`
        .owner-dashboard {
          color: var(--color-text-primary);
        }
        .dashboard-tab-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 12px;
        }
        .dashboard-tab {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          font-family: var(--font-family);
          font-size: 16px;
          font-weight: 700;
          padding: 8px 16px;
          cursor: pointer;
          transition: var(--transition-smooth);
          position: relative;
        }
        .dashboard-tab:hover {
          color: var(--color-primary);
        }
        .dashboard-tab.active {
          color: var(--color-primary);
        }
        .dashboard-tab.active::after {
          content: '';
          position: absolute;
          bottom: -13px;
          left: 0;
          width: 100%;
          height: 3px;
          background-color: var(--color-primary);
          border-radius: 2px;
        }
        .menu-grid-admin {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .menu-grid-admin {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .admin-menu-card {
          background: var(--bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          gap: 16px;
          transition: var(--transition-smooth);
          position: relative;
        }
        .admin-menu-card:hover {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-sm);
        }
        .admin-menu-card.unavailable {
          opacity: 0.65;
          border-style: dashed;
        }
        .admin-menu-img {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-sm);
          object-fit: cover;
          background-color: var(--bg-secondary);
          flex-shrink: 0;
        }
        .admin-menu-info {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
        }
        .admin-menu-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .admin-menu-desc {
          font-size: 12.5px;
          color: var(--color-text-secondary);
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.4;
        }
        .admin-menu-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
        }
        .admin-menu-price {
          font-weight: 800;
          color: var(--color-secondary);
          font-size: 15px;
        }
        .admin-menu-badge {
          background: var(--bg-secondary);
          color: var(--color-text-secondary);
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid var(--color-border);
        }
        .admin-menu-actions {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-end;
          border-left: 1px solid var(--color-border);
          padding-left: 12px;
          flex-shrink: 0;
        }
        
        /* Premium CSS Switch Toggle */
        .switch-container {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 20px;
        }
        .switch input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #3f3f3f;
          transition: .3s;
          border-radius: 20px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--color-success);
        }
        input:focus + .slider {
          box-shadow: 0 0 1px var(--color-success);
        }
        input:checked + .slider:before {
          transform: translateX(18px);
        }

        /* Glassmorphic Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(10, 10, 10, 0.7);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.25s ease-out;
        }
        .modal-container {
          background: var(--bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          width: 100%;
          max-width: 520px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .modal-header {
          padding: 20px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 107, 8, 0.03);
        }
        .modal-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }
        .modal-close {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          font-size: 22px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .modal-close:hover {
          color: #fff;
        }
        .modal-body {
          padding: 20px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--color-border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: rgba(0, 0, 0, 0.1);
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-bottom: 6px;
        }
        .form-input {
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-family: var(--font-family);
          font-size: 14px;
          transition: var(--transition-smooth);
        }
        .form-input:focus {
          border-color: var(--color-primary);
          outline: none;
          box-shadow: 0 0 0 2px rgba(255, 107, 8, 0.15);
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
      `}</style>

      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <span className="dashboard-subtitle">Cafe Control Center</span>
          <h2 className="dashboard-title">Admin Console</h2>
        </div>
        
        {activeTab === 'orders' && (
          <div className="refresh-indicator">
            <div className="indicator-dot"></div>
            <span>Refreshing in {refreshCountdown}s</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tab-bar">
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`dashboard-tab ${activeTab === 'orders' ? 'active' : ''}`}
        >
          🍳 Live Orders Queue ({activeOrders.length})
        </button>
        <button 
          onClick={() => setActiveTab('menu')} 
          className={`dashboard-tab ${activeTab === 'menu' ? 'active' : ''}`}
        >
          📋 Manage Cafe Menu ({menuItems.length})
        </button>
      </div>

      {/* TAB 1: LIVE ORDERS QUEUE */}
      {activeTab === 'orders' && (
        <div>
          {/* QR Code Generator panel */}
          <div className="success-details" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--color-border)', padding: '16px', marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '10px', color: 'var(--color-secondary)' }}>
              📋 Table QR Codes Generator
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
              Select a table to dynamically generate its scan QR code and simulate a real customer order.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tablesList.map((table) => (
                <button
                  key={table}
                  onClick={() => setSelectedQrTable(selectedQrTable === table ? null : table)}
                  className={`category-chip ${selectedQrTable === table ? 'active' : ''}`}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}
                >
                  Table {table} QR
                </button>
              ))}
            </div>

            {/* Selected Table QR Display box */}
            {selectedQrTable && (
              <div style={{ 
                marginTop: '16px', 
                padding: '16px', 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--color-primary)', 
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                animation: 'slideUp 0.3s ease-out'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                  Scan QR for Table {selectedQrTable}
                </h4>
                <div style={{ background: 'white', padding: '10px', borderRadius: '8px', marginBottom: '12px', display: 'inline-block' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/?table=${selectedQrTable}`)}`} 
                    alt={`Table ${selectedQrTable} QR Code`}
                    style={{ width: '150px', height: '150px', display: 'block' }}
                  />
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                  Point your phone camera here, or click below to simulate the customer scanning it.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <a 
                    href={`/?table=${selectedQrTable}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', width: 'auto' }}
                  >
                    🔗 Open Menu Tab
                  </a>
                  <button
                    onClick={() => handleCopyUrl(selectedQrTable)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                  >
                    {copiedLink ? '✓ Copied!' : '📋 Copy URL'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="category-chip"
              style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--color-primary)', background: showHistory ? 'var(--color-primary)' : 'transparent', color: '#fff' }}
            >
              {showHistory ? '👁️ View Active Feed' : `📜 Served History (${servedOrders.length})`}
            </button>
          </div>

          {ordersError && (
            <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: '#fff', padding: '12px', marginBottom: '20px' }}>
              ⚠️ {ordersError} (Backend connection failed)
            </div>
          )}

          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', margin: '0 auto 20px auto', borderTopColor: 'var(--color-primary)' }}></div>
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading live orders feed...</p>
            </div>
          ) : (
            <div>
              {!showHistory ? (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
                    🍳 Active Orders in Queue ({activeOrders.length})
                  </h3>
                  
                  {activeOrders.length === 0 ? (
                    <div style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px dashed var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '15px'
                    }}>
                      🎉 All caught up! No active orders in the queue.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '20px',
                      animation: 'fadeIn 0.3s ease-out'
                    }}>
                      {activeOrders.map((order) => (
                        <OrderCard 
                          key={order._id} 
                          order={order} 
                          onStatusUpdate={handleStatusUpdate} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-success)', marginBottom: '16px' }}>
                    📜 Served Orders History ({servedOrders.length})
                  </h3>
                  
                  {servedOrders.length === 0 ? (
                    <div style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px dashed var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '15px'
                    }}>
                      No orders have been marked as served yet.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '20px',
                      animation: 'fadeIn 0.3s ease-out'
                    }}>
                      {servedOrders.map((order) => (
                        <div key={order._id} style={{ position: 'relative' }}>
                          <OrderCard 
                            order={order} 
                            onStatusUpdate={handleStatusUpdate} 
                          />
                          <button
                            onClick={() => handleStatusUpdate(order._id, 'Preparing')}
                            className="btn btn-secondary"
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              width: 'auto',
                              background: '#33271c',
                              borderColor: '#ff9800',
                              color: '#ff9800',
                              borderRadius: '4px'
                            }}
                          >
                            ↩ Undo Serve
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CAFE MENU MANAGEMENT */}
      {activeTab === 'menu' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                📋 Cafe Menu Items
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                View and manage your active cafe dishes. Add, toggle availability, edit details, or delete items.
              </p>
            </div>
            
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ width: 'auto', padding: '10px 20px', fontSize: '14px', borderRadius: 'var(--radius-sm)' }}
            >
              ➕ Add Cafe Item
            </button>
          </div>

          {menuError && (
            <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: '#fff', padding: '12px', marginBottom: '20px' }}>
              ⚠️ {menuError}
            </div>
          )}

          {menuLoading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', margin: '0 auto 20px auto', borderTopColor: 'var(--color-primary)' }}></div>
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading cafe database menu...</p>
            </div>
          ) : (
            <div>
              {menuItems.length === 0 ? (
                <div style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '15px'
                }}>
                  🍽️ Cafe menu is empty. Click "Add Cafe Item" to create your first dish!
                </div>
              ) : (
                <div className="menu-grid-admin">
                  {menuItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`admin-menu-card ${!item.available ? 'unavailable' : ''}`}
                    >
                      <img 
                        src={item.image || '/images/default-food.png'} 
                        alt={item.name} 
                        className="admin-menu-img"
                        onError={(e) => {
                          e.target.src = '/images/default-food.png';
                        }}
                      />
                      
                      <div className="admin-menu-info">
                        <div>
                          <div className="admin-menu-title" title={item.name}>{item.name}</div>
                          <div className="admin-menu-desc" title={item.description}>{item.description}</div>
                        </div>
                        
                        <div className="admin-menu-meta">
                          <span className="admin-menu-price">${parseFloat(item.price).toFixed(2)}</span>
                          <span className="admin-menu-badge">{item.category}</span>
                        </div>
                      </div>

                      <div className="admin-menu-actions">
                        {/* Availability Toggle Switch */}
                        <div className="switch-container" title={item.available ? 'In Stock' : 'Out of Stock'}>
                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={item.available} 
                              onChange={() => handleToggleAvailability(item)}
                            />
                            <span className="slider"></span>
                          </label>
                          <span style={{ color: item.available ? 'var(--color-success)' : 'var(--color-text-secondary)', fontSize: '11px' }}>
                            {item.available ? 'Active' : 'Off'}
                          </span>
                        </div>

                        {/* Edit & Delete Buttons */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <button
                            onClick={() => {
                              setEditingItem({ ...item });
                              setShowEditModal(true);
                            }}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '12px', 
                              width: 'auto', 
                              borderColor: 'var(--color-primary)', 
                              color: 'var(--color-primary)',
                              borderRadius: '4px'
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '12px', 
                              width: 'auto', 
                              borderColor: 'var(--color-danger)', 
                              color: 'var(--color-danger)',
                              borderRadius: '4px',
                              background: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = 'var(--color-danger-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD NEW MENU ITEM */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">➕ Add New Cafe Item</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close">&times;</button>
            </div>
            
            <form onSubmit={handleAddMenuItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Dish Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Gourmet Double Cheeseburger"
                    value={newItem.name} 
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="form-input" 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price ($) *</label>
                    <input 
                      type="number" 
                      required 
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 12.99"
                      value={newItem.price} 
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      className="form-input" 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="form-input"
                    >
                      {presetCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Image Path / URL (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /images/burger.png"
                    value={newItem.image} 
                    onChange={(e) => setNewItem({ ...newItem, image: e.target.value })}
                    className="form-input" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea 
                    required 
                    rows="3"
                    placeholder="Detail the ingredients, preparation, and flavors of this premium cafe item..."
                    value={newItem.description} 
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  ></textarea>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', padding: '10px 18px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: 'auto', padding: '10px 24px' }}
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MENU ITEM */}
      {showEditModal && editingItem && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Cafe Item</h3>
              <button onClick={() => {
                setShowEditModal(false);
                setEditingItem(null);
              }} className="modal-close">&times;</button>
            </div>
            
            <form onSubmit={handleEditMenuItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Dish Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={editingItem.name} 
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="form-input" 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price ($) *</label>
                    <input 
                      type="number" 
                      required 
                      step="0.01"
                      min="0.01"
                      value={editingItem.price} 
                      onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                      className="form-input" 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      className="form-input"
                    >
                      {presetCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Image Path / URL (Optional)</label>
                  <input 
                    type="text" 
                    value={editingItem.image || ''} 
                    onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value })}
                    className="form-input" 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea 
                    required 
                    rows="3"
                    value={editingItem.description} 
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  ></textarea>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }} 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', padding: '10px 18px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: 'auto', padding: '10px 24px' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerDashboard;
