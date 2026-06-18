import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInventory, getCafeInfo } from '../services/api';
import { useTheme } from '../hooks/useTheme';

const SaaSLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const notificationRef = useRef(null);
  const bellButtonRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return window.innerWidth >= 768 && window.innerWidth < 1024;
  });
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const userRole = (user?.role || '').toLowerCase();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {


        // Mobile
      } else if (window.innerWidth < 1024) {setSidebarCollapsed(true);} else {
        setSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [cafeInfo, setCafeInfo] = useState(null);

  useEffect(() => {
    if (user?.cafeId) {
      const fetchCafe = async () => {
        try {
          const res = await getCafeInfo(user.cafeId);
          if (res.success) {
            setCafeInfo(res.data);
          }
        } catch (err) {
          console.error('Error fetching cafe info in SaaSLayout:', err);
        }
      };
      fetchCafe();
    }
  }, [user?.cafeId]);

  useEffect(() => {
    if (user && ['admin', 'owner', 'manager'].includes(userRole)) {
      const fetchAlerts = async () => {
        try {
          const res = await getInventory();
          if (res && res.success) {
            const lowItems = res.data.filter((item) => {
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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        notificationsOpen &&
        notificationRef.current &&
        !notificationRef.current.contains(e.target) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target)
      ) {
        setNotificationsOpen(false);
      }
      if (profileDropdownOpen && !e.target.closest('.profile-dropdown-container')) {
        setProfileDropdownOpen(false);
      }
      if (themeMenuOpen && !e.target.closest('.theme-dropdown-container')) {
        setThemeMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setProfileDropdownOpen(false);
        setNotificationsOpen(false);
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen, profileDropdownOpen, themeMenuOpen]);

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileDropdownOpen(false);
    setMoreMenuOpen(false);
    setMobileDrawerOpen(false);
    setThemeMenuOpen(false);
  }, [location]);

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
        { label: 'Error Logs', icon: '📝', path: '/super-admin/dashboard?tab=logs' }];

      case 'admin':
      case 'owner':
        return [
        { label: 'Business Stats', icon: '📈', path: '/owner/dashboard' },
        { label: 'Menu & Reviews', icon: '🍽️', path: '/owner/dashboard?tab=menu' },
        { label: 'Staff & Reports', icon: '👥', path: '/owner/dashboard?tab=staff' },
        { label: 'Inventory', icon: '📦', path: '/owner/dashboard?tab=inventory' },
        { label: 'Monitor Orders', icon: '👁️', path: '/owner/dashboard?tab=orders' }];

      case 'manager':
        return [
        { label: 'Operational Stats', icon: '💼', path: '/manager/dashboard' },
        { label: 'Order Log', icon: '📋', path: '/manager/dashboard?tab=orders' },
        { label: 'Staff Attendance', icon: '👥', path: '/manager/dashboard?tab=attendance' },
        { label: 'Ingredient Stock', icon: '📦', path: '/manager/dashboard?tab=inventory' },
        { label: 'Cafe Menu', icon: '📋', path: '/manager/dashboard?tab=menu' }];

      case 'chef':
        return [
        { label: 'Active Cooking', icon: '👨‍🍳', path: '/kitchen/dashboard' },
        { label: 'Kitchen Tickets', icon: '📋', path: '/kitchen/dashboard?tab=kot' },
        { label: 'Ingredient Stock', icon: '📦', path: '/kitchen/dashboard?tab=inventory' },
        { label: 'Cafe Menu & Recipes', icon: '📋', path: '/kitchen/dashboard?tab=menu' },
        { label: 'My Attendance', icon: '⏰', path: '/staff/attendance' },
        { label: 'Submit Work Report', icon: '📝', path: '/staff/attendance?tab=report' }];

      case 'waiter':
      case 'staff':
        return [
        { label: 'Live Orders', icon: '🛍️', path: '/waiter/dashboard' },
        { label: 'My Attendance', icon: '⏰', path: '/staff/attendance' },
        { label: 'Submit Work Report', icon: '📝', path: '/staff/attendance?tab=report' }];

      case 'cashier':
        return [
        { label: 'Counter Billing', icon: '💳', path: '/cashier/dashboard' },
        { label: 'Receipt Logs', icon: '📝', path: '/cashier/dashboard?tab=receipts' },
        { label: 'Item Availability', icon: '📦', path: '/cashier/dashboard?tab=inventory' },
        { label: 'My Attendance', icon: '⏰', path: '/staff/attendance' },
        { label: 'Submit Work Report', icon: '📝', path: '/staff/attendance?tab=report' }];

      default:
        return [];
    }
  };

  const getHeaderInfo = () => {
    const search = location.search;
    const pathname = location.pathname;

    if (pathname.includes('/owner/profile')) {
      return { title: 'Settings & Profile', subtitle: 'Manage restaurant details and branches' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }
    
    if (pathname.includes('/owner/dashboard')) {
      if (search.includes('tab=menu')) return { title: 'Menu & Reviews', subtitle: 'Configure cafe menu items and feedback' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
      if (search.includes('tab=staff')) return { title: 'Staff & Reports', subtitle: 'Manage employee shifts and activity logs' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
      if (search.includes('tab=inventory')) return { title: 'Inventory Control', subtitle: 'Track ingredients, suppliers, and waste' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
      if (search.includes('tab=orders')) return { title: 'Order Monitor', subtitle: 'Track live orders and billing receipts' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
      return { title: 'Business Stats', subtitle: `Overview of ${cafeInfo?.name || 'Cafe'} performance` + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }

    if (pathname.includes('/super-admin/dashboard')) {
      if (search.includes('tab=cafes')) return { title: 'Manage Cafes', subtitle: 'Supervise cafe setup and activations' };
      if (search.includes('tab=subscriptions')) return { title: 'Subscriptions', subtitle: 'Manage platform subscription tiers' };
      if (search.includes('tab=branches')) return { title: 'Branch Monitoring', subtitle: 'Oversee cafe branches and coverage' };
      if (search.includes('tab=tickets')) return { title: 'Support Center', subtitle: 'Resolve platform support queries' };
      if (search.includes('tab=revenue')) return { title: 'Revenue Metrics', subtitle: 'Analyze commissions and transactions' };
      if (search.includes('tab=health')) return { title: 'System Diagnostics', subtitle: 'Monitor server and database health' };
      if (search.includes('tab=logs')) return { title: 'Platform Logfiles', subtitle: 'System audit logs and error diagnostics' };
      return { title: 'Platform Stats', subtitle: 'Overall system health and billing insights' };
    }

    if (pathname.includes('/manager/dashboard')) {
      return { title: 'Operational Stats', subtitle: 'Oversee cafe operations, attendance, and stock' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }

    if (pathname.includes('/kitchen/dashboard')) {
      return { title: 'Active Cooking', subtitle: 'Manage active tickets and recipe stock' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }

    if (pathname.includes('/waiter/dashboard')) {
      return { title: 'Live Orders', subtitle: 'Track active tables and serve status' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }

    if (pathname.includes('/cashier/dashboard')) {
      return { title: 'Counter Billing', subtitle: 'Execute counter billing and receipt logs' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }

    if (pathname.includes('/staff/attendance')) {
      return { title: 'My Attendance', subtitle: 'Submit shift report and view logs' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
    }

    return { title: cafeInfo?.name || 'Smart Cafe', subtitle: 'Welcome to the Dashboard' + (user?.cafeId ? ` · Cafe ID: ${user.cafeId}` : '') };
  };

  const getMobileNavConfig = () => {
    const allItems = getNavItems();
    let primary = [];
    let remaining = [];

    switch (userRole) {
      case 'super_admin':
        primary = allItems.filter((item) =>
        ['Platform Stats', 'Manage Cafes', 'Subscription Management', 'Support Tickets'].includes(item.label)
        );
        remaining = allItems.filter((item) => !primary.includes(item));
        break;

      case 'admin':
      case 'owner':
        primary = allItems.filter((item) =>
        ['Business Stats', 'Monitor Orders', 'Menu & Reviews', 'Inventory'].includes(item.label)
        );
        remaining = allItems.filter((item) => !primary.includes(item));
        break;

      case 'manager':
        primary = allItems.filter((item) =>
        ['Operational Stats', 'Order Log', 'Staff Attendance'].includes(item.label)
        );
        primary.push({ label: 'My Attendance', icon: '⏰', path: '/staff/attendance' });
        remaining = allItems.filter((item) => !['Operational Stats', 'Order Log', 'Staff Attendance'].includes(item.label));
        break;

      case 'chef':
        primary = allItems.filter((item) =>
        ['Active Cooking', 'Kitchen Tickets', 'My Attendance', 'Submit Work Report'].includes(item.label)
        );
        remaining = allItems.filter((item) => !primary.includes(item));
        break;

      case 'waiter':
      case 'staff':
        primary = allItems.filter((item) =>
        ['Live Orders', 'My Attendance', 'Submit Work Report'].includes(item.label)
        );
        remaining = allItems.filter((item) => !primary.includes(item));
        break;

      case 'cashier':
        primary = allItems.filter((item) =>
        ['Counter Billing', 'Receipt Logs', 'My Attendance', 'Submit Work Report'].includes(item.label)
        );
        remaining = allItems.filter((item) => !primary.includes(item));
        break;

      default:
        primary = allItems.slice(0, 4);
        remaining = allItems.slice(4);
    }

    return { primary, remaining };
  };

  const getBottomBarLabel = (label) => {
    switch (label) {
      case 'Platform Stats':
      case 'Business Stats':
      case 'Operational Stats':
      case 'Live Tables':
      case 'Active Cooking':
      case 'Counter Billing':
        return 'Dashboard';
      case 'Monitor Orders':
      case 'Customer Requests':
      case 'Kitchen Tickets':
      case 'Receipt Logs':
      case 'Order Log':
      case 'Live Orders':
        return 'Orders';
      case 'Cafe Menu':
      case 'Cafe Menu & Recipes':
        return 'Menu';
      case 'Inventory':
      case 'Ingredient Stock':
        return 'Inventory';
      case 'My Attendance':
        return 'Attendance';
      case 'Submit Work Report':
        return 'Work Reports';
      case 'Staff Attendance':
      case 'Staff Roster':
      case 'Staff & Reports':
        return 'Staff';
      case 'Manage Cafes':
        return 'Cafes';
      case 'Subscription Management':
        return 'Subscriptions';
      case 'Support Tickets':
        return 'Support';
      case 'Menu & Reviews':
        return 'Menu';
      default:
        return label;
    }
  };

  const renderSvgIcon = (label, isActive) => {
    const strokeColor = isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
    const defaultStyle = {
      width: '22px',
      height: '22px',
      stroke: 'currentColor',
      strokeWidth: 2.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fill: 'none',
      style: {
        color: strokeColor,
        transition: 'color 0.2s ease'
      }
    };
    const l = label.toLowerCase();

    if (l.includes('stats') || l.includes('monitoring') || l.includes('revenue') || l.includes('health')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>);

    }
    if (l.includes('menu') || l.includes('dish') || l.includes('review')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>);

    }
    if (l.includes('staff') || l.includes('roster') || l.includes('attendance')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>);

    }
    if (l.includes('inventory') || l.includes('stock') || l.includes('availability')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
          <polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon>
          <polygon points="12 22.08 12 12 21 6.92 21 17.08 12 22.08"></polygon>
          <polygon points="12 12 3 6.92 12 1.84 21 6.92 12 12"></polygon>
        </svg>);

    }
    if (l.includes('report') || l.includes('log') || l.includes('receipt') || l.includes('ticket')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>);

    }
    if (l.includes('order') || l.includes('cooking') || l.includes('billing') || l.includes('request')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>);

    }
    if (l.includes('profile') || l.includes('settings') || l.includes('qr') || l.includes('cafe') || l.includes('branch')) {
      return (
        <svg {...defaultStyle} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>);

    }
    return null;
  };

  const isPathActive = (path) => {
    if (!path) return false;
    const currentFullPath = location.pathname + location.search;

    if (currentFullPath === path) return true;

    const getBaseAndTab = (urlStr) => {
      const parts = urlStr.split('?');
      const base = parts[0];
      const query = parts[1] || '';
      const tabMatch = query.match(/(?:^|[?&])tab=([^&]+)/);
      const tab = tabMatch ? tabMatch[1] : null;
      return { base, tab };
    };

    const currentInfo = getBaseAndTab(currentFullPath);
    const itemInfo = getBaseAndTab(path);

    if (currentInfo.base === itemInfo.base) {
      if (itemInfo.tab || currentInfo.tab) {
        return itemInfo.tab === currentInfo.tab;
      }
      return true;
    }

    return false;
  };

  const navItems = getNavItems();
  const { primary: primaryMobileItems, remaining: remainingMobileItems } = getMobileNavConfig();

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const handleProfileClick = (e) => {
    e.stopPropagation();
    setProfileDropdownOpen(prev => !prev);
  };

  const formatRoleLabel = (r) => {
    if (!r) return 'Staff';
    const cleanRole = r.toLowerCase();
    if (cleanRole === 'super_admin') return 'Super Admin';
    if (cleanRole === 'admin' || cleanRole === 'owner') return 'Cafe Owner';
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1);
  };

  const renderProfileDropdown = () => {
    if (!profileDropdownOpen) return null;

    const displayOwnerName = cafeInfo?.ownerName || (['admin', 'owner'].includes(userRole) ? user.name : 'Kamala Bevara');
    const firstLetter = cafeInfo?.name ? cafeInfo.name.charAt(0).toUpperCase() : '☕';

    return (
      <>
        {/* Transparent backdrop overlay */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setProfileDropdownOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'transparent',
            cursor: 'default'
          }} 
        />
        <div 
          className="profile-dropdown-card"
          onClick={(e) => e.stopPropagation()} // Prevent event bubbling inside dropdown
          style={{ zIndex: 1000 }}
        >
          {/* Header Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '20px',
            gap: '14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '18px'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: 'rgba(194, 125, 95, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-primary)',
              flexShrink: 0
            }}>
              {cafeInfo?.logoUrl ? (
                <img src={cafeInfo.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  {firstLetter}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              <span className="dropdown-title" style={{ fontSize: '14.5px', fontWeight: 800, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }} title={cafeInfo?.name}>
                {cafeInfo?.name || "Smart Cafe"}
              </span>
              <span className="dropdown-subtitle" style={{ fontSize: '11px', fontWeight: 650, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                Cafe ID: {user.cafeId || 'N/A'}
              </span>
              <span className="dropdown-title" style={{ fontSize: '13px', fontWeight: 700, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                Owner: {displayOwnerName}
              </span>
              <span className="dropdown-subtitle" style={{ fontSize: '11.5px', fontWeight: 500, marginTop: '1px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {user.email}
              </span>
              <span className="dropdown-subtitle" style={{ 
                alignSelf: 'flex-start',
                fontSize: '9.5px', 
                fontWeight: 750, 
                color: 'var(--color-primary)', 
                backgroundColor: 'rgba(194, 125, 95, 0.12)', 
                padding: '2px 8px', 
                borderRadius: '12px',
                marginTop: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {formatRoleLabel(userRole)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => {
                setProfileDropdownOpen(false);
                if (['admin', 'owner'].includes(userRole)) {
                  navigate('/owner/profile');
                } else {
                  navigate('/staff/attendance');
                }
              }}
              className="dropdown-action-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Settings & Profile
            </button>

            <button
              onClick={handleLogout}
              className="dropdown-action-btn-danger"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Logout
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--color-text-primary)',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* Drawer Overlay for tablet */}
      <div className={`drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`} onClick={() => setMobileDrawerOpen(false)} />

      {/* Sidebar Drawer for tablet */}
      <aside className={`sidebar-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="mh-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cafeInfo?.logoUrl ? <img src={cafeInfo.logoUrl} alt="logo" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} /> : '☕'}
            </div>
            <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{cafeInfo?.name || "Cypher's Café"}</span>
          </div>
          <button className="drawer-close-btn" onClick={() => setMobileDrawerOpen(false)}>×</button>
        </div>
        <nav style={{ padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {navItems.map((item, index) => {
            const isActive = isPathActive(item.path);
            return (
              <button
                key={index}
                onClick={() => {
                  navigate(item.path);
                  setMobileDrawerOpen(false);
                }}
                className={`sidebar-menu-btn ${isActive ? 'active' : ''}`}
              >
                <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderSvgIcon(item.label, isActive) || item.icon}
                </span>
                <span>{item.label}</span>
              </button>);

          })}
        </nav>
        
      </aside>

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mh-brand">
          <button className="hamburger-btn" onClick={() => setMobileDrawerOpen(true)}>
            ☰
          </button>
          <div className="mh-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cafeInfo?.logoUrl ? <img src={cafeInfo.logoUrl} alt="logo" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} /> : '☕'}
          </div>
          <span className="mh-name">{cafeInfo?.name || "Cypher's Café"}</span>
        </div>
        <div className="mh-actions">
          {/* Theme Dropdown Toggle */}
          <div className="theme-dropdown-container" style={{ position: 'relative' }}>
            <button
              className="mh-icon-btn"
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              title="Change Theme"
              style={{ background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)' }}
            >
              {theme === 'light' ? '🌞' : theme === 'dark' ? '🌙' : '💻'}
            </button>
            {themeMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '150px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                padding: '4px 0',
                zIndex: 700
              }}>
                <button
                  onClick={() => { setTheme('light'); setThemeMenuOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    background: theme === 'light' ? 'rgba(212, 144, 115, 0.15)' : 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: theme === 'light' ? 'bold' : 'normal'
                  }}
                >
                  <span>🌞</span> Light Mode
                </button>
                <button
                  onClick={() => { setTheme('dark'); setThemeMenuOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    background: theme === 'dark' ? 'rgba(212, 144, 115, 0.15)' : 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: theme === 'dark' ? 'bold' : 'normal'
                  }}
                >
                  <span>🌙</span> Dark Mode
                </button>
                <button
                  onClick={() => { setTheme('system'); setThemeMenuOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    background: theme === 'system' ? 'rgba(212, 144, 115, 0.15)' : 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: theme === 'system' ? 'bold' : 'normal'
                  }}
                >
                  <span>💻</span> System Default
                </button>
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button ref={bellButtonRef} className="mh-icon-btn" onClick={() => setNotificationsOpen(!notificationsOpen)}>
              🔔
              {lowStockAlerts.length > 0 &&
              <span className="bnav-badge" style={{ top: '-4px', right: '-4px' }}>{lowStockAlerts.length}</span>
              }
            </button>
            {notificationsOpen &&
            <div ref={notificationRef} style={{
              position: 'absolute',
              top: '50px',
              right: 0,
              width: '280px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              padding: '16px',
              zIndex: 700
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', color: 'var(--color-text-primary)' }}>
                  Notifications & Alerts
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {lowStockAlerts.length === 0 ?
                <>
                      <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--color-text-secondary)' }}>
                        🟢 System active and monitoring heartbeat.
                      </div>
                      <div style={{ padding: '6px 0', color: 'var(--color-text-secondary)' }}>
                        📋 Chef Dashboard synced with Kitchen Queue.
                      </div>
                    </> :

                lowStockAlerts.map((item, idx) =>
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < lowStockAlerts.length - 1 ? '1px solid var(--border-color)' : 'none', color: '#F39C12' }}>
                        ⚠️ <strong>{item.name}</strong> inventory running low ({item.quantity !== undefined ? item.quantity : item.stock} {item.unit} left, min {item.reorderLevel !== undefined ? item.reorderLevel : item.minStock} {item.unit}).
                      </div>
                )
                }
                </div>
              </div>
            }
          </div>
          {/* Avatar Dropdown */}
          <div className="profile-dropdown-container" style={{ position: 'relative' }}>
            <div className="mh-avatar" onClick={handleProfileClick}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {renderProfileDropdown()}
          </div>
        </div>
      </header>

      {/* Desktop Sidebar (Hidden on Mobile/Tablet via CSS) */}
      <aside className="desktop-sidebar" style={{
        width: sidebarCollapsed ? '70px' : '260px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 100
      }}>
        {/* Brand/Logo Header (Fixed) */}
        <div style={{
          padding: sidebarCollapsed ? '20px 8px' : '20px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: sidebarCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          gap: sidebarCollapsed ? '12px' : '0',
          flexShrink: 0,
          minHeight: '70px',
          overflow: 'hidden'
        }}>
          {/* Logo and Name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--bg-card-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0
            }}>
              {cafeInfo?.logoUrl ? (
                <img src={cafeInfo.logoUrl} alt="logo" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                  <line x1="6" y1="1" x2="6" y2="4"></line>
                  <line x1="10" y1="1" x2="10" y2="4"></line>
                  <line x1="14" y1="1" x2="14" y2="4"></line>
                </svg>
              )}
            </div>
            {!sidebarCollapsed &&
            <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--color-text-primary)', letterSpacing: '-0.5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={cafeInfo?.name}>
                {cafeInfo?.name || "Cypher's Café"}
              </span>
            }
          </div>

          {/* Toggle Control */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Menu" : "Hide Menu"}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: sidebarCollapsed ? '32px' : '28px',
              height: sidebarCollapsed ? '32px' : '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(0, 0, 0, 0.04)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}>
            
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <nav style={{
          padding: '20px 10px',
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflowY: 'auto'
        }}>
          {navItems.map((item, index) => {
            const isActive = isPathActive(item.path);

            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                title={sidebarCollapsed ? item.label : ''}
                className={`sidebar-menu-btn ${isActive ? 'active' : ''}`}
                style={{
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: sidebarCollapsed ? '0' : '12px'
                }}
              >
                <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderSvgIcon(item.label, isActive) || item.icon}
                </span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>);

          })}
        </nav>
      </aside>

      {/* Main Content Pane */}
      <div className="saas-main-pane" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Desktop Top Header (Hidden on Mobile/Tablet via CSS) */}
        <header className="desktop-top-header" style={{
          height: '72px',
          padding: '16px 24px',
          gap: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 90,
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          boxSizing: 'border-box'
        }}>
          {/* Left: Page Title & Subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getHeaderInfo().title}
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getHeaderInfo().subtitle}
            </p>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                ref={bellButtonRef}
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                style={{
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: 'var(--color-text-secondary)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}>
                
                🔔
                {lowStockAlerts.length > 0 &&
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#e74c3c',
                  color: 'var(--color-text-primary)',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                    {lowStockAlerts.length}
                  </span>
                }
              </button>

              {notificationsOpen &&
              <div ref={notificationRef} style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '300px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                padding: '16px',
                zIndex: 200
              }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', color: 'var(--color-text-primary)' }}>
                    Notifications & Alerts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', maxHeight: '250px', overflowY: 'auto' }}>
                    {lowStockAlerts.length === 0 ?
                  <>
                        <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--color-text-secondary)' }}>
                          🟢 System active and monitoring heartbeat.
                        </div>
                        <div style={{ padding: '6px 0', color: 'var(--color-text-secondary)' }}>
                          📋 Chef Dashboard synced with Kitchen Queue.
                        </div>
                      </> :

                  lowStockAlerts.map((item, idx) =>
                  <div key={idx} style={{ padding: '8px 0', borderBottom: idx < lowStockAlerts.length - 1 ? '1px solid var(--border-color)' : 'none', color: '#F39C12' }}>
                          ⚠️ <strong>{item.name}</strong> inventory running low ({item.quantity !== undefined ? item.quantity : item.stock} {item.unit} left, min {item.reorderLevel !== undefined ? item.reorderLevel : item.minStock} {item.unit}).
                        </div>
                  )
                  }
                  </div>
                </div>
              }
            </div>

            {/* Theme Dropdown Toggle */}
            <div className="theme-dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                title="Change Theme"
                style={{
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: 'var(--color-text-secondary)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}>
                {theme === 'light' ? '🌞' : theme === 'dark' ? '🌙' : '💻'}
              </button>
              {themeMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  right: 0,
                  width: '150px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  padding: '4px 0',
                  zIndex: 700
                }}>
                  <button
                    onClick={() => { setTheme('light'); setThemeMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      background: theme === 'light' ? 'rgba(212, 144, 115, 0.15)' : 'transparent',
                      border: 'none',
                      color: 'var(--color-text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13.5px',
                      fontWeight: theme === 'light' ? 'bold' : 'normal'
                    }}
                  >
                    <span>🌞</span> Light Mode
                  </button>
                  <button
                    onClick={() => { setTheme('dark'); setThemeMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      background: theme === 'dark' ? 'rgba(212, 144, 115, 0.15)' : 'transparent',
                      border: 'none',
                      color: 'var(--color-text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13.5px',
                      fontWeight: theme === 'dark' ? 'bold' : 'normal'
                    }}
                  >
                    <span>🌙</span> Dark Mode
                  </button>
                  <button
                    onClick={() => { setTheme('system'); setThemeMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      background: theme === 'system' ? 'rgba(212, 144, 115, 0.15)' : 'transparent',
                      border: 'none',
                      color: 'var(--color-text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13.5px',
                      fontWeight: theme === 'system' ? 'bold' : 'normal'
                    }}
                  >
                    <span>💻</span> System Default
                  </button>
                </div>
              )}
            </div>

            {/* Profile Dropdown Toggle */}
            <div className="profile-dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={handleProfileClick}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%'
                }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  border: '2px solid var(--color-border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </button>
              {renderProfileDropdown()}
            </div>
          </div>
        </header>

        {/* Content Area Container */}
        <main className="saas-content-inner" style={{ flexGrow: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="bottom-nav">
        {primaryMobileItems.map((item, index) => {
          const isActive = isPathActive(item.path);
          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={`bnav-item ${isActive ? 'active' : ''}`}>
              
              <span className="bnav-icon">{renderSvgIcon(item.label, isActive) || item.icon}</span>
              <span className="bnav-label">{getBottomBarLabel(item.label)}</span>
            </button>);

        })}
        {remainingMobileItems.length > 0 &&
        <button
          onClick={() => setMoreMenuOpen(true)}
          className={`bnav-item ${moreMenuOpen ? 'active' : ''}`}
          style={{ position: 'relative' }}>
          
            <span className="bnav-icon">⋯</span>
            <span className="bnav-label">More</span>
            {lowStockAlerts.length > 0 && ['admin', 'owner', 'manager'].includes(userRole) &&
          <span className="bnav-badge">{lowStockAlerts.length}</span>
          }
          </button>
        }
      </nav>

      {/* Mobile More Menu Bottom Sheet */}
      <div
        className={`bottom-sheet-overlay ${moreMenuOpen ? 'open' : ''}`}
        onClick={() => setMoreMenuOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1100,
          opacity: moreMenuOpen ? 1 : 0,
          pointerEvents: moreMenuOpen ? 'all' : 'none',
          transition: 'opacity 0.3s ease'
        }} />
      
      <div
        className={`bottom-sheet ${moreMenuOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '75vh',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          borderRadius: '24px 24px 0 0',
          zIndex: 1200,
          transform: moreMenuOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
        }}>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 16px 8px 16px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          flexShrink: 0
        }}>
          <div style={{
            width: '40px',
            height: '4px',
            borderRadius: '2px',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            marginBottom: '12px'
          }} />
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)' }}>More Modules</span>
        </div>
        <div style={{
          overflowY: 'auto',
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px'
        }}>
          {remainingMobileItems.map((item, index) => {
            const isActive = isPathActive(item.path);
            return (
              <button
                key={index}
                onClick={() => {
                  navigate(item.path);
                  setMoreMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'rgba(143, 168, 155, 0.12)' : 'rgba(0, 0, 0, 0.02)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: isActive ? '1px solid rgba(143, 168, 155, 0.3)' : '1px solid rgba(0, 0, 0, 0.03)'
                }}>
                
                <span style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderSvgIcon(item.label, isActive) || item.icon}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: isActive ? 800 : 500, textAlign: 'center', wordBreak: 'break-word', lineHeight: '1.2' }}>{item.label}</span>
              </button>);

          })}
        </div>
      </div>
    </div>);

};

export default SaaSLayout;