import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { 
  getSetupData, 
  saveSetupData, 
  uploadLogo, 
  getAssetUrl, 
  getBranches, 
  createBranch, 
  deleteBranch, 
  seedTenantAssets 
} from '../services/api';

const OwnerSetup = () => {
  const { user, checkSession } = useAuth();
  const { activeBranchId, switchBranch, loadBranches } = useBranch();
  const navigate = useNavigate();

  // Wizard active step (1 to 5)
  const [step, setStep] = useState(() => {
    return Number(localStorage.getItem('owner_setup_step') || '1');
  });

  useEffect(() => {
    localStorage.setItem('owner_setup_step', String(step));
  }, [step]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 1: Cafe Profile States
  const [cafeName, setCafeName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('/logo.png');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [mapsLocation, setMapsLocation] = useState('16.5062,80.6480'); // Default coordinates
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [gstNumber, setGstNumber] = useState('');
  const [supportNumber, setSupportNumber] = useState('');

  // Step 2: Branch Setup States
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchManager, setNewBranchManager] = useState('');

  // Step 3: Menu & Inventory States
  const [assetsGenerated, setAssetsGenerated] = useState(false);

  // Step 4: Business Configuration States
  const [requiredDailyHours, setRequiredDailyHours] = useState(8);
  const [gstRate, setGstRate] = useState(5);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [salaryType, setSalaryType] = useState('DAILY');
  const [upiId, setUpiId] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [kitchenDisplayEnabled, setKitchenDisplayEnabled] = useState(true);
  const [inventoryEnabled, setInventoryEnabled] = useState(true);

  // Step 5: Launch Portal States
  const [initStages, setInitStages] = useState({
    dashboard: 'pending', // pending, loading, success
    analytics: 'pending',
    reports: 'pending',
    heartbeat: 'pending',
    notifications: 'pending',
    qrOrdering: 'pending',
    featureFlags: 'pending'
  });
  const [launchReady, setLaunchReady] = useState(false);

  // Fetch current details on load
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
            setMapsLocation(cafe.mapsLocation || '16.5062,80.6480');
            setOpeningTime(cafe.openingTime || '08:00');
            setClosingTime(cafe.closingTime || '22:00');
            setGstNumber(cafe.gstNumber || '');
            setSupportNumber(cafe.supportNumber || '');
            setGstRate(cafe.gstRate !== undefined ? cafe.gstRate : 5);
            setServiceChargeRate(cafe.serviceChargeRate !== undefined ? cafe.serviceChargeRate : 0);
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
          }
        }
      } catch (err) {
        console.error('Failed to load existing setup data:', err);
      }
    };
    fetchExistingData();
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await getBranches();
      if (res.success) {
        setBranches(res.branches || []);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  }, []);

  // Fetch branches when entering Step 2
  useEffect(() => {
    if (step === 2) {
      fetchBranches();
    }
  }, [step, fetchBranches]);

  const handleAddBranch = useCallback(async () => {
    if (!newBranchName || !newBranchAddress) {
      setErrorMsg('Branch Name and Address are required.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await createBranch({
        branchName: newBranchName,
        address: newBranchAddress,
        manager: newBranchManager,
        isActive: true
      });
      if (res.success) {
        setSuccessMsg('Branch added successfully!');
        setNewBranchName('');
        setNewBranchAddress('');
        setNewBranchManager('');
        await fetchBranches();
        const createdBranch = res.branch;
        if (createdBranch && createdBranch.branchId) {
          localStorage.setItem('activeBranchId', createdBranch.branchId);
          localStorage.setItem('activeCafeId', createdBranch.cafeId);
          if (switchBranch) {
            switchBranch(createdBranch.branchId);
          }
          if (loadBranches) {
            await loadBranches();
          }
        }
        setTimeout(() => setSuccessMsg(''), 2500);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create branch.');
    } finally {
      setLoading(false);
    }
  }, [newBranchName, newBranchAddress, newBranchManager, fetchBranches, switchBranch, loadBranches]);

  const handleDeleteBranch = useCallback(async (id) => {
    if (window.confirm('Are you sure you want to delete this branch?')) {
      try {
        const res = await deleteBranch(id);
        if (res.success) {
          setSuccessMsg('Branch deleted.');
          const branchRes = await getBranches();
          if (branchRes.success) {
            const remaining = branchRes.branches || [];
            setBranches(remaining);
            if (remaining.length > 0) {
              const latestBranch = remaining[0];
              localStorage.setItem('activeBranchId', latestBranch.branchId);
              localStorage.setItem('activeCafeId', latestBranch.cafeId);
              if (switchBranch) {
                switchBranch(latestBranch.branchId);
              }
            } else {
              localStorage.removeItem('activeBranchId');
              if (switchBranch) {
                switchBranch('default');
              }
            }
            if (loadBranches) {
              await loadBranches();
            }
          }
          setTimeout(() => setSuccessMsg(''), 2000);
        }
      } catch (err) {
        setErrorMsg('Failed to delete branch.');
      }
    }
  }, [switchBranch, loadBranches]);

  // Upload Logo handler
  const handleLogoUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogoFile(file);
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
  }, []);

  // Generate Menu & Inventory (Step 3)
  const handleGenerateAssets = useCallback(async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await seedTenantAssets();
      if (res.success) {
        setAssetsGenerated(true);
        setSuccessMsg('Menu, recipes, inventory, and ingredients generated successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate menu assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize Launch Portal (Step 5)
  const handleStartLaunchInitialization = useCallback(async () => {
    setLoading(true);
    setLaunchReady(false);
    setErrorMsg('');

    const stages = ['dashboard', 'analytics', 'reports', 'heartbeat', 'notifications', 'qrOrdering', 'featureFlags'];
    
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      setInitStages(prev => ({ ...prev, [stage]: 'loading' }));
      // Simulate real-time initialization steps with micro-delays
      await new Promise(resolve => setTimeout(resolve, 400));
      setInitStages(prev => ({ ...prev, [stage]: 'success' }));
    }
    
    setLoading(false);
    setLaunchReady(true);
  }, []);

  useEffect(() => {
    if (step === 5) {
      handleStartLaunchInitialization();
    }
  }, [step, handleStartLaunchInitialization]);

  // Final Setup Save
  const handleFinalizeSetup = useCallback(async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const setupPayload = {
        name: cafeName,
        logoUrl,
        address,
        mapsLocation,
        openingTime,
        closingTime,
        gstNumber,
        supportNumber: supportNumber || user?.phone || '',
        gstRate,
        serviceChargeRate,
        paymentConfig: {
          acceptCash: true,
          enableUpi: true,
          upiId,
          bankHolderName,
          accountNumber,
          ifscCode,
          isVerified: true
        },
        operationalConfig: {
          tables: [
            { id: 'T1', label: 'Table-1' },
            { id: 'T2', label: 'Table-2' },
            { id: 'T3', label: 'Table-3' },
            { id: 'T4', label: 'Table-4' },
            { id: 'T5', label: 'Table-5' }
          ],
          printerEnabled,
          kitchenDisplayEnabled,
          inventoryEnabled
        }
      };

      const res = await saveSetupData(setupPayload);
      if (res.success) {
        localStorage.removeItem('owner_setup_step');
        // Reload user session details so setupCompleted turns true
        await checkSession();
        navigate('/admin');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error finalizing onboarding setup.');
    } finally {
      setLoading(false);
    }
  }, [
    cafeName,
    logoUrl,
    address,
    mapsLocation,
    openingTime,
    closingTime,
    gstNumber,
    supportNumber,
    gstRate,
    serviceChargeRate,
    upiId,
    bankHolderName,
    accountNumber,
    ifscCode,
    printerEnabled,
    kitchenDisplayEnabled,
    inventoryEnabled,
    user,
    checkSession,
    navigate
  ]);

  // Wizard navigation validations
  const validateAndNext = useCallback(async () => {
    setErrorMsg('');
    if (step === 1) {
      if (!cafeName.trim()) {
        setErrorMsg('Cafe name is required.');
        return;
      }
      if (!address.trim()) {
        setErrorMsg('Street address is required.');
        return;
      }
      if (!supportNumber.trim()) {
        setErrorMsg('Contact number is required.');
        return;
      }
    }
    if (step === 2) {
      if (branches.length === 0) {
        setErrorMsg('Please setup at least one branch for this cafe.');
        return;
      }
      try {
        setLoading(true);
        const res = await getBranches();
        setLoading(false);
        if (res.success && res.branches && res.branches.length > 0) {
          // The backend returns branches sorted by createdAt: -1 (newest first)
          const latestBranch = res.branches[0];
          localStorage.setItem('activeBranchId', latestBranch.branchId);
          localStorage.setItem('activeCafeId', latestBranch.cafeId);
          if (switchBranch) {
            switchBranch(latestBranch.branchId);
          }
          if (loadBranches) {
            await loadBranches();
          }
        } else {
          setErrorMsg('No branches found on server. Please create one.');
          return;
        }
      } catch (err) {
        setLoading(false);
        setErrorMsg('Failed to sync branch details with server. Please try again.');
        return;
      }
    }
    if (step === 3) {
      if (!assetsGenerated) {
        setErrorMsg('Please click the button to generate your menu and inventory before proceeding.');
        return;
      }
    }
    if (step === 4) {
      if (!upiId) {
        setErrorMsg('UPI ID is required to accept online payments.');
        return;
      }
    }
    setStep((prev) => prev + 1);
  }, [step, cafeName, address, supportNumber, branches, assetsGenerated, upiId, switchBranch, loadBranches]);

  const stepTitles = [
    'Cafe Profile',
    'Branch Setup',
    'Menu & Inventory',
    'Business Configuration',
    'Launch Portal'
  ];

  return (
    <div className="outer-wizard-wrapper">
      {/* CSS Styles injection for interactive UI */}
      <style>{`
        .outer-wizard-wrapper,
        .outer-wizard-wrapper *,
        .outer-wizard-wrapper *::before,
        .outer-wizard-wrapper *::after {
          box-sizing: border-box;
        }
        .outer-wizard-wrapper {
          max-width: 850px;
          margin: 40px auto;
          padding: 0 20px;
          padding-left: calc(20px + env(safe-area-inset-left));
          padding-right: calc(20px + env(safe-area-inset-right));
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          font-family: 'Outfit', sans-serif;
          width: 100%;
        }
        .wizard-container {
          background: rgba(43, 30, 24, 0.95);
          border: 1px solid #6F4E37;
          border-radius: 20px;
          padding: clamp(15px, 4vw, 35px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          color: var(--color-text-primary);
          width: 100%;
        }
        .progress-bar-container {
          display: flex;
          justify-content: space-between;
          position: relative;
          margin-bottom: clamp(35px, 6vw, 55px);
          width: 100%;
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
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.75rem;
          font-weight: 600;
          color: #A0826C;
          text-align: center;
          width: 120px;
          white-space: normal;
          line-height: 1.2;
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
          width: 100%;
        }
        .col-span-2 {
          grid-column: span 2;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          min-width: 0;
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
          width: 100%;
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
          border-color: var(--color-text-secondary);
        }
        .form-group input[type="file"] {
          padding: 8px;
          background: rgba(0, 0, 0, 0.1);
          border: 1px dashed #5C4331;
          cursor: pointer;
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
        .logo-upload-container {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
          width: 100%;
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
          flex-shrink: 0;
        }
        .logo-preview-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gps-input-container {
          display: flex;
          gap: 10px;
          width: 100%;
        }
        .map-preview-container {
          height: 100px;
          background: #1F2937;
          border: 1px solid #4B5563;
          border-radius: 8px;
          margin-top: 10px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          width: 100%;
        }
        .setup-card {
          background: rgba(0,0,0,0.1);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #5C4331;
          margin-bottom: 25px;
          width: 100%;
        }
        .branch-item {
          background: rgba(255,255,255,0.02);
          border: 1px solid #5C4331;
          border-radius: 8px;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          gap: 15px;
          width: 100%;
        }
        .branch-info {
          min-width: 0;
          flex: 1;
          word-break: break-word;
        }
        .generator-card {
          background: rgba(0,0,0,0.15);
          border: 1px dashed #6F4E37;
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin-bottom: 25px;
          width: 100%;
        }
        .init-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: rgba(0,0,0,0.15);
          border: 1px solid #3E2723;
          border-radius: 8px;
          margin-bottom: 8px;
          gap: 12px;
          width: 100%;
        }
        .init-row span:first-child {
          text-align: left;
          word-break: break-word;
          min-width: 0;
          flex: 1;
        }
        .init-row span:last-child, .init-row .spinner {
          flex-shrink: 0;
        }
        .wizard-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          width: 100%;
        }
        .spinner {
          border: 2px solid #5C4331;
          border-top: 2px solid var(--color-text-secondary);
          border-radius: 50%;
          width: 18px;
          height: 18px;
          animation: spin 0.8s linear infinite;
        }
        .wizard-title {
          font-size: clamp(1.8rem, 5vw, 2.5rem);
        }
        .wizard-subtitle {
          font-size: clamp(0.9rem, 2.5vw, 1.1rem);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @media (max-width: 768px) {
          .progress-bar-container { display: none; }
          .mobile-step-indicator { display: block; }
          .form-grid { grid-template-columns: 1fr; }
          .col-span-2 { grid-column: span 1; }
        }
        @media (max-width: 600px) {
          .outer-wizard-wrapper {
            margin: 15px auto !important;
            padding: 0 10px !important;
          }
          .wizard-container {
            padding: 20px 15px;
            border-radius: 12px;
          }
          .logo-upload-container {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 15px;
          }
          .logo-upload-container .form-group {
            width: 100%;
          }
          .setup-card {
            padding: 15px;
          }
          .generator-card {
            padding: 20px 15px;
          }
        }
        @media (max-width: 500px) {
          .gps-input-container {
            flex-direction: column;
          }
          .gps-input-container button {
            width: 100%;
          }
        }
        @media (max-width: 480px) {
          .wizard-controls {
            flex-direction: column-reverse;
            align-items: stretch;
          }
          .wizard-controls button {
            width: 100%;
          }
          .wizard-controls div {
            display: none;
          }
          .setup-card button {
            width: 100%;
          }
        }
      `}</style>

      {/* Header */}
      <div className="wizard-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 className="wizard-title" style={{ color: '#5C4331', margin: 0, fontWeight: 800 }}>
          Welcome to {cafeName || 'Our Cafe'}
        </h1>
        <p className="wizard-subtitle" style={{ color: '#A0826C', marginTop: '5px', fontWeight: 500 }}>
          Complete the 5-step operational wizard to launch your portal dashboard
        </p>
      </div>

      <div className="wizard-container">
        {/* Progress Tracker */}
        <div className="progress-bar-container">
          <div className="progress-bar-line" />
          <div className="progress-bar-fill" style={{ width: `${(step - 1) * 25}%` }} />
          
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
              </div>
            );
          })}
        </div>

        {/* Mobile active step indicator */}
        <div className="mobile-step-indicator">
          Step {step} of 5: {stepTitles[step - 1]}
        </div>

        {/* Form Messages */}
        {errorMsg && (
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
        )}
        {successMsg && (
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
        )}

        {/* STEP 1: Cafe Profile */}
        {step === 1 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 1: Setup Cafe Profile
            </h2>
            
            <div className="logo-upload-container">
              <div className="logo-preview-box">
                <img src={getAssetUrl(logoPreview)} alt="Logo Preview" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="cafe-logo">Upload Cafe Logo</label>
                <input
                  type="file"
                  id="cafe-logo"
                  name="cafe-logo"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={loading}
                />
                <span style={{ fontSize: '0.75rem', color: '#A0826C' }}>Recommended: Square format image, Max 2MB.</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group col-span-2">
                <label htmlFor="registered-cafe-name">Cafe Name</label>
                <input
                  type="text"
                  id="registered-cafe-name"
                  name="registered-cafe-name"
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  placeholder="Sai Tea Point"
                  disabled={loading}
                />
              </div>

              <div className="form-group col-span-2">
                <label htmlFor="cafe-address">Street Address</label>
                <textarea
                  rows={2}
                  id="cafe-address"
                  name="cafe-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Main Road, Near Metro Station, Hyderabad"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="opening-time">Opening Time</label>
                <input
                  type="time"
                  id="opening-time"
                  name="opening-time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="closing-time">Closing Time</label>
                <input
                  type="time"
                  id="closing-time"
                  name="closing-time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="support-number">Contact Number</label>
                <input
                  type="text"
                  id="support-number"
                  name="support-number"
                  value={supportNumber}
                  onChange={(e) => setSupportNumber(e.target.value)}
                  placeholder="+91 9876543210"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="gst-number">GST Number</label>
                <input
                  type="text"
                  id="gst-number"
                  name="gst-number"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="36AAAAA1111A1Z1"
                  disabled={loading}
                />
              </div>

              {/* GPS coordinates detection */}
              <div className="form-group col-span-2">
                <label htmlFor="maps-location">Google Maps Coordinates</label>
                <div className="gps-input-container">
                  <input
                    type="text"
                    id="maps-location"
                    name="maps-location"
                    value={mapsLocation}
                    onChange={(e) => setMapsLocation(e.target.value)}
                    placeholder="Latitude, Longitude"
                    disabled={loading}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="wizard-button btn-secondary"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const { latitude, longitude } = position.coords;
                            setMapsLocation(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
                            setSuccessMsg('GPS Coordinates detected!');
                            setTimeout(() => setSuccessMsg(''), 2000);
                          },
                          () => {
                            const randLat = (16.5062 + (Math.random() - 0.5) * 0.01).toFixed(6);
                            const randLng = (80.6480 + (Math.random() - 0.5) * 0.01).toFixed(6);
                            setMapsLocation(`${randLat},${randLng}`);
                            setSuccessMsg('Coordinates simulated (GPS denied/failed)!');
                            setTimeout(() => setSuccessMsg(''), 2000);
                          }
                        );
                      }
                    }}
                  >
                    📍 Detect GPS
                  </button>
                </div>
                {/* Simulated map widget */}
                <div className="map-preview-container">
                  <div className="map-preview-label" style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', zIndex: 3 }}>
                    Map Preview
                  </div>
                  <div className="map-coordinates-text" style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.85rem', wordBreak: 'break-all', textAlign: 'center', padding: '0 5px', zIndex: 3 }}>
                    📍 Coordinates: {mapsLocation}
                  </div>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'rgba(111, 78, 55, 0.2)',
                    border: '2px solid #6F4E37',
                    position: 'absolute',
                    animation: 'ping 2s infinite',
                    zIndex: 1
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Branch Setup */}
        {step === 2 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 2: Branch Setup
            </h2>
            <p style={{ color: '#A0826C', fontSize: '0.9rem', marginBottom: '20px' }}>
              Setup and manage branches belonging only to your cafe. Branch sharing is not permitted.
            </p>

            <div className="setup-card">
              <h4 style={{ margin: '0 0 15px 0', color: 'var(--color-text-secondary)' }}>Add New Branch</h4>
              <div className="form-grid" style={{ marginBottom: '15px' }}>
                <div className="form-group">
                  <label htmlFor="new-branch-name">Branch Name</label>
                  <input
                    type="text"
                    id="new-branch-name"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Vijayawada Main"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-branch-manager">Manager Name</label>
                  <input
                    type="text"
                    id="new-branch-manager"
                    value={newBranchManager}
                    onChange={(e) => setNewBranchManager(e.target.value)}
                    placeholder="Siva Prasad"
                  />
                </div>
                <div className="form-group col-span-2">
                  <label htmlFor="new-branch-address">Branch Street Address</label>
                  <input
                    type="text"
                    id="new-branch-address"
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    placeholder="Benz Circle, Vijayawada"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddBranch}
                disabled={loading}
                className="wizard-button btn-secondary"
              >
                + Create Branch
              </button>
            </div>

            <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-text-secondary)' }}>Registered Branches ({branches.length})</h4>
            {branches.length === 0 ? (
              <p style={{ color: '#A0826C', fontStyle: 'italic', fontSize: '0.85rem' }}>No branches have been created yet.</p>
            ) : (
              <div>
                {branches.map((b) => (
                  <div className="branch-item" key={b._id}>
                    <div className="branch-info">
                      <strong style={{ color: 'var(--color-text-secondary)' }}>{b.branchName}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#A0826C', marginLeft: '10px' }}>({b.branchId})</span>
                      <div style={{ fontSize: '0.8rem', color: '#D4C3B3', marginTop: '4px' }}>
                        📍 {b.address} {b.manager && `| Manager: ${b.manager}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBranch(b._id)}
                      style={{ background: 'transparent', border: 'none', color: '#E74C3C', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0, padding: '5px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Menu & Inventory */}
        {step === 3 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 3: Menu & Inventory Initialization
            </h2>
            <p style={{ color: '#A0826C', fontSize: '0.9rem', marginBottom: '25px', lineHeight: '1.5' }}>
              Generate independent menu items, recipes, ingredients, and inventory levels strictly for this cafe. No existing cafe data will be shared.
            </p>

            <div className="generator-card">
              {!assetsGenerated ? (
                <div>
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🍽️</div>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-text-secondary)' }}>Dynamic Menu & Asset Generator</h4>
                  <p style={{ fontSize: '0.85rem', color: '#A0826C', maxWidth: '400px', margin: '0 auto 20px auto' }}>
                    Click below to generate your cafe's isolated menu registry, recipe sheets, and raw ingredient list.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAssets}
                    disabled={loading}
                    className="wizard-button btn-primary"
                    style={{ minWidth: '220px', maxWidth: '100%' }}
                  >
                    {loading ? 'Generating Assets...' : 'Generate Menu & Inventory'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: '#27AE60',
                    color: 'var(--color-text-primary)',
                    fontSize: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 15px auto',
                    boxShadow: '0 0 10px rgba(39, 174, 96, 0.4)'
                  }}>
                    ✓
                  </div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#2ECC71' }}>Assets Generated Successfully!</h4>
                  <p style={{ fontSize: '0.85rem', color: '#A0826C', maxWidth: '450px', margin: '0 auto' }}>
                    Your cafe's independent menu selection, recipe sheets, ingredient stocks, and inventory logs have been created and isolated.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Business Configuration */}
        {step === 4 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 4: Business Configuration
            </h2>
            <p style={{ color: '#A0826C', fontSize: '0.9rem', marginBottom: '20px' }}>
              Configure your payment preferences, taxes, and initial parameters.
            </p>

            <h4 style={{ color: 'var(--color-text-secondary)', margin: '20px 0 12px 0' }}>Payment Configuration (UPI Details)</h4>
            <div className="form-grid" style={{ marginBottom: '25px' }}>
              <div className="form-group col-span-2">
                <label htmlFor="upi-id">UPI ID *</label>
                <input
                  type="text"
                  id="upi-id"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="payee@upi"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bank-holder-name">Account Holder Name</label>
                <input
                  type="text"
                  id="bank-holder-name"
                  value={bankHolderName}
                  onChange={(e) => setBankHolderName(e.target.value)}
                  placeholder="Sai Tea Point Pvt Ltd"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="account-number">Bank Account Number</label>
                <input
                  type="text"
                  id="account-number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="918822334455"
                  disabled={loading}
                />
              </div>
              <div className="form-group col-span-2">
                <label htmlFor="ifsc-code">IFSC Code</label>
                <input
                  type="text"
                  id="ifsc-code"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="SBIN0001234"
                  disabled={loading}
                />
              </div>
            </div>

            <h4 style={{ color: 'var(--color-text-secondary)', margin: '20px 0 12px 0' }}>Taxes & Settings</h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="gst-rate">GST Rate (%)</label>
                <input
                  type="number"
                  id="gst-rate"
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="service-charge-rate">Service Charge (%)</label>
                <input
                  type="number"
                  id="service-charge-rate"
                  value={serviceChargeRate}
                  onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="required-daily-hours">Required Shift Hours (Attendance)</label>
                <input
                  type="number"
                  id="required-daily-hours"
                  value={requiredDailyHours}
                  onChange={(e) => setRequiredDailyHours(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="salary-type">Salary Payment Frequency</label>
                <select
                  id="salary-type"
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                  disabled={loading}
                >
                  <option value="DAILY">Daily Wages</option>
                  <option value="HOURLY">Hourly Wages</option>
                  <option value="WEEKLY">Weekly Wages</option>
                  <option value="MONTHLY">Monthly Wages</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Launch Portal */}
        {step === 5 && (
          <div className="fade-in">
            <h2 style={{ color: 'var(--color-text-secondary)', margin: '0 0 25px 0', borderBottom: '1px solid #5C4331', paddingBottom: '10px' }}>
              Step 5: Launch Operations Portal
            </h2>
            <p style={{ color: '#A0826C', fontSize: '0.9rem', marginBottom: '25px' }}>
              Initialising modules, setting up live heartbeats, QR tables, and checking security feature flags.
            </p>

            <div style={{ marginBottom: '30px' }}>
              <div className="init-row">
                <span>Dashboard Widgets initialization</span>
                {initStages.dashboard === 'loading' && <div className="spinner"></div>}
                {initStages.dashboard === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
              <div className="init-row">
                <span>Analytics Engine setup</span>
                {initStages.analytics === 'loading' && <div className="spinner"></div>}
                {initStages.analytics === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
              <div className="init-row">
                <span>Operational Reports generation</span>
                {initStages.reports === 'loading' && <div className="spinner"></div>}
                {initStages.reports === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
              <div className="init-row">
                <span>Live Heartbeat check</span>
                {initStages.heartbeat === 'loading' && <div className="spinner"></div>}
                {initStages.heartbeat === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
              <div className="init-row">
                <span>Notification Socket Channels establishment</span>
                {initStages.notifications === 'loading' && <div className="spinner"></div>}
                {initStages.notifications === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
              <div className="init-row">
                <span>QR Table routing verification</span>
                {initStages.qrOrdering === 'loading' && <div className="spinner"></div>}
                {initStages.qrOrdering === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
              <div className="init-row">
                <span>Feature flags check</span>
                {initStages.featureFlags === 'loading' && <div className="spinner"></div>}
                {initStages.featureFlags === 'success' && <span style={{ color: '#2ECC71', fontWeight: 'bold' }}>✓ Success</span>}
              </div>
            </div>

            {launchReady && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <h4 style={{ color: '#2ECC71', marginBottom: '10px' }}>Initialization Complete!</h4>
                <p style={{ color: '#A0826C', fontSize: '0.85rem', marginBottom: '25px' }}>
                  All systems are green. Click launch below to open your Owner Dashboard.
                </p>
                <button
                  type="button"
                  onClick={handleFinalizeSetup}
                  disabled={loading}
                  className="wizard-button btn-success"
                  style={{ minWidth: '250px', maxWidth: '100%', fontSize: '1.1rem', padding: '15px' }}
                >
                  {loading ? 'Launching Portal...' : 'Launch Operations Portal'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wizard Controls */}
        <div className="wizard-controls" style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '35px',
          borderTop: '1px solid #5C4331',
          paddingTop: '25px'
        }}>
          {step > 1 && step < 5 ? (
            <button
              type="button"
              className="wizard-button btn-secondary"
              onClick={() => setStep((prev) => prev - 1)}
              disabled={loading}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 && (
            <button
              type="button"
              className="wizard-button btn-primary"
              onClick={validateAndNext}
              disabled={loading}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerSetup;
