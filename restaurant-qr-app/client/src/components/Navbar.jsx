import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const themeOptions = [
  { value: 'light', icon: '🌞', label: 'Light' },
  { value: 'dark', icon: '🌙', label: 'Dark' },
  { value: 'system', icon: '💻', label: 'System' },
];

const Navbar = ({ tableNumber, cartItemCount, cafeInfo }) => {
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef(null);

  const currentTheme = themeOptions.find((t) => t.value === theme) || themeOptions[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowThemeMenu(false);
      }
    };
    if (showThemeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showThemeMenu]);

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src={cafeInfo?.logoUrl || "/logo.png"} alt={`${cafeInfo?.name || "Cypher's Café"} Logo`} style={{ height: '40px', width: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #6F4E37' }} />
        <span className="nav-brand-text">{cafeInfo?.name || "Cypher's Café"}</span>
      </Link>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {tableNumber && (
          <div className="table-badge">
            TABLE {tableNumber}
          </div>
        )}

        {/* Theme icon button with dropdown */}
        <div className="theme-toggle-wrap" ref={menuRef}>
          <button
            className="theme-toggle-btn"
            onClick={() => setShowThemeMenu((prev) => !prev)}
            aria-label="Toggle theme"
            type="button"
          >
            {currentTheme.icon}
          </button>

          {showThemeMenu && (
            <div className="theme-dropdown">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`theme-dropdown-item${theme === opt.value ? ' active' : ''}`}
                  onClick={() => { setTheme(opt.value); setShowThemeMenu(false); }}
                  type="button"
                >
                  <span className="theme-dropdown-icon">{opt.icon}</span>
                  <span className="theme-dropdown-label">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
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
