import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMenu, getCategories } from '../services/api';
import MenuCard from '../components/MenuCard';

const CustomerMenu = ({ cart, addToCart, increaseQuantity, decreaseQuantity }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasHistory, setHasHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
    const completedIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');
    if (activeIds.length > 0 || completedIds.length > 0) setHasHistory(true);

    let isMounted = true;
    const fetchMenuAndCategories = async (isFirst = false) => {
      if (isFirst) setLoading(true);
      try {
        const [menuRes, catsRes] = await Promise.all([
        getMenu(),
        getCategories().catch((err) => {
          console.error('Failed to fetch categories:', err);
          return null;
        })]
        );

        if (!isMounted) return;

        let menuData = [];
        if (menuRes && menuRes.success) {
          setMenuItems(menuRes.data);
          menuData = menuRes.data;
          setErrorMsg('');
        } else if (isFirst) {
          setErrorMsg('Failed to load menu items.');
        }

        if (catsRes && catsRes.success) {
          const dbCategories = catsRes.data.map((c) => c.name);
          // Only show categories that have at least one active item
          const activeCats = dbCategories.filter((cat) =>
          menuData.some((item) => item.category === cat && item.available)
          );
          // Add any remaining uncategorized items if they exist
          const hasUncategorized = menuData.some((item) =>
          (!item.category || !dbCategories.includes(item.category)) && item.available
          );
          if (hasUncategorized && !activeCats.includes('Uncategorized')) {
            activeCats.push('Uncategorized');
          }
          setCategories(['All', ...activeCats]);
        } else {
          // Fallback to extract unique categories from menu items
          const uniqueCats = ['All', ...new Set(menuData.filter((item) => item.available).map((item) => item.category))];
          setCategories(uniqueCats);
        }
      } catch (err) {
        console.error('Error fetching menu/categories:', err);
        if (isFirst && isMounted) {
          setErrorMsg('Could not connect to database.');
        }
      } finally {
        if (isFirst && isMounted) setLoading(false);
      }
    };

    fetchMenuAndCategories(true);
    const interval = setInterval(() => fetchMenuAndCategories(false), 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Filter menu items by category, availability and search
  const filteredMenu = menuItems.filter((item) => {
    if (!item.available) return false;
    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q));

    }
    return true;
  });

  // Calculate cart quantities and total price
  const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = cart.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', margin: '0 auto 20px auto', borderTopColor: 'var(--color-primary)' }}></div>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading cafe menu...</p>
      </div>);

  }

  return (
    <div className="customer-menu">
      {errorMsg &&
      <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-text-primary)', padding: '12px', marginBottom: '20px' }}>
          ⚠️ {errorMsg}
        </div>
      }

      {/* Category Selection Carousel */}
      <div className="categories-container">
        {categories.map((cat) =>
        <button
          key={cat}
          onClick={() => {setSelectedCategory(cat);setSearchQuery('');}}
          className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}>
          
            {cat}
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', margin: '12px 0 4px 0' }}>
        <span style={{
          position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '16px', pointerEvents: 'none', opacity: 0.45
        }}>🔍</span>
        <input
          id="customer-menu-search"
          type="text"
          placeholder="Search dishes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 40px 11px 42px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            background: 'var(--bg-card)',
            color: 'var(--color-text-primary)',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {e.target.style.borderColor = 'var(--color-primary)';e.target.style.boxShadow = '0 0 0 3px rgba(143,168,155,0.15)';}}
          onBlur={(e) => {e.target.style.borderColor = 'var(--color-border)';e.target.style.boxShadow = 'none';}} />
        
        {searchQuery &&
        <button
          onClick={() => setSearchQuery('')}
          style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0,0.08)', border: '1px solid rgba(0, 0, 0,0.1)',
            borderRadius: '50%', width: '22px', height: '22px',
            color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: 0
          }}>
          ×</button>
        }
      </div>

      {/* Menu Cards Grid */}
      {filteredMenu.length === 0 ?
      <div style={{
        padding: '50px 20px',
        textAlign: 'center',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--color-border)',
        color: 'var(--color-text-secondary)',
        fontSize: '15px',
        marginTop: '12px'
      }}>
          {searchQuery ?
        <>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
              <div>No results for <strong style={{ color: 'var(--color-text-primary)' }}>"{searchQuery}"</strong></div>
              <button
            onClick={() => setSearchQuery('')}
            style={{
              marginTop: '14px', background: 'var(--color-primary)', color: 'var(--color-text-primary)',
              border: 'none', borderRadius: '8px', padding: '8px 18px',
              fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600
            }}>
            Clear Search</button>
            </> :

        '🍽️ No available items in this category.'
        }
        </div> :

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
              decreaseQuantity={decreaseQuantity} />);


        })}
        </div>
      }

      {/* Sticky Bottom Cart Banner */}
      
      {hasHistory && totalItems === 0 &&
      <div className="sticky-cart-banner" style={{ background: 'var(--color-primary)' }}>
          <Link to="/history" className="sticky-cart-banner-content" style={{ justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '15px' }}>🧾 View My Orders & Tracker</span>
          </Link>
        </div>
      }
      
      {totalItems > 0 &&
      <div className="sticky-cart-banner">
          <Link to="/cart" className="sticky-cart-banner-content">
            <div className="sticky-cart-info">
              <span className="sticky-cart-count">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} added
              </span>
              <span className="sticky-cart-price">₹{totalPrice.toFixed(2)}</span>
            </div>
            <div className="sticky-cart-action">
              <span>View Cart</span>
              <span>🛒 →</span>
            </div>
          </Link>
        </div>
      }
    </div>);

};

export default CustomerMenu;