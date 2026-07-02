import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder_client_id_please_replace_me.apps.googleusercontent.com';

  // If already logged in, redirect to the appropriate dashboard
  useEffect(() => {
    if (user) {
      const userRole = (user.role || '').toLowerCase();
      
      if (userRole === 'super_admin') {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (userRole === 'admin' || userRole === 'owner') {
        navigate('/owner/dashboard', { replace: true });
      } else if (userRole === 'manager') {
        navigate('/manager/dashboard', { replace: true });
      } else if (userRole === 'chef') {
        navigate('/kitchen/dashboard', { replace: true });
      } else if (userRole === 'waiter' || userRole === 'staff') {
        navigate('/waiter/dashboard', { replace: true });
      } else if (userRole === 'cashier') {
        navigate('/cashier/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setErrorMsg('');
      await loginWithGoogle(credentialResponse.credential);
      // AuthContext useEffect will automatically handle the redirect once user state is set
    } catch (err) {
      setErrorMsg(err.message || 'Google login failed.');
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrorMsg('Google Login was unsuccessful. Please try again.');
  };

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.svg" alt="Dr. Chai Cafe Logo" style={{ height: '75px', width: '75px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #6F4E37', marginBottom: '12px', display: 'inline-block' }} />
          <h1>Dr. Chai Cafe</h1>
          <p>Login Portal</p>
        </div>

        <h2 className="auth-title">Sign In</h2>

        {errorMsg && (
          <div className="auth-alert auth-alert-error">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 15px auto' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Authenticating with Google...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 40px 0' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          </div>
        )}

        <p className="auth-info-text">
          Sign in using your registered Google workspace or personal email account.
          For customers placing table orders, no login is required.
        </p>
      </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;
