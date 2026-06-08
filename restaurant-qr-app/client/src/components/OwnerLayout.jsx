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
    <div className="owner-layout-wrapper">
      <style>{`
        .owner-layout-wrapper {
          min-height: 100vh;
          background-color: #1F140E;
          font-family: 'Outfit', 'Inter', sans-serif;
          color: #FAF6F0;
        }

        /* ─── STICKY HEADER ─────────────────────────── */
        .owner-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(31, 20, 14, 0.92);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(230, 213, 195, 0.12);
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* ─── LOGO / CAFE NAME — clickable → dashboard ─ */
        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          border-radius: 10px;
          padding: 6px 8px;
          margin-left: -8px;
          transition: background 0.2s;
          user-select: none;
          text-decoration: none;
        }
        .header-brand:hover {
          background: rgba(230, 213, 195, 0.07);
        }
        .header-brand:active {
          background: rgba(230, 213, 195, 0.12);
        }
        .cafe-logo-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(230, 213, 195, 0.4);
          background: #2B1D15;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 1rem;
        }
        .cafe-logo-circle img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cafe-meta {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .cafe-name-text {
          font-size: 1rem;
          font-weight: 800;
          color: #FAF6F0;
          line-height: 1.2;
          letter-spacing: -0.2px;
        }
        .cafe-branch-text {
          font-size: 0.72rem;
          font-weight: 600;
          color: #A0826C;
          line-height: 1;
        }

        /* ─── RIGHT SIDE — avatar only ─────────────────── */
        .header-avatar-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6F4E37, #3E2723);
          border: 2px solid rgba(230, 213, 195, 0.5);
          color: #FAF6F0;
          font-weight: 800;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
          flex-shrink: 0;
          font-family: inherit;
        }
        .header-avatar-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 0 0 3px rgba(230, 213, 195, 0.2);
        }
        .header-avatar-btn.active {
          border-color: #E6D5C3;
          box-shadow: 0 0 0 3px rgba(230, 213, 195, 0.25);
        }

        /* ─── MAIN CONTENT ──────────────────────────── */
        .owner-main-content {
          width: 100%;
        }

        /* ─── SECTION HIGHLIGHT ANIMATION ──────────── */
        .highlight-section {
          animation: glowBorder 2s ease-out;
        }
        @keyframes glowBorder {
          0%, 100% { border-color: rgba(230, 213, 195, 0.12); box-shadow: none; }
          50% { border-color: #ff9800; box-shadow: 0 0 18px rgba(255, 152, 0, 0.25); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ─── RESPONSIVE ────────────────────────────── */
        @media (max-width: 640px) {
          .owner-header {
            padding: 0 16px;
            height: 56px;
          }
          .cafe-name-text { font-size: 0.9rem; }
        }
      `}</style>

      {/* ─── HEADER ─────────────────────────────────── */}
      <header className="owner-header">
        {/* Brand / Logo → navigates to dashboard */}
        <div
          className="header-brand"
          onClick={() => navigate('/admin')}
          role="button"
          aria-label="Go to Dashboard"
        >
          <div className="cafe-logo-circle">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" />
            ) : (
              <span>☕</span>
            )}
          </div>
          <div className="cafe-meta">
            <span className="cafe-name-text">{cafeName}</span>
            <span className="cafe-branch-text">📍 {currentBranchName}</span>
          </div>
        </div>

        {/* Avatar → navigates to profile page */}
        <button
          className={`header-avatar-btn ${isOnProfile ? 'active' : ''}`}
          onClick={() => navigate('/owner/profile')}
          title={`${user?.name || 'Owner'} — View Profile`}
        >
          {getInitials(user?.name)}
        </button>
      </header>

      {/* ─── PAGE CONTENT ───────────────────────────── */}
      <main className="owner-main-content">
        {children}
      </main>
    </div>
  );
};

export default OwnerLayout;
