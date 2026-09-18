import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { resetStaffPasswordApi } from '../services/api';

const StaffManagementTab = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  const [activeModal, setActiveModal] = useState(null);
  const [resetModalStaff, setResetModalStaff] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [form, setForm] = useState({ 
    name: '', username: '', password: '', phone: '', email: '', staffRole: 'staff', isActive: true,
    salaryType: 'DAILY', dailyRate: 0, hourlyRate: 0, weeklyRate: 0, monthlyRate: 0,
    weeklyOff: 'Sunday', joiningDate: new Date().toISOString().split('T')[0], salaryStatus: 'ACTIVE'
  });
  const [editingId, setEditingId] = useState(null);

  const showToast = (msg, isOk = true) => {
    setToast({ msg, isOk });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/staff', { withCredentials: true });
      if (res.data.success) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      showToast('Failed to load staff list', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleOpenAdd = () => {
    setForm({ 
      name: '', username: '', password: '', phone: '', email: '', staffRole: 'staff', isActive: true,
      salaryType: 'DAILY', dailyRate: 0, hourlyRate: 0, weeklyRate: 0, monthlyRate: 0,
      weeklyOff: 'Sunday', joiningDate: new Date().toISOString().split('T')[0], salaryStatus: 'ACTIVE'
    });
    setEditingId(null);
    setActiveModal('form');
  };

  const handleOpenEdit = (staff) => {
    setForm({
      name: staff.name,
      username: staff.username || '',
      password: '',
      phone: staff.phone || '',
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
        showToast('Staff created successfully with login access');
      }
      setActiveModal(null);
      loadStaff();
    } catch (err) {
      console.error('Error saving staff:', err);
      showToast(err.response?.data?.message || 'Error saving staff', false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetModalStaff || !newPasswordInput.trim()) return;
    try {
      await resetStaffPasswordApi(resetModalStaff._id, newPasswordInput.trim());
      showToast(`Password for ${resetModalStaff.name} reset successfully!`);
      setResetModalStaff(null);
      setNewPasswordInput('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reset password', false);
    }
  };

  const toggleStatus = async (staff) => {
    try {
      await axios.put(`/api/admin/staff/${staff._id}`, { isActive: !staff.isActive }, { withCredentials: true });
      loadStaff();
    } catch (err) {
      console.error('Error updating status:', err);
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
      console.error('Error deleting staff:', err);
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
        <div>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Staff Management</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Manage employee login credentials, roles, and wages
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          style={{ background: 'var(--color-primary, #D47F46)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
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
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Login Username</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Role</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Salary Rate</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)' }}>Status</th>
                <th style={{ padding: '16px', color: 'var(--color-text-primary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(staff => (
                <tr key={staff._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{staff.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{staff.phone || 'No phone'}</div>
                    {staff.email && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', opacity: 0.8 }}>{staff.email}</div>}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      background: 'rgba(212, 127, 70, 0.1)', 
                      color: 'var(--color-primary, #D47F46)', 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      fontSize: '0.85rem', 
                      fontWeight: 'bold' 
                    }}>
                      @{staff.username || 'n/a'}
                    </span>
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
                    <span 
                      style={{ 
                        background: staff.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)', 
                        color: staff.isActive ? '#2ecc71' : '#e74c3c', 
                        padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleStatus(staff)}
                      title="Click to toggle active status"
                    >
                      {staff.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => { setResetModalStaff(staff); setNewPasswordInput(''); }}
                      style={{ background: 'rgba(212, 127, 70, 0.1)', border: '1px solid rgba(212, 127, 70, 0.3)', color: 'var(--color-primary, #D47F46)', padding: '6px 10px', borderRadius: '6px', marginRight: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                    >
                      Reset Pass
                    </button>
                    <button onClick={() => handleOpenEdit(staff)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '6px 10px', borderRadius: '6px', marginRight: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                    <button onClick={() => handleDelete(staff)} style={{ background: 'transparent', border: '1px solid rgba(231, 76, 60, 0.5)', color: '#e74c3c', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
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
          <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '440px', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--color-text-primary)' }}>{editingId ? 'Edit Staff Member' : 'Add New Staff'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Full Name *</label>
                <input required value={form.name} onChange={fld('name')} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} placeholder="e.g. Rahul Sharma" />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                  Login Username {editingId ? '(Read-only)' : '*'}
                </label>
                <input 
                  required={!editingId}
                  disabled={!!editingId}
                  value={form.username} 
                  onChange={fld('username')} 
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} 
                  placeholder="e.g. rahul_waiter (unique login name)" 
                />
              </div>

              {!editingId && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Initial Password (Optional)</label>
                  <input 
                    type="password"
                    value={form.password} 
                    onChange={fld('password')} 
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} 
                    placeholder="Defaults to Cafe@12345" 
                  />
                </div>
              )}
              
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Phone Number</label>
                <input value={form.phone} onChange={fld('phone')} type="tel" style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} placeholder="e.g. +91 9876543210" />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>Role *</label>
                <select value={form.staffRole || 'staff'} onChange={fld('staffRole')} style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}>
                  <option value="staff">Staff</option>
                </select>
              </div>

              {/* Salary Configuration Fields */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '12px', marginBottom: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-primary, #D47F46)', fontSize: '0.9rem' }}>Salary & Wage Configuration</h4>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Daily Wage (₹) *</label>
                  <input type="number" required min="0" value={form.dailyRate} onChange={fld('dailyRate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Weekly Off</label>
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
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>Joining Date</label>
                    <input type="date" required value={form.joiningDate} onChange={fld('joiningDate')} style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: 'var(--color-primary, #D47F46)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{editingId ? 'Save Changes' : 'Create Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalStaff && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-card)', padding: '26px', borderRadius: '16px', width: '100%', maxWidth: '380px', border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-text-primary)' }}>Reset Staff Password</h3>
            <p style={{ margin: '0 0 18px 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              Assign a new login password for <strong>{resetModalStaff.name}</strong> (@{resetModalStaff.username}).
            </p>
            <form onSubmit={handleResetPasswordSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>New Password *</label>
                <input 
                  type="password"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                  placeholder="Enter at least 6 characters"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setResetModalStaff(null)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: 'var(--color-primary, #D47F46)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementTab;
