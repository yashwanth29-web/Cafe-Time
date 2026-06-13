import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoHome = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const userRole = (user.role || '').toLowerCase();
    if (userRole === 'super_admin') {
      navigate('/super-admin/dashboard');
    } else if (userRole === 'admin' || userRole === 'owner') {
      navigate('/owner/dashboard');
    } else if (userRole === 'manager') {
      navigate('/manager/dashboard');
    } else if (userRole === 'chef') {
      navigate('/kitchen/dashboard');
    } else if (userRole === 'waiter' || userRole === 'staff') {
      navigate('/waiter/dashboard');
    } else if (userRole === 'cashier') {
      navigate('/cashier/dashboard');
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #121212 0%, #1e1510 100%)',
      padding: '20px',
      fontFamily: "'Outfit', sans-serif"
    }}>
      <div style={{
        background: 'rgba(30, 30, 30, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(231, 76, 60, 0.25)',
        borderRadius: '24px',
        padding: '40px 32px',
        maxWidth: '460px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(231, 76, 60, 0.05)',
        animation: 'scaleUp 0.3s ease-out'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'rgba(231, 76, 60, 0.12)',
          color: '#e74c3c',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          margin: '0 auto 24px auto',
          border: '1px solid rgba(231, 76, 60, 0.25)',
          boxShadow: '0 8px 16px rgba(231, 76, 60, 0.1)'
        }}>
          🔒
        </div>
        <h1 style={{
          color: 'var(--color-text-primary)',
          fontSize: '26px',
          fontWeight: 900,
          marginBottom: '10px',
          letterSpacing: '-0.5px'
        }}>
          Access Denied (403)
        </h1>
        <p style={{
          color: 'var(--color-text-secondary, #b3b3b3)',
          fontSize: '14.5px',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          You do not have permission to view this page. This resource is restricted to authorized roles only.
        </p>

        {user &&
        <div style={{
          background: 'rgba(0, 0, 0, 0.02)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13.5px'
        }}>
            <span style={{ color: '#888' }}>Logged in as:</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>
              {user.name} ({user.role})
            </span>
          </div>
        }

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleGoHome}
            style={{
              padding: '14px',
              background: 'linear-gradient(135deg, var(--color-primary, #ff6b08) 0%, #aa820a 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'var(--color-text-primary)',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(255, 107, 8, 0.2)',
              transition: 'transform 0.2s ease'
            }}>
            
            Go to My Dashboard
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              color: '#ff9800',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
            
            Logout & Switch Accounts
          </button>
        </div>
      </div>
    </div>);

};

export default Unauthorized;