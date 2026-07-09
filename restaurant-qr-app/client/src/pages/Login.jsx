import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthSplit.css';

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
      <div className="login-split-container">
        {/* Left Side: Brand Imagery */}
        <div className="login-left-panel">
          <div className="login-overlay">
            <div className="brand-content">
              <div className="brand-logo-container">
                <img src="/logo.png" alt="Dr. Chai Cafe Logo" className="brand-logo-img" />
              </div>
              <h1 className="brand-title">Dr. Chai Cafe</h1>
              <p className="brand-subtitle">
                Premium Management & Staff Portal. <br />
                Empowering your cafe's daily operations.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="login-right-panel">
          <div className="login-form-container">
            
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="mobile-brand-header">
              <img src="/logo.png" alt="Dr. Chai Cafe Logo" className="mobile-logo-img" />
              <h2 style={{ margin: 0, color: '#1a1a1a', fontWeight: 800 }}>Dr. Chai Cafe</h2>
            </div>

            <h1 className="login-heading">Welcome Back</h1>
            <p className="login-subheading">Please sign in to access your dashboard</p>

            {errorMsg && (
              <div className="auth-alert auth-alert-error" style={{ marginBottom: '24px' }}>
                {errorMsg}
              </div>
            )}

            <div className="google-auth-section">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--color-primary)' }} />
                  <p>Authenticating securely...</p>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_black"
                  size="large"
                  text="signin_with"
                  shape="pill"
                />
              )}
            </div>

            <div className="login-divider">
              <span>Secure Access</span>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888', lineHeight: '1.5' }}>
              Sign in using your registered Google Workspace or personal email account. <br />
              <strong style={{ color: '#555' }}>Note:</strong> Customers placing table orders do not need to login.
            </p>

          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;

