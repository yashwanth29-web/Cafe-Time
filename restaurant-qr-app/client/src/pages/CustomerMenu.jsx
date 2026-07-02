import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Coffee, CupSoda, Utensils, UtensilsCrossed, Cake, LayoutGrid } from 'lucide-react';
import { getMenu, getCategories, getAssetUrl } from '../services/api';
import MenuCard from '../components/MenuCard';
import frontendCache from '../utils/frontendCache';

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
      if (frontendCache.getMenu() && frontendCache.getCategories()) {
        setMenuItems(frontendCache.getMenu());
        setCategories(frontendCache.getCategories());
        setLoading(false);
        return;
      }
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
          const finalCats = ['All', ...activeCats];
          setCategories(finalCats);
          frontendCache.setCategories(finalCats);
        } else {
          // Fallback to extract unique categories from menu items
          const uniqueCats = ['All', ...new Set(menuData.filter((item) => item.available).map((item) => item.category))];
          setCategories(uniqueCats);
          frontendCache.setCategories(uniqueCats);
        }
        
        frontendCache.setMenu(menuData);
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter menu items by category, availability and search
  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.available) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Calculate cart quantities and total price
  const totalItems = useMemo(() => cart.reduce((acc, curr) => acc + curr.quantity, 0), [cart]);
  const totalPrice = useMemo(() => cart.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0), [cart]);

  if (loading) {
    return (
      <div className="customer-menu" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px' }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ minWidth: '80px', height: '36px', background: 'var(--color-bg-secondary)', borderRadius: '20px', animation: 'pulse 1.5s infinite' }}></div>)}
        </div>
        <div className="menu-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="menu-card" style={{ height: '320px', animation: 'pulse 1.5s infinite', background: 'var(--color-bg-secondary)' }}>
              <div style={{ height: '180px', background: 'var(--color-border)' }}></div>
              <div style={{ padding: '16px' }}>
                <div style={{ height: '24px', background: 'var(--color-border)', width: '70%', marginBottom: '12px' }}></div>
                <div style={{ height: '16px', background: 'var(--color-border)', width: '100%', marginBottom: '8px' }}></div>
                <div style={{ height: '16px', background: 'var(--color-border)', width: '80%' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="customer-menu-layout">
      {errorMsg &&
        <div className="success-details" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-text-primary)', padding: '12px', marginBottom: '20px' }}>
          ⚠️ {errorMsg}
        </div>
      }

      {/* Search Bar */}
      <div style={{ position: 'relative', margin: '4px 0 16px 0' }}>
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

      {/* Combos Slider */}
      {!searchQuery && menuItems.some(i => (i.isCombo || i.category === 'Combos') && i.available) && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--color-text-primary)' }}>⭐ Best Combos For You</h3>
          <div className="combos-carousel">
            {menuItems.filter(i => (i.isCombo || i.category === 'Combos') && i.available).map(combo => (
              <div key={combo.id} className="combo-card" style={{ position: 'relative', border: '1px solid #f0e4d8', background: '#fffcf7' }}>
                {combo.originalPrice && combo.originalPrice > combo.price && (
                  <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ background: '#d34b22', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '3px 6px', borderRadius: '4px' }}>
                      SAVE ₹{(combo.originalPrice - combo.price).toFixed(0)}
                    </div>
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <img src={getAssetUrl(combo.image)} alt={combo.name} className="combo-card-img" style={{ height: '110px', width: '100%', objectFit: 'cover' }} />
                </div>
                <div className="combo-card-content" style={{ padding: '10px' }}>
                  <div className="combo-card-title" style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1.2, color: '#3d2516', marginBottom: '10px' }}>{combo.name}</div>
                  
                  {combo.originalPrice && combo.originalPrice > combo.price ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '9px', color: '#888' }}>Price (Incl. GST)</span>
                          <span style={{ fontSize: '13px', textDecoration: 'line-through', color: '#555', fontWeight: 600 }}>₹{combo.originalPrice.toFixed(0)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '9px', color: '#888' }}>You Pay</span>
                          <span style={{ fontSize: '16px', color: '#8b3d20', fontWeight: 900 }}>₹{combo.price.toFixed(0)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', color: '#27ae60', fontSize: '10px', fontWeight: 800, borderTop: '1px dashed #e0d5c1', paddingTop: '6px', marginBottom: '8px' }}>
                        You Save ₹{(combo.originalPrice - combo.price).toFixed(0)}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', minHeight: '34px' }}>
                      <span className="combo-card-price" style={{ fontSize: '15px', color: '#8b3d20', fontWeight: 900 }}>₹{combo.price.toFixed(0)}</span>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {cart.find(c => c.item.id === combo.id) ? (
                      <div className="compact-qty-control" style={{ position: 'relative', bottom: 'auto', right: 'auto', width: '100%', justifyContent: 'center', background: '#8b3d20' }}>
                        <button onClick={() => decreaseQuantity(combo.id)} className="compact-qty-btn">-</button>
                        <span className="compact-qty-val" style={{ width: '30px', textAlign: 'center' }}>{cart.find(c => c.item.id === combo.id).quantity}</span>
                        <button onClick={() => increaseQuantity(combo.id)} className="compact-qty-btn">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(combo)} className="compact-add-btn" style={{ position: 'relative', bottom: 'auto', right: 'auto', width: '100%', color: '#8b3d20', borderColor: '#e0d5c1', background: '#fff', fontSize: '13px', padding: '6px 0', borderRadius: '6px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>ADD</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Row */}
      {!searchQuery && (
        <div className="category-row">
          {categories.map((cat) => {
            const isDrinks = cat.toLowerCase().includes('drink') || cat.toLowerCase().includes('juice') || cat.toLowerCase().includes('cooler') || cat.toLowerCase().includes('shake');
            const isTea = cat.toLowerCase().includes('tea') || cat.toLowerCase().includes('coffee') || cat.toLowerCase().includes('chai');
            const isSnack = cat.toLowerCase().includes('snack') || cat.toLowerCase().includes('bite') || cat.toLowerCase().includes('fries');
            const isCake = cat.toLowerCase().includes('cake') || cat.toLowerCase().includes('dessert');
            let IconComponent = Utensils;
            if (isDrinks) IconComponent = CupSoda;
            if (isTea) IconComponent = Coffee;
            if (isSnack) IconComponent = UtensilsCrossed;
            if (isCake) IconComponent = Cake;
            if (cat === 'All') IconComponent = LayoutGrid;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
              >
                <div className="category-btn-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                  <IconComponent size={24} strokeWidth={1.5} color={selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
                </div>
                <div className="category-btn-text" style={{ color: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{cat}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Menu Cards Grid */}
      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '10px 0 12px 0', color: 'var(--color-text-primary)' }}>{searchQuery ? 'Search Results' : selectedCategory === 'All' ? 'All Items' : selectedCategory}</h3>
      {filteredMenu.filter(i => !(i.isCombo || i.category === 'Combos') || searchQuery).length === 0 ?
        <div style={{
          padding: '50px 20px', textAlign: 'center', background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)',
          color: 'var(--color-text-secondary)', fontSize: '15px'
        }}>
          {searchQuery ?
            <>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
              <div>No results for <strong style={{ color: 'var(--color-text-primary)' }}>"{searchQuery}"</strong></div>
              <button onClick={() => setSearchQuery('')} style={{ marginTop: '14px', background: 'var(--color-primary)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Clear Search</button>
            </> : '🍽️ No available items in this category.'}
        </div> 
      :
        <div className="compact-menu-grid">
          {filteredMenu.filter(i => !(i.isCombo || i.category === 'Combos') || searchQuery).map((item) => {
            const cartItem = cart.find((cItem) => cItem.item.id === item.id);
            return (
              <MenuCard
                key={item.id}
                item={item}
                cartItem={cartItem}
                addToCart={addToCart}
                increaseQuantity={increaseQuantity}
                decreaseQuantity={decreaseQuantity} />
            );
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