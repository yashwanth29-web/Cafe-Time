import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import {
 createBranch,
 updateBranch,
 deleteBranch,
 getOrders,
 getMenu,
 createMenuItem,
 updateMenuItem,
 deleteMenuItem,
 getStaff,
 createStaff,
 updateStaff,
 deleteStaff,
 resetStaffPasswordApi,
 getSetupData,
 saveSetupData,
 getInventory,
 createInventoryItem,
 updateInventoryItem,
 deleteInventoryItem,
 getInventoryLogs,
 revertInventoryLog,
 getWastageReport,
 getConsumptionReport,
 recordPurchase,
 recordWastage,
 getCategories,
 createCategory,
 updateCategory,
 deleteCategory,
 reorderCategories,
 getInventoryCategories,
 createInventoryCategory,
 deleteInventoryCategory,
 uploadMenuItemImage,
 getOwnerTodayAttendance,
 getOwnerAttendanceReports,
 getWorkReports,
 getReviews,
 getAssetUrl,
 getReports,
 getDashboardStats,
 generatePayroll,
 getPayrollList,
 updatePayroll,
 payPayroll,
 approvePayroll,
  getSalaryHistory,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getCashRegister,
  saveCashRegister,
  deleteCashRegister,
  recordStaffPayment
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import socket from '../socket';
import OwnerLayout from '../components/OwnerLayout';
import RecipeMapper from '../components/RecipeMapper';
import { TrendingUp, TrendingDown, IndianRupee, Package, BarChart3, FileSpreadsheet, Receipt, Wallet, Plus, Trash2, Edit2, Banknote, Smartphone } from 'lucide-react';
import * as XLSX from 'xlsx';

const PRESET_CATEGORIES = [
  'Signature Chai',
  'Coffee Selection',
  'Fresh Juices & Coolers',
  'Thick Milkshakes',
  'Starters & Bites',
  'French Fries'
];

const presetCategories = PRESET_CATEGORIES;

const AdminMenuImage = React.memo(({ item }) =>{
 const isValidUrl = (url) =>{
 if (!url || typeof url !== 'string' || url.trim() === '') return false;
 return url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
 };

 const getCategoryIcon = (categoryName) =>{
 const cat = (categoryName || '').toLowerCase();
 if (cat.includes('chai') || cat.includes('tea')) return '☕';
 if (cat.includes('coffee')) return '☕';
 if (cat.includes('juice') || cat.includes('cooler') || cat.includes('drink') || cat.includes('beverage')) return '🥤';
 if (cat.includes('milkshake') || cat.includes('shake')) return '🥤';
 if (cat.includes('starter') || cat.includes('bite') || cat.includes('snack')) return '🍿';
 if (cat.includes('fry') || cat.includes('fries') || cat.includes('potato')) return '🍟';
 if (cat.includes('burger')) return '🍔';
 if (cat.includes('sandwich')) return '🥪';
 if (cat.includes('pizza')) return '🍕';
 if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('cake')) return '🍰';
 return '🍽️';
 };

 const [imgFailed, setImgFailed] = useState(!isValidUrl(item.image));
 const [prevImage, setPrevImage] = useState(item.image);

 if (item.image !== prevImage) {
 setPrevImage(item.image);
 setImgFailed(!isValidUrl(item.image));
 }

 if (imgFailed) {
 return (
 <div
  className="admin-menu-img"
  style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #1C2B24 0%, #121815 100%)',
  color: 'var(--color-primary)',
  fontSize: '36px',
  userSelect: 'none',
  flexDirection: 'column',
  gap: '4px'
  }}>
  {getCategoryIcon(item.category)}
 </div>);
 }

 return (
 <img
  src={getAssetUrl(item.image)}
  alt={item.name}
  className="admin-menu-img"
  onError={() =>setImgFailed(true)} />);
});

const AdminMenuCard = React.memo(({ item, onEdit, onDelete, onToggle }) => {
  return (
    <div className={`admin-menu-card ${!item.available ? 'unavailable' : ''}`}>
      <AdminMenuImage item={item} />
      <div className="admin-menu-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div className="admin-menu-title" style={{ margin: 0, flex: 1 }}>{item.name}</div>
          <button
            type="button"
            onClick={() => onToggle && onToggle(item)}
            title={item.available ? "Click to mark Out of Stock" : "Click to mark In Stock"}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              border: item.available ? '1px solid #2ecc71' : '1px solid #e74c3c',
              cursor: 'pointer',
              background: item.available ? 'rgba(46, 204, 113, 0.12)' : 'rgba(231, 76, 60, 0.12)',
              color: item.available ? '#2ecc71' : '#e74c3c',
              whiteSpace: 'nowrap'
            }}
          >
            {item.available ? '✓ In Stock' : '✕ Out'}
          </button>
        </div>
        {item.description ? <div className="admin-menu-desc">{item.description}</div> : null}
        <div className="admin-menu-meta">
          <span className="admin-menu-price">₹{parseFloat(item.price).toFixed(2)}</span>
          <div className="menu-card-actions">
            <button onClick={() => onEdit(item)} className="btn btn-secondary menu-card-btn">✏️<span className="btn-text"> Edit</span></button>
            <button onClick={() => onDelete(item._id || item.id)} className="btn btn-secondary menu-card-btn" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>🗑️<span className="btn-text"> Del</span></button>
          </div>
        </div>
      </div>
    </div>
  );
});

const formatLastSavedTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) {
    return `Today, ${timeStr}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${timeStr}`;
  }
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeStr}`;
};

const InvMobileCard = React.memo(({ item, onPurchase, onWastage, onEdit, onDelete }) => {
  const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
  const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
  const isLow = qtyVal <= reorderVal;
  const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;
  let statusColor = '#2ECC71';
  let statusLabel = 'IN STOCK';
  if (qtyVal <= 0) {
    statusColor = '#E74C3C';
    statusLabel = 'OUT';
  } else if (isLow) {
    statusColor = '#F39C12';
    statusLabel = 'LOW';
  }
  return (
    <div style={{
      background: 'rgba(0, 0, 0,0.02)', border: `1px solid ${isLow || qtyVal <= 0 ? statusColor + '44' : 'var(--color-border)'}`,
      borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginTop: '2px' }}>🕒 Last Saved: {formatLastSavedTime(item.updatedAt || item.createdAt)}</div>
        </div>
        <span style={{
          background: `${statusColor}18`, border: `1px solid ${statusColor}`,
          color: statusColor, padding: '2px 8px', borderRadius: '6px',
          fontSize: '10px', fontWeight: 700, flexShrink: 0
        }}>{statusLabel}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: isLow ? statusColor : 'var(--color-text-primary)', fontWeight: 800, fontSize: '18px', lineHeight: 1 }}>{qtyVal}</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginTop: '2px' }}>{item.unit} · Stock</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '15px', lineHeight: 1 }}>₹{(costPriceVal || 0).toFixed(2)}</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginTop: '2px' }}>Cost/unit</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '13px', lineHeight: 1 }}>{reorderVal} {item.unit}</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginTop: '2px' }}>Reorder at</div>
        </div>
      </div>
      {item.supplier && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '6px' }}>
          <span>Supplier: <strong style={{ color: 'var(--color-text-primary)' }}>{item.supplier}</strong></span>
          {item.supplierPhone && (
            <a href={`tel:${item.supplierPhone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              📞 {item.supplierPhone}
            </a>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid rgba(0, 0, 0,0.06)', paddingTop: '10px' }}>
        <button
          onClick={() => onPurchase(item)}
          style={{ flex: 1, background: '#27AE60', color: '#FFFFFF', border: 'none', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 800, fontFamily: 'inherit' }}>
          + Add Stock</button>
        <button
          onClick={() => onWastage(item)}
          style={{ flex: 1, background: '#E74C3C', color: '#FFFFFF', border: 'none', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 800, fontFamily: 'inherit' }}>
          - Reduce Stock</button>
        <button
          onClick={() => onEdit(item)}
          style={{ flex: 1, background: 'rgba(0, 0, 0,0.06)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
          ✏️ Edit</button>
        <button
          onClick={() => onDelete(item._id)}
          style={{ flex: 1, background: 'rgba(231,76,60,0.06)', color: '#E74C3C', border: '1px solid #E74C3C', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
          🗑️ Delete</button>
      </div>
    </div>
  );
});

const InvTableRow = React.memo(({ item, onPurchase, onWastage, onEdit, onDelete }) => {
  const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
  const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
  const isLow = qtyVal <= reorderVal;
  const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;
  let statusColor = '#2ECC71';
  if (qtyVal <= 0) statusColor = '#E74C3C';
  else if (isLow) statusColor = '#F39C12';
  return (
    <tr style={{ borderBottom: '1px solid #432E22' }}>
      <td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{item.name}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isLow ? '#E74C3C' : 'var(--color-text-primary)' }}>{qtyVal} {item.unit}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
        <span style={{ backgroundColor: `${statusColor}1A`, border: `1px solid ${statusColor}`, color: statusColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
          {qtyVal <= 0 ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'IN_STOCK'}
        </span>
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{costPriceVal?.toFixed(2)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', color: '#2ECC71' }}>₹{((qtyVal || 0) * (costPriceVal || 0)).toFixed(2)}</td>
      <td style={{ padding: '10px 8px' }}>
        <div style={{ fontWeight: 600 }}>{item.supplier || 'N/A'}</div>
        {item.supplierPhone && (
          <div style={{ fontSize: '11px', marginTop: '2px' }}>
            <a href={`tel:${item.supplierPhone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              📞 {item.supplierPhone}
            </a>
          </div>
        )}
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600 }}>
        {formatLastSavedTime(item.updatedAt || item.createdAt)}
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{reorderVal} {item.unit}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          <button onClick={() => onPurchase(item)} style={{ background: '#27AE60', color: '#FFFFFF', border: 'none', padding: '5px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>+ Add Stock</button>
          <button onClick={() => onWastage(item)} style={{ background: '#E74C3C', color: '#FFFFFF', border: 'none', padding: '5px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>- Reduce Stock</button>
          <button onClick={() => onEdit(item)} style={{ background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️ Edit</button>
          <button onClick={() => onDelete(item._id)} style={{ background: 'transparent', color: '#E74C3C', border: '1px solid #E74C3C', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
        </div>
      </td>
    </tr>
  );
});

// Simple in-memory global cache for instant rendering
const dashboardCache = {};

const getBranchCache = (branchId) => {
  const key = branchId || 'all';
  if (!dashboardCache[key]) {
    dashboardCache[key] = {
      orders: [],
      menuItems: [],
      categories: [],
      inventoryList: [],
      inventoryCategories: [],
      statsData: null,
      staff: [],
      attendanceRecords: [],
      attendanceSummary: {
        totalStaff: 0,
        present: 0,
        absent: 0,
        late: 0,
        checkedOut: 0,
        currentlyWorking: 0
      },
      attendanceReports: {
        summary: {
          attendancePercentage: 0,
          totalHours: 0,
          lateArrivals: 0,
          recordCount: 0
        },
        branchReports: [],
        records: []
      },
      workReports: [],
      setupConfig: null,
      hasLoaded: {}
    };
  }
  return dashboardCache[key];
};

const OwnerDashboard = () =>{
 const { user } = useAuth();
  useEffect(() => {
    // Clear global singleton dashboardCache on user identity change to prevent cross-tenant data leakage
    for (const key in dashboardCache) {
      delete dashboardCache[key];
    }
  }, [user?._id]);
 const { branches, branchesLoading, activeBranchId, onBranchSwitch, loadBranches } = useBranch();
 const navigate = useNavigate();
 const location = useLocation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const activeBranchIdRef = useRef(activeBranchId);

  const activeBranch = useMemo(() => {
    return (branches || []).find((b) => b.branchId === activeBranchId || String(b._id) === String(activeBranchId)) || null;
  }, [branches, activeBranchId]);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState(() => {
    const tab = tabParam || location.state?.activeTab || 'analytics';
    if (tab === 'reviews') return 'menu';
    if (tab === 'attendance') return 'staff';
    if (tab === 'reports' || tab === 'financial_reports') return 'analytics';
    if (tab === 'settings' || tab === 'config') return 'analytics'; // will redirect in useEffect
    return tab;
  });

  const [menuSubTab, setMenuSubTab] = useState(() => {
    return tabParam === 'reviews' ? 'reviews' : 'dishes';
  });

  const handleEditMenuCallback = useCallback((item) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  }, []);

  const handleDeleteMenuCallback = useCallback((id) => {
    handleDeleteMenuItem(id);
  }, []);

  const handleToggleMenuCallback = useCallback((item) => {
    handleToggleAvailability(item);
  }, []);

  const handlePurchaseInventoryCallback = useCallback((item) => {
    const costPriceVal = item.costPrice !== undefined ? item.costPrice : (item.cost !== undefined ? item.cost : '');
    const currentQty = item.quantity !== undefined ? item.quantity : (item.stock || 0);
    setPurchaseForm({
      itemId: item._id,
      itemName: item.name,
      unit: item.unit || 'units',
      currentStock: currentQty,
      quantityAdded: '',
      costPrice: costPriceVal,
      totalCost: '',
      supplier: item.supplier || '',
      notes: ''
    });
    setShowPurchaseModal(true);
  }, []);

  const handleWastageInventoryCallback = useCallback((item) => {
    const costPriceVal = item.costPrice !== undefined ? item.costPrice : (item.cost !== undefined ? item.cost : 0);
    const currentQty = item.quantity !== undefined ? item.quantity : (item.stock || 0);
    setWastageForm({
      itemId: item._id,
      itemName: item.name,
      unit: item.unit || 'units',
      currentStock: currentQty,
      costPrice: costPriceVal,
      quantityWasted: '',
      type: 'Adjustment',
      reason: 'Manual stock correction'
    });
    setShowWastageModal(true);
  }, []);

  const handleEditInventoryCallback = useCallback((item) => {
    const qty = item.quantity !== undefined ? item.quantity : (item.stock || 0);
    const unitCost = item.costPrice !== undefined ? item.costPrice : (item.cost || 0);
    const totalCost = (qty > 0 && unitCost > 0) ? Number((Number(qty) * Number(unitCost)).toFixed(2)) : '';
    setEditingInventoryItem({
      ...item,
      quantity: qty,
      stock: qty,
      costPrice: unitCost,
      cost: unitCost,
      totalCost: totalCost
    });
    setShowEditInventoryModal(true);
  }, []);

  const handleDeleteInventoryCallback = useCallback((id) => {
    handleDeleteInventoryItem(id);
  }, []);

  const [staffSubTab, setStaffSubTab] = useState(() => {
    const subParam = searchParams.get('sub');
    if (subParam === 'reports') return 'reports';
    if (tabParam === 'attendance') return 'attendance';
    if (subParam === 'salary') return 'salary';
    if (subParam === 'roster') return 'roster';
    return 'all'; // Default to unified combined view of all 4 parts
  });

  const [salaryHistoryList, setSalaryHistoryList] = useState([]);
  const [salaryHistoryPeriod, setSalaryHistoryPeriod] = useState('current_week');
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false);
  const [salaryRunTab, setSalaryRunTab] = useState('run'); // 'run' or 'history'

  // Base Data States
  const [orders, setOrders] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).orders;
  });
  const [ordersLoading, setOrdersLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.orders;
  });
  const [ordersError, setOrdersError] = useState('');
  const seenPaidOrderIdsRef = useRef(new Set());
  const [orderDateFilter, setOrderDateFilter] = useState(() => {
   const today = new Date();
   return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  
  const [menuItems, setMenuItems] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).menuItems;
  });
  const [menuLoading, setMenuLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.menuItems;
  });
  const [menuError, setMenuError] = useState('');
  
  const [staff, setStaff] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).staff;
  });
  const [staffLoading, setStaffLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.staff;
  });
  const [staffError, setStaffError] = useState('');

  // POS/ERP Reports States
  const [reportType, setReportType] = useState(() => {
    return 'revenue';
  });
  const [reportBranchId, setReportBranchId] = useState('all');
  const [reportDateRange, setReportDateRange] = useState('today');
  const [reportStartDate, setReportStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  
  const [statsData, setStatsData] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).statsData;
  });
  const [statsLoading, setStatsLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.statsData;
  });
  const [statsError, setStatsError] = useState('');

  // ── Other Expenses State ──
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseDateFilter, setExpenseDateFilter] = useState('all');
  const [newExpenseForm, setNewExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'Miscellaneous',
    paymentMode: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // ── Purchases & Daily Cash Register State ──
  const [showPurchaseRegisterModal, setShowPurchaseRegisterModal] = useState(false);
  const [cashRegisterLoading, setCashRegisterLoading] = useState(false);
  const [cashRegisterSubmitting, setCashRegisterSubmitting] = useState(false);
  const [cashRegisterDate, setCashRegisterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cashRegisterForm, setCashRegisterForm] = useState({
    yesterdayCash: '',
    todayCash: '',
    bankBalance: '',
    purchasesAmount: '',
    purchasesNote: '',
    notes: ''
  });
  const [cashRegisterHistory, setCashRegisterHistory] = useState([]);

  const loadReportData = async (isSilent = false) => {
    if (!isSilent) setReportLoading(true);
    setReportError('');
    try {
      let start = reportStartDate;
      let end = reportEndDate;
      const today = new Date();

      if (reportDateRange === 'today') {
        const dStr = today.toISOString().split('T')[0];
        start = dStr;
        end = dStr;
      } else if (reportDateRange === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const dStr = yesterday.toISOString().split('T')[0];
        start = dStr;
        end = dStr;
      } else if (reportDateRange === 'this_week') {
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        start = startOfWeek.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
      } else if (reportDateRange === 'last_week') {
        const dayOfWeek = today.getDay();
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - dayOfWeek - 7);
        const endOfLastWeek = new Date(today);
        endOfLastWeek.setDate(today.getDate() - dayOfWeek - 1);
        start = startOfLastWeek.toISOString().split('T')[0];
        end = endOfLastWeek.toISOString().split('T')[0];
      } else if (reportDateRange === 'this_month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        start = startOfMonth.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
      } else if (reportDateRange === 'last_month') {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        start = startOfLastMonth.toISOString().split('T')[0];
        end = endOfLastMonth.toISOString().split('T')[0];
      } else if (reportDateRange === 'last_2_months') {
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(today.getDate() - 60);
        start = sixtyDaysAgo.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
      }

      const res = await getReports({
        type: reportType,
        branchId: reportBranchId,
        startDate: start,
        endDate: end
      });

      if (res.success) {
        setReportData(res.data);
      } else {
        setReportError(res.message || 'Failed to load report data');
      }
    } catch (err) {
      console.error('Error loading reports:', err);
      setReportError(err.response?.data?.message || 'Error communicating with reports API');
    } finally {
      setReportLoading(false);
    }
  };

  const fetchDashboardStats = async (isSilent = false, targetBranchId = activeBranchId) => {
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.statsData) setStatsLoading(true);
    setStatsError('');
    try {
      const response = await getDashboardStats({ branchId: targetBranchId === 'all' ? null : targetBranchId });
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (response.success) {
        setStatsData(response.data);
        cache.statsData = response.data;
        cache.hasLoaded.statsData = true;
      } else {
        setStatsError(response.message || 'Failed to load dashboard metrics');
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setStatsError(err.response?.data?.message || 'Error fetching dashboard metrics');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setStatsLoading(false);
      }
    }
  };



  const handleDownloadExcel = () => {
    if (!reportData || reportData.length === 0) return;

    try {
      const formatted = reportData.map((row, idx) => {
        const clean = { 'S.No': idx + 1 };
        Object.keys(row).forEach(key => {
          let friendlyKey = key.replace(/([A-Z])/g, ' $1').trim();
          friendlyKey = friendlyKey.charAt(0).toUpperCase() + friendlyKey.slice(1);
          let val = row[key];
          if (key === 'date' || key === 'createdAt' || key === 'purchaseDate' || key === 'createdTime' || key === 'completedTime') {
            val = new Date(val).toLocaleString();
          }
          clean[friendlyKey] = val;
        });
        return clean;
      });

      const worksheet = XLSX.utils.json_to_sheet(formatted);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

      const maxColWidths = [];
      formatted.forEach(row => {
        Object.keys(row).forEach((key, colIdx) => {
          const valStr = String(row[key] || '');
          const keyStr = String(key || '');
          const maxLen = Math.max(valStr.length, keyStr.length, 10);
          maxColWidths[colIdx] = Math.max(maxColWidths[colIdx] || 0, maxLen);
        });
      });
      worksheet['!cols'] = maxColWidths.map(w => ({ wch: w + 2 }));

      const fileName = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Error exporting excel:', err);
      alert('Failed to export report to Excel.');
    }
  };

  // Branch & Attendance States
 // Note: branches & branchesLoading come from BranchContext via useBranch()
 const [showAddBranchModal, setShowAddBranchModal] = useState(false);
 const [showEditBranchModal, setShowEditBranchModal] = useState(false);
 const [editingBranch, setEditingBranch] = useState(null);
  const [newBranch, setNewBranch] = useState({
    branchId: '',
    branchName: '',
    address: '',
    manager: '',
    latitude: '',
    longitude: '',
    allowedRadius: 100,
    city: '',
    state: '',
    pincode: '',
    googleMapsUrl: '',
    openingTime: '09:00 AM',
    closingTime: '10:00 PM',
    unifiedStaffMode: false
  });
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).attendanceRecords;
  });
  const [attendanceSummary, setAttendanceSummary] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).attendanceSummary;
  });
  const [attendanceLoading, setAttendanceLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.attendanceRecords;
  });
  const [reportRange, setReportRange] = useState('daily');
  const [reportBranch, setReportBranch] = useState('');
  const [attendanceReports, setAttendanceReports] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).attendanceReports;
  });

  // Work Report states
  const [workReports, setWorkReports] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).workReports;
  });
  const todayWorkReportsCount = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (workReports || []).filter(r => new Date(r.createdAt || r.date) >= startOfToday).length;
  }, [workReports]);
  const [reportsLoading, setReportsLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.workReports;
  });
  const [reportsError, setReportsError] = useState('');
 const [reportsFilterRange, setReportsFilterRange] = useState('today'); // 'today', 'this_week', 'all'
 const [reportsFilterStaff, setReportsFilterStaff] = useState('');
 const [reportsFilterBranch, setReportsFilterBranch] = useState('');
 const [selectedReport, setSelectedReport] = useState(null);
 const [previewPhotoReport, setPreviewPhotoReport] = useState(null);
 const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);
 const [salarySearchQuery, setSalarySearchQuery] = useState('');
 const [salaryRoleFilter, setSalaryRoleFilter] = useState('');

 // Form / Dialog States
 const [showAddModal, setShowAddModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resetModalStaff, setResetModalStaff] = useState(null);
  const [newStaffPasswordInput, setNewStaffPasswordInput] = useState('');
  const [showStaffPassToggle, setShowStaffPassToggle] = useState(false);
  const [resetStaffLoading, setResetStaffLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const [selectedSalaryStaff, setSelectedSalaryStaff] = useState(null);
  const [showSalaryDetailModal, setShowSalaryDetailModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disburseStaff, setDisburseStaff] = useState(null);
  const [disbursePaymentMethod, setDisbursePaymentMethod] = useState('UPI');
  const [disburseRemarks, setDisburseRemarks] = useState('');
  const [disburseAmount, setDisburseAmount] = useState(0);
  const [disburseLoading, setDisburseLoading] = useState(false);
  const [editingWageId, setEditingWageId] = useState(null);
  const [tempWage, setTempWage] = useState(0);

  // New staff input state
  const [newStaff, setNewStaff] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    staffRole: 'staff',
    assignedBranch: '',
    dailyRate: 0,
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    leanTimeMinutes: 30,
    workDaysPerWeek: 6,
    attendancePin: ''
  });

  // Salary payment modal states
  const [paymentModalStaff, setPaymentModalStaff] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

 // New menu item input state
 // Dynamic Category States
  const [categories, setCategories] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).categories;
  });
  const [categoryLoading, setCategoryLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.categories;
  });
  const [categoryError, setCategoryError] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');

  // Dynamic Inventory Category States
  const [inventoryCategories, setInventoryCategories] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).inventoryCategories;
  });
  const [invCategoryLoading, setInvCategoryLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.inventoryCategories;
  });
  const [invCategoryError, setInvCategoryError] = useState('');
 const [newInvCategoryName, setNewInvCategoryName] = useState('');

 const [newItem, setNewItem] = useState({
 name: '',
 price: '',
 makingCost: '',
 category: 'Signature Chai',
 description: '',
 available: true,
 image: '',
 recipe: [],
 preparationTime: 10
 });

 const [selectedIngredient, setSelectedIngredient] = useState('');
 const [ingredientQuantity, setIngredientQuantity] = useState('');

 const handleAddIngredientToNewItem = () =>{
 if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity)<= 0) {
 alert('Please select an ingredient and enter a valid quantity.');
 return;
 }
 if (newItem.recipe && newItem.recipe.find((ing) =>ing.name === selectedIngredient)) {
 alert('Ingredient already added to recipe.');
 return;
 }
 const updatedRecipe = [...(newItem.recipe || []), { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
 setNewItem({ ...newItem, recipe: updatedRecipe });
 setSelectedIngredient('');
 setIngredientQuantity('');
 };

 const handleRemoveIngredientFromNewItem = (name) =>{
 const updatedRecipe = (newItem.recipe || []).filter((ing) =>ing.name !== name);
 setNewItem({ ...newItem, recipe: updatedRecipe });
 };

 const handleAddIngredientToEditingItem = () =>{
 if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity)<= 0) {
 alert('Please select an ingredient and enter a valid quantity.');
 return;
 }
 if (editingItem.recipe && editingItem.recipe.find((ing) =>ing.name === selectedIngredient)) {
 alert('Ingredient already added to recipe.');
 return;
 }
 const updatedRecipe = [...(editingItem.recipe || []), { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
 setEditingItem({ ...editingItem, recipe: updatedRecipe });
 setSelectedIngredient('');
 setIngredientQuantity('');
 };

 const handleRemoveIngredientFromEditingItem = (name) =>{
 const updatedRecipe = (editingItem.recipe || []).filter((ing) =>ing.name !== name);
 setEditingItem({ ...editingItem, recipe: updatedRecipe });
 };

 // Dynamic QR / Table States
 const [selectedQrTable, setSelectedQrTable] = useState(null);
 const [copiedLink, setCopiedLink] = useState(false);
 const [dynamicTables, setDynamicTables] = useState(['1', '2', '3', '4', '5']);



 const handleDownloadQr = async (tableNum) => {
   const qrUrl = `${window.location.origin}/?table=${tableNum}&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`;
   const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}`;
   try {
     const res = await fetch(imgUrl);
     const blob = await res.blob();
     const blobUrl = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = blobUrl;
     a.download = `Table_${tableNum}_QR.png`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     window.URL.revokeObjectURL(blobUrl);
   } catch (e) {
     console.error('Download QR failed:', e);
     window.open(imgUrl, '_blank');
   }
 };

 // Settings / Config States

  const [taxRate, setTaxRate] = useState(5); // mock GST
  const [serviceCharge, setServiceCharge] = useState(2.5); // mock service charge
  const [settingsMsg, setSettingsMsg] = useState('');
  const [acceptCash, setAcceptCash] = useState(true);
  const [enableUpi, setEnableUpi] = useState(true);
  const [upiId, setUpiId] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');

  // Database Inventory State
  const [inventoryList, setInventoryList] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return getBranchCache(activeId).inventoryList;
  });
  const [inventoryLoading, setInventoryLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.inventoryList;
  });
  const [inventoryError, setInventoryError] = useState('');
 const [inventoryLogs, setInventoryLogs] = useState([]);
 const [wastageReport, setWastageReport] = useState({ totalCost: 0, count: 0, data: [] });
 const [consumptionReport, setConsumptionReport] = useState({ totalCost: 0, count: 0, data: [] });
 const [inventorySubTab, setInventorySubTab] = useState('levels');

 // Modals / forms state for Inventory
 const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
 const [showEditInventoryModal, setShowEditInventoryModal] = useState(false);
 const [editingInventoryItem, setEditingInventoryItem] = useState(null);
 const [newInventoryItem, setNewInventoryItem] = useState({
 name: '',
 quantity: 0,
 stock: '',
 reorderLevel: 0,
 minStock: '',
 unit: 'g',
 costPrice: 0,
 cost: 0,
 totalPurchaseCost: '',
 sellingPrice: 0,
 supplier: '',
 supplierPhone: '',
 branch: 'Main',
 category: 'Ingredients'
 });
 const [showPurchaseModal, setShowPurchaseModal] = useState(false);
 const [showWastageModal, setShowWastageModal] = useState(false);
 const [purchaseForm, setPurchaseForm] = useState({
    itemId: '',
    itemName: '',
    unit: '',
    currentStock: 0,
    quantityAdded: '',
    costPrice: '',
    totalCost: '',
    supplier: '',
    notes: ''
  });
  const [wastageForm, setWastageForm] = useState({
    itemId: '',
    itemName: '',
    unit: '',
    currentStock: 0,
    costPrice: '',
    quantityWasted: '',
    type: 'Adjustment',
    reason: 'Manual stock correction'
  });

  // Customer Reviews States
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewsSummary, setReviewsSummary] = useState({
    totalReviews: 0,
    averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [reviewsFilterRating, setReviewsFilterRating] = useState('');
  const [isMenuSubmitting, setIsMenuSubmitting] = useState(false);
  const [isInventorySubmitting, setIsInventorySubmitting] = useState(false);
  
  // Search and filter states
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [movementDayFilter, setMovementDayFilter] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [movementSearch, setMovementSearch] = useState('');

  const menuCategoriesWithCounts = useMemo(() => {
    const rawCategories = categories.length > 0
      ? categories.map((c) => (typeof c === 'string' ? c : c.name))
      : PRESET_CATEGORIES;

    const allCatSet = new Set(rawCategories);
    (menuItems || []).forEach((item) => {
      if (item.category && item.category.trim()) {
        allCatSet.add(item.category.trim());
      }
    });

    const counts = {};
    let totalCount = 0;
    (menuItems || []).forEach((item) => {
      totalCount++;
      const cat = (item.category || 'Uncategorized').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const categoryList = Array.from(allCatSet).map((catName) => ({
      name: catName,
      count: counts[catName] || 0
    }));

    return {
      allCount: totalCount,
      list: categoryList
    };
  }, [categories, menuItems]);

  const filteredMenuItems = useMemo(() => {
    const seenIds = new Set();
    const uniqueItems = [];
    for (const item of (menuItems || [])) {
      if (!item) continue;
      const cleanId = String(item._id || item.id || '');
      if (cleanId && !seenIds.has(cleanId)) {
        seenIds.add(cleanId);
        uniqueItems.push(item);
      } else if (!cleanId) {
        uniqueItems.push(item);
      }
    }
    return uniqueItems.filter((item) => {
      if (!item) return false;
      const itemName = String(item.name || '').toLowerCase();
      const itemCat = String(item.category || '').toLowerCase();
      const searchTarget = String(menuSearch || '').toLowerCase();

      const matchesSearch = itemName.includes(searchTarget) || itemCat.includes(searchTarget);

      const matchesCategory =
        selectedMenuCategory === 'all' ||
        itemCat.trim() === String(selectedMenuCategory || '').toLowerCase().trim();

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, menuSearch, selectedMenuCategory]);

  const filteredInventoryList = useMemo(() => {
    return (inventoryList || []).filter((item) => {
      if (!item) return false;
      const invName = String(item.name || '').toLowerCase();
      const invCat = String(item.category || '').toLowerCase();
      const searchTarget = String(inventorySearch || '').toLowerCase();
      return invName.includes(searchTarget) || invCat.includes(searchTarget);
    });
  }, [inventoryList, inventorySearch]);

  const past7Days = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let label = '';
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Yesterday';
      else label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      days.push({ key: dateStr, label, isRelative: i < 2 });
    }
    return days;
  }, []);

  const filteredMovementLogs = useMemo(() => {
    return (inventoryLogs || []).filter((log) => {
      const reasonLower = (log.reason || '').toLowerCase();
      const userLower = (log.userEmail || '').toLowerCase();
      const perfLower = (log.performedBy || '').toLowerCase();

      // STRICT FILTER: Only show genuine manual inventory actions (purchases & manual adjustments)
      // Hide all automatic recipe sales deductions AND order cancellation / deletion restorations
      const isSystemOrOrderRelated = 
        log.type === 'Deduction' || 
        !!log.orderId || 
        reasonLower.startsWith('sold') || 
        reasonLower.includes('order deduction') ||
        reasonLower.includes('auto-deduct') ||
        reasonLower.includes('restored from') ||
        reasonLower.includes('deleted/cancelled order') ||
        reasonLower.includes('cancelled order') ||
        reasonLower.includes('deleted order') ||
        reasonLower.includes('restored from deleted') ||
        reasonLower.includes('order #') ||
        userLower.includes('auto-deduct') ||
        perfLower.includes('auto-deduct') ||
        (perfLower === 'system' && (reasonLower.includes('restored') || reasonLower.includes('order')));

      if (isSystemOrOrderRelated) return false;

      const qtyChanged = Number(log.quantityChanged) || 0;
      const isAddStock = log.type === 'Purchase' || log.type === 'Initial' || qtyChanged > 0;
      const isReduceStock = log.type === 'Adjustment' || log.type === 'Wastage' || log.type === 'Damaged' || qtyChanged < 0;
      
      if (!isAddStock && !isReduceStock) return false;

      if (!log.createdAt) return true;
      const logDate = new Date(log.createdAt);
      const logDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
      
      if (movementDayFilter !== 'all' && logDateStr !== movementDayFilter) {
        return false;
      }
      
      if (movementSearch.trim()) {
        const q = movementSearch.toLowerCase().trim();
        const matchName = (log.itemName || '').toLowerCase().includes(q);
        const matchReason = (log.reason || '').toLowerCase().includes(q);
        const matchType = (log.type || '').toLowerCase().includes(q);
        const matchUser = (log.performedBy || log.userEmail || '').toLowerCase().includes(q);
        if (!matchName && !matchReason && !matchType && !matchUser) return false;
      }
      return true;
    });
  }, [inventoryLogs, movementDayFilter, movementSearch]);

 const [imageUploading, setImageUploading] = useState(false);

 const handleImageUpload = async (file, isEditing = false) =>{
 if (!file) return;
 const formData = new FormData();
 formData.append('image', file);

 try {
 setImageUploading(true);
 const res = await uploadMenuItemImage(formData);
 if (res.success) {
 if (isEditing) {
 setEditingItem((prev) =>({ ...prev, image: res.imageUrl }));
 } else {
 setNewItem((prev) =>({ ...prev, image: res.imageUrl }));
 }
 } else {
 alert(res.message || 'Image upload failed.');
 }
 } catch (error) {
 console.error('Error uploading image:', error);
 alert(error.response?.data?.message || 'Error uploading image file.');
 } finally {
 setImageUploading(false);
 }
 };

  const applySetupConfig = (res) => {
    if (res.operationalConfig?.tables) {
      const t = res.operationalConfig.tables.map((tbl) => tbl.id.replace('T', ''));
      if (t.length > 0) setDynamicTables(t);
    }
    if (res.cafe) {
      setTaxRate(res.cafe.gstRate !== undefined ? res.cafe.gstRate : 5);
      setServiceCharge(res.cafe.serviceChargeRate !== undefined ? res.cafe.serviceChargeRate : 0);
    }
    if (res.paymentConfig) {
      setAcceptCash(res.paymentConfig.acceptCash !== undefined ? res.paymentConfig.acceptCash : true);
      setEnableUpi(res.paymentConfig.enableUpi !== undefined ? res.paymentConfig.enableUpi : true);
      setUpiId(res.paymentConfig.upiId || '');
      setBankHolderName(res.paymentConfig.bankHolderName || '');
      setAccountNumber(res.paymentConfig.accountNumber || '');
      setIfscCode(res.paymentConfig.ifscCode || '');
      setPaymentInstructions(res.paymentConfig.paymentInstructions || '');
      if (res.paymentConfig.taxRate !== undefined) {
        setTaxRate(res.paymentConfig.taxRate);
      }
      if (res.paymentConfig.platformCharge !== undefined) {
        setServiceCharge(res.paymentConfig.platformCharge);
      }
    }
  };

  // Load Setup Config
  const loadSetupConfig = async () => {
    const cache = getBranchCache(activeBranchId);
    if (cache.setupConfig) {
      applySetupConfig(cache.setupConfig);
    }
    try {
      const res = await getSetupData();
      if (res.success) {
        cache.setupConfig = res;
        applySetupConfig(res);
      }
    } catch (err) {
      console.error('Error fetching tables/keys setup:', err);
    }
  };

 const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioContext.currentTime); // A5
        gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.2);
      }, 150);
    } catch (e) {
      
    }
  };

  const speakPaymentReceived = (order) => {
    if (!('speechSynthesis' in window)) return;
    try {
      const tableInfo = order.tableNumber && order.tableNumber !== 'Takeaway' && order.tableNumber !== 'Walk-in'
        ? `for Table ${order.tableNumber}`
        : 'for Takeaway';
      const text = `Payment received ${tableInfo}. Amount: ${Math.round(order.totalAmount)} rupees.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
    }
  };

  // Fetch Orders (Monitoring)
  const fetchOrders = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.orders) setOrdersLoading(true);
    try {
      const queryParams = { date: orderDateFilter, cafeId: user?.cafeId };
      if (targetBranchId && targetBranchId !== 'all') {
        queryParams.branchId = targetBranchId;
      }
      const response = await getOrders(queryParams);
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (response.success) {
        setOrders(response.data);
        cache.orders = response.data;
        cache.hasLoaded.orders = true;
   
        // Track paid status transition
        const paidOrders = response.data.filter((o) => o.paymentStatus === 'Paid');
        if (seenPaidOrderIdsRef.current.size === 0) {
          paidOrders.forEach((o) => seenPaidOrderIdsRef.current.add(o._id));
        } else {
          const newPaidOrders = paidOrders.filter((o) => !seenPaidOrderIdsRef.current.has(o._id));
          if (newPaidOrders.length > 0) {
            playNotificationSound();
            newPaidOrders.forEach((order) => {
              speakPaymentReceived(order);
              seenPaidOrderIdsRef.current.add(order._id);
            });
          }
        }
        setOrdersError('');
      } else {
        setOrdersError('Failed to refresh orders.');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrdersError('Cannot connect to local server orders feed.');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setOrdersLoading(false);
      }
    }
  };

  // Fetch Menu
  const fetchMenu = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.menuItems) setMenuLoading(true);
    try {
      const response = await getMenu();
      const currentBranch = activeBranchIdRef.current;
      const isMatchingBranch = !targetBranchId || !currentBranch || 
        targetBranchId === currentBranch || 
        (targetBranchId === 'default' && currentBranch === 'all') || 
        (targetBranchId === 'all' && currentBranch === 'default');
      if (!isMatchingBranch) return;

      if (response && response.success) {
        const seenIds = new Set();
        const mappedData = [];
        for (const rawItem of (response.data || [])) {
          const cleanId = String(rawItem._id || rawItem.id || '');
          if (cleanId && !seenIds.has(cleanId)) {
            seenIds.add(cleanId);
            mappedData.push({ ...rawItem, id: cleanId, _id: cleanId });
          } else if (!cleanId) {
            mappedData.push(rawItem);
          }
        }
        setMenuItems(mappedData);
        cache.menuItems = mappedData;
        cache.hasLoaded.menuItems = true;
        setMenuError('');
      } else {
        setMenuError('Failed to load cafe menu.');
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      setMenuError('Cannot connect to local server menu database.');
    } finally {
      setMenuLoading(false);
    }
  };

  // Fetch Categories
  const fetchCategories = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.categories) setCategoryLoading(true);
    try {
      const response = await getCategories();
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (response && response.success) {
        setCategories(response.data);
        cache.categories = response.data;
        cache.hasLoaded.categories = true;
        setCategoryError('');
      } else {
        setCategoryError('Failed to load categories.');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategoryError('Cannot connect to category database.');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setCategoryLoading(false);
      }
    }
  };

  const handleCreateCategory = async (e) =>{
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const response = await createCategory({ name: newCategoryName });
      if (response.success) {
        const updatedCats = [...categories, response.data];
        setCategories(updatedCats);
        const cache = getBranchCache(activeBranchId);
        if (cache.categories) {
          cache.categories = updatedCats;
        }
        setNewCategoryName('');
        alert('Category created successfully!');
      } else {
        alert(response.message || 'Failed to create category.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error creating category.');
    }
  };

  const handleUpdateCategory = async (e, directCat = null, directName = null) =>{
    if (e && e.preventDefault) e.preventDefault();
    const targetCat = directCat || editingCategory;
    const targetName = (directName !== null ? directName : categoryNameInput).trim();
    if (!targetCat || !targetName) return;
    try {
      if (targetCat._id && typeof targetCat._id === 'string') {
        const response = await updateCategory(targetCat._id, { name: targetName });
        if (response.success) {
          const updatedCats = categories.map((c) => c._id === targetCat._id ? response.data : c);
          setCategories(updatedCats);
          const updatedMenuItems = menuItems.map((item) => item.category === targetCat.name ? { ...item, category: response.data.name } : item);
          setMenuItems(updatedMenuItems);
          const cache = getBranchCache(activeBranchId);
          if (cache.categories) cache.categories = updatedCats;
          if (cache.menuItems) cache.menuItems = updatedMenuItems;
          setEditingCategory(null);
          setCategoryNameInput('');
        } else {
          alert(response.message || 'Failed to update category.');
        }
      } else {
        // Preset category not yet in DB - create it
        const response = await createCategory({ name: targetName });
        if (response.success) {
          const updatedCats = categories.length > 0
            ? categories.map((c) => c.name === targetCat.name ? response.data : c)
            : presetCategories.map((name) => name === targetCat.name ? response.data : { name });
          setCategories(updatedCats);
          setEditingCategory(null);
          setCategoryNameInput('');
          fetchCategories(true);
        } else {
          alert(response.message || 'Failed to update category.');
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error updating category.');
    }
  };

  const handleDeleteCategory = async (catId, catName) =>{
    const targetName = catName || categories.find((c) => c._id === catId)?.name || 'this category';
    if (!window.confirm(`Are you sure you want to delete "${targetName}"? All menu items in this category will be moved to Uncategorized.`)) return;
    try {
      if (catId && typeof catId === 'string') {
        const categoryToDelete = categories.find((c) => c._id === catId);
        const response = await deleteCategory(catId);
        if (response.success) {
          const updatedCats = categories.filter((c) => c._id !== catId);
          setCategories(updatedCats);
          let updatedMenuItems = menuItems;
          if (categoryToDelete) {
            updatedMenuItems = menuItems.map((item) => item.category === categoryToDelete.name ? { ...item, category: 'Uncategorized' } : item);
            setMenuItems(updatedMenuItems);
          }
          const cache = getBranchCache(activeBranchId);
          if (cache.categories) cache.categories = updatedCats;
          if (cache.menuItems) cache.menuItems = updatedMenuItems;
        } else {
          alert(response.message || 'Failed to delete category.');
        }
      } else {
        const updatedCats = (categories.length > 0 ? categories : presetCategories.map((name, idx) => ({ _id: idx, name })))
          .filter((c) => c._id !== catId && c.name !== targetName);
        setCategories(updatedCats);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error deleting category.');
    }
  };

  const handleCategoryDragStart = (e, index) =>{
    e.dataTransfer.setData('text/plain', index);
  };

  const handleCategoryDragOver = (e) =>{
    e.preventDefault();
  };

  const handleCategoryDrop = async (e, targetIndex) =>{
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

    const list = categories.length > 0 ? categories : presetCategories.map((name, idx) => ({ _id: idx, name }));
    const updated = [...list];
    const [dragged] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, dragged);

    // Optimistic UI update
    setCategories(updated);

    try {
      const stringIds = updated.map((c) => c._id).filter((id) => typeof id === 'string');
      if (stringIds.length === updated.length) {
        await reorderCategories(stringIds);
      }
    } catch (err) {
      console.error('Error reordering categories:', err);
      fetchCategories();
    }
  };

  const moveCategory = async (index, direction) =>{
    const list = categories.length > 0 ? categories : presetCategories.map((name, idx) => ({ _id: idx, name }));
    const updated = [...list];
    if (direction === 'up' && index > 0) {
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
    } else if (direction === 'down' && index < updated.length - 1) {
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
    } else {
      return;
    }

    // Optimistic UI update
    setCategories(updated);

    try {
      const stringIds = updated.map((c) => c._id).filter((id) => typeof id === 'string');
      if (stringIds.length === updated.length) {
        await reorderCategories(stringIds);
      }
    } catch (err) {
      console.error('Error reordering categories:', err);
      fetchCategories();
    }
  };

  // Fetch Inventory Categories
  const fetchInventoryCategories = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.inventoryCategories) setInvCategoryLoading(true);
    try {
      const response = await getInventoryCategories();
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (response && response.success) {
        setInventoryCategories(response.data);
        cache.inventoryCategories = response.data;
        cache.hasLoaded.inventoryCategories = true;
        setInvCategoryError('');
      } else {
        setInvCategoryError('Failed to load stock categories.');
      }
    } catch (error) {
      console.error('Error fetching inventory categories:', error);
      setInvCategoryError('Cannot connect to stock categories database.');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setInvCategoryLoading(false);
      }
    }
  };

 const handleCreateInventoryCategory = async (e) =>{
 e.preventDefault();
 if (!newInvCategoryName.trim()) return;
 try {
 const response = await createInventoryCategory({ name: newInvCategoryName });
 if (response.success) {
 setInventoryCategories([...inventoryCategories, response.data]);
 setNewInvCategoryName('');
 alert('Stock category created successfully!');
 } else {
 alert(response.message || 'Failed to create category.');
 }
 } catch (err) {
 console.error(err);
 alert(err.response?.data?.message || 'Error creating category.');
 }
 };

 const handleDeleteInventoryCategory = async (id) =>{
 if (!window.confirm('Are you sure you want to delete this category? All items in this category will be moved to Uncategorized.')) return;
 try {
 const catToDelete = inventoryCategories.find((c) =>c._id === id);
 const response = await deleteInventoryCategory(id);
 if (response.success) {
 setInventoryCategories(inventoryCategories.filter((c) =>c._id !== id));
 if (catToDelete) {
 setInventoryList(inventoryList.map((item) =>item.category === catToDelete.name ? { ...item, category: 'Uncategorized' } : item));
 }
 alert('Stock category deleted successfully.');
 } else {
 alert(response.message || 'Failed to delete category.');
 }
 } catch (err) {
 console.error(err);
 alert(err.response?.data?.message || 'Error deleting category.');
 }
 };

  // Fetch Staff
  const fetchStaffList = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.staff) setStaffLoading(true);
    try {
      const response = await getStaff();
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (response.success) {
        setStaff(response.staff);
        cache.staff = response.staff;
        cache.hasLoaded.staff = true;
        setStaffError('');
      } else {
        setStaffError('Failed to load staff roster.');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      setStaffError('Cannot connect to local server staff database.');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setStaffLoading(false);
      }
    }
  };

  const fetchSalaryHistory = async (targetBranchId = activeBranchId) => {
    setSalaryHistoryLoading(true);
    try {
      const res = await getSalaryHistory({ period: salaryHistoryPeriod, branchId: targetBranchId });
      if (res.success) {
        setSalaryHistoryList(res.data);
      }
    } catch (err) {
      console.error('Error fetching salary history:', err);
    } finally {
      setSalaryHistoryLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    const getISTDate = (date = new Date()) => {
      const tzOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(date.getTime() + tzOffset);
      return istTime.toISOString().split('T')[0];
    };
    const todayStr = getISTDate();
    const current = new Date(todayStr);
    const day = current.getUTCDay();
    const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setUTCDate(diff));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];

    try {
      const res = await generatePayroll(weekStart, weekEnd);
      if (res.success) {
        alert(`Weekly payroll run generated successfully for week ${weekStart} to ${weekEnd}.`);
        fetchStaffList();
      }
    } catch (err) {
      console.error('Error generating payroll:', err);
      alert(err.response?.data?.message || 'Error generating weekly payroll. Check if already generated.');
    }
  };

  const handleApprovePayroll = async (staffId) => {
    try {
      const getISTDate = (date = new Date()) => {
        const tzOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(date.getTime() + tzOffset);
        return istTime.toISOString().split('T')[0];
      };
      const todayStr = getISTDate();
      const current = new Date(todayStr);
      const day = current.getUTCDay();
      const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setUTCDate(diff));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = sunday.toISOString().split('T')[0];

      let prRes = await getPayrollList({ employeeId: staffId, weekStart, weekEnd });
      if (!prRes.success || !prRes.data || prRes.data.length === 0) {
        // Auto-generate weekly payroll
        await generatePayroll(weekStart, weekEnd);
        prRes = await getPayrollList({ employeeId: staffId, weekStart, weekEnd });
      }

      if (prRes.success && prRes.data && prRes.data.length > 0) {
        const payrollId = prRes.data[0]._id;
        const approveRes = await approvePayroll(payrollId);
        if (approveRes.success) {
          alert('Payroll approved successfully.');
          fetchStaffList();
          fetchSalaryHistory();
        }
      } else {
        alert('Weekly payroll has not been generated for this staff member yet.');
      }
    } catch (err) {
      console.error('Error approving payroll:', err);
      alert('Error approving payroll: ' + (err.response?.data?.message || err.message));
    }
  };

  const openDisburseModal = (staffMember) => {
    setDisburseStaff(staffMember);
    setDisbursePaymentMethod('UPI');
    setDisburseRemarks('Salary payout');
    const bal = staffMember.remainingSalaryBalance !== undefined 
      ? staffMember.remainingSalaryBalance 
      : (staffMember.currentMonthSalary || staffMember.dailyRate || 0);
    setDisburseAmount(bal > 0 ? bal : (staffMember.currentMonthSalary || staffMember.dailyRate || 0));
    setShowDisburseModal(true);
  };

  const handleConfirmDisbursement = async () => {
    if (!disburseStaff) return;
    const amountVal = Number(disburseAmount);
    if (!amountVal || amountVal <= 0) {
      alert('Please enter a valid salary amount greater than 0.');
      return;
    }

    setDisburseLoading(true);

    try {
      const res = await recordStaffPayment({
        employeeId: disburseStaff._id,
        amount: amountVal,
        paymentMethod: disbursePaymentMethod || 'UPI',
        remarks: disburseRemarks || 'Salary Payment'
      });

      if (res.success) {
        setShowDisburseModal(false);
        setDisburseStaff(null);
        alert(`✓ Salary payment of ₹${amountVal} for ${disburseStaff.name} recorded and added to Salary History Ledger successfully!`);
        fetchStaffList();
        fetchSalaryHistory();
      } else {
        alert(res.message || 'Payment could not be recorded.');
      }
    } catch (err) {
      console.error('Error paying salary:', err);
      alert('Error recording payment: ' + (err.response?.data?.message || err.message));
    } finally {
      setDisburseLoading(false);
    }
  };

  // Fetch Attendance Today Dashboard
  const fetchAttendanceToday = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.attendanceRecords) setAttendanceLoading(true);
    try {
      const res = await getOwnerTodayAttendance();
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (res.success) {
        setAttendanceSummary(res.summary);
        setAttendanceRecords(res.records);
        cache.attendanceSummary = res.summary;
        cache.attendanceRecords = res.records;
        cache.hasLoaded.attendanceRecords = true;
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setAttendanceLoading(false);
      }
    }
  };

  // Fetch Attendance Reports
  const fetchAttendanceReportsData = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.attendanceReports) setAttendanceLoading(true);
    try {
      const res = await getOwnerAttendanceReports({ range: reportRange, branchId: reportBranch });
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (res.success) {
        setAttendanceReports(res);
        cache.attendanceReports = res;
        cache.hasLoaded.attendanceReports = true;
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setAttendanceLoading(false);
      }
    }
  };

  const fetchWorkReports = async (isSilent = false, targetBranchId = activeBranchId, overrideStaffId = null) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.workReports) setReportsLoading(true);
    setReportsError('');
    try {
      const params = {};
      const staffParam = overrideStaffId !== null ? overrideStaffId : reportsFilterStaff;
      if (staffParam && staffParam !== 'all') params.staffId = staffParam;
      if (reportsFilterBranch && reportsFilterBranch !== 'all') params.branchId = reportsFilterBranch;

      const res = await getWorkReports(params);
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (res.success) {
        setWorkReports(res.reports || []);
        cache.workReports = res.reports || [];
        cache.hasLoaded.workReports = true;
      } else {
        setReportsError(res.message || 'Failed to fetch work reports.');
      }
    } catch (err) {
      console.error('Error fetching work reports:', err);
      setReportsError('Server error fetching work reports.');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setReportsLoading(false);
      }
    }
  };

 const fetchReviewsData = async (isSilent = false) =>{
 if (!isSilent) setReviewsLoading(true);
 setReviewsError('');
 try {
 const params = {};
 if (reviewsFilterRating) {
 params.rating = reviewsFilterRating;
 }
 const response = await getReviews(params);
 if (response && response.success) {
 setReviews(response.data || []);
 if (response.summary) {
 setReviewsSummary(response.summary);
 }
 } else {
 setReviewsError('Failed to retrieve customer reviews.');
 }
 } catch (err) {
 console.error('Error fetching reviews:', err);
 setReviewsError(err.response?.data?.message || 'Server error while fetching customer reviews.');
 } finally {
 setReviewsLoading(false);
 }
 };



  // Register new staff
  const handleAddStaff = async (e) =>{
    e.preventDefault();
    if (!newStaff.name || !newStaff.phone || !newStaff.staffRole) {
      alert('Name, Phone Number, and Role are required.');
      return;
    }
    try {
      setStaffLoading(true);
      const response = await createStaff({
        ...newStaff,
        username: newStaff.username ? newStaff.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '') : undefined,
        password: newStaff.password ? newStaff.password.trim() : undefined,
        dailyRate: Number(newStaff.dailyRate || 0),
        shiftStartTime: newStaff.shiftStartTime || '09:00',
        shiftEndTime: newStaff.shiftEndTime || '18:00',
        leanTimeMinutes: Number(newStaff.leanTimeMinutes !== undefined ? newStaff.leanTimeMinutes : 30),
        workDaysPerWeek: Number(newStaff.workDaysPerWeek !== undefined ? newStaff.workDaysPerWeek : 6),
        attendancePin: newStaff.attendancePin ? String(newStaff.attendancePin).trim() : ''
      });
      if (response.success) {
        alert(response.message || `Staff member "${newStaff.name}" registered successfully.`);
        setNewStaff({
          name: '', username: '', password: '', email: '', phone: '',
          staffRole: 'staff', assignedBranch: '', dailyRate: 0,
          shiftStartTime: '09:00', shiftEndTime: '18:00', leanTimeMinutes: 30, workDaysPerWeek: 6,
          attendancePin: ''
        });
        setShowAddStaffModal(false);
        fetchStaffList();
      }
    } catch (error) {
      console.error('Error creating staff:', error);
      alert(error.response?.data?.message || 'Failed to create staff member.');
    } finally {
      setStaffLoading(false);
    }
  };

  // Edit staff
  const handleEditStaff = async (e) =>{
    e.preventDefault();
    if (!editingStaff.name || !editingStaff.phone || !editingStaff.staffRole) {
      alert('Name, Phone Number, and Role are required.');
      return;
    }
    try {
      setStaffLoading(true);
      const payload = {
        name: editingStaff.name,
        username: editingStaff.username ? editingStaff.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '') : undefined,
        email: editingStaff.email,
        phone: editingStaff.phone,
        staffRole: editingStaff.staffRole,
        assignedBranch: editingStaff.assignedBranch,
        isActive: editingStaff.isActive,
        dailyRate: Number(editingStaff.dailyRate || 0),
        shiftStartTime: editingStaff.shiftStartTime || '09:00',
        shiftEndTime: editingStaff.shiftEndTime || '18:00',
        leanTimeMinutes: Number(editingStaff.leanTimeMinutes !== undefined ? editingStaff.leanTimeMinutes : 30),
        workDaysPerWeek: Number(editingStaff.workDaysPerWeek !== undefined ? editingStaff.workDaysPerWeek : 6),
        attendancePin: editingStaff.attendancePin !== undefined ? String(editingStaff.attendancePin).trim() : undefined
      };
      if (editingStaff.newPassword && editingStaff.newPassword.trim()) {
        payload.password = editingStaff.newPassword.trim();
      }
      const response = await updateStaff(editingStaff._id, payload);
      if (response.success) {
        alert('Staff member updated successfully.');
        setShowEditStaffModal(false);
        setEditingStaff(null);
        fetchStaffList();
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      alert(error.response?.data?.message || 'Failed to update staff member.');
    } finally {
      setStaffLoading(false);
    }
  };

  // Record Manual Offline Salary Payment
  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentModalStaff || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }
    try {
      setPaymentSubmitting(true);
      const res = await recordStaffPayment(paymentModalStaff._id, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        notes: paymentForm.notes
      });
      if (res.success) {
        alert(res.message || `Payment of ₹${paymentForm.amount} recorded successfully.`);
        setPaymentModalStaff(null);
        setPaymentForm({
          amount: '',
          paymentMethod: 'Cash',
          paymentDate: new Date().toISOString().split('T')[0],
          notes: ''
        });
        fetchStaffList();
      } else {
        alert(res.message || 'Failed to record payment.');
      }
    } catch (err) {
      console.error('Error recording payment:', err);
      alert(err.response?.data?.message || 'Failed to record staff payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Direct Staff Password Reset Handler
  const handleDirectPasswordReset = async (e) => {
    e.preventDefault();
    if (!resetModalStaff || !newStaffPasswordInput.trim()) {
      alert('Please enter a new password (min 6 characters).');
      return;
    }
    if (newStaffPasswordInput.trim().length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    try {
      setResetStaffLoading(true);
      const res = await resetStaffPasswordApi({
        staffId: resetModalStaff._id,
        newPassword: newStaffPasswordInput.trim()
      });
      if (res.success) {
        alert(res.message || `Password for ${resetModalStaff.name} reset successfully!`);
        setResetModalStaff(null);
        setNewStaffPasswordInput('');
        fetchStaffList();
      }
    } catch (err) {
      console.error('Password reset error:', err);
      alert(err.response?.data?.message || 'Failed to reset staff password.');
    } finally {
      setResetStaffLoading(false);
    }
  };

 // Delete staff
  const handleSaveWage = async (staffId, wage) => {
    try {
      setStaffLoading(true);
      const target = staff.find(s => s._id === staffId);
      if (!target) return;
      const response = await updateStaff(staffId, {
        name: target.name,
        email: target.email,
        phone: target.phone,
        staffRole: target.staffRole,
        assignedBranch: target.assignedBranch,
        isActive: target.isActive,
        dailyRate: Number(wage)
      });
      if (response.success) {
        alert('Daily wage updated successfully.');
        setEditingWageId(null);
        fetchStaffList();
      }
    } catch (err) {
      console.error('Error saving wage:', err);
      alert(err.response?.data?.message || 'Failed to update wage.');
    } finally {
      setStaffLoading(false);
    }
  };

const exportStaffToCSV = () => {
  if (!staff || staff.length === 0) {
    alert("No staff data to export.");
    return;
  }
  const headers = ['Employee ID', 'Name', 'Role', 'Email', 'Phone', 'Branch', 'Salary Type', 'Daily Wage', 'Weekly Wage', 'Monthly Wage', 'Current Month Salary', 'Orders Today', 'Status', 'Joined Date'];
  const csvRows = [headers.join(',')];
  staff.forEach(member => {
    const branchName = member.assignedBranch || 'Unassigned';
    const row = [
      member.employeeId || 'N/A',
      `"${member.name || ''}"`,
      member.staffRole || '',
      member.email || '',
      member.phone || '',
      `"${branchName}"`,
      member.salaryType || 'DAILY',
      member.dailyRate || 0,
      member.weeklyRate || 0,
      member.monthlyRate || 0,
      member.currentMonthSalary ?? member.currentWeekSalary ?? 0,
      member.ordersHandledToday || 0,
      member.isActive ? 'Active' : 'Inactive',
      new Date(member.createdAt).toLocaleDateString()
    ];
    csvRows.push(row.join(','));
  });
  const csvData = csvRows.join('\n');
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Staff_Roster_${new Date().toISOString().split('T')[0]}.csv`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

 const handleDeleteStaff = async (id) =>{
 if (!window.confirm('Are you sure you want to remove this staff member?')) {
 return;
 }
 try {
 setStaffLoading(true);
 const response = await deleteStaff(id);
 if (response.success) {
 alert(response.message || 'Staff member deleted successfully.');
 fetchStaffList();
 }
 } catch (error) {
 console.error('Error deleting staff:', error);
 alert(error.response?.data?.message || 'Failed to delete staff member.');
 } finally {
 setStaffLoading(false);
 }
 };

 // Branch Handlers
  const handleAddBranch = async (e) =>{
    e.preventDefault();
    if (!newBranch.branchName || !newBranch.address) {
      alert('Branch Name and Address are required.');
      return;
    }
    try {
      const res = await createBranch({
        branchName: newBranch.branchName,
        address: newBranch.address,
        manager: newBranch.manager,
        latitude: newBranch.latitude ? Number(newBranch.latitude) : 0,
        longitude: newBranch.longitude ? Number(newBranch.longitude) : 0,
        allowedRadius: newBranch.allowedRadius ? Number(newBranch.allowedRadius) : 100,
        city: newBranch.city || '',
        state: newBranch.state || '',
        pincode: newBranch.pincode || '',
        googleMapsUrl: newBranch.googleMapsUrl || '',
        openingTime: newBranch.openingTime || '09:00 AM',
        closingTime: newBranch.closingTime || '10:00 PM',
        isActive: true,
        unifiedStaffMode: !!newBranch.unifiedStaffMode
      });
      if (res.success) {
        alert(`Branch "${newBranch.branchName}" created successfully.`);
        setNewBranch({
          branchId: '',
          branchName: '', address: '', manager: '', latitude: '', longitude: '', allowedRadius: 100,
          city: '', state: '', pincode: '', googleMapsUrl: '', openingTime: '09:00 AM', closingTime: '10:00 PM',
          unifiedStaffMode: false
        });
        setShowAddBranchModal(false);
        loadBranches();
      }
    } catch (error) {
      console.error('Error creating branch:', error);
      alert(error.response?.data?.message || 'Failed to create branch.');
    }
  };

  const handleEditBranch = async (e) =>{
    e.preventDefault();
    if (!editingBranch.branchName || !editingBranch.address) {
      alert('Branch Name and Address are required.');
      return;
    }
    try {
      const res = await updateBranch(editingBranch._id, {
        branchName: editingBranch.branchName,
        address: editingBranch.address,
        manager: editingBranch.manager,
        latitude: editingBranch.latitude ? Number(editingBranch.latitude) : 0,
        longitude: editingBranch.longitude ? Number(editingBranch.longitude) : 0,
        allowedRadius: editingBranch.allowedRadius ? Number(editingBranch.allowedRadius) : 100,
        city: editingBranch.city || '',
        state: editingBranch.state || '',
        pincode: editingBranch.pincode || '',
        googleMapsUrl: editingBranch.googleMapsUrl || '',
        openingTime: editingBranch.openingTime || '09:00 AM',
        closingTime: editingBranch.closingTime || '10:00 PM',
        isActive: editingBranch.isActive,
        unifiedStaffMode: !!editingBranch.unifiedStaffMode
      });
      if (res.success) {
        alert(`Branch updated successfully.`);
        setShowEditBranchModal(false);
        setEditingBranch(null);
        loadBranches();
      }
    } catch (error) {
      console.error('Error updating branch:', error);
      alert(error.response?.data?.message || 'Failed to update branch.');
    }
  };

  const handleDetectLocation = (type) =>{
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) =>{
        const { latitude, longitude } = position.coords;
        let addressStr = '';
        let cityStr = '';
        let stateStr = '';
        let postcodeStr = '';
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            cityStr = addr.city || addr.town || addr.village || addr.suburb || '';
            stateStr = addr.state || '';
            postcodeStr = addr.postcode || '';
            addressStr = data.display_name || '';
          }
        } catch (e) {
          console.error("Reverse geocoding error:", e);
        }

        const gMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

        if (type === 'new') {
          setNewBranch((prev) =>({
            ...prev,
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            address: addressStr || prev.address,
            city: cityStr || prev.city,
            state: stateStr || prev.state,
            pincode: postcodeStr || prev.pincode,
            googleMapsUrl: gMapsUrl,
            allowedRadius: prev.allowedRadius || 100
          }));
        } else if (type === 'edit') {
          setEditingBranch((prev) =>({
            ...prev,
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            address: addressStr || prev.address,
            city: cityStr || prev.city,
            state: stateStr || prev.state,
            pincode: postcodeStr || prev.pincode,
            googleMapsUrl: gMapsUrl,
            allowedRadius: prev.allowedRadius || 100
          }));
        }
        setDetectingLocation(false);
      },
      (error) =>{
        console.error("Error detecting location:", error);
        alert(`Failed to get location: ${error.message}. Please check if location access is blocked by your browser settings.`);
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

 const handleDeleteBranch = async (id) =>{
 if (!window.confirm('Are you sure you want to remove this branch?')) return;
 try {
 const res = await deleteBranch(id);
 if (res.success) {
 alert(res.message || 'Branch deleted successfully.');
 loadBranches();
 }
 } catch (error) {
 console.error('Error deleting branch:', error);
 alert(error.response?.data?.message || 'Failed to delete branch.');
 }
 };

  // Menu toggles
  const handleToggleAvailability = async (item) =>{
    const targetId = item._id || item.id;
    const willBeAvailable = !item.available;
    const confirmMessage = willBeAvailable
      ? `Are you sure you want to mark "${item.name}" as IN STOCK?`
      : `Are you sure you want to mark "${item.name}" as OUT OF STOCK?`;

    if (!window.confirm(confirmMessage)) return;

    const updatedStatus = willBeAvailable;
    // Optimistic UI update
    setMenuItems((prevItems) =>
      prevItems.map((m) => (String(m._id || m.id) === String(targetId)) ? { ...m, available: updatedStatus } : m)
    );
    const cache = getBranchCache(activeBranchId);
    if (cache.menuItems) {
      cache.menuItems = cache.menuItems.map((m) => (String(m._id || m.id) === String(targetId)) ? { ...m, available: updatedStatus } : m);
    }
    try {
      const response = await updateMenuItem(targetId, { available: updatedStatus });
      if (!response.success) {
        // Revert on failure
        setMenuItems((prevItems) =>
          prevItems.map((m) => (String(m._id || m.id) === String(targetId)) ? { ...m, available: item.available } : m)
        );
        if (cache.menuItems) {
          cache.menuItems = cache.menuItems.map((m) => (String(m._id || m.id) === String(targetId)) ? { ...m, available: item.available } : m);
        }
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
      // Revert on error
      setMenuItems((prevItems) =>
        prevItems.map((m) => (String(m._id || m.id) === String(targetId)) ? { ...m, available: item.available } : m)
      );
      if (cache.menuItems) {
        cache.menuItems = cache.menuItems.map((m) => (String(m._id || m.id) === String(targetId)) ? { ...m, available: item.available } : m);
      }
    }
  };

  // Delete menu item
  const handleDeleteMenuItem = async (id) =>{
    if (isMenuSubmitting) return;
    if (window.confirm('Are you sure you want to remove this menu item?')) {
      setIsMenuSubmitting(true);
      const cleanId = String(id);
      // Instant optimistic UI update
      setMenuItems((prevItems) => prevItems.filter((item) => String(item._id || item.id) !== cleanId));
      const cache = getBranchCache(activeBranchId);
      if (cache.menuItems) {
        cache.menuItems = cache.menuItems.filter((item) => String(item._id || item.id) !== cleanId);
      }
      try {
        const response = await deleteMenuItem(id);
        if (!response.success) {
          alert(response.message || 'Failed to remove menu item.');
          fetchMenu(true, activeBranchId);
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        alert(error.response?.data?.message || 'Error deleting menu item.');
        fetchMenu(true, activeBranchId);
      } finally {
        setIsMenuSubmitting(false);
      }
    }
  };

  // Add menu item
  const handleAddMenuItem = async (e) =>{
    e.preventDefault();
    if (isMenuSubmitting) return;
    if (!newItem.name || newItem.price === undefined || newItem.price === '' || !newItem.category) {
      alert('Please fill out all required fields (Name, Price, Category).');
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const branchIdToSave = activeBranchId === 'all' ? 'default' : (activeBranchId || 'default');
      const response = await createMenuItem({
        ...newItem,
        description: newItem.description || '',
        branchId: branchIdToSave
      });
      if (response.success && response.data) {
        const cleanId = String(response.data._id || response.data.id);
        const itemWithId = {
          ...response.data,
          id: cleanId,
          _id: cleanId
        };
        // Deduplicate in state: check if item was already added (e.g. from real-time socket event)
        setMenuItems((prevItems) => {
          const exists = prevItems.some((item) => String(item._id || item.id) === cleanId);
          if (exists) {
            return prevItems.map((item) => String(item._id || item.id) === cleanId ? itemWithId : item);
          }
          return [...prevItems, itemWithId];
        });
        const cache = getBranchCache(activeBranchId);
        if (cache && cache.menuItems) {
          const existsInCache = cache.menuItems.some((item) => String(item._id || item.id) === cleanId);
          if (existsInCache) {
            cache.menuItems = cache.menuItems.map((item) => String(item._id || item.id) === cleanId ? itemWithId : item);
          } else {
            cache.menuItems = [...cache.menuItems, itemWithId];
          }
        }
        setShowAddModal(false);
        setNewItem({
          name: '',
          price: '',
          makingCost: '',
          category: 'Signature Chai',
          description: '',
          available: true,
          image: '',
          recipe: [],
          preparationTime: 10
        });
      }
    } catch (error) {
      console.error('Error creating item:', error);
      alert(error.response?.data?.message || 'Error creating menu item');
    } finally {
      setIsMenuSubmitting(false);
    }
  };

  // Edit menu item
  const handleEditMenuItem = async (e) =>{
    e.preventDefault();
    if (isMenuSubmitting) return;
    if (!editingItem.name || editingItem.price === undefined || editingItem.price === '' || !editingItem.category) {
      alert('Please fill out all required fields (Name, Price, Category).');
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const editId = editingItem._id || editingItem.id;
      const response = await updateMenuItem(editId, editingItem);
      if (response.success && response.data) {
        const updatedWithId = {
          ...response.data,
          id: response.data._id || response.data.id
        };
        const targetIdStr = String(editId);
        // Instant state & cache update
        setMenuItems((prevItems) =>
          prevItems.map((m) => {
            const mIdStr = String(m._id || m.id);
            return (mIdStr === targetIdStr || (m.masterItemId && String(m.masterItemId) === targetIdStr)) ? updatedWithId : m;
          })
        );
        const cache = getBranchCache(activeBranchId);
        if (cache.menuItems) {
          cache.menuItems = cache.menuItems.map((m) => {
            const mIdStr = String(m._id || m.id);
            return (mIdStr === targetIdStr || (m.masterItemId && String(m.masterItemId) === targetIdStr)) ? updatedWithId : m;
          });
        }
        setShowEditModal(false);
        setEditingItem(null);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert(error.response?.data?.message || 'Error updating menu item');
    } finally {
      setIsMenuSubmitting(false);
    }
  };

  // Fetch Inventory List
  async function fetchInventoryList(isSilent = false, targetBranchId = activeBranchId) {
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.inventoryList) setInventoryLoading(true);
    try {
      const [invRes, logsRes, wasteRes, consRes] = await Promise.all([
        getInventory(),
        getInventoryLogs(),
        getWastageReport(),
        getConsumptionReport()
      ]);

      if (targetBranchId !== activeBranchIdRef.current) return;

      if (invRes.success) {
        const mappedInv = invRes.data.map(item => ({ ...item, id: item._id || item.id }));
        setInventoryList(mappedInv);
        cache.inventoryList = mappedInv;
        cache.hasLoaded.inventoryList = true;
        setInventoryError('');
      } else {
        setInventoryError('Failed to load inventory.');
      }

      if (logsRes.success) {
        setInventoryLogs(logsRes.data);
      }
      if (wasteRes.success) {
        setWastageReport(wasteRes);
      }
      if (consRes.success) {
        setConsumptionReport(consRes);
      }
    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      setInventoryError('Cannot connect to inventory database.');
    } finally {
      if (targetBranchId === activeBranchIdRef.current) {
        setInventoryLoading(false);
      }
    }
  };

 // Restock inventory item
 const handleRestockItem = async (id, currentStock) =>{
 try {
 const response = await updateInventoryItem(id, { stock: currentStock + 50 });
 if (response.success) {
 setInventoryList((prev) =>prev.map((item) =>item._id === id ? response.data : item));
 }
 } catch (error) {
 console.error('Error restocking item:', error);
 }
 };

 const handleAddInventoryItem = async (e) =>{
   e.preventDefault();
   if (isInventorySubmitting) return;
   try {
   setIsInventorySubmitting(true);
   const stockVal = Number(newInventoryItem.stock || 0);
   const totalCostVal = Number(newInventoryItem.totalPurchaseCost || 0);
   const calculatedUnitCost = (totalCostVal > 0 && stockVal > 0)
     ? Number((totalCostVal / stockVal).toFixed(4))
     : Number(newInventoryItem.costPrice || newInventoryItem.cost || 0);

   const payload = {
     ...newInventoryItem,
     stock: stockVal,
     quantity: stockVal,
     cost: calculatedUnitCost,
     costPrice: calculatedUnitCost,
     sellingPrice: 0,
     branch: activeBranch?.branchName || activeBranch?.name || newInventoryItem.branch || 'Main',
     branchId: activeBranchId === 'all' ? 'default' : (activeBranchId || 'default')
   };
   const response = await createInventoryItem(payload);
   if (response.success) {
   setInventoryList((prev) =>[...prev, response.data]);
   setShowAddInventoryModal(false);
   setNewInventoryItem({
   name: '',
   quantity: 0,
   stock: '',
   reorderLevel: 0,
   minStock: '',
   unit: 'g',
   costPrice: 0,
   cost: 0,
   totalPurchaseCost: '',
   sellingPrice: 0,
   supplier: '',
   supplierPhone: '',
   branch: 'Main',
   category: 'Ingredients'
   });
   fetchInventoryList(true); // reload all stats & logs as well silently
   }
   } catch (error) {
   console.error('Error adding inventory item:', error);
   alert(error.response?.data?.message || 'Error creating inventory item');
   } finally {
   setIsInventorySubmitting(false);
   }
   };

  // Edit Inventory Item
  const handleEditInventoryItem = async (e) =>{
  e.preventDefault();
  if (isInventorySubmitting) return;
  try {
  setIsInventorySubmitting(true);
  const payload = {
    ...editingInventoryItem,
    sellingPrice: 0,
    branch: editingInventoryItem.branch || activeBranch?.branchName || activeBranch?.name || 'Main'
  };
  const response = await updateInventoryItem(editingInventoryItem._id, payload);
  if (response.success) {
  setInventoryList((prev) =>prev.map((item) =>item._id === editingInventoryItem._id ? response.data : item));
  setShowEditInventoryModal(false);
  setEditingInventoryItem(null);
  }
  } catch (error) {
  console.error('Error updating inventory item:', error);
  alert(error.response?.data?.message || 'Error updating inventory item');
  } finally {
  setIsInventorySubmitting(false);
  }
  };

  // Delete Inventory Item
  const handleDeleteInventoryItem = async (id) =>{
    if (isInventorySubmitting) return;
    if (!window.confirm('Are you sure you want to delete this ingredient?')) return;
    setIsInventorySubmitting(true);
    try {
      const response = await deleteInventoryItem(id);
      if (response.success) {
        setInventoryList((prev) =>prev.filter((item) =>item._id !== id));
        setInventoryLogs((prev) =>prev.filter((log) =>String(log.itemId) !== String(id)));
        fetchInventoryList(true);
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Error deleting inventory item');
    } finally {
      setIsInventorySubmitting(false);
    }
  };

  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    const qty = Number(purchaseForm.quantityAdded);
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity purchased (greater than 0).');
      return;
    }
    const cost = Number(purchaseForm.costPrice);
    if (isNaN(cost) || cost < 0) {
      alert('Please enter a valid cost price per unit.');
      return;
    }
    
    // Close modal immediately for instant (<100ms) UI response
    setShowPurchaseModal(false);

    // Optimistic UI state update
    const currentItem = inventoryList.find(i => String(i._id || i.id) === String(purchaseForm.itemId));
    const oldQty = currentItem ? Number(currentItem.quantity || currentItem.stock || 0) : Number(purchaseForm.currentStock || 0);
    const newQty = Number((oldQty + qty).toFixed(3));

    setInventoryList((prev) => prev.map(item => {
      if (String(item._id || item.id) === String(purchaseForm.itemId)) {
        return { ...item, quantity: newQty, stock: newQty, costPrice: cost || item.costPrice, cost: cost || item.cost };
      }
      return item;
    }));

    const optimisticLog = {
      _id: 'temp-' + Date.now(),
      itemId: purchaseForm.itemId,
      itemName: purchaseForm.itemName,
      type: 'Purchase',
      quantityChanged: qty,
      oldQuantity: oldQty,
      remainingQuantity: newQty,
      cost: cost * qty,
      reason: purchaseForm.notes || 'Incoming stock added',
      performedBy: user?.name || user?.email || 'Owner',
      userEmail: user?.email || 'owner@cafe.com',
      createdAt: new Date().toISOString()
    };
    setInventoryLogs((prev) => [optimisticLog, ...prev]);

    try {
      const response = await recordPurchase({
        itemId: purchaseForm.itemId,
        quantityAdded: qty,
        costPrice: cost,
        supplier: purchaseForm.supplier,
        notes: purchaseForm.notes
      });
      if (response && response.success) {
        // Silently sync from backend in background
        fetchInventoryList(true);
      }
    } catch (error) {
      console.error('Error recording purchase:', error);
      alert(error.response?.data?.message || 'Error recording purchase. Reverting changes.');
      fetchInventoryList(true);
    }
  };

  const handleRecordWastage = async (e) => {
    e.preventDefault();
    const qty = Number(wastageForm.quantityWasted);
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity to reduce (greater than 0).');
      return;
    }

    // Close modal immediately for instant (<100ms) UI response
    setShowWastageModal(false);

    // Optimistic UI state update
    const currentItem = inventoryList.find(i => String(i._id || i.id) === String(wastageForm.itemId));
    const oldQty = currentItem ? Number(currentItem.quantity || currentItem.stock || 0) : Number(wastageForm.currentStock || 0);
    const newQty = Number(Math.max(0, oldQty - qty).toFixed(3));

    setInventoryList((prev) => prev.map(item => {
      if (String(item._id || item.id) === String(wastageForm.itemId)) {
        return { ...item, quantity: newQty, stock: newQty };
      }
      return item;
    }));

    const optimisticLog = {
      _id: 'temp-' + Date.now(),
      itemId: wastageForm.itemId,
      itemName: wastageForm.itemName,
      type: 'Adjustment',
      quantityChanged: -qty,
      oldQuantity: oldQty,
      remainingQuantity: newQty,
      cost: 0,
      reason: wastageForm.reason || 'Manual stock correction',
      performedBy: user?.name || user?.email || 'Owner',
      userEmail: user?.email || 'owner@cafe.com',
      createdAt: new Date().toISOString()
    };
    setInventoryLogs((prev) => [optimisticLog, ...prev]);

    try {
      const response = await recordWastage({
        itemId: wastageForm.itemId,
        quantityWasted: qty,
        type: wastageForm.type || 'Adjustment',
        reason: wastageForm.reason
      });
      if (response && response.success) {
        // Silently sync from backend in background
        fetchInventoryList(true);
      }
    } catch (error) {
      console.error('Error recording stock reduction:', error);
      alert(error.response?.data?.message || 'Error reducing stock. Reverting changes.');
      fetchInventoryList(true);
    }
  };

  const handleRevertMovement = async (log) => {
    if (!log) return;
    const qtyChange = Number(log.quantityChanged) || 0;
    const isAdd = qtyChange > 0 || log.type === 'Purchase' || log.type === 'Initial';
    const actionDesc = isAdd ? `subtract ${Math.abs(qtyChange)}` : `add back ${Math.abs(qtyChange)}`;

    const confirmMsg = `Revert this movement for "${log.itemName}"?\nThis will ${actionDesc} to restore the previous stock level and remove this record from the ledger.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    // 1. Optimistically update local inventory list
    const logItemId = String(log.itemId || '');
    setInventoryList((prev) => prev.map((item) => {
      if (String(item._id || item.id) === logItemId || (item.name && item.name.toLowerCase() === (log.itemName || '').toLowerCase())) {
        const currentQty = Number(item.quantity !== undefined ? item.quantity : (item.stock || 0));
        const newQty = Number(Math.max(0, currentQty - qtyChange).toFixed(3));
        const reorder = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.minStock || 0));
        const status = newQty <= 0 ? 'OUT_OF_STOCK' : (newQty <= reorder ? 'LOW_STOCK' : 'IN_STOCK');
        return {
          ...item,
          quantity: newQty,
          stock: newQty,
          status
        };
      }
      return item;
    }));

    // 2. Optimistically remove log from local movement list
    setInventoryLogs((prev) => prev.filter((l) => String(l._id) !== String(log._id)));

    // 3. Call backend API to persist stock restore and delete log
    try {
      const res = await revertInventoryLog(log._id);
      if (res && res.success) {
        // Silently sync from backend to guarantee fresh state
        fetchInventoryList(true);
      }
    } catch (err) {
      console.error('Error reverting inventory movement:', err);
      alert(err.response?.data?.message || 'Failed to revert movement. Refreshing...');
      fetchInventoryList(true);
    }
  };

 // Save Settings Config
 const handleSaveSettings = async (e) =>{
    e.preventDefault();
    setSettingsMsg('');
    try {
      const payload = {
        taxRate,
        serviceCharge,
        paymentConfig: {
          acceptCash,
          enableUpi,
          upiId,
          bankHolderName,
          accountNumber,
          ifscCode,
          paymentInstructions,
          taxRate,
          platformCharge: serviceCharge
        }
      };
      const response = await saveSetupData(payload);
      if (response.success) {
        setSettingsMsg('Configuration saved successfully!');
        setTimeout(() => setSettingsMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setSettingsMsg('Server error saving details.');
    }
  };

 // Copy table URL
 const handleCopyUrl = (table) =>{
  const url = `${window.location.origin}/?table=${table}&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`;
 navigator.clipboard.writeText(url);
 setCopiedLink(true);
 setTimeout(() =>setCopiedLink(false), 2000);
 };

 const formatLastSeen = (dateStr) =>{
 if (!dateStr) return 'Never';
 const date = new Date(dateStr);
 const now = new Date();
 const isToday = date.toDateString() === now.toDateString();
 const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
 return isToday ? `Today ${timeString}` : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${timeString}`;
 };

  // Analytical Calculations
  // Count Ready/Delivered/Completed orders as revenue (cafe counter model: Order Ready = sale done)
  const completedOrders = useMemo(() => {
    return orders.filter((o) => ['Ready', 'Delivered', 'Completed'].includes(o.status));
  }, [orders]);

  const todayOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return completedOrders.filter((o) => new Date(o.createdAt) >= startOfToday);
  }, [completedOrders]);

  const todayRevenue = useMemo(() => {
    return statsData && statsData.todayRevenue !== undefined 
      ? statsData.todayRevenue 
      : todayOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  }, [statsData, todayOrders]);

  // Use server-side payment breakdown (accurate, IST-timezone-aware)
  const todayCashSales = useMemo(() => {
    if (statsData && statsData.todayCashRevenue !== undefined) return statsData.todayCashRevenue;
    return todayOrders
      .filter((o) => {
        const method = (o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
        return method === 'cash';
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [statsData, todayOrders]);

  const todayOnlineSales = useMemo(() => {
    if (statsData && statsData.todayOnlineRevenue !== undefined) return statsData.todayOnlineRevenue;
    return todayOrders
      .filter((o) => {
        const method = (o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
        return method === 'online' || method === 'upi' || method === 'card';
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [statsData, todayOrders]);

  const yesterdayOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return completedOrders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= startOfYesterday && d < startOfToday;
    });
  }, [completedOrders]);

  const yesterdayCashSales = useMemo(() => {
    return yesterdayOrders
      .filter((o) => {
        const method = (o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
        return method === 'cash';
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [yesterdayOrders]);

  const yesterdayOnlineSales = useMemo(() => {
    return yesterdayOrders
      .filter((o) => {
        const method = (o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
        return method === 'online' || method === 'upi' || method === 'card';
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [yesterdayOrders]);

  const monthlyOrders = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return completedOrders.filter((o) => new Date(o.createdAt) >= startOfMonth);
  }, [completedOrders]);

  const monthlyRevenue = useMemo(() => {
    return statsData && statsData.monthlyRevenue !== undefined 
      ? statsData.monthlyRevenue 
      : monthlyOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  }, [statsData, monthlyOrders]);

  const monthlyCashSales = useMemo(() => {
    if (statsData && statsData.monthlyCashRevenue !== undefined) return statsData.monthlyCashRevenue;
    return monthlyOrders
      .filter((o) => {
        const method = (o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
        return method === 'cash';
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [statsData, monthlyOrders]);

  const monthlyOnlineSales = useMemo(() => {
    if (statsData && statsData.monthlyOnlineRevenue !== undefined) return statsData.monthlyOnlineRevenue;
    return monthlyOrders
      .filter((o) => {
        const method = (o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
        return method === 'online' || method === 'upi' || method === 'card';
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [statsData, monthlyOrders]);


  // Fast memoized lookup map for menu item makingCost
  const menuCostMap = useMemo(() => {
    const byId = {};
    const byName = {};
    (menuItems || []).forEach((m) => {
      const cost = Number(m.makingCost) || 0;
      const idKey = String(m._id || m.id || '');
      if (idKey) byId[idKey] = cost;
      if (m.name) byName[m.name.toLowerCase().trim()] = cost;
    });
    return { byId, byName };
  }, [menuItems]);

  const computeOrdersProfit = useCallback((ordersList) => {
    return (ordersList || []).reduce((totalProfit, ord) => {
      let orderCost = 0;
      if (Array.isArray(ord.items)) {
        ord.items.forEach((it) => {
          const idKey = String(it.id || it._id || '');
          const nameKey = (it.name || '').toLowerCase().trim();
          const unitCost = menuCostMap.byId[idKey] ?? menuCostMap.byName[nameKey] ?? 0;
          orderCost += unitCost * (Number(it.quantity) || 1);
        });
      }
      return totalProfit + ((Number(ord.totalAmount) || 0) - orderCost);
    }, 0);
  }, [menuCostMap]);

  // ── Other Expenses Handlers ──
  const fetchExpensesList = useCallback(async (isSilent = false) => {
    if (!user?.cafeId) return;
    if (!isSilent) setExpensesLoading(true);
    try {
      const params = { cafeId: user.cafeId };
      if (activeBranchId && activeBranchId !== 'all') {
        params.branchId = activeBranchId;
      }
      const res = await getExpenses(params);
      if (res && res.success) {
        setExpenses(res.data || []);
      }
    } catch (err) {
      console.warn('Error fetching expenses:', err);
    } finally {
      if (!isSilent) setExpensesLoading(false);
    }
  }, [user?.cafeId, activeBranchId]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpenseForm.title?.trim()) {
      alert('Please enter an expense title/description.');
      return;
    }
    const amt = Number(newExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid expense amount greater than 0.');
      return;
    }

    setExpenseSubmitting(true);
    try {
      const payload = {
        cafeId: user?.cafeId,
        branchId: activeBranchId || 'default',
        title: newExpenseForm.title.trim(),
        amount: amt,
        category: newExpenseForm.category || 'Miscellaneous',
        paymentMode: newExpenseForm.paymentMode || 'Cash',
        date: newExpenseForm.date ? new Date(newExpenseForm.date) : new Date(),
        notes: newExpenseForm.notes || ''
      };

      const res = await createExpense(payload);
      if (res && res.success) {
        setExpenses((prev) => [res.data, ...prev]);
        setNewExpenseForm({
          title: '',
          amount: '',
          category: 'Miscellaneous',
          paymentMode: 'Cash',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        alert('Expense recorded successfully!');
      } else {
        alert(res.message || 'Failed to record expense.');
      }
    } catch (err) {
      console.error('Error adding expense:', err);
      alert(err.response?.data?.message || 'Error recording expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    if (!editingExpense || !editingExpense._id) return;
    if (!editingExpense.title?.trim()) {
      alert('Please enter an expense title.');
      return;
    }
    const amt = Number(editingExpense.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    setExpenseSubmitting(true);
    try {
      const res = await updateExpense(editingExpense._id, {
        title: editingExpense.title.trim(),
        amount: amt,
        category: editingExpense.category,
        paymentMode: editingExpense.paymentMode,
        date: editingExpense.date,
        notes: editingExpense.notes
      });
      if (res && res.success) {
        setExpenses((prev) => prev.map((item) => item._id === editingExpense._id ? res.data : item));
        setEditingExpense(null);
        alert('Expense updated successfully!');
      } else {
        alert(res.message || 'Failed to update expense.');
      }
    } catch (err) {
      console.error('Error updating expense:', err);
      alert(err.response?.data?.message || 'Error updating expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const res = await deleteExpense(id);
      if (res && res.success) {
        setExpenses((prev) => prev.filter((item) => item._id !== id));
      } else {
        alert(res.message || 'Failed to delete expense.');
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert(err.response?.data?.message || 'Error deleting expense.');
    }
  };

  // ── Purchases & Daily Cash Register Handlers ──
  const fetchCashRegisterData = useCallback(async (targetDate) => {
    if (!user?.cafeId) return;
    setCashRegisterLoading(true);
    try {
      const dateToFetch = targetDate || cashRegisterDate;
      const params = { cafeId: user.cafeId, date: dateToFetch };
      if (activeBranchId && activeBranchId !== 'all') {
        params.branchId = activeBranchId;
      }
      const res = await getCashRegister(params);
      if (res && res.success) {
        const record = res.data || {};
        const isTargetDateToday = dateToFetch === new Date().toISOString().split('T')[0];

        const defaultTodayCash = (record.isNew && (!record.todayCash || record.todayCash === 0) && todayCashSales > 0)
          ? todayCashSales
          : (record.todayCash ? record.todayCash : (isTargetDateToday && todayCashSales > 0 ? todayCashSales : ''));

        const defaultYesterdayCash = (record.isNew && (!record.yesterdayCash || record.yesterdayCash === 0) && yesterdayCashSales > 0)
          ? yesterdayCashSales
          : ((record.yesterdayCash !== undefined && record.yesterdayCash !== 0) ? record.yesterdayCash : (record.yesterdayCash === 0 && !record.isNew ? (isTargetDateToday && yesterdayCashSales > 0 ? yesterdayCashSales : 0) : ''));

        const defaultBankBalance = (record.isNew && (!record.bankBalance || record.bankBalance === 0) && todayOnlineSales > 0)
          ? todayOnlineSales
          : ((record.bankBalance !== undefined && record.bankBalance !== 0) ? record.bankBalance : (isTargetDateToday && todayOnlineSales > 0 ? todayOnlineSales : ''));

        setCashRegisterForm({
          yesterdayCash: defaultYesterdayCash,
          todayCash: defaultTodayCash,
          bankBalance: defaultBankBalance,
          purchasesAmount: (record.purchasesAmount !== undefined && record.purchasesAmount !== 0) ? record.purchasesAmount : '',
          purchasesNote: record.purchasesNote || '',
          notes: record.notes || ''
        });
        setCashRegisterHistory(res.history || []);
      }
    } catch (err) {
      console.warn('Error fetching cash register:', err);
    } finally {
      setCashRegisterLoading(false);
    }
  }, [user?.cafeId, activeBranchId, cashRegisterDate, todayCashSales, yesterdayCashSales, todayOnlineSales]);

  const handleSaveCashRegister = async (e) => {
    e.preventDefault();
    setCashRegisterSubmitting(true);
    try {
      const yesterdayVal = Number(cashRegisterForm.yesterdayCash) || 0;
      const todayVal = Number(cashRegisterForm.todayCash) || 0;
      const purchasesVal = Number(cashRegisterForm.purchasesAmount) || 0;
      const netCalculated = (yesterdayVal + todayVal) - purchasesVal;

      const payload = {
        cafeId: user?.cafeId,
        branchId: activeBranchId || 'default',
        date: cashRegisterDate,
        yesterdayCash: yesterdayVal,
        todayCash: todayVal,
        bankBalance: Number(cashRegisterForm.bankBalance) || 0,
        purchasesAmount: purchasesVal,
        purchasesNote: cashRegisterForm.purchasesNote || '',
        notes: cashRegisterForm.notes || ''
      };

      // Optimistic update in history list
      setCashRegisterHistory((prev) => {
        const filtered = prev.filter((item) => item.date !== cashRegisterDate);
        return [{ ...payload, netCashInHand: netCalculated, _id: 'temp_' + Date.now() }, ...filtered];
      });

      const res = await saveCashRegister(payload);
      if (res && res.success) {
        if (res.data) {
          setCashRegisterHistory((prev) => [res.data, ...prev.filter((item) => item.date !== cashRegisterDate && !item._id.startsWith('temp_'))]);
        }
      } else {
        alert(res?.message || 'Failed to save cash register.');
      }
    } catch (err) {
      console.error('Error saving cash register:', err);
      alert(err.response?.data?.message || 'Error saving cash register.');
    } finally {
      setCashRegisterSubmitting(false);
    }
  };

  const handleDeleteCashRegister = async (id, dateStr) => {
    if (!window.confirm(`Are you sure you want to delete the daily register record for ${dateStr || 'this date'}?`)) return;
    try {
      const res = await deleteCashRegister(id);
      if (res && res.success) {
        setCashRegisterHistory((prev) => prev.filter((item) => item._id !== id));
        if (dateStr === cashRegisterDate) {
          fetchCashRegisterData(cashRegisterDate);
        }
      } else {
        alert(res.message || 'Failed to delete register record.');
      }
    } catch (err) {
      console.error('Error deleting register record:', err);
      alert(err.response?.data?.message || 'Error deleting register record.');
    }
  };

  // Expenses calculations
  const todayExpensesTotal = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (expenses || []).filter((e) => {
      const expDate = new Date(e.date || e.createdAt);
      return expDate >= startOfToday;
    }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const monthlyExpensesTotal = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return (expenses || []).filter((e) => {
      const expDate = new Date(e.date || e.createdAt);
      return expDate >= startOfMonth;
    }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const todayProfit = useMemo(() => {
    const baseProfit = (statsData && statsData.todayProfit !== undefined)
      ? statsData.todayProfit
      : computeOrdersProfit(todayOrders);
    return baseProfit - todayExpensesTotal;
  }, [statsData, todayOrders, computeOrdersProfit, todayExpensesTotal]);

  const todayMargin = useMemo(() => {
    if (statsData && statsData.todayMargin !== undefined && todayExpensesTotal === 0) {
      return statsData.todayMargin;
    }
    return todayRevenue > 0 ? Number(((todayProfit / todayRevenue) * 100).toFixed(1)) : 0;
  }, [statsData, todayRevenue, todayProfit, todayExpensesTotal]);

  const monthlyProfit = useMemo(() => {
    const baseProfit = (statsData && statsData.monthlyProfit !== undefined)
      ? statsData.monthlyProfit
      : computeOrdersProfit(monthlyOrders);
    return baseProfit - monthlyExpensesTotal;
  }, [statsData, monthlyOrders, computeOrdersProfit, monthlyExpensesTotal]);

  const monthlyMargin = useMemo(() => {
    if (statsData && statsData.monthlyMargin !== undefined && monthlyExpensesTotal === 0) {
      return statsData.monthlyMargin;
    }
    return monthlyRevenue > 0 ? Number(((monthlyProfit / monthlyRevenue) * 100).toFixed(1)) : 0;
  }, [statsData, monthlyRevenue, monthlyProfit, monthlyExpensesTotal]);

  const totalInventoryValue = useMemo(() => {
    if (statsData?.inventory?.value !== undefined) {
      return statsData.inventory.value;
    }
    return inventoryList.reduce((acc, item) => 
      acc + (item.quantity !== undefined ? item.quantity : item.stock) * (item.costPrice !== undefined ? item.costPrice : item.cost), 
      0
    );
  }, [inventoryList, statsData]);

  const purchaseLogs = useMemo(() => {
    return inventoryLogs.filter((log) => log.type === 'Purchase' || log.type === 'Initial');
  }, [inventoryLogs]);

  const totalInventoryCost = useMemo(() => {
    if (statsData && statsData.totalInventoryCost !== undefined) {
      return statsData.totalInventoryCost;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthPurchases = purchaseLogs.filter((log) => new Date(log.createdAt) >= startOfMonth);
    return thisMonthPurchases.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [purchaseLogs, statsData]);

  const deductionLogs = useMemo(() => {
    return inventoryLogs.filter((log) => log.type === 'Deduction');
  }, [inventoryLogs]);

  const totalInventoryConsumption = useMemo(() => {
    if (statsData?.inventory?.consumption !== undefined) {
      return statsData.inventory.consumption;
    }
    if (statsData && statsData.totalInventoryConsumption !== undefined) {
      return statsData.totalInventoryConsumption;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthDeductions = deductionLogs.filter((log) => new Date(log.createdAt) >= startOfMonth);
    return thisMonthDeductions.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [deductionLogs, statsData]);

  const rankedItems = useMemo(() => {
    if (statsData && statsData.topSellingItems !== undefined) {
      return {
        topSelling: statsData.topSellingItems || [],
        slowSelling: (statsData.slowSellingItems || []).filter(item => (item.quantity || 0) === 0)
      };
    }
    const itemCounts = {};
    (todayOrders || []).forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const name = item.name || 'Unknown Item';
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          if (!itemCounts[name]) {
            itemCounts[name] = { name, quantity: 0, revenue: 0 };
          }
          itemCounts[name].quantity += qty;
          itemCounts[name].revenue += qty * price;
        });
      }
    });

    const soldList = Object.values(itemCounts).filter(i => i.quantity > 0).sort((a, b) => b.quantity - a.quantity);
    const topSelling = soldList.slice(0, 10);

    const allMenuMap = {};
    (menuItems || []).forEach(m => {
      if (m.name && m.isHidden !== true) {
        allMenuMap[m.name] = {
          name: m.name,
          quantity: itemCounts[m.name]?.quantity || 0,
          revenue: itemCounts[m.name]?.revenue || 0,
          category: m.category || 'Dishes'
        };
      }
    });
    const combinedList = Object.keys(allMenuMap).length > 0 
      ? Object.values(allMenuMap) 
      : Object.values(itemCounts);

    // Strictly items that were not sold even one time (0 sales)
    const slowSelling = combinedList
      .filter(i => (i.quantity || 0) === 0)
      .slice(0, 10);

    return { topSelling, slowSelling };
  }, [todayOrders, menuItems, statsData]);

  const { topSelling, slowSelling } = rankedItems;

  const handleExportMonthlyReportExcel = useCallback(() => {
    try {
      const now = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      
      // Target is Previous Full Calendar Month (e.g. In September, export August 1-31)
      const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const targetMonthIndex = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();
      const targetMonthName = monthNames[targetMonthIndex];

      const startOfPrevMonth = new Date(targetYear, targetMonthIndex, 1, 0, 0, 0, 0);
      const endOfPrevMonth = new Date(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999);

      const branchLabel = activeBranch?.branchName ? `${activeBranch.branchName} (${activeBranch.branchId})` : (activeBranchId === 'all' ? 'All Branches' : 'Main Branch');

      // 1. Filter completed orders for the target month
      const prevMonthOrders = (orders || []).filter(o => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        const inDateRange = d >= startOfPrevMonth && d <= endOfPrevMonth;
        const isCompleted = ['Ready', 'Delivered', 'Completed'].includes(o.status);
        return inDateRange && isCompleted;
      });

      // Calculate financials for target month
      let prevMonthRevenue = 0;
      let prevMonthMakingCost = 0;
      let qrOrderCount = 0;
      let posOrderCount = 0;
      const dishSalesMap = {};

      prevMonthOrders.forEach(order => {
        const orderTotal = Number(order.grandTotal !== undefined ? order.grandTotal : (order.totalAmount || 0));
        prevMonthRevenue += orderTotal;

        if (order.source === 'STAFF' || order.orderSource === 'POS') {
          posOrderCount += 1;
        } else {
          qrOrderCount += 1;
        }

        // Tally items
        (order.items || []).forEach(item => {
          const itemName = item.name || 'Item';
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          const cost = Number(item.makingCost) || 0;
          const lineRevenue = qty * price;
          const lineCost = qty * cost;

          prevMonthMakingCost += lineCost;

          if (!dishSalesMap[itemName]) {
            dishSalesMap[itemName] = {
              name: itemName,
              category: item.category || 'General',
              quantity: 0,
              revenue: 0
            };
          }
          dishSalesMap[itemName].quantity += qty;
          dishSalesMap[itemName].revenue += lineRevenue;
        });
      });

      // If no archived orders in memory for prev month, provide best estimate from stats or zeros
      const finalRevenue = prevMonthRevenue > 0 ? prevMonthRevenue : (Number(monthlyRevenue) || 0);
      const finalGrossProfit = prevMonthRevenue > 0 ? (prevMonthRevenue - prevMonthMakingCost) : (Number(monthlyProfit) || 0);
      const finalMargin = finalRevenue > 0 ? ((finalGrossProfit / finalRevenue) * 100).toFixed(1) : 0;

      // Filter Inventory purchases & consumption in target month
      const prevMonthPurchases = (inventoryLogs || []).filter(log => {
        if (!log.createdAt && !log.timestamp) return false;
        const d = new Date(log.createdAt || log.timestamp);
        return d >= startOfPrevMonth && d <= endOfPrevMonth && (log.type === 'Purchase' || log.type === 'Initial');
      });
      const prevMonthDeductions = (inventoryLogs || []).filter(log => {
        if (!log.createdAt && !log.timestamp) return false;
        const d = new Date(log.createdAt || log.timestamp);
        return d >= startOfPrevMonth && d <= endOfPrevMonth && log.type === 'Deduction';
      });

      const targetPurchasesCost = prevMonthPurchases.reduce((acc, l) => acc + (Number(l.totalCost) || (Number(l.unitCost || 0) * Math.abs(Number(l.quantityChanged || 0)))), 0);
      const targetConsumptionCost = prevMonthDeductions.reduce((acc, l) => acc + (Number(l.totalCost) || (Number(l.unitCost || 0) * Math.abs(Number(l.quantityChanged || 0)))), 0);

      // Rank Top Selling and Unsold dishes
      const allDishes = Object.values(dishSalesMap);
      const targetTopSelling = [...allDishes].filter(a => (a.quantity || 0) > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 15);
      const targetSlowSelling = [...allDishes].filter(a => (a.quantity || 0) === 0).slice(0, 15);

      const wb = XLSX.utils.book_new();

      // ==================== SHEET 1: EXECUTIVE FINANCIAL SUMMARY ====================
      const summaryData = [
        { "Metric / KPI": "Report Period (Previous Month)", "Value": `${targetMonthName} ${targetYear} (Full Month)` },
        { "Metric / KPI": "Branch", "Value": branchLabel },
        { "Metric / KPI": "Report Generated At", "Value": now.toLocaleString('en-IN') },
        { "Metric / KPI": "---", "Value": "---" },
        { "Metric / KPI": "Total Monthly Revenue (₹)", "Value": Number(finalRevenue.toFixed(2)) },
        { "Metric / KPI": "Total Gross Profit (₹)", "Value": Number(finalGrossProfit.toFixed(2)) },
        { "Metric / KPI": "Gross Profit Margin (%)", "Value": `${finalMargin}%` },
        { "Metric / KPI": "Total Completed Orders (Count)", "Value": prevMonthOrders.length },
        { "Metric / KPI": "QR Menu Orders (Count)", "Value": qrOrderCount },
        { "Metric / KPI": "Staff POS Counter Orders (Count)", "Value": posOrderCount },
        { "Metric / KPI": "Inventory Stock Purchased This Month (₹)", "Value": Number(targetPurchasesCost.toFixed(2)) },
        { "Metric / KPI": "Inventory Consumed in Kitchen (₹)", "Value": Number(targetConsumptionCost.toFixed(2)) },
        { "Metric / KPI": "Current Inventory Asset Value (₹)", "Value": Number(totalInventoryValue.toFixed(2)) }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Monthly Financial Overview");

      // ==================== SHEET 2: TOP SELLING DISHES ====================
      const topSellingData = targetTopSelling.length > 0 ? targetTopSelling.map((item, idx) => ({
        "Rank": idx + 1,
        "Item Name": item.name,
        "Category": item.category,
        "Quantity Sold": item.quantity,
        "Total Revenue (₹)": Number((item.revenue || 0).toFixed(2))
      })) : (topSelling.length > 0 ? topSelling.map((item, idx) => ({
        "Rank": idx + 1,
        "Item Name": item.name,
        "Category": item.category || 'General',
        "Quantity Sold": item.quantity,
        "Total Revenue (₹)": Number((item.revenue || 0).toFixed(2))
      })) : [{ "Rank": "-", "Item Name": "No sales recorded in period", "Category": "-", "Quantity Sold": 0, "Total Revenue (₹)": 0 }]);
      const wsTopSelling = XLSX.utils.json_to_sheet(topSellingData);
      XLSX.utils.book_append_sheet(wb, wsTopSelling, "Top Selling Dishes");

      // ==================== SHEET 3: SLOW & LOW-SELLING DISHES ====================
      const slowSellingData = targetSlowSelling.length > 0 ? targetSlowSelling.map((item, idx) => ({
        "Rank": idx + 1,
        "Item Name": item.name,
        "Category": item.category,
        "Quantity Sold": item.quantity,
        "Total Revenue (₹)": Number((item.revenue || 0).toFixed(2))
      })) : (slowSelling.length > 0 ? slowSelling.map((item, idx) => ({
        "Rank": idx + 1,
        "Item Name": item.name,
        "Category": item.category || "General",
        "Quantity Sold": item.quantity,
        "Total Revenue (₹)": Number((item.revenue || 0).toFixed(2))
      })) : [{ "Rank": "-", "Item Name": "No dishes found", "Category": "-", "Quantity Sold": 0, "Total Revenue (₹)": 0 }]);
      const wsSlowSelling = XLSX.utils.json_to_sheet(slowSellingData);
      XLSX.utils.book_append_sheet(wb, wsSlowSelling, "Slow & Low-Selling Dishes");

      // ==================== SHEET 4: INVENTORY & COST BREAKDOWN ====================
      const inventorySheetData = (inventoryList || []).length > 0 ? (inventoryList || []).map((inv, idx) => ({
        "S.No": idx + 1,
        "Ingredient Name": inv.name,
        "Category": inv.category || "Stock",
        "Current Stock": `${inv.quantity !== undefined ? inv.quantity : (inv.stock || 0)} ${inv.unit || 'unit'}`,
        "Unit Cost (₹)": Number(inv.unitPrice || inv.costPerUnit || 0).toFixed(2),
        "Stock Valuation (₹)": Number(((inv.quantity !== undefined ? inv.quantity : (inv.stock || 0)) * (inv.unitPrice || inv.costPerUnit || 0)).toFixed(2)),
        "Safety Reorder Level": `${inv.reorderLevel !== undefined ? inv.reorderLevel : (inv.minStock || 0)} ${inv.unit || 'unit'}`
      })) : [{ "S.No": "-", "Ingredient Name": "No inventory registered", "Category": "-", "Current Stock": "-", "Unit Cost (₹)": 0, "Stock Valuation (₹)": 0, "Safety Reorder Level": "-" }];
      const wsInventory = XLSX.utils.json_to_sheet(inventorySheetData);
      XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory Breakdown");

      // ==================== SHEET 5: STAFF & WAGE SUMMARY ====================
      const staffSheetData = (staff || []).length > 0 ? staff.map((s, idx) => ({
        "S.No": idx + 1,
        "Employee ID": s.employeeId || `EMP-${String(s._id || '').slice(-6).toUpperCase()}`,
        "Staff Name": s.name || "N/A",
        "Role": s.staffRole || s.role || "Staff",
        "Assigned Branch": s.assignedBranch || s.branch || "Main",
        "Phone": s.phone || "N/A",
        "Daily Wage Rate (₹)": s.dailyRate || s.salary || 0,
        "Shift Timings": `${s.shiftStartTime || '09:00'} - ${s.shiftEndTime || '18:00'}`,
        "Status": s.isActive === false ? "Inactive" : "Active"
      })) : [{ "S.No": "-", "Employee ID": "-", "Staff Name": "No staff registered", "Role": "-", "Assigned Branch": "-", "Phone": "-", "Daily Wage Rate (₹)": 0, "Shift Timings": "-", "Status": "-" }];
      const wsStaff = XLSX.utils.json_to_sheet(staffSheetData);
      XLSX.utils.book_append_sheet(wb, wsStaff, "Staff & Payroll Summary");

      // Write and download
      const cleanBranchName = (activeBranch?.branchName || 'AllBranches').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Cafe_Monthly_Report_${cleanBranchName}_${targetMonthName}_${targetYear}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error generating Excel report:', err);
      alert('Failed to generate Excel report. Please try again.');
    }
  }, [activeBranch, activeBranchId, orders, monthlyRevenue, monthlyProfit, totalInventoryValue, inventoryLogs, inventoryList, topSelling, slowSelling, staff]);

 const getTopConsumedIngredients = () =>{
 const consumptionMap = {};
 inventoryLogs.
 filter((log) =>log.type === 'Deduction').
 forEach((log) =>{
 const name = log.itemName;
 const qty = Math.abs(log.quantityChanged || 0);
 consumptionMap[name] = (consumptionMap[name] || 0) + qty;
 });

 return Object.entries(consumptionMap).
 map(([name, qty]) =>{
 const item = inventoryList.find((i) =>i.name === name);
 return { name, quantity: qty, unit: item?.unit || 'g' };
 }).
 sort((a, b) =>b.quantity - a.quantity).
 slice(0, 5);
 };

  // ── All Component Side Effects (useEffect Hooks) ──
  useEffect(() => {
    activeBranchIdRef.current = activeBranchId;
  }, [activeBranchId]);

  useEffect(() => {
    if (tabParam) {
      if (tabParam === 'reviews') {
        setActiveTab('menu');
        setMenuSubTab('reviews');
      } else if (tabParam === 'reports' || tabParam === 'financial_reports') {
        setActiveTab('analytics');
        navigate('/owner/dashboard', { replace: true });
      } else if (tabParam === 'attendance') {
        setActiveTab('staff');
        setStaffSubTab('attendance');
      } else if (tabParam === 'settings' || tabParam === 'config') {
        navigate('/owner/profile');
      } else {
        setActiveTab(tabParam);
        if (tabParam === 'menu') {
          setMenuSubTab('dishes');
        }
        if (tabParam === 'staff') {
          const subParam = searchParams.get('sub');
          if (subParam === 'salary') {
            setStaffSubTab('salary');
          } else if (subParam === 'reports') {
            setStaffSubTab('reports');
          } else {
            setStaffSubTab('roster');
          }
        }
      }
    } else {
      setActiveTab('analytics');
    }
    const contentEl = document.querySelector('.saas-content-inner');
    if (contentEl) {
      contentEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [tabParam, searchParams, navigate]);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReportData();
    }
  }, [activeTab, reportType, reportBranchId, reportDateRange, reportStartDate, reportEndDate]);

  useEffect(() => {
    if (activeTab === 'menu' && menuSubTab === 'reviews') {
      fetchReviewsData();
    }
  }, [activeTab, menuSubTab, reviewsFilterRating]);

  useEffect(() => {
    if (activeTab === 'staff' && (staffSubTab === 'attendance' || staffSubTab === 'all')) {
      fetchAttendanceReportsData(false, activeBranchId);
    }
  }, [reportRange, reportBranch, activeTab, staffSubTab, activeBranchId]);

  useEffect(() => {
    if (activeTab === 'staff' && (staffSubTab === 'reports' || staffSubTab === 'photos' || staffSubTab === 'all')) {
      fetchWorkReports(false, activeBranchId);
    }
  }, [reportsFilterRange, reportsFilterStaff, reportsFilterBranch, activeTab, staffSubTab, activeBranchId]);

  useEffect(() => {
    if (activeTab === 'staff' && (staffSubTab === 'salary' || staffSubTab === 'all') && salaryRunTab === 'history') {
      fetchSalaryHistory(activeBranchId);
    }
  }, [salaryHistoryPeriod, salaryRunTab, activeTab, staffSubTab, activeBranchId]);

  useEffect(() => {
    if (!user || !user.cafeId) return;

    loadSetupConfig();

    const targetBranch = activeBranchId;
    const cache = getBranchCache(targetBranch);

    const refreshData = async () => {
      if (activeTab === 'analytics') {
        const silent = !!cache.hasLoaded.statsData;
        await fetchDashboardStats(silent, targetBranch);
      } else if (activeTab === 'orders') {
        const silent = !!cache.hasLoaded.orders;
        await fetchOrders(silent, targetBranch);
      } else if (activeTab === 'menu') {
        const silent = !!cache.hasLoaded.menuItems;
        await Promise.all([
          fetchMenu(silent, targetBranch),
          fetchCategories(silent, targetBranch),
          fetchInventoryList(silent, targetBranch)
        ]);
      } else if (activeTab === 'staff') {
        const silent = !!cache.hasLoaded.staff;
        await Promise.all([
          fetchStaffList(silent, targetBranch),
          fetchAttendanceToday(silent, targetBranch),
          fetchWorkReports(silent, targetBranch),
          fetchAttendanceReportsData(true, targetBranch),
          fetchSalaryHistory(targetBranch)
        ]);
      } else if (activeTab === 'inventory') {
        const silent = !!cache.hasLoaded.inventoryList;
        await Promise.all([
          fetchInventoryList(silent, targetBranch),
          fetchInventoryCategories(silent, targetBranch)
        ]);
      } else if (activeTab === 'reports') {
        loadReportData(true);
      }
    };

    refreshData();

    if (user && user.cafeId) {
      const handleOrderCreated = (newOrder) => {
        setOrders(prev => {
          if (prev.some(o => o._id === newOrder._id)) return prev;
          const isMatching = !activeBranchId || activeBranchId === 'all' ||
            newOrder.branchId === activeBranchId ||
            newOrder.branchId === 'default' ||
            activeBranchId === 'default' ||
            (activeBranch && (activeBranch.branchId === newOrder.branchId || String(activeBranch._id) === String(newOrder.branchId)));
          if (!isMatching) {
            return prev;
          }
          const updated = [newOrder, ...prev];
          const targetCache = getBranchCache(activeBranchId);
          targetCache.orders = updated;
          return updated;
        });
        fetchDashboardStats(true, activeBranchId);
      };

      const handleOrderUpdated = (updatedOrder) => {
        setOrders(prev => {
          let updated;
          const isMatching = !activeBranchId || activeBranchId === 'all' ||
            updatedOrder.branchId === activeBranchId ||
            updatedOrder.branchId === 'default' ||
            activeBranchId === 'default' ||
            (activeBranch && (activeBranch.branchId === updatedOrder.branchId || String(activeBranch._id) === String(updatedOrder.branchId)));
          if (!isMatching) {
            updated = prev.filter(o => o._id !== updatedOrder._id);
          } else {
            const exists = prev.some(o => o._id === updatedOrder._id);
            if (exists) {
              updated = prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
            } else {
              updated = [updatedOrder, ...prev];
            }
          }
          const targetCache = getBranchCache(activeBranchId);
          targetCache.orders = updated;
          return updated;
        });
        fetchDashboardStats(true, activeBranchId);
      };

      const handleOrderDeleted = (data) => {
        const delId = typeof data === 'object' ? data.orderId || data._id : data;
        setOrders(prev => {
          const updated = prev.filter(o => o._id !== delId);
          const targetCache = getBranchCache(activeBranchId);
          targetCache.orders = updated;
          return updated;
        });
        fetchDashboardStats(true, activeBranchId);
      };

      const handleOrderCancelled = (cancelledOrder) => {
        const canId = typeof cancelledOrder === 'object' ? cancelledOrder._id : cancelledOrder;
        setOrders(prev => {
          const updated = prev.map(o => (o._id === canId ? { ...o, ...(typeof cancelledOrder === 'object' ? cancelledOrder : {}), status: 'Cancelled' } : o));
          const targetCache = getBranchCache(activeBranchId);
          targetCache.orders = updated;
          return updated;
        });
        fetchDashboardStats(true, activeBranchId);
      };

      const handleMenuUpdated = (payload) => {
        if (payload && payload.deletedId) {
          const dId = String(payload.deletedId);
          setMenuItems(prev => prev.filter(item => String(item._id || item.id) !== dId));
          const cache = getBranchCache(activeBranchId);
          if (cache.menuItems) {
            cache.menuItems = cache.menuItems.filter(item => String(item._id || item.id) !== dId);
          }
        } else if (payload && (payload._id || payload.id)) {
          const pId = String(payload._id || payload.id);
          const itemWithId = { ...payload, id: pId };
          setMenuItems(prev => {
            const exists = prev.some(item => String(item._id || item.id) === pId);
            if (exists) {
              return prev.map(item => String(item._id || item.id) === pId ? itemWithId : item);
            }
            return [...prev, itemWithId];
          });
          const cache = getBranchCache(activeBranchId);
          if (cache.menuItems) {
            const exists = cache.menuItems.some(item => String(item._id || item.id) === pId);
            if (exists) {
              cache.menuItems = cache.menuItems.map(item => String(item._id || item.id) === pId ? itemWithId : item);
            } else {
              cache.menuItems = [...cache.menuItems, itemWithId];
            }
          }
        } else {
          fetchMenu(true, activeBranchId);
          fetchCategories(true, activeBranchId);
        }
      };

      const handleRealtimeSync = (payload) => {
        if (payload.cafeId && payload.cafeId !== user.cafeId) return;

        const branchKey = payload.branchId || 'all';
        const targetCache = getBranchCache(branchKey);
        
        if (payload.model === 'Order') {
          targetCache.hasLoaded.orders = false;
          targetCache.hasLoaded.statsData = false;
        } else if (payload.model === 'Inventory') {
          targetCache.hasLoaded.inventoryList = false;
          targetCache.hasLoaded.statsData = false;
        } else if (payload.model === 'User') {
          targetCache.hasLoaded.staff = false;
        } else if (payload.model === 'Attendance') {
          targetCache.hasLoaded.attendanceRecords = false;
        } else if (payload.model === 'Payroll') {
          targetCache.hasLoaded.workReports = false;
        }

        const isCurrentBranch = activeBranchId === branchKey || branchKey === 'all' || activeBranchId === 'all';
        if (isCurrentBranch) {
          if (payload.model === 'Order' || payload.model === 'Inventory') {
            fetchDashboardStats(true, activeBranchId);
          }
          
          if (activeTab === 'analytics') {
            fetchDashboardStats(true, activeBranchId);
            fetchInventoryList(true, activeBranchId);
          } else if (activeTab === 'orders' && payload.model === 'Order') {
            fetchOrders(true, activeBranchId);
          } else if (activeTab === 'menu' && (payload.model === 'Category' || payload.model === 'MenuItem')) {
            fetchMenu(true, activeBranchId);
            fetchCategories(true, activeBranchId);
          } else if (activeTab === 'staff') {
            if (payload.model === 'User') fetchStaffList(true, activeBranchId);
            if (payload.model === 'Attendance') fetchAttendanceToday(true, activeBranchId);
          } else if (activeTab === 'inventory' && (payload.model === 'Inventory' || payload.model === 'InventoryLog')) {
            fetchInventoryList(true, activeBranchId);
          }
        }
      };

      const handleInventoryUpdated = (payload) => {
        const branchKey = payload.branchId || 'all';
        const isCurrentBranch = activeBranchId === branchKey || branchKey === 'all' || activeBranchId === 'all';
        if (isCurrentBranch) {
          fetchInventoryList(true, activeBranchId);
          fetchDashboardStats(true, activeBranchId);
        }
      };

      const handleStaffUpdated = (payload) => {
        const branchKey = payload.branchId || 'all';
        const isCurrentBranch = activeBranchId === branchKey || branchKey === 'all' || activeBranchId === 'all';
        if (isCurrentBranch) {
          fetchStaffList(true, activeBranchId);
        }
      };

      const handleAttendanceUpdated = (payload) => {
        const branchKey = payload.branchId || 'all';
        const isCurrentBranch = activeBranchId === branchKey || branchKey === 'all' || activeBranchId === 'all';
        if (isCurrentBranch) {
          fetchAttendanceToday(true, activeBranchId);
        }
      };

      const handlePayrollUpdated = (payload) => {
        const branchKey = payload.branchId || 'all';
        const isCurrentBranch = activeBranchId === branchKey || branchKey === 'all' || activeBranchId === 'all';
        if (isCurrentBranch && activeTab === 'reports') {
          loadReportData(true);
        }
      };

      const handleReviewsUpdated = (payload) => {
        const branchKey = payload.branchId || 'all';
        const isCurrentBranch = activeBranchId === branchKey || branchKey === 'all' || activeBranchId === 'all';
        if (isCurrentBranch && activeTab === 'menu' && menuSubTab === 'reviews') {
          fetchReviewsData(true);
        }
      };

      socket.on('order_created', handleOrderCreated);
      socket.on('orderCreated', handleOrderCreated);
      socket.on('order_updated', handleOrderUpdated);
      socket.on('orderUpdated', handleOrderUpdated);
      socket.on('order_deleted', handleOrderDeleted);
      socket.on('orderDeleted', handleOrderDeleted);
      socket.on('order_cancelled', handleOrderCancelled);
      socket.on('orderCancelled', handleOrderCancelled);
      socket.on('menu_updated', handleMenuUpdated);
      socket.on('dashboard_realtime_sync', handleRealtimeSync);
      socket.on('inventory_updated', handleInventoryUpdated);
      socket.on('staff_updated', handleStaffUpdated);
      socket.on('attendance_updated', handleAttendanceUpdated);
      socket.on('payroll_updated', handlePayrollUpdated);
      socket.on('reviews_updated', handleReviewsUpdated);

      return () => {
        socket.off('order_created', handleOrderCreated);
        socket.off('orderCreated', handleOrderCreated);
        socket.off('order_updated', handleOrderUpdated);
        socket.off('orderUpdated', handleOrderUpdated);
        socket.off('order_deleted', handleOrderDeleted);
        socket.off('orderDeleted', handleOrderDeleted);
        socket.off('order_cancelled', handleOrderCancelled);
        socket.off('orderCancelled', handleOrderCancelled);
        socket.off('menu_updated', handleMenuUpdated);
        socket.off('dashboard_realtime_sync', handleRealtimeSync);
        socket.off('inventory_updated', handleInventoryUpdated);
        socket.off('staff_updated', handleStaffUpdated);
        socket.off('attendance_updated', handleAttendanceUpdated);
        socket.off('payroll_updated', handlePayrollUpdated);
        socket.off('reviews_updated', handleReviewsUpdated);
      };
    }
  }, [activeTab, menuSubTab, staffSubTab, reviewsFilterRating, orderDateFilter, user, activeBranchId]);

  useEffect(() => {
    const unsubscribe = onBranchSwitch((newBranchId) => {
      const cache = getBranchCache(newBranchId);
      
      if (cache.hasLoaded.orders) {
        setOrders(cache.orders);
        setOrdersLoading(false);
      } else {
        setOrders([]);
        setOrdersLoading(true);
      }
      if (cache.hasLoaded.menuItems) {
        setMenuItems(cache.menuItems);
        setMenuLoading(false);
      } else {
        setMenuItems([]);
        setMenuLoading(true);
      }
      if (cache.hasLoaded.inventoryList) {
        setInventoryList(cache.inventoryList);
        setInventoryLoading(false);
      } else {
        setInventoryList([]);
        setInventoryLoading(true);
      }
      if (cache.hasLoaded.categories) {
        setCategories(cache.categories);
        setCategoryLoading(false);
      } else {
        setCategories([]);
        setCategoryLoading(true);
      }
      if (cache.hasLoaded.inventoryCategories) {
        setInventoryCategories(cache.inventoryCategories);
        setInvCategoryLoading(false);
      } else {
        setInventoryCategories([]);
        setInvCategoryLoading(true);
      }
      if (cache.hasLoaded.staff) {
        setStaff(cache.staff);
        setStaffLoading(false);
      } else {
        setStaff([]);
        setStaffLoading(true);
      }
      if (cache.hasLoaded.attendanceRecords) {
        setAttendanceRecords(cache.attendanceRecords);
        setAttendanceSummary(cache.attendanceSummary);
        setAttendanceLoading(false);
      } else {
        setAttendanceRecords([]);
        setAttendanceSummary({ total: 0, present: 0, absent: 0, late: 0, presentPct: 0 });
        setAttendanceLoading(true);
      }
      if (cache.hasLoaded.workReports) {
        setWorkReports(cache.workReports);
        setReportsLoading(false);
      } else {
        setWorkReports([]);
        setReportsLoading(true);
      }
      if (cache.hasLoaded.attendanceReports) {
        setAttendanceReports(cache.attendanceReports);
      } else {
        setAttendanceReports({
          summary: {
            attendancePercentage: 0,
            totalHours: 0,
            lateArrivals: 0,
            recordCount: 0
          },
          branchReports: [],
          records: []
        });
      }
      if (cache.hasLoaded.statsData) {
        setStatsData(cache.statsData);
        setStatsLoading(false);
      } else {
        setStatsData(null);
        setStatsLoading(true);
      }

      const refreshBranchData = async () => {
        loadSetupConfig();
        if (activeTab === 'analytics') {
          await Promise.all([
            fetchDashboardStats(true, newBranchId),
            fetchInventoryList(true, newBranchId),
            fetchCategories(true, newBranchId),
            fetchInventoryCategories(true, newBranchId),
            fetchExpensesList(true)
          ]);
        } else if (activeTab === 'orders') {
          await fetchOrders(true, newBranchId);
        } else if (activeTab === 'menu') {
          await Promise.all([
            fetchMenu(true, newBranchId),
            fetchCategories(true, newBranchId),
            fetchInventoryList(true, newBranchId)
          ]);
        } else if (activeTab === 'staff') {
          await fetchStaffList(true, newBranchId);
          if (staffSubTab === 'attendance') {
            await fetchAttendanceToday(true, newBranchId);
          } else if (staffSubTab === 'reports') {
            await fetchWorkReports(true, newBranchId);
          } else if (staffSubTab === 'salary') {
            await fetchSalaryHistory(newBranchId);
          }
        } else if (activeTab === 'inventory') {
          await Promise.all([
            fetchInventoryList(true, newBranchId),
            fetchInventoryCategories(true, newBranchId),
            fetchCashRegisterData()
          ]);
        } else if (activeTab === 'reports') {
          loadReportData(true);
        }
      };
      refreshBranchData();
    });
    return unsubscribe;
  }, [onBranchSwitch, activeTab, menuSubTab, staffSubTab, salaryRunTab, fetchExpensesList, fetchCashRegisterData]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchExpensesList(true);
    } else if (activeTab === 'inventory') {
      fetchCashRegisterData();
    }
  }, [activeTab, activeBranchId, fetchExpensesList, fetchCashRegisterData]);

  useEffect(() => {
    if (activeTab === 'staff' && staffSubTab === 'salary' && salaryRunTab === 'history') {
      fetchSalaryHistory();
    }
  }, [salaryHistoryPeriod, salaryRunTab, activeTab, staffSubTab, activeBranchId]);

  // Suppress unused variables warnings
  if (globalThis.__unused_vars_check__) {
    console.log(ordersLoading, ordersError, menuError, staffError, statsLoading, statsError, categoryError, invCategoryLoading, invCategoryError, handleToggleAvailability, handleRestockItem, getTopConsumedIngredients);
  }

 return (
<OwnerLayout>
<div className="owner-dashboard">
 
 {/* Style Overrides */}
<style>{`
 .dashboard-tab-bar {
 display: flex;
 gap: 8px;
 margin-bottom: 24px;
 border-bottom: 1px solid var(--color-border);
 padding-bottom: 12px;
 overflow-x: auto;
 }
 .dashboard-tab {
 background: transparent;
 border: none;
 color: var(--color-text-secondary);
 font-family: var(--font-family);
 font-size: 15px;
 font-weight: 700;
 padding: 8px 14px;
 cursor: pointer;
 transition: var(--transition-smooth);
 position: relative;
 white-space: nowrap;
 }
 .dashboard-tab:hover, .dashboard-tab.active {
 color: var(--color-primary);
 }
 .dashboard-tab.active::after {
 content: '';
 position: absolute;
 bottom: -13px;
 left: 0;
 width: 100%;
 height: 3px;
 background-color: var(--color-primary);
 }
 .dashboard-header-clean {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-bottom: 24px;
 background: rgba(43, 29, 21, 0.4);
 border: 1px solid rgba(230, 213, 195, 0.1);
 border-radius: 12px;
 padding: 16px 20px;
 }
 .dashboard-header-clean h2 {
 font-size: 1.35rem;
 font-weight: 800;
 color: var(--color-text-primary);
 margin: 0;
 }
 .dashboard-header-clean p {
 font-size: 0.8rem;
 color: #A0826C;
 margin: 2px 0 0 0;
 font-weight: 600;
 }
 .analytics-grid {
 display: grid;
 grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
 gap: 20px;
 margin-bottom: 30px;
 }
 .analytics-card {
 background: var(--bg-card);
 border: 1px solid var(--color-border);
 border-radius: 12px;
 padding: 20px;
 position: relative;
 box-shadow: 0 4px 15px rgba(0,0,0,0.15);
 }
 .analytics-card h4 {
 margin: 0;
 font-size: 13px;
 font-weight: 600;
 color: var(--color-text-secondary);
 text-transform: uppercase;
 letter-spacing: 0.5px;
 }
 .analytics-card .val {
 font-size: 24px;
 font-weight: 800;
 color: var(--color-text-primary);
 margin-top: 8px;
 display: block;
 }
 .analytics-card .sub {
 font-size: 11px;
 color: var(--color-success);
 margin-top: 5px;
 display: block;
 font-weight: bold;
 }
 .card-deck {
 display: grid;
 grid-template-columns: 1fr;
 gap: 20px;
 margin-bottom: 20px;
 }
 @media (min-width: 768px) {
 .card-deck {
 grid-template-columns: 2fr 1fr;
 gap: 30px;
 margin-bottom: 30px;
 }
 }
 .chart-card {
 background: var(--bg-card);
 border: 1px solid var(--color-border);
 border-radius: 16px;
 padding: 20px;
 }
 @media (min-width: 768px) {
 .chart-card {
 padding: 25px;
 }
 }
 /* ── Menu Grid: 2-col on mobile ── */
 .menu-grid-admin {
 display: grid;
 grid-template-columns: repeat(2, 1fr);
 gap: 10px;
 }
 @media (min-width: 768px) {
 .menu-grid-admin {
 grid-template-columns: repeat(3, 1fr);
 gap: 16px;
 }
 }
 @media (min-width: 1200px) {
 .menu-grid-admin {
 grid-template-columns: repeat(4, 1fr);
 gap: 18px;
 }
 }
 /* ── Menu Card: vertical card layout ── */
 .admin-menu-card {
 background: var(--bg-card);
 border: 1px solid var(--color-border);
 border-radius: 12px;
 overflow: hidden;
 display: flex;
 flex-direction: column;
 position: relative;
 transition: border-color 0.2s ease, transform 0.15s ease;
 }
 .admin-menu-card:hover {
 border-color: var(--color-primary);
 transform: translateY(-2px);
 box-shadow: 0 8px 24px rgba(0,0,0,0.3);
 }
 .admin-menu-card.unavailable {
 opacity: 0.55;
 }
 /* Image: full-width with fixed aspect ratio */
 .admin-menu-img {
 width: 100%;
 aspect-ratio: 4/3;
 object-fit: cover;
 flex-shrink: 0;
 border-radius: 0;
 }
 /* Info section: grows to fill */
 .admin-menu-info {
 flex-grow: 1;
 display: flex;
 flex-direction: column;
 padding: 10px;
 gap: 4px;
 }
 .admin-menu-title {
 font-size: 13px;
 font-weight: 700;
 color: var(--color-text-primary);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 }
 @media (min-width: 768px) {
 .admin-menu-title { font-size: 14px; }
 .admin-menu-info { padding: 14px; gap: 6px; }
 }
 .admin-menu-desc {
 font-size: 11px;
 color: var(--color-text-secondary);
 line-height: 1.35;
 display: -webkit-box;
 -webkit-line-clamp: 2;
 -webkit-box-orient: vertical;
 overflow: hidden;
 flex-grow: 1;
 }
 .admin-menu-meta {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-top: 8px;
 gap: 6px;
 }
 .admin-menu-price {
 font-size: 13px;
 font-weight: 800;
 color: var(--color-primary);
 flex-shrink: 0;
 }
 /* Action buttons: icon-only on smallest screens */
 .menu-card-actions {
 display: flex;
 gap: 4px;
 }
 .menu-card-btn {
 padding: 4px 6px;
 font-size: 11px;
 width: auto;
 border-radius: 6px;
 }
 .menu-card-btn .btn-text { display: none; }
 @media (min-width: 480px) {
 .menu-card-btn { padding: 4px 8px; }
 .menu-card-btn .btn-text { display: inline; }
 }
 /* ── Menu header actions ── */
 .menu-header-actions {
 display: flex;
 gap: 8px;
 flex-shrink: 0;
 }
 @media (max-width: 479px) {
 .menu-header-actions .btn-label { display: none; }
 .menu-header-actions button { padding: 8px 10px !important; }
 }
 /* ── Review summary grid ── */
 .reviews-summary-grid {
 display: grid;
 grid-template-columns: 1fr;
 gap: 12px;
 margin-bottom: 20px;
 }
 @media (min-width: 520px) {
 .reviews-summary-grid {
 grid-template-columns: 1fr 1fr;
 }
 }
 /* ── Owner double deck ── */
 .owner-double-deck {
 display: grid;
 grid-template-columns: 1fr;
 gap: 20px;
 }
 @media (min-width: 768px) {
 .owner-double-deck {
 grid-template-columns: 1fr 1fr;
 gap: 30px;
 }
 }
 .orders-monitor-wrapper {
 padding: 12px;
 }
 .orders-monitor-grid {
 display: grid;
 grid-template-columns: repeat(2, 1fr);
 gap: 10px;
 }
 @media (min-width: 600px) {
 .orders-monitor-wrapper {
 padding: 25px;
 }
 .orders-monitor-grid {
 grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
 gap: 16px;
 }
 }
 `}</style>

 {/* Navigation Tabs removed to prevent duplicate navigation */}
 {/* Branch switching is now handled by   {/* TAB 1: BUSINESS ANALYTICS */}
  {activeTab === 'analytics' &&
<div className="fade-in">
   {/* Header Action Bar with Monthly Excel Export */}
   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
     <div>
       <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Business Overview & Analytics</h3>
       <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Real-time revenue, gross profit, inventory sync, and operational performance.</p>
     </div>
     <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
       <button 
          onClick={handleExportMonthlyReportExcel} 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', width: 'auto', borderRadius: '10px', fontWeight: 700, fontSize: '12px' }}
          title="Download complete business report for the previous full calendar month"
        >
          <FileSpreadsheet size={15} /> Export {(() => {
            const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const pDate = new Date();
            pDate.setMonth(pDate.getMonth() - 1);
            return `${mNames[pDate.getMonth()]} ${pDate.getFullYear()}`;
          })()} Report (Excel)
        </button>
       <button 
         onClick={() => { setShowExpenseModal(true); fetchExpensesList(); }} 
         className="btn btn-secondary" 
         style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', width: 'auto', borderRadius: '10px', fontWeight: 700, fontSize: '12px', background: 'rgba(231, 76, 60, 0.12)', color: '#e74c3c', border: '1px solid rgba(231, 76, 60, 0.35)' }}
       >
         <Receipt size={15} /> Other Expenses {todayExpensesTotal > 0 && <span style={{ background: '#e74c3c', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', marginLeft: '2px' }}>-₹{todayExpensesTotal.toFixed(0)}</span>}
       </button>
     </div>
   </div>

   {/* Financial Performance Cards (Row 1) */}
    {/* Financial Performance Cards (Row 1) */}
    <div className="analytics-grid-4">
      {/* Today's Revenue */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Today's Revenue</h4>
          <div className="modern-metric-icon-wrapper">
            <IndianRupee size={15} color="#27ae60" />
          </div>
        </div>
        <p className="modern-metric-value" style={{ color: '#27ae60' }}>₹{todayRevenue.toFixed(2)}</p>
        <span className="modern-metric-pill modern-pill-success"><TrendingUp size={11} /> Today's sales</span>
      </div>

      {/* Today's Gross Profit */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Today's Gross Profit</h4>
          <div className="modern-metric-icon-wrapper" style={{ background: todayProfit >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(231, 76, 60, 0.12)' }}>
            <TrendingUp size={15} color={todayProfit >= 0 ? '#10b981' : '#e74c3c'} />
          </div>
        </div>
        <p className="modern-metric-value" style={{ color: todayProfit >= 0 ? '#10b981' : '#e74c3c' }}>
          ₹{todayProfit.toFixed(2)}
        </p>
        <span className={`modern-metric-pill ${todayProfit >= 0 ? 'modern-pill-success' : 'modern-pill-danger'}`}>
          {todayProfit >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {todayMargin}% Margin
        </span>
      </div>

      {/* Monthly Revenue */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Monthly Revenue</h4>
          <div className="modern-metric-icon-wrapper">
            <IndianRupee size={15} color="var(--color-primary)" />
          </div>
        </div>
        <p className="modern-metric-value">₹{monthlyRevenue.toFixed(2)}</p>
        <span className="modern-metric-pill modern-pill-success"><TrendingUp size={11} /> This Month</span>
      </div>

      {/* Monthly Gross Profit */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Monthly Gross Profit</h4>
          <div className="modern-metric-icon-wrapper" style={{ background: monthlyProfit >= 0 ? 'rgba(5, 150, 105, 0.12)' : 'rgba(231, 76, 60, 0.12)' }}>
            <TrendingUp size={15} color={monthlyProfit >= 0 ? '#059669' : '#e74c3c'} />
          </div>
        </div>
        <p className="modern-metric-value" style={{ color: monthlyProfit >= 0 ? '#059669' : '#e74c3c' }}>
          ₹{monthlyProfit.toFixed(2)}
        </p>
        <span className={`modern-metric-pill ${monthlyProfit >= 0 ? 'modern-pill-success' : 'modern-pill-danger'}`}>
          {monthlyProfit >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {monthlyMargin}% Margin
        </span>
      </div>
    </div>

    {/* Payment & Inventory Analytics Cards (Row 2) */}
    <div className="analytics-grid-row-2">
      {/* Cash & Online Paid — Combined Card */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Cash &amp; Online Paid</h4>
          <div className="modern-metric-icon-wrapper" style={{ background: 'rgba(39, 174, 96, 0.12)' }}>
            <Banknote size={15} color="#27ae60" />
          </div>
        </div>
        <p className="modern-metric-value" style={{ color: '#27ae60' }}>₹{(todayCashSales + todayOnlineSales).toFixed(2)}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
          <span className="modern-metric-pill modern-pill-success" style={{ justifyContent: 'flex-start' }}>
            💵 Cash: ₹{todayCashSales.toFixed(2)} today · ₹{monthlyCashSales.toFixed(2)} month
          </span>
          <span className="modern-metric-pill" style={{ background: 'rgba(52, 152, 219, 0.12)', color: '#2980b9', justifyContent: 'flex-start' }}>
            📱 Online: ₹{todayOnlineSales.toFixed(2)} today · ₹{monthlyOnlineSales.toFixed(2)} month
          </span>
        </div>
      </div>

      {/* Inventory Value */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Inventory Value</h4>
          <div className="modern-metric-icon-wrapper">
            <Package size={15} color="#e67e22" />
          </div>
        </div>
        <p className="modern-metric-value" style={{ color: '#e67e22' }}>₹{totalInventoryValue.toFixed(2)}</p>
        <span className="modern-metric-pill modern-pill-warning">Current Real-Time Value</span>
      </div>

      {/* Inventory Consumed This Month */}
      <div className="modern-metric-card">
        <div className="modern-metric-header">
          <h4 className="modern-metric-title">Inventory Consumed</h4>
          <div className="modern-metric-icon-wrapper" style={{ background: 'rgba(155, 89, 182, 0.12)' }}>
            <IndianRupee size={15} color="#9b59b6" />
          </div>
        </div>
        <p className="modern-metric-value" style={{ color: '#9b59b6' }}>₹{totalInventoryConsumption.toFixed(2)}</p>
        <span className="modern-metric-pill modern-pill-neutral">
          Kitchen usage this month
        </span>
      </div>
    </div>

 {/* Best / Worst Selling items */}
<div className="owner-double-deck" style={{ marginTop: '24px' }}>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <TrendingUp size={20} color="#2ecc71" />
    <h4 style={{ color: '#2ecc71', margin: 0, fontSize: '1.1rem' }}>Top Selling Items</h4>
  </div>
  <span className="modern-metric-pill modern-pill-neutral" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>Today</span>
</div>
<div className="ranked-list-container">
  {topSelling.length > 0 ? (
    topSelling.map((item, index) => (
      <div key={item.name} className="ranked-list-item">
        <div className="ranked-list-left">
          <div className={`ranked-badge ranked-badge-${Math.min(index + 1, 3)}`}>{index + 1}</div>
          <span className="ranked-item-name">{item.name}</span>
        </div>
        <span className="ranked-item-metric">{item.quantity} sold (₹{item.revenue.toFixed(2)})</span>
      </div>
    ))
  ) : (
    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', padding: '10px 0', textAlign: 'center' }}>No sales recorded yet today</div>
  )}
</div>
</div>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <TrendingDown size={20} color="#e74c3c" />
    <h4 style={{ color: '#e74c3c', margin: 0, fontSize: '1.1rem' }}>Slow Selling Items</h4>
  </div>
  <span className="modern-metric-pill modern-pill-neutral" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>Today</span>
</div>
<div className="ranked-list-container">
  {slowSelling.length > 0 ? (
    slowSelling.map((item, index) => (
      <div key={item.name} className="ranked-list-item">
        <div className="ranked-list-left">
          <div className={`ranked-badge ${index === 0 ? 'ranked-badge-3' : 'ranked-badge-default'}`}>{index + 1}</div>
          <span className="ranked-item-name">{item.name}</span>
        </div>
        <span className="ranked-item-metric">{item.quantity} sold (₹{item.revenue.toFixed(2)})</span>
      </div>
    ))
  ) : (
    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', padding: '10px 0', textAlign: 'center' }}>All dishes are selling actively today!</div>
  )}
</div>
</div>
</div>
</div>
  }

 {/* TAB 2: MENU MANAGEMENT */}
 {activeTab === 'menu' &&
<div style={{ animation: 'fadeIn 0.3s ease-out' }}>
 {/* Sub-tab Switcher for Menu & Reviews */}
<div style={{
 display: 'flex',
 gap: '8px',
 background: 'rgba(0, 0, 0, 0.02)',
 padding: '6px',
 borderRadius: '12px',
 border: '1px solid var(--color-border)',
 marginBottom: '24px',
 maxWidth: '100%',
 overflowX: 'auto',
 whiteSpace: 'nowrap'
 }} className="no-scrollbar">
<button
 onClick={() =>setMenuSubTab('dishes')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: menuSubTab === 'dishes' ? 'var(--color-primary)' : 'transparent',
 color: menuSubTab === 'dishes' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Menu Items
</button>
<button
 onClick={() =>setMenuSubTab('reviews')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: menuSubTab === 'reviews' ? 'var(--color-primary)' : 'transparent',
 color: menuSubTab === 'reviews' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Customer Reviews
</button>
</div>

 {menuSubTab === 'dishes' ?
<>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
<div style={{ minWidth: 0 }}>
<h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>Cafe Dishes</h3>
<p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>Manage your customer ordering menu</p>
</div>
<div className="menu-header-actions">
<button onClick={() =>{setShowCategoryModal(true);fetchCategories(true);}} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 14px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: '13px' }}>
📂 <span className="btn-label">Categories</span>
</button>
<button onClick={() =>setShowAddModal(true)} className="btn btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '13px' }}>
➕ <span className="btn-label">Add Item</span>
</button>
</div>
</div>

<div style={{ marginBottom: '20px' }}>
  <div style={{ position: 'relative', marginBottom: '12px' }}>
    <input
      type="text"
      placeholder="🔍 Search dishes by name or category..."
      value={menuSearch}
      onChange={(e) => setMenuSearch(e.target.value)}
      style={{
        width: '100%',
        padding: '12px 16px',
        paddingRight: menuSearch ? '40px' : '16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        background: 'var(--bg-secondary)',
        color: 'var(--color-text-primary)',
        fontSize: '14px',
        outline: 'none'
      }} 
    />
    {menuSearch && (
      <button
        onClick={() => setMenuSearch('')}
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '4px 8px'
        }}
        title="Clear search"
      >
        ✕
      </button>
    )}
  </div>

  {/* Category Filter Pills */}
  <div
    className="no-scrollbar"
    style={{
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      paddingBottom: '6px',
      WebkitOverflowScrolling: 'touch',
      alignItems: 'center'
    }}
  >
    <button
      onClick={() => setSelectedMenuCategory('all')}
      style={{
        padding: '7px 14px',
        borderRadius: '20px',
        border: selectedMenuCategory === 'all' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
        background: selectedMenuCategory === 'all' ? 'var(--color-primary)' : 'var(--bg-secondary)',
        color: selectedMenuCategory === 'all' ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '12.5px',
        fontWeight: selectedMenuCategory === 'all' ? 700 : 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit'
      }}
    >
      <span>All Dishes</span>
      <span
        style={{
          fontSize: '11px',
          padding: '1px 7px',
          borderRadius: '10px',
          background: selectedMenuCategory === 'all' ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
          color: selectedMenuCategory === 'all' ? '#fff' : 'var(--color-text-muted)'
        }}
      >
        {menuCategoriesWithCounts.allCount}
      </span>
    </button>

    {menuCategoriesWithCounts.list.map((cat) => {
      const isSelected = selectedMenuCategory.toLowerCase().trim() === cat.name.toLowerCase().trim();
      return (
        <button
          key={cat.name}
          onClick={() => setSelectedMenuCategory(prev => prev.toLowerCase().trim() === cat.name.toLowerCase().trim() ? 'all' : cat.name)}
          style={{
            padding: '7px 14px',
            borderRadius: '20px',
            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
            background: isSelected ? 'var(--color-primary)' : 'var(--bg-secondary)',
            color: isSelected ? '#fff' : 'var(--color-text-secondary)',
            fontSize: '12.5px',
            fontWeight: isSelected ? 700 : 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit'
          }}
        >
          <span>{cat.name}</span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 7px',
              borderRadius: '10px',
              background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
              color: isSelected ? '#fff' : 'var(--color-text-muted)'
            }}
          >
            {cat.count}
          </span>
        </button>
      );
    })}
  </div>
</div>

{menuLoading ? (
  <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
    <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading menu items...</p>
  </div>
) : filteredMenuItems.length === 0 ? (
  <div style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--color-border)', marginTop: '10px' }}>
    <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🍽️</div>
    <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '15px' }}>
      No dishes found
    </div>
    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '4px' }}>
      {selectedMenuCategory !== 'all'
        ? `No dishes in "${selectedMenuCategory}" match your current filters.`
        : 'No dishes match your search query.'}
    </p>
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
      {(selectedMenuCategory !== 'all' || menuSearch) && (
        <button
          onClick={() => {
            setSelectedMenuCategory('all');
            setMenuSearch('');
          }}
          className="btn btn-secondary"
          style={{ width: 'auto', fontSize: '12px', padding: '6px 14px' }}
        >
          Clear Filters
        </button>
      )}
      <button
        onClick={() => {
          if (selectedMenuCategory !== 'all') {
            setNewItem((prev) => ({ ...prev, category: selectedMenuCategory }));
          }
          setShowAddModal(true);
        }}
        className="btn btn-primary"
        style={{ width: 'auto', fontSize: '12px', padding: '6px 14px' }}
      >
        ➕ Add Item {selectedMenuCategory !== 'all' ? `to ${selectedMenuCategory}` : ''}
      </button>
    </div>
  </div>
) : (
  <div className="menu-grid-admin">
    {filteredMenuItems.map((item) => (
      <AdminMenuCard
        key={item._id || item.id}
        item={item}
        onEdit={handleEditMenuCallback}
        onDelete={handleDeleteMenuCallback}
        onToggle={handleToggleMenuCallback}
      />
    ))}
  </div>
)}
</>:

<div className="fade-in">
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '16px' }}>
 
 {/* Ratings Summary Cards */}
<div className="reviews-summary-grid">
 {/* Summary Box */}
<div style={{
 background: 'rgba(0, 0, 0, 0.02)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '16px',
 display: 'flex',
 alignItems: 'center',
 gap: '16px'
 }}>
<div style={{ textAlign: 'center', flexShrink: 0 }}>
<div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{reviewsSummary.averageRating}</div>
<div style={{ marginTop: '6px', fontSize: '1rem', color: '#ff9800', letterSpacing: '1px' }}>
 {''.repeat(Math.round(reviewsSummary.averageRating))}{''.repeat(5 - Math.round(reviewsSummary.averageRating))}
</div>
</div>
<div>
<div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>Avg Rating</div>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>Based on {reviewsSummary.totalReviews} ratings</div>
</div>
</div>

 {/* Distribution Box */}
<div style={{
 background: 'rgba(0, 0, 0, 0.02)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '16px',
 display: 'flex',
 flexDirection: 'column',
 gap: '6px'
 }}>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Rating Breakdown</div>
 {[5, 4, 3, 2, 1].map((stars) =>{
 const count = reviewsSummary.distribution?.[stars] || 0;
 const pct = reviewsSummary.totalReviews >0 ? count / reviewsSummary.totalReviews * 100 : 0;
 return (
<div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
<span style={{ width: '12px', color: '#ff9800', fontWeight: 'bold' }}>{stars}</span>
<span style={{ color: '#ff9800', fontSize: '10px' }}></span>
<div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(0, 0, 0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
<div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#ff9800', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
</div>
<span style={{ width: '24px', color: 'var(--color-text-secondary)', textAlign: 'right', fontSize: '11px' }}>{count}</span>
</div>);

 })}
</div>
</div>

 {/* Filter Panel */}
<div style={{
 display: 'flex',
 flexWrap: 'wrap',
 justifyContent: 'space-between',
 alignItems: 'center',
 gap: '10px',
 marginBottom: '16px',
 background: 'rgba(0, 0, 0, 0.02)',
 padding: '10px 14px',
 borderRadius: '10px',
 border: '1px solid var(--color-border)'
 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>Filter:</label>
<select
 value={reviewsFilterRating}
 onChange={(e) =>setReviewsFilterRating(e.target.value)}
 style={{
 backgroundColor: 'rgba(0,0,0,0.3)',
 border: '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '6px 10px',
 color: 'var(--color-text-primary)',
 fontSize: '12px',
 outline: 'none',
 fontFamily: 'inherit'
 }}>
 
<option value="">All Ratings</option>
<option value="5">5 Stars</option>
<option value="4">4 Stars</option>
<option value="3">3 Stars</option>
<option value="2">2 Stars</option>
<option value="1">1 Star</option>
</select>
</div>
<button
 onClick={fetchReviewsData}
 className="btn btn-secondary"
 style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>
 
 Refresh
</button>
</div>

 {reviewsLoading ?
<div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
<div className="spinner-rzp" style={{
 width: '28px',
 height: '28px',
 border: '3px solid rgba(0, 0, 0,0.1)',
 borderTop: '3px solid var(--color-primary)',
 borderRadius: '50%',
 animation: 'spin 0.8s linear infinite',
 display: 'inline-block',
 marginBottom: '10px'
 }}></div>
<div>Retrieving live customer feedback...</div>
</div>:
 reviewsError ?
<div style={{ padding: '20px', background: 'rgba(231, 76, 60, 0.1)', borderLeft: '4px solid #E74C3C', borderRadius: '4px', color: '#E74C3C' }}>
 {reviewsError}
</div>:
 reviews.length === 0 ?
<div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0, 0, 0,0.01)', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
 No reviews found matching the selected filters.
</div>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
  {reviews.map((r) => (
    <div key={r._id} style={{
      background: 'rgba(0, 0, 0,0.02)',
      border: '1px solid var(--color-border)',
      padding: '14px',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      transition: 'border-color 0.2s'
    }}>
      {/* Review Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{
            width: '34px', height: '34px', flexShrink: 0,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8FA89B 0%, #4d6b5e 100%)',
            color: 'var(--color-text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '14px'
          }}>
            {(r.customerName || 'A')[0].toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
            <div style={{ color: '#ff9800', fontSize: '12px', letterSpacing: '1px', marginTop: '1px' }}>
              {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
            </div>
          </div>
        </div>
        {r.createdAt && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
      
      {/* Review Text */}
      {r.reviewText ? (
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '1.5', borderLeft: '2px solid var(--color-primary)', paddingLeft: '10px' }}>
          {r.reviewText}
        </p>
      ) : (
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '12px', fontStyle: 'italic' }}>No comment provided.</p>
      )}

      {/* Ordered Items */}
      {r.orderedItems && r.orderedItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
          {r.orderedItems.map((item, idx) => (
            <span key={idx} style={{
              background: 'rgba(143, 168, 155, 0.1)',
              border: '1px solid rgba(143, 168, 155, 0.2)',
              color: 'var(--color-primary)',
              padding: '2px 7px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600
            }}>
              {item.quantity}x {item.name}
            </span>
          ))}
        </div>
      )}
    </div>
  ))}
</div>
}
</div>
</div>
}
</div>
}

{/* TAB 3: STAFF DIRECTORY & PAYROLL */}
{activeTab === 'staff' && (
  <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {/* ── Sub-tab Switcher for Staff Management ── */}
    <div style={{
      display: 'flex',
      gap: '8px',
      background: 'rgba(0, 0, 0, 0.02)',
      padding: '6px',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      marginBottom: '4px',
      maxWidth: '100%',
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }} className="no-scrollbar">
      <button
        type="button"
        onClick={() => setStaffSubTab('roster')}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: 'none',
          background: (staffSubTab === 'roster' || staffSubTab === 'all') ? 'var(--color-primary)' : 'transparent',
          color: (staffSubTab === 'roster' || staffSubTab === 'all') ? '#fff' : 'var(--color-text-secondary)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s ease'
        }}
      >
        <span>👥</span> Staff Directory & Payroll
      </button>
      <button
        type="button"
        onClick={() => {
          setStaffSubTab('photos');
          fetchWorkReports(false, activeBranchId);
        }}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: 'none',
          background: (staffSubTab === 'photos' || staffSubTab === 'reports') ? 'var(--color-primary)' : 'transparent',
          color: (staffSubTab === 'photos' || staffSubTab === 'reports') ? '#fff' : 'var(--color-text-secondary)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s ease'
        }}
      >
        <span>📸</span> Daily Cafe & Work Photos
        {todayWorkReportsCount > 0 && (
          <span style={{
            fontSize: '11px',
            padding: '1px 7px',
            borderRadius: '10px',
            background: (staffSubTab === 'photos' || staffSubTab === 'reports') ? 'rgba(255,255,255,0.3)' : 'rgba(212,127,70,0.18)',
            color: (staffSubTab === 'photos' || staffSubTab === 'reports') ? '#fff' : 'var(--color-primary)',
            fontWeight: 800
          }}>
            {todayWorkReportsCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setStaffSubTab('attendance');
          fetchAttendanceReportsData(false, activeBranchId);
        }}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: 'none',
          background: staffSubTab === 'attendance' ? 'var(--color-primary)' : 'transparent',
          color: staffSubTab === 'attendance' ? '#fff' : 'var(--color-text-secondary)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s ease'
        }}
      >
        <span>🕒</span> Shift & Attendance Logs
      </button>
    </div>

    {/* ── SUB-TAB 1: STAFF DIRECTORY & PAYROLL ── */}
    {(staffSubTab === 'roster' || staffSubTab === 'all') && (
      <>
    {/* ── Top Header & KPI Overview Strip ── */}
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '14px',
      padding: '12px 14px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Title + Global Action Buttons in one responsive flex row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        <div>
          <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>👥</span> Staff Directory & Payroll
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: '2px 0 0 0', fontSize: '0.78rem' }}>
            Live shift punch records, attendance summary, and salary ledger
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '150px', flexGrow: 1 }}>
            <input
              type="text"
              placeholder="🔍 Search name or ID..."
              value={salarySearchQuery}
              onChange={(e) => setSalarySearchQuery(e.target.value)}
              className="form-input"
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportStaffToCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(46, 204, 113, 0.15)',
              color: '#27ae60',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📥</span> Export CSV
          </button>

          {/* Add Staff Button */}
          <button
            type="button"
            onClick={() => setShowAddStaffModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(255, 107, 8, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> Add Staff
          </button>
        </div>
      </div>

      {/* 4 Ultra-Compact Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
        gap: '6px'
      }}>
        {/* Total Staff */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '9.5px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            👥 Total Staff
          </span>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-text-primary)', marginTop: '1px', lineHeight: 1.2 }}>
            {staff.length}
          </div>
        </div>

        {/* Present Today */}
        <div style={{ background: 'rgba(46, 204, 113, 0.08)', border: '1px solid rgba(46, 204, 113, 0.25)', borderRadius: '8px', padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#27ae60', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            🟢 Present Today
          </span>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#2ecc71', marginTop: '1px', lineHeight: 1.2 }}>
            {attendanceSummary?.present || staff.filter(s => (s.attendances && s.attendances.some(a => a.date === new Date().toISOString().split('T')[0]))).length || 0}
          </div>
        </div>

        {/* Late Arrivals */}
        <div style={{ background: 'rgba(243, 156, 18, 0.08)', border: '1px solid rgba(243, 156, 18, 0.25)', borderRadius: '8px', padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#d35400', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ⚠️ Late Arrivals
          </span>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f39c12', marginTop: '1px', lineHeight: 1.2 }}>
            {attendanceSummary?.late || 0}
          </div>
        </div>

        {/* Unpaid Balance */}
        <div style={{ background: 'rgba(230, 126, 34, 0.08)', border: '1.5px solid #e67e22', borderRadius: '8px', padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#e67e22', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            💰 Total Unpaid
          </span>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#e67e22', marginTop: '1px', lineHeight: 1.2 }}>
            ₹{staff.reduce((sum, s) => {
              const bal = s.remainingSalaryBalance !== undefined ? s.remainingSalaryBalance : Math.max(0, (s.totalEarnedAllTime || s.currentMonthSalary || 0) - (s.totalPaidAllTime || 0));
              return sum + (Number(bal) || 0);
            }, 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>

    {/* ── Main Staff Roster & Payroll Card ── */}
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
      
      {staffLoading && staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading staff roster...</p>
        </div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
          <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>No Staff Registered Yet</h4>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>Click "+ Add Staff" above to register team members.</p>
        </div>
      ) : (
        <>
          {/* 1. Desktop & Tablet Master Table */}
          <div className="desktop-tablet-staff custom-scrollbar" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  <th style={{ padding: '10px 8px' }}>Employee & ID</th>
                  <th style={{ padding: '10px 8px' }}>Shift Timing</th>
                  <th style={{ padding: '10px 8px' }}>Today's Activity</th>
                  <th style={{ padding: '10px 8px' }}>Wage Rate & Days</th>
                  <th style={{ padding: '10px 8px' }}>Earned vs Unpaid Balance</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter(s => {
                    const matchesSearch = !salarySearchQuery || s.name.toLowerCase().includes(salarySearchQuery.toLowerCase()) || (s.username || '').toLowerCase().includes(salarySearchQuery.toLowerCase()) || (s.employeeId || '').toLowerCase().includes(salarySearchQuery.toLowerCase());
                    return matchesSearch;
                  })
                  .map(member => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const todayPunch = member.attendances?.find(a => a.date === todayStr) || 
                      (attendanceRecords || []).find(r => String(r.user?._id || r.user || r.userId) === String(member._id) || String(r.staffId) === String(member._id));

                    const remBalance = member.remainingSalaryBalance !== undefined 
                      ? member.remainingSalaryBalance 
                      : Math.max(0, (member.totalEarnedAllTime || member.currentMonthSalary || 0) - (member.totalPaidAllTime || 0));

                    const grossEarned = member.totalEarnedAllTime ?? member.currentMonthSalary ?? ((member.workingDays || 0) * (member.dailyRate || 0));

                    const checkInStr = todayPunch?.checkInTime ? new Date(todayPunch.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                    const checkOutStr = todayPunch?.checkOutTime ? new Date(todayPunch.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                    const isCompleted = Boolean(todayPunch?.checkOutTime);

                    return (
                      <tr key={member._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        
                        {/* 1. Employee & ID */}
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '9px',
                                background: 'linear-gradient(135deg, var(--color-primary), #d47f46)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.95rem',
                                fontWeight: 800,
                                flexShrink: 0
                              }}
                            >
                              {member.name?.charAt(0)?.toUpperCase() || 'S'}
                            </div>
                            <div>
                              <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '13px' }}>
                                {member.name}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#D47F46', background: 'rgba(212, 127, 70, 0.12)', padding: '1px 5px', borderRadius: '4px' }}>
                                  @{member.username || member.name.toLowerCase().replace(/\s+/g, '')}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                  {member.employeeId || 'STAFF'}
                                </span>
                                {member.attendancePin ? (
                                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#8e44ad', background: 'rgba(142, 68, 173, 0.12)', padding: '1px 5px', borderRadius: '4px' }}>
                                    PIN: {member.attendancePin}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '9.5px', color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: '4px' }}>
                                    PIN: Not set
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Shift Timing */}
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '12px' }}>
                            ⏰ {member.shiftStartTime || '09:00'} - {member.shiftEndTime || '18:00'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Grace: {member.leanTimeMinutes !== undefined ? member.leanTimeMinutes : 30}m
                          </div>
                        </td>

                        {/* 3. Today's Activity */}
                        <td style={{ padding: '10px 8px' }}>
                          {todayPunch ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {isCompleted ? (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: '#27ae60',
                                  background: 'rgba(46, 204, 113, 0.12)',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  width: 'fit-content'
                                }}>
                                  🏁 Out: {checkOutStr} (In: {checkInStr} • {todayPunch.workingHours || 0}h)
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: todayPunch.status === 'Late' ? '#f39c12' : '#2ecc71',
                                  background: todayPunch.status === 'Late' ? 'rgba(243, 156, 18, 0.12)' : 'rgba(46, 204, 113, 0.12)',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  width: 'fit-content'
                                }}>
                                  {todayPunch.status === 'Late' ? '⚠️ Late In: ' : '🟢 In: '} {checkInStr}
                                </span>
                              )}
                              <span style={{ fontSize: '9.5px', color: 'var(--color-text-secondary)' }}>
                                {todayPunch.status === 'Late' ? 'Late Check-in' : 'On Time ✅'}
                              </span>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: 'var(--color-text-secondary)',
                              background: 'rgba(0, 0, 0, 0.05)',
                              padding: '2px 6px',
                              borderRadius: '5px',
                              display: 'inline-block'
                            }}>
                              ⚪ Absent Today
                            </span>
                          )}
                        </td>

                        {/* 4. Wage Rate & Days */}
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '12.5px' }}>
                            ₹{member.dailyRate || 0} <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>/day</span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#27ae60', fontWeight: 700, marginTop: '1px' }}>
                            📅 {member.workingDays || 0} days worked
                          </div>
                        </td>

                        {/* 5. Earned vs Unpaid Balance */}
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              Gross: <strong style={{ color: '#2ecc71' }}>₹{grossEarned}</strong>
                            </div>
                            <div>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: remBalance > 0 ? '#e67e22' : '#2ecc71',
                                background: remBalance > 0 ? 'rgba(230, 126, 34, 0.12)' : 'rgba(46, 204, 113, 0.12)',
                                padding: '1px 6px',
                                borderRadius: '5px',
                                border: `1px solid ${remBalance > 0 ? '#e67e22' : '#2ecc71'}`
                              }}>
                                ₹{remBalance} Unpaid
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 6. Quick Actions */}
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openDisburseModal(member)}
                              style={{
                                background: '#27ae60',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '5px 9px',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                boxShadow: '0 2px 8px rgba(39, 174, 96, 0.25)'
                              }}
                            >
                              💸 Pay Salary
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedSalaryStaff(member); setShowSalaryDetailModal(true); }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 7px', fontSize: '11px', fontWeight: 600 }}
                              title="View History & Punch Logs"
                            >
                              📋 Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaff({ ...member, staffRole: member.staffRole || member.role || 'staff' });
                                setShowEditStaffModal(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', fontSize: '11px' }}
                              title="Edit Staff"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalStaff(member);
                                setNewStaffPasswordInput('');
                                setShowStaffPassToggle(false);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', fontSize: '11px', color: '#D47F46', borderColor: '#D47F46' }}
                              title="Reset Password"
                            >
                              🔑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStaff(member._id, member.name)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', fontSize: '11px', color: '#e74c3c' }}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* 2. Mobile Responsive Card View (Ultra Compact) */}
          <div className="mobile-only-staff">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {staff
                .filter(s => {
                  const matchesSearch = !salarySearchQuery || s.name.toLowerCase().includes(salarySearchQuery.toLowerCase()) || (s.username || '').toLowerCase().includes(salarySearchQuery.toLowerCase()) || (s.employeeId || '').toLowerCase().includes(salarySearchQuery.toLowerCase());
                  return matchesSearch;
                })
                .map(member => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const todayPunch = member.attendances?.find(a => a.date === todayStr) || 
                    (attendanceRecords || []).find(r => String(r.user?._id || r.user || r.userId) === String(member._id) || String(r.staffId) === String(member._id));

                  const remBalance = member.remainingSalaryBalance !== undefined 
                    ? member.remainingSalaryBalance 
                    : Math.max(0, (member.totalEarnedAllTime || member.currentMonthSalary || 0) - (member.totalPaidAllTime || 0));

                  const grossEarned = member.totalEarnedAllTime ?? member.currentMonthSalary ?? ((member.workingDays || 0) * (member.dailyRate || 0));

                  const checkInStr = todayPunch?.checkInTime ? new Date(todayPunch.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                  const checkOutStr = todayPunch?.checkOutTime ? new Date(todayPunch.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                  const isCompleted = Boolean(todayPunch?.checkOutTime);

                  return (
                    <div
                      key={member._id}
                      style={{
                        background: 'var(--bg-primary)',
                        border: remBalance > 0 ? '1.5px solid #e67e22' : '1px solid var(--color-border)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Top Header: Avatar + Name + ID + Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, var(--color-primary), #d47f46)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              flexShrink: 0
                            }}
                          >
                            {member.name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 800 }}>
                              {member.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#D47F46', background: 'rgba(212, 127, 70, 0.12)', padding: '0px 4px', borderRadius: '4px' }}>
                                @{member.username || member.name.toLowerCase().replace(/\s+/g, '')}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                                {member.employeeId || 'STAFF'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        {todayPunch ? (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: isCompleted ? '#27ae60' : (todayPunch.status === 'Late' ? '#f39c12' : '#2ecc71'),
                            background: isCompleted ? 'rgba(46, 204, 113, 0.15)' : (todayPunch.status === 'Late' ? 'rgba(243, 156, 18, 0.15)' : 'rgba(46, 204, 113, 0.15)'),
                            padding: '2px 6px',
                            borderRadius: '5px',
                            border: `1px solid ${isCompleted ? '#27ae60' : (todayPunch.status === 'Late' ? '#f39c12' : '#2ecc71')}`
                          }}>
                            {isCompleted ? `🏁 Out: ${checkOutStr}` : `🟢 In: ${checkInStr}`}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--color-text-secondary)',
                            background: 'rgba(0,0,0,0.06)',
                            padding: '2px 6px',
                            borderRadius: '5px'
                          }}>
                            ⚪ Absent
                          </span>
                        )}
                      </div>

                      {/* Shift & Rate Info */}
                      <div style={{ background: 'rgba(0,0,0,0.03)', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          ⏰ <strong style={{ color: 'var(--color-text-primary)' }}>{member.shiftStartTime || '09:00'} - {member.shiftEndTime || '18:00'}</strong>
                        </span>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                          ₹{member.dailyRate || 0}/day • {member.workingDays || 0}d
                        </span>
                      </div>

                      {/* Financial Strip: Earned & Remaining Unpaid */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.03)', padding: '5px 8px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)' }}>
                          Gross: <strong style={{ color: '#2ecc71' }}>₹{grossEarned}</strong>
                        </span>
                        <span style={{ fontSize: '11px', color: remBalance > 0 ? '#e67e22' : '#2ecc71', fontWeight: 900 }}>
                          ₹{remBalance} Unpaid
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openDisburseModal(member)}
                          className="btn btn-primary"
                          style={{
                            flex: 1.5,
                            padding: '6px 8px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            background: '#27ae60',
                            borderColor: '#27ae60',
                            color: '#fff',
                            borderRadius: '6px'
                          }}
                        >
                          💸 Pay Salary
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedSalaryStaff(member); setShowSalaryDetailModal(true); }}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '6px' }}
                        >
                          📋 History
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaff({ ...member, staffRole: member.staffRole || member.role || 'staff' });
                            setShowEditStaffModal(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px' }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetModalStaff(member);
                            setNewStaffPasswordInput('');
                            setShowStaffPassToggle(false);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', color: '#D47F46' }}
                          title="Reset Password"
                        >
                          🔑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(member._id, member.name)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', color: '#e74c3c' }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  </>
)}



      {/* ── Add Staff Modal ── */}
      {showAddStaffModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddStaffModal(false); setNewStaff({ name: '', email: '', phone: '', staffRole: 'staff', assignedBranch: '', dailyRate: 0, shiftStartTime: '09:00', shiftEndTime: '18:00', leanTimeMinutes: 30, workDaysPerWeek: 6 }); } }}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '18px', padding: '24px 20px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Add New Staff</h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: '3px 0 0 0', fontSize: '0.8rem' }}>Register a new team member</p>
              </div>
              <button
                onClick={() => { setShowAddStaffModal(false); setNewStaff({ name: '', email: '', phone: '', staffRole: 'staff', assignedBranch: '', dailyRate: 0, shiftStartTime: '09:00', shiftEndTime: '18:00', leanTimeMinutes: 30, workDaysPerWeek: 6 }); }}
                style={{ background: 'rgba(0, 0, 0, 0.06)', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--color-text-primary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Full Name *</label>
                  <input type="text" className="form-input" placeholder="e.g. Arjun Kumar" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Username *</label>
                  <input type="text" className="form-input" placeholder="e.g. arjun" value={newStaff.username || ''} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Password *</label>
                  <input type="text" className="form-input" placeholder="e.g. Cafe@123" value={newStaff.password || ''} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Phone Number *</label>
                  <input type="text" className="form-input" placeholder="e.g. 9876543210" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Daily Wage (₹) *</label>
                  <input type="number" min="0" className="form-input" placeholder="e.g. 600" value={newStaff.dailyRate || ''} onChange={(e) => setNewStaff({ ...newStaff, dailyRate: Number(e.target.value) })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Grace Time (Mins) *</label>
                  <input type="number" min="0" max="180" className="form-input" placeholder="30" value={newStaff.leanTimeMinutes !== undefined ? newStaff.leanTimeMinutes : 30} onChange={(e) => setNewStaff({ ...newStaff, leanTimeMinutes: Number(e.target.value) })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Shift Start *</label>
                  <input type="time" className="form-input" value={newStaff.shiftStartTime || '09:00'} onChange={(e) => setNewStaff({ ...newStaff, shiftStartTime: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Shift End *</label>
                  <input type="time" className="form-input" value={newStaff.shiftEndTime || '18:00'} onChange={(e) => setNewStaff({ ...newStaff, shiftEndTime: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>4-Digit Attendance PIN *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  className="form-input"
                  placeholder="e.g. 1234"
                  value={newStaff.attendancePin || ''}
                  onChange={(e) => setNewStaff({ ...newStaff, attendancePin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  required
                />
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Security PIN entered by staff member at kiosk terminal to mark attendance</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddStaffModal(false); setNewStaff({ name: '', email: '', phone: '', staffRole: 'staff', assignedBranch: '', dailyRate: 0, shiftStartTime: '09:00', shiftEndTime: '18:00', leanTimeMinutes: 30, workDaysPerWeek: 6 }); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 800 }}
                  disabled={staffLoading}
                >
                  {staffLoading ? 'Adding...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Staff Modal ── */}
      {showEditStaffModal && editingStaff && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowEditStaffModal(false); setEditingStaff(null); } }}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '18px', padding: '24px 20px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Edit Staff Details</h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: '3px 0 0 0', fontSize: '0.8rem' }}>{editingStaff.name}</p>
              </div>
              <button
                onClick={() => { setShowEditStaffModal(false); setEditingStaff(null); }}
                style={{ background: 'rgba(0, 0, 0, 0.06)', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--color-text-primary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Full Name *</label>
                  <input type="text" className="form-input" value={editingStaff.name} onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Phone Number *</label>
                  <input type="text" className="form-input" value={editingStaff.phone} onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Daily Wage (₹) *</label>
                  <input type="number" min="0" className="form-input" value={editingStaff.dailyRate || ''} onChange={(e) => setEditingStaff({ ...editingStaff, dailyRate: Number(e.target.value) })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Grace Time (Mins) *</label>
                  <input type="number" min="0" max="180" className="form-input" value={editingStaff.leanTimeMinutes !== undefined ? editingStaff.leanTimeMinutes : 30} onChange={(e) => setEditingStaff({ ...editingStaff, leanTimeMinutes: Number(e.target.value) })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Shift Start *</label>
                  <input type="time" className="form-input" value={editingStaff.shiftStartTime || '09:00'} onChange={(e) => setEditingStaff({ ...editingStaff, shiftStartTime: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>Shift End *</label>
                  <input type="time" className="form-input" value={editingStaff.shiftEndTime || '18:00'} onChange={(e) => setEditingStaff({ ...editingStaff, shiftEndTime: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>4-Digit Attendance PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  className="form-input"
                  placeholder="e.g. 1234"
                  value={editingStaff.attendancePin || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, attendancePin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                />
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Used for kiosk attendance check-in / check-out</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditStaffModal(false); setEditingStaff(null); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 800 }}
                  disabled={staffLoading}
                >
                  {staffLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Direct Password Reset Modal ── */}
      {resetModalStaff && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setResetModalStaff(null); setNewStaffPasswordInput(''); } }}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Reset Staff Password</h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.82rem' }}>Staff: <strong>{resetModalStaff.name}</strong> (@{resetModalStaff.username || 'staff'})</p>
              </div>
              <button
                onClick={() => { setResetModalStaff(null); setNewStaffPasswordInput(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '22px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleDirectPasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>New Password (Min 6 chars) *</label>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <input
                    type={showStaffPassToggle ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter new password"
                    value={newStaffPasswordInput}
                    onChange={(e) => setNewStaffPasswordInput(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: '45px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassToggle(!showStaffPassToggle)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                  >
                    {showStaffPassToggle ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setResetModalStaff(null); setNewStaffPasswordInput(''); }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={resetStaffLoading || !newStaffPasswordInput.trim()}
                >
                  {resetStaffLoading ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Disburse / Pay Salary Modal ── */}
      {showDisburseModal && disburseStaff && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '26px 24px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(39, 174, 96, 0.15)', color: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  💳
                </div>
                <div>
                  <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Pay Staff Salary</h3>
                  <p style={{ color: 'var(--color-text-secondary)', margin: '2px 0 0 0', fontSize: '0.82rem' }}>
                    Staff: <strong style={{ color: 'var(--color-primary)' }}>{disburseStaff.name}</strong> ({disburseStaff.employeeId || 'Staff'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowDisburseModal(false); setDisburseStaff(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Earnings Overview Card */}
              <div style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Daily Rate</span>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>₹{disburseStaff.dailyRate || 0}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Days Worked</span>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#2ecc71', marginTop: '2px' }}>{disburseStaff.workingDays || 0} days</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Remaining Balance</span>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#e67e22', marginTop: '2px' }}>
                    ₹{disburseStaff.remainingSalaryBalance !== undefined ? disburseStaff.remainingSalaryBalance : (disburseStaff.currentMonthSalary || disburseStaff.dailyRate || 0)}
                  </div>
                </div>
              </div>

              {/* Amount to Pay Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>
                    Amount to Pay (₹) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const bal = disburseStaff.remainingSalaryBalance !== undefined 
                        ? disburseStaff.remainingSalaryBalance 
                        : (disburseStaff.currentMonthSalary || disburseStaff.dailyRate || 0);
                      setDisburseAmount(bal > 0 ? bal : (disburseStaff.currentMonthSalary || disburseStaff.dailyRate || 0));
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ↻ Fill Remaining Balance
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  value={disburseAmount}
                  onChange={(e) => setDisburseAmount(e.target.value)}
                  placeholder="Enter amount to pay in ₹"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--color-primary)',
                    background: 'var(--bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '16px',
                    fontWeight: 800,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Payment Method *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'UPI', label: 'UPI / Online', icon: '📱' },
                    { id: 'Cash', label: 'Cash', icon: '💵' },
                    { id: 'Bank Transfer', label: 'Bank Transfer', icon: '🏦' }
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setDisbursePaymentMethod(method.id)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: disbursePaymentMethod === method.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: disbursePaymentMethod === method.id ? 'rgba(255, 107, 8, 0.12)' : 'var(--bg-secondary)',
                        color: disbursePaymentMethod === method.id ? 'var(--color-primary)' : 'var(--color-text-primary)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{method.icon}</span>
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remarks / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Payment Remarks
                </label>
                <input
                  type="text"
                  value={disburseRemarks}
                  onChange={(e) => setDisburseRemarks(e.target.value)}
                  placeholder="e.g. September Salary / Advance / Cash payout"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(52, 152, 219, 0.08)', border: '1px solid rgba(52, 152, 219, 0.25)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                ℹ️ Deducts <strong>₹{disburseAmount || 0}</strong> from remaining balance and logs it permanently.
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowDisburseModal(false); setDisburseStaff(null); }}
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '10px 18px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisbursement}
                disabled={disburseLoading || !disburseAmount || Number(disburseAmount) <= 0}
                className="btn btn-primary"
                style={{ width: 'auto', padding: '10px 22px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, background: '#27ae60', borderColor: '#27ae60' }}
              >
                {disburseLoading ? 'Processing...' : `Confirm & Pay ₹${disburseAmount || 0}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Detail & Activity History Modal ── */}
      {showSalaryDetailModal && selectedSalaryStaff && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '26px 24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  {selectedSalaryStaff.name}
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                  Role: <strong style={{ color: 'var(--color-primary)' }}>{selectedSalaryStaff.staffRole || selectedSalaryStaff.role || 'Staff'}</strong> • ID: {selectedSalaryStaff.employeeId || 'EMP-STAFF'} • Shift: {selectedSalaryStaff.shiftStartTime || '09:00'} - {selectedSalaryStaff.shiftEndTime || '18:00'}
                </p>
              </div>
              <button
                onClick={() => { setShowSalaryDetailModal(false); setSelectedSalaryStaff(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Financial Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'rgba(0,0,0,0.06)', padding: '12px 14px', borderRadius: '12px', marginBottom: '18px', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Daily Rate</span>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>₹{selectedSalaryStaff.dailyRate || 0}</div>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Days Worked</span>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#2ecc71', marginTop: '2px' }}>{selectedSalaryStaff.workingDays || selectedSalaryStaff.attendances?.length || 0}d</div>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total Earned</span>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#2ecc71', marginTop: '2px' }}>₹{selectedSalaryStaff.totalEarnedAllTime ?? selectedSalaryStaff.currentMonthSalary ?? 0}</div>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: '#e67e22', fontWeight: 700 }}>Unpaid Balance</span>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#e67e22', marginTop: '2px' }}>
                  ₹{selectedSalaryStaff.remainingSalaryBalance !== undefined ? selectedSalaryStaff.remainingSalaryBalance : Math.max(0, (selectedSalaryStaff.totalEarnedAllTime || selectedSalaryStaff.currentMonthSalary || 0) - (selectedSalaryStaff.totalPaidAllTime || 0))}
                </div>
              </div>
            </div>

            {/* Attendance Punch Timestamps */}
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ color: 'var(--color-text-primary)', fontSize: '12.5px', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🕒 Attendance Punch Logs (Timestamps & Hours)
              </h4>
              {(!selectedSalaryStaff.attendances || selectedSalaryStaff.attendances.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  No attendance punch records found.
                </div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Check In</th>
                        <th style={{ padding: '8px 10px' }}>Check Out</th>
                        <th style={{ padding: '8px 10px' }}>Hours</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSalaryStaff.attendances.map((att, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{att.date}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                            {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                            {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{att.workingHours || 0} hrs</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: att.status === 'Late' ? '#f39c12' : '#2ecc71',
                              background: att.status === 'Late' ? 'rgba(243,156,18,0.12)' : 'rgba(46,204,113,0.12)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {att.status || 'Present'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payout History Ledger */}
            <div>
              <h4 style={{ color: 'var(--color-text-primary)', fontSize: '12.5px', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📜 Permanent Salary Payout History
              </h4>
              {(!selectedSalaryStaff.paymentHistory || selectedSalaryStaff.paymentHistory.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  No salary payout records logged yet.
                </div>
              ) : (
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Amount Paid</th>
                        <th style={{ padding: '8px 10px' }}>Mode</th>
                        <th style={{ padding: '8px 10px' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSalaryStaff.paymentHistory.map((pm, pIdx) => (
                        <tr key={pm._id || pIdx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {pm.paymentDate ? new Date(pm.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#27ae60' }}>₹{pm.amount}</td>
                          <td style={{ padding: '8px 10px' }}>{pm.paymentMethod || 'Cash'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{pm.notes || pm.remarks || 'Salary Paid'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const staffToPay = selectedSalaryStaff;
                  setShowSalaryDetailModal(false);
                  setSelectedSalaryStaff(null);
                  openDisburseModal(staffToPay);
                }}
                className="btn btn-primary"
                style={{ width: 'auto', padding: '9px 18px', background: '#27ae60', borderColor: '#27ae60', color: '#fff', fontWeight: 800 }}
              >
                💸 Pay Salary Now
              </button>
              <button
                type="button"
                onClick={() => { setShowSalaryDetailModal(false); setSelectedSalaryStaff(null); }}
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '9px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


    {/* ── SUB-TAB 2: DAILY CAFE & WORK PHOTOS ── */}
    {(staffSubTab === 'photos' || staffSubTab === 'reports') && (() => {
      const validWorkReports = (workReports || []).filter(report => Array.isArray(report.photos) && report.photos.length > 0);
      return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header & Filter Control Bar */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ color: '#1e293b', margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📸</span> Daily Cafe Proof & Work Photos
              </h3>
              <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                Live proof-of-work, clean kitchen, sanitized prep tables, and floor photos uploaded daily by your team
              </p>
            </div>

            {/* Action / Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fetchWorkReports(false, activeBranchId)}
                disabled={reportsLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ display: 'inline-block', transform: reportsLoading ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>🔄</span>
                {reportsLoading ? 'Refreshing...' : 'Refresh Photos'}
              </button>
            </div>
          </div>

          {/* Staff Filter & Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            {/* Staff Member Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>Filter by Staff:</span>
              <select
                value={reportsFilterStaff}
                onChange={(e) => {
                  setReportsFilterStaff(e.target.value);
                  fetchWorkReports(false, activeBranchId, e.target.value);
                }}
                className="form-input"
                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', minWidth: '200px', background: '#ffffff', border: '1px solid #cbd5e1' }}
              >
                <option value="">👥 All Staff Members (All Photos)</option>
                {staff.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.staffRole || 'Staff'})</option>
                ))}
              </select>
            </div>

            {/* Total Reports Counter Badge */}
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
              Showing <strong style={{ color: 'var(--color-primary)' }}>{validWorkReports.length}</strong> photo submission{validWorkReports.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Photo Gallery Grid */}
        {reportsLoading && validWorkReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <div className="spinner" style={{ margin: '0 auto 14px auto', borderColor: 'var(--color-primary)' }} />
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Loading cafe proof photos...</p>
          </div>
        ) : validWorkReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📸</div>
            <h4 style={{ color: '#1e293b', margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 800 }}>No Proof-of-Work Photos Uploaded Yet</h4>
            <p style={{ color: '#64748b', margin: '0 auto', maxWidth: '480px', fontSize: '0.88rem', lineHeight: '1.5' }}>
              When staff members take photos of cleaned tables, sanitized kitchens, coffee machines, and cash counters from their staff dashboard, they will appear here instantly with high-resolution inspection.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {validWorkReports.map((report, rIdx) => {
              const staffObj = report.staffId && typeof report.staffId === 'object' ? report.staffId : null;
              const staffDisplayName = report.staffName || staffObj?.name || 'Staff Member';
              const staffRole = staffObj?.staffRole || 'Staff';
              const empId = staffObj?.employeeId || 'STAFF';
              const photoList = Array.isArray(report.photos) ? report.photos : [];
              const reportDateFormatted = report.date ? report.date : (report.createdAt ? new Date(report.createdAt).toISOString().split('T')[0] : 'Today');
              const timeFormatted = report.createdAt ? new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div
                  key={report._id || rIdx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  {/* Header: Staff Info + Timestamp */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, var(--color-primary, #d97706), #b45309)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '15px',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                        }}
                      >
                        {staffDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '14px' }}>
                          {staffDisplayName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px' }}>
                            {staffRole}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {empId}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timestamp Badge */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
                        📅 {reportDateFormatted}
                      </span>
                      {timeFormatted && (
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
                          🕒 {timeFormatted}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes / Work Summary (if provided) */}
                  {report.notes ? (
                    <div style={{
                      background: '#f8fafc',
                      borderLeft: '3px solid var(--color-primary, #d97706)',
                      borderRadius: '0 8px 8px 0',
                      padding: '8px 12px',
                      fontSize: '12.5px',
                      color: '#334155',
                      lineHeight: '1.4'
                    }}>
                      📝 <span style={{ fontStyle: 'italic' }}>"{report.notes}"</span>
                    </div>
                  ) : null}

                  {/* Photo Thumbnails Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: photoList.length === 1 ? '1fr' : (photoList.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)'),
                    gap: '8px'
                  }}>
                    {photoList.map((photoUrl, pIdx) => {
                      const fullUrl = getAssetUrl(photoUrl);
                      return (
                        <div
                          key={pIdx}
                          onClick={() => {
                            setSelectedReport(report);
                            setPreviewPhotoReport(report);
                            setPreviewPhotoIndex(pIdx);
                          }}
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: photoList.length === 1 ? '180px' : '100px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: '#0f172a',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          <img
                            src={fullUrl}
                            alt={`Work proof ${pIdx + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transition: 'transform 0.25s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '6px',
                              right: '6px',
                              background: 'rgba(0,0,0,0.65)',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backdropFilter: 'blur(4px)'
                            }}
                          >
                            🔍 Zoom
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Footer: Photo Count */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: 'auto' }}>
                    <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                      📷 {photoList.length} photo{photoList.length !== 1 ? 's' : ''} uploaded
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (photoList.length > 0) {
                          setSelectedReport(report);
                          setPreviewPhotoReport(report);
                          setPreviewPhotoIndex(0);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-primary, #d97706)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '2px 6px'
                      }}
                    >
                      Inspect Photos →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      );
    })()}

    {/* ── SUB-TAB 3: SHIFT & ATTENDANCE LOGS ── */}
    {staffSubTab === 'attendance' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🕒</span> Live Attendance & Shift Punches
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', margin: '3px 0 0 0', fontSize: '0.82rem' }}>
              Daily staff check-ins, check-outs, shift hours, and wage calculations
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAttendanceToday(false, activeBranchId)}
            disabled={attendanceLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'var(--bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 Refresh Attendance
          </button>
        </div>

        {/* Today's Punch Roster Table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Today's Live Punches ({new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
          </h4>

          {attendanceLoading && attendanceRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 12px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Loading punch logs...</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🕒</div>
              <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 4px 0' }}>No Attendance Punches Recorded Today</h4>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>Staff members can mark attendance from the Staff Dashboard or Kiosk.</p>
            </div>
          ) : (
            <div className="custom-scrollbar" style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    <th style={{ padding: '10px 8px' }}>Staff Member</th>
                    <th style={{ padding: '10px 8px' }}>Check In</th>
                    <th style={{ padding: '10px 8px' }}>Check Out</th>
                    <th style={{ padding: '10px 8px' }}>Total Hours</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Earned Today</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((rec, idx) => {
                    const staffName = rec.userName || rec.user?.name || rec.staffName || 'Staff Member';
                    const inTime = rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const outTime = rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active on Shift';
                    const isComplete = Boolean(rec.checkOutTime);

                    return (
                      <tr key={rec._id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {staffName}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
                          🟢 {inTime}
                        </td>
                        <td style={{ padding: '10px 8px', color: isComplete ? 'var(--color-text-secondary)' : '#27ae60', fontWeight: isComplete ? 500 : 700 }}>
                          {isComplete ? `🏁 ${outTime}` : `⚡ ${outTime}`}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                          {rec.workingHours || 0} hrs
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: rec.status === 'Late' ? '#f39c12' : '#2ecc71',
                            background: rec.status === 'Late' ? 'rgba(243, 156, 18, 0.12)' : 'rgba(46, 204, 113, 0.12)',
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}>
                            {rec.status || 'Present'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 800, color: '#27ae60' }}>
                          ₹{rec.dailyWageEarned || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ── HIGH-RESOLUTION PHOTO LIGHTBOX MODAL ── */}
    {previewPhotoReport && (
      <div
        className="modal-overlay"
        onClick={() => setPreviewPhotoReport(null)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 4000,
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.65)'
          }}
        >
          {/* Modal Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--bg-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📸</span>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {previewPhotoReport.staffName || 'Staff Proof Photo'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {previewPhotoReport.date} • Photo {previewPhotoIndex + 1} of {(previewPhotoReport.photos || []).length}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={getAssetUrl((previewPhotoReport.photos || [])[previewPhotoIndex])}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '11px',
                  color: 'var(--color-primary)',
                  background: 'rgba(212,127,70,0.12)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                🔗 Full View
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhotoReport(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>
          </div>

          {/* Main Image View */}
          <div style={{
            position: 'relative',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            maxHeight: '65vh',
            overflow: 'hidden'
          }}>
            <img
              src={getAssetUrl((previewPhotoReport.photos || [])[previewPhotoIndex])}
              alt={`Proof photo ${previewPhotoIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
            />

            {/* Prev / Next Arrows if multiple photos */}
            {(previewPhotoReport.photos || []).length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewPhotoIndex(prev => prev > 0 ? prev - 1 : (previewPhotoReport.photos.length - 1))}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPhotoIndex(prev => prev < previewPhotoReport.photos.length - 1 ? prev + 1 : 0)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>

          {/* Footer: Notes and Thumbnails Strip */}
          <div style={{ padding: '12px 18px', background: 'var(--bg-card)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {previewPhotoReport.notes && (
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)' }}>
                <strong>Notes:</strong> {previewPhotoReport.notes}
              </div>
            )}

            {/* Thumbnails strip */}
            {(previewPhotoReport.photos || []).length > 1 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }} className="no-scrollbar">
                {(previewPhotoReport.photos || []).map((p, idx) => (
                  <img
                    key={idx}
                    src={getAssetUrl(p)}
                    alt="thumb"
                    onClick={() => setPreviewPhotoIndex(idx)}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      border: idx === previewPhotoIndex ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      opacity: idx === previewPhotoIndex ? 1 : 0.6
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
)}

{activeTab === 'inventory' && (
<div className="fade-in">
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '16px', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Smart Multi-Branch Ingredient Hub</h3>
<div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
  <button
    onClick={() => { setShowPurchaseRegisterModal(true); fetchCashRegisterData(); }}
    className="btn btn-secondary"
    style={{ width: 'auto', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(39, 174, 96, 0.15)', color: '#27ae60', border: '1px solid rgba(39, 174, 96, 0.35)', fontWeight: 700, borderRadius: '10px', fontSize: '13px' }}
  >
    <Wallet size={15} /> Purchases & Cash Register
  </button>
  <button
   onClick={() =>setShowAddInventoryModal(true)}
   className="btn btn-primary"
   style={{ width: 'auto', padding: '9px 18px', borderRadius: '10px', fontSize: '13px' }}>
   + Add Ingredient
  </button>
</div>
</div>

  {/* Sub-tab bar */}
<div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', overflowX: 'auto' }} className="custom-scrollbar">
  <button 
    onClick={() => setInventorySubTab('levels')} 
    style={{ 
      background: inventorySubTab === 'levels' ? '#6F4E37' : 'var(--bg-secondary)', 
      color: inventorySubTab === 'levels' ? '#FFFFFF' : 'var(--color-text-primary)', 
      border: inventorySubTab === 'levels' ? 'none' : '1px solid var(--color-border)', 
      padding: '8px 18px', 
      borderRadius: '8px', 
      cursor: 'pointer', 
      fontWeight: inventorySubTab === 'levels' ? 800 : 600, 
      fontSize: '13px',
      boxShadow: inventorySubTab === 'levels' ? '0 2px 8px rgba(111,78,55,0.35)' : 'none',
      transition: 'all 0.2s ease'
    }}
  >
    Stock Directory
  </button>
  <button 
    onClick={() => setInventorySubTab('movements')} 
    style={{ 
      background: inventorySubTab === 'movements' ? '#6F4E37' : 'var(--bg-secondary)', 
      color: inventorySubTab === 'movements' ? '#FFFFFF' : 'var(--color-text-primary)', 
      border: inventorySubTab === 'movements' ? 'none' : '1px solid var(--color-border)', 
      padding: '8px 18px', 
      borderRadius: '8px', 
      cursor: 'pointer', 
      fontWeight: inventorySubTab === 'movements' ? 800 : 600, 
      fontSize: '13px',
      boxShadow: inventorySubTab === 'movements' ? '0 2px 8px rgba(111,78,55,0.35)' : 'none',
      transition: 'all 0.2s ease'
    }}
  >
    Movement Ledger
  </button>
  <button 
    onClick={() => setInventorySubTab('suppliers')} 
    style={{ 
      background: inventorySubTab === 'suppliers' ? '#6F4E37' : 'var(--bg-secondary)', 
      color: inventorySubTab === 'suppliers' ? '#FFFFFF' : 'var(--color-text-primary)', 
      border: inventorySubTab === 'suppliers' ? 'none' : '1px solid var(--color-border)', 
      padding: '8px 18px', 
      borderRadius: '8px', 
      cursor: 'pointer', 
      fontWeight: inventorySubTab === 'suppliers' ? 800 : 600, 
      fontSize: '13px',
      boxShadow: inventorySubTab === 'suppliers' ? '0 2px 8px rgba(111,78,55,0.35)' : 'none',
      transition: 'all 0.2s ease'
    }}
  >
    Supplier Registry
  </button>
</div>

 {inventoryError &&
<div style={{ backgroundColor: 'var(--color-danger-bg)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-text-primary)', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>
  {inventoryError}
</div>
 }

 {inventoryLoading && inventoryList.length === 0 ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Synchronizing stock records...</p>
</div>:

<div>
 {/* SUBTAB 1: Stock levels */}
 {inventorySubTab === 'levels' &&
<div>
<div style={{ marginBottom: '16px' }}>
<input
 type="text"
 placeholder=" Search ingredients..."
 value={inventorySearch}
 onChange={(e) =>setInventorySearch(e.target.value)}
 style={{
 width: '100%', padding: '10px 14px',
 borderRadius: '10px', border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)', color: 'var(--color-text-primary)',
 fontSize: '14px', outline: 'none', fontFamily: 'inherit',
 boxSizing: 'border-box'
 }} />
 
</div>

<div className="inv-mobile-cards">
  {filteredInventoryList.map((item) => (
    <InvMobileCard
      key={item._id}
      item={item}
      onPurchase={handlePurchaseInventoryCallback}
      onWastage={handleWastageInventoryCallback}
      onEdit={handleEditInventoryCallback}
      onDelete={handleDeleteInventoryCallback}
    />
  ))}
  {filteredInventoryList.length === 0 &&
  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
   No ingredients found.
  </div>
  }
</div>

 {/* Desktop/Tablet: scrollable table with scroll containment */}
<div className="inv-desktop-table custom-scrollbar" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '8px' }}>
<table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
<th style={{ padding: '8px' }}>Ingredient Name</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Stock Level</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Unit Cost</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Total Value</th>
<th style={{ padding: '8px' }}>Supplier</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Last Saved Time</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Reorder Level</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
</tr>
</thead>
<tbody>
  {filteredInventoryList.map((item) => (
    <InvTableRow
      key={item._id}
      item={item}
      onPurchase={handlePurchaseInventoryCallback}
      onWastage={handleWastageInventoryCallback}
      onEdit={handleEditInventoryCallback}
      onDelete={handleDeleteInventoryCallback}
    />
  ))}
</tbody>
</table>
</div>
</div>
 }

 {/* SUBTAB 2: Movement Logs Overhaul (7-Day Filter & Search) */}
 {inventorySubTab === 'movements' &&
<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
  {/* 7-Day Day Selector Bar */}
  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        📅 Select Day (Past 7 Days):
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        Showing <strong>{filteredMovementLogs.length}</strong> movements
      </div>
    </div>
    
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      {past7Days.map((day) => {
        const isSelected = movementDayFilter === day.key;
        return (
          <button
            key={day.key}
            type="button"
            onClick={() => setMovementDayFilter(day.key)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: isSelected ? 'var(--color-primary)' : 'var(--bg-card)',
              color: isSelected ? '#FFFFFF' : 'var(--color-text-primary)',
              fontSize: '12.5px',
              fontWeight: isSelected ? 800 : 500,
              cursor: 'pointer',
              boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {day.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setMovementDayFilter('all')}
        style={{
          padding: '6px 14px',
          borderRadius: '20px',
          border: movementDayFilter === 'all' ? '1px solid #6F4E37' : '1px solid var(--color-border)',
          background: movementDayFilter === 'all' ? '#6F4E37' : 'var(--bg-card)',
          color: movementDayFilter === 'all' ? '#FFFFFF' : 'var(--color-text-primary)',
          fontSize: '12.5px',
          fontWeight: movementDayFilter === 'all' ? 800 : 500,
          cursor: 'pointer',
          boxShadow: movementDayFilter === 'all' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        All 7 Days
      </button>
    </div>
  </div>

  {/* Search Bar for Movement Ledger */}
  <div>
    <input
      type="text"
      placeholder="🔍 Search movement records by item name, type (+ / -), or reason..."
      value={movementSearch}
      onChange={(e) => setMovementSearch(e.target.value)}
      style={{
        width: '100%', padding: '10px 14px',
        borderRadius: '10px', border: '1px solid var(--color-border)',
        background: 'var(--bg-secondary)', color: 'var(--color-text-primary)',
        fontSize: '14px', outline: 'none', fontFamily: 'inherit',
        boxSizing: 'border-box'
      }}
    />
  </div>

  {/* Movement Ledger Table */}
  <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', WebkitOverflowScrolling: 'touch', borderRadius: '8px', border: '1px solid var(--color-border)' }} className="custom-scrollbar">
    <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
      <thead>
        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
          <th style={{ padding: '10px 12px' }}>Date & Time</th>
          <th style={{ padding: '10px 12px' }}>Ingredient</th>
          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action / Type</th>
          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Stock Change</th>
          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cost / Value</th>
          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filteredMovementLogs.map((log) => {
          const qtyChangedNum = Number(log.quantityChanged) || 0;
          const isPositive = log.type === 'Purchase' || log.type === 'Initial' || qtyChangedNum > 0;
          const typeLabel = isPositive ? '+ Add Stock' : '- Reduce Stock';
          const typeBg = isPositive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)';
          const typeColor = isPositive ? '#2ECC71' : '#E74C3C';

          const costNum = Math.abs(Number(log.cost) || 0);
          const displayCost = (costNum > 0 && isPositive) ? `₹${costNum.toFixed(2)}` : '—';

          return (
            <tr key={log._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>
                {log.itemName}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <span style={{
                  backgroundColor: typeBg,
                  border: `1px solid ${typeColor}`,
                  color: typeColor,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {typeLabel}
                </span>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: isPositive ? '#2ECC71' : '#E74C3C', fontSize: '13px' }}>
                {isPositive ? `+${Math.abs(qtyChangedNum)}` : `-${Math.abs(qtyChangedNum)}`}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-primary)' }}>
                {displayCost}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleRevertMovement(log)}
                  style={{
                    background: 'rgba(231, 76, 60, 0.12)',
                    color: '#E74C3C',
                    border: '1px solid #E74C3C',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Revert this stock change and remove from ledger"
                >
                  ↩️ Back
                </button>
              </td>
            </tr>
          );
        })}
        {filteredMovementLogs.length === 0 && (
          <tr>
            <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)' }}>
              No stock movements found for the selected day/filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
 }

 {/* SUBTAB 3: Suppliers */}
 {inventorySubTab === 'suppliers' &&
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
 {Array.from(new Set(inventoryList.map((item) =>item.supplier || 'Unassigned Supplier'))).map((sup) =>{
 const supItems = inventoryList.filter((item) =>(item.supplier || 'Unassigned Supplier') === sup);
 const totalSupplierValue = supItems.reduce((sum, i) =>sum + (i.quantity || i.stock) * (i.costPrice || i.cost), 0);
 return (
<div key={sup} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
<div>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '1rem' }}>{sup}</strong>
{(() => {
  const phone = supItems.find(i => i.supplierPhone)?.supplierPhone;
  return phone ? (
    <div style={{ fontSize: '12px', marginTop: '3px' }}>
      <a href={`tel:${phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>📞 {phone}</a>
    </div>
  ) : null;
})()}
</div>
<span style={{ fontSize: '11px', background: 'var(--color-primary)', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
 {supItems.length} Products
</span>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 {supItems.map((item) =>
<div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
<strong style={{ color: 'var(--color-text-primary)' }}>{item.quantity || item.stock} {item.unit}</strong>
</div>
)}
</div>
<div style={{ borderTop: '1px dashed var(--color-border)', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
<span>Total Value:</span>
<strong style={{ color: '#2ECC71' }}>₹{totalSupplierValue.toFixed(2)}</strong>
</div>
</div>);

 })}
</div>
}
</div>
}
</div>
</div>
)}

 {/* TAB 5: ORDERS MONITOR (READ-ONLY) */}
 {activeTab === 'orders' &&
<div className="fade-in">
<div className="orders-monitor-wrapper" style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', overflowX: 'auto' }}>

{/* Filter Controls for Orders */}
<div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Select Date</label>
 <input 
 type="date" 
 value={orderDateFilter} 
 onChange={(e) => setOrderDateFilter(e.target.value)}
 style={{
 padding: '10px 14px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 outline: 'none',
 fontFamily: 'inherit',
 fontSize: '14px'
 }}
 />
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
 <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Search Orders</label>
 <input 
 type="text" 
 placeholder="Search by Order ID, Table number, or Status..."
 value={orderSearchQuery} 
 onChange={(e) => setOrderSearchQuery(e.target.value)}
 style={{
 padding: '10px 14px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 outline: 'none',
 fontFamily: 'inherit',
 width: '100%',
 fontSize: '14px'
 }}
 />
 </div>
</div>

<div className="orders-monitor-grid">
 {orders
    .filter((order) => {
      if (!order) return false;
      if (order.status === 'Cancelled' || order.status === 'cancelled') return false;
      
      // Date filtering
      if (orderDateFilter && order.createdAt) {
        const localDate = new Date(order.createdAt);
        const orderDateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
        if (orderDateStr !== orderDateFilter) return false;
      }
      
      // Search query filtering
      if (orderSearchQuery && orderSearchQuery.trim() !== '') {
        const q = orderSearchQuery.toLowerCase().trim();
        const orderId = String(order._id || order.id || '').toLowerCase();
        const tableNum = String(order.tableNumber || '').toLowerCase();
        const status = String(order.status || '').toLowerCase();
        const customerName = String(order.customerName || '').toLowerCase();
        const itemsMatch = Array.isArray(order.items) && order.items.some(i => (i.name || '').toLowerCase().includes(q));
        if (!orderId.includes(q) && !tableNum.includes(q) && !status.includes(q) && !customerName.includes(q) && !itemsMatch) {
          return false;
        }
      }
      
      return true;
    })
    .map((order, orderIndex) => {
      const orderIdStr = String(order?._id || order?.id || `ORD-${orderIndex}`);
      const shortId = orderIdStr.length >= 8 ? orderIdStr.slice(-8).toUpperCase() : (orderIdStr.toUpperCase() || 'ORDER');
      const orderItems = Array.isArray(order?.items) ? order.items : [];
      const totalAmt = typeof order?.totalAmount === 'number' ? order.totalAmount.toFixed(2) : (Number(order?.totalAmount) || 0).toFixed(2);

      return (
      <div key={order?._id || orderIndex} style={{
        background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)',
        borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        {/* Header: Order ID + Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '15px' }}>
              #{shortId}
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>· Table {order?.tableNumber || 'N/A'}</span>
          </div>
          <span style={{
            color: order?.status === 'Placed' ? '#3498db' : order?.status === 'Preparing' ? '#ff9800' : order?.status === 'Ready' ? '#2ecc71' : order?.status === 'Delivered' ? '#9b59b6' : order?.status === 'Completed' ? '#27AE60' : '#7f8c8d',
            background: order?.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order?.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order?.status === 'Ready' ? 'rgba(46,204,113,0.1)' : order?.status === 'Delivered' ? 'rgba(155,89,182,0.1)' : order?.status === 'Completed' ? 'rgba(39,174,96,0.1)' : 'rgba(127,140,141,0.1)',
            padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
          }}>
            {order?.status || 'Active'}
          </span>
        </div>

        {/* Items List */}
        <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {orderItems.map((i, idx) => {
            const displayImage = i.image ? getAssetUrl(i.image) : '/images/default-food.png';
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '4px 8px', borderRadius: '6px' }}>
                <img
                  src={displayImage}
                  alt={i.name || 'Food item'}
                  style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  onError={(e) => { e.target.src = '/images/default-food.png'; }}
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  {i.quantity || 1}x
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-primary)' }}>
                  {i.name || 'Item'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Workflow Audit Trail */}
        <div style={{ marginTop: '8px', fontSize: '11px', background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Workflow History</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Placed:</span>
            <span>{order?.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</span>
          </div>
          {order?.preparingByName && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Preparing by {order.preparingByName}:</span>
              <span>{order.preparingAt ? new Date(order.preparingAt).toLocaleString() : 'N/A'}</span>
            </div>
          )}
          {order?.readyByName && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ready by {order.readyByName}:</span>
              <span>{order.readyAt ? new Date(order.readyAt).toLocaleString() : 'N/A'}</span>
            </div>
          )}
          {order?.servedByName && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Served by {order.servedByName}:</span>
              <span>{order.servedAt ? new Date(order.servedAt).toLocaleString() : 'N/A'}</span>
            </div>
          )}
          {order?.paidByName && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid by {order.paidByName}:</span>
              <span>{order.paidAt ? new Date(order.paidAt).toLocaleString() : 'N/A'}</span>
            </div>
          )}
        </div>

        {/* Footer: Amount + Payment Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(0, 0, 0,0.1)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Total Amount</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '16px' }}>₹{totalAmt}</span>
          </div>
          <span style={{
            color: order?.paymentStatus === 'Paid' ? '#27AE60' : '#E74C3C',
            fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            {order?.paymentStatus === 'Paid' ? ' Paid' : ' Pending'}
          </span>
        </div>
      </div>
    );
  })}
  {orders.length === 0 &&
    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
      No active orders at the moment.
    </div>
  }
</div>
</div>
</div>
 }

 {/* TAB 7: SETTINGS & QRS */}
 {activeTab === 'config' &&
<div className="fade-in">
 {/* Payment Integration settings */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', marginBottom: '30px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700 }}>Tax & Charges Configuration</h3>
 {settingsMsg &&
<div style={{ background: 'rgba(39,174,96,0.15)', borderLeft: '4px solid #27AE60', color: '#27AE60', padding: '12px', marginBottom: '20px', borderRadius: '4px' }}>
 {settingsMsg}
</div>
 }
<form onSubmit={handleSaveSettings}>

<div className="form-row" style={{ marginBottom: '20px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="settings-tax-rate" className="form-label" style={{ color: 'var(--color-text-primary)' }}>GST Tax Rate (%)</label>
<input type="number" id="settings-tax-rate" name="settings-tax-rate" className="form-input" value={taxRate} onChange={(e) =>setTaxRate(parseFloat(e.target.value))} />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="settings-service-charge" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Platform Charge (Flat ₹)</label>
<input type="number" id="settings-service-charge" name="settings-service-charge" className="form-input" value={serviceCharge} onChange={(e) =>setServiceCharge(parseFloat(e.target.value))} />
</div>
</div>

<div style={{ borderTop: '1px solid var(--color-border)', marginTop: '20px', paddingTop: '20px', marginBottom: '20px' }}>
  <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 15px 0', fontSize: '1rem', fontWeight: 700 }}>Payment Methods & Counter Billing Settings</h4>
  
  <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={acceptCash} onChange={(e) => setAcceptCash(e.target.checked)} />
      Accept Cash at Counter
    </label>
    
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={enableUpi} onChange={(e) => setEnableUpi(e.target.checked)} />
      Accept UPI (QR / Address)
    </label>
  </div>

  {enableUpi && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
      <div className="form-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="settings-upi-id" className="form-label" style={{ color: 'var(--color-text-primary)' }}>UPI ID (e.g. UPI Address)</label>
          <input type="text" id="settings-upi-id" className="form-input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="e.g. 9346540919@ybl" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="settings-bank-holder" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Account Holder Name</label>
          <input type="text" id="settings-bank-holder" className="form-input" value={bankHolderName} onChange={(e) => setBankHolderName(e.target.value)} placeholder="e.g. Cafe Owner" />
        </div>
      </div>
      
      <div className="form-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="settings-bank-acc" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Bank Account Number</label>
          <input type="text" id="settings-bank-acc" className="form-input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g. 1234567890" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="settings-bank-ifsc" className="form-label" style={{ color: 'var(--color-text-primary)' }}>IFSC Code</label>
          <input type="text" id="settings-bank-ifsc" className="form-input" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} placeholder="e.g. SBIN0001234" />
        </div>
      </div>
    </div>
  )}

  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
    <label htmlFor="settings-instructions" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Custom Payment Instructions</label>
    <textarea id="settings-instructions" className="form-input" value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder="e.g. Please show the payment confirmation screen to the server." style={{ minHeight: '80px', resize: 'vertical' }} />
  </div>
</div>

<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
  Save Configuration
</button>
</form>
</div>

 {/* QR Code generator */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 700 }}>Table QR Codes Generator</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
 Select a table to dynamically render its scan QR code. Customers can scan it to order directly.
</p>
 
<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
 {dynamicTables.map((table) =>
<button
 key={table}
 onClick={() =>setSelectedQrTable(selectedQrTable === table ? null : table)}
 className="category-chip"
 style={{
 padding: '8px 16px',
 fontSize: '13px',
 borderRadius: 'var(--radius-sm)',
 background: selectedQrTable === table ? 'var(--color-primary)' : 'transparent',
 border: '1px solid var(--color-primary)',
 color: 'var(--color-text-primary)',
 cursor: 'pointer'
 }}>
 
 Table {table} QR
</button>
)}
</div>

 {selectedQrTable &&
<div style={{
 padding: '20px',
 background: 'var(--bg-secondary)',
 border: '1px solid var(--color-primary)',
 borderRadius: '8px',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 textAlign: 'center'
 }}>
<h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
 Scan QR for Table {selectedQrTable}
</h4>
<div style={{ background: 'white', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
<img
 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`)}`}
 alt={`Table ${selectedQrTable} QR Code`}
 style={{ width: '150px', height: '150px', display: 'block' }} />
 
</div>
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
<a href={`/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', width: 'auto' }}>
 Open Menu Tab
</a>
<button onClick={() =>handleCopyUrl(selectedQrTable)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}>
 {copiedLink ? ' Copied!' : ' Copy URL'}
</button>
<button onClick={() => handleDownloadQr(selectedQrTable)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', background: '#27ae60', borderColor: '#27ae60', color: '#fff' }}>
 📥 Download QR
</button>
</div>
</div>
 }
</div>

 {/* Branch Management Section */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', marginTop: '30px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Cafe Branch & Location Management</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
  Assigned branch locations and geofences for attendance tracking. Only Super Admin can provision or modify branches.
</p>
</div>
<div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '6px 14px', borderRadius: '20px', fontSize: '12.5px', fontWeight: 600 }}>
  🔒 Managed by Super Admin
</div>
</div>

 {branchesLoading && branches.length === 0 ? (
<div style={{ textAlign: 'center', padding: '20px 0' }}>
  <div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading branches...</p>
</div>
) : branches.length === 0 ? (
<div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
  No branches configured yet. Add one to start tracking location-based attendance.
</div>
) : (
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
  {branches.map((b) => (
    <div key={b._id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{b.branchName}</h4>
        <div><strong>Branch Code:</strong> {b.branchId}</div>
        <span style={{
          backgroundColor: b.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
          color: b.isActive ? '#2ecc71' : '#e74c3c',
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 'bold'
        }}>
          {b.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div><strong>Manager:</strong> {b.manager || 'Unassigned'}</div>
        <div><strong>Address:</strong> {b.address}</div>
        <div><strong>Coordinates:</strong> {b.latitude}, {b.longitude}</div>
        <div><strong>Geo-Fence:</strong> {b.allowedRadius} meters radius</div>
        <div><strong>Unified Staff Mode:</strong> {b.unifiedStaffMode ? 'Enabled' : 'Disabled'}</div>
      </div>
      <div style={{ marginTop: '6px', borderTop: '1px solid var(--color-border)', paddingTop: '8px', fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
        Read Only (Super Admin Configured)
      </div>
    </div>
  ))}
</div>
)}
</div>
</div>
}

  {/* MODAL 1: ADD NEW MENU ITEM */}
 {showAddModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Add New Cafe Item</h3>
<button onClick={() =>setShowAddModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleAddMenuItem}>
<div className="modal-body">
<div className="form-group">
<label htmlFor="add-item-name" className="form-label">Dish Name *</label>
<input type="text" id="add-item-name" name="add-item-name" required placeholder="Gourmet double cheeseburger" value={newItem.name} onChange={(e) =>setNewItem({ ...newItem, name: e.target.value })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-item-price" className="form-label">Selling Price (₹) *</label>
<input type="number" id="add-item-price" name="add-item-price" required step="0.01" min="0.01" placeholder="e.g. 20 (Customer price)" value={newItem.price} onChange={(e) =>setNewItem({ ...newItem, price: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-item-making-cost" className="form-label">Total Making Cost (₹)</label>
<input type="number" id="add-item-making-cost" name="add-item-making-cost" step="0.01" min="0" placeholder="e.g. 6 (Prep/raw cost)" value={newItem.makingCost ?? ''} onChange={(e) =>setNewItem({ ...newItem, makingCost: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-item-category" className="form-label">Category *</label>
<select id="add-item-category" name="add-item-category" value={newItem.category} onChange={(e) =>setNewItem({ ...newItem, category: e.target.value })} className="form-input" disabled={newItem.isCombo}>
 {Array.from(new Set([...(categories.length >0 ? categories.map((c) =>c.name) : presetCategories), 'Combos'])).map((cat) =>
<option key={cat} value={cat}>{cat}</option>
)}
</select>
</div>
</div>
{newItem.isCombo && (
<div className="form-group">
<label htmlFor="add-item-original-price" className="form-label">Orig. Price (₹)</label>
<input type="number" id="add-item-original-price" name="add-item-original-price" step="0.01" min="0.01" placeholder="Optional" value={newItem.originalPrice || ''} onChange={(e) =>setNewItem({ ...newItem, originalPrice: e.target.value })} className="form-input" />
</div>
)}

{Number(newItem.price || 0) > 0 && Number(newItem.makingCost || 0) > 0 && (
<div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid #2ECC71', borderRadius: '8px', padding: '10px 14px', marginTop: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
  <span style={{ fontSize: '13.5px', color: '#2ECC71', fontWeight: 700 }}>
    💰 Estimated Profit: ₹{(Number(newItem.price) - Number(newItem.makingCost)).toFixed(2)} per item
  </span>
  <span style={{ fontSize: '12px', background: '#2ECC71', color: '#1B120C', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
    {(((Number(newItem.price) - Number(newItem.makingCost)) / Number(newItem.price)) * 100).toFixed(1)}% Profit Margin
  </span>
</div>
)}
<div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: '10px' }}>
  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
    <label className="switch">
      <input type="checkbox" checked={newItem.isCombo || false} onChange={(e) => {
        const isCombo = e.target.checked;
        setNewItem({ ...newItem, isCombo, category: isCombo ? 'Combos' : newItem.category });
      }} />
      <span className="slider round"></span>
    </label>
    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Is this a Combo?</span>
  </div>
  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
    <label className="switch">
      <input type="checkbox" checked={newItem.available !== false} onChange={(e) => {
        setNewItem({ ...newItem, available: e.target.checked });
      }} />
      <span className="slider round"></span>
    </label>
    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>In Stock (Available)</span>
  </div>
</div>
<div className="form-group">
<label htmlFor="add-item-prep-time" className="form-label">Preparation Time (minutes) *</label>
<input type="number" id="add-item-prep-time" name="add-item-prep-time" required min="1" value={newItem.preparationTime || 10} onChange={(e) =>setNewItem({ ...newItem, preparationTime: parseInt(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<span id="add-item-image-label" className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Dish Image</span>
<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} aria-labelledby="add-item-image-label">
<input
 type="file"
 accept="image/*"
 id="add-dish-image"
 onChange={(e) =>handleImageUpload(e.target.files[0], false)}
 style={{ display: 'none' }} />
 
<label
 htmlFor="add-dish-image"
 className="btn btn-secondary"
 style={{
 width: 'auto',
 padding: '10px 18px',
 cursor: 'pointer',
 margin: 0,
 display: 'inline-flex',
 alignItems: 'center',
 gap: '6px',
 border: '1px solid var(--color-border)',
 background: 'rgba(0, 0, 0,0.05)',
 borderRadius: '8px',
 fontSize: '13px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 minHeight: '44px'
 }}>
 
 Choose Image File
</label>
 {imageUploading ?
<span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Uploading...</span>:
 newItem.image ?
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<img src={getAssetUrl(newItem.image)} alt="Dish preview" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
<span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>Uploaded</span>
</div>:

<span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No file selected (using default)</span>
 }
</div>
</div>
<RecipeMapper
  recipe={newItem.recipe || []}
  onUpdateRecipe={(updated) => setNewItem({ ...newItem, recipe: updated })}
  inventoryList={inventoryList}
  onSetMakingCost={(cost) => setNewItem({ ...newItem, makingCost: cost })}
/>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowAddModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={isMenuSubmitting}>{isMenuSubmitting ? 'Adding...' : 'Add Item'}</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 2: EDIT MENU ITEM */}
 {showEditModal && editingItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Cafe Item</h3>
<button onClick={() =>{setShowEditModal(false);setEditingItem(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditMenuItem}>
<div className="modal-body">
<div className="form-group">
<label htmlFor="edit-item-name" className="form-label">Dish Name *</label>
<input type="text" id="edit-item-name" name="edit-item-name" required value={editingItem.name} onChange={(e) =>setEditingItem({ ...editingItem, name: e.target.value })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-item-price" className="form-label">Selling Price (₹) *</label>
<input type="number" id="edit-item-price" name="edit-item-price" required step="0.01" min="0.01" placeholder="e.g. 20 (Customer price)" value={editingItem.price} onChange={(e) =>setEditingItem({ ...editingItem, price: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-item-making-cost" className="form-label">Total Making Cost (₹)</label>
<input type="number" id="edit-item-making-cost" name="edit-item-making-cost" step="0.01" min="0" placeholder="e.g. 6 (Prep/raw cost)" value={editingItem.makingCost ?? ''} onChange={(e) =>setEditingItem({ ...editingItem, makingCost: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-item-category" className="form-label">Category *</label>
<select id="edit-item-category" name="edit-item-category" value={editingItem.category} onChange={(e) =>setEditingItem({ ...editingItem, category: e.target.value })} className="form-input" disabled={editingItem.isCombo}>
 {Array.from(new Set([...(categories.length >0 ? categories.map((c) =>c.name) : presetCategories), 'Combos'])).map((cat) =>
<option key={cat} value={cat}>{cat}</option>
)}
</select>
</div>
</div>
{editingItem.isCombo && (
<div className="form-group">
<label htmlFor="edit-item-original-price" className="form-label">Orig. Price (₹)</label>
<input type="number" id="edit-item-original-price" name="edit-item-original-price" step="0.01" min="0.01" placeholder="Optional" value={editingItem.originalPrice || ''} onChange={(e) =>setEditingItem({ ...editingItem, originalPrice: e.target.value })} className="form-input" />
</div>
)}

{Number(editingItem.price || 0) > 0 && Number(editingItem.makingCost || 0) > 0 && (
<div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid #2ECC71', borderRadius: '8px', padding: '10px 14px', marginTop: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
  <span style={{ fontSize: '13.5px', color: '#2ECC71', fontWeight: 700 }}>
    💰 Estimated Profit: ₹{(Number(editingItem.price) - Number(editingItem.makingCost)).toFixed(2)} per item
  </span>
  <span style={{ fontSize: '12px', background: '#2ECC71', color: '#1B120C', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
    {(((Number(editingItem.price) - Number(editingItem.makingCost)) / Number(editingItem.price)) * 100).toFixed(1)}% Profit Margin
  </span>
</div>
)}
<div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: '10px' }}>
  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
    <label className="switch">
      <input type="checkbox" checked={editingItem.isCombo || false} onChange={(e) => {
        const isCombo = e.target.checked;
        setEditingItem({ ...editingItem, isCombo, category: isCombo ? 'Combos' : editingItem.category });
      }} />
      <span className="slider round"></span>
    </label>
    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Is this a Combo?</span>
  </div>
  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
    <label className="switch">
      <input type="checkbox" checked={editingItem.available !== false} onChange={(e) => {
        setEditingItem({ ...editingItem, available: e.target.checked });
      }} />
      <span className="slider round"></span>
    </label>
    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>In Stock (Available)</span>
  </div>
</div>
<div className="form-group">
<label htmlFor="edit-item-description" className="form-label">Description (Optional)</label>
<textarea id="edit-item-description" name="edit-item-description" rows="3" value={editingItem.description || ''} onChange={(e) =>setEditingItem({ ...editingItem, description: e.target.value })} className="form-input"></textarea>
</div>
<div className="form-group">
<label htmlFor="edit-item-prep-time" className="form-label">Preparation Time (minutes) *</label>
<input type="number" id="edit-item-prep-time" name="edit-item-prep-time" required min="1" value={editingItem.preparationTime || 10} onChange={(e) =>setEditingItem({ ...editingItem, preparationTime: parseInt(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<span id="edit-item-image-label" className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Dish Image</span>
<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} aria-labelledby="edit-item-image-label">
<input
 type="file"
 accept="image/*"
 id="edit-dish-image"
 onChange={(e) =>handleImageUpload(e.target.files[0], true)}
 style={{ display: 'none' }} />
 
<label
 htmlFor="edit-dish-image"
 className="btn btn-secondary"
 style={{
 width: 'auto',
 padding: '10px 18px',
 cursor: 'pointer',
 margin: 0,
 display: 'inline-flex',
 alignItems: 'center',
 gap: '6px',
 border: '1px solid var(--color-border)',
 background: 'rgba(0, 0, 0,0.05)',
 borderRadius: '8px',
 fontSize: '13px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 minHeight: '44px'
 }}>
 
 Choose Image File
</label>
 {imageUploading ?
<span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Uploading...</span>:
 editingItem.image ?
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<img src={getAssetUrl(editingItem.image)} alt="Dish preview" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
<span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>Uploaded</span>
</div>:

<span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No file selected (using default)</span>
 }
</div>
</div>
<RecipeMapper
  recipe={editingItem.recipe || []}
  onUpdateRecipe={(updated) => setEditingItem({ ...editingItem, recipe: updated })}
  inventoryList={inventoryList}
  onSetMakingCost={(cost) => setEditingItem({ ...editingItem, makingCost: cost })}
/>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditModal(false);setEditingItem(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={isMenuSubmitting}>{isMenuSubmitting ? 'Saving...' : 'Update & Save'}</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: MANAGE CATEGORIES */}
 {showCategoryModal &&
<div className="modal-overlay">
<div className="modal-container" style={{ maxWidth: '500px' }}>
<div className="modal-header">
<h3 className="modal-title">Manage Menu Categories</h3>
<button onClick={() =>{setShowCategoryModal(false);setEditingCategory(null);}} className="modal-close">&times;</button>
</div>
<div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
 {/* Add new Category */}
<form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(0, 0, 0,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
<input
 type="text"
 id="new-category-name"
 name="new-category-name"
 aria-label="New Category Name"
 required
 placeholder="New category name..."
 value={newCategoryName}
 onChange={(e) =>setNewCategoryName(e.target.value)}
 className="form-input"
 style={{ marginBottom: 0, flexGrow: 1 }} />
 
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
 Add
</button>
</form>


          {/* List Categories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', margin: '0 0 5px 0' }}>Existing Categories (Drag or use arrows to reorder):</h4>
            {categoryLoading && categories.length === 0 ? (
              <div className="spinner" style={{ margin: '10px auto', borderColor: 'var(--color-primary)', width: '20px', height: '20px', borderWidth: '2px' }} />
            ) : (
              (categories.length > 0 ? categories : presetCategories.map((name, idx) => ({ _id: idx, name }))).map((cat, idx) => {
                const isEditingThis = editingCategory && (editingCategory._id === cat._id || (editingCategory.name && editingCategory.name === cat.name));
                return (
                  <div
                    key={cat._id || idx}
                    draggable={!isEditingThis}
                    onDragStart={(e) => handleCategoryDragStart(e, idx)}
                    onDragOver={handleCategoryDragOver}
                    onDrop={(e) => handleCategoryDrop(e, idx)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isEditingThis ? 'rgba(255, 107, 8, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                      border: isEditingThis ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      cursor: isEditingThis ? 'default' : 'grab',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}
                    onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onDragLeave={(e) => { if (!isEditingThis) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'; }}
                    onDragEnter={(e) => { if (!isEditingThis) e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)'; }}
                  >
                    {isEditingThis ? (
                      <form
                        onSubmit={(e) => handleUpdateCategory(e, cat, categoryNameInput)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={categoryNameInput}
                          onChange={(e) => setCategoryNameInput(e.target.value)}
                          className="form-input"
                          style={{
                            marginBottom: 0,
                            flex: 1,
                            height: '38px',
                            padding: '0 12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            borderColor: 'var(--color-primary)'
                          }}
                          placeholder="Category name..."
                          required
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{
                            width: 'auto',
                            padding: '0 14px',
                            height: '38px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ✓ Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(null);
                            setCategoryNameInput('');
                          }}
                          className="btn btn-secondary"
                          style={{
                            width: 'auto',
                            padding: '0 12px',
                            height: '38px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <span
                            title="Drag to reorder"
                            style={{
                              color: 'var(--color-text-secondary, #888)',
                              cursor: 'grab',
                              fontSize: '15px',
                              letterSpacing: '1px',
                              userSelect: 'none'
                            }}
                          >
                            ⋮⋮
                          </span>
                          <span style={{ color: 'var(--color-text-primary)', fontSize: '14.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cat.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {/* Reordering arrows */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              title="Move up"
                              disabled={idx === 0}
                              onClick={() => moveCategory(idx, 'up')}
                              style={{
                                background: 'rgba(0, 0, 0, 0.05)',
                                border: '1px solid var(--color-border)',
                                color: idx === 0 ? 'var(--color-text-muted, #ccc)' : 'var(--color-text-primary, #333)',
                                borderRadius: '5px',
                                padding: '4px 7px',
                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                fontSize: '10px',
                                lineHeight: 1
                              }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              title="Move down"
                              disabled={idx === (categories.length > 0 ? categories.length : presetCategories.length) - 1}
                              onClick={() => moveCategory(idx, 'down')}
                              style={{
                                background: 'rgba(0, 0, 0, 0.05)',
                                border: '1px solid var(--color-border)',
                                color: idx === (categories.length > 0 ? categories.length : presetCategories.length) - 1 ? 'var(--color-text-muted, #ccc)' : 'var(--color-text-primary, #333)',
                                borderRadius: '5px',
                                padding: '4px 7px',
                                cursor: idx === (categories.length > 0 ? categories.length : presetCategories.length) - 1 ? 'not-allowed' : 'pointer',
                                fontSize: '10px',
                                lineHeight: 1
                              }}
                            >
                              ▼
                            </button>
                          </div>

                          {/* Edit & Delete Action Buttons */}
                          <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid var(--color-border)', paddingLeft: '8px' }}>
                            <button
                              type="button"
                              title="Edit Category"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryNameInput(cat.name);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(255, 107, 8, 0.08)',
                                border: '1px solid rgba(255, 107, 8, 0.3)',
                                color: 'var(--color-primary, #e65c00)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              title="Delete Category"
                              onClick={() => handleDeleteCategory(cat._id, cat.name)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(231, 76, 60, 0.08)',
                                border: '1px solid rgba(231, 76, 60, 0.3)',
                                color: 'var(--color-danger, #e74c3c)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="modal-footer">
<button type="button" onClick={() =>{setShowCategoryModal(false);setEditingCategory(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Close</button>
</div>
</div>
</div>
 }

 {/* MODAL 4: ADD INVENTORY ITEM */}
 {showAddInventoryModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Add Ingredient</h3>
<button onClick={() =>setShowAddInventoryModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleAddInventoryItem}>
<div className="modal-body">
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-name" className="form-label">Ingredient Name *</label>
<input type="text" id="add-inv-name" name="add-inv-name" required value={newInventoryItem.name} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, name: e.target.value })} className="form-input" placeholder="e.g. Sugar, Assam Tea, Milk" />
</div>
<div className="form-group">
<label htmlFor="add-inv-category" className="form-label">Category *</label>
<input type="text" id="add-inv-category" name="add-inv-category" required value={newInventoryItem.category} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, category: e.target.value })} className="form-input" placeholder="e.g. Ingredients, Dairy, Grocery" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-stock" className="form-label">Quantity / Stock Purchased *</label>
<input
  type="number"
  id="add-inv-stock"
  name="add-inv-stock"
  required
  min="0.001"
  step="any"
  placeholder="e.g. 1000"
  value={newInventoryItem.stock ?? ''}
  onChange={(e) => {
    const qty = e.target.value === '' ? '' : Number(e.target.value);
    const totalPaid = Number(newInventoryItem.totalPurchaseCost || 0);
    const computedCost = (totalPaid > 0 && qty > 0) ? Number((totalPaid / qty).toFixed(4)) : (newInventoryItem.cost || 0);
    setNewInventoryItem({
      ...newInventoryItem,
      stock: qty,
      quantity: qty,
      cost: computedCost,
      costPrice: computedCost
    });
  }}
  className="form-input"
/>
</div>
<div className="form-group">
<label htmlFor="add-inv-unit" className="form-label">Unit of Measurement *</label>
<input
  type="text"
  id="add-inv-unit"
  name="add-inv-unit"
  required
  value={newInventoryItem.unit}
  onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })}
  className="form-input"
  placeholder="e.g. g, ml, pcs, kg, liters"
/>
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-total-paid" className="form-label">Total Amount Paid to Buy This (₹) *</label>
<input
  type="number"
  step="any"
  min="0"
  id="add-inv-total-paid"
  name="add-inv-total-paid"
  required
  placeholder="e.g. 50 (if 1000g cost ₹50)"
  value={newInventoryItem.totalPurchaseCost ?? ''}
  onChange={(e) => {
    const total = e.target.value === '' ? '' : Number(e.target.value);
    const qty = Number(newInventoryItem.stock || 0);
    const computedCost = (total > 0 && qty > 0) ? Number((total / qty).toFixed(4)) : (total || 0);
    setNewInventoryItem({
      ...newInventoryItem,
      totalPurchaseCost: total,
      cost: computedCost,
      costPrice: computedCost
    });
  }}
  className="form-input"
/>
</div>
<div className="form-group">
<label htmlFor="add-inv-minstock" className="form-label">Safety Minimum (Low Stock Alert) *</label>
<input
  type="number"
  id="add-inv-minstock"
  name="add-inv-minstock"
  required
  min="0"
  placeholder="e.g. 100"
  value={newInventoryItem.minStock ?? ''}
  onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, minStock: e.target.value === '' ? '' : Number(e.target.value), reorderLevel: e.target.value === '' ? '' : Number(e.target.value) })}
  className="form-input"
/>
</div>
</div>

{Number(newInventoryItem.stock || 0) > 0 && Number(newInventoryItem.totalPurchaseCost || 0) > 0 && (
  <div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid #2ECC71', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#2ECC71', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
    <span>✓ <strong>Calculated Cost:</strong> ₹{Number((newInventoryItem.totalPurchaseCost / newInventoryItem.stock).toFixed(4))} per {newInventoryItem.unit || 'unit'}</span>
    <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>(₹{newInventoryItem.totalPurchaseCost} paid for {newInventoryItem.stock} {newInventoryItem.unit || 'units'})</span>
  </div>
)}

<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-supplier" className="form-label">Supplier Name</label>
<input type="text" id="add-inv-supplier" name="add-inv-supplier" value={newInventoryItem.supplier} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, supplier: e.target.value })} className="form-input" placeholder="e.g. Metro Cash & Carry, Dairy Fresh (Optional)" />
</div>
<div className="form-group">
<label htmlFor="add-inv-supplier-phone" className="form-label">Supplier Phone Number</label>
<input type="tel" id="add-inv-supplier-phone" name="add-inv-supplier-phone" value={newInventoryItem.supplierPhone || ''} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, supplierPhone: e.target.value })} className="form-input" placeholder="e.g. 9876543210" />
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowAddInventoryModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={isInventorySubmitting}>{isInventorySubmitting ? 'Adding...' : 'Add Ingredient'}</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 5: EDIT INVENTORY ITEM */}
 {showEditInventoryModal && editingInventoryItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Ingredient</h3>
<button onClick={() =>{setShowEditInventoryModal(false);setEditingInventoryItem(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditInventoryItem}>
<div className="modal-body">

  {/* Row 1: Name + Unit */}
  <div className="form-row">
    <div className="form-group">
      <label htmlFor="edit-inv-name" className="form-label">Ingredient Name *</label>
      <input type="text" id="edit-inv-name" name="edit-inv-name" required value={editingInventoryItem.name || ''} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, name: e.target.value })} className="form-input" />
    </div>
    <div className="form-group">
      <label htmlFor="edit-inv-unit" className="form-label">Unit of Measurement *</label>
      <input type="text" id="edit-inv-unit" name="edit-inv-unit" required value={editingInventoryItem.unit || ''} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, unit: e.target.value })} className="form-input" placeholder="e.g. kg, litre, pc" />
    </div>
  </div>

  {/* Row 2: Current Stock + Safety Minimum */}
  <div className="form-row">
    <div className="form-group">
      <label htmlFor="edit-inv-quantity" className="form-label">
        Current Stock ({editingInventoryItem.unit || 'units'}) *
      </label>
      <input
        type="number"
        step="any"
        min="0"
        id="edit-inv-quantity"
        name="edit-inv-quantity"
        required
        value={editingInventoryItem.quantity ?? ''}
        onChange={(e) => {
          const qty = e.target.value === '' ? '' : Number(e.target.value);
          let newUnitCost = editingInventoryItem.costPrice;
          let newTotal = editingInventoryItem.totalCost;
          if (editingInventoryItem.totalCost && qty > 0) {
            newUnitCost = Number((Number(editingInventoryItem.totalCost) / qty).toFixed(4));
          } else if (editingInventoryItem.costPrice && qty > 0) {
            newTotal = Number((Number(editingInventoryItem.costPrice) * qty).toFixed(2));
          }
          setEditingInventoryItem({
            ...editingInventoryItem,
            quantity: qty,
            stock: qty,
            costPrice: newUnitCost,
            cost: newUnitCost,
            totalCost: newTotal
          });
        }}
        className="form-input"
        placeholder="e.g. 5000"
      />
    </div>
    <div className="form-group">
      <label htmlFor="edit-inv-minstock" className="form-label">Safety Minimum ({editingInventoryItem.unit || 'units'}) *</label>
      <input type="number" id="edit-inv-minstock" name="edit-inv-minstock" required value={editingInventoryItem.reorderLevel ?? ''} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, reorderLevel: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" placeholder="e.g. 20" />
    </div>
  </div>

  {/* Row 3: Total Cost (₹) + Unit Cost Price (₹) */}
  <div className="form-row">
    <div className="form-group">
      <label htmlFor="edit-inv-totalcost" className="form-label" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
        Total Amount Paid (₹)
      </label>
      <input
        type="number"
        step="any"
        min="0"
        id="edit-inv-totalcost"
        name="edit-inv-totalcost"
        value={editingInventoryItem.totalCost ?? ''}
        onChange={(e) => {
          const tot = e.target.value === '' ? '' : Number(e.target.value);
          const qty = Number(editingInventoryItem.quantity || editingInventoryItem.stock || 0);
          const computedUnitCost = (tot !== '' && qty > 0) ? Number((tot / qty).toFixed(4)) : (editingInventoryItem.costPrice || '');
          setEditingInventoryItem({
            ...editingInventoryItem,
            totalCost: tot,
            costPrice: computedUnitCost,
            cost: computedUnitCost
          });
        }}
        className="form-input"
        placeholder="e.g. 100 (Total bill for entire quantity)"
      />
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
        Total bill for entire stock (e.g. ₹100 for 5000g)
      </span>
    </div>

    <div className="form-group">
      <label htmlFor="edit-inv-cost" className="form-label">
        Unit Cost Price (₹ / {editingInventoryItem.unit || 'unit'}) *
      </label>
      <input
        type="number"
        step="any"
        min="0"
        id="edit-inv-cost"
        name="edit-inv-cost"
        required
        value={editingInventoryItem.costPrice ?? ''}
        onChange={(e) => {
          const unitP = e.target.value === '' ? '' : Number(e.target.value);
          const qty = Number(editingInventoryItem.quantity || editingInventoryItem.stock || 0);
          const computedTotal = (unitP !== '' && qty > 0) ? Number((unitP * qty).toFixed(2)) : (editingInventoryItem.totalCost || '');
          setEditingInventoryItem({
            ...editingInventoryItem,
            costPrice: unitP,
            cost: unitP,
            totalCost: computedTotal
          });
        }}
        className="form-input"
        placeholder="e.g. 0.02"
      />
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
        Auto-calculated per {editingInventoryItem.unit || 'unit'}
      </span>
    </div>
  </div>

  {/* Live calculation banner */}
  {Number(editingInventoryItem.quantity || 0) > 0 && Number(editingInventoryItem.costPrice || 0) > 0 && (
    <div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid #2ECC71', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px', color: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
      <span>✓ <strong>Calculated Cost:</strong> ₹{editingInventoryItem.costPrice} per {editingInventoryItem.unit || 'unit'}</span>
      <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>(₹{Number((Number(editingInventoryItem.costPrice) * Number(editingInventoryItem.quantity)).toFixed(2))} total for {editingInventoryItem.quantity} {editingInventoryItem.unit || 'units'})</span>
    </div>
  )}

  {/* Row 4: Category */}
  <div className="form-row">
    <div className="form-group" style={{ width: '100%' }}>
      <label htmlFor="edit-inv-category" className="form-label">Category *</label>
      <input type="text" id="edit-inv-category" name="edit-inv-category" required value={editingInventoryItem.category || 'Ingredients'} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, category: e.target.value })} className="form-input" placeholder="e.g. Tea Ingredients" />
    </div>
  </div>

  {/* Row 5: Supplier Name + Phone */}
  <div className="form-row">
    <div className="form-group">
      <label htmlFor="edit-inv-supplier" className="form-label">Supplier Name</label>
      <input type="text" id="edit-inv-supplier" name="edit-inv-supplier" value={editingInventoryItem.supplier || ''} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, supplier: e.target.value })} className="form-input" placeholder="e.g. Metro Cash & Carry (Optional)" />
    </div>
    <div className="form-group">
      <label htmlFor="edit-inv-supplier-phone" className="form-label">Supplier Phone Number</label>
      <input type="tel" id="edit-inv-supplier-phone" name="edit-inv-supplier-phone" value={editingInventoryItem.supplierPhone || ''} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, supplierPhone: e.target.value })} className="form-input" placeholder="e.g. 9876543210" />
    </div>
  </div>

</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditInventoryModal(false);setEditingInventoryItem(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }} disabled={isInventorySubmitting}>{isInventorySubmitting ? 'Saving...' : 'Save Changes'}</button>
</div>
</form>
</div>
</div>
 }

  {/* MODAL: + ADD INCOMING STOCK */}
  {showPurchaseModal &&
<div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
<div className="modal-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
<div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <div>
    <h3 className="modal-title" style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>+ Add Incoming Stock</h3>
    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Record incoming stock purchase & update live inventory</p>
  </div>
  <button onClick={() => setShowPurchaseModal(false)} className="modal-close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
</div>
<form onSubmit={handleRecordPurchase}>
<div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
  
  {/* Item Info Header */}
  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
    <div>
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ingredient</span>
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '15px' }}>
        {purchaseForm.itemName} {purchaseForm.unit ? `(${purchaseForm.unit})` : ''}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Stock</span>
      <div style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: '15px' }}>
        {purchaseForm.currentStock ?? 0} {purchaseForm.unit || 'units'}
      </div>
    </div>
  </div>

  <div className="form-row">
    <div className="form-group" style={{ flex: 1 }}>
      <label className="form-label" style={{ fontWeight: 700 }}>
        Quantity to Add (+) {purchaseForm.unit ? `(${purchaseForm.unit})` : ''} *
      </label>
      <input 
        type="number" 
        step="any"
        required 
        min="0.001" 
        placeholder="e.g. 5"
        value={purchaseForm.quantityAdded} 
        onChange={(e) => {
          const val = e.target.value;
          const qty = parseFloat(val);
          const unitCost = parseFloat(purchaseForm.costPrice);
          let newTotal = purchaseForm.totalCost;
          if (!isNaN(qty) && qty > 0 && !isNaN(unitCost) && unitCost >= 0) {
            newTotal = Number((qty * unitCost).toFixed(2));
          } else if (val === '') {
            newTotal = '';
          }
          setPurchaseForm(prev => ({ 
            ...prev, 
            quantityAdded: val,
            totalCost: newTotal 
          }));
        }} 
        className="form-input" 
      />
    </div>
    <div className="form-group" style={{ flex: 1 }}>
      <label className="form-label" style={{ fontWeight: 700 }}>
        Total Bill Paid (₹) <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(Optional)</span>
      </label>
      <input 
        type="number" 
        step="any" 
        min="0" 
        placeholder="e.g. 200" 
        value={purchaseForm.totalCost} 
        onChange={(e) => {
          const val = e.target.value;
          const total = parseFloat(val);
          const qty = parseFloat(purchaseForm.quantityAdded);
          let newUnitCost = purchaseForm.costPrice;
          if (!isNaN(total) && !isNaN(qty) && qty > 0) {
            newUnitCost = Number((total / qty).toFixed(4));
          }
          setPurchaseForm(prev => ({ 
            ...prev, 
            totalCost: val,
            costPrice: newUnitCost 
          }));
        }} 
        className="form-input" 
      />
    </div>
  </div>

  <div className="form-group">
    <label className="form-label" style={{ fontWeight: 700 }}>
      Cost Price per {purchaseForm.unit || 'Unit'} (₹) * 
      <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontWeight: 'normal', marginLeft: '6px' }}>
        (Auto-calculated from total bill / quantity)
      </span>
    </label>
    <input 
      type="number" 
      step="any" 
      required 
      min="0" 
      placeholder="e.g. 40.00" 
      value={purchaseForm.costPrice} 
      onChange={(e) => {
        const val = e.target.value;
        const unitCost = parseFloat(val);
        const qty = parseFloat(purchaseForm.quantityAdded);
        let newTotal = purchaseForm.totalCost;
        if (!isNaN(unitCost) && !isNaN(qty) && qty > 0) {
          newTotal = Number((qty * unitCost).toFixed(2));
        }
        setPurchaseForm(prev => ({ 
          ...prev, 
          costPrice: val,
          totalCost: newTotal 
        }));
      }} 
      className="form-input" 
    />
  </div>

  {/* Live Calculation Preview Banner */}
  {Number(purchaseForm.quantityAdded) > 0 && (
    <div style={{ 
      background: 'rgba(46, 204, 113, 0.12)', 
      border: '1px solid rgba(46, 204, 113, 0.35)', 
      borderRadius: '10px', 
      padding: '12px 16px', 
      display: 'flex', 
      flexDirection: 'column',
      gap: '4px'
    }}>
      <div style={{ color: '#27ae60', fontWeight: 800, fontSize: '13.5px' }}>
        🟢 New Total Stock will be: {Number(purchaseForm.currentStock || 0)} + {Number(purchaseForm.quantityAdded || 0)} = <strong>{(Number(purchaseForm.currentStock || 0) + Number(purchaseForm.quantityAdded || 0)).toFixed(2)} {purchaseForm.unit || 'units'}</strong>
      </div>
      {Number(purchaseForm.costPrice) >= 0 && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Total bill: ₹{(Number(purchaseForm.quantityAdded) * Number(purchaseForm.costPrice || 0)).toFixed(2)} (₹{Number(purchaseForm.costPrice || 0).toFixed(2)} / {purchaseForm.unit || 'unit'})
        </div>
      )}
    </div>
  )}

  <div className="form-group">
    <label className="form-label">Supplier Name</label>
    <input type="text" value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} className="form-input" placeholder="e.g. Metro Cash & Carry (Optional)" />
  </div>
  <div className="form-group">
    <label className="form-label">Notes</label>
    <textarea value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} className="form-input" rows="2" placeholder="e.g. Weekly restocking, invoice #412"></textarea>
  </div>
</div>
<div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
  <button type="button" onClick={() => setShowPurchaseModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px', background: '#27AE60', borderColor: '#27AE60', color: '#FFFFFF', fontWeight: 800 }}>+ Add Stock</button>
</div>
</form>
</div>
</div>
  }

  {/* MODAL: - REDUCE / ADJUST STOCK */}
  {showWastageModal &&
<div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
<div className="modal-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
<div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <div>
    <h3 className="modal-title" style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>- Reduce Stock</h3>
    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Manually adjust or correct stock count (Does NOT cut from sales profit)</p>
  </div>
  <button onClick={() => setShowWastageModal(false)} className="modal-close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
</div>
<form onSubmit={handleRecordWastage}>
<div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
  
  {/* Item Info Header */}
  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
    <div>
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ingredient</span>
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '15px' }}>
        {wastageForm.itemName} {wastageForm.unit ? `(${wastageForm.unit})` : ''}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Stock</span>
      <div style={{ color: '#E74C3C', fontWeight: 800, fontSize: '15px' }}>
        {wastageForm.currentStock ?? 0} {wastageForm.unit || 'units'}
      </div>
    </div>
  </div>

  <div className="form-row">
    <div className="form-group" style={{ flex: 1 }}>
      <label className="form-label" style={{ fontWeight: 700 }}>
        Quantity to Reduce (-) {wastageForm.unit ? `(${wastageForm.unit})` : ''} *
      </label>
      <input 
        type="number" 
        step="any"
        required 
        min="0.001" 
        placeholder="e.g. 0.5"
        value={wastageForm.quantityWasted} 
        onChange={(e) => setWastageForm({ ...wastageForm, quantityWasted: e.target.value })} 
        className="form-input" 
      />
    </div>
    <div className="form-group" style={{ flex: 1 }}>
      <label className="form-label" style={{ fontWeight: 700 }}>Reason Category *</label>
      <select 
        value={wastageForm.type} 
        onChange={(e) => setWastageForm({ ...wastageForm, type: e.target.value })} 
        className="form-input"
      >
        <option value="Adjustment">Manual Stock Correction (Count check)</option>
        <option value="Damaged">Damaged / Dropped / Spill</option>
        <option value="Wastage">Expired / Spoiled</option>
      </select>
    </div>
  </div>

  {/* Live Calculation Preview Banner */}
  {Number(wastageForm.quantityWasted) > 0 && (
    <div style={{ 
      background: 'rgba(231, 76, 60, 0.12)', 
      border: '1px solid rgba(231, 76, 60, 0.35)', 
      borderRadius: '10px', 
      padding: '12px 16px', 
      display: 'flex', 
      flexDirection: 'column',
      gap: '4px'
    }}>
      <div style={{ color: '#e74c3c', fontWeight: 800, fontSize: '13.5px' }}>
        🔴 New Total Stock will be: {Number(wastageForm.currentStock || 0)} - {Number(wastageForm.quantityWasted || 0)} = <strong>{Math.max(0, Number(wastageForm.currentStock || 0) - Number(wastageForm.quantityWasted || 0)).toFixed(2)} {wastageForm.unit || 'units'}</strong>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        ℹ️ Manual reductions correct inventory balance and do NOT deduct from your cafe sales profit.
      </div>
    </div>
  )}

  <div className="form-group">
    <label className="form-label">Adjustment Reason / Notes</label>
    <input 
      type="text" 
      value={wastageForm.reason} 
      onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })} 
      className="form-input" 
      placeholder="e.g. Corrected 1kg sugar to 500g after kitchen count" 
    />
  </div>
</div>
<div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
  <button type="button" onClick={() => setShowWastageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px', background: '#E74C3C', borderColor: '#E74C3C', color: '#FFFFFF', fontWeight: 800 }}>- Reduce Stock</button>
</div>
</form>
</div>
</div>
  }

 {/* MODAL 3: EDIT STAFF MEMBER */}
 {showEditStaffModal && editingStaff &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">✏️ Edit Staff Member</h3>
<button onClick={() =>{setShowEditStaffModal(false);setEditingStaff(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditStaff}>
<div className="modal-body">
<div className="form-row">
  <div className="form-group">
    <label className="form-label">Full Name *</label>
    <input type="text" required value={editingStaff.name || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, name: e.target.value })} className="form-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Login Username (@username) *</label>
    <input type="text" required value={editingStaff.username || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, username: e.target.value })} className="form-input" placeholder="e.g. ravi_waiter" />
  </div>
</div>
<div className="form-row">
  <div className="form-group">
    <label className="form-label">Phone Number *</label>
    <input type="text" required value={editingStaff.phone || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, phone: e.target.value })} className="form-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Email Address (Optional)</label>
    <input type="email" value={editingStaff.email || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, email: e.target.value })} className="form-input" placeholder="staff@cafe.com" />
  </div>
</div>
<div className="form-group" style={{ background: 'rgba(212, 127, 70, 0.08)', border: '1px dashed #D47F46', padding: '12px 14px', borderRadius: '10px' }}>
  <label className="form-label" style={{ color: '#D47F46', fontWeight: 700, marginBottom: '4px' }}>
    🔑 Set New Password (Optional)
  </label>
  <input 
    type="text" 
    value={editingStaff.newPassword || ''} 
    onChange={(e) =>setEditingStaff({ ...editingStaff, newPassword: e.target.value })} 
    className="form-input" 
    placeholder="Leave blank to keep current password unchanged"
    autoComplete="new-password"
  />
  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
    Minimum 6 characters. Enter a new password only if resetting.
  </span>
</div>
<div className="form-group">
<label className="form-label">Assigned Branch *</label>
<select value={editingStaff.assignedBranch || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, assignedBranch: e.target.value })} className="form-input" required>
<option value="">-- Choose Branch --</option>
 {branches.map((b) =>
<option key={b.branchId} value={b.branchId}>{b.branchName}</option>
)}
</select>
</div>
<div className="form-row">
  <div className="form-group">
    <label className="form-label">Daily Wage (₹) *</label>
    <input type="number" min="0" required value={editingStaff.dailyRate || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, dailyRate: Number(e.target.value) })} className="form-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Work Days / Wk *</label>
    <input type="number" min="1" max="7" required value={editingStaff.workDaysPerWeek !== undefined ? editingStaff.workDaysPerWeek : 6} onChange={(e) =>setEditingStaff({ ...editingStaff, workDaysPerWeek: Number(e.target.value) })} className="form-input" />
  </div>
</div>

<div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
  <div className="form-group">
    <label className="form-label">Shift Start *</label>
    <input type="time" required value={editingStaff.shiftStartTime || '09:00'} onChange={(e) =>setEditingStaff({ ...editingStaff, shiftStartTime: e.target.value })} className="form-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Shift End *</label>
    <input type="time" required value={editingStaff.shiftEndTime || '18:00'} onChange={(e) =>setEditingStaff({ ...editingStaff, shiftEndTime: e.target.value })} className="form-input" />
  </div>
  <div className="form-group">
    <label className="form-label">Grace (Mins) *</label>
    <input type="number" min="0" max="180" required value={editingStaff.leanTimeMinutes !== undefined ? editingStaff.leanTimeMinutes : 30} onChange={(e) =>setEditingStaff({ ...editingStaff, leanTimeMinutes: Number(e.target.value) })} className="form-input" />
  </div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Staff Role *</label>
<select value={editingStaff.staffRole ? editingStaff.staffRole.toLowerCase() : 'staff'} onChange={(e) =>setEditingStaff({ ...editingStaff, staffRole: e.target.value })} className="form-input">
<option value="staff">Staff</option>
</select>
</div>
<div className="form-group">
<label className="form-label">Status *</label>
<select value={editingStaff.isActive ? 'true' : 'false'} onChange={(e) =>setEditingStaff({ ...editingStaff, isActive: e.target.value === 'true' })} className="form-input">
<option value="true">Active</option>
<option value="false">Inactive</option>
</select>
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditStaffModal(false);setEditingStaff(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 3B: DIRECT RESET STAFF PASSWORD */}
 {resetModalStaff && (
  <div className="modal-overlay" style={{ zIndex: 9999 }}>
    <div className="modal-container" style={{ maxWidth: '420px', borderRadius: '16px', overflow: 'hidden' }}>
      <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border)', padding: '18px 24px' }}>
        <h3 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔑 Reset Staff Password
        </h3>
        <button onClick={() => setResetModalStaff(null)} className="modal-close">&times;</button>
      </div>
      <form onSubmit={handleDirectPasswordReset}>
        <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff Member</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {resetModalStaff.name}
            </div>
            <div style={{ fontSize: '12px', color: '#D47F46', fontWeight: 600, marginTop: '2px' }}>
              @{resetModalStaff.username || resetModalStaff.name.toLowerCase().replace(/\s+/g, '')} • {resetModalStaff.staffRole}
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showStaffPassToggle ? 'text' : 'password'}
                required
                value={newStaffPasswordInput}
                onChange={(e) => setNewStaffPasswordInput(e.target.value)}
                className="form-input"
                placeholder="Enter new password (min 6 chars)"
                style={{ paddingRight: '42px' }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowStaffPassToggle(!showStaffPassToggle)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px'
                }}
              >
                {showStaffPassToggle ? '🙈' : '👁️'}
              </button>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
              Staff member will use this new password immediately to sign in.
            </span>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setResetModalStaff(null)}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '9px 18px' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: 'auto', padding: '9px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={resetStaffLoading}
          >
            {resetStaffLoading ? 'Saving...' : 'Save Password'}
          </button>
        </div>
      </form>
    </div>
  </div>
 )}

  {/* MODAL 3C: RECORD MANUAL SALARY PAYMENT */}
  {paymentModalStaff && (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-container" style={{ maxWidth: '460px', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border)', padding: '18px 24px' }}>
          <h3 className="modal-title" style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#27ae60' }}>
            💸 Record Staff Salary Payment
          </h3>
          <button onClick={() => setPaymentModalStaff(null)} className="modal-close">&times;</button>
        </div>
        <form onSubmit={handleRecordPaymentSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ background: 'rgba(39, 174, 96, 0.08)', border: '1px solid rgba(39, 174, 96, 0.25)', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Recipient Staff</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {paymentModalStaff.name} ({paymentModalStaff.staffRole || paymentModalStaff.role})
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#e67e22', fontWeight: 700 }}>Due Balance</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#e67e22', marginTop: '2px' }}>
                    ₹{paymentModalStaff.remainingSalaryBalance !== undefined ? paymentModalStaff.remainingSalaryBalance : 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Disbursed Amount (₹) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="form-input"
                placeholder="e.g. 3000"
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Payment Mode *
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="form-input"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Notes / Reference <span style={{ opacity: 0.6 }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="form-input"
                placeholder="e.g. Weekly settlement via UPI / Cash"
              />
            </div>

          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setPaymentModalStaff(null)}
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '9px 18px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: 'auto', padding: '9px 24px', background: '#27ae60', borderColor: '#27ae60', color: '#fff', fontWeight: 700 }}
              disabled={paymentSubmitting}
            >
              {paymentSubmitting ? 'Recording...' : 'Confirm & Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

 {/* MODAL 4: ADD BRANCH */}
 {showAddBranchModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Add New Branch</h3>
<button onClick={() =>setShowAddBranchModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleAddBranch}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Branch Name *</label>
<input type="text" required value={newBranch.branchName} onChange={(e) =>setNewBranch({ ...newBranch, branchName: e.target.value })} className="form-input" placeholder="e.g. Uptown Branch" />
</div>
<div className="form-group">
<label className="form-label">Branch Code</label>
<input type="text" disabled readOnly value="Auto-generated on creation" className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Branch Address *</label>
<input type="text" required value={newBranch.address} onChange={(e) =>setNewBranch({ ...newBranch, address: e.target.value })} className="form-input" placeholder="123 Main Street" />
</div>
<div className="form-group">
<label className="form-label">Manager Name</label>
<input type="text" value={newBranch.manager} onChange={(e) =>setNewBranch({ ...newBranch, manager: e.target.value })} className="form-input" placeholder="Manager full name" />
</div>
<div className="form-group" style={{ marginBottom: '10px' }}>
<button
 type="button"
 onClick={() =>handleDetectLocation('new')}
 disabled={detectingLocation}
 style={{
 width: '100%',
 padding: '10px 14px',
 background: 'transparent',
 border: '1px dashed #ff6b08',
 borderRadius: '8px',
 color: '#ff6b08',
 cursor: detectingLocation ? 'wait' : 'pointer',
 fontWeight: 'bold',
 fontSize: '13px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px',
 transition: 'all 0.2s'
 }}
 onMouseOver={(e) =>{
 if (!detectingLocation) {
 e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)';
 }
 }}
 onMouseOut={(e) =>{
 e.currentTarget.style.background = 'transparent';
 }}>
 
 {detectingLocation ? ' Detecting current location...' : ' Use Current Location'}
</button>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Latitude *</label>
<input type="number" step="0.000001" required value={newBranch.latitude} onChange={(e) =>setNewBranch({ ...newBranch, latitude: e.target.value })} className="form-input" placeholder="e.g. 16.5062" />
</div>
<div className="form-group">
<label className="form-label">Longitude *</label>
<input type="number" step="0.000001" required value={newBranch.longitude} onChange={(e) =>setNewBranch({ ...newBranch, longitude: e.target.value })} className="form-input" placeholder="e.g. 80.6480" />
</div>
</div>
<div className="form-group">
<label className="form-label">Allowed Geofence Radius (meters) *</label>
<input type="number" min="1" required value={newBranch.allowedRadius} onChange={(e) =>setNewBranch({ ...newBranch, allowedRadius: Number(e.target.value) })} className="form-input" placeholder="e.g. 100" />
</div>
<div className="form-group">
<label className="form-label">Unified Staff Mode</label>
<select value={newBranch.unifiedStaffMode ? 'true' : 'false'} onChange={(e) =>setNewBranch({ ...newBranch, unifiedStaffMode: e.target.value === 'true' })} className="form-input">
<option value="false">Disabled (Normal Role Permissions)</option>
<option value="true">Enabled (Any employee can do any status step)</option>
</select>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">City *</label>
<input type="text" required value={newBranch.city || ''} onChange={(e) =>setNewBranch({ ...newBranch, city: e.target.value })} className="form-input" placeholder="e.g. Mangalagiri" />
</div>
<div className="form-group">
<label className="form-label">State *</label>
<input type="text" required value={newBranch.state || ''} onChange={(e) =>setNewBranch({ ...newBranch, state: e.target.value })} className="form-input" placeholder="e.g. Andhra Pradesh" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Pincode *</label>
<input type="text" required value={newBranch.pincode || ''} onChange={(e) =>setNewBranch({ ...newBranch, pincode: e.target.value })} className="form-input" placeholder="e.g. 522503" />
</div>
<div className="form-group">
<label className="form-label">Google Maps URL</label>
<input type="text" value={newBranch.googleMapsUrl || ''} onChange={(e) =>setNewBranch({ ...newBranch, googleMapsUrl: e.target.value })} className="form-input" placeholder="e.g. https://www.google.com/maps..." />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Opening Time *</label>
<input type="text" required value={newBranch.openingTime || '09:00 AM'} onChange={(e) =>setNewBranch({ ...newBranch, openingTime: e.target.value })} className="form-input" placeholder="e.g. 09:00 AM" />
</div>
<div className="form-group">
<label className="form-label">Closing Time *</label>
<input type="text" required value={newBranch.closingTime || '10:00 PM'} onChange={(e) =>setNewBranch({ ...newBranch, closingTime: e.target.value })} className="form-input" placeholder="e.g. 10:00 PM" />
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowAddBranchModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Create Branch</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 5: EDIT BRANCH */}
 {showEditBranchModal && editingBranch &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Branch Location</h3>
<button onClick={() =>{setShowEditBranchModal(false);setEditingBranch(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditBranch}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Branch Name *</label>
<input type="text" required value={editingBranch.branchName} onChange={(e) =>setEditingBranch({ ...editingBranch, branchName: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Branch Code</label>
<input type="text" disabled readOnly value={editingBranch.branchId || ''} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Branch Address *</label>
<input type="text" required value={editingBranch.address} onChange={(e) =>setEditingBranch({ ...editingBranch, address: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Manager Name</label>
<input type="text" value={editingBranch.manager || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, manager: e.target.value })} className="form-input" />
</div>
<div className="form-group" style={{ marginBottom: '10px' }}>
<button
 type="button"
 onClick={() =>handleDetectLocation('edit')}
 disabled={detectingLocation}
 style={{
 width: '100%',
 padding: '10px 14px',
 background: 'transparent',
 border: '1px dashed #ff6b08',
 borderRadius: '8px',
 color: '#ff6b08',
 cursor: detectingLocation ? 'wait' : 'pointer',
 fontWeight: 'bold',
 fontSize: '13px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px',
 transition: 'all 0.2s'
 }}
 onMouseOver={(e) =>{
 if (!detectingLocation) {
 e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)';
 }
 }}
 onMouseOut={(e) =>{
 e.currentTarget.style.background = 'transparent';
 }}>
 
 {detectingLocation ? ' Detecting current location...' : ' Use Current Location'}
</button>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Latitude *</label>
<input type="number" step="0.000001" required value={editingBranch.latitude || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, latitude: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Longitude *</label>
<input type="number" step="0.000001" required value={editingBranch.longitude || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, longitude: e.target.value })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Allowed Geofence Radius (meters) *</label>
<input type="number" min="1" required value={editingBranch.allowedRadius || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, allowedRadius: Number(e.target.value) })} className="form-input" placeholder="e.g. 100" />
</div>
<div className="form-group">
<label className="form-label">Status *</label>
<select value={editingBranch.isActive ? 'true' : 'false'} onChange={(e) =>setEditingBranch({ ...editingBranch, isActive: e.target.value === 'true' })} className="form-input" required>
<option value="true">Active</option>
<option value="false">Inactive</option>
</select>
</div>
</div>
<div className="form-row">
<div className="form-group" style={{ flex: 1 }}>
<label className="form-label">Unified Staff Mode</label>
<select value={editingBranch.unifiedStaffMode ? 'true' : 'false'} onChange={(e) =>setEditingBranch({ ...editingBranch, unifiedStaffMode: e.target.value === 'true' })} className="form-input">
<option value="false">Disabled (Normal Role Permissions)</option>
<option value="true">Enabled (Any employee can do any status step)</option>
</select>
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">City *</label>
<input type="text" required value={editingBranch.city || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, city: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">State *</label>
<input type="text" required value={editingBranch.state || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, state: e.target.value })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Pincode *</label>
<input type="text" required value={editingBranch.pincode || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, pincode: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Google Maps URL</label>
<input type="text" value={editingBranch.googleMapsUrl || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, googleMapsUrl: e.target.value })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Opening Time *</label>
<input type="text" required value={editingBranch.openingTime || '09:00 AM'} onChange={(e) =>setEditingBranch({ ...editingBranch, openingTime: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Closing Time *</label>
<input type="text" required value={editingBranch.closingTime || '10:00 PM'} onChange={(e) =>setEditingBranch({ ...editingBranch, closingTime: e.target.value })} className="form-input" />
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditBranchModal(false);setEditingBranch(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
</div>
</form>
</div>
</div>
 }

 {selectedReport &&
<div className="modal-overlay">
<div className="modal-container" style={{ maxWidth: '800px', width: '90%' }}>
<div className="modal-header">
<h3 className="modal-title">Work Report - {selectedReport.staffName}</h3>
<button onClick={() =>setSelectedReport(null)} className="modal-close">&times;</button>
</div>
<div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
 {/* Meta details */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', background: 'rgba(0, 0, 0,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '20px' }}>
<div>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Staff Member</span>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedReport.staffName}</strong>
</div>
<div>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Assigned Branch</span>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedReport.branchName}</strong>
</div>
<div>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Submitted Time</span>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
 {new Date(selectedReport.createdAt).toLocaleDateString()} at {new Date(selectedReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
</strong>
</div>
</div>

 {/* Notes */}
<div style={{ marginBottom: '24px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 700 }}>Description / Notes:</h4>
<p style={{
 backgroundColor: 'rgba(0,0,0,0.15)',
 padding: '12px 16px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 color: 'var(--color-text-secondary)',
 fontSize: '0.9rem',
 margin: 0,
 whiteSpace: 'pre-wrap',
 lineHeight: '1.5'
 }}>
 {selectedReport.notes || 'No description notes provided for this report.'}
</p>
</div>

 {/* Photos Grid */}
<div>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem', marginBottom: '12px', fontWeight: 700 }}>
  Photo Gallery ({selectedReport.photos.length} photos)
</h4>
<div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
 gap: '15px'
 }}>
 {selectedReport.photos.map((photo, idx) =>
<div key={idx} style={{
 borderRadius: '8px',
 overflow: 'hidden',
 border: '1px solid var(--color-border)',
 height: '180px',
 background: '#000',
 cursor: 'zoom-in',
 position: 'relative'
 }}
 onClick={() =>window.open(getAssetUrl(photo), '_blank')}>
 
<img
 src={getAssetUrl(photo)}
 alt={`Report ${idx + 1}`}
 style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
 onMouseEnter={(e) =>{e.currentTarget.style.transform = 'scale(1.05)';}}
 onMouseLeave={(e) =>{e.currentTarget.style.transform = 'scale(1)';}} />
 
<div style={{
 position: 'absolute',
 bottom: '6px',
 right: '6px',
 background: 'rgba(0,0,0,0.6)',
 color: 'var(--color-text-primary)',
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '10px',
 pointerEvents: 'none'
 }}>
 #{idx + 1}
</div>
</div>
)}
</div>
</div>
</div>
<div className="modal-footer" style={{ borderTop: '1px solid rgba(0, 0, 0,0.06)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
 Automatically purged after 24 hours.
</span>
<button
 type="button"
 onClick={() =>setSelectedReport(null)}
 className="btn btn-secondary"
 style={{ width: 'auto', padding: '8px 18px' }}>
 
 Close
</button>
</div>
</div>
</div>
 }

  {/* MODAL: OTHER EXPENSES MANAGEMENT */}
  {showExpenseModal && (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-container" style={{ maxWidth: '750px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'rgba(231, 76, 60, 0.12)', padding: '6px', borderRadius: '8px' }}>
              <Receipt size={20} color="#e74c3c" />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Other Expenses Management</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Track extra operational costs (Rent, Electricity, Maintenance) — automatically deducted from Net Profit</p>
            </div>
          </div>
          <button onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }} className="modal-close" style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
        </div>

        <div className="modal-body custom-scrollbar" style={{ overflowY: 'auto', padding: '16px 0', flex: 1 }}>
          {/* Summary Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Today's Expenses</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#e74c3c', marginTop: '4px' }}>₹{todayExpensesTotal.toFixed(2)}</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>This Month's Expenses</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#e74c3c', marginTop: '4px' }}>₹{monthlyExpensesTotal.toFixed(2)}</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total Records</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>{expenses.length}</div>
            </div>
          </div>

          {/* Add / Edit Expense Form */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {editingExpense ? '✏️ Edit Expense Record' : '+ Add New Expense'}
            </h4>
            <form onSubmit={editingExpense ? handleUpdateExpense : handleAddExpense}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Expense Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shop Rent, Electricity, Cleaning"
                    value={editingExpense ? editingExpense.title : newExpenseForm.title}
                    onChange={(e) => editingExpense ? setEditingExpense({ ...editingExpense, title: e.target.value }) : setNewExpenseForm({ ...newExpenseForm, title: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="0.00"
                    value={editingExpense ? editingExpense.amount : newExpenseForm.amount}
                    onChange={(e) => editingExpense ? setEditingExpense({ ...editingExpense, amount: e.target.value }) : setNewExpenseForm({ ...newExpenseForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Category (Select or Type Custom)</label>
                  <input
                    type="text"
                    list="expense-category-suggestions"
                    placeholder="Type or select category..."
                    value={editingExpense ? editingExpense.category : newExpenseForm.category}
                    onChange={(e) => editingExpense ? setEditingExpense({ ...editingExpense, category: e.target.value }) : setNewExpenseForm({ ...newExpenseForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                  />
                  <datalist id="expense-category-suggestions">
                    <option value="Rent" />
                    <option value="Utilities (Power, Gas, Water)" />
                    <option value="Staff Salary / Advance" />
                    <option value="Supplies / Packaging" />
                    <option value="Maintenance & Repairs" />
                    <option value="Cleaning & Hygiene" />
                    <option value="Marketing / Promo" />
                    <option value="Raw Materials / Groceries" />
                    <option value="Dairy / Ice Cream" />
                    <option value="Fuel / Travel" />
                    <option value="Miscellaneous" />
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Date</label>
                  <input
                    type="date"
                    value={editingExpense ? (editingExpense.date ? new Date(editingExpense.date).toISOString().split('T')[0] : '') : newExpenseForm.date}
                    onChange={(e) => editingExpense ? setEditingExpense({ ...editingExpense, date: e.target.value }) : setNewExpenseForm({ ...newExpenseForm, date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Notes / Remarks (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid to electricity board"
                    value={editingExpense ? (editingExpense.notes || '') : (newExpenseForm.notes || '')}
                    onChange={(e) => editingExpense ? setEditingExpense({ ...editingExpense, notes: e.target.value }) : setNewExpenseForm({ ...newExpenseForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {editingExpense && (
                  <button
                    type="button"
                    onClick={() => setEditingExpense(null)}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '7px 14px', fontSize: '12px' }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '7px 18px', fontSize: '12px', fontWeight: 700 }}
                >
                  {expenseSubmitting ? 'Saving...' : editingExpense ? 'Update Expense' : '+ Record Expense'}
                </button>
              </div>
            </form>
          </div>

          {/* Expenses List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Recorded Expenses History</h4>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setExpenseDateFilter('all')}
                  style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--color-border)', cursor: 'pointer', background: expenseDateFilter === 'all' ? 'var(--color-primary)' : 'var(--bg-secondary)', color: expenseDateFilter === 'all' ? '#fff' : 'var(--color-text-secondary)' }}
                >
                  All
                </button>
                <button
                  onClick={() => setExpenseDateFilter('today')}
                  style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--color-border)', cursor: 'pointer', background: expenseDateFilter === 'today' ? 'var(--color-primary)' : 'var(--bg-secondary)', color: expenseDateFilter === 'today' ? '#fff' : 'var(--color-text-secondary)' }}
                >
                  Today
                </button>
                <button
                  onClick={() => setExpenseDateFilter('month')}
                  style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--color-border)', cursor: 'pointer', background: expenseDateFilter === 'month' ? 'var(--color-primary)' : 'var(--bg-secondary)', color: expenseDateFilter === 'month' ? '#fff' : 'var(--color-text-secondary)' }}
                >
                  This Month
                </button>
              </div>
            </div>

            {expensesLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                No expenses recorded yet. Use the form above to record your first expense.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Title</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Category</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses
                      .filter((e) => {
                        if (expenseDateFilter === 'today') {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          return new Date(e.date || e.createdAt) >= start;
                        }
                        if (expenseDateFilter === 'month') {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                          return new Date(e.date || e.createdAt) >= start;
                        }
                        return true;
                      })
                      .map((item) => (
                        <tr key={item._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                            {new Date(item.date || item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                            {item.title}
                            {item.notes && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{item.notes}</div>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                              {item.category}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#e74c3c' }}>
                            -₹{Number(item.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => setEditingExpense(item)}
                                style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '11px' }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(item._id)}
                                style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: '#e74c3c', fontSize: '11px' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 18px', fontSize: '13px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )}

  {/* MODAL: PURCHASES & DAILY CASH REGISTER */}
  {showPurchaseRegisterModal && (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-container" style={{ maxWidth: '700px', width: '92%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'rgba(39, 174, 96, 0.15)', padding: '6px', borderRadius: '8px' }}>
              <Wallet size={20} color="#27ae60" />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Purchases & Daily Cash Register</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Daily cash drawer ledger — deducts raw material stock purchases from physical cash in hand</p>
            </div>
          </div>
          <button onClick={() => setShowPurchaseRegisterModal(false)} className="modal-close" style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
        </div>

        <div className="modal-body custom-scrollbar" style={{ overflowY: 'auto', padding: '16px 0', flex: 1 }}>
          {/* Target Date Picker */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Register Date:</span>
            <input
              type="date"
              value={cashRegisterDate}
              onChange={(e) => {
                setCashRegisterDate(e.target.value);
                fetchCashRegisterData(e.target.value);
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--bg-primary)', color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 600 }}
            />
          </div>

          {/* Real-time Calculation Result Card */}
          {(() => {
            const yCash = Number(cashRegisterForm.yesterdayCash) || 0;
            const tCash = Number(cashRegisterForm.todayCash) || 0;
            const purchases = Number(cashRegisterForm.purchasesAmount) || 0;
            const netCash = (yCash + tCash) - purchases;
            return (
              <div style={{ background: 'linear-gradient(135deg, rgba(39,174,96,0.12), rgba(46,204,113,0.06))', border: '1px solid rgba(39,174,96,0.3)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#27ae60' }}>Net Closing Cash in Hand</span>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: netCash >= 0 ? '#27ae60' : '#e74c3c', marginTop: '2px' }}>
                      ₹{netCash.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    Formula: (₹{yCash} + ₹{tCash}) - <strong style={{ color: '#e74c3c' }}>₹{purchases}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Form Inputs */}
          <form onSubmit={handleSaveCashRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Yesterday's Cash in Hand (₹)</label>
                  {yesterdayCashSales > 0 && (
                    <button
                      type="button"
                      onClick={() => setCashRegisterForm((prev) => ({ ...prev, yesterdayCash: yesterdayCashSales }))}
                      style={{ background: 'rgba(52,152,219,0.15)', color: '#2980b9', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                      title="Sync from yesterday's completed cash orders"
                    >
                      ⚡ Auto-fill ₹{yesterdayCashSales.toFixed(0)}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={cashRegisterForm.yesterdayCash}
                  onChange={(e) => setCashRegisterForm({ ...cashRegisterForm, yesterdayCash: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-secondary)', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 700 }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Today's Cash Collection (₹)</label>
                  {todayCashSales > 0 && (
                    <button
                      type="button"
                      onClick={() => setCashRegisterForm((prev) => ({ ...prev, todayCash: todayCashSales }))}
                      style={{ background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                      title="Sync from today's completed cash orders"
                    >
                      ⚡ Auto-fill ₹{todayCashSales.toFixed(0)}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={cashRegisterForm.todayCash}
                  onChange={(e) => setCashRegisterForm({ ...cashRegisterForm, todayCash: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-secondary)', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 700 }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Bank / UPI Balance (₹)</label>
                  {todayOnlineSales > 0 && (
                    <button
                      type="button"
                      onClick={() => setCashRegisterForm((prev) => ({ ...prev, bankBalance: todayOnlineSales }))}
                      style={{ background: 'rgba(155,89,182,0.15)', color: '#9b59b6', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                      title="Sync from today's completed online/UPI orders"
                    >
                      ⚡ Auto-fill ₹{todayOnlineSales.toFixed(0)}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={cashRegisterForm.bankBalance}
                  onChange={(e) => setCashRegisterForm({ ...cashRegisterForm, bankBalance: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-secondary)', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#e74c3c', display: 'block', marginBottom: '4px' }}>Today Total Stock Purchased (₹) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={cashRegisterForm.purchasesAmount}
                  onChange={(e) => setCashRegisterForm({ ...cashRegisterForm, purchasesAmount: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.4)', background: 'var(--bg-secondary)', color: '#e74c3c', fontSize: '14px', fontWeight: 800 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Stock Purchased Items (Quick Notes)</label>
                <input
                  type="text"
                  placeholder="e.g. Milk 20L, Ginger, Tea leaves, Disposable cups"
                  value={cashRegisterForm.purchasesNote}
                  onChange={(e) => setCashRegisterForm({ ...cashRegisterForm, purchasesNote: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-secondary)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>General Day Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Evening rain caused rush, extra ice purchased"
                  value={cashRegisterForm.notes}
                  onChange={(e) => setCashRegisterForm({ ...cashRegisterForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--bg-secondary)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <button
                type="submit"
                disabled={cashRegisterSubmitting}
                className="btn btn-primary"
                style={{ width: 'auto', padding: '9px 24px', fontWeight: 800, fontSize: '13px', background: '#27ae60', border: 'none' }}
              >
                {cashRegisterSubmitting ? 'Saving...' : '💾 Save Daily Register'}
              </button>
            </div>
          </form>

          {/* Last 7 Days History Table */}
          {cashRegisterHistory.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Past 7 Days Register History</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Yesterday Cash</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Today Cash</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Stock Purchased</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700, textAlign: 'right' }}>Closing Net Cash</th>
                      <th style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontWeight: 700, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRegisterHistory.map((rec) => (
                      <tr key={rec._id || rec.date} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{rec.date}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>₹{(Number(rec.yesterdayCash) || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', color: '#27ae60', fontWeight: 600 }}>+₹{(Number(rec.todayCash) || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', color: '#e74c3c', fontWeight: 600 }}>
                          -₹{(Number(rec.purchasesAmount) || 0).toFixed(2)}
                          {rec.purchasesNote && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{rec.purchasesNote}</div>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: (Number(rec.netCashInHand) || 0) >= 0 ? '#27ae60' : '#e74c3c' }}>
                          ₹{(Number(rec.netCashInHand) || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteCashRegister(rec._id, rec.date)}
                            style={{
                              background: 'rgba(231,76,60,0.1)',
                              border: '1px solid #e74c3c',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              color: '#e74c3c',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                            title={`Delete record for ${rec.date}`}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowPurchaseRegisterModal(false)}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 18px', fontSize: '13px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )}

</div>
</OwnerLayout>);

};

export default OwnerDashboard;