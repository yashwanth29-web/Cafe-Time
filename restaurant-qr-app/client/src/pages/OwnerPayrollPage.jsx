import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  generatePayroll,
  getPayrollList,
  updatePayroll,
  payPayroll,
  deletePayroll,
  getPayrollReport,
  getStaff,
  updateStaff,
  getOrders
} from '../services/api';

const OwnerPayrollPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [payrolls, setPayrolls] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  // Date selection states (Default to current week: Monday to Sunday)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  });
  const [weekEnd, setWeekEnd] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7);
    const sunday = new Date(d.setDate(diff));
    return sunday.toISOString().split('T')[0];
  });

  // Modal and state management
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [activeModal, setActiveModal] = useState(null); // 'edit' | 'pay' | 'slip'
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  
  // Income States
  const [dailyIncome, setDailyIncome] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  // Edit Form state
  const [editForm, setEditForm] = useState({
    bonus: 0,
    deductions: 0,
    remarks: '',
    salaryType: 'DAILY',
    dailyRate: 0,
    hourlyRate: 0,
    weeklyRate: 0,
    monthlyRate: 0
  });
  // Pay Form state
  const [payForm, setPayForm] = useState({ paymentMethod: 'UPI', remarks: '' });

  // Sync data on tab change or week change
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Load payroll list for the selected week
      const prRes = await getPayrollList({ weekStart, weekEnd });
      if (prRes.success) {
        setPayrolls(prRes.data || []);
      }

      // 2. Load reports overview
      const repRes = await getPayrollReport();
      if (repRes.success) {
        setReportData(repRes);
      }

      // 3. Load active staff list
      const staffRes = await getStaff();
      if (staffRes.success) {
        setStaffList(staffRes.staff || []);
      }

      // 4. Load orders to compute actual daily and monthly income/revenue
      const ordersRes = await getOrders();
      if (ordersRes && ordersRes.success) {
        const completedOrders = (ordersRes.data || []).filter(o => o.paymentStatus === 'Paid');
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const todayRev = completedOrders
          .filter(o => new Date(o.createdAt) >= startOfToday)
          .reduce((acc, o) => acc + o.totalAmount, 0);
          
        const monthRev = completedOrders
          .filter(o => new Date(o.createdAt) >= startOfMonth)
          .reduce((acc, o) => acc + o.totalAmount, 0);
          
        setDailyIncome(todayRev);
        setMonthlyIncome(monthRev);
      }
    } catch (err) {
      console.error('Error loading payroll data:', err);
      setError('Failed to fetch payroll list or reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [weekStart, weekEnd, activeTab]);

  // Generate Payroll trigger
  const handleGeneratePayroll = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await generatePayroll(weekStart, weekEnd);
      if (res.success) {
        setSuccess(`Successfully generated payroll logs for ${res.summary.generatedCount} employees!`);
        loadData();
      }
    } catch (err) {
      console.error('Generate payroll error:', err);
      setError(err.response?.data?.message || 'Error occurred during payroll calculation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (pr) => {
    setSelectedPayroll(pr);
    setEditForm({
      bonus: pr.bonus || 0,
      deductions: pr.deductions || 0,
      remarks: pr.remarks || '',
      salaryType: pr.salaryType || 'DAILY',
      dailyRate: pr.dailyRate || 0,
      hourlyRate: pr.hourlyRate || 0,
      weeklyRate: pr.weeklyRate || 0,
      monthlyRate: pr.monthlyRate || 0
    });
    setActiveModal('edit');
  };

  // Submit Edit Form
  const handleUpdatePayroll = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      // 1. Update the employee's User profile
      await updateStaff(selectedPayroll.employeeId, {
        salaryType: editForm.salaryType,
        dailyRate: editForm.dailyRate,
        hourlyRate: editForm.hourlyRate,
        weeklyRate: editForm.weeklyRate,
        monthlyRate: editForm.monthlyRate
      });

      // 2. Update the current weekly payroll record
      const res = await updatePayroll(selectedPayroll._id, editForm);
      if (res.success) {
        setSuccess('Payroll record and employee rates saved successfully.');
        setActiveModal(null);
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update payroll details.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Pay Modal
  const openPayModal = (pr) => {
    setSelectedPayroll(pr);
    setPayForm({ paymentMethod: 'UPI', remarks: 'Paid weekly salary' });
    setActiveModal('pay');
  };

  // Submit Pay Form
  const handlePayPayroll = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      const res = await payPayroll(selectedPayroll._id, payForm);
      if (res.success) {
        setSuccess('Payroll marked as Paid successfully.');
        setActiveModal(null);
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process payment trigger.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Salary Slip
  const openSlipModal = (pr) => {
    setSelectedPayroll(pr);
    setActiveModal('slip');
  };

  // Delete pending payroll
  const handleDeletePayroll = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pending payroll log?')) return;
    setActionLoading(true);
    try {
      const res = await deletePayroll(id);
      if (res.success) {
        setSuccess('Pending payroll record deleted.');
        loadData();
      }
    } catch (err) {
      setError('Failed to delete pending payroll record.');
    } finally {
      setActionLoading(false);
    }
  };

  // Print Salary Slip Helper
  const handlePrintSlip = () => {
    const printContent = document.getElementById('salary-slip-print').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // reload to rebind react state
  };

  // Computed metrics for dashboard cards
  const totalEmployeesCount = staffList.length;
  const payrollsGeneratedThisWeek = payrolls.length;
  const totalWeeklyExpenses = payrolls.reduce((sum, r) => sum + r.netSalary, 0);
  const totalPaidExpenses = payrolls.filter(r => r.paymentStatus === 'Paid').reduce((sum, r) => sum + r.netSalary, 0);
  const totalPendingExpenses = payrolls.filter(r => r.paymentStatus === 'Pending').reduce((sum, r) => sum + r.netSalary, 0);
  const averageWeeklySalary = payrollsGeneratedThisWeek > 0 ? (totalWeeklyExpenses / payrollsGeneratedThisWeek).toFixed(2) : '0.00';

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
      {/* Toast Alert Messages */}
      {success && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#2ecc71', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 10000, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          ✅ {success}
          <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: 'white', marginLeft: '10px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}
      {error && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#e74c3c', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 10000, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'white', marginLeft: '10px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '1.8rem' }}>Weekly Payroll Station</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Generate, review, and process staff weekly payouts based on attendance logs.</p>
        </div>

        {/* Date Selector & Generation Panel */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Week Start</label>
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Week End</label>
            <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
          </div>
          <button
            onClick={handleGeneratePayroll}
            disabled={actionLoading}
            style={{
              marginTop: '16px',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #d45900 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(255, 107, 8, 0.2)'
            }}
          >
            {actionLoading ? 'Calculating...' : '⚡ Generate Weekly Payroll'}
          </button>
        </div>
      </div>

      {/* Internal Tabs Menu */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', marginBottom: '24px', paddingBottom: '1px' }}>
        {['dashboard', 'payroll', 'history', 'reports'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--color-text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid var(--color-primary)' : 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'payroll' ? 'Weekly Payroll Logs' : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
          Loading Payroll Module details...
        </div>
      ) : (
        <>
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div>
              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1) 0%, rgba(46, 204, 113, 0.02) 100%)', padding: '20px', borderRadius: '12px', border: '1px solid #2ecc71', boxShadow: '0 4px 12px rgba(46, 204, 113, 0.08)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#2ecc71', textTransform: 'uppercase', fontWeight: 'bold' }}>Today's Cafe Income</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2ecc71', marginTop: '8px' }}>₹{dailyIncome.toFixed(2)}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(52, 152, 219, 0.02) 100%)', padding: '20px', borderRadius: '12px', border: '1px solid #3498db', boxShadow: '0 4px 12px rgba(52, 152, 219, 0.08)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#3498db', textTransform: 'uppercase', fontWeight: 'bold' }}>Monthly Cafe Income</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3498db', marginTop: '8px' }}>₹{monthlyIncome.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Active Staff</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '8px' }}>{totalEmployeesCount}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Logs Generated</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '8px' }}>{payrollsGeneratedThisWeek}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Weekly Payroll Cost</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '8px' }}>₹{totalWeeklyExpenses.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Paid Amount</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2ecc71', marginTop: '8px' }}>₹{totalPaidExpenses.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Pending Cost</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e74c3c', marginTop: '8px' }}>₹{totalPendingExpenses.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Avg Employee Weekly Pay</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '8px' }}>₹{averageWeeklySalary}</div>
                </div>
              </div>

              {/* Status Section */}
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontWeight: 800 }}>Week {weekStart} to {weekEnd} Review</h3>
                {payrolls.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
                    No payroll data calculated for this week yet. Select a date range above and click <strong>Generate Weekly Payroll</strong>.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      Currently showing <strong>{payrolls.length}</strong> payroll logs. 
                      ({payrolls.filter(p => p.paymentStatus === 'Paid').length} Paid, {payrolls.filter(p => p.paymentStatus === 'Pending').length} Pending).
                    </p>
                    <button onClick={() => setActiveTab('payroll')} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Open Payroll Worksheet →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PAYROLL WORKSHEET / LIST */}
          {activeTab === 'payroll' && (
            <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Employee</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Role</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)', textAlign: 'center' }}>Attendance (P/H/L/A)</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Hours (Regular/OT)</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Basic Salary</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Bonus (₹)</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Deduction (₹)</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Net Payout</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Status</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-primary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        No records calculated. Click Generate to compile worksheet logs.
                      </td>
                    </tr>
                  ) : (
                    payrolls.map(pr => (
                      <tr key={pr._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{pr.employeeName}</td>
                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{pr.employeeRole}</td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>{pr.presentDays}</span> / 
                          <span style={{ color: '#F39C12', fontWeight: 'bold' }}> {pr.halfDays}</span> / 
                          <span style={{ color: '#3498db', fontWeight: 'bold' }}> {pr.leaveDays}</span> / 
                          <span style={{ color: '#e74c3c', fontWeight: 'bold' }}> {pr.absentDays}</span>
                        </td>
                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>
                          {pr.workingHours} hrs / <span style={{ color: 'var(--color-primary)' }}>{pr.overtimeHours} hrs OT</span>
                        </td>
                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>
                          ₹{(pr.basicSalary + pr.halfDaySalary).toFixed(2)}
                          {pr.overtimePay > 0 && <div style={{ fontSize: '0.75rem', color: '#2ecc71' }}>+₹{pr.overtimePay.toFixed(2)} OT</div>}
                        </td>
                        <td style={{ padding: '16px', color: '#2ecc71', fontWeight: '500' }}>+₹{pr.bonus || 0}</td>
                        <td style={{ padding: '16px', color: '#e74c3c', fontWeight: '500' }}>-₹{pr.deductions || 0}</td>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>₹{pr.netSalary.toFixed(2)}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            background: pr.paymentStatus === 'Paid' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                            color: pr.paymentStatus === 'Paid' ? '#2ecc71' : '#f1c40f',
                            padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'
                          }}>
                            {pr.paymentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => openSlipModal(pr)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Slip</button>
                            {pr.paymentStatus === 'Pending' ? (
                              <>
                                <button onClick={() => openEditModal(pr)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Adjust</button>
                                <button onClick={() => openPayModal(pr)} style={{ background: 'var(--color-primary)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Pay</button>
                                <button onClick={() => handleDeletePayroll(pr._id)} style={{ background: 'transparent', border: '1px solid rgba(231,76,60,0.5)', color: '#e74c3c', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '4px' }}>Paid ✔</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SALARY PAYMENT HISTORY */}
          {activeTab === 'history' && (
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontWeight: 800 }}>Paid Payroll Registry</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Employee</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Week Period</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Net Paid</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Payment Method</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Disbursement Date</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.filter(p => p.paymentStatus === 'Paid').length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No paid records found in the selected range.</td>
                      </tr>
                    ) : (
                      payrolls.filter(p => p.paymentStatus === 'Paid').map(pr => (
                        <tr key={pr._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{pr.employeeName}</td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{pr.weekStart} to {pr.weekEnd}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#2ecc71' }}>₹{pr.netSalary.toFixed(2)}</td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{pr.paymentMethod}</td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{new Date(pr.paymentDate).toLocaleDateString()}</td>
                          <td style={{ padding: '12px' }}>
                            <button onClick={() => openSlipModal(pr)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>View Slip</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EXPENSES & REPORTS */}
          {activeTab === 'reports' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontWeight: 800 }}>Branch Salary Disbursements</h3>
                {reportData?.branchReports && reportData.branchReports.length > 0 ? (
                  reportData.branchReports.map((br, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Branch: {br.branchId === 'default' ? 'Primary Cafe' : br.branchId}</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>Paid: ₹{br.totalPaid.toFixed(2)} | Pending: ₹{br.totalPending.toFixed(2)}</strong>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>No branch report metrics.</div>
                )}
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontWeight: 800 }}>Employee Cost Contribution</h3>
                {reportData?.employeeReports && reportData.employeeReports.length > 0 ? (
                  reportData.employeeReports.slice(0, 5).map((er, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{er.name}</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{er.role}</span>
                      </div>
                      <strong style={{ color: 'var(--color-primary)', alignSelf: 'center' }}>Total Paid: ₹{er.totalEarned.toFixed(2)}</strong>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>No employee disbursement stats yet.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedPayroll && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>Adjust Payroll: {selectedPayroll.employeeName}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>Modify bonus and deductions before payroll disbursement approval.</p>
            <form onSubmit={handleUpdatePayroll}>
              <div style={{ marginBottom: '16px', borderBottom: '1px dashed var(--color-border)', paddingBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-primary)', marginBottom: '8px', fontWeight: 'bold' }}>SALARY CONFIGURATION</label>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Salary Type</label>
                  <select value={editForm.salaryType} onChange={(e) => setEditForm({ ...editForm, salaryType: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }}>
                    <option value="DAILY">Daily Rate</option>
                    <option value="HOURLY">Hourly Rate</option>
                    <option value="WEEKLY">Weekly Rate</option>
                    <option value="MONTHLY">Monthly Rate</option>
                  </select>
                </div>

                {editForm.salaryType === 'DAILY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Daily Rate (₹)</label>
                    <input type="number" required min="0" value={editForm.dailyRate} onChange={(e) => setEditForm({ ...editForm, dailyRate: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                  </div>
                )}

                {editForm.salaryType === 'HOURLY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Hourly Rate (₹)</label>
                    <input type="number" required min="0" value={editForm.hourlyRate} onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                  </div>
                )}

                {editForm.salaryType === 'WEEKLY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Weekly Rate (₹)</label>
                    <input type="number" required min="0" value={editForm.weeklyRate} onChange={(e) => setEditForm({ ...editForm, weeklyRate: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                  </div>
                )}

                {editForm.salaryType === 'MONTHLY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Monthly Rate (₹)</label>
                    <input type="number" required min="0" value={editForm.monthlyRate} onChange={(e) => setEditForm({ ...editForm, monthlyRate: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                  </div>
                )}

                {editForm.salaryType !== 'HOURLY' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Hourly Overtime Rate (₹)</label>
                    <input type="number" min="0" value={editForm.hourlyRate} onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Bonus (₹)</label>
                  <input type="number" required min="0" value={editForm.bonus} onChange={(e) => setEditForm({ ...editForm, bonus: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Deductions (₹)</label>
                  <input type="number" required min="0" value={editForm.deductions} onChange={(e) => setEditForm({ ...editForm, deductions: e.target.value })} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Remarks / Memo</label>
                <textarea value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', height: '80px', resize: 'none' }} placeholder="Notes about salary details..." />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={{ flex: 1, padding: '12px', background: 'var(--color-primary)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY MODAL */}
      {activeModal === 'pay' && selectedPayroll && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>Disburse Salary: {selectedPayroll.employeeName}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Verify payout details before confirming payment registration:</p>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Net Salary Payout:</span>
                <strong style={{ color: 'var(--color-primary)' }}>₹{selectedPayroll.netSalary.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                <span>Regular Shift basic:</span>
                <span>₹{(selectedPayroll.basicSalary + selectedPayroll.halfDaySalary).toFixed(2)}</span>
              </div>
              {selectedPayroll.overtimePay > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  <span>Overtime Pay:</span>
                  <span>₹{selectedPayroll.overtimePay.toFixed(2)}</span>
                </div>
              )}
            </div>
            <form onSubmit={handlePayPayroll}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Payment Method *</label>
                <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }}>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                  <option value="Cash">Cash payment</option>
                  <option value="Cheque">Cheque payout</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Memo</label>
                <input value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={{ flex: 1, padding: '12px', background: '#2ecc71', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Confirm Paid ✔</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALARY SLIP MODAL */}
      {activeModal === 'slip' && selectedPayroll && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '600px', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Salary Invoice Slip</h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
            </div>

            {/* Printable Area */}
            <div id="salary-slip-print" style={{ padding: '24px', background: 'white', color: '#333', borderRadius: '12px', border: '1px solid #ddd', fontFamily: 'monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '12px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#6F4E37', fontWeight: 'bold', fontSize: '1.5rem' }}>☕ Cypher's Café</h2>
                  <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.8rem' }}>Authentic Coffee & Dining</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: 0, fontWeight: 'bold' }}>SALARY SLIP</h4>
                  <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.8rem' }}>Week Ending: {selectedPayroll.weekEnd}</p>
                </div>
              </div>

              {/* Employee info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '16px', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ marginBottom: '4px' }}><strong>Employee Name:</strong> {selectedPayroll.employeeName}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Role:</strong> <span style={{ textTransform: 'capitalize' }}>{selectedPayroll.employeeRole}</span></div>
                  <div><strong>Salary Type:</strong> {selectedPayroll.salaryType}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: '4px' }}><strong>Week Range:</strong> {selectedPayroll.weekStart} to {selectedPayroll.weekEnd}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Payment Status:</strong> {selectedPayroll.paymentStatus}</div>
                  {selectedPayroll.paymentDate && <div><strong>Date Paid:</strong> {new Date(selectedPayroll.paymentDate).toLocaleDateString()}</div>}
                </div>
              </div>

              {/* Attendance breakdown */}
              <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #333', paddingBottom: '4px', fontSize: '0.9rem' }}>ATTENDANCE SUMMARY</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px', fontSize: '0.8rem', textAlign: 'center' }}>
                <div style={{ background: '#f5f5f5', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ color: '#666' }}>Present</div>
                  <strong>{selectedPayroll.presentDays}</strong>
                </div>
                <div style={{ background: '#f5f5f5', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ color: '#666' }}>Half Day</div>
                  <strong>{selectedPayroll.halfDays}</strong>
                </div>
                <div style={{ background: '#f5f5f5', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ color: '#666' }}>Leave</div>
                  <strong>{selectedPayroll.leaveDays}</strong>
                </div>
                <div style={{ background: '#f5f5f5', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ color: '#666' }}>Absent</div>
                  <strong>{selectedPayroll.absentDays}</strong>
                </div>
                <div style={{ background: '#f5f5f5', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ color: '#666' }}>Hours Worked</div>
                  <strong>{selectedPayroll.workingHours}h</strong>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #333', paddingBottom: '4px', fontSize: '0.9rem' }}>PAY DETAILS</h4>
              <div style={{ fontSize: '0.85rem', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
                  <span>Basic Regular Shift Pay:</span>
                  <span>₹{(selectedPayroll.basicSalary + selectedPayroll.halfDaySalary).toFixed(2)}</span>
                </div>
                {selectedPayroll.overtimeHours > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
                    <span>Overtime Hours ({selectedPayroll.overtimeHours} hrs):</span>
                    <span>₹{selectedPayroll.overtimePay.toFixed(2)}</span>
                  </div>
                )}
                {selectedPayroll.bonus > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee', color: '#2e7d32' }}>
                    <span>Bonus Additions:</span>
                    <span>+₹{selectedPayroll.bonus.toFixed(2)}</span>
                  </div>
                )}
                {selectedPayroll.deductions > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee', color: '#c62828' }}>
                    <span>Deduction Subtractions:</span>
                    <span>-₹{selectedPayroll.deductions.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '1.05rem', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                  <span>NET PAYOUT DISBURSED:</span>
                  <span>₹{selectedPayroll.netSalary.toFixed(2)}</span>
                </div>
              </div>

              {/* Remarks and signature */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', fontSize: '0.75rem', marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                <div>
                  <strong>Remarks / Memo:</strong>
                  <p style={{ margin: '4px 0 0 0', color: '#666' }}>{selectedPayroll.remarks || 'Standard payroll disbursement. Thank you for your work!'}</p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', height: '60px' }}>
                  <div style={{ borderTop: '1px solid #333', width: '100px', textAlign: 'center', paddingTop: '4px', fontWeight: 'bold' }}>Manager Sign</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setActiveModal(null)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={handlePrintSlip} style={{ flex: 1, padding: '12px', background: 'var(--color-primary)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print / Download PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerPayrollPage;
