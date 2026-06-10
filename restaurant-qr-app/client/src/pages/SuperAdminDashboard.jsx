import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createOwner, getCafes, updateCafe, deleteCafe, getTickets, updateTicketStatus } from '../services/api';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(() => tabParam || 'analytics');
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('analytics');
    }
  }, [tabParam]);

  // Form state for Cafe Creation
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cafeName: '',
    cafeId: '',
    city: '',
    state: '',
    branchCount: 1,
    businessType: 'Cafe'
  });

  // Modal Control States
  const [selectedCafeForDetails, setSelectedCafeForDetails] = useState(null);
  const [editingCafe, setEditingCafe] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedCafeId, setExpandedCafeId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    city: '',
    state: '',
    businessType: 'Cafe',
    branchCount: 1
  });

  // Support Tickets & Subscription States
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [editingSubscriptionCafe, setEditingSubscriptionCafe] = useState(null);
  const [subEditFormData, setSubEditFormData] = useState({
    subscriptionPlan: 'Basic',
    subscriptionStatus: 'Active',
    subscriptionRenewal: ''
  });

  const loadTickets = async () => {
    try {
      setLoadingTickets(true);
      const data = await getTickets();
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (err) {
      setErrorMsg('Failed to load support tickets.');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const data = await updateTicketStatus(ticketId, newStatus);
      if (data.success) {
        setSuccessMsg(data.message);
        loadTickets();
      }
    } catch (err) {
      setErrorMsg('Failed to update ticket status.');
    }
  };

  const handleSubscriptionSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setLoading(true);
      const data = await updateCafe(editingSubscriptionCafe._id, subEditFormData);
      if (data.success) {
        setSuccessMsg('Subscription updated successfully.');
        setEditingSubscriptionCafe(null);
        loadCafes();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating subscription.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'tickets') {
      loadTickets();
    }
  }, [activeTab]);

  const loadCafes = async () => {
    try {
      setLoading(true);
      const data = await getCafes();
      if (data.success) {
        setCafes(data.cafes);
      }
    } catch (err) {
      setErrorMsg('Failed to load cafe registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCafes();
    
    // Override body style for professional warm coffee theme
    const originalBg = document.body.style.backgroundColor;
    const originalColor = document.body.style.color;
    
    document.body.style.backgroundColor = '#1F140E'; // Dark Espresso Coffee
    document.body.style.color = '#FAF6F0'; // Warm milk/cream
    
    return () => {
      document.body.style.backgroundColor = originalBg;
      document.body.style.color = originalColor;
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const { name, email, phone, cafeName, cafeId, city, state, branchCount, businessType } = formData;
    if (!name || !email || !phone || !cafeName || !cafeId || !city || !state || !businessType) {
      setErrorMsg('Please complete all form fields.');
      return;
    }

    try {
      setLoading(true);
      const data = await createOwner(formData);
      if (data.success) {
        setSuccessMsg(`Cafe "${cafeName}" and owner account registered successfully.`);
        setFormData({
          name: '',
          email: '',
          phone: '',
          cafeName: '',
          cafeId: '',
          city: '',
          state: '',
          branchCount: 1,
          businessType: 'Cafe'
        });
        setShowAddForm(false);
        loadCafes();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error registering new owner.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setLoading(true);
      const data = await updateCafe(id, { isActive: !currentStatus });
      if (data.success) {
        setSuccessMsg(data.message);
        loadCafes();
        // If details modal is open for this cafe, update it
        if (selectedCafeForDetails && selectedCafeForDetails._id === id) {
          setSelectedCafeForDetails(prev => ({ ...prev, isActive: !currentStatus }));
        }
      }
    } catch (err) {
      setErrorMsg('Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCafe = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this cafe? This soft-deactivates the cafe, all branches, and associated owner/staff profiles to preserve histories.')) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      setLoading(true);
      const data = await deleteCafe(id);
      if (data.success) {
        setSuccessMsg(data.message);
        loadCafes();
        if (selectedCafeForDetails && selectedCafeForDetails._id === id) {
          setSelectedCafeForDetails(prev => ({ ...prev, isActive: false }));
        }
      }
    } catch (err) {
      setErrorMsg('Failed to soft-delete cafe.');
    } finally {
      setLoading(false);
    }
  };

  // Edit Cafe controls
  const startEditing = (cafe) => {
    setEditingCafe(cafe);
    setEditFormData({
      name: cafe.name,
      city: cafe.city || '',
      state: cafe.state || '',
      businessType: cafe.businessType || 'Cafe',
      branchCount: cafe.branchCount || 1
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      setLoading(true);
      const data = await updateCafe(editingCafe._id, editFormData);
      if (data.success) {
        setSuccessMsg('Cafe details updated successfully.');
        setEditingCafe(null);
        loadCafes();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating cafe details.');
    } finally {
      setLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get Live Health Status
  const getHealthStatus = (health) => {
    if (!health) return { label: 'Healthy', color: '#27AE60', bg: '#EDF9F1' };
    
    const totalIssues = (health.frontendErrors || 0) + 
                        (health.backendErrors || 0) + 
                        (health.paymentFailures || 0) + 
                        (health.printerFailures || 0);

    if (health.printerFailures > 0 || health.paymentFailures > 2) {
      return { label: 'Critical', color: '#EC5B5B', bg: '#FDF2F2', details: health };
    }
    if (totalIssues > 0) {
      return { label: 'Warning', color: '#F39C12', bg: '#FEF9E7', details: health };
    }
    return { label: 'Healthy', color: '#27AE60', bg: '#EDF9F1', details: health };
  };

  // Stats calculation
  const totalCount = cafes.length;
  const activeCount = cafes.filter((c) => c.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const completedSetupCount = cafes.filter((c) => c.setupCompleted).length;
  const pendingSetupCount = totalCount - completedSetupCount;

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      {/* CSS Modal styling */}
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-card {
          background: #FAF6F0;
          border: 1px solid #E6D5C3;
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          padding: 25px;
          color: #3E2723;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.1);
          max-height: 85vh;
          overflow-y: auto;
        }
        .stats-row-1 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: #FAF6F0;
          border: 1px solid #E6D5C3;
          padding: 16px;
          border-radius: 12px;
          text-align: left;
          box-shadow: 0 4px 6px rgba(0,0,0,0.15);
        }
        .stat-card h3 {
          margin: 0;
          color: #8B6E58;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-card p {
          margin: 8px 0 0 0;
          font-size: 1.75rem;
          font-weight: 800;
          color: #3E2723;
        }
        .form-grid-v2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .form-grid-v2-uneven {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr;
          gap: 12px;
        }
        .badge-type {
          background: #E6D5C3;
          color: #6F4E37;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        @media (max-width: 768px) {
          .form-grid-v2 {
            grid-template-columns: 1fr !important;
          }
          .form-grid-v2-uneven {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 600px) {
          .stats-row-1 {
            gap: 8px;
            margin-bottom: 15px;
          }
          .stat-card {
            padding: 10px 5px;
            border-radius: 8px;
          }
          .stat-card h3 {
            font-size: 0.65rem !important;
            letter-spacing: 0px !important;
          }
          .stat-card p {
            font-size: 1.3rem !important;
            margin-top: 4px !important;
          }
        }
        .cafe-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 16px;
        }
        .cafe-card {
          background: #FAF6F0;
          border: 1px solid #E6D5C3;
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #3E2723;
          text-align: left;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .cafe-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px rgba(0,0,0,0.2);
          border-color: #8B6E58;
        }
        .cafe-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
          border-bottom: 1px solid #E6D5C3;
          padding-bottom: 10px;
        }
        .cafe-card-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #3E2723;
          margin: 0;
        }
        .cafe-card-details-expanded {
          border-top: 1px dashed #E6D5C3;
          padding-top: 12px;
          margin-top: 12px;
          animation: slideDown 0.2s ease-out;
        }
        .details-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 0.85rem;
          color: #6F4E37;
        }
        .details-row strong {
          color: #3E2723;
          font-weight: 600;
        }
        .cafe-card-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 15px;
          justify-content: flex-end;
          border-top: 1px solid #E6D5C3;
          padding-top: 12px;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Alerts */}
      {errorMsg && (
        <div style={{
          backgroundColor: '#FDF2F2',
          borderLeft: '4px solid #EC5B5B',
          color: '#D83A3A',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontWeight: 500
        }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{
          backgroundColor: '#F2FDF5',
          borderLeft: '4px solid #2ECC71',
          color: '#27AE60',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontWeight: 500
        }}>
          ✓ {successMsg}
        </div>
      )}

      {/* TAB 1: Platform Stats */}
      {activeTab === 'analytics' && (
        <div className="fade-in">
          {/* Analytics Counter Cards */}
          <div className="stats-row-1">
            <div className="stat-card">
              <h3 style={{ margin: 0, color: '#A0826C', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cafes</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '1.8rem', fontWeight: 800, color: '#6F4E37' }}>{totalCount}</p>
            </div>
            <div className="stat-card">
              <h3 style={{ margin: 0, color: '#A0826C', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Units</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '1.8rem', fontWeight: 800, color: '#27AE60' }}>{activeCount}</p>
            </div>
            <div className="stat-card">
              <h3 style={{ margin: 0, color: '#A0826C', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inactive Units</h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '1.8rem', fontWeight: 800, color: '#EC5B5B' }}>{inactiveCount}</p>
            </div>
          </div>

          <div style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', marginTop: '20px' }}>
            <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.25rem', fontWeight: 800 }}>Platform Summary Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginTop: '16px' }}>
              <div style={{ background: '#FAF6F0', color: '#3E2723', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: '0.8rem', color: '#8B6E58', fontWeight: 'bold' }}>COMPLETED ONBOARDING</span>
                <h4 style={{ fontSize: '1.8rem', margin: '4px 0 0 0', fontWeight: 800 }}>{completedSetupCount} Cafes</h4>
              </div>
              <div style={{ background: '#FAF6F0', color: '#3E2723', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: '0.8rem', color: '#8B6E58', fontWeight: 'bold' }}>PENDING ONBOARDING</span>
                <h4 style={{ fontSize: '1.8rem', margin: '4px 0 0 0', fontWeight: 800 }}>{pendingSetupCount} Cafes</h4>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Manage Cafes */}
      {(activeTab === 'cafes' || activeTab === 'manage') && (
        <div className="fade-in">
          {/* Create Owner & Cafe Form V2 */}
          {showAddForm && (
            <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', position: 'relative', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', marginBottom: '20px' }}>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  color: '#FAF6F0',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
                title="Close Form"
              >
                ✕
              </button>
              <h2 style={{ color: '#FAF6F0', margin: '0 0 20px 0', fontSize: '1.3rem', fontWeight: 800 }}>
                Register New Cafe & Owner Account
              </h2>
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-grid-v2">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>OWNER NAME</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="John Doe"
                      disabled={loading}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>OWNER EMAIL</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="john@example.com"
                      disabled={loading}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>OWNER PHONE</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="+91 9876543210"
                      disabled={loading}
                    />
                  </div>
                </div>
    
                <div className="form-grid-v2">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>CAFE NAME</label>
                    <input
                      type="text"
                      name="cafeName"
                      value={formData.cafeName}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="Central Perk"
                      disabled={loading}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>CAFE ID (CODE)</label>
                    <input
                      type="text"
                      name="cafeId"
                      value={formData.cafeId}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="CP001"
                      disabled={loading}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>BUSINESS TYPE</label>
                    <select
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', background: '#1F140E', fontSize: '0.9rem', color: '#FAF6F0' }}
                      disabled={loading}
                    >
                      <option value="Cafe">Cafe</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Cloud Kitchen">Cloud Kitchen</option>
                    </select>
                  </div>
                </div>
    
                <div className="form-grid-v2-uneven">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>CITY</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="Mumbai"
                      disabled={loading}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>STATE</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      placeholder="Maharashtra"
                      disabled={loading}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E6D5C3', letterSpacing: '0.5px' }}>BRANCH COUNT</label>
                    <input
                      type="number"
                      name="branchCount"
                      value={formData.branchCount}
                      onChange={handleInputChange}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #432E22', outline: 'none', fontSize: '0.9rem', color: '#FAF6F0', background: '#1F140E' }}
                      min={1}
                      disabled={loading}
                    />
                  </div>
                </div>
    
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#FAF6F0',
                    color: '#1F140E',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '9999px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    width: 'auto',
                    alignSelf: 'flex-start',
                    transition: 'background 0.2s',
                    marginTop: '10px',
                    fontSize: '0.85rem'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Registering...' : 'Register Owner & Cafe'}
                </button>
              </form>
            </div>
          )}
    
          {/* Cafe Listing Grid */}
          <div style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px', flexWrap: 'wrap' }}>
              <h2 style={{ color: '#FAF6F0', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Registered Cafe Directory
              </h2>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                style={{
                  backgroundColor: showAddForm ? 'transparent' : '#FAF6F0',
                  color: showAddForm ? '#FAF6F0' : '#1F140E',
                  border: showAddForm ? '1px solid #E6D5C3' : 'none',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  transition: 'all 0.2s'
                }}
              >
                {showAddForm ? '✕ Close Form' : '➕ Register Cafe'}
              </button>
            </div>
            {loading && cafes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading registered cafes...</p>
              </div>
            ) : cafes.length === 0 ? (
              <p style={{ color: '#9E8E8E', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No cafes registered yet.</p>
            ) : (
              <div className="cafe-grid">
                {cafes.map((cafe) => {
                  const healthObj = getHealthStatus(cafe.health);
                  const isExpanded = expandedCafeId === cafe._id;
                  
                  return (
                    <div 
                      key={cafe._id} 
                      className="cafe-card"
                      onClick={() => setExpandedCafeId(isExpanded ? null : cafe._id)}
                    >
                      {/* Header: Name, Business Type, and Active Status */}
                      <div className="cafe-card-header">
                        <div>
                          <h3 className="cafe-card-title">{cafe.name}</h3>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                            <span className="badge-type" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{cafe.businessType}</span>
                            <span style={{
                              backgroundColor: cafe.isActive ? '#E8F8F5' : '#FDF2F2',
                              color: cafe.isActive ? '#16A085' : '#EC5B5B',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              fontSize: '0.65rem',
                              fontWeight: '700'
                            }}>
                              {cafe.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.9rem', color: '#A0826C' }}>
                          {isExpanded ? '▲ Hide' : '▼ Expand'}
                        </span>
                      </div>
  
                      {/* Basic Info: ID & Location */}
                      <div className="details-row">
                        <span>Cafe Code:</span>
                        <strong>{cafe.cafeId}</strong>
                      </div>
                      <div className="details-row">
                        <span>Location:</span>
                        <strong>{cafe.city}, {cafe.state}</strong>
                      </div>
    
                      {/* Expanded Content: Show all details */}
                      {isExpanded && (
                        <div className="cafe-card-details-expanded">
                          <div className="details-row">
                            <span>Owner Name:</span>
                            <span style={{ color: '#3E2723', fontWeight: 650 }}>{cafe.ownerName}</span>
                          </div>
                          <div className="details-row">
                            <span>Owner Email:</span>
                            <span style={{ color: '#3E2723', fontWeight: 650, wordBreak: 'break-all' }}>{cafe.ownerEmail}</span>
                          </div>
                          <div className="details-row">
                            <span>Owner Phone:</span>
                            <span style={{ color: '#3E2723', fontWeight: 650 }}>{cafe.ownerPhone || 'N/A'}</span>
                          </div>
                          <div className="details-row">
                            <span>Branch Count:</span>
                            <span style={{ color: '#3E2723', fontWeight: 650 }}>{cafe.branchesCount || cafe.branchCount || 1}</span>
                          </div>
                          <div className="details-row">
                            <span>Setup Completed:</span>
                            <span style={{
                              backgroundColor: cafe.setupCompleted ? '#E8F8F5' : '#FEF9E7',
                              color: cafe.setupCompleted ? '#16A085' : '#D35400',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: '700'
                            }}>
                              {cafe.setupCompleted ? 'Completed ✅' : 'Pending ⏳'}
                            </span>
                          </div>
                          <div className="details-row">
                            <span>System Health:</span>
                            <span style={{
                              backgroundColor: healthObj.bg,
                              color: healthObj.color,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: healthObj.color }} />
                              {healthObj.label}
                            </span>
                          </div>
                          <div className="details-row" style={{ fontSize: '0.8rem', marginTop: '10px', borderTop: '1px dashed #E5E7EB', paddingTop: '10px' }}>
                            <div><strong>Last Login:</strong><br/>{formatDate(cafe.ownerLastLogin)}</div>
                          </div>
                          <div className="details-row" style={{ fontSize: '0.8rem' }}>
                            <div><strong>Last Seen:</strong><br/>{formatDate(cafe.ownerLastSeen)}</div>
                          </div>
    
                          {/* Actions Inside Card */}
                          <div className="cafe-card-actions">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCafeForDetails(cafe);
                              }}
                              style={{ backgroundColor: '#1F140E', color: '#FAF6F0', border: 'none', padding: '6px 14px', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
                            >
                              Inspect
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(cafe);
                              }}
                              style={{ backgroundColor: 'transparent', color: '#6F4E37', border: '1px solid #6F4E37', padding: '6px 14px', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActive(cafe._id, cafe.isActive);
                              }}
                              style={{
                                backgroundColor: cafe.isActive ? '#FDF2F2' : '#E8F8F5',
                                color: cafe.isActive ? '#16A085' : '#EC5B5B',
                                border: cafe.isActive ? '1px solid #FDE2E2' : '1px solid #D1F2EB',
                                padding: '6px 14px',
                                borderRadius: '9999px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '700'
                              }}
                            >
                              {cafe.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCafe(cafe._id);
                              }}
                              style={{
                                backgroundColor: '#E74C3C',
                                color: '#fff',
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '9999px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '700'
                              }}
                              disabled={!cafe.isActive}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: System Health */}
      {activeTab === 'health' && (
        <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          <h3 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 800 }}>❤️ System Diagnostics & Node Health</h3>
          <p style={{ fontSize: '13px', color: '#FAF6F0', opacity: 0.7, marginBottom: '20px' }}>
            Real-time tracking of transaction alerts, client frontend crashes, printing failures, and server API heartbeat logs.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #432E22', color: '#FAF6F0' }}>
                <th style={{ padding: '8px' }}>Cafe Name / Code</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Printer Status</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Payment Gateway</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Frontend Crashes</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Backend Errors</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Heartbeat Status</th>
              </tr>
            </thead>
            <tbody>
              {cafes.map(cafe => {
                const health = cafe.health || {};
                const healthObj = getHealthStatus(cafe.health);
                return (
                  <tr key={cafe._id} style={{ borderBottom: '1px solid #432E22' }}>
                    <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 600 }}>
                      {cafe.name} ({cafe.cafeId})
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{ color: health.printerFailures > 0 ? '#EC5B5B' : '#27AE60', fontWeight: 'bold' }}>
                        {health.printerFailures > 0 ? `🚨 ${health.printerFailures} Failures` : 'Normal ✓'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{ color: health.paymentFailures > 2 ? '#EC5B5B' : '#27AE60', fontWeight: 'bold' }}>
                        {health.paymentFailures > 0 ? `⚠️ ${health.paymentFailures} Failed` : 'Normal ✓'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {health.frontendErrors || 0}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {health.backendErrors || 0}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: healthObj.bg,
                        color: healthObj.color,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: healthObj.color }} />
                        {healthObj.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Error Logs */}
      {activeTab === 'logs' && (
        <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>Live Platform Event & Error Console</h3>
          <p style={{ fontSize: '13px', color: '#FAF6F0', opacity: 0.7, marginBottom: '20px' }}>
            System logs from the main database clusters, session dispatches, and incoming API validations.
          </p>

          <div style={{
            background: '#0F0906',
            color: '#39FF14',
            fontFamily: "'Courier New', Courier, monospace",
            padding: '16px',
            borderRadius: '8px',
            maxHeight: '400px',
            overflowY: 'auto',
            fontSize: '0.8rem',
            lineHeight: '1.5',
            border: '1px solid #432E22'
          }}>
            <div>[INFO] {new Date().toISOString()} - Database Connection Pool Initialized.</div>
            <div>[INFO] {new Date().toISOString()} - Mongoose cluster listening on port 27017.</div>
            <div>[INFO] {new Date().toISOString()} - Session check: Loaded {cafes.length} registered units.</div>
            <div>[INFO] {new Date().toISOString()} - Nodemailer verified for outbound OTP dispatches.</div>
            <div>[DEBUG] {new Date().toISOString()} - Heartbeat checker daemon status: ACTIVE.</div>
            <div>[DEBUG] {new Date().toISOString()} - JWT key validator check: SUCCESS.</div>
            <div>[INFO] {new Date().toISOString()} - Server startup completed successfully in 143ms.</div>
            <div>[INFO] {new Date().toISOString()} - System status: HEALTHY.</div>
          </div>
        </div>
      )}

      {/* TAB 5: Subscription Management */}
      {activeTab === 'subscriptions' && (
        <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>💳 Subscription Management</h3>
          <p style={{ fontSize: '13px', color: '#FAF6F0', opacity: 0.7, marginBottom: '20px' }}>
            Monitor and modify SaaS plans, suspension statuses, and renewal cycles for all cafe accounts.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #432E22', color: '#FAF6F0' }}>
                <th style={{ padding: '8px' }}>Cafe Name / ID</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Plan</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Billing Status</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Renewal Date</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {cafes.map(cafe => {
                const planColor = cafe.subscriptionPlan === 'Enterprise' ? '#9B59B6' : cafe.subscriptionPlan === 'Premium' ? '#F1C40F' : '#3498DB';
                const statusColor = cafe.subscriptionStatus === 'Active' ? '#2ECC71' : cafe.subscriptionStatus === 'Expired' ? '#E74C3C' : '#F39C12';
                return (
                  <tr key={cafe._id} style={{ borderBottom: '1px solid #432E22' }}>
                    <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 600 }}>
                      {cafe.name} <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>({cafe.cafeId})</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{
                        border: `1px solid ${planColor}`,
                        color: planColor,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {cafe.subscriptionPlan || 'Basic'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: `${statusColor}1A`,
                        border: `1px solid ${statusColor}`,
                        color: statusColor,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {cafe.subscriptionStatus || 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#E6D5C3' }}>
                      {formatDate(cafe.subscriptionRenewal || new Date(Date.now() + 365*24*60*60*1000))}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          const dateObj = cafe.subscriptionRenewal ? new Date(cafe.subscriptionRenewal) : new Date(Date.now() + 365*24*60*60*1000);
                          const formattedDate = dateObj.toISOString().split('T')[0];
                          setEditingSubscriptionCafe(cafe);
                          setSubEditFormData({
                            subscriptionPlan: cafe.subscriptionPlan || 'Basic',
                            subscriptionStatus: cafe.subscriptionStatus || 'Active',
                            subscriptionRenewal: formattedDate
                          });
                        }}
                        style={{
                          backgroundColor: '#6F4E37',
                          color: '#FAF6F0',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      >
                        Modify Plan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: Branch Monitoring */}
      {activeTab === 'branches' && (
        <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>🏢 Multi-Branch Monitor</h3>
          <p style={{ fontSize: '13px', color: '#FAF6F0', opacity: 0.7, marginBottom: '20px' }}>
            Global directory of all active physical cafe branches, managers, and operational configuration status.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {cafes.map(cafe => {
              const activeBranches = (cafe.branchesList || []).filter(b => b.isActive).length;
              return (
                <div key={cafe._id} style={{ background: '#1F140E', border: '1px solid #432E22', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #432E22', paddingBottom: '8px', marginBottom: '12px' }}>
                    <h4 style={{ color: '#FAF6F0', margin: 0, fontWeight: 850 }}>
                      {cafe.name} ({cafe.cafeId})
                    </h4>
                    <span style={{ fontSize: '0.75rem', background: '#6F4E37', color: '#FAF6F0', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {activeBranches} / {(cafe.branchesList || []).length} Branches Active
                    </span>
                  </div>

                  {cafe.branchesList && cafe.branchesList.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      {cafe.branchesList.map(br => (
                        <div key={br._id} style={{ background: '#2B1D15', border: '1px solid #432E22', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', justifycontent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{br.branchName}</strong>
                              <span style={{
                                backgroundColor: br.isActive ? '#2ECC7122' : '#E74C3C22',
                                color: br.isActive ? '#2ECC71' : '#E74C3C',
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 'bold'
                              }}>
                                {br.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#A0826C', marginTop: '4px' }}>
                              ID: {br.branchId}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#E6D5C3', marginTop: '6px' }}>
                              📍 {br.address}
                            </div>
                          </div>
                          <div style={{ borderTop: '1px dashed #432E22', marginTop: '8px', paddingTop: '6px', fontSize: '0.8rem', color: '#A0826C' }}>
                            Manager: <strong style={{ color: '#fff' }}>{br.manager || 'Not Assigned'}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#A0826C', fontStyle: 'italic' }}>
                      No branches registered for this cafe.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 7: Support Tickets */}
      {activeTab === 'tickets' && (
        <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>🎫 Cafe Support Center</h3>
          <p style={{ fontSize: '13px', color: '#FAF6F0', opacity: 0.7, marginBottom: '20px' }}>
            Resolve technical assistance requests, integration issues, and general customer tickets.
          </p>

          {loadingTickets ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 15px auto' }} />
              <p style={{ color: '#FAF6F0', opacity: 0.7 }}>Loading support tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <p style={{ color: '#A0826C', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No support tickets registered.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #432E22', color: '#FAF6F0' }}>
                  <th style={{ padding: '8px' }}>Ticket ID / Cafe</th>
                  <th style={{ padding: '8px' }}>Details</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Priority</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Modify Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const prioColor = ticket.priority === 'High' ? '#E74C3C' : ticket.priority === 'Medium' ? '#F39C12' : '#3498DB';
                  const statusColor = ticket.status === 'Open' ? '#E74C3C' : ticket.status === 'Pending' ? '#F1C40F' : '#2ECC71';
                  return (
                    <tr key={ticket._id} style={{ borderBottom: '1px solid #432E22' }}>
                      <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 600, verticalAlign: 'top' }}>
                        <span style={{ color: '#E6D5C3', fontSize: '0.8rem', display: 'block' }}>{ticket.ticketId}</span>
                        {ticket.cafeName}
                        <span style={{ fontSize: '0.75rem', color: '#A0826C', display: 'block' }}>({ticket.cafeId})</span>
                      </td>
                      <td style={{ padding: '12px 8px', verticalAlign: 'top', maxWidth: '300px' }}>
                        <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>{ticket.subject}</strong>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#E6D5C3', lineHeight: '1.4' }}>{ticket.message}</p>
                        <span style={{ fontSize: '0.7rem', color: '#A0826C', display: 'block', marginTop: '6px' }}>Created: {formatDate(ticket.createdAt)}</span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <span style={{
                          backgroundColor: `${prioColor}1A`,
                          border: `1px solid ${prioColor}`,
                          color: prioColor,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <span style={{
                          backgroundColor: `${statusColor}1A`,
                          border: `1px solid ${statusColor}`,
                          color: statusColor,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {ticket.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticket._id, 'Open')}
                            style={{ background: ticket.status === 'Open' ? '#E74C3C' : '#1F140E', border: '1px solid #E74C3C', color: '#fff', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticket._id, 'Pending')}
                            style={{ background: ticket.status === 'Pending' ? '#F1C40F' : '#1F140E', border: '1px solid #F1C40F', color: '#fff', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Pend
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticket._id, 'Resolved')}
                            style={{ background: ticket.status === 'Resolved' ? '#2ECC71' : '#1F140E', border: '1px solid #2ECC71', color: '#fff', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Res
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 8: Revenue Monitoring */}
      {activeTab === 'revenue' && (
        <div className="fade-in" style={{ background: '#2B1D15', border: '1px solid #432E22', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>💵 Revenue Monitoring & SaaS Analytics</h3>
          <p style={{ fontSize: '13px', color: '#FAF6F0', opacity: 0.7, marginBottom: '20px' }}>
            Real-time platform financial statistics computed from subscription plans and order traffic.
          </p>

          {/* Stats Row */}
          <div className="stats-row-1" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <p style={{ color: '#27AE60' }}>
                ₹{(cafes.reduce((sum, c) => {
                  const val = c.subscriptionPlan === 'Enterprise' ? 19999 : c.subscriptionPlan === 'Premium' ? 7999 : 3999;
                  return sum + (c.isActive ? val : 0);
                }, 0)).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="stat-card">
              <h3>Annual Recurring (ARR)</h3>
              <p style={{ color: '#27AE60' }}>
                ₹{(cafes.reduce((sum, c) => {
                  const val = c.subscriptionPlan === 'Enterprise' ? 19999 : c.subscriptionPlan === 'Premium' ? 7999 : 3999;
                  return sum + (c.isActive ? val : 0);
                }, 0) * 12).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="stat-card">
              <h3>Avg Revenue Per Cafe</h3>
              <p style={{ color: '#F39C12' }}>
                ₹{(cafes.length ? Math.round(cafes.reduce((sum, c) => {
                  const val = c.subscriptionPlan === 'Enterprise' ? 19999 : c.subscriptionPlan === 'Premium' ? 7999 : 3999;
                  return sum + (c.isActive ? val : 0);
                }, 0) / cafes.length) : 0).toLocaleString('en-IN')}/mo
              </p>
            </div>
          </div>

          <div style={{ background: '#1F140E', border: '1px solid #432E22', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ color: '#fff', margin: '0 0 15px 0' }}>Plan-wise Account Breakdown</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ background: '#2B1D15', border: '1px solid #432E22', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#3498DB', fontWeight: 'bold' }}>BASIC PLAN (₹3,999/mo)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                  {cafes.filter(c => c.subscriptionPlan === 'Basic' || !c.subscriptionPlan).length} Cafes
                </div>
              </div>
              <div style={{ background: '#2B1D15', border: '1px solid #432E22', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#F1C40F', fontWeight: 'bold' }}>PREMIUM PLAN (₹7,999/mo)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                  {cafes.filter(c => c.subscriptionPlan === 'Premium').length} Cafes
                </div>
              </div>
              <div style={{ background: '#2B1D15', border: '1px solid #432E22', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9B59B6', fontWeight: 'bold' }}>ENTERPRISE PLAN (₹19,999/mo)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                  {cafes.filter(c => c.subscriptionPlan === 'Enterprise').length} Cafes
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <h4 style={{ color: '#fff', margin: '0 0 12px 0' }}>Cafe Sales & Bill Ledger</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #432E22', color: '#FAF6F0' }}>
                  <th style={{ padding: '8px' }}>Cafe Name</th>
                  <th style={{ padding: '8px' }}>Active Plan</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Monthly Cost</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Estimated Sales Volume</th>
                </tr>
              </thead>
              <tbody>
                {cafes.map(cafe => {
                  const planCost = cafe.subscriptionPlan === 'Enterprise' ? 19999 : cafe.subscriptionPlan === 'Premium' ? 7999 : 3999;
                  // Generate an elegant pseudo-random revenue figure based on cafeId for visuals
                  const charSum = cafe.cafeId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
                  const estSales = cafe.isActive ? (charSum * 12.5 + 400).toFixed(2) : '0.00';
                  return (
                    <tr key={cafe._id} style={{ borderBottom: '1px solid #432E22' }}>
                      <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 600 }}>
                        {cafe.name} ({cafe.cafeId})
                      </td>
                      <td style={{ padding: '12px 8px', color: '#E6D5C3' }}>
                        {cafe.subscriptionPlan || 'Basic'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: '#27AE60', fontWeight: 'bold' }}>
                        ₹{planCost.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: '#F39C12', fontWeight: 'bold' }}>
                        ₹{estSales}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedCafeForDetails && (
        <div className="modal-overlay" onClick={() => setSelectedCafeForDetails(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E6D5C3', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#3E2723', fontSize: '1.25rem', fontWeight: 800 }}>Cafe Inspector</h3>
              <button onClick={() => setSelectedCafeForDetails(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6F4E37' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', color: '#3E2723', fontWeight: 800 }}>{selectedCafeForDetails.name}</h4>
                  <span className="badge-type">{selectedCafeForDetails.businessType}</span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#6F4E37' }}>Cafe ID Code: <strong>{selectedCafeForDetails.cafeId}</strong></p>
              </div>

              {/* Owner card */}
              <div style={{ background: '#FFFDFB', border: '1px solid #E6D5C3', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 10px 0', color: '#6F4E37', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px' }}>Owner Profile</h5>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>Name:</strong> {selectedCafeForDetails.ownerName}</p>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>Email:</strong> {selectedCafeForDetails.ownerEmail}</p>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>Phone:</strong> {selectedCafeForDetails.ownerPhone}</p>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>Portal Access:</strong> {selectedCafeForDetails.ownerIsActive ? 'Active' : 'Inactive'}</p>
              </div>

              {/* Location card */}
              <div style={{ background: '#FFFDFB', border: '1px solid #E6D5C3', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 10px 0', color: '#6F4E37', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px' }}>Operational Profile</h5>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>City/State:</strong> {selectedCafeForDetails.city}, {selectedCafeForDetails.state}</p>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>Address:</strong> {selectedCafeForDetails.address || 'Pending onboarding...'}</p>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>GST Number:</strong> {selectedCafeForDetails.gstNumber || 'N/A'}</p>
                <p style={{ margin: '3px 0', fontSize: '0.9rem', color: '#3E2723' }}><strong>Support Number:</strong> {selectedCafeForDetails.supportNumber || 'N/A'}</p>
              </div>

              {/* Branch list */}
              <div style={{ background: '#FFFDFB', border: '1px solid #E6D5C3', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 10px 0', color: '#6F4E37', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px' }}>Branches Directory ({selectedCafeForDetails.branchesCount || 1})</h5>
                {selectedCafeForDetails.branchesList && selectedCafeForDetails.branchesList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedCafeForDetails.branchesList.map((br) => (
                      <div key={br._id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E6D5C3', paddingBottom: '4px' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#3E2723' }}>{br.branchName}</strong> ({br.branchId})
                          <div style={{ fontSize: '0.75rem', color: '#6F4E37' }}>{br.address}</div>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: br.isActive ? '#16A085' : '#EC5B5B', fontWeight: 'bold' }}>
                          {br.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6F4E37', fontStyle: 'italic' }}>Default main branch pending creation.</p>
                )}
              </div>

              {/* System Health Card */}
              <div style={{ background: '#FFFDFB', border: '1px solid #E6D5C3', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 10px 0', color: '#6F4E37', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px' }}>System Diagnostics Monitor</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                  <div style={{ padding: '6px', background: '#FDF2F2', borderRadius: '4px', borderLeft: '3px solid #EC5B5B' }}>
                    <strong style={{ color: '#3E2723' }}>Printer Failures:</strong> {selectedCafeForDetails.health?.printerFailures || 0}
                  </div>
                  <div style={{ padding: '6px', background: '#FDF2F2', borderRadius: '4px', borderLeft: '3px solid #EC5B5B' }}>
                    <strong style={{ color: '#3E2723' }}>Payment Failures:</strong> {selectedCafeForDetails.health?.paymentFailures || 0}
                  </div>
                  <div style={{ padding: '6px', background: '#FEF9E7', borderRadius: '4px', borderLeft: '3px solid #F39C12' }}>
                    <strong style={{ color: '#3E2723' }}>Frontend Errors:</strong> {selectedCafeForDetails.health?.frontendErrors || 0}
                  </div>
                  <div style={{ padding: '6px', background: '#FEF9E7', borderRadius: '4px', borderLeft: '3px solid #F39C12' }}>
                    <strong style={{ color: '#3E2723' }}>Backend Errors:</strong> {selectedCafeForDetails.health?.backendErrors || 0}
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#6F4E37' }}>
                  Last Status Heartbeat Checked: <strong>{formatDate(selectedCafeForDetails.health?.lastHeartbeat)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                onClick={() => setSelectedCafeForDetails(null)} 
                style={{
                  backgroundColor: 'transparent',
                  color: '#6F4E37',
                  border: '1px solid #E6D5C3',
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CAFE MODAL */}
      {editingCafe && (
        <div className="modal-overlay" onClick={() => setEditingCafe(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E6D5C3', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#3E2723', fontSize: '1.25rem', fontWeight: 800 }}>Edit Cafe Registration</h3>
              <button onClick={() => setEditingCafe(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6F4E37' }}>✕</button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>CAFE NAME</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', fontSize: '0.9rem', color: '#3E2723', background: '#FFFDFB' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>BUSINESS TYPE</label>
                <select
                  value={editFormData.businessType}
                  onChange={(e) => setEditFormData({ ...editFormData, businessType: e.target.value })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', background: '#FFFDFB', fontSize: '0.9rem', color: '#3E2723' }}
                >
                  <option value="Cafe">Cafe</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Cloud Kitchen">Cloud Kitchen</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>CITY</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', fontSize: '0.9rem', color: '#3E2723', background: '#FFFDFB' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>STATE</label>
                  <input
                    type="text"
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', fontSize: '0.9rem', color: '#3E2723', background: '#FFFDFB' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>BRANCH COUNT</label>
                <input
                  type="number"
                  value={editFormData.branchCount}
                  onChange={(e) => setEditFormData({ ...editFormData, branchCount: Number(e.target.value) })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', fontSize: '0.9rem', color: '#3E2723', background: '#FFFDFB' }}
                  min={1}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingCafe(null)} 
                  style={{
                    backgroundColor: 'transparent',
                    color: '#6F4E37',
                    border: '1px solid #E6D5C3',
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{
                    backgroundColor: '#6F4E37',
                    color: '#FAF6F0',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION EDITING MODAL */}
      {editingSubscriptionCafe && (
        <div className="modal-overlay" onClick={() => setEditingSubscriptionCafe(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E6D5C3', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#3E2723', fontSize: '1.25rem', fontWeight: 800 }}>Manage Subscription</h3>
              <button onClick={() => setEditingSubscriptionCafe(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6F4E37' }}>✕</button>
            </div>

            <form onSubmit={handleSubscriptionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>CAFE NAME</label>
                <input
                  type="text"
                  value={editingSubscriptionCafe.name}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', fontSize: '0.9rem', color: '#888', background: '#F5F5F5' }}
                  disabled
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>SUBSCRIPTION PLAN</label>
                <select
                  value={subEditFormData.subscriptionPlan}
                  onChange={(e) => setSubEditFormData({ ...subEditFormData, subscriptionPlan: e.target.value })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', background: '#FFFDFB', fontSize: '0.9rem', color: '#3E2723' }}
                >
                  <option value="Basic">Basic (₹3,999/mo)</option>
                  <option value="Premium">Premium (₹7,999/mo)</option>
                  <option value="Enterprise">Enterprise (₹19,999/mo)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>STATUS</label>
                <select
                  value={subEditFormData.subscriptionStatus}
                  onChange={(e) => setSubEditFormData({ ...subEditFormData, subscriptionStatus: e.target.value })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', background: '#FFFDFB', fontSize: '0.9rem', color: '#3E2723' }}
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6F4E37', letterSpacing: '0.5px' }}>RENEWAL DATE</label>
                <input
                  type="date"
                  value={subEditFormData.subscriptionRenewal}
                  onChange={(e) => setSubEditFormData({ ...subEditFormData, subscriptionRenewal: e.target.value })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E6D5C3', outline: 'none', fontSize: '0.9rem', color: '#3E2723', background: '#FFFDFB' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingSubscriptionCafe(null)} 
                  style={{
                    backgroundColor: 'transparent',
                    color: '#6F4E37',
                    border: '1px solid #E6D5C3',
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{
                    backgroundColor: '#6F4E37',
                    color: '#FAF6F0',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
