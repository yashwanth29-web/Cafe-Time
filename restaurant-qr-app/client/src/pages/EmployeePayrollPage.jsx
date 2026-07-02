import React, { useState, useEffect } from 'react';
import { getCurrentEmployeePayroll } from '../services/api';

const EmployeePayrollPage = () => {
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSalaryInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCurrentEmployeePayroll();
      if (res.success && res.salaryData) {
        setSalaryData(res.salaryData);
      } else {
        setError('No salary data retrieved.');
      }
    } catch (err) {
      console.error('Error fetching employee salary:', err);
      setError('Failed to load your salary calculations. Please check in with your manager.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryInfo();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '1.8rem' }}>My Salary Station</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>View your attendance shift logs, calculated daily rates, and total weekly earnings.</p>
        </div>
        <button 
          onClick={fetchSalaryInfo} 
          className="btn btn-primary"
          style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          Refresh Earnings
        </button>
      </div>

      {error && (
        <div style={{ background: '#FDF2F2', borderLeft: '4px solid #EC5B5B', color: '#8A2525', padding: '14px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div style={{ border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
          Retrieving your weekly salary metrics...
        </div>
      ) : salaryData ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Section 1: Dashboard Earnings Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            {/* Net Earnings Summary */}
            <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px' }}>
                  Current Week Earnings
                </h3>
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Weekly Salary</span>
                  <strong style={{ fontSize: '2.8rem', color: 'var(--color-primary)', display: 'block', margin: '8px 0' }}>₹{salaryData.currentWeekSalary || 0}</strong>
                  <span style={{ background: 'rgba(143,168,155,0.15)', color: 'var(--color-primary)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    Period: {salaryData.weekStart || 'N/A'} - {salaryData.weekEnd || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.05)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <div>Daily Rate: <strong style={{ color: 'var(--color-text-primary)' }}>₹{salaryData.dailyRate || 0}/day</strong></div>
                <div>Req. Hours: <strong style={{ color: 'var(--color-text-primary)' }}>{salaryData.requiredHours || 8} hrs/day</strong></div>
              </div>
            </div>

            {/* Attendance & Shift Hours Card */}
            <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 800, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px' }}>
                Weekly Breakdown Summary
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Hours Worked</div>
                  <strong style={{ color: 'var(--color-primary)', fontSize: '1.4rem' }}>{salaryData.actualHoursWorked || 0} hrs</strong>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Working Days</div>
                  <strong style={{ color: '#2ecc71', fontSize: '1.4rem' }}>{salaryData.workingDays || 0} days</strong>
                </div>
              </div>

              {/* Day-by-Day breakdown grid */}
              <div style={{ 
                padding: '10px', 
                background: 'rgba(0,0,0,0.15)', 
                borderRadius: '8px',
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
                fontSize: '11px',
                border: '1px solid var(--color-border)'
              }}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '9px', fontWeight: 600 }}>{day.slice(0, 3)}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', marginTop: '2px' }}>₹{salaryData.weeklyBreakdown?.[day] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Section 2: Detailed Logs Table */}
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)', fontSize: '1.25rem', fontWeight: 800 }}>Attendance Shift Logs & Daily Calculated Salary</h3>
            {(!salaryData.attendances || salaryData.attendances.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                No completed attendance records found for this week.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                      <th style={{ padding: '12px 10px' }}>Date</th>
                      <th style={{ padding: '12px 10px' }}>Check In</th>
                      <th style={{ padding: '12px 10px' }}>Check Out</th>
                      <th style={{ padding: '12px 10px' }}>Worked Hours</th>
                      <th style={{ padding: '12px 10px' }}>Daily Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryData.attendances.map((att, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{att.date}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--color-text-secondary)' }}>
                          {new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--color-text-secondary)' }}>
                          {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{att.workingHours || 0} hrs</td>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold', color: 'var(--color-primary)' }}>₹{att.dailySalary || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', border: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No salary calculations found for this period.
        </div>
      )}
    </div>
  );
};

export default EmployeePayrollPage;
