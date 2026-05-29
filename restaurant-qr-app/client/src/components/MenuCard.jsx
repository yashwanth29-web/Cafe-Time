import React from 'react';

const MenuCard = ({ item, cartItem, addToCart, increaseQuantity, decreaseQuantity }) => {
  const { id, name, image, price, category, description, available } = item;

  return (
    <div className="menu-card">
      {!available && (
        <div className="out-of-stock-overlay">
          <span className="out-of-stock-badge">Out of Stock</span>
        </div>
      )}
      
      <div className="menu-card-img-container">
        <img src={image} alt={name} className="menu-card-img" />
        <span className="menu-card-badge">{category}</span>
      </div>
      
      <div className="menu-card-content">
        <div className="menu-card-header">
          <h3 className="menu-card-title">{name}</h3>
          <span className="menu-card-price">${price.toFixed(2)}</span>
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
