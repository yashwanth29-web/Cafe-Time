import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCafeInfo, getAssetUrl } from '../services/api';

const Navbar = ({ tableNumber, cartItemCount }) => {
  const [cafeInfo, setCafeInfo] = useState(null);

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const id = sessionStorage.getItem('cafeId') || 'CD001';
        const res = await getCafeInfo(id);
        if (res.success) {
          setCafeInfo(res.data);
        }
      } catch (e) {
        console.error('Error fetching cafe info in Navbar:', e);
      }
    };
    fetchCafe();
  }, []);

  const logoSrc = cafeInfo?.logoUrl ? getAssetUrl(cafeInfo.logoUrl) : null;

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {logoSrc ? (
          <img src={logoSrc} alt={`${cafeInfo?.name || 'Cafe'} Logo`} style={{ height: '40px', width: '40px', borderRadius: '50%', objectFit: 'contain', border: '1px solid #6F4E37' }} />
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#A0826C', border: '1px solid #5C4331', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>No Logo Uploaded</span>
        )}
        <span className="nav-brand-text">{cafeInfo?.name || 'Cafe'}</span>
      </Link>
      <div className="nav-right">
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

