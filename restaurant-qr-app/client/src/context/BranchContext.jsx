import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getBranches } from '../services/api';

const BranchContext = createContext();

const STORAGE_KEY = 'activeBranchId';
const RECENT_KEY = 'recentBranches';

export const BranchProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'default'
  );
  const [recentBranchIds, setRecentBranchIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  });

  // Ref to hold branch-switch listeners
  const switchListeners = useRef([]);

  const loadBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const res = await getBranches();
      if (res && res.success && Array.isArray(res.branches)) {
        setBranches(res.branches);
        // If active branch not found in the list, default to first
        const ids = res.branches.map(b => b.branchId);
        const stored = localStorage.getItem(STORAGE_KEY) || 'default';
        if (res.branches.length > 0 && !ids.includes(stored)) {
          const firstId = res.branches[0].branchId;
          localStorage.setItem(STORAGE_KEY, firstId);
          setActiveBranchId(firstId);
        }
      }
    } catch (err) {
      console.error('BranchContext: failed to load branches', err);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  // Load branches on mount
  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Register listener for branch switch events (used by OwnerDashboard to refresh data)
  const onBranchSwitch = useCallback((fn) => {
    switchListeners.current.push(fn);
    return () => {
      switchListeners.current = switchListeners.current.filter(f => f !== fn);
    };
  }, []);

  const switchBranch = useCallback((branchId) => {
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
  }, [activeBranchId]);

  const activeBranch = branches.find(b => b.branchId === activeBranchId) || branches[0] || null;

  return (
    <BranchContext.Provider value={{
      branches,
      branchesLoading,
      activeBranchId,
      activeBranch,
      recentBranchIds,
      switchBranch,
      loadBranches,
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


