import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getBranches } from '../services/api';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket } from '../socket';

const BranchContext = createContext();

const STORAGE_KEY = 'activeBranchId';
const RECENT_KEY = 'recentBranches';

export const BranchProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [recentBranchIds, setRecentBranchIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  });

  // Ref to hold branch-switch listeners
  const switchListeners = useRef([]);

  const { user, loading } = useAuth();

  const loadBranches = useCallback(async (currentUser) => {
    if (!currentUser) return;
    setBranchesLoading(true);
    try {
      const res = await getBranches();
      if (res && res.success && Array.isArray(res.branches)) {
        setBranches(res.branches);
        
        const role = (currentUser.role || '').toLowerCase();
        if (['super_admin', 'admin', 'owner'].includes(role)) {
          const stored = localStorage.getItem(STORAGE_KEY);
          const ids = res.branches.map(b => b.branchId);
          let newActiveId = stored;
          
          if (stored && (ids.includes(stored) || stored === 'all')) {
            setActiveBranchId(stored);
          } else if (res.branches.length > 0) {
            const firstId = res.branches[0].branchId;
            localStorage.setItem(STORAGE_KEY, firstId);
            setActiveBranchId(firstId);
            newActiveId = firstId;
          } else {
            setActiveBranchId('default');
            newActiveId = 'default';
          }
          
          if (newActiveId !== stored) {
            switchListeners.current.forEach(fn => {
              try { fn(newActiveId); } catch (e) {}
            });
          }
        } else {
          // Staff are strictly locked to their database assignment
          const assigned = currentUser.assignedBranch || 'default';
          setActiveBranchId(assigned);
        }
      }
    } catch (err) {
      console.error('BranchContext: failed to load branches', err);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  // Sync with user authentication state
  useEffect(() => {
    if (loading) return;
    if (user) {
      // Determine initial active branch ID from database assignment before API call finishes
      const role = (user.role || '').toLowerCase();
      if (['super_admin', 'admin', 'owner'].includes(role)) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setActiveBranchId(stored);
        } else {
          localStorage.setItem(STORAGE_KEY, 'default');
          setActiveBranchId('default');
        }
      } else {
        const assigned = user.assignedBranch || 'default';
        localStorage.setItem(STORAGE_KEY, assigned);
        setActiveBranchId(assigned);
      }
      loadBranches(user);
    } else {
      // Clear state on logout
      setBranches([]);
      setActiveBranchId(null);
      setRecentBranchIds([]);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RECENT_KEY);
      try {
        disconnectSocket();
      } catch (e) {}
    }
  }, [user, loading, loadBranches]);

  // Connect socket only after branch initialization
  useEffect(() => {
    if (user && user.cafeId && activeBranchId) {
      connectSocket(user.cafeId, activeBranchId);
    }
  }, [user, activeBranchId]);

  // Register listener for branch switch events (used by dashboards to refresh data)
  const onBranchSwitch = useCallback((fn) => {
    switchListeners.current.push(fn);
    return () => {
      switchListeners.current = switchListeners.current.filter(f => f !== fn);
    };
  }, []);

  const switchBranch = useCallback((branchId) => {
    if (!user) return;
    const role = (user.role || '').toLowerCase();
    if (!['super_admin', 'admin', 'owner'].includes(role)) {
      console.warn('Unauthorized branch switch attempt ignored.');
      return;
    }

    if (branchId === activeBranchId) return; // no-op if already active
    localStorage.setItem(STORAGE_KEY, branchId);
    setActiveBranchId(branchId);

    // Track recently used (max 5)
    setRecentBranchIds(prev => {
      const filtered = prev.filter(id => id !== branchId);
      const next = [branchId, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });

    // Notify all registered listeners
    switchListeners.current.forEach(fn => {
      try { fn(branchId); } catch (e) {}
    });
  }, [activeBranchId, user]);

  const activeBranch = branches.find(b => b.branchId === activeBranchId) || branches[0] || null;

  return (
    <BranchContext.Provider value={{
      branches,
      branchesLoading,
      activeBranchId,
      activeBranch,
      recentBranchIds,
      switchBranch,
      loadBranches: () => loadBranches(user),
      onBranchSwitch
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
};


