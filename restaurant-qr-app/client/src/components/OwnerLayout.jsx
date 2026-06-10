import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSetupData, getBranches } from '../services/api';

const OwnerLayout = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cafeName, setCafeName] = useState('My Cafe');
  const [logoUrl, setLogoUrl] = useState('');
  const [currentBranchName, setCurrentBranchName] = useState('Main Branch');

  // Load cafe header data on each page change
  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        const res = await getSetupData();
        if (res.success && res.cafe) {
          setCafeName(res.cafe.name || 'My Cafe');
          setLogoUrl(res.cafe.logoUrl || '');
          if (res.cafe.city) {
            setCurrentBranchName(`${res.cafe.city} Branch`);
          }
        }
        const branchRes = await getBranches();
        if (branchRes.success && branchRes.branches && branchRes.branches.length > 0) {
          const active = branchRes.branches.find(b => b.isActive) || branchRes.branches[0];
          setCurrentBranchName(active.branchName);
        }
      } catch (err) {
        // Silently fail — header still renders with defaults
      }
    };
    fetchHeaderData();
  }, [location.pathname]);

  // Get owner initials for avatar
  const getInitials = (name) => {
    if (!name) return 'OW';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const isOnProfile = location.pathname === '/owner/profile';

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      {children}
    </div>
  );
};

export default OwnerLayout;
