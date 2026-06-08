import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { initiateLogin, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to the appropriate dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') navigate('/super-admin', { replace: true });
      else if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'staff') navigate('/staff', { replace: true });
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

  return (
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

        <p className="auth-info-text">
          Enter your registered email address to receive a one-time verification password (OTP). 
          For customers placing table orders, no login is required.
        </p>
      </div>
    </div>
  );
};

export default Login;
