import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Coffee, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthSplit.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter your username');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      await login(username.trim(), password);
      // Navigation is handled automatically by the useEffect above
    } catch (err) {
      setErrorMsg(err.message || 'Invalid username or password.');
      setLoading(false);
    }
  };

  return (
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
            <div className="brand-badges">
              <div className="brand-badge-item">
                <ShieldCheck size={16} color="#D47F46" />
                <span>Encrypted Access</span>
              </div>
              <div className="brand-badge-item">
                <Coffee size={16} color="#D47F46" />
                <span>Multi-Device Ready</span>
              </div>
            </div>
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

          <div className="login-header-group">
            <h1 className="login-heading">Welcome Back</h1>
            <p className="login-subheading">Sign in with your username and password</p>
          </div>

          {errorMsg && (
            <div className="auth-alert auth-alert-error" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-login-form">
            <div className="auth-field-group">
              <label htmlFor="login-username" className="auth-label">
                Username
              </label>
              <div className="auth-input-wrapper">
                <User size={18} className="auth-input-icon" />
                <input
                  id="login-username"
                  type="text"
                  className="auth-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field-group">
              <div className="auth-label-row">
                <label htmlFor="login-password" className="auth-label">
                  Password
                </label>
              </div>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
              id="signin-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner-rotate" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span>Cafe Management Portal</span>
          </div>

          <div className="login-footer-info">
            <p className="login-info-text">
              Forgot password? Contact your cafe administrator or super admin.
            </p>
            <p className="login-info-subtext">
              <strong>Note:</strong> Customers placing table orders do not need to log in.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
