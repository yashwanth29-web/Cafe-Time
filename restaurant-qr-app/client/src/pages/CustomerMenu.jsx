import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMenu } from '../services/api';
import MenuCard from '../components/MenuCard';

const CustomerMenu = ({ cart, addToCart, increaseQuantity, decreaseQuantity }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await getMenu();
        if (response.success) {
          setMenuItems(response.data);
          setErrorMsg('');
        } else {
          setErrorMsg('Failed to load menu items.');
        }
      } catch (err) {
        console.error('Error fetching menu:', err);
        setErrorMsg('Could not connect to database.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // Dynamically extract unique categories from DB items
  const categories = ['All', ...new Set(menuItems.map(item => item.category))];

  // Filter menu items by category and availability
  const filteredMenu = menuItems.filter((item) => {
    // Only show available items for customers!
    if (!item.available) return false;
    
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });

  // Calculate cart quantities and total price
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = cart.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', margin: '0 auto 20px auto', borderTopColor: 'var(--color-primary)' }}></div>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading cafe menu...</p>
      </div>
    );
  }

  return (
    <div className="customer-menu">
      {errorMsg && (
        <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: '#fff', padding: '12px', marginBottom: '20px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Category Selection Carousel */}
      <div className="categories-container">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Cards Grid */}
      {filteredMenu.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontSize: '15px',
          marginTop: '20px'
        }}>
          🍽️ No available items in this category.
        </div>
      ) : (
        <div className="menu-grid">
          {filteredMenu.map((item) => {
            // Find if this item is in the cart to pass correct state
            const cartItem = cart.find((cItem) => cItem.item.id === item.id);
            return (
              <MenuCard
                key={item.id}
                item={item}
                cartItem={cartItem}
                addToCart={addToCart}
                increaseQuantity={increaseQuantity}
                decreaseQuantity={decreaseQuantity}
              />
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Cart Banner */}
      {totalItems > 0 && (
        <div className="sticky-cart-banner">
          <Link to="/cart" className="sticky-cart-banner-content">
            <div className="sticky-cart-info">
              <span className="sticky-cart-count">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} added
              </span>
              <span className="sticky-cart-price">${totalPrice.toFixed(2)}</span>
            </div>
            <div className="sticky-cart-action">
              <span>View Cart</span>
              <span>🛒 →</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
