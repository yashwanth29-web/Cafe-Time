import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBranch } from '../context/BranchContext';

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const statusColor = (isActive) => (isActive !== false ? '#2ecc71' : '#e74c3c');
const statusLabel = (isActive) => (isActive !== false ? 'Active' : 'Inactive');

const initials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || '??').toUpperCase();
};

/* ─── Branch Avatar ────────────────────────────────────────────────────── */
const BranchAvatar = ({ branch, size = 32 }) => {
  const bg = branch.isActive !== false ? 'var(--color-primary)' : '#555';
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '8px',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.floor(size * 0.38) + 'px',
      fontWeight: 800,
      color: '#fff',
      flexShrink: 0,
      letterSpacing: '-0.5px'
    }}>
      {initials(branch.branchName || 'BR')}
    </div>
  );
};

/* ─── Single Branch Row ─────────────────────────────────────────────────── */
const BranchRow = ({ branch, isActive, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const statusCol = statusColor(branch.isActive);
  const statusLbl = statusLabel(branch.isActive);

  return (
    <button
      onClick={() => onSelect(branch.branchId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        padding: '12px 14px',
        borderRadius: '12px',
        border: isActive ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
        background: isActive
          ? 'rgba(143, 168, 155, 0.12)'
          : hovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        position: 'relative',
        marginBottom: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <BranchAvatar branch={branch} size={28} />
          <span style={{
            fontSize: '13.5px',
            fontWeight: 800,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '160px'
          }}>
            {branch.branchName || 'Branch'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '6px',
            background: statusCol + '22',
            color: statusCol,
            letterSpacing: '0.5px'
          }}>
            {statusLbl}
          </span>
          {isActive && (
            <span style={{
              padding: '2px 6px',
              borderRadius: '6px',
              fontSize: '9px',
              fontWeight: 800,
              background: 'var(--color-primary)',
              color: '#fff'
            }}>
              ACTIVE
            </span>
          )}
        </div>
      </div>

      {branch.address && (
        <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {branch.address}
          </span>
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        borderTop: '1px dashed rgba(255,255,255,0.06)',
        paddingTop: '6px',
        marginTop: '2px'
      }}>
        <span style={{ fontSize: '11px', color: '#A0826C', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>👤</span>
          <span>{branch.manager || 'No Manager'}</span>
        </span>
        <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
          CODE: {branch.branchId}
        </span>
      </div>
    </button>
  );
};

/* ─── Main BranchSwitcher ────────────────────────────────────────────────── */
const BranchSwitcher = ({ collapsed = false }) => {
  const { branches, activeBranchId, activeBranch, recentBranchIds, switchBranch, branchesLoading } = useBranch();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  }, []);

  const handleSelect = useCallback(async (branchId) => {
    if (branchId === activeBranchId || switching) return;
    setSwitching(true);
    try {
      switchBranch(branchId);
      setOpen(false);
      setSearch('');
    } finally {
      setTimeout(() => setSwitching(false), 800);
    }
  }, [activeBranchId, switching, switchBranch]);

  // Only show when owner has branches
  if (!branches || branches.length === 0) {
    if (branchesLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s infinite'
          }} />
          {!collapsed && <div style={{ width: '80px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />}
        </div>
      );
    }
    return null;
  }

  // Filter branches
  const q = search.toLowerCase().trim();
  const filtered = branches.filter(b =>
    !q ||
    (b.branchName || '').toLowerCase().includes(q) ||
    (b.address || '').toLowerCase().includes(q) ||
    (b.manager || '').toLowerCase().includes(q)
  );

  const sorted = [...filtered].sort((a, b) =>
    (a.branchName || '').localeCompare(b.branchName || '')
  );

  const recentBranches = recentBranchIds
    .map(id => branches.find(b => b.branchId === id))
    .filter(Boolean)
    .filter(b => b.branchId !== activeBranchId)
    .slice(0, 3);

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title={activeBranch ? `Branch: ${activeBranch.branchName}` : 'Select Branch'}
        className={collapsed ? "branch-switcher-trigger-collapsed" : "branch-switcher-trigger"}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? '0' : '10px',
          padding: collapsed ? '4px' : '6px 12px 6px 8px',
          borderRadius: '10px',
          border: open ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)',
          background: open ? 'rgba(143, 168, 155, 0.1)' : 'rgba(255,255,255,0.04)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          maxWidth: collapsed ? 'auto' : '240px',
          minWidth: 0
        }}
      >
        {activeBranch ? (
          <BranchAvatar branch={activeBranch} size={28} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '8px',
            background: 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px'
          }}>🏪</div>
        )}

        {!collapsed && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '130px'
              }} className="branch-name-label">
                {activeBranch?.branchName || 'Select Branch'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }} className="branch-count-label">
                {switching ? 'Switching...' : branches.length === 1 ? '1 Branch' : `${branches.length} Branches`}
              </span>
            </div>
            <span style={{
              fontSize: '9px',
              color: 'var(--color-text-secondary)',
              marginLeft: 'auto',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s'
            }}>▼</span>
          </>
        )}
      </button>

      {/* ── Active Branch indicator dot (collapsed) ── */}
      {collapsed && activeBranch && (
        <span style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#2ecc71',
          border: '1.5px solid var(--bg-secondary)',
          zIndex: 10
        }} />
      )}

      {/* ── Dropdown Panel ── */}
      {open && (
        <div className="branch-dropdown-panel" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          width: '320px',
          maxHeight: '480px',
          overflowY: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 9999,
          animation: 'branch-dropdown-in 0.18s ease',
          padding: '12px'
        }}>
          <style>{`
            @keyframes branch-dropdown-in {
              from { opacity: 0; transform: translateY(-8px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .branch-switcher-trigger-collapsed {
              width: 36px !important;
              height: 36px !important;
              border-radius: 8px !important;
              padding: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              border: 1px solid rgba(255,255,255,0.12) !important;
              background: rgba(255,255,255,0.04) !important;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .branch-switcher-trigger-collapsed:hover {
              background: rgba(255,255,255,0.08) !important;
              border-color: var(--color-primary) !important;
            }
            @media (max-width: 480px) {
              .branch-dropdown-panel {
                position: fixed !important;
                top: 70px !important;
                left: 10px !important;
                right: 10px !important;
                width: auto !important;
                max-width: none !important;
                transform: none !important;
                max-height: calc(100vh - 160px) !important;
              }
              .branch-count-label {
                display: none !important;
              }
              .branch-name-label {
                max-width: 80px !important;
                font-size: 11px !important;
              }
              .branch-switcher-trigger {
                padding: 8px 10px 8px 6px !important;
                height: 44px !important;
                max-width: 140px !important;
              }
            }
            @media (min-width: 481px) and (max-width: 1024px) {
              .branch-dropdown-panel {
                right: -60px !important;
                left: auto !important;
              }
              .branch-name-label {
                max-width: 120px !important;
                font-size: 12px !important;
              }
              .branch-switcher-trigger {
                padding: 8px 12px 8px 8px !important;
                height: 44px !important;
                max-width: 200px !important;
              }
            }
          `}</style>

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            padding: '0 4px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Switch Branch
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              {branches.length} total
            </span>
          </div>



          {/* Search */}
          {branches.length > 3 && (
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <span style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                pointerEvents: 'none'
              }}>🔍</span>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search branches..."
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          )}



          {/* All Branches */}
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '2px 4px', marginBottom: '4px' }}>
            {q ? 'Results' : 'All Branches'}
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              No branches found
            </div>
          ) : (
            sorted.map(b => (
              <BranchRow
                key={b.branchId}
                branch={b}
                isActive={b.branchId === activeBranchId}
                onSelect={handleSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default BranchSwitcher;
