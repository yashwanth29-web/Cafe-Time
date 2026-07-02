import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSetupData, saveSetupData, uploadLogo } from '../services/api';

const OwnerSetup = () => {
  const { user, checkSession } = useAuth();
  const navigate = useNavigate();

  // Wizard active step (1 to 5)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 1: Cafe Profile States
  const [cafeName, setCafeName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('/logo.svg');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [mapsLocation, setMapsLocation] = useState('40.7128,-74.0060'); // Default GPS coordinates
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [gstNumber, setGstNumber] = useState('');
  const [supportNumber, setSupportNumber] = useState('');

  // Step 2: Payment Setup States
  const [upiId, setUpiId] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // Step 3: Operational Setup States
  const [tableCount, setTableCount] = useState(5);
  const [tablesList, setTablesList] = useState([
  { id: 'T1', label: 'Table-1' },
  { id: 'T2', label: 'Table-2' },
  { id: 'T3', label: 'Table-3' },
  { id: 'T4', label: 'Table-4' },
  { id: 'T5', label: 'Table-5' }]
  );
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [kitchenDisplayEnabled, setKitchenDisplayEnabled] = useState(true);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);

  // Step 4: Staff Setup States
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('chef'); // chef, manager, staff
  const [tempStaffList, setTempStaffList] = useState([]);

  // Fetch current details on load (in case some default values exist or they are reloading)
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const res = await getSetupData();
        if (res.success) {
          const { cafe, paymentConfig, operationalConfig } = res;
          if (cafe) {
            setCafeName(cafe.name || '');
            setAddress(cafe.address || '');
            setLogoUrl(cafe.logoUrl || '');
            if (cafe.logoUrl) setLogoPreview(cafe.logoUrl);
            setMapsLocation(cafe.mapsLocation || '40.7128,-74.0060');
            setOpeningTime(cafe.openingTime || '08:00');
            setClosingTime(cafe.closingTime || '22:00');
            setGstNumber(cafe.gstNumber || '');
            setSupportNumber(cafe.supportNumber || '');
          }
          if (paymentConfig) {
            setUpiId(paymentConfig.upiId || '');
            setBankHolderName(paymentConfig.bankHolderName || '');
            setAccountNumber(paymentConfig.accountNumber || '');
            setIfscCode(paymentConfig.ifscCode || '');
          }
          if (operationalConfig) {
            setPrinterEnabled(operationalConfig.printerEnabled || false);
            setKitchenDisplayEnabled(operationalConfig.kitchenDisplayEnabled || false);
            setInventoryEnabled(operationalConfig.inventoryEnabled || false);
            if (operationalConfig.tables && operationalConfig.tables.length > 0) {
              setTablesList(operationalConfig.tables);
              setTableCount(operationalConfig.tables.length);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load existing setup data:', err);
      }
    };
    fetchExistingData();
  }, []);

  // Sync table generation when count changes
  const handleTableCountChange = (count) => {
    const newCount = Math.max(1, Math.min(50, Number(count)));
    setTableCount(newCount);

    setTablesList((prev) => {
      const list = [...prev];
      if (list.length < newCount) {
        for (let i = list.length; i < newCount; i++) {
          list.push({ id: `T${i + 1}`, label: `Table-${i + 1}` });
        }
      } else if (list.length > newCount) {
        list.splice(newCount);
      }
      return list;
    });
  };

  const handleTableLabelChange = (index, value) => {
    setTablesList((prev) => {
      const list = [...prev];
      list[index].label = value;
      return list;
    });
  };

  // Upload Logo handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogoFile(file);
    // Visual reader preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target.result);
    };
    reader.readAsDataURL(file);

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await uploadLogo(file);
      if (res.success && res.logoUrl) {
        setLogoUrl(res.logoUrl);
        setSuccessMsg('Logo uploaded successfully!');
        setTimeout(() => setSuccessMsg(''), 2500);
      }
    } catch (err) {
      setErrorMsg('Logo file upload failed. Max file size is 2MB.');
    } finally {
      setLoading(false);
    }
  };

  // Add staff locally to register during setup finalize
  const addStaffToRoster = () => {
    if (!staffName || !staffEmail || !staffPhone) {
      setErrorMsg('Please complete all staff details before adding.');
      return;
    }
    setErrorMsg('');

    // Check duplicate email in current temp list
    if (tempStaffList.find((s) => s.email.toLowerCase() === staffEmail.toLowerCase())) {
      setErrorMsg('Staff member with this email is already added.');
      return;
    }

    setTempStaffList((prev) => [
    ...prev,
    {
      name: staffName,
      email: staffEmail,
      phone: staffPhone,
      staffRole: staffRole,
      role: ['chef', 'manager'].includes(staffRole) ? staffRole : 'staff'
    }]
    );

    // Reset inputs
    setStaffName('');
    setStaffEmail('');
    setStaffPhone('');
  };

  const removeStaffFromRoster = (index) => {
    setTempStaffList((prev) => prev.filter((_, i) => i !== index));
  };

  // Final Setup Save
  const handleFinalizeSetup = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const setupPayload = {
        logoUrl,
        address,
        mapsLocation,
        openingTime,
        closingTime,
        gstNumber,
        supportNumber: supportNumber || user.phone,
        paymentConfig: {
          razorpayKeyId: '',
          razorpaySecret: '',
          upiId,
          bankHolderName,
          accountNumber,
          ifscCode,
          isVerified: true
        },
        operationalConfig: {
          tables: tablesList,
          printerEnabled,
          kitchenDisplayEnabled,
          inventoryEnabled
        },
        staffList: tempStaffList
      };

      const res = await saveSetupData(setupPayload);
      if (res.success) {
        // Reload user session details so `setupCompleted` turns true
        await checkSession();
        navigate('/admin');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error finalizing onboarding setup.');
    } finally {
      setLoading(false);
    }
  };

  // Wizard navigation validations
  const validateAndNext = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!address) {
        setErrorMsg('Cafe address is required.');
        return;
      }
    }
    if (step === 2) {
      if (!upiId) {
        setErrorMsg('UPI ID is required to accept online payments.');
        return;
      }
    }
    setStep((prev) => prev + 1);
  };

  const stepTitles = [
  'Cafe Profile',
  'Payment Setup',
  'Operational Setup',
  'Staff Roster',
  'Complete Onboarding'];


  return (
    <div style={{
      maxWidth: '850px',
      margin: '40px auto',
      padding: '0 20px',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* CSS Styles injection for interactive UI */}
      <style>{`
        .wizard-container {
          background: rgba(43, 30, 24, 0.95);
          border: 1px solid #6F4E37;
          border-radius: 20px;
          padding: 35px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          color: var(--color-text-primary);
        }
        .progress-bar-container {
          display: flex;
          justify-content: space-between;
          position: relative;
          margin-bottom: 40px;
        }
        .progress-bar-line {
          position: absolute;
          top: 15px;
          left: 5%;
          right: 5%;
          height: 3px;
          background: #3E2723;
          z-index: 1;
        }
        .progress-bar-fill {
          position: absolute;
          top: 15px;
          left: 5%;
          height: 3px;
          background: #E6D5C3;
          z-index: 1;
          transition: width 0.3s ease;
        }
        .step-node {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3E2723;
          border: 2px solid #5C4331;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          color: #A0826C;
          transition: all 0.3s ease;
        }
        .step-node.active {
          background: #6F4E37;
          border-color: var(--color-text-secondary);
          color: var(--color-text-primary);
          box-shadow: 0 0 10px #6F4E37;
          transform: scale(1.1);
        }
        .step-node.completed {
          background: #27AE60;
          border-color: #2ECC71;
          color: var(--color-text-primary);
        }
        .step-label {
          position: absolute;
          top: 40px;
          transform: translateX(-35%);
          font-size: 0.75rem;
          font-weight: 600;
          color: #A0826C;
          white-space: nowrap;
        }
        .step-label.active {
          color: var(--color-text-secondary);
        }
        .mobile-step-indicator {
          display: none;
          text-align: center;
          margin: -15px 0 25px 0;
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          font-weight: 600;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 25px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #D4C3B3;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-group input, .form-group textarea, .form-group select {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid #5C4331;
          color: var(--color-text-primary);
          padding: 12px;
          border-radius: 8px;
          outline: none;
          transition: border 0.2s;
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
          border-color: var(--color-text-secondary);
        }
        .wizard-button {
          padding: 12px 28px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: transform 0.1s, background-color 0.2s;
        }
        .wizard-button:active {
          transform: scale(0.98);
        }
        .btn-primary {
          background: #6F4E37;
          color: var(--color-text-primary);
        }
        .btn-primary:hover {
          background: #8B6347;
        }
        .btn-secondary {
          background: transparent;
          border: 1px solid #6F4E37;
          color: var(--color-text-secondary);
        }
        .btn-secondary:hover {
          background: rgba(111, 78, 55, 0.1);
        }
        .btn-success {
          background: #27AE60;
          color: var(--color-text-primary);
        }
        .btn-success:hover {
          background: #2ECC71;
        }
        .logo-preview-box {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          border: 2px dashed #6F4E37;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.3);
          overflow: hidden;
        }
        .logo-preview-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .table-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid #5C4331;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .table-card input {
          background: transparent;
          border: none;
          border-bottom: 1px solid #5C4331;
          color: var(--color-text-primary);
          width: 100%;
          outline: none;
          font-size: 0.9rem;
          padding: 4px;
        }
        .table-card input:focus {
          border-color: var(--color-text-secondary);
        }
        .toggle-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #5C4331;
          border-radius: 8px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        @media (max-width: 600px) {
          .wizard-container {
            padding: 20px 15px;
            border-radius: 12px;
          }
          .progress-bar-container {
            margin-bottom: 25px;
          }
          .step-label {
            display: none;
          }
          .step-node {
            width: 28px;
            height: 28px;
            font-size: 0.8rem;
          }
          .mobile-step-indicator {
            display: block;
          }
          .form-grid {
            grid-template-columns: 1fr !important;
            gap: 15px;
          }
          .form-group {
            grid-column: span 1 !important;
          }
          .form-group input, .form-group textarea, .form-group select {
            padding: 10px;
          }
          .wizard-button {
            padding: 10px 20px;
          }
          .mobile-full-width {
            flex-direction: column;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .mobile-full-width button {
            width: 100%;
          }
          .mobile-logo-box {
            flex-direction: column;
            align-items: center !important;
            text-align: center;
            gap: 15px !important;
          }
          .mobile-logo-box .form-group {
            width: 100%;
          }
        }
      `}</style>

      {/* ── Exit / Continue Later button ── */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => navigate('/owner/profile')}
          title="Exit setup — continue later"
          style={{
            position: 'fixed',
            top: '18px',
            right: '20px',
            zIndex: 999,
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(92, 67, 49, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(230, 213, 195, 0.25)',
            color: 'var(--color-text-primary)',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            transition: 'background 0.2s, transform 0.2s',
            lineHeight: 1
          }}
          onMouseOver={(e) => {e.currentTarget.style.background = 'rgba(140, 90, 60, 0.95)';e.currentTarget.style.transform = 'scale(1.08)';}}
          onMouseOut={(e) => {e.currentTarget.style.background = 'rgba(92, 67, 49, 0.85)';e.currentTarget.style.transform = 'scale(1)';}}>
          
          ✕
        </button>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#5C4331', margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>
          Welcome to Dr. Chai Cafe
        </h1>
        <p style={{ color: '#A0826C', marginTop: '5px', fontSize: '1.1rem', fontWeight: 500 }}>
          Complete the 5-step operational wizard to launch your portal dashboard
        </p>
        <p style={{ color: '#A0826C', marginTop: '6px', fontSize: '0.82rem', opacity: 0.75 }}>
          ✕ to exit and continue later from your profile page
        </p>
      </div>


      <div className="wizard-container">
        {/* Progress Tracker */}
        <div className="progress-bar-container">
          <div className="progress-bar-line" />
          <div className="progress-bar-fill" style={{ width: `${(step - 1) * 22.5}%` }} />
          
          {stepTitles.map((title, index) => {
            const stepNum = index + 1;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;

            return (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} key={index}>
                <div className={`step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                  {isCompleted ? '✓' : stepNum}
                </div>
                <div className={`step-label ${isActive ? 'active' : ''}`}>
                  {title}
                </div>
              </div>);

          })}
        </div>

        {/* Mobile active step indicator */}
        <div className="mobile-step-indicator">
          Step {step} of 5: {stepTitles[step - 1]}
        </div>

        {/* Form Messages */}
        {errorMsg &&
        <div style={{
          background: '#FDF2F2',
          borderLeft: '4px solid #EC5B5B',
          color: '#D83A3A',
          padding: '14px',
          borderRadius: '6px',
          marginBottom: '25px',
          fontWeight: 500
        }}>
            ⚠️ {errorMsg}
          </div>
        }
        {successMsg &&
        <div style={{
          background: '#F2FDF5',
          borderLeft: '4px solid #2ECC71',
          color: '#27AE60',
          padding: '14px',
          borderRadius: '6px',
          marginBottom: '25px',
          fontWeight: 500
        }}>
            ✓ {successMsg}
          </div>
        }

        {/* STEP 1: Cafe Profile */}
        {step === 1 &&
        <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 1: Setup Cafe Profile
            </h2>
            
            <div className="mobile-logo-box" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px' }}>
              <div className="logo-preview-box">
                <img src={logoPreview} alt="Logo Preview" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="cafe-logo">Upload Cafe Logo</label>
                <input
                type="file"
                id="cafe-logo"
                name="cafe-logo"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={loading} />
              
                <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>Recommended: Square format image, Max 2MB.</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="registered-cafe-name">Cafe Name (Registered)</label>
                <input
                type="text"
                id="registered-cafe-name"
                name="registered-cafe-name"
                value={cafeName}
                disabled
                style={{ background: 'rgba(0, 0, 0,0.05)', color: '#A0826C' }} />
              
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="cafe-address">Cafe Street Address</label>
                <textarea
                rows={2}
                id="cafe-address"
                name="cafe-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Near Central Square..."
                disabled={loading} />
              
              </div>

              <div className="form-group">
                <label htmlFor="opening-time">Opening Time</label>
                <input
                type="time"
                id="opening-time"
                name="opening-time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                disabled={loading} />
              
              </div>

              <div className="form-group">
                <label htmlFor="closing-time">Closing Time</label>
                <input
                type="time"
                id="closing-time"
                name="closing-time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                disabled={loading} />
              
              </div>

              <div className="form-group">
                <label htmlFor="support-number">Support Contact Number</label>
                <input
                type="text"
                id="support-number"
                name="support-number"
                value={supportNumber}
                onChange={(e) => setSupportNumber(e.target.value)}
                placeholder="+91 9999988888"
                disabled={loading} />
              
              </div>

              <div className="form-group">
                <label htmlFor="gst-number">GST Registration Number (Optional)</label>
                <input
                type="text"
                id="gst-number"
                name="gst-number"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="22AAAAA0000A1Z5"
                disabled={loading} />
              
              </div>

              {/* Simulated Google Maps Location Picker */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="maps-location">Google Maps Location Coordinates</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                  type="text"
                  id="maps-location"
                  name="maps-location"
                  value={mapsLocation}
                  onChange={(e) => setMapsLocation(e.target.value)}
                  placeholder="Latitude, Longitude"
                  disabled={loading}
                  style={{ flex: 1 }} />
                
                  <button
                  type="button"
                  className="wizard-button btn-secondary"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords;
                          setMapsLocation(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
                          setSuccessMsg('Coordinates detected from GPS device!');
                          setTimeout(() => setSuccessMsg(''), 2000);
                        },
                        (error) => {
                          console.warn("Geolocation failed, using fallback simulation:", error);
                          // Fallback simulation
                          const randLat = (16.5062 + (Math.random() - 0.5) * 0.01).toFixed(6);
                          const randLng = (80.6480 + (Math.random() - 0.5) * 0.01).toFixed(6);
                          setMapsLocation(`${randLat},${randLng}`);
                          setSuccessMsg('Coordinates simulated (GPS denied/failed)!');
                          setTimeout(() => setSuccessMsg(''), 2000);
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                      );
                    } else {
                      // Fallback simulation
                      const randLat = (16.5062 + (Math.random() - 0.5) * 0.01).toFixed(6);
                      const randLng = (80.6480 + (Math.random() - 0.5) * 0.01).toFixed(6);
                      setMapsLocation(`${randLat},${randLng}`);
                      setSuccessMsg('Coordinates simulated!');
                      setTimeout(() => setSuccessMsg(''), 2000);
                    }
                  }}>
                  
                    📍 Detect GPS
                  </button>
                </div>
                {/* Micro simulated map widget */}
                <div style={{
                height: '100px',
                background: '#1F2937',
                border: '1px solid #4B5563',
                borderRadius: '8px',
                marginTop: '10px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                  <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                    Map Preview Mode
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                    📍 Coordinates set to: {mapsLocation}
                  </div>
                  <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'rgba(111, 78, 55, 0.2)',
                  border: '2px solid #6F4E37',
                  position: 'absolute',
                  animation: 'ping 2s infinite'
                }} />
                  <style>{`
                    @keyframes ping {
                      0% { transform: scale(1); opacity: 1; }
                      100% { transform: scale(2.2); opacity: 0; }
                    }
                  `}</style>
                </div>
              </div>
            </div>
          </div>
        }

        {/* STEP 2: Payment Setup */}
        {step === 2 &&
        <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 2: Payment Setup (UPI Details)
            </h2>
            <p style={{ color: '#A0826C', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Customers pay directly into your business bank account via UPI. Fill out your details below to accept payments.
            </p>

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="upi-id">UPI ID *</label>
                <input
                type="text"
                id="upi-id"
                name="upi-id"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="owner@okaxis"
                disabled={loading}
                required />
              </div>

              <div className="form-group">
                <label htmlFor="bank-holder-name">Bank Account Holder Name</label>
                <input
                type="text"
                id="bank-holder-name"
                name="bank-holder-name"
                value={bankHolderName}
                onChange={(e) => setBankHolderName(e.target.value)}
                placeholder="John Doe Enterprise"
                disabled={loading} />
              </div>

              <div className="form-group">
                <label htmlFor="bank-account-number">Bank Account Number</label>
                <input
                type="text"
                id="bank-account-number"
                name="bank-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="1002998877665"
                disabled={loading} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="ifsc-code">IFSC Code</label>
                <input
                type="text"
                id="ifsc-code"
                name="ifsc-code"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                placeholder="HDFC0000123"
                disabled={loading} />
              </div>
            </div>
          </div>
        }

        {/* STEP 3: Operational Setup */}
        {step === 3 &&
        <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 3: Operational Configuration & Custom Tables
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label htmlFor="total-dining-tables">Total Dining Tables</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                  type="button"
                  className="wizard-button btn-secondary"
                  style={{ padding: '6px 15px' }}
                  onClick={() => handleTableCountChange(tableCount - 1)}>
                  
                    -
                  </button>
                  <input
                  type="number"
                  id="total-dining-tables"
                  name="total-dining-tables"
                  value={tableCount}
                  onChange={(e) => handleTableCountChange(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }} />
                
                  <button
                  type="button"
                  className="wizard-button btn-secondary"
                  style={{ padding: '6px 15px' }}
                  onClick={() => handleTableCountChange(tableCount + 1)}>
                  
                    +
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span id="custom-tables-heading" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D4C3B3', textTransform: 'uppercase' }}>
                  Custom Table QR Labels (Click labels to rename)
                </span>
                <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '12px',
                maxHeight: '180px',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.1)',
                padding: '15px',
                borderRadius: '10px',
                border: '1px solid #5C4331'
              }} aria-labelledby="custom-tables-heading">
                  {tablesList.map((tbl, idx) =>
                <div key={idx} className="table-card">
                      <label htmlFor={`table-label-${idx}`} style={{ fontSize: '0.75rem', color: '#A0826C' }}>#{idx + 1}</label>
                      <input
                    type="text"
                    id={`table-label-${idx}`}
                    name={`table-label-${idx}`}
                    value={tbl.label}
                    onChange={(e) => handleTableLabelChange(idx, e.target.value)}
                    placeholder={`Table-${idx + 1}`} />
                  
                    </div>
                )}
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: '10px' }}>
                <div className="toggle-card">
                  <label htmlFor="kitchen-display-enabled" style={{ cursor: 'pointer', display: 'flex', flex: 1, flexDirection: 'column' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Kitchen Screen Console</strong>
                    <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>Staff order tracking board</span>
                  </label>
                  <input
                  type="checkbox"
                  id="kitchen-display-enabled"
                  name="kitchen-display-enabled"
                  checked={kitchenDisplayEnabled}
                  onChange={(e) => setKitchenDisplayEnabled(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                
                </div>

                <div className="toggle-card">
                  <label htmlFor="printer-enabled" style={{ cursor: 'pointer', display: 'flex', flex: 1, flexDirection: 'column' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Thermal Printer Settings</strong>
                    <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>Auto-print receipt on order</span>
                  </label>
                  <input
                  type="checkbox"
                  id="printer-enabled"
                  name="printer-enabled"
                  checked={printerEnabled}
                  onChange={(e) => setPrinterEnabled(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                
                </div>

                <div className="toggle-card">
                  <label htmlFor="inventory-enabled" style={{ cursor: 'pointer', display: 'flex', flex: 1, flexDirection: 'column' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Inventory Tracking</strong>
                    <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>Track ingredient consumption</span>
                  </label>
                  <input
                  type="checkbox"
                  id="inventory-enabled"
                  name="inventory-enabled"
                  checked={inventoryEnabled}
                  onChange={(e) => setInventoryEnabled(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                
                </div>
              </div>
            </div>
          </div>
        }

        {/* STEP 4: Staff Setup */}
        {step === 4 &&
        <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 4: Register Initial Staff Accounts
            </h2>
            <p style={{ color: '#A0826C', fontSize: '0.9rem', marginBottom: '20px' }}>
              Provision manager, chef, and server staff members. They will receive credentials to login directly.
            </p>

            <div style={{
            background: 'rgba(0,0,0,0.1)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #5C4331',
            marginBottom: '25px'
          }}>
              <h4 style={{ margin: '0 0 15px 0', color: 'var(--color-text-secondary)' }}>Add Staff Member</h4>
              <div className="form-grid" style={{ marginBottom: '15px' }}>
                <div className="form-group">
                  <label htmlFor="staff-name">Staff Name</label>
                  <input
                  type="text"
                  id="staff-name"
                  name="staff-name"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Chef Ram" />
                
                </div>
                <div className="form-group">
                  <label htmlFor="staff-email">Email Address</label>
                  <input
                  type="email"
                  id="staff-email"
                  name="staff-email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="ram@cafe.com" />
                
                </div>
                <div className="form-group">
                  <label htmlFor="staff-phone">Phone Number</label>
                  <input
                  type="text"
                  id="staff-phone"
                  name="staff-phone"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="+91 9090909090" />
                
                </div>
                <div className="form-group">
                  <label htmlFor="staff-role">Staff Role</label>
                  <select
                  id="staff-role"
                  name="staff-role"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}>
                  
                    <option value="chef">Chef (Kitchen Staff)</option>
                    <option value="manager">Manager (Operations)</option>
                    <option value="staff">Server (Table Staff)</option>
                  </select>
                </div>
              </div>
              <button
              type="button"
              onClick={addStaffToRoster}
              className="wizard-button btn-secondary">
              
                + Add Staff Member
              </button>
            </div>

            {/* Local Staff Grid */}
            <div style={{ overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-text-secondary)' }}>Staff Roster ({tempStaffList.length})</h4>
              {tempStaffList.length === 0 ?
            <p style={{ color: '#A0826C', fontStyle: 'italic', fontSize: '0.85rem' }}>No staff members added to this setup session yet.</p> :

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #5C4331', color: '#D4C3B3', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Name</th>
                      <th style={{ padding: '8px' }}>Email</th>
                      <th style={{ padding: '8px' }}>Phone</th>
                      <th style={{ padding: '8px' }}>Role</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempStaffList.map((stf, index) =>
                <tr key={index} style={{ borderBottom: '1px solid rgba(0, 0, 0,0.05)' }}>
                        <td style={{ padding: '8px' }}>{stf.name}</td>
                        <td style={{ padding: '8px' }}>{stf.email}</td>
                        <td style={{ padding: '8px' }}>{stf.phone}</td>
                        <td style={{ padding: '8px', textTransform: 'capitalize' }}>{stf.staffRole}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                      type="button"
                      onClick={() => removeStaffFromRoster(index)}
                      style={{ background: 'transparent', border: 'none', color: '#E74C3C', cursor: 'pointer', fontWeight: 'bold' }}>
                      
                            ✕
                          </button>
                        </td>
                      </tr>
                )}
                  </tbody>
                </table>
            }
            </div>
          </div>
        }

        {/* STEP 5: Review & Complete */}
        {step === 5 &&
        <div className="fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
            {/* Visual Animated Checkbox checkmark */}
            <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#27AE60',
            color: 'var(--color-text-primary)',
            fontSize: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: '0 0 15px rgba(39, 174, 96, 0.4)',
            animation: 'bounceIn 0.8s ease'
          }}>
              ✓
            </div>
            <style>{`
              @keyframes bounceIn {
                0% { transform: scale(0.3); opacity: 0; }
                50% { transform: scale(1.1); }
                70% { transform: scale(0.9); }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>

            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 10px 0' }}>All Steps Completed!</h2>
            <p style={{ color: '#A0826C', maxWidth: '500px', margin: '0 auto 30px auto', lineHeight: '1.5' }}>
              Your cafe configuration details, encrypted keys, and staff roles have been validated. Click below to launch your operations portal.
            </p>

            <div style={{
            background: 'rgba(0, 0, 0,0.02)',
            border: '1px solid #5C4331',
            borderRadius: '10px',
            padding: '20px',
            maxWidth: '500px',
            margin: '0 auto 30px auto',
            textAlign: 'left'
          }}>
              <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #5C4331', paddingBottom: '6px', color: 'var(--color-text-secondary)' }}>Configuration Summary</h4>
              <p style={{ margin: '5px 0', fontSize: '0.85rem' }}><strong>Dining Tables:</strong> {tablesList.length} Tables Registered</p>
              <p style={{ margin: '5px 0', fontSize: '0.85rem' }}><strong>Hardware Printing:</strong> {printerEnabled ? 'Enabled' : 'Disabled'}</p>
              <p style={{ margin: '5px 0', fontSize: '0.85rem' }}><strong>Kitchen Display:</strong> {kitchenDisplayEnabled ? 'Enabled' : 'Disabled'}</p>
              <p style={{ margin: '5px 0', fontSize: '0.85rem' }}><strong>UPI ID:</strong> {upiId || 'Not Configured'}</p>
              <p style={{ margin: '5px 0', fontSize: '0.85rem' }}><strong>Staff accounts:</strong> {tempStaffList.length} Users queued for registration</p>
            </div>

            <button
            type="button"
            onClick={handleFinalizeSetup}
            disabled={loading}
            className="wizard-button btn-success"
            style={{ fontSize: '1.1rem', padding: '14px 45px' }}>
            
              {loading ? 'Saving configuration...' : 'Finalize & Launch Portal'}
            </button>
          </div>
        }

        {/* Wizard Navigation Footer controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '35px',
          borderTop: '1px solid #5C4331',
          paddingTop: '20px'
        }}>
          {step > 1 && step < 5 ?
          <button
            type="button"
            onClick={() => setStep((prev) => prev - 1)}
            className="wizard-button btn-secondary"
            disabled={loading}>
            
              ← Previous Step
            </button> :

          <div />
          }

          {step < 5 ?
          <button
            type="button"
            onClick={validateAndNext}
            className="wizard-button btn-primary"
            disabled={loading}>
            
              Next Step →
            </button> :

          <div />
          }
        </div>
      </div>
    </div>);

};

export default OwnerSetup;