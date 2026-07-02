import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BranchProvider } from './context/BranchContext';
import './styles/App.css';
import SaaSLayout from './components/SaaSLayout';

const CustomerMenu = React.lazy(() => import('./pages/CustomerMenu'));
const CartPage = React.lazy(() => import('./pages/CartPage'));
const OrderHistory = React.lazy(() => import('./pages/OrderHistory'));
const OwnerDashboard = React.lazy(() => import('./pages/OwnerDashboard'));
const Login = React.lazy(() => import('./pages/Login'));
const SuperAdminDashboard = React.lazy(() => import('./pages/SuperAdminDashboard'));
const StaffDashboard = React.lazy(() => import('./pages/StaffDashboard'));
const OwnerSetup = React.lazy(() => import('./pages/OwnerSetup'));
const OwnerProfilePage = React.lazy(() => import('./pages/OwnerProfilePage'));
const KitchenDashboard = React.lazy(() => import('./pages/KitchenDashboard'));
const WaiterDashboard = React.lazy(() => import('./pages/WaiterDashboard'));
const CashierDashboard = React.lazy(() => import('./pages/CashierDashboard'));
const ManagerDashboard = React.lazy(() => import('./pages/ManagerDashboard'));
const EmployeePayrollPage = React.lazy(() => import('./pages/EmployeePayrollPage'));
const Unauthorized = React.lazy(() => import('./pages/Unauthorized'));

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
      
    }
  }, [tableParam]);

  // Sync cafeId state when search parameter changes reactively
  useEffect(() => {
    if (cafeIdParam) {
      setCafeId(cafeIdParam);
      sessionStorage.setItem('cafeId', cafeIdParam);
      
    }
  }, [cafeIdParam]);

  // Cart operations
  const addToCart = useCallback((item) => {
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
  }, []);

  const increaseQuantity = useCallback((id) => {
    setCart((prevCart) =>
      prevCart.map((cartItem) =>
        cartItem.item.id === id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      )
    );
  }, []);

  const decreaseQuantity = useCallback((id) => {
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
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prevCart) => prevCart.filter((cartItem) => cartItem.item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalItemCount = useMemo(() => cart.reduce((acc, curr) => acc + curr.quantity, 0), [cart]);

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
    location.pathname === '/login';

  return (
    <div className={`app-container${isAdminOrAuthRoute ? ' admin-no-padding' : ''}`}>
      {!isAdminOrAuthRoute && (
        <Navbar tableNumber={tableNumber} cartItemCount={totalItemCount} />
      )}
      
      <main className={`main-content${isAdminOrAuthRoute ? ' admin-full-width' : ''}`}>
        <Suspense fallback={<div className="app-loading-screen" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#e67e22', fontSize: '1.2rem'}}>Loading Dr. Chai Cafe...</div>}>
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

          <Route path="/login" element={<Login />} />

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
            path="/owner/payroll" 
            element={
              <Navigate to="/owner/dashboard?tab=staff&sub=salary" replace />
            } 
          />
          <Route 
            path="/employee/payroll" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner', 'manager', 'waiter', 'chef', 'cashier', 'staff']}>
                <SaaSLayout>
                  <EmployeePayrollPage />
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
            path="/dashboard" 
            element={<Navigate to="/admin" replace />} 
          />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <BranchProvider>
            <AppContent />
          </BranchProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
