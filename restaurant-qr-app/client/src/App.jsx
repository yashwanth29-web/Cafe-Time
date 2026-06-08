import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import CustomerMenu from './pages/CustomerMenu';
import CartPage from './pages/CartPage';
import OwnerDashboard from './pages/OwnerDashboard';
import PaymentDemo from './pages/PaymentDemo';
import Login from './pages/Login';
import VerifyOtp from './pages/VerifyOtp';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import OwnerSetup from './pages/OwnerSetup';
import OwnerProfilePage from './pages/OwnerProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './styles/App.css';

function AppContent() {
  const [cart, setCart] = useState([]);
  const [searchParams] = useSearchParams();
  const location = useLocation();
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

  // Determine if we are on an administrative or auth portal page to hide customer elements
  const isAdminOrAuthRoute = 
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/owner') ||
    location.pathname.startsWith('/super-admin') ||
    location.pathname.startsWith('/staff') ||
    ['/login', '/verify-otp'].includes(location.pathname);

  return (
    <div className={`app-container${isAdminOrAuthRoute ? ' admin-no-padding' : ''}`}>
      {!isAdminOrAuthRoute && (
        <Navbar tableNumber={tableNumber} cartItemCount={totalItemCount} />
      )}
      
      <main className={`main-content${isAdminOrAuthRoute ? ' admin-full-width' : ''}`}>
        <Routes>
          {/* Customer / Ordering Flow */}
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
                <Navigate to="/login" replace />
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

          {/* Auth Flow */}
          <Route path="/login" element={<Login />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* Role Protected Admin Dashboards */}
          <Route 
            path="/super-admin" 
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/owner-setup" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OwnerSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OwnerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/owner/profile" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OwnerProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/staff" 
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <StaffDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Legacy & Demo routes */}
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
