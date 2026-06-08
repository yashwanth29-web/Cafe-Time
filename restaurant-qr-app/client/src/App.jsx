import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import CustomerMenu from './pages/CustomerMenu';
import CartPage from './pages/CartPage';
import OwnerDashboard from './pages/OwnerDashboard';
import PaymentDemo from './pages/PaymentDemo';
import './styles/App.css';

function AppContent() {
  const [cart, setCart] = useState([]);
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  // Synchronously initialize table number state from query param or session storage
  const [tableNumber, setTableNumber] = useState(() => {
    return tableParam || sessionStorage.getItem('tableNumber') || '';
  });

  // Sync tableNumber state when search parameter changes reactively
  useEffect(() => {
    if (tableParam) {
      setTableNumber(tableParam);
      sessionStorage.setItem('tableNumber', tableParam);
      console.log(`Updated table number from URL: ${tableParam}`);
    }
  }, [tableParam]);

  // Cart operations
  const addToCart = (item) => {
    setCart((prevCart) => {
      const existing = prevCart.find((cartItem) => cartItem.item.id === item.id);
      if (existing) {
        return prevCart.map((cartItem) =>
          cartItem.item.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { item, quantity: 1 }];
    });
  };

  const increaseQuantity = (id) => {
    setCart((prevCart) =>
      prevCart.map((cartItem) =>
        cartItem.item.id === id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      )
    );
  };

  const decreaseQuantity = (id) => {
    setCart((prevCart) => {
      const existing = prevCart.find((cartItem) => cartItem.item.id === id);
      if (existing && existing.quantity === 1) {
        // Remove item if quantity becomes 0
        return prevCart.filter((cartItem) => cartItem.item.id !== id);
      }
      return prevCart.map((cartItem) =>
        cartItem.item.id === id
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      );
    });
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter((cartItem) => cartItem.item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const totalItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div className="app-container">
      <Navbar tableNumber={tableNumber} cartItemCount={totalItemCount} />
      
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={
              tableNumber ? (
                <CustomerMenu 
                  cart={cart}
                  addToCart={addToCart}
                  increaseQuantity={increaseQuantity}
                  decreaseQuantity={decreaseQuantity}
                />
              ) : (
                <Navigate to="/admin" replace />
              )
            } 
          />
          <Route 
            path="/cart" 
            element={
              <CartPage 
                cart={cart}
                increaseQuantity={increaseQuantity}
                decreaseQuantity={decreaseQuantity}
                removeFromCart={removeFromCart}
                clearCart={clearCart}
                tableNumber={tableNumber}
              />
            } 
          />
          <Route 
            path="/admin" 
            element={<OwnerDashboard />} 
          />
          <Route 
            path="/payment-demo" 
            element={<PaymentDemo />} 
          />
          <Route 
            path="/dashboard" 
            element={<Navigate to="/admin" replace />} 
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
