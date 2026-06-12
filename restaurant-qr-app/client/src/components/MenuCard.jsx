import { useState } from 'react';

const MenuCard = ({ item, cartItem, addToCart, increaseQuantity, decreaseQuantity }) => {
  const { id, name, image, price, category, description, available } = item;

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

  return (
    <div className="menu-card">
      {!available && (
        <div className="out-of-stock-overlay">
          <span className="out-of-stock-badge">Out of Stock</span>
        </div>
      )}
      
      <div className="menu-card-img-container">
        {imgFailed ? (
          <div className="menu-card-img-fallback">
            <span className="menu-card-fallback-icon">{getCategoryIcon(category)}</span>
          </div>
        ) : (
          <img 
            src={image} 
            alt={name} 
            className="menu-card-img" 
            onError={() => setImgFailed(true)} 
          />
        )}
        <span className="menu-card-badge">{category}</span>
      </div>
      
      <div className="menu-card-content">
        <div className="menu-card-header">
          <h3 className="menu-card-title">{name}</h3>
          <span className="menu-card-price">₹{price.toFixed(2)}</span>
        </div>
        
        <p className="menu-card-description">{description}</p>
        
        <div className="menu-card-footer">
          {cartItem ? (
            <div className="qty-control">
              <button 
                onClick={() => decreaseQuantity(id)} 
                className="qty-btn"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="qty-val">{cartItem.quantity}</span>
              <button 
                onClick={() => increaseQuantity(id)} 
                className="qty-btn"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button 
              onClick={() => addToCart(item)} 
              className={`btn btn-primary ${!available ? 'btn-disabled' : ''}`}
              disabled={!available}
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuCard;
