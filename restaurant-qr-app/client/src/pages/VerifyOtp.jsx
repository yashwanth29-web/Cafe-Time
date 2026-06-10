import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resendOtp } from '../services/api';
import '../styles/Auth.css';

const VerifyOtp = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const navigate = useNavigate();
  const { confirmOtp, user } = useAuth();

  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const isVerifyingRef = useRef(false);
  
  // Resend Timer State
  const [timer, setTimer] = useState(60);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Redirect to login if email is missing on mount
  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  // If already logged in, redirect to the appropriate dashboard
  useEffect(() => {
    if (user) {
      if (isVerifyingRef.current) return;
      const userRole = (user.role || '').toLowerCase();
      console.log('User already logged in on OTP page. Redirecting role:', userRole);
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

  // Countdown timer for resend safety
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Autofocus first box
  useEffect(() => {
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, []);

  const handleChange = (index, value) => {
    setErrorMsg('');
    
    // Only accept numeric inputs
    if (isNaN(value)) return;

    const newOtpValues = [...otpValues];
    // Keep only the last character entered
    newOtpValues[index] = value.substring(value.length - 1);
    setOtpValues(newOtpValues);

    // Automatically shift focus to the next input box
    if (value && index < 5 && inputRefs[index + 1].current) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // If Backspace is pressed, clear current and focus previous input
    if (e.key === 'Backspace') {
      setErrorMsg('');
      if (!otpValues[index] && index > 0 && inputRefs[index - 1].current) {
        const newOtpValues = [...otpValues];
        newOtpValues[index - 1] = '';
        setOtpValues(newOtpValues);
        inputRefs[index - 1].current.focus();
      } else if (otpValues[index]) {
        const newOtpValues = [...otpValues];
        newOtpValues[index] = '';
        setOtpValues(newOtpValues);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    
    // Validate paste is a 6-digit number
    if (!/^\d{6}$/.test(pasteData)) {
      setErrorMsg('Please paste a valid 6-digit verification code.');
      return;
    }

    const pasteArray = pasteData.split('');
    setOtpValues(pasteArray);
    
    // Focus the last input box
    if (inputRefs[5].current) {
      inputRefs[5].current.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const otp = otpValues.join('');
    if (otp.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      isVerifyingRef.current = true;
      const data = await confirmOtp(email, otp);

      if (data.success && data.user) {
        setSuccessMsg('Successfully logged in! Redirecting...');
        
        // Dynamic dashboard routing based on authenticated user role
        setTimeout(() => {
          const userRole = (data.user.role || '').toLowerCase();
          console.log('Redirecting user with role:', userRole);
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
        }, 1200);
      }
    } catch (err) {
      isVerifyingRef.current = false;
      setErrorMsg(err.message || 'OTP verification failed. Please try again.');
      // Focus first input on failure and clear boxes
      setOtpValues(['', '', '', '', '', '']);
      if (inputRefs[0].current) {
        inputRefs[0].current.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resendAttempts >= 3) return;

    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      setLoading(true);
      const res = await resendOtp(email);
      setSuccessMsg('A new verification code has been sent.');
      setTimer(60);
      setCanResend(false);
      setResendAttempts((prev) => prev + 1);
      setOtpValues(['', '', '', '', '', '']);
      if (inputRefs[0].current) {
        inputRefs[0].current.focus();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to resend verification code. Please try again.');
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
          <p>Security Check</p>
        </div>

        <h2 className="auth-title">Verify Your OTP</h2>
        <p style={{ fontSize: '0.9rem', color: '#D4C3B3', textAlign: 'left', marginBottom: '20px', lineHeight: '1.4' }}>
          We sent a verification code to <strong style={{ color: '#ffffff' }}>{email}</strong>. Please enter it below.
        </p>

        {errorMsg && <div className="auth-alert auth-alert-error">{errorMsg}</div>}
        {successMsg && <div className="auth-alert auth-alert-success">{successMsg}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label>6-Digit Verification Code</label>
            <div className="otp-container" onPaste={handlePaste}>
              {otpValues.map((value, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  className="otp-box"
                  ref={inputRefs[index]}
                  value={value}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={loading}
                  pattern="\d*"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              ))}
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" />
                Verifying Code...
              </>
            ) : (
              'Verify & Authenticate'
            )}
          </button>
        </form>

        <div className="resend-section">
          {resendAttempts >= 3 ? (
            <span style={{ color: '#FF8A8A', fontSize: '0.85rem' }}>
              Maximum resend attempts reached. Please request a new login session.
            </span>
          ) : (
            <>
              <span style={{ color: '#9E8E8E' }}>Didn't receive the email?</span>
              <button 
                type="button" 
                onClick={handleResend} 
                className="resend-btn" 
                disabled={!canResend || loading}
              >
                Resend Code
              </button>
              {!canResend && (
                <span className="resend-timer">
                  Resend available in {timer}s
                </span>
              )}
            </>
          )}
        </div>

        <Link to="/login" className="back-link">
          ← Back to Login
        </Link>
      </div>
    </div>
  );
};

export default VerifyOtp;
