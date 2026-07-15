import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSetupData, getBranches } from '../services/api';

// Simple global cache for owner header details to prevent redundant page change fetches
export const ownerLayoutCache = {
  cafeName: 'My Cafe',
  logoUrl: '',
  currentBranchName: 'Main Branch',
  hasLoaded: false
};

export const invalidateOwnerLayoutCache = () => {
  ownerLayoutCache.hasLoaded = false;
};

const OwnerLayout = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cafeName, setCafeName] = useState(() => ownerLayoutCache.cafeName);
  const [logoUrl, setLogoUrl] = useState(() => ownerLayoutCache.logoUrl);
  const [currentBranchName, setCurrentBranchName] = useState(() => ownerLayoutCache.currentBranchName);

  // Reset cache and local states when user changes to prevent cross-tenant data leakage
  useEffect(() => {
    ownerLayoutCache.cafeName = 'My Cafe';
    ownerLayoutCache.logoUrl = '';
    ownerLayoutCache.currentBranchName = 'Main Branch';
    ownerLayoutCache.hasLoaded = false;
    
    setCafeName('My Cafe');
    setLogoUrl('');
    setCurrentBranchName('Main Branch');
  }, [user?._id]);

  // Load cafe header data on each page change
  useEffect(() => {
    if (ownerLayoutCache.hasLoaded) return;
    
    const fetchHeaderData = async () => {
      try {
        const res = await getSetupData();
        if (res.success && res.cafe) {
          const name = res.cafe.name || 'My Cafe';
          const logo = res.cafe.logoUrl || '';
          let branchName = 'Main Branch';
          if (res.cafe.city) {
            branchName = `${res.cafe.city} Branch`;
          }
          setCafeName(name);
          setLogoUrl(logo);
          setCurrentBranchName(branchName);
          
          ownerLayoutCache.cafeName = name;
          ownerLayoutCache.logoUrl = logo;
          ownerLayoutCache.currentBranchName = branchName;
        }
        const branchRes = await getBranches();
        if (branchRes.success && branchRes.branches && branchRes.branches.length > 0) {
          const active = branchRes.branches.find(b => b.isActive) || branchRes.branches[0];
          setCurrentBranchName(active.branchName);
          ownerLayoutCache.currentBranchName = active.branchName;
        }
        ownerLayoutCache.hasLoaded = true;
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

