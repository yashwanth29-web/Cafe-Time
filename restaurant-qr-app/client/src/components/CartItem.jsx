import { useState } from 'react';
import { getAssetUrl } from '../services/api';

const CartItem = ({ item, increaseQuantity, decreaseQuantity, removeFromCart }) => {
  const { id, name, image, price, category } = item.item;
  const { quantity } = item;

  const isValidUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    return url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
  };

  const getCategoryIcon = (categoryName) => {
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('chai') || cat.includes('tea')) return '☕';
    if (cat.includes('coffee')) return '☕';
    if (cat.includes('juice') || cat.includes('cooler') || cat.includes('drink') || cat.includes('beverage')) return '🥤';
    if (cat.includes('milkshake') || cat.includes('shake')) return '🥤';
    if (cat.includes('starter') || cat.includes('bite') || cat.includes('snack')) return '🍢';
    if (cat.includes('fry') || cat.includes('fries') || cat.includes('potato')) return '🍟';
    if (cat.includes('burger')) return '🍔';
    if (cat.includes('sandwich')) return '🥪';
    if (cat.includes('pizza')) return '🍕';
    if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('cake')) return '🍰';
    return '🍽️';
  };

  const [imgFailed, setImgFailed] = useState(!isValidUrl(image));
  const [prevImage, setPrevImage] = useState(image);

  if (image !== prevImage) {
    setPrevImage(image);
    setImgFailed(!isValidUrl(image));
  }

  const displayImage = getAssetUrl(image);

  return (
    <div className="cart-item-card">
      {imgFailed ? (
        <div 
          className="cart-item-img"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #2a1b12 0%, #150f0b 100%)',
            color: 'var(--color-primary)',
            fontSize: '24px',
            border: '1px solid var(--color-border)',
            userSelect: 'none'
          }}
        >
          {getCategoryIcon(category)}
        </div>
      ) : (
        <img 
          src={displayImage} 
          alt={name} 
          className="cart-item-img" 
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)} 
        />
      )}
      
      <div className="cart-item-info">
        <h4 className="cart-item-name">{name}</h4>
        <div className="cart-item-price">₹{price.toFixed(2)} each</div>
      </div>
      
      <div className="cart-item-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div className="qty-control" style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          border: '1.5px solid var(--color-primary)',
          borderRadius: '10px',
          padding: '2px',
          minWidth: '92px',
          height: '34px',
          boxSizing: 'border-box'
        }}>
          <button 
            onClick={() => decreaseQuantity(id)} 
            className="qty-btn"
            aria-label="Decrease quantity"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-primary)',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            −
          </button>
          <span className="qty-val" style={{
            fontSize: '13.5px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            padding: '0 4px',
            userSelect: 'none'
          }}>
            {quantity}
          </span>
          <button 
            onClick={() => increaseQuantity(id)} 
            className="qty-btn"
            aria-label="Increase quantity"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            +
          </button>
        </div>
        
        <button 
          onClick={() => removeFromCart(id)} 
          className="btn-remove"
          title="Remove item"
          aria-label="Remove item"
          style={{
            background: 'rgba(231, 76, 60, 0.08)',
            border: '1px solid rgba(231, 76, 60, 0.2)',
            color: '#e74c3c',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default CartItem;

