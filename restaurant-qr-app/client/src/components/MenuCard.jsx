import React, { useState } from 'react';
import { Coffee, CupSoda, UtensilsCrossed, Pizza, Sandwich, Cake, Utensils } from 'lucide-react';
import { getAssetUrl } from '../services/api';

const MenuCard = React.memo(({ item, cartItem, addToCart, increaseQuantity, decreaseQuantity }) => {
  const { id, name, image, price, category, description, available } = item;

  const isValidUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    return url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
  };

  const getCategoryIcon = (categoryName) => {
    const cat = (categoryName || '').toLowerCase();
    if (cat.includes('chai') || cat.includes('tea')) return <Coffee size={32} color="var(--color-primary)" />;
    if (cat.includes('coffee')) return <Coffee size={32} color="var(--color-primary)" />;
    if (cat.includes('juice') || cat.includes('cooler') || cat.includes('drink') || cat.includes('beverage')) return <CupSoda size={32} color="var(--color-primary)" />;
    if (cat.includes('milkshake') || cat.includes('shake')) return <CupSoda size={32} color="var(--color-primary)" />;
    if (cat.includes('starter') || cat.includes('bite') || cat.includes('snack')) return <UtensilsCrossed size={32} color="var(--color-primary)" />;
    if (cat.includes('fry') || cat.includes('fries') || cat.includes('potato')) return <UtensilsCrossed size={32} color="var(--color-primary)" />;
    if (cat.includes('burger')) return <Sandwich size={32} color="var(--color-primary)" />;
    if (cat.includes('sandwich')) return <Sandwich size={32} color="var(--color-primary)" />;
    if (cat.includes('pizza')) return <Pizza size={32} color="var(--color-primary)" />;
    if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('cake')) return <Cake size={32} color="var(--color-primary)" />;
    return <Utensils size={32} color="var(--color-primary)" />;
  };

  const [imgFailed, setImgFailed] = useState(!isValidUrl(image));
  const [prevImage, setPrevImage] = useState(image);

  if (image !== prevImage) {
    setPrevImage(image);
    setImgFailed(!isValidUrl(image));
  }

  const displayImage = getAssetUrl(image);

  return (
    <div className="compact-menu-card">
      {!available && (
        <div className="out-of-stock-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: '#e74c3c', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>Sold Out</span>
        </div>
      )}
      
      {imgFailed ? (
        <div className="compact-menu-card-img" style={{ background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {getCategoryIcon(category)}
        </div>
      ) : (
        <img 
          src={displayImage} 
          alt={name} 
          className="compact-menu-card-img" 
          loading="lazy"
          onError={() => setImgFailed(true)} 
        />
      )}
      
      <div className="compact-menu-card-content">
        <h3 className="compact-menu-card-title">{name}</h3>
        <span className="compact-menu-card-price">₹{price.toFixed(2)}</span>
        
        {cartItem ? (
          <div className="compact-qty-control">
            <button onClick={() => decreaseQuantity(id)} className="compact-qty-btn">-</button>
            <span className="compact-qty-val">{cartItem.quantity}</span>
            <button onClick={() => increaseQuantity(id)} className="compact-qty-btn">+</button>
          </div>
        ) : (
          <button 
            onClick={() => addToCart(item)} 
            className="compact-add-btn"
            disabled={!available}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
});

export default MenuCard;
