import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getCafeInfo, getAssetUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import socket from '../socket';

const Navbar = ({ tableNumber, cafeId, cartItemCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [cafeInfo, setCafeInfo] = useState(null);
  const [waiterCalled, setWaiterCalled] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const isStaffMode = Boolean(
    searchParams.get('source') === 'staff' ||
    sessionStorage.getItem('orderSource') === 'staff' ||
    (user && ['admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff', 'super_admin'].includes(user?.role?.toLowerCase()))
  );

  const handleCallWaiter = () => {
    if (waiterCalled) return;
    setWaiterCalled(true);
    const resolvedCafe = cafeId || sessionStorage.getItem('cafeId') || 'CP007';
    const resolvedBranch = sessionStorage.getItem('branchId') || 'default';
    try {
      socket.emit('call_waiter', {
        tableNumber: tableNumber || 'Customer Table',
        cafeId: resolvedCafe,
        branchId: resolvedBranch
      });
    } catch (e) {
      console.warn('Socket emit call_waiter failed:', e);
    }
    setTimeout(() => setWaiterCalled(false), 30000);
  };

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const id = cafeId || searchParams.get('cafeId') || sessionStorage.getItem('cafeId');
        if (!id) return;
        const res = await getCafeInfo(id);
        if (res.success) {
          setCafeInfo(res.data);
        }
      } catch (e) {
        console.error('Error fetching cafe info in Navbar:', e);
      }
    };
    fetchCafe();
  }, [cafeId]);

  const logoSrc = cafeInfo?.logoUrl ? getAssetUrl(cafeInfo.logoUrl) : null;

  const handleExitOrderTaking = () => {
    sessionStorage.removeItem('orderSource');
    if (user?.role?.toLowerCase() === 'manager') {
      navigate('/manager/dashboard');
    } else if (user?.role?.toLowerCase() === 'owner' || user?.role?.toLowerCase() === 'admin') {
      navigate('/owner/dashboard');
    } else {
      navigate('/staff/workspace');
    }
  };

  const getHomeLink = () => {
    if (isStaffMode) {
      return '/staff/workspace';
    }
    const currentParams = new URLSearchParams(location.search);
    if (tableNumber) currentParams.set('table', tableNumber);
    if (cafeId) currentParams.set('cafeId', cafeId);
    const paramStr = currentParams.toString();
    return paramStr ? `/?${paramStr}` : '/menu';
  };

  return (
    <nav className="navbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <Link to={getHomeLink()} className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', minWidth: 0 }}>
        {logoSrc ? (
          <img src={logoSrc} alt={`${cafeInfo?.name || 'Cafe'} Logo`} style={{ height: '36px', width: '36px', borderRadius: '50%', objectFit: 'contain', border: '1px solid #6F4E37', flexShrink: 0 }} />
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#A0826C', border: '1px solid #5C4331', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>No Logo Uploaded</span>
        )}
        <span className="nav-brand-text" title={cafeInfo?.name || 'Cafe'}>{cafeInfo?.name || 'Cafe'}</span>
      </Link>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {isStaffMode && (
          <button
            onClick={handleExitOrderTaking}
            className="navbar-exit-btn"
            title="Cancel / Exit Order Mode and return to Workspace"
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>✖</span>
            <span className="navbar-exit-text">Exit</span>
          </button>
        )}

        {!isStaffMode && tableNumber && (
          <button
            onClick={handleCallWaiter}
            disabled={waiterCalled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: waiterCalled ? 'rgba(39, 174, 96, 0.15)' : 'rgba(224, 142, 39, 0.1)',
              color: waiterCalled ? '#27ae60' : 'var(--color-primary)',
              border: `1px solid ${waiterCalled ? '#27ae60' : 'var(--color-primary)'}`,
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: waiterCalled ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            title="Call staff to Table"
          >
            <span>{waiterCalled ? '✅' : '🔔'}</span>
            <span>{waiterCalled ? 'Called' : 'Help'}</span>
          </button>
        )}

        {tableNumber && (
          <div className="table-badge">
            <span className="table-badge-full">TABLE {tableNumber}</span>
            <span className="table-badge-short">T{tableNumber}</span>
          </div>
        )}
        
        <Link to="/cart" className="nav-cart-icon" aria-label="View Cart">
          🛒
          {cartItemCount > 0 && (
            <span className="nav-cart-badge">{cartItemCount}</span>
          )}
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;

