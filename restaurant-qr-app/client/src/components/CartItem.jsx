import React from 'react';

const CartItem = ({ item, increaseQuantity, decreaseQuantity, removeFromCart }) => {
  const { id, name, image, price } = item.item;
  const { quantity } = item;

  return (
    <div className="cart-item-card">
      <img src={image} alt={name} className="cart-item-img" />
      
      <div className="cart-item-info">
        <h4 className="cart-item-name">{name}</h4>
        <div className="cart-item-price">₹{price.toFixed(2)} each</div>
      </div>
      
      <div className="cart-item-right">
        <div className="qty-control">
          <button 
            onClick={() => decreaseQuantity(id)} 
            className="qty-btn"
            aria-label="Decrease quantity"
          >
            -
          </button>
          <span className="qty-val">{quantity}</span>
          <button 
            onClick={() => increaseQuantity(id)} 
            className="qty-btn"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        
        <button 
          onClick={() => removeFromCart(id)} 
          className="btn-remove"
          title="Remove item"
          aria-label="Remove item"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default CartItem;
