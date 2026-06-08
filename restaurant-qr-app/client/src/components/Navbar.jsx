import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ tableNumber, cartItemCount }) => {
  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <span className="nav-brand-logo">☕</span>
        <span className="nav-brand-text">CoffeeDay Cafe</span>
      </Link>
      
      <div className="nav-right">
        <Link to="/payment-demo" className="nav-demo-link" style={{ marginRight: '15px', textDecoration: 'none', color: '#d4af37', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          💳 Demo
        </Link>
        
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
