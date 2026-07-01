import React, { useState, useEffect } from 'react';
import { getCurrentEmployeePayroll } from '../services/api';

const EmployeePayrollPage = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [showSlipModal, setShowSlipModal] = useState(false);

  useEffect(() => {
    const fetchPayroll = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getCurrentEmployeePayroll();
        if (res.success) {
          setPayrolls(res.data || []);
        }
      } catch (err) {
        console.error('Error fetching employee payroll:', err);
        setError('Failed to load your payroll records. Please contact your manager.');
      } finally {
        setLoading(false);
      }
    };
    fetchPayroll();
  }, []);

  const openSlip = (pr) => {
    setSelectedPayroll(pr);
    setShowSlipModal(true);
  };

  const handlePrintSlip = () => {
    const printContent = document.getElementById('salary-slip-print').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // Pre-calculate stats
  const currentWeek = payrolls[0]; // most recent
  const pastWeekPayrolls = payrolls.slice(1);

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '1.8rem' }}>My Salary Station</h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>View your shift earnings, attendance logs, and download salary slip statements.</p>
      </div>

      {error && (
        <div style={{ background: '#FDF2F2', borderLeft: '4px solid #EC5B5B', color: '#8A2525', padding: '14px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
          Retrieving your payroll registry...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Section 1: Most Recent Week Summary */}
          {currentWeek ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              
              {/* Earnings Card */}
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px' }}>
                    Latest Week Earnings ({currentWeek.weekStart} to {currentWeek.weekEnd})
                  </h3>
                  
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Weekly Payout</span>
                    <strong style={{ fontSize: '2.5rem', color: 'var(--color-primary)', display: 'block', margin: '8px 0' }}>₹{currentWeek.netSalary.toFixed(2)}</strong>
                    <span style={{
                      background: currentWeek.paymentStatus === 'Paid' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                      color: currentWeek.paymentStatus === 'Paid' ? '#2ecc71' : '#f1c40f',
                      padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'
                    }}>
                      {currentWeek.paymentStatus}
                    </span>
                  </div>
                </div>

                <button onClick={() => openSlip(currentWeek)} style={{ width: '100%', background: 'var(--color-primary)', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>
                  📄 View Salary Slip Statement
                </button>
              </div>

              {/* Attendance & Breakdown Card */}
              <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px' }}>
                  Work Log & Pay Breakdown
                </h3>
                
                {/* Attendance Summary Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Present</div>
                    <strong style={{ color: '#2ecc71' }}>{currentWeek.presentDays}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Half Day</div>
                    <strong style={{ color: '#f1c40f' }}>{currentWeek.halfDays}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Leave</div>
                    <strong style={{ color: '#3498db' }}>{currentWeek.leaveDays}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Absent</div>
                    <strong style={{ color: '#e74c3c' }}>{currentWeek.absentDays}</strong>
                  </div>
                </div>

                {/* Salary breakdown list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Basic Salary Rate:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>₹{(currentWeek.basicSalary + currentWeek.halfDaySalary).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Hours Worked:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>{currentWeek.workingHours} hrs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Overtime hours:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>{currentWeek.overtimeHours} hrs (₹{currentWeek.overtimePay.toFixed(2)})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '6px', color: '#2ecc71' }}>
                    <span>Bonus Additions:</span>
                    <span>+₹{currentWeek.bonus || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '6px', color: '#e74c3c' }}>
                    <span>Deduction Subtractions:</span>
                    <span>-₹{currentWeek.deductions || 0}</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', border: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No payroll statements generated yet. Your payouts will appear here once generated by your manager.
            </div>
          )}

          {/* Section 2: Historical Statements */}
          {pastWeekPayrolls.length > 0 && (
            <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>Statement History</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Period</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Working Hours</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Net Paid</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Status</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)' }}>Payment Date</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-primary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastWeekPayrolls.map(pr => (
                      <tr key={pr._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{pr.weekStart} to {pr.weekEnd}</td>
                        <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>{pr.workingHours}h / {pr.overtimeHours}h OT</td>
                        <td style={{ padding: '12px', color: '#2ecc71', fontWeight: 'bold' }}>₹{pr.netSalary.toFixed(2)}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            background: pr.paymentStatus === 'Paid' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                            color: pr.paymentStatus === 'Paid' ? '#2ecc71' : '#f1c40f',
                            padding: '3px 8px', borderRadius: '15px', fontSize: '0.7rem', fontWeight: 'bold'
                          }}>
                            {pr.paymentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                          {pr.paymentDate ? new Date(pr.paymentDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button onClick={() => openSlip(pr)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Salary Slip</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SALARY SLIP MODAL */}
      {showSlipModal && selectedPayroll && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '600px', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Salary Invoice Slip</h3>
              <button onClick={() => setShowSlipModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
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
              <button type="button" onClick={() => setShowSlipModal(false)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={handlePrintSlip} style={{ flex: 1, padding: '12px', background: 'var(--color-primary)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print Slip Statement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeePayrollPage;
