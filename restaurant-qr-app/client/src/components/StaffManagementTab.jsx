import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StaffManagementTab = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  const [activeModal, setActiveModal] = useState(null);
  const [form, setForm] = useState({ 
    name: '', phone: '', email: '', staffRole: 'staff', isActive: true,
    salaryType: 'DAILY', dailyRate: 0, hourlyRate: 0, weeklyRate: 0, monthlyRate: 0,
    weeklyOff: 'Sunday', joiningDate: new Date().toISOString().split('T')[0], salaryStatus: 'ACTIVE'
  });
  const [editingId, setEditingId] = useState(null);

  const showToast = (msg, isOk = true) => {
    setToast({ msg, isOk });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/staff', { withCredentials: true });
      if (res.data.success) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      showToast('Failed to load staff list', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenAdd = () => {
    setForm({ 
      name: '', phone: '', email: '', staffRole: 'staff', isActive: true,
      salaryType: 'DAILY', dailyRate: 0, hourlyRate: 0, weeklyRate: 0, monthlyRate: 0,
      weeklyOff: 'Sunday', joiningDate: new Date().toISOString().split('T')[0], salaryStatus: 'ACTIVE'
    });
    setEditingId(null);
    setActiveModal('form');
  };

  const handleOpenEdit = (staff) => {
    setForm({
      name: staff.name,
      phone: staff.phone,
      email: staff.email || '',
      staffRole: staff.staffRole || staff.role,
      isActive: staff.isActive !== false,
      salaryType: staff.salaryType || 'DAILY',
      dailyRate: staff.dailyRate || 0,
      hourlyRate: staff.hourlyRate || 0,
      weeklyRate: staff.weeklyRate || 0,
      monthlyRate: staff.monthlyRate || 0,
      weeklyOff: staff.weeklyOff || 'Sunday',
      joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      salaryStatus: staff.salaryStatus || 'ACTIVE'
    });
    setEditingId(staff._id);
    setActiveModal('form');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/admin/staff/${editingId}`, form, { withCredentials: true });
        showToast('Staff updated successfully');
      } else {
        await axios.post('/api/admin/create-staff', form, { withCredentials: true });
        showToast('Staff created successfully');
      }
      setActiveModal(null);
      loadStaff();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving staff', false);
    }
  };

  const toggleStatus = async (staff) => {
    try {
      await axios.put(`/api/admin/staff/${staff._id}`, { isActive: !staff.isActive }, { withCredentials: true });
      loadStaff();
    } catch (err) {
      showToast('Failed to update status', false);
    }
  };

  const handleDelete = async (staff) => {
    if (!window.confirm(`Are you sure you want to delete ${staff.name}?`)) return;
    try {
      await axios.delete(`/api/admin/staff/${staff._id}`, { withCredentials: true });
      showToast('Staff deleted successfully');
      loadStaff();
    } catch (err) {
      showToast('Failed to delete staff', false);
    }
  };

  const fld = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ padding: '20px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.isOk ? '#2ecc71' : '#e74c3c', color: 'white',
          padding: '10px 20px', borderRadius: '8px', zIndex: 9999, fontWeight: 'bold'
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Staff Management</h2>
        <button 
          onClick={handleOpenAdd}
          style={{ background: 'var(--color-primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + Add New Staff
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Loading staff...</div>
      ) : staffList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
          No staff members found. Add one to get started.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Staff Details</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Role</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Salary Rate</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Performance</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Status</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(staff => (
                <tr key={staff._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{staff.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{staff.phone}</div>
                    {staff.email && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', opacity: 0.8 }}>{staff.email}</div>}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      background: 'var(--color-border)', color: 'var(--color-text-primary)', 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', textTransform: 'capitalize', fontWeight: 'bold' 
                    }}>
                      {staff.staffRole || staff.role}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Joined {new Date(staff.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                      {staff.salaryType || 'DAILY'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                      {staff.salaryType === 'DAILY' && `₹${staff.dailyRate || 0}/day`}
                      {staff.salaryType === 'HOURLY' && `₹${staff.hourlyRate || 0}/hr`}
                      {staff.salaryType === 'WEEKLY' && `₹${staff.weeklyRate || 0}/wk`}
                      {staff.salaryType === 'MONTHLY' && `₹${staff.monthlyRate || 0}/mo`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Off: {staff.weeklyOff || 'Sunday'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                      <strong>{staff.ordersHandledToday || 0}</strong> orders today
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      Last Login: {staff.lastLogin ? new Date(staff.lastLogin).toLocaleDateString() : 'Never'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span 
                      style={{ 
                        background: staff.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)', 
                        color: staff.isActive ? '#2ecc71' : '#e74c3c', 
                        padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleStatus(staff)}
                      title="Click to toggle status"
                    >
                      {staff.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button onClick={() => handleOpenEdit(staff)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', marginRight: '8px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(staff)} style={{ background: 'transparent', border: '1px solid rgba(231, 76, 60, 0.5)', color: '#e74c3c', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {activeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--color-text-primary)' }}>{editingId ? 'Edit Staff Member' : 'Add New Staff'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Full Name *</label>
                <input required value={form.name} onChange={fld('name')} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Phone Number *</label>
                <input required value={form.phone} onChange={fld('phone')} type="tel" style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Email Address (Optional)</label>
                <input value={form.email} onChange={fld('email')} type="email" style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} placeholder="Required for web dashboard access" />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Role *</label>
                <select value={form.staffRole} onChange={fld('staffRole')} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}>
                  <option value="staff">General Staff</option>
                  <option value="waiter">Waiter</option>
                  <option value="chef">Chef / Kitchen</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              {/* Salary Configuration Fields */}
              <div style={{ borderTop: '1px solid var(--color-border)', pt: '12px', mt: '12px', mb: '16px' }}>
                <h4 style={{ margin: '12px 0 10px 0', color: 'var(--color-primary)', fontSize: '0.95rem' }}>Salary & Payroll Configuration</h4>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Salary Type *</label>
                  <select value={form.salaryType} onChange={fld('salaryType')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}>
                    <option value="DAILY">Daily Pay (rate per day completed)</option>
                    <option value="HOURLY">Hourly Pay (rate per active hours)</option>
                    <option value="WEEKLY">Weekly Salaried (fixed weekly amount)</option>
                    <option value="MONTHLY">Monthly Salaried (fixed monthly amount)</option>
                  </select>
                </div>

                {form.salaryType === 'DAILY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Daily Rate (₹) *</label>
                    <input type="number" required min="0" value={form.dailyRate} onChange={fld('dailyRate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                )}

                {form.salaryType === 'HOURLY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Hourly Rate (₹) *</label>
                    <input type="number" required min="0" value={form.hourlyRate} onChange={fld('hourlyRate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                )}

                {form.salaryType === 'WEEKLY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Weekly Rate (₹) *</label>
                    <input type="number" required min="0" value={form.weeklyRate} onChange={fld('weeklyRate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                )}

                {form.salaryType === 'MONTHLY' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Monthly Rate (₹) *</label>
                    <input type="number" required min="0" value={form.monthlyRate} onChange={fld('monthlyRate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                )}

                {/* Overtime Rate Configuration */}
                {(form.salaryType === 'DAILY' || form.salaryType === 'WEEKLY' || form.salaryType === 'MONTHLY') && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Overtime Hourly Rate (₹) - Optional</label>
                    <input type="number" min="0" value={form.hourlyRate} onChange={fld('hourlyRate')} placeholder="Leave 0 to use auto prorated rate" style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Weekly Off *</label>
                    <select value={form.weeklyOff} onChange={fld('weeklyOff')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}>
                      <option value="Sunday">Sunday</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Joining Date *</label>
                    <input type="date" required value={form.joiningDate} onChange={fld('joiningDate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--color-primary)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementTab;
