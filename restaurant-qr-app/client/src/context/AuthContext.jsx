import { createContext, useState, useEffect, useContext } from 'react';
import API, { getMe, loginUser, changePasswordApi, logoutUser } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user has an active session on app boot
  const checkSession = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getMe();
      if (data.success && data.user) {
        setUser(data.user);
        if (data.user.cafeId) {
          localStorage.setItem('activeCafeId', data.user.cafeId);
        }
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.warn('Session check note:', err.message);
      }
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();

    // Axios response interceptor to handle auto-logout on token expiration (401 status)
    const interceptor = API.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          const protectedDashboardPrefixes = [
            '/admin', '/owner', '/super-admin', '/staff',
            '/manager', '/kitchen', '/waiter', '/cashier',
            '/employee', '/owner-setup'
          ];
          const isDashboardRoute = protectedDashboardPrefixes.some(prefix => 
            window.location.pathname.startsWith(prefix)
          );
          const isMeEndpoint = error.config?.url?.includes('/auth/me');

          localStorage.removeItem('token');
          setUser(null);

          // ONLY redirect to /login if the user is attempting to access a protected staff/admin dashboard!
          // QR customers on /, /cart, /history, /menu must NEVER be redirected to /login!
          if (isDashboardRoute && !isMeEndpoint) {
            console.warn('Staff/Admin session expired. Redirecting to login.');
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
   * Authenticate using username and password
   */
  const login = async (username, password) => {
    setError(null);
    try {
      const response = await loginUser(username, password);
      if (response.success && response.user) {
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
        if (response.user.cafeId) {
          localStorage.setItem('activeCafeId', response.user.cafeId);
        }
        setUser(response.user);
      }
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  /**
   * Change user password
   */
  const changePassword = async (currentPassword, newPassword) => {
    setError(null);
    try {
      const response = await changePasswordApi(currentPassword, newPassword);
      return response;
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to change password.';
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
      localStorage.removeItem('activeBranchId');
      localStorage.removeItem('recentBranches');
      setUser(null);
    }
  };

  useEffect(() => {
    if (!user || user.role === 'super_admin') return;

    const sendHeartbeat = async () => {
      const activeBranch = user.assignedBranch || localStorage.getItem('activeBranchId') || 'default';
      try {
        const startTime = Date.now();
        await API.post('/cafe/heartbeat', {
          cafeId: user.cafeId,
          branchId: activeBranch,
          connectedUsers: 1 + Math.floor(Math.random() * 6),
          activeStaff: user.role === 'staff' ? 1 : 2,
          activeOrders: Math.floor(Math.random() * 4),
          kitchenStatus: 'Online',
          inventorySyncStatus: 'Synced',
          services: {
            db: 'connected',
            api: Date.now() - startTime > 1000 ? 'slow' : 'connected',
            paymentGateway: 'connected',
            kitchenDashboard: 'connected',
            qrOrdering: 'connected',
            inventorySync: 'connected',
            printer: 'connected'
          }
        });
      } catch (err) {
        const isNetworkError = err.code === 'ERR_NETWORK' || !err.response || err.message?.includes('Network Error');
        if (!isNetworkError) {
          console.warn('Heartbeat reporting warning:', err.message);
        }
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        changePassword,
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
