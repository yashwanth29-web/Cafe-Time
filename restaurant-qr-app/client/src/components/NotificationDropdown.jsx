import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordPurchase } from '../services/api';

const NotificationDropdown = ({
  isOpen,
  onClose,
  lowStockAlerts = [],
  notifications = [],
  onMarkAsRead,
  userRole = '',
  onDismissLowStock
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'critical', 'low', 'system'
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedStockItems, setDismissedStockItems] = useState(new Set());

  // Quick Restock In-Modal Form State
  const [selectedRestockItem, setSelectedRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockTotalBill, setRestockTotalBill] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockSuccessMsg, setRestockSuccessMsg] = useState('');
  const [restockErrorMsg, setRestockErrorMsg] = useState('');

  // Close dropdown on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (selectedRestockItem) {
          setSelectedRestockItem(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, selectedRestockItem]);

  // Categorize stock alerts
  const activeStockAlerts = useMemo(() => {
    return (lowStockAlerts || []).filter(item => !dismissedStockItems.has(item.name));
  }, [lowStockAlerts, dismissedStockItems]);

  const criticalItems = useMemo(() => {
    return activeStockAlerts.filter(item => {
      const qty = Number(item.quantity !== undefined ? item.quantity : item.stock) || 0;
      return qty <= 0;
    });
  }, [activeStockAlerts]);

  const warningItems = useMemo(() => {
    return activeStockAlerts.filter(item => {
      const qty = Number(item.quantity !== undefined ? item.quantity : item.stock) || 0;
      return qty > 0;
    });
  }, [activeStockAlerts]);

  // Combined and filtered notifications
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let stockList = [];
    if (activeTab === 'all') {
      stockList = [...criticalItems, ...warningItems];
    } else if (activeTab === 'critical') {
      stockList = criticalItems;
    } else if (activeTab === 'low') {
      stockList = warningItems;
    }

    if (q) {
      stockList = stockList.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }

    let sysList = [];
    if (activeTab === 'all' || activeTab === 'system') {
      sysList = (notifications || []).filter(n => {
        if (!q) return true;
        return (n.title || '').toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q);
      });
    }

    return {
      stock: stockList,
      system: sysList,
      totalMatches: stockList.length + sysList.length
    };
  }, [activeTab, searchQuery, criticalItems, warningItems, notifications]);

  // Open Quick Restock Dialog inside notification view
  const handleOpenRestockModal = (item, e) => {
    if (e) e.stopPropagation();
    setSelectedRestockItem(item);
    setRestockQty('');
    setRestockTotalBill('');
    setRestockCost(item.costPrice !== undefined ? String(item.costPrice) : (item.cost !== undefined ? String(item.cost) : ''));
    setRestockSupplier(item.supplier || '');
    setRestockNotes('');
    setRestockSuccessMsg('');
    setRestockErrorMsg('');
  };

  // Bidirectional Auto-calculation handlers
  const handleQuantityChange = (val) => {
    const qty = parseFloat(val);
    const unitCost = parseFloat(restockCost);
    let newTotal = restockTotalBill;

    if (!isNaN(qty) && qty > 0 && !isNaN(unitCost) && unitCost >= 0) {
      newTotal = Number((qty * unitCost).toFixed(2));
    } else if (val === '') {
      newTotal = '';
    }

    setRestockQty(val);
    setRestockTotalBill(newTotal);
  };

  const handleTotalBillChange = (val) => {
    const total = parseFloat(val);
    const qty = parseFloat(restockQty);
    let newUnitCost = restockCost;

    if (!isNaN(total) && !isNaN(qty) && qty > 0) {
      newUnitCost = Number((total / qty).toFixed(4));
    }

    setRestockTotalBill(val);
    setRestockCost(newUnitCost);
  };

  const handleCostPriceChange = (val) => {
    const unitCost = parseFloat(val);
    const qty = parseFloat(restockQty);
    let newTotal = restockTotalBill;

    if (!isNaN(unitCost) && !isNaN(qty) && qty > 0) {
      newTotal = Number((qty * unitCost).toFixed(2));
    }

    setRestockCost(val);
    setRestockTotalBill(newTotal);
  };

  // Submit Restock Purchase Entry
  const handleConfirmRestock = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedRestockItem) return;
    const addedAmount = parseFloat(restockQty);
    if (!addedAmount || addedAmount <= 0) {
      setRestockErrorMsg('Please enter a valid quantity greater than 0.');
      return;
    }

    setRestockLoading(true);
    setRestockErrorMsg('');
    setRestockSuccessMsg('');

    try {
      const itemId = selectedRestockItem._id || selectedRestockItem.id;
      const payload = {
        itemId,
        quantityAdded: addedAmount,
        costPrice: parseFloat(restockCost) || undefined,
        totalCost: parseFloat(restockTotalBill) || undefined,
        supplier: restockSupplier ? restockSupplier.trim() : undefined,
        notes: restockNotes ? restockNotes.trim() : 'Quick Restock via Notification Hub'
      };

      const res = await recordPurchase(payload);
      if (res && res.success) {
        setRestockSuccessMsg(`Added ${addedAmount} ${selectedRestockItem.unit || 'units'} to ${selectedRestockItem.name}!`);
        
        // Remove item from low stock alerts list
        setDismissedStockItems(prev => new Set([...prev, selectedRestockItem.name]));
        if (onDismissLowStock) {
          onDismissLowStock(selectedRestockItem.name);
        }

        setTimeout(() => {
          setSelectedRestockItem(null);
          setRestockSuccessMsg('');
        }, 1200);
      } else {
        setRestockErrorMsg(res?.message || 'Failed to record purchase entry.');
      }
    } catch (err) {
      console.error('Quick restock error:', err);
      setRestockErrorMsg(err.response?.data?.message || err.message || 'Error processing purchase entry.');
    } finally {
      setRestockLoading(false);
    }
  };

  const handleDismissStockAlert = (itemName, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDismissedStockItems(prev => new Set([...prev, itemName]));
    if (onDismissLowStock) {
      onDismissLowStock(itemName);
    }
  };

  const handleClearAll = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const allNames = new Set(activeStockAlerts.map(i => i.name));
    setDismissedStockItems(prev => new Set([...prev, ...allNames]));
    (notifications || []).forEach(n => {
      if (!n.isRead && onMarkAsRead) {
        onMarkAsRead(n._id);
      }
    });
  };

  if (!isOpen) return null;

  const totalAlertsCount = activeStockAlerts.length + (notifications || []).filter(n => !n.isRead).length;

  return (
    <>
      {/* Backdrop overlay for reliable outside-click dismissal on both mobile and desktop */}
      <div
        className="notif-backdrop"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)'
        }}
      />

      {/* Main Dropdown Container */}
      <div
        ref={dropdownRef}
        className="notif-dropdown-card"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '52px',
          right: 0,
          width: '420px',
          maxWidth: 'calc(100vw - 24px)',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EFE4D6',
          boxShadow: '0 20px 40px -8px rgba(60, 42, 20, 0.22), 0 8px 16px -4px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'notifFadeSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontFamily: "'Outfit', sans-serif"
        }}
      >
        <style>{`
          @keyframes notifFadeSlide {
            from { opacity: 0; transform: translateY(-8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (max-width: 640px) {
            .notif-dropdown-card {
              position: fixed !important;
              top: 56px !important;
              left: 12px !important;
              right: 12px !important;
              width: auto !important;
              max-width: calc(100vw - 24px) !important;
              max-height: calc(100vh - 75px) !important;
            }
          }
          .notif-scroll-area::-webkit-scrollbar {
            width: 5px;
          }
          .notif-scroll-area::-webkit-scrollbar-track {
            background: #FAF6F0;
          }
          .notif-scroll-area::-webkit-scrollbar-thumb {
            background: #D9C5B2;
            border-radius: 10px;
          }
          .notif-scroll-area::-webkit-scrollbar-thumb:hover {
            background: #BFA58E;
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '16px 16px 12px 16px',
          borderBottom: '1px solid #F3EDE4',
          backgroundColor: '#FDFBF7'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>🔔</span>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#2C1E16', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                Notifications & Alerts
              </span>
              {totalAlertsCount > 0 && (
                <span style={{
                  backgroundColor: criticalItems.length > 0 ? '#FEE2E2' : '#FEF3C7',
                  color: criticalItems.length > 0 ? '#DC2626' : '#D97706',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: criticalItems.length > 0 ? '1px solid #FECACA' : '1px solid #FDE68A',
                  flexShrink: 0
                }}>
                  {totalAlertsCount}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {totalAlertsCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  title="Dismiss and mark all alerts as read"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9C7A60',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'background 0.15s, color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F4EAE0'; e.currentTarget.style.color = '#6F4E37'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9C7A60'; }}
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8C705D',
                  cursor: 'pointer',
                  fontSize: '15px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFE4D6'; e.currentTarget.style.color = '#2C1E16'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8C705D'; }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', marginTop: '6px' }}>
            <input
              type="text"
              placeholder="Search alerts (e.g. Butter, Milk)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5D7C7',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#2C1E16',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#C27D5F'; e.target.style.boxShadow = '0 0 0 2px rgba(194, 125, 95, 0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5D7C7'; e.target.style.boxShadow = 'none'; }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '7px', fontSize: '13px', color: '#A8927F' }}>🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#A8927F',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('all');
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: activeTab === 'all' ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                backgroundColor: activeTab === 'all' ? '#6F4E37' : '#EFE8DE',
                color: activeTab === 'all' ? '#FFFFFF' : '#6F4E37',
                transition: 'all 0.15s'
              }}
            >
              All ({activeStockAlerts.length + (notifications || []).length})
            </button>

            {criticalItems.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('critical');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: activeTab === 'critical' ? 700 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  backgroundColor: activeTab === 'critical' ? '#DC2626' : '#FEE2E2',
                  color: activeTab === 'critical' ? '#FFFFFF' : '#DC2626',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🚨 Out of Stock</span>
                <span>({criticalItems.length})</span>
              </button>
            )}

            {warningItems.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('low');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: activeTab === 'low' ? 700 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  backgroundColor: activeTab === 'low' ? '#D97706' : '#FEF3C7',
                  color: activeTab === 'low' ? '#FFFFFF' : '#D97706',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>⚠️ Low Stock</span>
                <span>({warningItems.length})</span>
              </button>
            )}

            {(notifications || []).length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('system');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: activeTab === 'system' ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  backgroundColor: activeTab === 'system' ? '#4A6B82' : '#E8EEF2',
                  color: activeTab === 'system' ? '#FFFFFF' : '#4A6B82',
                  transition: 'all 0.15s'
                }}
              >
                System ({(notifications || []).length})
              </button>
            )}
          </div>
        </div>

        {/* List Content OR Quick Restock Modal View */}
        {selectedRestockItem ? (
          /* ================= INLINE QUICK RESTOCK FORM ================= */
          <div
            className="notif-scroll-area"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#FAF7F2',
              maxHeight: '380px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EBE1D5', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>📦</span>
                <strong style={{ fontSize: '14px', color: '#2C1E16', textTransform: 'uppercase' }}>
                  Record Purchase Entry
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRestockItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8C705D',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                ← Back
              </button>
            </div>

            {/* Current Stock Snapshot */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #EAE0D3',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ color: '#8C705D' }}>Ingredient: </span>
                <strong style={{ color: '#2C1E16' }}>{selectedRestockItem.name}</strong>
                {selectedRestockItem.unit && <span style={{ color: '#8C705D' }}> ({selectedRestockItem.unit})</span>}
              </div>
              <div>
                <span style={{ color: '#8C705D' }}>Current: </span>
                <strong style={{ color: selectedRestockItem.quantity <= 0 ? '#DC2626' : '#D97706' }}>
                  {selectedRestockItem.quantity !== undefined ? selectedRestockItem.quantity : selectedRestockItem.stock} {selectedRestockItem.unit || ''}
                </strong>
              </div>
            </div>

            {/* Feedback messages */}
            {restockSuccessMsg && (
              <div style={{
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                ✅ {restockSuccessMsg}
              </div>
            )}

            {restockErrorMsg && (
              <div style={{
                backgroundColor: '#FEF2F2',
                color: '#991B1B',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                ❌ {restockErrorMsg}
              </div>
            )}

            {/* Form Fields Matching Full Inventory Purchase Entry */}
            <form onSubmit={handleConfirmRestock} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#2C1E16', marginBottom: '4px' }}>
                    QUANTITY PURCHASED ({selectedRestockItem.unit || 'Units'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    required
                    min="0.0001"
                    placeholder="e.g. 10"
                    value={restockQty}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #D5C2AF',
                      fontSize: '12.5px',
                      color: '#2C1E16',
                      outline: 'none',
                      fontWeight: 600
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#2C1E16', marginBottom: '4px' }}>
                    TOTAL BILL AMOUNT (₹) <span style={{ fontWeight: 400, color: '#8C705D' }}>(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 150"
                    value={restockTotalBill}
                    onChange={(e) => handleTotalBillChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #D5C2AF',
                      fontSize: '12.5px',
                      color: '#2C1E16',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#2C1E16', marginBottom: '4px' }}>
                  COST PRICE PER {selectedRestockItem.unit || 'UNIT'} (₹) *
                  <span style={{ fontSize: '10px', color: '#8C705D', fontWeight: 400, display: 'block' }}>
                    (Auto-calculated from ingredient / total bill)
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="e.g. 0.045"
                  value={restockCost}
                  onChange={(e) => handleCostPriceChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #D5C2AF',
                    fontSize: '12.5px',
                    color: '#2C1E16',
                    outline: 'none',
                    fontWeight: 600,
                    backgroundColor: '#FFFFFF'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5C4331', marginBottom: '4px' }}>
                    SUPPLIER (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Metro Cash & Carry"
                    value={restockSupplier}
                    onChange={(e) => setRestockSupplier(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #E0D4C5',
                      fontSize: '12px',
                      color: '#2C1E16',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5C4331', marginBottom: '4px' }}>
                    NOTES (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly restocking"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #E0D4C5',
                      fontSize: '12px',
                      color: '#2C1E16',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedRestockItem(null)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid #D5C2AF',
                    backgroundColor: '#FFFFFF',
                    color: '#6F4E37',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={restockLoading || !restockQty}
                  style={{
                    flex: 2,
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: restockLoading || !restockQty ? '#C8B5A3' : '#D97706',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: restockLoading || !restockQty ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
                    transition: 'background-color 0.15s'
                  }}
                >
                  {restockLoading ? 'Recording Entry...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ================= NORMAL NOTIFICATION LIST ================= */
          <div
            className="notif-scroll-area"
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {filteredList.totalMatches === 0 ? (
              <div style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: '#8C705D'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✨</div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#2C1E16', marginBottom: '4px' }}>
                  {searchQuery ? 'No matching alerts found' : 'All Clear!'}
                </div>
                <div style={{ fontSize: '12px', color: '#A0826C' }}>
                  {searchQuery ? `No items matched "${searchQuery}"` : 'All inventory levels are sufficient and no unread notifications.'}
                </div>
              </div>
            ) : (
              <>
                {/* Stock Alerts */}
                {filteredList.stock.map((item, idx) => {
                  const qty = Number(item.quantity !== undefined ? item.quantity : item.stock) || 0;
                  const isOut = qty <= 0;
                  const reorder = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;

                  return (
                    <div
                      key={`stock-${item.name}-${idx}`}
                      style={{
                        backgroundColor: isOut ? '#FFF5F5' : '#FFFBF5',
                        border: isOut ? '1px solid #FEE2E2' : '1px solid #F7ECD9',
                        borderLeft: isOut ? '4px solid #DC2626' : '4px solid #D97706',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', flexShrink: 0 }}>{isOut ? '🚨' : '⚠️'}</span>
                            <strong style={{ fontSize: '13px', color: '#2C1E16', textTransform: 'uppercase', letterSpacing: '0.2px', wordBreak: 'break-word' }}>
                              {item.name}
                            </strong>
                          </div>
                          <div style={{ fontSize: '11.5px', color: isOut ? '#B91C1C' : '#92400E', marginTop: '2px', fontWeight: 500 }}>
                            {isOut ? (
                              <span style={{ fontWeight: 700 }}>Out of Stock (0 {item.unit || 'pcs'} left)</span>
                            ) : (
                              <span>Running low ({qty} {item.unit || 'g'} left)</span>
                            )}
                            {reorder !== undefined && (
                              <span style={{ color: '#8C705D', fontWeight: 400 }}> · Min: {reorder} {item.unit || 'g'}</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDismissStockAlert(item.name, e)}
                          title="Dismiss this alert"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#B09B8B',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '4px',
                            lineHeight: 1,
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#6F4E37'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#B09B8B'; }}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <button
                          type="button"
                          onClick={(e) => handleOpenRestockModal(item, e)}
                          style={{
                            backgroundColor: isOut ? '#DC2626' : '#C27D5F',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                            transition: 'background-color 0.15s, transform 0.1s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isOut ? '#B91C1C' : '#A86447';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isOut ? '#DC2626' : '#C27D5F';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <span>+</span> Quick Restock
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* System Notifications */}
                {filteredList.system.map((n, idx) => (
                  <div
                    key={`db-notif-${n._id || idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!n.isRead && onMarkAsRead) {
                        onMarkAsRead(n._id);
                      }
                    }}
                    style={{
                      backgroundColor: n.isRead ? '#FAF7F2' : '#FFFFFF',
                      border: n.isRead ? '1px solid #EFE4D6' : '1px solid #D5C2AF',
                      borderLeft: n.isRead ? '4px solid #C5B6A8' : '4px solid #C27D5F',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: n.isRead ? 'default' : 'pointer',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#2C1E16' }}>{n.title}</div>
                      <div style={{ fontSize: '11.5px', color: '#5C4331', marginTop: '2px', lineHeight: 1.4 }}>{n.message}</div>
                      <span style={{ fontSize: '10px', color: '#9C806D', display: 'block', marginTop: '4px' }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    {!n.isRead && (
                      <span
                        title="Unread"
                        style={{
                          minWidth: '8px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#C27D5F',
                          marginLeft: '6px'
                        }}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          backgroundColor: '#FDFBF7',
          borderTop: '1px solid #F3EDE4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '11px', color: '#8C705D' }}>
            Auto-sync active (real-time)
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              const role = (userRole || '').toLowerCase();
              if (['admin', 'owner'].includes(role)) {
                navigate('/owner/dashboard?tab=inventory');
              } else if (role === 'manager') {
                navigate('/manager/dashboard?tab=inventory');
              } else {
                navigate('/staff/workspace?tab=inventory');
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#6F4E37',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            View Full Inventory →
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationDropdown;
