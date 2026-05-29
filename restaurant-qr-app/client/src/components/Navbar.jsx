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
