import React, { createContext, useState, useEffect, useContext } from 'react';
import { getMe, sendOtp, verifyOtp, logoutUser } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user has an active session cookie on app boot
  const checkSession = async () => {
    try {
      setLoading(true);
      const data = await getMe();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.log('Session validation failed (not logged in):', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  /**
   * Initiate passwordless login by sending an OTP
   */
  const initiateLogin = async (email) => {
    setError(null);
    try {
      const response = await sendOtp(email);
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to send verification code. Please check your email.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  /**
   * Verify the OTP and authenticate the user
   */
  const confirmOtp = async (email, otp) => {
    setError(null);
    try {
      const response = await verifyOtp(email, otp);
      if (response.success && response.user) {
        setUser(response.user);
      }
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Incorrect verification code. Please try again.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  /**
   * Log out the active session
   */
  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        initiateLogin,
        confirmOtp,
        logout,
        checkSession,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
