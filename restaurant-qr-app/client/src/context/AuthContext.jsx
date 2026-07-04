import React, { createContext, useState, useEffect, useContext } from 'react';
import API, { getMe, sendOtp, verifyOtp, logoutUser, loginWithGoogleApi, getBranches } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(localStorage.getItem('activeBranchId') || 'default');

  // Check if user has an active session cookie on app boot
  const checkSession = async () => {
    try {
      setLoading(true);
      const data = await getMe();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        
      }
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'owner' || user.role === 'manager')) {
      getBranches().then(res => {
        if (res.success && res.branches) {
          setBranches(res.branches);
          if (!localStorage.getItem('activeBranchId') && res.branches.length > 0) {
            setActiveBranchId(res.branches[0].branchId);
            localStorage.setItem('activeBranchId', res.branches[0].branchId);
          }
        }
      }).catch(err => console.error('Failed to load branches', err));
    } else if (user && user.assignedBranch) {
      setActiveBranchId(user.assignedBranch);
      localStorage.setItem('activeBranchId', user.assignedBranch);
    }
  }, [user]);

  useEffect(() => {
    checkSession();

    // Axios response interceptor to handle auto-logout on token expiration (401 status)
    const interceptor = API.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          const isPublicPath = ['/', '/login', '/payment-demo'].includes(window.location.pathname);
          const isMeEndpoint = error.config?.url?.includes('/auth/me');

          if (!isPublicPath && !isMeEndpoint) {
            console.warn('Session expired or unauthorized. Logging out.');
            localStorage.removeItem('token');
            setUser(null);
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      API.interceptors.response.eject(interceptor);
    };
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
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
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
   * Login with Google credential
   */
  const loginWithGoogle = async (credential) => {
    setError(null);
    try {
      const response = await loginWithGoogleApi(credential);
      if (response.success && response.user) {
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
        setUser(response.user);
      }
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Google authentication failed. Please try again.';
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
      localStorage.removeItem('token');
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
        loginWithGoogle,
        logout,
        checkSession,
        setUser,
        branches,
        activeBranchId,
        setActiveBranchId: (id) => {
          setActiveBranchId(id);
          localStorage.setItem('activeBranchId', id);
        }
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


