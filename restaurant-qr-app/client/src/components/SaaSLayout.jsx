import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInventory } from '../services/api';

const SaaSLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const userRole = (user?.role || '').toLowerCase();

  useEffect(() => {
    if (user && ['admin', 'owner', 'manager'].includes(userRole)) {
      const fetchAlerts = async () => {
        try {
          const res = await getInventory();
          if (res && res.success) {
            const lowItems = res.data.filter(item => {
              const qty = item.quantity !== undefined ? item.quantity : item.stock;
              const reorder = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
              return qty <= reorder;
            });
            setLowStockAlerts(lowItems);
          }
        } catch (err) {
          console.error('Failed to fetch alerts in layout:', err);
        }
      };
      fetchAlerts();
      // Fetch every 30 seconds
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [user, userRole]);

  if (!user) return <>{children}</>;

  // Role based navigation configuration
  const getNavItems = () => {
    switch (userRole) {
      case 'super_admin':
        return [
          { label: 'Platform Stats', icon: '📊', path: '/super-admin/dashboard' },
          { label: 'Manage Cafes', icon: '🏪', path: '/super-admin/dashboard?tab=cafes' },
          { label: 'Subscription Management', icon: '💳', path: '/super-admin/dashboard?tab=subscriptions' },
          { label: 'Branch Monitoring', icon: '🏢', path: '/super-admin/dashboard?tab=branches' },
          { label: 'Support Tickets', icon: '🎫', path: '/super-admin/dashboard?tab=tickets' },
          { label: 'Revenue Monitoring', icon: '💵', path: '/super-admin/dashboard?tab=revenue' },
          { label: 'System Health', icon: '❤️', path: '/super-admin/dashboard?tab=health' },
          { label: 'Error Logs', icon: '📝', path: '/super-admin/dashboard?tab=logs' }
        ];
      case 'admin':
      case 'owner':
        return [
          { label: 'Business Stats', icon: '📈', path: '/owner/dashboard' },
          { label: 'Cafe Menu', icon: '🍽️', path: '/owner/dashboard?tab=menu' },
          { label: 'Staff Roster', icon: '👥', path: '/owner/dashboard?tab=staff' },
          { label: 'Inventory', icon: '📦', path: '/owner/dashboard?tab=inventory' },
          { label: 'Monitor Orders', icon: '👁️', path: '/owner/dashboard?tab=orders' },
          { label: 'Cafe Profile & Branches', icon: 'ℹ️', path: '/owner/profile' },
          { label: 'Settings & QR', icon: '⚙️', path: '/owner/dashboard?tab=settings' }
        ];
      case 'manager':
        return [
          { label: 'Operational Stats', icon: '💼', path: '/manager/dashboard' },
          { label: 'Order Log', icon: '📋', path: '/manager/dashboard?tab=orders' },
          { label: 'Staff Attendance', icon: '👥', path: '/manager/dashboard?tab=attendance' },
          { label: 'Ingredient Stock', icon: '📦', path: '/manager/dashboard?tab=inventory' },
          { label: 'Cafe Menu', icon: '📋', path: '/manager/dashboard?tab=menu' }
        ];
      case 'chef':
        return [
          { label: 'Active Cooking', icon: '👨‍🍳', path: '/kitchen/dashboard' },
          { label: 'Kitchen Tickets', icon: '📋', path: '/kitchen/dashboard?tab=kot' },
          { label: 'Ingredient Stock', icon: '📦', path: '/kitchen/dashboard?tab=inventory' },
          { label: 'Cafe Menu & Recipes', icon: '📋', path: '/kitchen/dashboard?tab=menu' }
        ];
      case 'waiter':
      case 'staff':
        return [
          { label: 'Live Tables', icon: '🍽️', path: '/waiter/dashboard' },
          { label: 'Customer Requests', icon: '🛎️', path: '/waiter/dashboard?tab=requests' },
          { label: 'Item Availability', icon: '📦', path: '/waiter/dashboard?tab=inventory' }
        ];
      case 'cashier':
        return [
          { label: 'Counter Billing', icon: '💳', path: '/cashier/dashboard' },
          { label: 'Receipt Logs', icon: '📝', path: '/cashier/dashboard?tab=receipts' },
          { label: 'Item Availability', icon: '📦', path: '/cashier/dashboard?tab=inventory' }
        ];
      default:
        return [];
    }
  };

  const getBottomNavItems = () => {
    switch (userRole) {
      case 'waiter':
      case 'staff':
        return [
          { label: 'Tables', icon: '🍽️', path: '/waiter/dashboard' },
          { label: 'Orders', icon: '📋', path: '/waiter/dashboard?tab=orders' },
          { label: 'Requests', icon: '🛎️', path: '/waiter/dashboard?tab=requests' },
          { label: 'Stock', icon: '📦', path: '/waiter/dashboard?tab=inventory' },
          { label: 'Profile', icon: '👤', action: 'profile' }
        ];
      case 'chef':
        return [
          { label: 'Active', icon: '👨‍🍳', path: '/kitchen/dashboard' },
          { label: 'Queue', icon: '📋', path: '/kitchen/dashboard?tab=kot' },
          { label: 'Stock', icon: '📦', path: '/kitchen/dashboard?tab=inventory' },
          { label: 'Menu', icon: '🍽️', path: '/kitchen/dashboard?tab=menu' },
          { label: 'Profile', icon: '👤', action: 'profile' }
        ];
      case 'cashier':
        return [
          { label: 'Billing', icon: '💳', path: '/cashier/dashboard' },
          { label: 'Receipts', icon: '📝', path: '/cashier/dashboard?tab=receipts' },
          { label: 'Stock', icon: '📦', path: '/cashier/dashboard?tab=inventory' },
          { label: 'Profile', icon: '👤', action: 'profile' }
        ];
      case 'admin':
      case 'owner':
        return [
          { label: 'Stats', icon: '📈', path: '/owner/dashboard' },
          { label: 'Menu', icon: '🍽️', path: '/owner/dashboard?tab=menu' },
          { label: 'Staff', icon: '👥', path: '/owner/dashboard?tab=staff' },
          { label: 'Inventory', icon: '📦', path: '/owner/dashboard?tab=inventory' },
          { label: 'Profile', icon: 'ℹ️', path: '/owner/profile' }
        ];
      case 'manager':
        return [
          { label: 'Stats', icon: '💼', path: '/manager/dashboard' },
          { label: 'Orders', icon: '📋', path: '/manager/dashboard?tab=orders' },
          { label: 'Staff', icon: '👥', path: '/manager/dashboard?tab=attendance' },
          { label: 'Stock', icon: '📦', path: '/manager/dashboard?tab=inventory' },
          { label: 'Profile', icon: '👤', action: 'profile' }
        ];
      case 'super_admin':
        return [
          { label: 'Stats', icon: '📊', path: '/super-admin/dashboard' },
          { label: 'Cafes', icon: '🏪', path: '/super-admin/dashboard?tab=cafes' },
          { label: 'Tickets', icon: '🎫', path: '/super-admin/dashboard?tab=tickets' },
          { label: 'Health', icon: '❤️', path: '/super-admin/dashboard?tab=health' },
          { label: 'Profile', icon: '👤', action: 'profile' }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatRoleLabel = (r) => {
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'admin' || r === 'owner') return 'Cafe Owner';
    return r.charAt(0).toUpperCase() + r.slice(1);
  };

  const isTabActive = (item) => {
    if (item.action === 'profile') return profileDropdownOpen;
    const currentPath = location.pathname + location.search;
    if (item.path === currentPath) return true;
    if (!location.search && item.path.split('?')[0] === location.pathname) {
      if (!item.path.includes('?')) return true;
    }
    return false;
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#121212',
      color: '#E6D5C3',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* Drawer Overlay for tablet */}
      <div className={`drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`} onClick={() => setMobileDrawerOpen(false)} />

      {/* Sidebar Drawer for tablet */}
      <aside className={`sidebar-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #2d2d2d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="mh-logo">☕</div>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>Cypher's Café</span>
          </div>
          <button className="drawer-close-btn" onClick={() => setMobileDrawerOpen(false)}>×</button>
        </div>
        <nav style={{ padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item, index) => {
            const isActive = location.pathname + location.search === item.path || 
              (location.pathname === item.path.split('?')[0] && !location.search && !item.path.includes('?'));
            return (
              <button
                key={index}
                onClick={() => {
                  navigate(item.path);
                  setMobileDrawerOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(255, 107, 8, 0.12)' : 'transparent',
                  color: isActive ? 'var(--color-primary, #ff6b08)' : '#A0826C',
                  fontSize: '14.5px',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mh-brand">
          <button className="hamburger-btn" onClick={() => setMobileDrawerOpen(true)}>
            ☰
          </button>
          <div className="mh-logo">☕</div>
          <span className="mh-name">Cypher's Café</span>
        </div>
        <div className="mh-actions">
          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button className="mh-icon-btn" onClick={() => setNotificationsOpen(!notificationsOpen)}>
              🔔
              {lowStockAlerts.length > 0 && (
                <span className="bnav-badge" style={{ top: '-4px', right: '-4px' }}>{lowStockAlerts.length}</span>
              )}
            </button>
            {notificationsOpen && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '280px',
                backgroundColor: '#1E1E1E',
                border: '1px solid #333',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '16px',
                zIndex: 700
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', color: '#fff' }}>
                  Notifications & Alerts
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {lowStockAlerts.length === 0 ? (
                    <>
                      <div style={{ padding: '6px 0', borderBottom: '1px solid #2d2d2d', color: '#bbb' }}>
                        🟢 System active and monitoring heartbeat.
                      </div>
                      <div style={{ padding: '6px 0', color: '#bbb' }}>
                        📋 Chef Dashboard synced with Kitchen Queue.
                      </div>
                    </>
                  ) : (
                    lowStockAlerts.map((item, idx) => (
                      <div key={idx} style={{ padding: '8px 0', borderBottom: idx < lowStockAlerts.length - 1 ? '1px solid #2d2d2d' : 'none', color: '#F39C12' }}>
                        ⚠️ <strong>{item.name}</strong> inventory running low ({item.quantity !== undefined ? item.quantity : item.stock} {item.unit} left, min {item.reorderLevel !== undefined ? item.reorderLevel : item.minStock} {item.unit}).
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Avatar Dropdown */}
          <div style={{ position: 'relative' }}>
            <div className="mh-avatar" onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {profileDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '180px',
                backgroundColor: '#1E1E1E',
                border: '1px solid #333',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '8px 0',
                zIndex: 700
              }}>
                <div style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: '#888',
                  borderBottom: '1px solid #2d2d2d',
                  marginBottom: '4px'
                }}>
                  {user.email}
                </div>
                {['admin', 'owner'].includes(userRole) && (
                  <button
                    onClick={() => { navigate('/owner/dashboard'); setProfileDropdownOpen(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 16px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: '#E6D5C3',
                      fontSize: '13.5px',
                      cursor: 'pointer'
                    }}
                  >
                    👤 Cafe Panel
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: '#e74c3c',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Sidebar (Hidden on Mobile/Tablet via CSS) */}
      <aside className="desktop-sidebar" style={{
        width: sidebarCollapsed ? '70px' : '260px',
        backgroundColor: '#1C1613',
        borderRight: '1px solid #2d2d2d',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 100,
        position: 'relative'
      }}>
        {/* Brand/Logo */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid #2d2d2d',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary, #ff6b08) 0%, #aa820a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0
          }}>
            ☕
          </div>
          {!sidebarCollapsed && (
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
              Cypher's Café
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '20px 10px', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item, index) => {
            const isActive = location.pathname + location.search === item.path || 
              (location.pathname === item.path.split('?')[0] && !location.search && !item.path.includes('?'));
            
            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: sidebarCollapsed ? '0' : '12px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(255, 107, 8, 0.12)' : 'transparent',
                  color: isActive ? 'var(--color-primary, #ff6b08)' : '#A0826C',
                  fontSize: '14.5px',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            border: 'none',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px',
            color: '#A0826C',
            cursor: 'pointer',
            fontSize: '14px',
            borderTop: '1px solid #2d2d2d'
          }}
        >
          {sidebarCollapsed ? '➡️' : '⬅️ Collapse Sidebar'}
        </button>
      </aside>

      {/* Main Content Pane */}
      <div className="saas-main-pane" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Desktop Top Header (Hidden on Mobile/Tablet via CSS) */}
        <header className="desktop-top-header" style={{
          height: '70px',
          backgroundColor: '#1C1613',
          borderBottom: '1px solid #2d2d2d',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 90
        }}>
          {/* Left: Branch Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              background: 'rgba(46, 204, 113, 0.12)',
              color: '#2ecc71',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>
              ● LIVE
            </span>
            {user.cafeId && (
              <span style={{ fontSize: '13.5px', color: '#A0826C', fontWeight: 600 }}>
                Cafe ID: <strong style={{ color: '#fff' }}>{user.cafeId}</strong>
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#E6D5C3',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                🔔
                {lowStockAlerts.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#e74c3c',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {lowStockAlerts.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  right: 0,
                  width: '300px',
                  backgroundColor: '#1E1E1E',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  padding: '16px',
                  zIndex: 200
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', color: '#fff' }}>
                    Notifications & Alerts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', maxHeight: '250px', overflowY: 'auto' }}>
                    {lowStockAlerts.length === 0 ? (
                      <>
                        <div style={{ padding: '6px 0', borderBottom: '1px solid #2d2d2d', color: '#bbb' }}>
                          🟢 System active and monitoring heartbeat.
                        </div>
                        <div style={{ padding: '6px 0', color: '#bbb' }}>
                          📋 Chef Dashboard synced with Kitchen Queue.
                        </div>
                      </>
                    ) : (
                      lowStockAlerts.map((item, idx) => (
                        <div key={idx} style={{ padding: '8px 0', borderBottom: idx < lowStockAlerts.length - 1 ? '1px solid #2d2d2d' : 'none', color: '#F39C12' }}>
                          ⚠️ <strong>{item.name}</strong> inventory running low ({item.quantity !== undefined ? item.quantity : item.stock} {item.unit} left, min {item.reorderLevel !== undefined ? item.reorderLevel : item.minStock} {item.unit}).
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '8px'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#3f3f3f',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: '2px solid #5C4331'
                }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>{user.name}</span>
                  <span style={{ fontSize: '11px', color: '#A0826C' }}>{formatRoleLabel(userRole)}</span>
                </div>
                <span style={{ fontSize: '10px', color: '#A0826C' }}>▼</span>
              </button>

              {profileDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  right: 0,
                  width: '180px',
                  backgroundColor: '#1E1E1E',
                  border: '1px solid #333',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  padding: '8px 0',
                  zIndex: 200
                }}>
                  <div style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    color: '#888',
                    borderBottom: '1px solid #2d2d2d',
                    marginBottom: '4px'
                  }}>
                    {user.email}
                  </div>
                  {userRole === 'admin' || userRole === 'owner' ? (
                    <button
                      onClick={() => { navigate('/owner/dashboard'); setProfileDropdownOpen(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 16px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: '#E6D5C3',
                        fontSize: '13.5px',
                        cursor: 'pointer'
                      }}
                    >
                      👤 Cafe Panel
                    </button>
                  ) : null}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 16px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: '#e74c3c',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area Container */}
        <main className="saas-content-inner" style={{ flexGrow: 1, padding: '24px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Shown only on Mobile via CSS) */}
      <nav className="bottom-nav" style={{ backgroundColor: '#FF9F00' /* custom color like in image */ }}>
        {getBottomNavItems().map((item, index) => {
          const isActive = isTabActive(item);
          return (
            <button
              key={index}
              className={`bnav-item ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: isActive ? '#fff' : '#4E3629',
                padding: '8px 0',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                if (item.action === 'profile') {
                  setProfileDropdownOpen(!profileDropdownOpen);
                } else if (item.path) {
                  navigate(item.path);
                  setProfileDropdownOpen(false);
                }
              }}
            >
              <div className="bnav-icon" style={{
                fontSize: '22px',
                marginBottom: '2px',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                borderRadius: '16px',
                padding: '4px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {item.icon}
              </div>
              <span className="bnav-label" style={{
                fontSize: '11px',
                fontWeight: isActive ? '800' : '600',
                color: isActive ? '#fff' : '#4E3629'
              }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default SaaSLayout;
