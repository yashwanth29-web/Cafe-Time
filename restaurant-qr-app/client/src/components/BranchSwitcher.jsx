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
const BranchRow = ({ branch, isActive, onSelect, showManager = true }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onSelect(branch.branchId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: isActive ? '1px solid rgba(var(--color-primary-rgb, 143,168,155), 0.4)' : '1px solid transparent',
        background: isActive
          ? 'rgba(143, 168, 155, 0.1)'
          : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        position: 'relative'
      }}
    >
      <BranchAvatar branch={branch} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '13.5px',
            fontWeight: isActive ? 800 : 600,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '150px'
          }}>
            {branch.branchName || 'Branch'}
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '10px',
            background: statusColor(branch.isActive) + '22',
            color: statusColor(branch.isActive),
            letterSpacing: '0.5px'
          }}>
            {statusLabel(branch.isActive)}
          </span>
        </div>

        {branch.address && (
          <div style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            📍 {branch.address}
          </div>
        )}
        {showManager && branch.manager && (
          <div style={{ fontSize: '11px', color: '#A0826C', marginTop: '1px' }}>
            👤 {branch.manager}
          </div>
        )}
      </div>

      {isActive && (
        <span style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '11px',
          color: '#fff'
        }}>
          ✓
        </span>
      )}
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? '0' : '10px',
          padding: collapsed ? '6px' : '6px 12px 6px 8px',
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
          <BranchAvatar branch={activeBranch} size={30} />
        ) : (
          <div style={{
            width: 30, height: 30, borderRadius: '8px',
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
              }}>
                {activeBranch?.branchName || 'Select Branch'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
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
          bottom: '4px',
          right: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#2ecc71',
          border: '1.5px solid var(--bg-secondary)'
        }} />
      )}

      {/* ── Dropdown Panel ── */}
      {open && (
        <div style={{
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

          {/* Current branch info card */}
          {activeBranch && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(143,168,155,0.08)',
              border: '1px solid rgba(143,168,155,0.2)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <BranchAvatar branch={activeBranch} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {activeBranch.branchName}
                </div>
                {activeBranch.address && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeBranch.address}
                  </div>
                )}
                {activeBranch.manager && (
                  <div style={{ fontSize: '10px', color: '#A0826C', marginTop: '1px' }}>
                    Manager: {activeBranch.manager}
                  </div>
                )}
              </div>
              <span style={{
                padding: '3px 8px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 700,
                background: '#2ecc7122',
                color: '#2ecc71'
              }}>
                Current
              </span>
            </div>
          )}

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

          {/* Recently used */}
          {!q && recentBranches.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '2px 4px', marginBottom: '4px' }}>
                Recent
              </div>
              {recentBranches.map(b => (
                <BranchRow
                  key={b.branchId}
                  branch={b}
                  isActive={b.branchId === activeBranchId}
                  onSelect={handleSelect}
                  showManager={false}
                />
              ))}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
            </>
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
