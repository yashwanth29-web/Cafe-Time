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
 getSetupData,
 saveSetupData,
 getInventory,
 createInventoryItem,
 updateInventoryItem,
 deleteInventoryItem,
 getInventoryLogs,
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
 getSalaryHistory } from
'../services/api';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import socket, { connectSocket } from '../socket';
import OwnerLayout from '../components/OwnerLayout';
import { TrendingUp, TrendingDown, IndianRupee, Package, BarChart3 } from 'lucide-react';
import * as XLSX from 'xlsx';

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

const AdminMenuCard = React.memo(({ item, onEdit, onDelete }) => {
  return (
    <div className={`admin-menu-card ${!item.available ? 'unavailable' : ''}`}>
      <AdminMenuImage item={item} />
      <div className="admin-menu-info">
        <div className="admin-menu-title">{item.name}</div>
        <div className="admin-menu-desc">{item.description}</div>
        <div className="admin-menu-meta">
          <span className="admin-menu-price">₹{parseFloat(item.price).toFixed(2)}</span>
          <div className="menu-card-actions">
            <button onClick={() => onEdit(item)} className="btn btn-secondary menu-card-btn">✏️<span className="btn-text"> Edit</span></button>
            <button onClick={() => onDelete(item._id)} className="btn btn-secondary menu-card-btn" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>🗑️<span className="btn-text"> Del</span></button>
          </div>
        </div>
      </div>
    </div>
  );
});

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
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginTop: '2px' }}>{item.category || 'Ingredients'}</div>
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
      <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid rgba(0, 0, 0,0.06)', paddingTop: '10px' }}>
        <button
          onClick={() => onPurchase(item)}
          style={{ flex: 1, background: 'rgba(46,204,113,0.1)', color: '#2ECC71', border: '1px solid #2ECC71', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
          Purchase</button>
        <button
          onClick={() => onWastage(item)}
          style={{ flex: 1, background: 'rgba(231,76,60,0.1)', color: '#E74C3C', border: '1px solid #E74C3C', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
          Wastage</button>
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
      <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{item.category || 'Ingredients'}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isLow ? '#E74C3C' : 'var(--color-text-primary)' }}>{qtyVal} {item.unit}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
        <span style={{ backgroundColor: `${statusColor}1A`, border: `1px solid ${statusColor}`, color: statusColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
          {qtyVal <= 0 ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'IN_STOCK'}
        </span>
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{costPriceVal?.toFixed(2)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(item.sellingPrice || 0).toFixed(2)}</td>
      <td style={{ padding: '10px 8px' }}>{item.supplier || 'N/A'}</td>
      <td style={{ padding: '10px 8px' }}>{item.branch || 'Main'}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{reorderVal} {item.unit}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          <button onClick={() => onPurchase(item)} style={{ background: '#27AE60', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Purchase</button>
          <button onClick={() => onWastage(item)} style={{ background: '#E74C3C', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Wastage</button>
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

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState(() => {
    const tab = tabParam || location.state?.activeTab || 'analytics';
    if (tab === 'reviews') return 'menu';
    if (tab === 'attendance') return 'staff';
    if (tab === 'reports' || tab === 'financial_reports') return 'reports';
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

  const handlePurchaseInventoryCallback = useCallback((item) => {
    const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;
    setPurchaseForm({
      itemId: item._id,
      itemName: item.name,
      quantityAdded: 0,
      costPrice: costPriceVal,
      supplier: item.supplier || '',
      notes: ''
    });
    setShowPurchaseModal(true);
  }, []);

  const handleWastageInventoryCallback = useCallback((item) => {
    setWastageForm({
      itemId: item._id,
      itemName: item.name,
      quantityWasted: 0,
      type: 'Wastage',
      reason: ''
    });
    setShowWastageModal(true);
  }, []);

  const handleEditInventoryCallback = useCallback((item) => {
    setEditingInventoryItem({ ...item });
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
    return 'roster';
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
    return tabParam === 'financial_reports' ? 'financial_summary' : 'revenue';
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

  const loadReportData = async (isSilent = false) => {
    if (!isSilent) if (!isSilent) setReportLoading(true);
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
      } else if (reportDateRange === 'this_year') {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        start = startOfYear.toISOString().split('T')[0];
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
  const [reportsLoading, setReportsLoading] = useState(() => {
    const activeId = localStorage.getItem('activeBranchId') || 'all';
    return !getBranchCache(activeId).hasLoaded.workReports;
  });
  const [reportsError, setReportsError] = useState('');
 const [reportsFilterRange, setReportsFilterRange] = useState('today'); // 'today', 'this_week', 'all'
 const [reportsFilterStaff, setReportsFilterStaff] = useState('');
 const [reportsFilterBranch, setReportsFilterBranch] = useState('');
 const [selectedReport, setSelectedReport] = useState(null);
 const [salarySearchQuery, setSalarySearchQuery] = useState('');
 const [salaryRoleFilter, setSalaryRoleFilter] = useState('');

 // Form / Dialog States
 const [showAddModal, setShowAddModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showEditStaffModal, setShowEditStaffModal] = useState(false);
 const [showAddStaffModal, setShowAddStaffModal] = useState(false);
 const [editingStaff, setEditingStaff] = useState(null);
 const [editingItem, setEditingItem] = useState(null);
 const [expandedStaffId, setExpandedStaffId] = useState(null);
 const [selectedSalaryStaff, setSelectedSalaryStaff] = useState(null);
 const [showSalaryDetailModal, setShowSalaryDetailModal] = useState(false);
 const [editingWageId, setEditingWageId] = useState(null);
 const [tempWage, setTempWage] = useState(0);

 // New staff input state
 const [newStaff, setNewStaff] = useState({
 name: '',
 email: '',
 phone: '',
 staffRole: 'waiter',
 assignedBranch: '',
 dailyRate: 0
 });

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
 stock: 0,
 reorderLevel: 0,
 minStock: 0,
 unit: '',
 costPrice: 0,
 cost: 0,
 sellingPrice: 0,
 supplier: '',
 branch: 'Main',
 category: 'Ingredients'
 });
 const [showPurchaseModal, setShowPurchaseModal] = useState(false);
 const [showWastageModal, setShowWastageModal] = useState(false);
 const [purchaseForm, setPurchaseForm] = useState({
 itemId: '',
 itemName: '',
 quantityAdded: 0,
 costPrice: 0,
 supplier: '',
 notes: ''
 });
 const [wastageForm, setWastageForm] = useState({
 itemId: '',
 itemName: '',
 quantityWasted: 0,
 type: 'Wastage',
 reason: ''
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

 // Search states
 const [menuSearch, setMenuSearch] = useState('');
 const [inventorySearch, setInventorySearch] = useState('');

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) =>
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(menuSearch.toLowerCase())
    );
  }, [menuItems, menuSearch]);

  const filteredInventoryList = useMemo(() => {
    return inventoryList.filter((item) =>
      item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(inventorySearch.toLowerCase())
    );
  }, [inventoryList, inventorySearch]);

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

 const presetCategories = [
 'Signature Chai',
 'Coffee Selection',
 'Fresh Juices & Coolers',
 'Thick Milkshakes',
 'Starters & Bites',
 'French Fries'];

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
      if (targetBranchId !== activeBranchIdRef.current) return;
      if (response.success) {
        const mappedData = response.data.map(item => ({ ...item, id: item._id || item.id }));
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
      if (targetBranchId === activeBranchIdRef.current) {
        setMenuLoading(false);
      }
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
 setCategories([...categories, response.data]);
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

 const handleUpdateCategory = async (e) =>{
 e.preventDefault();
 if (!editingCategory || !categoryNameInput.trim()) return;
 try {
 const response = await updateCategory(editingCategory._id, { name: categoryNameInput });
 if (response.success) {
 setCategories(categories.map((c) =>c._id === editingCategory._id ? response.data : c));
 // Update menu items in local state
 setMenuItems(menuItems.map((item) =>item.category === editingCategory.name ? { ...item, category: response.data.name } : item));
 setEditingCategory(null);
 setCategoryNameInput('');
 alert('Category updated successfully!');
 } else {
 alert(response.message || 'Failed to update category.');
 }
 } catch (err) {
 console.error(err);
 alert(err.response?.data?.message || 'Error updating category.');
 }
 };

 const handleDeleteCategory = async (catId) =>{
 if (!window.confirm('Are you sure you want to delete this category? All menu items in this category will be moved to Uncategorized.')) return;
 try {
 const categoryToDelete = categories.find((c) =>c._id === catId);
 const response = await deleteCategory(catId);
 if (response.success) {
 setCategories(categories.filter((c) =>c._id !== catId));
 if (categoryToDelete) {
 setMenuItems(menuItems.map((item) =>item.category === categoryToDelete.name ? { ...item, category: 'Uncategorized' } : item));
 }
 alert('Category deleted successfully.');
 } else {
 alert(response.message || 'Failed to delete category.');
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
 if (sourceIndex === targetIndex) return;

 const updated = [...categories];
 const [dragged] = updated.splice(sourceIndex, 1);
 updated.splice(targetIndex, 0, dragged);

 // Optimistic UI update
 setCategories(updated);

 try {
 const orderedIds = updated.map((c) =>c._id);
 await reorderCategories(orderedIds);
 } catch (err) {
 console.error('Error reordering categories:', err);
 alert('Failed to save category order.');
 fetchCategories();
 }
 };

 const moveCategory = async (index, direction) =>{
 const updated = [...categories];
 if (direction === 'up' && index >0) {
 const temp = updated[index];
 updated[index] = updated[index - 1];
 updated[index - 1] = temp;
 } else if (direction === 'down' && index< updated.length - 1) {
 const temp = updated[index];
 updated[index] = updated[index + 1];
 updated[index + 1] = temp;
 } else {
 return;
 }

 // Optimistic UI update
 setCategories(updated);

 try {
 const orderedIds = updated.map((c) =>c._id);
 await reorderCategories(orderedIds);
 } catch (err) {
 console.error('Error reordering categories:', err);
 alert('Failed to save category order.');
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

      const prRes = await getPayrollList({ employeeId: staffId, weekStart, weekEnd });
      if (prRes.success && prRes.data && prRes.data.length > 0) {
        const payrollId = prRes.data[0]._id;
        const approveRes = await approvePayroll(payrollId);
        if (approveRes.success) {
          alert('Payroll approved successfully.');
          fetchStaffList();
        }
      } else {
        alert('Weekly payroll has not been generated for this staff member yet. Please click "Generate Payroll" first.');
      }
    } catch (err) {
      console.error('Error approving payroll:', err);
      alert('Error approving payroll: ' + (err.response?.data?.message || err.message));
    }
  };

  const handlePayPayroll = async (staffId) => {
    const method = prompt('Enter payment method (e.g. Cash, Bank Transfer, UPI):', 'UPI');
    if (!method) return;
    const remarks = prompt('Enter payment remarks (optional):', 'Paid');

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

      const prRes = await getPayrollList({ employeeId: staffId, weekStart, weekEnd });
      if (prRes.success && prRes.data && prRes.data.length > 0) {
        const payrollId = prRes.data[0]._id;
        const payRes = await payPayroll(payrollId, { paymentMethod: method, remarks });
        if (payRes.success) {
          alert('Payroll marked as Paid successfully.');
          fetchStaffList();
          fetchSalaryHistory();
        }
      } else {
        alert('Weekly payroll has not been generated for this staff member yet.');
      }
    } catch (err) {
      console.error('Error paying payroll:', err);
      alert('Error paying payroll: ' + (err.response?.data?.message || err.message));
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

  const fetchWorkReports = async (isSilent = false, targetBranchId = activeBranchId) =>{
    const cache = getBranchCache(targetBranchId);
    if (!isSilent && !cache.hasLoaded.workReports) setReportsLoading(true);
    setReportsError('');
    try {
      const params = {};
      if (reportsFilterRange) params.range = reportsFilterRange;
      if (reportsFilterStaff) params.staffId = reportsFilterStaff;
      if (reportsFilterBranch) params.branchId = reportsFilterBranch;

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
        dailyRate: Number(newStaff.dailyRate || 0)
      });
      if (response.success) {
        alert(response.message || `Staff member "${newStaff.name}" registered successfully.`);
        setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '', dailyRate: 0 });
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
 const response = await updateStaff(editingStaff._id, {
 name: editingStaff.name,
 email: editingStaff.email,
 phone: editingStaff.phone,
 staffRole: editingStaff.staffRole,
 assignedBranch: editingStaff.assignedBranch,
 isActive: editingStaff.isActive,
 dailyRate: Number(editingStaff.dailyRate || 0)
 });
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
  const headers = ['Employee ID', 'Name', 'Role', 'Email', 'Phone', 'Branch', 'Salary Type', 'Daily Wage', 'Weekly Wage', 'Monthly Wage', 'Current Week Salary', 'Orders Today', 'Status', 'Joined Date'];
  const csvRows = [headers.join(',')];
  staff.forEach(member => {
    const branchName = branches.find(b => b.branchId === member.assignedBranch)?.branchName || 'Unassigned';
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
      member.currentWeekSalary || 0,
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
    if (!newBranch.branchId || !newBranch.branchId.trim()) {
      alert('Branch Code is required.');
      return;
    }
    if (newBranch.branchId.trim().toLowerCase() === 'default') {
      alert('Branch Code cannot be "default".');
      return;
    }
    if (!newBranch.branchName || !newBranch.address) {
      alert('Branch Name and Address are required.');
      return;
    }
    try {
      const res = await createBranch({
        branchId: newBranch.branchId.trim(),
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
    if (!editingBranch.branchId || !editingBranch.branchId.trim()) {
      alert('Branch Code is required.');
      return;
    }
    if (editingBranch.branchId.trim().toLowerCase() === 'default') {
      alert('Branch Code cannot be "default".');
      return;
    }
    if (!editingBranch.branchName || !editingBranch.address) {
      alert('Branch Name and Address are required.');
      return;
    }
    try {
      const res = await updateBranch(editingBranch._id, {
        branchId: editingBranch.branchId.trim(),
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
 const updatedStatus = !item.available;
 try {
 const response = await updateMenuItem(item._id, { available: updatedStatus });
 if (response.success) {
 setMenuItems((prevItems) =>
 prevItems.map((m) =>m._id === item._id ? { ...m, available: updatedStatus } : m)
);
 }
 } catch (error) {
 console.error('Error toggling availability:', error);
 }
 };

 // Delete menu item
  const handleDeleteMenuItem = async (id) =>{
    if (isMenuSubmitting) return;
    if (window.confirm('Are you sure you want to remove this menu item?')) {
      setIsMenuSubmitting(true);
      try {
        const response = await deleteMenuItem(id);
        if (response.success) {
          setMenuItems((prevItems) =>prevItems.filter((item) =>item._id !== id));
        }
      } catch (error) {
        console.error('Error deleting item:', error);
      } finally {
        setIsMenuSubmitting(false);
      }
    }
  };

  // Add menu item
  const handleAddMenuItem = async (e) =>{
    e.preventDefault();
    if (isMenuSubmitting) return;
    if (!newItem.name || !newItem.price || !newItem.category || !newItem.description) {
      alert('Please fill out all required fields.');
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const response = await createMenuItem(newItem);
      if (response.success) {
        setMenuItems((prevItems) => [...prevItems, response.data]);
        setShowAddModal(false);
        setNewItem({
          name: '',
          price: '',
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
    if (!editingItem.name || !editingItem.price || !editingItem.category || !editingItem.description) {
      alert('Please fill out all required fields.');
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const response = await updateMenuItem(editingItem._id, editingItem);
      if (response.success) {
        setMenuItems((prevItems) =>
          prevItems.map((m) => m._id === editingItem._id ? response.data : m)
        );
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
 const response = await createInventoryItem(newInventoryItem);
 if (response.success) {
 setInventoryList((prev) =>[...prev, response.data]);
 setShowAddInventoryModal(false);
 setNewInventoryItem({
 name: '',
 quantity: 0,
 stock: 0,
 reorderLevel: 0,
 minStock: 0,
 unit: '',
 costPrice: 0,
 cost: 0,
 sellingPrice: 0,
 supplier: '',
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
 const response = await updateInventoryItem(editingInventoryItem._id, editingInventoryItem);
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
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Error deleting inventory item');
    } finally {
      setIsInventorySubmitting(false);
    }
  };

 const handleRecordPurchase = async (e) =>{
 e.preventDefault();
 try {
 const response = await recordPurchase({
 itemId: purchaseForm.itemId,
 quantityAdded: Number(purchaseForm.quantityAdded),
 costPrice: Number(purchaseForm.costPrice),
 supplier: purchaseForm.supplier,
 notes: purchaseForm.notes
 });
 if (response.success) {
 alert('Purchase recorded successfully.');
 setShowPurchaseModal(false);
 fetchInventoryList(); // reload all stats & logs
 }
 } catch (error) {
 console.error('Error recording purchase:', error);
 alert(error.response?.data?.message || 'Error recording purchase');
 }
 };

 const handleRecordWastage = async (e) =>{
 e.preventDefault();
 try {
 const response = await recordWastage({
 itemId: wastageForm.itemId,
 quantityWasted: Number(wastageForm.quantityWasted),
 type: wastageForm.type,
 reason: wastageForm.reason
 });
 if (response.success) {
 alert('Wastage recorded successfully.');
 setShowWastageModal(false);
 fetchInventoryList(); // reload all stats & logs
 }
 } catch (error) {
 console.error('Error recording wastage:', error);
 alert(error.response?.data?.message || 'Error recording wastage');
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
  const completedOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === 'Paid' && o.status === 'Completed');
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

  const totalInventoryValue = useMemo(() => {
    return inventoryList.reduce((acc, item) => 
      acc + (item.quantity !== undefined ? item.quantity : item.stock) * (item.costPrice !== undefined ? item.costPrice : item.cost), 
      0
    );
  }, [inventoryList]);

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
    if (statsData && statsData.totalInventoryConsumption !== undefined) {
      return statsData.totalInventoryConsumption;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthDeductions = deductionLogs.filter((log) => new Date(log.createdAt) >= startOfMonth);
    return thisMonthDeductions.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [deductionLogs, statsData]);

  const rankedItems = useMemo(() => {
    if (statsData) {
      return {
        topSelling: statsData.topSellingItems || [],
        slowSelling: statsData.slowSellingItems || []
      };
    }
    const itemCounts = {};
    completedOrders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const name = item.name || 'Unknown Item';
          const qty = item.quantity || 0;
          const price = item.price || 0;
          if (!itemCounts[name]) {
            itemCounts[name] = { name, quantity: 0, revenue: 0 };
          }
          itemCounts[name].quantity += qty;
          itemCounts[name].revenue += qty * price;
        });
      }
    });
    const sorted = Object.values(itemCounts).sort((a, b) => b.quantity - a.quantity);
    const topSelling = sorted.slice(0, 5);
    const slowSelling = sorted.length > 5 
      ? sorted.slice(sorted.length - 5).reverse()
      : sorted.slice(0).reverse();
    return { topSelling, slowSelling };
  }, [completedOrders, statsData]);

  const { topSelling, slowSelling } = rankedItems;

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
        setActiveTab('reports');
        if (tabParam === 'financial_reports') setReportType('financial_summary');
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
    if (activeTab === 'staff' && staffSubTab === 'attendance') {
      fetchAttendanceReportsData();
    }
  }, [reportRange, reportBranch, activeTab, staffSubTab]);

  useEffect(() => {
    if (activeTab === 'staff' && staffSubTab === 'reports') {
      fetchWorkReports();
      fetchStaffList();
    }
  }, [reportsFilterRange, reportsFilterStaff, reportsFilterBranch, activeTab, staffSubTab]);

  useEffect(() => {
    if (!user || !user.cafeId) return;

    loadSetupConfig();

    const targetBranch = activeBranchId;
    const cache = getBranchCache(targetBranch);

    const refreshData = async () => {
      if (activeTab === 'analytics') {
        const silent = !!cache.hasLoaded.statsData;
        await Promise.all([
          fetchDashboardStats(silent, targetBranch),
          fetchInventoryList(silent, targetBranch),
          fetchCategories(silent, targetBranch),
          fetchInventoryCategories(silent, targetBranch)
        ]);
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
        await fetchStaffList(silent, targetBranch);
        if (staffSubTab === 'attendance') {
          await fetchAttendanceToday(silent, targetBranch);
        } else if (staffSubTab === 'reports') {
          await fetchWorkReports(silent, targetBranch);
        }
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
      connectSocket(user.cafeId, activeBranchId === 'all' ? null : activeBranchId);

      const handleOrderCreated = (newOrder) => {
        setOrders(prev => {
          if (prev.some(o => o._id === newOrder._id)) return prev;
          if (activeBranchId && activeBranchId !== 'all' && newOrder.branchId !== activeBranchId) {
            return prev;
          }
          const updated = [newOrder, ...prev];
          cache.orders = updated;
          return updated;
        });
        fetchDashboardStats(true, activeBranchId);
      };

      const handleOrderUpdated = (updatedOrder) => {
        setOrders(prev => {
          let updated;
          if (activeBranchId && activeBranchId !== 'all' && updatedOrder.branchId !== activeBranchId) {
            updated = prev.filter(o => o._id !== updatedOrder._id);
          } else {
            updated = prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
          }
          cache.orders = updated;
          return updated;
        });
        fetchDashboardStats(true, activeBranchId);
      };

      const handleMenuUpdated = () => {
        fetchMenu(true, activeBranchId);
        fetchCategories(true, activeBranchId);
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
      socket.on('order_updated', handleOrderUpdated);
      socket.on('menu_updated', handleMenuUpdated);
      socket.on('dashboard_realtime_sync', handleRealtimeSync);
      socket.on('inventory_updated', handleInventoryUpdated);
      socket.on('staff_updated', handleStaffUpdated);
      socket.on('attendance_updated', handleAttendanceUpdated);
      socket.on('payroll_updated', handlePayrollUpdated);
      socket.on('reviews_updated', handleReviewsUpdated);

      return () => {
        socket.off('order_created', handleOrderCreated);
        socket.off('order_updated', handleOrderUpdated);
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
            fetchInventoryCategories(true, newBranchId)
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
            fetchInventoryCategories(true, newBranchId)
          ]);
        } else if (activeTab === 'reports') {
          loadReportData(true);
        }
      };
      refreshBranchData();
    });
    return unsubscribe;
  }, [onBranchSwitch, activeTab, menuSubTab, staffSubTab, salaryRunTab]);

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
   {/* Revenue Analytics Cards */}
<div className="analytics-grid">
<div className="modern-metric-card">
  <div className="modern-metric-header">
    <h4 className="modern-metric-title">Today's Revenue</h4>
    <div className="modern-metric-icon-wrapper">
      <IndianRupee size={18} color="#27ae60" />
    </div>
  </div>
  <p className="modern-metric-value" style={{ color: '#27ae60' }}>₹{todayRevenue.toFixed(2)}</p>
  <span className="modern-metric-pill modern-pill-success"><TrendingUp size={12} /> Today's sales</span>
</div>
<div className="modern-metric-card">
  <div className="modern-metric-header">
    <h4 className="modern-metric-title">Monthly Revenue</h4>
    <div className="modern-metric-icon-wrapper">
      <IndianRupee size={18} color="var(--color-primary)" />
    </div>
  </div>
  <p className="modern-metric-value">₹{monthlyRevenue.toFixed(2)}</p>
  <span className="modern-metric-pill modern-pill-success"><TrendingUp size={12} /> This Month</span>
</div>
<div className="modern-metric-card">
  <div className="modern-metric-header">
    <h4 className="modern-metric-title">Inventory Value</h4>
    <div className="modern-metric-icon-wrapper">
      <Package size={18} color="#e67e22" />
    </div>
  </div>
  <p className="modern-metric-value" style={{ color: '#e67e22' }}>₹{totalInventoryValue.toFixed(2)}</p>
  <span className="modern-metric-pill modern-pill-warning">Current Real-Time Value</span>
</div>
<div className="modern-metric-card">
  <div className="modern-metric-header">
    <h4 className="modern-metric-title">Order Source (This Month)</h4>
    <div className="modern-metric-icon-wrapper">
      <BarChart3 size={18} color="#3498db" />
    </div>
  </div>
  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="modern-metric-value" style={{ fontSize: '1.4rem' }}>
        {statsData?.orderSourceData ? statsData.orderSourceData.QR : orders.filter(o => o.source !== 'STAFF').length}
      </span>
      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>QR Orders</span>
    </div>
    <div style={{ width: '1px', background: 'var(--color-border)' }}></div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="modern-metric-value" style={{ fontSize: '1.4rem', color: '#3498db' }}>
        {statsData?.orderSourceData ? (statsData.orderSourceData.POS + statsData.orderSourceData.Counter) : orders.filter(o => o.source === 'STAFF').length}
      </span>
      <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Staff POS</span>
    </div>
  </div>
</div>
</div>

 {/* Inventory Analytics Cards */}
<div className="analytics-grid" style={{ marginTop: '16px' }}>
<div className="modern-metric-card">
  <div className="modern-metric-header">
    <h4 className="modern-metric-title">Total Inventory Cost (This Month)</h4>
    <div className="modern-metric-icon-wrapper">
      <IndianRupee size={18} color="#9b59b6" />
    </div>
  </div>
  <p className="modern-metric-value" style={{ color: '#9b59b6' }}>₹{totalInventoryCost.toFixed(2)}</p>
  <span className="modern-metric-pill modern-pill-neutral">Purchases this month</span>
</div>
<div className="modern-metric-card">
  <div className="modern-metric-header">
    <h4 className="modern-metric-title">Inventory Consumption (This Month)</h4>
    <div className="modern-metric-icon-wrapper">
      <IndianRupee size={18} color="#16a085" />
    </div>
  </div>
  <p className="modern-metric-value" style={{ color: '#16a085' }}>₹{totalInventoryConsumption.toFixed(2)}</p>
  <span className="modern-metric-pill modern-pill-neutral">Consumed this month</span>
</div>
</div>

 {/* Best / Worst Selling items */}
<div className="owner-double-deck" style={{ marginTop: '24px' }}>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
  <TrendingUp size={20} color="#2ecc71" />
  <h4 style={{ color: '#2ecc71', margin: 0, fontSize: '1.1rem' }}>Top Selling Items</h4>
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
    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', padding: '10px 0', textAlign: 'center' }}>No sales data available</div>
  )}
</div>
</div>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
  <TrendingDown size={20} color="#e74c3c" />
  <h4 style={{ color: '#e74c3c', margin: 0, fontSize: '1.1rem' }}>Slow Selling Items</h4>
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
    <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', padding: '10px 0', textAlign: 'center' }}>No sales data available</div>
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
<button onClick={() =>setShowCategoryModal(true)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 14px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: '13px' }}>
📂 <span className="btn-label">Categories</span>
</button>
<button onClick={() =>setShowAddModal(true)} className="btn btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '13px' }}>
➕ <span className="btn-label">Add Item</span>
</button>
</div>
</div>

<div style={{ marginBottom: '20px' }}>
<input
 type="text"
 placeholder=" Search dishes by name or category..."
 value={menuSearch}
 onChange={(e) =>setMenuSearch(e.target.value)}
 style={{
 width: '100%',
 padding: '12px 16px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 fontSize: '14px',
 outline: 'none'
 }} />
 
</div>

 {menuLoading ?
<div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading menu items...</p>
</div>:

<div className="menu-grid-admin">
  {filteredMenuItems.map((item) => (
    <AdminMenuCard
      key={item._id}
      item={item}
      onEdit={handleEditMenuCallback}
      onDelete={handleDeleteMenuCallback}
    />
  ))}
</div>
 }
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
 {reviews.map((r) =>
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
 {''.repeat(r.rating)}{''.repeat(5 - r.rating)}
</div>
</div>
</div>
 {r.createdAt &&
<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
 {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
</span>
 }
</div>
 
 {/* Review Text */}
 {r.reviewText ?
<p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '1.5', borderLeft: '2px solid var(--color-primary)', paddingLeft: '10px' }}>
 {r.reviewText}
</p>:

<p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '12px', fontStyle: 'italic' }}>No comment provided.</p>
 }

 {/* Ordered Items */}
 {r.orderedItems && r.orderedItems.length >0 &&
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
 {r.orderedItems.map((item, idx) =>
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
)}
</div>
 }
</div>
)}
</div>
 }
</div>
</div>
 }
</div>
 }

 {/* TAB 3: STAFF ROSTER */}
 {activeTab === 'staff' &&
<div className="fade-in">
 {/* Sub-tab Switcher for Staff, Reports & Attendance */}
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
 onClick={() =>setStaffSubTab('roster')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'roster' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'roster' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Staff Roster
</button>
<button
 onClick={() =>setStaffSubTab('reports')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'reports' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'reports' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Daily Work Reports
</button>
<button
 onClick={() =>setStaffSubTab('attendance')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'attendance' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'attendance' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Attendance Logs
</button>
<button
 onClick={() =>setStaffSubTab('salary')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'salary' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'salary' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Staff Salaries
</button>
</div>

 {staffSubTab === 'roster' &&
<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

 {/* ─── Add Staff Modal ─── */}
 {showAddStaffModal &&
<div
 onClick={(e) =>{if (e.target === e.currentTarget) {setShowAddStaffModal(false);setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '', dailyRate: 0 });}}}
 style={{
 position: 'fixed', inset: 0, zIndex: 3000,
 background: 'rgba(0,0,0,0.75)',
 backdropFilter: 'blur(10px)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 padding: '16px',
 animation: 'fadeIn 0.2s ease'
 }}>
 
<div style={{
 background: 'var(--bg-card)',
 border: '1px solid var(--color-border)',
 borderRadius: '20px',
 padding: '28px 24px',
 width: '100%',
 maxWidth: '440px',
 boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
 animation: 'slideUp 0.25s ease'
 }}>
 {/* Modal Header */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Add New Staff</h3>
<p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.82rem' }}>Register a new team member to the roster</p>
</div>
<button
 onClick={() =>{setShowAddStaffModal(false);setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '', dailyRate: 0 });}}
 style={{
 background: 'rgba(0, 0, 0,0.06)', border: '1px solid rgba(0, 0, 0,0.08)',
 borderRadius: '50%', width: '36px', height: '36px',
 color: 'var(--color-text-primary)', fontSize: '18px', cursor: 'pointer',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0
 }}>
 ×</button>
</div>

 {/* Form */}
<form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-full-name" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name *</label>
<input type="text" id="roster-full-name" name="roster-full-name" className="form-input" placeholder="e.g. Ravi Kumar" value={newStaff.name} onChange={(e) =>setNewStaff({ ...newStaff, name: e.target.value })} required />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-email-address" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address<span style={{ opacity: 0.5 }}>(Optional)</span></label>
<input type="email" id="roster-email-address" name="roster-email-address" className="form-input" placeholder="staff@cafe.com" value={newStaff.email} onChange={(e) =>setNewStaff({ ...newStaff, email: e.target.value })} />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-phone-number" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number *</label>
<input type="text" id="roster-phone-number" name="roster-phone-number" className="form-input" placeholder="e.g. 9876543210" value={newStaff.phone} onChange={(e) =>setNewStaff({ ...newStaff, phone: e.target.value })} required />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-daily-wage" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily Wage (₹) *</label>
<input type="number" min="0" id="roster-daily-wage" name="roster-daily-wage" className="form-input" placeholder="e.g. 500" value={newStaff.dailyRate || ''} onChange={(e) =>setNewStaff({ ...newStaff, dailyRate: Number(e.target.value) })} required />
</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-staff-role" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff Role *</label>
<select id="roster-staff-role" name="roster-staff-role" className="form-input" value={newStaff.staffRole ? newStaff.staffRole.toLowerCase() : 'waiter'} onChange={(e) =>setNewStaff({ ...newStaff, staffRole: e.target.value })} required>
<option value="chef">Chef</option>
<option value="waiter">Waiter</option>
<option value="barista">Barista</option>
<option value="cashier">Cashier</option>
<option value="manager">Manager</option>
<option value="staff">Staff / Server</option>
</select>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-assigned-branch" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Branch *</label>
<select id="roster-assigned-branch" name="roster-assigned-branch" className="form-input" value={newStaff.assignedBranch} onChange={(e) =>setNewStaff({ ...newStaff, assignedBranch: e.target.value })} required>
<option value="">-- Select --</option>
 {branches.map((b) =>
<option key={b.branchId} value={b.branchId}>{b.branchName}</option>
)}
</select>
</div>
</div>
<div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
<button
 type="button"
 onClick={() =>{setShowAddStaffModal(false);setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '', dailyRate: 0 });}}
 style={{
 flex: 1, padding: '12px', borderRadius: '10px',
 border: '1px solid var(--color-border)', background: 'transparent',
 color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 600,
 cursor: 'pointer', fontFamily: 'inherit'
 }}>
 Cancel</button>
<button
 type="submit"
 className="btn btn-primary"
 style={{ flex: 2, padding: '12px', borderRadius: '10px', fontSize: '14px' }}
 disabled={staffLoading}>
 
 {staffLoading ? ' Adding...' : ' Add Staff Member'}
</button>
</div>
</form>
</div>
</div>
 }

 {/* Staff Roster List Card */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Staff Roster List</h4>
<div style={{ display: 'flex', gap: '10px' }}>
<button
 onClick={exportStaffToCSV}
 style={{
 display: 'flex', alignItems: 'center', gap: '8px',
 background: '#2ecc71', color: 'white',
 border: 'none', borderRadius: '10px',
 padding: '8px 16px', fontSize: '13px', fontWeight: 700,
 cursor: 'pointer', fontFamily: 'inherit',
 boxShadow: '0 4px 16px rgba(46, 204, 113, 0.4)',
 transition: 'all 0.2s ease'
 }}
 onMouseEnter={(e) =>{e.currentTarget.style.transform = 'translateY(-1px)';e.currentTarget.style.boxShadow = '0 6px 20px rgba(46, 204, 113, 0.5)';}}
 onMouseLeave={(e) =>{e.currentTarget.style.transform = 'translateY(0)';e.currentTarget.style.boxShadow = '0 4px 16px rgba(46, 204, 113, 0.4)';}}>
 <span style={{ fontSize: '16px' }}>📥</span>
 <span>Export CSV</span>
</button>
<button
 onClick={() =>setShowAddStaffModal(true)}
 style={{
 display: 'flex', alignItems: 'center', gap: '8px',
 background: 'var(--color-primary)', color: 'var(--color-text-primary)',
 border: 'none', borderRadius: '10px',
 padding: '8px 16px', fontSize: '13px', fontWeight: 700,
 cursor: 'pointer', fontFamily: 'inherit',
 boxShadow: '0 4px 16px rgba(143,168,155,0.4)',
 transition: 'all 0.2s ease'
 }}
 onMouseEnter={(e) =>{e.currentTarget.style.transform = 'translateY(-1px)';e.currentTarget.style.boxShadow = '0 6px 20px rgba(143,168,155,0.5)';}}
 onMouseLeave={(e) =>{e.currentTarget.style.transform = 'translateY(0)';e.currentTarget.style.boxShadow = '0 4px 16px rgba(143,168,155,0.4)';}}>
 
<span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
<span>Add Staff</span>
</button>
</div>
</div>
 {staffLoading && staff.length === 0 ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading staff roster...</p>
</div>:

<>
<div className="desktop-tablet-staff" style={{ display: 'none', width: '100%', overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
<th style={{ padding: '10px' }}>Emp ID</th>
<th style={{ padding: '10px' }}>Name</th>
<th style={{ padding: '10px' }}>Contact</th>
<th style={{ padding: '10px' }}>Role</th>
<th style={{ padding: '10px' }}>Branch</th>
<th style={{ padding: '10px' }}>Daily Wage</th>
<th style={{ padding: '10px' }}>Req. Hours</th>
<th style={{ padding: '10px' }}>Current Week Salary</th>
<th style={{ padding: '10px' }}>Last Login</th>
<th style={{ padding: '10px' }}>Orders (Today)</th>
<th style={{ padding: '10px' }}>Joined Date</th>
<th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
<th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
</tr>
</thead>
<tbody>
 {staff.map((member) => (
  <React.Fragment key={member._id}>
<tr style={{ borderBottom: '1px solid var(--color-border)' }}>
<td style={{ padding: '12px 10px', color: 'var(--color-primary)', fontWeight: 'bold' }}>{member.employeeId || 'N/A'}</td>
<td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{member.name}</td>
<td style={{ padding: '12px 10px' }}>
  <div style={{ fontSize: '13px' }}>{member.phone}</div>
  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{member.email || 'N/A'}</div>
</td>
<td style={{ padding: '12px 10px' }}>
<span className="admin-menu-badge" style={{ textTransform: 'capitalize' }}>{member.staffRole}</span>
</td>
<td style={{ padding: '12px 10px' }}>
 {branches.find((b) =>b.branchId === member.assignedBranch)?.branchName || 'Unassigned'}
</td>
<td style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
 ₹{member.dailyRate || 0}
</td>
<td style={{ padding: '12px 10px', color: 'var(--color-text-secondary)' }}>
 {member.requiredHours || 8} hrs
</td>
<td 
  style={{ padding: '12px 10px', fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer', userSelect: 'none' }}
  onClick={() => setExpandedStaffId(expandedStaffId === member._id ? null : member._id)}
  title="Click to view weekly breakdown"
>
  ₹{member.currentWeekSalary || 0} <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{expandedStaffId === member._id ? '▲' : '▼'}</span>
</td>
<td style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
 {formatLastSeen(member.lastSeen || member.lastLogin)}
</td>
<td style={{ padding: '12px 10px', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
 {member.ordersHandledToday || 0}
</td>
<td style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
 {new Date(member.createdAt).toLocaleDateString()}
</td>
<td style={{ padding: '12px 10px', textAlign: 'center' }}>
<span style={{
 backgroundColor: member.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
 color: member.isActive ? '#2ecc71' : '#e74c3c',
 padding: '3px 8px',
 borderRadius: '12px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 {member.isActive ? 'Active' : 'Inactive'}
</span>
</td>
<td style={{ padding: '12px 10px', textAlign: 'center' }}>
<div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
<button onClick={() =>{setEditingStaff({ ...member });setShowEditStaffModal(true);}} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}> Edit</button>
<button onClick={() =>handleDeleteStaff(member._id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}> Delete</button>
</div>
</td>
</tr>
{expandedStaffId === member._id && (
  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
    <td colSpan={13} style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '13px' }}>
          Weekly Salary Breakdown (Monday - Sunday):
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
            <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', minWidth: '85px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{day}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '2px', fontSize: '13px' }}>₹{member.weeklyBreakdown?.[day] || 0}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(143,168,155,0.1)', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--color-primary)' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 'bold' }}>Total Weekly Salary</span>
          <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '15px', marginTop: '2px' }}>₹{member.currentWeekSalary || 0}</span>
        </div>
      </div>
    </td>
  </tr>
)}
  </React.Fragment>
))}
</tbody>
</table>
</div>

<div className="mobile-only-staff" style={{ display: 'none' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
 {staff.map((member) =>
<div key={member._id} style={{ background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '12px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
<span style={{ color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: 'bold' }}>{member.name}</span>
<span className="admin-menu-badge" style={{ textTransform: 'capitalize', background: 'rgba(255, 107, 8, 0.15)', color: '#FF6B08', fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>{member.staffRole}</span>
</div>
<div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.6' }}>
<div>🆔 ID:<span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{member.employeeId || 'N/A'}</span></div>
<div>{member.email || 'No Email'}</div>
<div>{member.phone}</div>
<div>Branch:<span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{branches.find((b) =>b.branchId === member.assignedBranch)?.branchName || 'Unassigned'}</span></div>
<div>Daily Wage:<span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}> ₹{member.dailyRate || 0}</span></div>
<div>Required Hours:<span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}> {member.requiredHours || 8} hrs</span></div>
<div>Current Week Salary:<span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}> ₹{member.currentWeekSalary || 0}</span></div>
<div>Orders Today: <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{member.ordersHandledToday || 0}</span></div>
<div>Joined: {new Date(member.createdAt).toLocaleDateString()}</div>
<div style={{ marginTop: '4px' }}>Login: {formatLastSeen(member.lastSeen || member.lastLogin)}</div>

{/* Mobile Weekly Breakdown */}
<div style={{ 
  marginTop: '12px', 
  padding: '10px', 
  background: 'rgba(0,0,0,0.15)', 
  borderRadius: '8px',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '8px',
  fontSize: '11px',
  border: '1px solid var(--color-border)'
}}>
  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
    <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '9px', fontWeight: 600 }}>{day.slice(0, 3)}</span>
      <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>₹{member.weeklyBreakdown?.[day] || 0}</span>
    </div>
  ))}
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gridColumn: 'span 1', background: 'rgba(143,168,155,0.1)', borderRadius: '4px' }}>
    <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '9px' }}>Total</span>
    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>₹{member.currentWeekSalary || 0}</span>
  </div>
</div>

</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
<span style={{
 backgroundColor: member.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
 color: member.isActive ? '#2ecc71' : '#e74c3c',
 padding: '4px 10px',
 borderRadius: '12px',
 fontSize: '12px',
 fontWeight: 'bold'
 }}>
 {member.isActive ? 'Active' : 'Inactive'}
</span>
<div style={{ display: 'flex', gap: '10px' }}>
<button onClick={() =>{setEditingStaff({ ...member });setShowEditStaffModal(true);}} className="btn btn-secondary touch-btn" style={{ padding: '8px 12px', fontSize: '13px', minHeight: '44px' }}> Edit</button>
<button onClick={() =>handleDeleteStaff(member._id)} className="btn btn-secondary touch-btn" style={{ padding: '8px 12px', fontSize: '13px', minHeight: '44px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}> Delete</button>
</div>
</div>
</div>
)}
</div>
</div>
</>
 }
</div>
</div>
 }

 {staffSubTab === 'attendance' &&
<div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
 {/* Overview cards */}
<div className="analytics-grid">
<div className="analytics-card" style={{ background: '#1a130f' }}>
<h4>Total Active Staff</h4>
<span className="val">{attendanceSummary.totalStaff || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#0e1a12' }}>
<h4>Present Today</h4>
<span className="val" style={{ color: '#2ecc71' }}>{attendanceSummary.present || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#1c100e' }}>
<h4>Absent Today</h4>
<span className="val" style={{ color: '#e74c3c' }}>{attendanceSummary.absent || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#1c1c0e' }}>
<h4> Late Arrivals</h4>
<span className="val" style={{ color: '#f1c40f' }}>{attendanceSummary.late || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#160e1a' }}>
<h4>Currently Working</h4>
<span className="val" style={{ color: '#3498db' }}>{attendanceSummary.currentlyWorking || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#13191f' }}>
<h4>Checked Out</h4>
<span className="val" style={{ color: '#9b59b6' }}>{attendanceSummary.checkedOut || 0}</span>

</div>
</div>

 {/* Today's Live Records Table */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.20rem', fontWeight: 700 }}>Today's Attendance Log</h3>
 {attendanceLoading ?
<div style={{ textAlign: 'center', padding: '20px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading today's logs...</p>
</div>:
 attendanceRecords.length === 0 ?
<div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
 No check-in logs recorded today yet.
</div>:

<div style={{ overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
<th style={{ padding: '10px' }}>Staff Name</th>
<th style={{ padding: '10px' }}>Branch</th>
<th style={{ padding: '10px' }}>Check In</th>
<th style={{ padding: '10px' }}>Check Out</th>
<th style={{ padding: '10px' }}>Duration</th>
<th style={{ padding: '10px' }}>Status</th>
<th style={{ padding: '10px' }}>Verification Distance</th>
<th style={{ padding: '10px' }}>Device</th>
</tr>
</thead>
<tbody>
 {attendanceRecords.map((rec) =>{
 const durationHrs = rec.totalDuration ? `${Math.floor(rec.totalDuration / 60)}h ${rec.totalDuration % 60}m` : 'Active';
 const statusColor = rec.status === 'Late' ? '#f1c40f' : '#2ecc71';
 return (
<tr key={rec._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
<td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{rec.staffName}</td>
<td style={{ padding: '12px 10px' }}>{rec.branchName}</td>
<td style={{ padding: '12px 10px' }}>{rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
<td style={{ padding: '12px 10px' }}>{rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
<td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{durationHrs}</td>
<td style={{ padding: '12px 10px' }}>
<span style={{
 backgroundColor: `${statusColor}22`,
 border: `1px solid ${statusColor}`,
 color: statusColor,
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 {rec.status}
</span>
</td>
<td style={{ padding: '12px 10px' }}>
<span style={{ color: rec.distanceFromCafe<= 30 ? '#2ecc71' : '#e67e22' }}>
 {rec.distanceFromCafe} meters
</span>
</td>
<td style={{ padding: '12px 10px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>{rec.deviceInfo}</td>
</tr>);

 })}
</tbody>
</table>
</div>
 }
</div>

 {/* Attendance Analytics & Reports */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.20rem', fontWeight: 700 }}>Historical Attendance Reports</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}></p>
</div>
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
<select className="form-input" style={{ width: '130px', margin: 0 }} value={reportRange} onChange={(e) =>setReportRange(e.target.value)}>
<option value="daily">Past 24 Hours</option>
<option value="weekly">Past 7 Days</option>
<option value="monthly">Past 30 Days</option>
</select>
<select className="form-input" style={{ width: '180px', margin: 0 }} value={reportBranch} onChange={(e) =>setReportBranch(e.target.value)}>
<option value="">All Branches</option>
 {branches.map((b) =>
<option key={b.branchId} value={b.branchId}>{b.branchName}</option>
)}
</select>
</div>
</div>

 {attendanceReports && !Array.isArray(attendanceReports) && attendanceReports.summary &&
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
<div className="analytics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: 0 }}>
<div className="analytics-card" style={{ background: 'rgba(0, 0, 0,0.01)' }}>
<h4>Attendance Percentage (%)</h4>
<span className="val" style={{ color: 'var(--color-primary)' }}>{attendanceReports.summary.attendancePercentage || 0}%</span>

</div>
<div className="analytics-card" style={{ background: 'rgba(0, 0, 0,0.01)' }}>
<h4>Cumulative Working Hours</h4>
<span className="val" style={{ color: '#2ecc71' }}>{attendanceReports.summary.totalHours || 0} hrs</span>

</div>
<div className="analytics-card" style={{ background: 'rgba(0, 0, 0,0.01)' }}>
<h4>Late Arrival Incidents</h4>
<span className="val" style={{ color: '#f1c40f' }}>{attendanceReports.summary.lateArrivals || 0} times</span>

</div>
</div>

 {/* Branch wise performance */}
 {attendanceReports.branchReports && attendanceReports.branchReports.length > 0 &&
<div style={{ marginTop: '10px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', marginBottom: '10px' }}>Branch Attendance Performance Breakdown</h4>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
<th style={{ padding: '8px' }}>Branch Name</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Total Check-ins</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Total Hours Logged</th>
</tr>
</thead>
<tbody>
 {attendanceReports.branchReports.map((br, idx) =>
<tr key={idx} style={{ borderBottom: '1px solid rgba(0, 0, 0,0.03)' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{br.branchName || 'Unknown Branch'}</td>
<td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>{br.presentCount}</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: '#2ecc71', fontWeight: 'bold' }}>{br.workingHours} hrs</td>
</tr>
)}
</tbody>
</table>
</div>
 }

 {/* Filtered records detail log */}
<div style={{ marginTop: '10px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', marginBottom: '10px' }}>Detailed History Records ({attendanceReports.records?.length || 0})</h4>
<div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
<th style={{ padding: '10px' }}>Date</th>
<th style={{ padding: '10px' }}>Staff Name</th>
<th style={{ padding: '10px' }}>Branch</th>
<th style={{ padding: '10px' }}>Check In</th>
<th style={{ padding: '10px' }}>Check Out</th>
<th style={{ padding: '10px' }}>Status</th>
</tr>
</thead>
<tbody>
 {attendanceReports.records && attendanceReports.records.map((r) =>
<tr key={r._id} style={{ borderBottom: '1px solid rgba(0, 0, 0,0.03)' }}>
<td style={{ padding: '10px', color: 'var(--color-text-primary)' }}>{new Date(r.checkInTime).toLocaleDateString()}</td>
<td style={{ padding: '10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{r.staffName}</td>
<td style={{ padding: '10px' }}>{r.branchName}</td>
<td style={{ padding: '10px' }}>{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
<td style={{ padding: '10px' }}>{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active'}</td>
<td style={{ padding: '10px' }}>
<span style={{
 color: r.status === 'Late' ? '#f1c40f' : '#2ecc71',
 fontWeight: 'bold'
 }}>
 {r.status}
</span>
</td>
</tr>
)}
</tbody>
</table>
</div>
</div>
</div>
 }
</div>
</div>
 }

 {staffSubTab === 'reports' &&
<div>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Staff Daily Work Reports</h3>

</div>
</div>

 {/* Filters Panel */}
<div style={{
 display: 'flex',
 flexWrap: 'wrap',
 gap: '15px',
 background: 'rgba(0, 0, 0,0.02)',
 padding: '16px',
 borderRadius: '12px',
 border: '1px solid var(--color-border)',
 marginBottom: '24px'
 }}>
 {/* Filter 1: Range */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px' }}>
<label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Time Range</label>
<select
 value={reportsFilterRange}
 onChange={(e) =>setReportsFilterRange(e.target.value)}
 style={{
 backgroundColor: 'rgba(0,0,0,0.2)',
 border: '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '8px 12px',
 color: 'var(--color-text-primary)',
 fontSize: '0.85rem',
 outline: 'none'
 }}>
 
<option value="today">Today</option>
<option value="this_week">This Week (Last 7 Days)</option>
<option value="all">All Available</option>
</select>
</div>

 {/* Filter 2: Staff */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
<label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Staff Member</label>
<select
 value={reportsFilterStaff}
 onChange={(e) =>setReportsFilterStaff(e.target.value)}
 style={{
 backgroundColor: 'rgba(0,0,0,0.2)',
 border: '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '8px 12px',
 color: 'var(--color-text-primary)',
 fontSize: '0.85rem',
 outline: 'none'
 }}>
 
<option value="">All Staff</option>
 {staff.map((member) =>
<option key={member._id} value={member._id}>
 {member.name} ({member.staffRole || member.role})
</option>
)}
</select>
</div>

 {/* Filter 3: Branch */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
<label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Branch</label>
<select
 value={reportsFilterBranch}
 onChange={(e) =>setReportsFilterBranch(e.target.value)}
 style={{
 backgroundColor: 'rgba(0,0,0,0.2)',
 border: '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '8px 12px',
 color: 'var(--color-text-primary)',
 fontSize: '0.85rem',
 outline: 'none'
 }}>
 
<option value="">All Branches</option>
 {branches.map((b) =>
<option key={b._id} value={b.branchId}>
 {b.branchName}
</option>
)}
</select>
</div>

 {/* Clear button if active filters */}
 {(reportsFilterStaff || reportsFilterBranch || reportsFilterRange !== 'today') &&
<div style={{ display: 'flex', alignItems: 'flex-end' }}>
<button
 onClick={() =>{
 setReportsFilterRange('today');
 setReportsFilterStaff('');
 setReportsFilterBranch('');
 }}
 style={{
 backgroundColor: 'transparent',
 border: '1px solid #ff4d4d',
 borderRadius: '8px',
 padding: '8px 16px',
 color: '#ff4d4d',
 fontSize: '0.85rem',
 fontWeight: 'bold',
 cursor: 'pointer',
 transition: 'all 0.2s'
 }}>
 
 Clear Filters
</button>
</div>
 }
</div>

 {/* Reports List/Grid */}
 {reportsLoading ?
<div style={{ textAlign: 'center', padding: '50px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading daily work reports...</p>
</div>:
 reportsError ?
<div style={{ color: '#ff4d4d', padding: '10px 0', fontSize: '0.9rem' }}> {reportsError}</div>:
 workReports.length === 0 ?
<div style={{
 padding: '50px 20px',
 textAlign: 'center',
 background: 'rgba(0, 0, 0,0.01)',
 borderRadius: '12px',
 border: '1px dashed var(--color-border)',
 color: 'var(--color-text-secondary)',
 fontStyle: 'italic'
 }}>
 No work reports found matching the selected filters.
</div>:

<div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
 gap: '20px'
 }}>
 {workReports.map((report) =>
<div
 key={report._id}
 onClick={() =>setSelectedReport(report)}
 style={{
 background: 'rgba(0, 0, 0,0.01)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '16px',
 cursor: 'pointer',
 transition: 'transform 0.15s, border-color 0.15s',
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'space-between',
 minHeight: '220px'
 }}
 onMouseEnter={(e) =>{
 e.currentTarget.style.borderColor = 'var(--color-primary)';
 e.currentTarget.style.transform = 'translateY(-2px)';
 }}
 onMouseLeave={(e) =>{
 e.currentTarget.style.borderColor = 'var(--color-border)';
 e.currentTarget.style.transform = 'translateY(0)';
 }}>
 
<div>
 {/* Header details */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
<div>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', display: 'block' }}>{report.staffName}</strong>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Branch: {report.branchName}</span>
</div>
<span style={{
 backgroundColor: 'rgba(255, 107, 8, 0.1)',
 border: '1px solid var(--color-primary)',
 color: 'var(--color-primary)',
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '0.75rem',
 fontWeight: 'bold'
 }}>
 {report.photos.length} {report.photos.length === 1 ? 'photo' : 'photos'}
</span>
</div>

 {/* Thumbnail of first photo */}
<div style={{
 width: '100%',
 height: '110px',
 borderRadius: '8px',
 overflow: 'hidden',
 marginBottom: '10px',
 border: '1px solid var(--color-border)',
 background: '#000'
 }}>
<img
 src={getAssetUrl(report.photos[0])}
 alt="Work Proof"
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 loading="lazy" />
 
</div>

 {/* Note excerpt */}
 {report.notes &&
<p style={{
 margin: 0,
 fontSize: '0.8rem',
 color: 'var(--color-text-secondary)',
 lineHeight: '1.4',
 overflow: 'hidden',
 textOverflow: 'ellipsis',
 whiteSpace: 'nowrap'
 }}>
 {report.notes}
</p>
 }
</div>

 {/* Footer time */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', borderTop: '1px solid rgba(0, 0, 0,0.04)', paddingTop: '8px' }}>
<span>{new Date(report.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
<span> {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
</div>
</div>
)}
</div>
 }
</div>
</div>
 }

 {staffSubTab === 'salary' && (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      {/* Tab Switcher for Weekly Run vs Salary History */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setSalaryRunTab('run')} 
          style={{ 
            background: salaryRunTab === 'run' ? 'var(--color-primary)' : 'transparent', 
            color: salaryRunTab === 'run' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            fontSize: '13px' 
          }}
        >
          Weekly Run
        </button>
        <button 
          onClick={() => { setSalaryRunTab('history'); fetchSalaryHistory(); }} 
          style={{ 
            background: salaryRunTab === 'history' ? 'var(--color-primary)' : 'transparent', 
            color: salaryRunTab === 'history' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            fontSize: '13px' 
          }}
        >
          Salary History Ledger
        </button>
      </div>

      {salaryRunTab === 'run' ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Weekly Run Calculator</h4>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>Calculate and disburse salaries based on attendance.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Search Employee..." 
                value={salarySearchQuery} 
                onChange={e => setSalarySearchQuery(e.target.value)} 
                className="form-input" 
                style={{ width: '160px', height: '40px', padding: '0 12px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
              />
              <button 
                onClick={handleGeneratePayroll}
                className="btn btn-secondary"
                style={{ height: '40px', padding: '0 16px', fontSize: '13px', width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
              >
                Generate Run
              </button>
              <button 
                onClick={() => { fetchStaffList(); alert('Salaries refreshed successfully.'); }} 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', height: '40px', width: 'auto' }}
              >
                Refresh
              </button>
            </div>
          </div>

          {staffLoading && staff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading salary calculations...</p>
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    <th style={{ padding: '12px 10px' }}>Staff Name</th>
                    <th style={{ padding: '12px 10px' }}>Employee ID</th>
                    <th style={{ padding: '12px 10px' }}>Cafe</th>
                    <th style={{ padding: '12px 10px' }}>Branch</th>
                    <th style={{ padding: '12px 10px' }}>Daily Wage</th>
                    <th style={{ padding: '12px 10px' }}>Req. Hours</th>
                    <th style={{ padding: '12px 10px' }}>Worked This Week</th>
                    <th style={{ padding: '12px 10px' }}>Present Days</th>
                    <th style={{ padding: '12px 10px' }}>Absent Days</th>
                    <th style={{ padding: '12px 10px' }}>Current Week Salary</th>
                    <th style={{ padding: '12px 10px' }}>Payroll Status</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff
                    .filter(s => {
                      const matchesSearch = s.name.toLowerCase().includes(salarySearchQuery.toLowerCase());
                      const matchesRole = !salaryRoleFilter || (s.staffRole || s.role || '').toLowerCase() === salaryRoleFilter.toLowerCase();
                      return matchesSearch && matchesRole;
                    })
                    .map(member => {
                      let statusBg = 'rgba(230,126,34,0.15)';
                      let statusColor = '#e67e22';
                      if (member.payrollStatus === 'Approved') {
                        statusBg = 'rgba(52,152,219,0.15)';
                        statusColor = '#3498db';
                      } else if (member.payrollStatus === 'Paid') {
                        statusBg = 'rgba(46,204,113,0.15)';
                        statusColor = '#2ecc71';
                      }

                      return (
                        <tr key={member._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{member.name}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{member.employeeId || '—'}</td>
                          <td style={{ padding: '12px 10px' }}>{member.cafeName || '—'}</td>
                          <td style={{ padding: '12px 10px' }}>{member.branchName || '—'}</td>
                          <td style={{ padding: '12px 10px', fontWeight: 600, color: 'var(--color-text-primary)' }}>₹{member.dailyRate || 0}</td>
                          <td style={{ padding: '12px 10px' }}>{member.requiredHours || 8} hrs</td>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{member.actualHoursWorked || 0} hrs</td>
                          <td style={{ padding: '12px 10px', color: '#2ecc71', fontWeight: 'bold' }}>{member.workingDays || 0} days</td>
                          <td style={{ padding: '12px 10px', color: '#e74c3c', fontWeight: 'bold' }}>{member.absentDays || 0} days</td>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold', color: 'var(--color-primary)' }}>₹{member.currentWeekSalary || 0}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{ backgroundColor: statusBg, color: statusColor, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: `1px solid ${statusColor}` }}>
                              {member.payrollStatus || 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              onClick={() => { setSelectedSalaryStaff(member); setShowSalaryDetailModal(true); }} 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', minHeight: 'auto' }}
                            >
                              Shift Logs
                            </button>
                            {member.payrollStatus === 'Pending' && (
                              <button 
                                onClick={() => handleApprovePayroll(member._id)} 
                                className="btn btn-secondary" 
                                style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', minHeight: 'auto', backgroundColor: '#3498db', color: '#fff', border: 'none' }}
                              >
                                Approve
                              </button>
                            )}
                            {member.payrollStatus === 'Approved' && (
                              <button 
                                onClick={() => handlePayPayroll(member._id)} 
                                className="btn btn-primary" 
                                style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', minHeight: 'auto' }}
                              >
                                Disburse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Permanent Salary History Ledger</h4>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>Auditable permanent records of disbursed payroll cycles.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select 
                value={salaryHistoryPeriod} 
                onChange={e => { setSalaryHistoryPeriod(e.target.value); }} 
                className="form-input" 
                style={{ width: '180px', height: '40px', padding: '0 10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
              >
                <option value="current_week">Current Week</option>
                <option value="previous_week">Previous Week</option>
                <option value="previous_month">Previous Month</option>
                <option value="previous_year">Previous Year</option>
              </select>
              <button 
                onClick={() => fetchSalaryHistory()} 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', height: '40px', width: 'auto' }}
              >
                Sync Ledger
              </button>
            </div>
          </div>

          {salaryHistoryLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Retrieving ledger records...</p>
            </div>
          ) : salaryHistoryList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
              No disbursed salary records found for this period.
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    <th style={{ padding: '12px 10px' }}>Payroll Week</th>
                    <th style={{ padding: '12px 10px' }}>Staff Name</th>
                    <th style={{ padding: '12px 10px' }}>Cafe</th>
                    <th style={{ padding: '12px 10px' }}>Branch</th>
                    <th style={{ padding: '12px 10px' }}>Worked Days</th>
                    <th style={{ padding: '12px 10px' }}>Worked Hours</th>
                    <th style={{ padding: '12px 10px' }}>Gross Salary</th>
                    <th style={{ padding: '12px 10px' }}>Deductions</th>
                    <th style={{ padding: '12px 10px' }}>Final Salary</th>
                    <th style={{ padding: '12px 10px' }}>Status</th>
                    <th style={{ padding: '12px 10px' }}>Disbursement Date</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryHistoryList.map(record => (
                    <tr key={record._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 700 }}>{record.payrollWeek}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{record.employeeName}</td>
                      <td style={{ padding: '12px 10px' }}>{record.cafeId}</td>
                      <td style={{ padding: '12px 10px' }}>{record.branchName || record.branchId}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{record.workedDays} days</td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{record.workedHours} hrs</td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>₹{record.grossSalary}</td>
                      <td style={{ padding: '12px 10px', color: '#e74c3c' }}>₹{record.deductions}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', color: 'var(--color-primary)' }}>₹{record.finalSalary}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ backgroundColor: 'rgba(46,204,113,0.15)', color: '#2ecc71', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #2ecc71' }}>
                          {record.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {record.paymentDate ? new Date(record.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )}

  {/* Employee Detail View Modal */}
  {showSalaryDetailModal && selectedSalaryStaff && (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="modal-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '600px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Employee Salary Details</h3>
            <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>{selectedSalaryStaff.name} ({selectedSalaryStaff.staffRole || selectedSalaryStaff.role})</p>
          </div>
          <button onClick={() => { setShowSalaryDetailModal(false); setSelectedSalaryStaff(null); }} className="modal-close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Daily Wage:</span>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>₹{selectedSalaryStaff.dailyRate || 0}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Required Hours:</span>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{selectedSalaryStaff.requiredHours || 8} hrs</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Weekly Total:</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>₹{selectedSalaryStaff.currentWeekSalary || 0}</div>
            </div>
          </div>
          <div>
            <h4 style={{ color: 'var(--color-text-primary)', fontSize: '13px', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance Log & Daily Salary</h4>
            {(!selectedSalaryStaff.attendances || selectedSalaryStaff.attendances.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                No attendance logs found for this week.
              </div>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                      <th style={{ padding: '10px' }}>Date</th>
                      <th style={{ padding: '10px' }}>Check In</th>
                      <th style={{ padding: '10px' }}>Check Out</th>
                      <th style={{ padding: '10px' }}>Worked</th>
                      <th style={{ padding: '10px' }}>Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSalaryStaff.attendances.map((att, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{att.date}</td>
                        <td style={{ padding: '10px', color: 'var(--color-text-secondary)' }}>{new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '10px', color: 'var(--color-text-secondary)' }}>{att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '10px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{att.workingHours || 0} hrs</td>
                        <td style={{ padding: '10px', color: 'var(--color-primary)', fontWeight: 'bold' }}>₹{att.dailySalary || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { setShowSalaryDetailModal(false); setSelectedSalaryStaff(null); }} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }}>Close</button>
        </div>
      </div>
    </div>
  )}
  </div>
 }

 {activeTab === 'inventory' &&
<div className="fade-in">
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Smart Multi-Branch Ingredient Hub</h3>
<button
 onClick={() =>setShowAddInventoryModal(true)}
 className="btn btn-primary"
 style={{ width: 'auto', padding: '10px 20px' }}>
 
 Add Ingredient
</button>
</div>

 {/* Sub-tab bar */}
<div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', overflowX: 'auto' }}>
<button onClick={() =>setInventorySubTab('levels')} style={{ background: inventorySubTab === 'levels' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'levels' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Stock Directory</button>
<button onClick={() =>setInventorySubTab('movements')} style={{ background: inventorySubTab === 'movements' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'movements' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Movement Ledger</button>
<button onClick={() =>setInventorySubTab('wastage')} style={{ background: inventorySubTab === 'wastage' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'wastage' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Wastage Reports</button>
<button onClick={() =>setInventorySubTab('suppliers')} style={{ background: inventorySubTab === 'suppliers' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'suppliers' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Supplier Registry</button>
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

 {/* Desktop: scrollable table */}
<div className="inv-desktop-table">
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
<th style={{ padding: '8px' }}>Ingredient Name</th>
<th style={{ padding: '8px' }}>Category</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Stock Level</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Cost Price</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Selling Price</th>
<th style={{ padding: '8px' }}>Supplier</th>
<th style={{ padding: '8px' }}>Branch</th>
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

 {/* SUBTAB 2: Movement Logs */}
 {inventorySubTab === 'movements' &&
<div style={{ overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
<th style={{ padding: '8px' }}>Timestamp</th>
<th style={{ padding: '8px' }}>Ingredient</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Type</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Stock Adjustment</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Calculated Cost</th>
<th style={{ padding: '8px' }}>Reason / Context</th>
<th style={{ padding: '8px' }}>Operator</th>
</tr>
</thead>
<tbody>
 {inventoryLogs.map((log) =>{
 const isPositive = log.quantityChanged >0;
 const typeColor = log.type === 'Purchase' || log.type === 'Initial' ? '#2ECC71' : log.type === 'Wastage' || log.type === 'Damaged' ? '#E74C3C' : '#F39C12';
 return (
<tr key={log._id} style={{ borderBottom: '1px solid #432E22' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
 {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{log.itemName}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>
<span style={{
 backgroundColor: `${typeColor}1A`,
 border: `1px solid ${typeColor}`,
 color: typeColor,
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '10px',
 fontWeight: 'bold'
 }}>
 {log.type}
</span>
</td>
<td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isPositive ? '#2ECC71' : '#E74C3C' }}>
 {isPositive ? `+${log.quantityChanged}` : log.quantityChanged}
</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-text-primary)' }}>
 ₹{(log.cost || 0).toFixed(2)}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.reason}</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.userEmail || 'system'}</td>
</tr>);

 })}
</tbody>
</table>
</div>
 }

 {/* SUBTAB 3: Wastage Reports */}
 {inventorySubTab === 'wastage' &&
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
<div className="analytics-grid">
<div className="analytics-card" style={{ background: '#1F140E' }}>
<h4>Total Wastage Events</h4>
<span className="val" style={{ color: '#e74c3c' }}>{wastageReport.count}</span>
</div>
<div className="analytics-card" style={{ background: '#1F140E' }}>
<h4>Aggregate Cost of Wastage</h4>
<span className="val" style={{ color: '#e74c3c' }}>₹{(wastageReport.totalCost || 0).toFixed(2)}</span>
</div>
<div className="analytics-card" style={{ background: '#1F140E' }}>
<h4>Total Recipe Deductions Cost</h4>
<span className="val" style={{ color: '#16a085' }}>₹{(consumptionReport.totalCost || 0).toFixed(2)}</span>
</div>
</div>

<h4 style={{ color: 'var(--color-text-primary)', margin: '10px 0 0 0' }}>Detailed Wastage & Spoilage Log</h4>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
<th style={{ padding: '8px' }}>Date</th>
<th style={{ padding: '8px' }}>Ingredient</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Type</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Quantity Lost</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Wasted Cost</th>
<th style={{ padding: '8px' }}>Wastage Reason</th>
</tr>
</thead>
<tbody>
 {inventoryLogs.filter((log) =>log.type === 'Wastage' || log.type === 'Damaged').map((log) =>
<tr key={log._id} style={{ borderBottom: '1px solid #432E22' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
 {new Date(log.createdAt).toLocaleDateString()}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{log.itemName}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>{log.type}</td>
<td style={{ padding: '10px 8px', textAlign: 'center', color: '#E74C3C', fontWeight: 'bold' }}>
 {Math.abs(log.quantityChanged)}
</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: '#E74C3C', fontWeight: 'bold' }}>
 ₹{log.cost.toFixed(2)}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.reason}</td>
</tr>
)}
</tbody>
</table>
</div>
 }

 {/* SUBTAB 4: Suppliers */}
 {inventorySubTab === 'suppliers' &&
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
 {Array.from(new Set(inventoryList.map((item) =>item.supplier || 'Unassigned Supplier'))).map((sup) =>{
 const supItems = inventoryList.filter((item) =>(item.supplier || 'Unassigned Supplier') === sup);
 const totalSupplierValue = supItems.reduce((sum, i) =>sum + (i.quantity || i.stock) * (i.costPrice || i.cost), 0);
 return (
<div key={sup} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '1rem' }}>{sup}</strong>
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
 }

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
 if (!order.createdAt) return true;
 const localDate = new Date(order.createdAt);
 const orderDateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
 
 const matchesDate = orderDateStr === orderDateFilter;
 if (!matchesDate) return false;
 
 if (!orderSearchQuery) return true;
 
 const q = orderSearchQuery.toLowerCase();
 return (
 (order._id && order._id.toLowerCase().includes(q)) || 
 (order.tableNumber && String(order.tableNumber).toLowerCase().includes(q)) || 
 (order.status && order.status.toLowerCase().includes(q)) ||
 (order.items && order.items.some(i => i.name && i.name.toLowerCase().includes(q)))
 );
 })
 .map((order) =>
<div key={order._id} style={{
 background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)',
 borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
 }}>
 {/* Header: Order ID + Status */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '15px' }}>
 #{order._id.substring(order._id.length - 8).toUpperCase()}
</span>
<span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>· Table {order.tableNumber}</span>
</div>
<span style={{
 color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : order.status === 'Delivered' ? '#9b59b6' : order.status === 'Completed' ? '#27AE60' : '#7f8c8d',
 background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : order.status === 'Delivered' ? 'rgba(155,89,182,0.1)' : order.status === 'Completed' ? 'rgba(39,174,96,0.1)' : 'rgba(127,140,141,0.1)',
 padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
 }}>
 {order.status}
</span>
</div>

      {/* Items List */}
      <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {order.items.map((i, idx) => {
          const displayImage = i.image ? getAssetUrl(i.image) : '/images/default-food.png';
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.02)', padding: '4px 8px', borderRadius: '6px' }}>
              <img
                src={displayImage}
                alt={i.name}
                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                onError={(e) => { e.target.src = '/images/default-food.png'; }}
              />
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {i.quantity}x
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-primary)' }}>
                {i.name}
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
          <span>{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</span>
        </div>
        {order.preparingByName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Preparing by {order.preparingByName}:</span>
            <span>{order.preparingAt ? new Date(order.preparingAt).toLocaleString() : 'N/A'}</span>
          </div>
        )}
        {order.readyByName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Ready by {order.readyByName}:</span>
            <span>{order.readyAt ? new Date(order.readyAt).toLocaleString() : 'N/A'}</span>
          </div>
        )}
        {order.servedByName && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Served by {order.servedByName}:</span>
            <span>{order.servedAt ? new Date(order.servedAt).toLocaleString() : 'N/A'}</span>
          </div>
        )}
        {order.paidByName && (
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
<span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '16px' }}>₹{order.totalAmount.toFixed(2)}</span>
</div>
<span style={{
 color: order.paymentStatus === 'Paid' ? '#27AE60' : '#E74C3C',
 fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
 }}>
 {order.paymentStatus === 'Paid' ? ' Paid' : ' Pending'}
</span>
</div>
</div>
)}
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
<div style={{ display: 'flex', gap: '10px' }}>
<a href={`/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', width: 'auto' }}>
 Open Menu Tab
</a>
<button onClick={() =>handleCopyUrl(selectedQrTable)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}>
 {copiedLink ? ' Copied!' : ' Copy URL'}
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
 Configure physical branch geofences for attendance tracking validation.
</p>
</div>
<button onClick={() =>setShowAddBranchModal(true)} className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
 Add New Branch
</button>
</div>

 {branchesLoading && branches.length === 0 ?
<div style={{ textAlign: 'center', padding: '20px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading branches...</p>
</div>:
 branches.length === 0 ?
<div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
 No branches configured yet. Add one to start tracking location-based attendance.
</div>:

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
 {branches.map((b) =>
<div key={b._id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
<h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{b.branchName}</h4>
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
<div><strong>Manager:</strong>{b.manager || 'Unassigned'}</div>
<div><strong>Address:</strong>{b.address}</div>
<div><strong>Coordinates:</strong>{b.latitude}, {b.longitude}</div>
<div><strong>Geo-Fence:</strong>{b.allowedRadius} meters radius</div>
<div><strong>Unified Staff Mode:</strong> {b.unifiedStaffMode ? 'Enabled' : 'Disabled'}</div>
</div>
<div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
<button onClick={() =>{setEditingBranch({ ...b });setShowEditBranchModal(true);}} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', flex: 1, minHeight: '34px' }}>
  Edit
</button>
<button onClick={() =>handleDeleteBranch(b._id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', flex: 1, minHeight: '34px' }}>
  Delete
</button>
</div>
</div>
)}
</div>
 }
</div>

</div>
  }

  {/* TAB 8: POS/ERP REPORTS SYSTEM */}
  {activeTab === 'reports' && (
    <div className="fade-in">
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>POS/ERP Reports & Financial Analytics</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Generate, preview, and download compliance-ready Excel reports for your business operations.
            </p>
          </div>
          <button 
            onClick={handleDownloadExcel} 
            disabled={!reportData || reportData.length === 0} 
            className="btn btn-primary" 
            style={{ 
              width: 'auto', 
              padding: '12px 24px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              fontSize: '14.5px',
              fontWeight: 700,
              opacity: (!reportData || reportData.length === 0) ? 0.6 : 1,
              cursor: (!reportData || reportData.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            <span>📥</span> Download Excel (.xlsx)
          </button>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid var(--color-border)' }}>
          {/* Report Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Report Category</label>
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              className="form-input"
              style={{ minHeight: '44px' }}
            >
              <option value="revenue">Revenue Statement</option>
              <option value="orders">All Orders Log</option>
              <option value="inventory">Current Stock Valuation</option>
              <option value="inventory_consumption">Stock Consumption Report</option>
              <option value="payment">Payment Mode Breakdown</option>
              <option value="financial_summary">Comprehensive Financial Summary</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Branch Filter</label>
            <select 
              value={reportBranchId} 
              onChange={(e) => setReportBranchId(e.target.value)}
              className="form-input"
              style={{ minHeight: '44px' }}
            >
              <option value="all">All Branches (Cafe-wide)</option>
              {branches.map(b => (
                <option key={b._id} value={b.branchId || b._id}>{b.branchName}</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Time Frame</label>
            <select 
              value={reportDateRange} 
              onChange={(e) => setReportDateRange(e.target.value)}
              className="form-input"
              style={{ minHeight: '44px' }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Picker Range */}
          {reportDateRange === 'custom' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Start Date</label>
                <input 
                  type="date" 
                  value={reportStartDate} 
                  onChange={(e) => setReportStartDate(e.target.value)} 
                  className="form-input" 
                  style={{ minHeight: '44px' }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>End Date</label>
                <input 
                  type="date" 
                  value={reportEndDate} 
                  onChange={(e) => setReportEndDate(e.target.value)} 
                  className="form-input" 
                  style={{ minHeight: '44px' }} 
                />
              </div>
            </>
          )}
        </div>

        {/* Live Preview Console */}
        <h4 style={{ color: 'var(--color-text-primary)', marginBottom: '15px', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>👁️</span> Compliance Report Preview
        </h4>

        {reportLoading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Fetching data from POS database...</p>
          </div>
        ) : reportError ? (
          <div style={{ padding: '20px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', color: '#e74c3c', borderRadius: '8px', fontSize: '14px' }}>
            {reportError}
          </div>
        ) : !reportData || reportData.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No entries matching filter parameters</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Try choosing a wider date range or switching branches.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>S.No</th>
                  {Object.keys(reportData[0]).map((key) => {
                    let friendlyKey = key.replace(/([A-Z])/g, ' $1').trim();
                    friendlyKey = friendlyKey.charAt(0).toUpperCase() + friendlyKey.slice(1);
                    return (
                      <th key={key} style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {friendlyKey}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{idx + 1}</td>
                    {Object.keys(row).map((key) => {
                      let val = row[key];
                      if (key === 'date' || key === 'createdAt' || key === 'purchaseDate' || key === 'createdTime' || key === 'completedTime') {
                        val = new Date(val).toLocaleString();
                      }
                      if (typeof val === 'number') {
                        if (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('total') || key.toLowerCase().includes('salary') || key.toLowerCase().includes('wage') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('profit') || key === 'subtotal' || key === 'tax' || key === 'discount' || key === 'inventoryValue') {
                          val = `₹${val.toFixed(2)}`;
                        }
                      }
                      return (
                        <td key={key} style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

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
<label htmlFor="add-item-price" className="form-label">Price (₹) *</label>
<input type="number" id="add-item-price" name="add-item-price" required step="0.01" min="0.01" value={newItem.price} onChange={(e) =>setNewItem({ ...newItem, price: e.target.value })} className="form-input" />
</div>
{newItem.isCombo && (
<div className="form-group">
<label htmlFor="add-item-original-price" className="form-label">Orig. Price (₹)</label>
<input type="number" id="add-item-original-price" name="add-item-original-price" step="0.01" min="0.01" placeholder="Optional" value={newItem.originalPrice || ''} onChange={(e) =>setNewItem({ ...newItem, originalPrice: e.target.value })} className="form-input" />
</div>
)}
<div className="form-group">
<label htmlFor="add-item-category" className="form-label">Category *</label>
<select id="add-item-category" name="add-item-category" value={newItem.category} onChange={(e) =>setNewItem({ ...newItem, category: e.target.value })} className="form-input" disabled={newItem.isCombo}>
 {Array.from(new Set([...(categories.length >0 ? categories.map((c) =>c.name) : presetCategories), 'Combos'])).map((cat) =>
<option key={cat} value={cat}>{cat}</option>
)}
</select>
</div>
</div>
<div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
<label className="switch">
  <input type="checkbox" checked={newItem.isCombo || false} onChange={(e) => {
    const isCombo = e.target.checked;
    setNewItem({ ...newItem, isCombo, category: isCombo ? 'Combos' : newItem.category });
  }} />
  <span className="slider round"></span>
</label>
<span style={{ fontSize: '14px', fontWeight: 'bold' }}>Is this a Combo?</span>
</div>
<div className="form-group">
<label htmlFor="add-item-description" className="form-label">Description *</label>
<textarea id="add-item-description" name="add-item-description" required rows="3" value={newItem.description} onChange={(e) =>setNewItem({ ...newItem, description: e.target.value })} className="form-input"></textarea>
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
<div className="form-group" style={{ borderTop: '1px solid #432E22', paddingTop: '15px', marginTop: '15px' }}>
<span id="add-item-recipe-label" className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Recipe Mapping (Ingredients)</span>
 {!newItem.recipe || newItem.recipe.length === 0 ?
<p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '5px 0' }}>No ingredients mapped yet. This item will not deduct stock.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
 {newItem.recipe.map((ing, idx) =>{
 const invItem = inventoryList.find((i) =>i.name === ing.name);
 return (
<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '6px' }}>
<span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
<input type="number" value={ing.quantity} min="0.001" step="0.001" onChange={(e) => { const updated = [...newItem.recipe]; updated[idx].quantity = Number(e.target.value); setNewItem({ ...newItem, recipe: updated }); }} style={{ width: '60px', padding: '4px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent', textAlign: 'center' }} />
<span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{invItem?.unit || 'g'}</span>
<button type="button" onClick={() =>handleRemoveIngredientFromNewItem(ing.name)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
</div>
</div>);

 })}
</div>
 }
<div className="recipe-map-grid" aria-labelledby="add-item-recipe-label">
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="add-item-ingredient-select" className="form-label" style={{ fontSize: '11px' }}>Select Ingredient</label>
<select id="add-item-ingredient-select" name="add-item-ingredient-select" value={selectedIngredient} onChange={(e) =>setSelectedIngredient(e.target.value)} className="form-input" style={{ padding: '8px' }}>
<option value="">-- Choose Ingredient --</option>
 {inventoryList.map((inv) =>
<option key={inv._id} value={inv.name}>{inv.name} ({inv.unit})</option>
)}
</select>
</div>
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="add-item-ingredient-qty" className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
<input type="number" id="add-item-ingredient-qty" name="add-item-ingredient-qty" step="0.001" min="0.001" placeholder="e.g. 10" value={ingredientQuantity} onChange={(e) =>setIngredientQuantity(e.target.value)} className="form-input" style={{ padding: '8px' }} />
</div>
<button type="button" onClick={handleAddIngredientToNewItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>Map</button>
</div>
</div>
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
<label htmlFor="edit-item-price" className="form-label">Price (₹) *</label>
<input type="number" id="edit-item-price" name="edit-item-price" required step="0.01" min="0.01" value={editingItem.price} onChange={(e) =>setEditingItem({ ...editingItem, price: e.target.value })} className="form-input" />
</div>
{editingItem.isCombo && (
<div className="form-group">
<label htmlFor="edit-item-original-price" className="form-label">Orig. Price (₹)</label>
<input type="number" id="edit-item-original-price" name="edit-item-original-price" step="0.01" min="0.01" placeholder="Optional" value={editingItem.originalPrice || ''} onChange={(e) =>setEditingItem({ ...editingItem, originalPrice: e.target.value })} className="form-input" />
</div>
)}
<div className="form-group">
<label htmlFor="edit-item-category" className="form-label">Category *</label>
<select id="edit-item-category" name="edit-item-category" value={editingItem.category} onChange={(e) =>setEditingItem({ ...editingItem, category: e.target.value })} className="form-input" disabled={editingItem.isCombo}>
 {Array.from(new Set([...(categories.length >0 ? categories.map((c) =>c.name) : presetCategories), 'Combos'])).map((cat) =>
<option key={cat} value={cat}>{cat}</option>
)}
</select>
</div>
</div>
<div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
<label className="switch">
  <input type="checkbox" checked={editingItem.isCombo || false} onChange={(e) => {
    const isCombo = e.target.checked;
    setEditingItem({ ...editingItem, isCombo, category: isCombo ? 'Combos' : editingItem.category });
  }} />
  <span className="slider round"></span>
</label>
<span style={{ fontSize: '14px', fontWeight: 'bold' }}>Is this a Combo?</span>
</div>
<div className="form-group">
<label htmlFor="edit-item-description" className="form-label">Description *</label>
<textarea id="edit-item-description" name="edit-item-description" required rows="3" value={editingItem.description} onChange={(e) =>setEditingItem({ ...editingItem, description: e.target.value })} className="form-input"></textarea>
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
<div className="form-group" style={{ borderTop: '1px solid #432E22', paddingTop: '15px', marginTop: '15px' }}>
<span id="edit-item-recipe-label" className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Recipe Mapping (Ingredients)</span>
 {!editingItem.recipe || editingItem.recipe.length === 0 ?
<p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '5px 0' }}>No ingredients mapped yet. This item will not deduct stock.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
 {editingItem.recipe.map((ing, idx) =>{
 const invItem = inventoryList.find((i) =>i.name === ing.name);
 return (
<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '6px' }}>
<span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
<input type="number" value={ing.quantity} min="0.001" step="0.001" onChange={(e) => { const updated = [...editingItem.recipe]; updated[idx].quantity = Number(e.target.value); setEditingItem({ ...editingItem, recipe: updated }); }} style={{ width: '60px', padding: '4px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent', textAlign: 'center' }} />
<span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{invItem?.unit || 'g'}</span>
<button type="button" onClick={() =>handleRemoveIngredientFromEditingItem(ing.name)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
</div>
</div>);

 })}
</div>
 }
<div className="recipe-map-grid" aria-labelledby="edit-item-recipe-label">
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="edit-item-ingredient-select" className="form-label" style={{ fontSize: '11px' }}>Select Ingredient</label>
<select id="edit-item-ingredient-select" name="edit-item-ingredient-select" value={selectedIngredient} onChange={(e) =>setSelectedIngredient(e.target.value)} className="form-input" style={{ padding: '8px' }}>
<option value="">-- Choose Ingredient --</option>
 {inventoryList.map((inv) =>
<option key={inv._id} value={inv.name}>{inv.name} ({inv.unit})</option>
)}
</select>
</div>
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="edit-item-ingredient-qty" className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
<input type="number" id="edit-item-ingredient-qty" name="edit-item-ingredient-qty" step="0.001" min="0.001" placeholder="e.g. 10" value={ingredientQuantity} onChange={(e) =>setIngredientQuantity(e.target.value)} className="form-input" style={{ padding: '8px' }} />
</div>
<button type="button" onClick={handleAddIngredientToEditingItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>Map</button>
</div>
</div>
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

 {/* Edit existing Category */}
 {editingCategory &&
<form onSubmit={handleUpdateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255, 107, 8, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-primary)' }}>
<input
 type="text"
 id="rename-category-name"
 name="rename-category-name"
 aria-label="Rename Category Name"
 required
 placeholder="Rename category..."
 value={categoryNameInput}
 onChange={(e) =>setCategoryNameInput(e.target.value)}
 className="form-input"
 style={{ marginBottom: 0, flexGrow: 1 }} />
 
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
 Save
</button>
<button type="button" onClick={() =>{setEditingCategory(null);setCategoryNameInput('');}} className="btn btn-secondary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
 Cancel
</button>
</form>
 }

 {/* List Categories */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', margin: '0 0 5px 0' }}>Existing Categories (Drag or use arrows to reorder):</h4>
 {categoryLoading && categories.length === 0 ?
<div className="spinner" style={{ margin: '10px auto', borderColor: 'var(--color-primary)', width: '20px', height: '20px', borderWidth: '2px' }} />:

 (categories.length >0 ? categories : presetCategories.map((name, idx) =>({ _id: idx, name }))).map((cat, idx) =>
<div
 key={cat._id}
 draggable={cat._id && typeof cat._id === 'string'}
 onDragStart={(e) =>handleCategoryDragStart(e, idx)}
 onDragOver={handleCategoryDragOver}
 onDrop={(e) =>handleCategoryDrop(e, idx)}
 style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 background: 'rgba(0, 0, 0,0.02)',
 border: '1px solid var(--color-border)',
 padding: '10px 14px',
 borderRadius: '10px',
 cursor: cat._id && typeof cat._id === 'string' ? 'grab' : 'default',
 transition: 'all 0.2s ease',
 userSelect: 'none'
 }}
 onDragEnd={(e) =>{e.currentTarget.style.opacity = '1';}}
 onDragLeave={(e) =>{e.currentTarget.style.background = 'rgba(255,255,255,0.02)';}}
 onDragEnter={(e) =>{e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)';}}>
 
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 {cat._id && typeof cat._id === 'string' &&
<span style={{ color: 'var(--color-text-secondary)', cursor: 'grab', fontSize: '14px' }}></span>
 }
<span style={{ color: 'var(--color-text-primary)', fontSize: '14.5px', fontWeight: 700 }}>{cat.name}</span>
</div>
 
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 {/* Reordering arrows */}
 {cat._id && typeof cat._id === 'string' &&
<div style={{ display: 'flex', gap: '4px' }}>
<button
 type="button"
 disabled={idx === 0}
 onClick={() =>moveCategory(idx, 'up')}
 style={{
 background: 'rgba(0, 0, 0,0.04)',
 border: 'none',
 color: idx === 0 ? 'rgba(255,255,255,0.1)' : '#fff',
 borderRadius: '4px',
 padding: '4px 8px',
 cursor: idx === 0 ? 'not-allowed' : 'pointer',
 fontSize: '11px'
 }}>
 
 ▲
</button>
<button
 type="button"
 disabled={idx === categories.length - 1}
 onClick={() =>moveCategory(idx, 'down')}
 style={{
 background: 'rgba(0, 0, 0,0.04)',
 border: 'none',
 color: idx === categories.length - 1 ? 'rgba(255,255,255,0.1)' : '#fff',
 borderRadius: '4px',
 padding: '4px 8px',
 cursor: idx === categories.length - 1 ? 'not-allowed' : 'pointer',
 fontSize: '11px'
 }}>
 
 ▼
</button>
</div>
 }

 {/* Edit/Delete */}
 {cat._id && typeof cat._id === 'string' ?
<div style={{ display: 'flex', gap: '10px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
<button
 type="button"
 onClick={() =>{setEditingCategory(cat);setCategoryNameInput(cat.name);}}
 style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px' }}>
 
 
</button>
<button
 type="button"
 onClick={() =>handleDeleteCategory(cat._id)}
 style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '13px' }}>
 
 
</button>
</div>:

<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Preset</span>
 }
</div>
</div>
)
 }
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
<div className="form-group">
<label htmlFor="add-inv-name" className="form-label">Ingredient Name *</label>
<input type="text" id="add-inv-name" name="add-inv-name" required value={newInventoryItem.name} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, name: e.target.value })} className="form-input" placeholder="e.g. Tomato Sauce" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-stock" className="form-label">Initial Stock *</label>
<input type="number" id="add-inv-stock" name="add-inv-stock" required value={newInventoryItem.stock ?? ''} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, stock: e.target.value === '' ? '' : Number(e.target.value), quantity: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-inv-minstock" className="form-label">Safety Minimum *</label>
<input type="number" id="add-inv-minstock" name="add-inv-minstock" required value={newInventoryItem.minStock ?? ''} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, minStock: e.target.value === '' ? '' : Number(e.target.value), reorderLevel: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-unit" className="form-label">Unit of Measurement *</label>
<input type="text" id="add-inv-unit" name="add-inv-unit" required value={newInventoryItem.unit} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })} className="form-input" placeholder="e.g. kg, pcs, g, liters" />
</div>
<div className="form-group">
<label htmlFor="add-inv-cost" className="form-label">Cost per Unit (₹) *</label>
<input type="number" step="0.001" id="add-inv-cost" name="add-inv-cost" required value={newInventoryItem.cost ?? ''} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, cost: e.target.value === '' ? '' : Number(e.target.value), costPrice: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-sellingprice" className="form-label">Selling Price (₹) *</label>
<input type="number" step="0.01" id="add-inv-sellingprice" name="add-inv-sellingprice" required value={newInventoryItem.sellingPrice ?? ''} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, sellingPrice: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-inv-category" className="form-label">Category *</label>
<input type="text" id="add-inv-category" name="add-inv-category" required value={newInventoryItem.category} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, category: e.target.value })} className="form-input" placeholder="e.g. Ingredients, Dairy, Beverage Raw" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-supplier" className="form-label">Supplier *</label>
<input type="text" id="add-inv-supplier" name="add-inv-supplier" required value={newInventoryItem.supplier} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, supplier: e.target.value })} className="form-input" placeholder="Supplier name" />
</div>
<div className="form-group">
<label htmlFor="add-inv-branch" className="form-label">Branch *</label>
<input type="text" id="add-inv-branch" name="add-inv-branch" required value={newInventoryItem.branch} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, branch: e.target.value })} className="form-input" placeholder="e.g. Main, Uptown" />
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
<div className="form-group">
<label htmlFor="edit-inv-name" className="form-label">Ingredient Name *</label>
<input type="text" id="edit-inv-name" name="edit-inv-name" required value={editingInventoryItem.name} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, name: e.target.value })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-stock" className="form-label">Current Stock *</label>
<input type="number" id="edit-inv-stock" name="edit-inv-stock" required value={editingInventoryItem.quantity ?? ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, quantity: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-minstock" className="form-label">Safety Minimum *</label>
<input type="number" id="edit-inv-minstock" name="edit-inv-minstock" required value={editingInventoryItem.reorderLevel ?? ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, reorderLevel: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-unit" className="form-label">Unit of Measurement *</label>
<input type="text" id="edit-inv-unit" name="edit-inv-unit" required value={editingInventoryItem.unit ?? ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, unit: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-cost" className="form-label">Cost per Unit (₹) *</label>
<input type="number" step="0.001" id="edit-inv-cost" name="edit-inv-cost" required value={editingInventoryItem.costPrice ?? ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, costPrice: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-sellingprice" className="form-label">Selling Price (₹) *</label>
<input type="number" step="0.01" id="edit-inv-sellingprice" name="edit-inv-sellingprice" required value={editingInventoryItem.sellingPrice ?? ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, sellingPrice: e.target.value === '' ? '' : Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-category" className="form-label">Category *</label>
<input type="text" id="edit-inv-category" name="edit-inv-category" required value={editingInventoryItem.category || 'Ingredients'} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, category: e.target.value })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-supplier" className="form-label">Supplier *</label>
<input type="text" id="edit-inv-supplier" name="edit-inv-supplier" required value={editingInventoryItem.supplier || ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, supplier: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-branch" className="form-label">Branch *</label>
<input type="text" id="edit-inv-branch" name="edit-inv-branch" required value={editingInventoryItem.branch || 'Main'} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, branch: e.target.value })} className="form-input" />
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

 {/* MODAL: RECORD PURCHASE */}
 {showPurchaseModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Record Purchase Entry</h3>
<button onClick={() =>setShowPurchaseModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleRecordPurchase}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Ingredient:<strong>{purchaseForm.itemName}</strong></label>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Quantity Purchased *</label>
<input type="number" required min="1" value={purchaseForm.quantityAdded} onChange={(e) =>setPurchaseForm({ ...purchaseForm, quantityAdded: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Cost Price per Unit (₹) *</label>
<input type="number" step="0.001" required min="0.001" value={purchaseForm.costPrice} onChange={(e) =>setPurchaseForm({ ...purchaseForm, costPrice: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-group">
<label className="form-label">Supplier *</label>
<input type="text" required value={purchaseForm.supplier} onChange={(e) =>setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Notes</label>
<textarea value={purchaseForm.notes} onChange={(e) =>setPurchaseForm({ ...purchaseForm, notes: e.target.value })} className="form-input" rows="2" placeholder="e.g. Weekly restocking"></textarea>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowPurchaseModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Entry</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: RECORD WASTAGE */}
 {showWastageModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Record Wastage / Spoilage</h3>
<button onClick={() =>setShowWastageModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleRecordWastage}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Ingredient:<strong>{wastageForm.itemName}</strong></label>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Quantity Wasted *</label>
<input type="number" required min="1" value={wastageForm.quantityWasted} onChange={(e) =>setWastageForm({ ...wastageForm, quantityWasted: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Wastage Type *</label>
<select value={wastageForm.type} onChange={(e) =>setWastageForm({ ...wastageForm, type: e.target.value })} className="form-input">
<option value="Wastage">Spoiled / Expired (Wastage)</option>
<option value="Damaged">Damaged / Dropped (Damaged)</option>
</select>
</div>
</div>
<div className="form-group">
<label className="form-label">Reason / Notes *</label>
<input type="text" required value={wastageForm.reason} onChange={(e) =>setWastageForm({ ...wastageForm, reason: e.target.value })} className="form-input" placeholder="e.g. Power outage defrosted, dropped tray" />
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowWastageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Entry</button>
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
<h3 className="modal-title"> Edit Staff Member</h3>
<button onClick={() =>{setShowEditStaffModal(false);setEditingStaff(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditStaff}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Full Name *</label>
<input type="text" required value={editingStaff.name} onChange={(e) =>setEditingStaff({ ...editingStaff, name: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Email Address (Optional)</label>
<input type="email" value={editingStaff.email || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, email: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Phone Number *</label>
<input type="text" required value={editingStaff.phone} onChange={(e) =>setEditingStaff({ ...editingStaff, phone: e.target.value })} className="form-input" />
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
<div className="form-group">
<label className="form-label">Daily Wage (₹) *</label>
<input type="number" min="0" required value={editingStaff.dailyRate || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, dailyRate: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Staff Role *</label>
<select value={editingStaff.staffRole ? editingStaff.staffRole.toLowerCase() : ''} onChange={(e) =>setEditingStaff({ ...editingStaff, staffRole: e.target.value })} className="form-input">
<option value="chef">Chef</option>
<option value="waiter">Waiter</option>
<option value="barista">Barista</option>
<option value="cashier">Cashier</option>
<option value="manager">Manager</option>
<option value="staff">Staff / Server</option>
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
<label className="form-label">Branch Code *</label>
<input type="text" required value={newBranch.branchId} onChange={(e) =>setNewBranch({ ...newBranch, branchId: e.target.value })} className="form-input" placeholder="e.g. UPTN-01" />
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
<label className="form-label">Branch Code *</label>
<input type="text" required value={editingBranch.branchId || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, branchId: e.target.value })} className="form-input" />
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

</div>
</OwnerLayout>);

};

export default OwnerDashboard;