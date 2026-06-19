import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import CustomerMenu from './pages/CustomerMenu';
import CartPage from './pages/CartPage';
import OrderHistory from './pages/OrderHistory';
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
import { ThemeProvider } from './context/ThemeContext';
import KitchenDashboard from './pages/KitchenDashboard';
import WaiterDashboard from './pages/WaiterDashboard';
import CashierDashboard from './pages/CashierDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import './styles/App.css';
import SaaSLayout from './components/SaaSLayout';
import Unauthorized from './pages/Unauthorized';

function AppContent() {
  const [cart, setCart] = useState([]);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const tableParam = searchParams.get('table');
  const cafeIdParam = searchParams.get('cafeId');
  const sourceParam = searchParams.get('source');

  // Synchronously initialize table number state from query param or session storage
  const [tableNumber, setTableNumber] = useState(() => {
    return tableParam || sessionStorage.getItem('tableNumber') || '';
  });

  // Synchronously initialize cafe ID state from query param or session storage
  const [cafeId, setCafeId] = useState(() => {
    return cafeIdParam || sessionStorage.getItem('cafeId') || '';
  });

  // Save source param to session storage if present
  useEffect(() => {
    if (sourceParam) {
      sessionStorage.setItem('orderSource', sourceParam);
    } else if (tableParam || cafeIdParam) {
      sessionStorage.removeItem('orderSource');
    }
  }, [sourceParam, tableParam, cafeIdParam]);

  // Sync tableNumber state when search parameter changes reactively
  useEffect(() => {
    if (tableParam) {
      setTableNumber(tableParam);
      sessionStorage.setItem('tableNumber', tableParam);
      console.log(`Updated table number from URL: ${tableParam}`);
    }
  }, [tableParam]);

  // Sync cafeId state when search parameter changes reactively
  useEffect(() => {
    if (cafeIdParam) {
      setCafeId(cafeIdParam);
      sessionStorage.setItem('cafeId', cafeIdParam);
      console.log(`Updated cafe ID from URL: ${cafeIdParam}`);
    }
  }, [cafeIdParam]);

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
    location.pathname.startsWith('/manager') ||
    location.pathname.startsWith('/kitchen') ||
    location.pathname.startsWith('/waiter') ||
    location.pathname.startsWith('/cashier') ||
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
                cafeId={cafeId}
              />
            } 
          />

          <Route path="/history" element={<OrderHistory cafeId={cafeIdParam || 'CD001'} />} />

          {/* Auth Flow */}
          <Route path="/login" element={<Login />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

           {/* Role Protected Admin Dashboards */}
          <Route 
            path="/super-admin/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SaaSLayout>
                  <SuperAdminDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/owner-setup" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner']}>
                <OwnerSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/owner/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner']}>
                <SaaSLayout>
                  <OwnerDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/owner/profile" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner']}>
                <SaaSLayout>
                  <OwnerProfilePage />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/manager/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner', 'manager']}>
                <SaaSLayout>
                  <ManagerDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/kitchen/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner', 'manager', 'chef']}>
                <SaaSLayout>
                  <KitchenDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/waiter/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner', 'manager', 'waiter', 'staff']}>
                <SaaSLayout>
                  <WaiterDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cashier/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner', 'manager', 'cashier']}>
                <SaaSLayout>
                  <CashierDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/staff/attendance" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner', 'manager', 'waiter', 'chef', 'cashier', 'staff']}>
                <SaaSLayout>
                  <StaffDashboard />
                </SaaSLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/unauthorized" 
            element={<Unauthorized />} 
          />

          {/* Shorthand / Compatibility Redirects */}
          <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="/admin" element={<Navigate to="/owner/dashboard" replace />} />
          <Route path="/staff/dashboard" element={<Navigate to="/waiter/dashboard" replace />} />
          <Route path="/staff" element={<Navigate to="/waiter/dashboard" replace />} />

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
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
