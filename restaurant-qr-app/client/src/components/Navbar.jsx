import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getCafeInfo, getAssetUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ tableNumber, cafeId, cartItemCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [cafeInfo, setCafeInfo] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const isStaffMode = Boolean(
    searchParams.get('source') === 'staff' ||
    sessionStorage.getItem('orderSource') === 'staff' ||
    (user && ['admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff', 'super_admin'].includes(user?.role?.toLowerCase()))
  );

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
      <Link to={getHomeLink()} className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        {logoSrc ? (
          <img src={logoSrc} alt={`${cafeInfo?.name || 'Cafe'} Logo`} style={{ height: '40px', width: '40px', borderRadius: '50%', objectFit: 'contain', border: '1px solid #6F4E37' }} />
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#A0826C', border: '1px solid #5C4331', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>No Logo Uploaded</span>
        )}
        <span className="nav-brand-text">{cafeInfo?.name || 'Cafe'}</span>
      </Link>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isStaffMode && (
          <button
            onClick={handleExitOrderTaking}
            title="Cancel / Exit Order Mode and return to Workspace"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              background: 'rgba(231, 76, 60, 0.15)',
              color: '#e74c3c',
              border: '1px solid #e74c3c',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>✖</span>
            <span>Exit Order</span>
          </button>
        )}

        {tableNumber && (
          <div className="table-badge">
            TABLE {tableNumber}
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

