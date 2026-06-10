import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route protection wrapper based on authentication and user roles
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        fontFamily: "'Outfit', sans-serif",
        color: '#6F4E37'
      }}>
        <div style={{
          border: '4px solid #F3F3F3',
          borderTop: '4px solid #6F4E37',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '15px'
        }} />
        <p style={{ fontWeight: '500' }}>Validating credentials...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If not authenticated, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Onboarding Setup Safeguard Redirects
  // Allow /owner/profile even during setup so the owner can view/edit their profile anytime
  const setupBypassRoutes = ['/owner-setup', '/owner/profile'];
  const userRole = (user.role || '').toLowerCase();
  
  if (userRole === 'admin' || userRole === 'owner') {
    if (user.setupCompleted === false && !setupBypassRoutes.includes(location.pathname)) {
      return <Navigate to="/owner-setup" replace />;
    }
    if (user.setupCompleted === true && location.pathname === '/owner-setup') {
      return <Navigate to="/owner/dashboard" replace />;
    }
  }

  // If role is not permitted, redirect to the unauthorized warning page
  const normalizedAllowedRoles = (allowedRoles || []).map(r => r.toLowerCase());
  if (allowedRoles && !normalizedAllowedRoles.includes(userRole)) {
    console.warn(`User role ${user.role} unauthorized for this view.`);
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
