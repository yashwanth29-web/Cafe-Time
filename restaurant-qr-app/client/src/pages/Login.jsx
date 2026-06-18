import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { initiateLogin, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder_client_id_please_replace_me.apps.googleusercontent.com';

  // If already logged in, redirect to the appropriate dashboard
  useEffect(() => {
    if (user) {
      const userRole = (user.role || '').toLowerCase();
      console.log('User already logged in. Redirecting role:', userRole);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email) {
      setErrorMsg('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await initiateLogin(email);
      // Success: redirect to OTP verification screen with email as parameter
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      setErrorMsg(err.message || 'Login attempt failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
          <img src="/logo.png" alt="Cypher's Café Logo" style={{ height: '75px', width: '75px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #6F4E37', marginBottom: '12px', display: 'inline-block' }} />
          <h1>Cypher's Café</h1>
          <p>Login Portal</p>
        </div>

        <h2 className="auth-title">Sign In</h2>

        {errorMsg && (
          <div className="auth-alert auth-alert-error">
            {errorMsg}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="auth-input"
              placeholder="name@cafe.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" />
                Sending OTP...
              </>
            ) : (
              'Send OTP Code'
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <hr style={{ flex: 1, borderTop: '1px solid #D4C3B3' }} />
          <span style={{ padding: '0 10px', color: '#A0826C', fontSize: '14px' }}>OR</span>
          <hr style={{ flex: 1, borderTop: '1px solid #D4C3B3' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        <p className="auth-info-text">
          Enter your registered email address to receive a one-time verification password (OTP). 
          For customers placing table orders, no login is required.
        </p>
      </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;
