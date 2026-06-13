import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OwnerLayout from '../components/OwnerLayout';
import { getSetupData, saveSetupData, updateOwnerProfile, getBranches, createBranch, updateBranch, deleteBranch, getStaff, verifyRazorpayKeys } from '../services/api';

const OwnerProfilePage = () => {
  const { user, checkSession, logout } = useAuth();
  const navigate = useNavigate();

  const [cafeData, setCafeData] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [operationalConfig, setOpsConfig] = useState(null);
  const [branches, setBranches] = useState([]);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [form, setForm] = useState({});
  const [editingBranchId, setEditingBranchId] = useState(null);

  const [verifyingKeys, setVerifyingKeys] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedQrTable, setSelectedQrTable] = useState(null);
  const [taxRate, setTaxRateState] = useState(() => parseFloat(localStorage.getItem('owner_tax_rate') || '5'));
  const [serviceCharge, setServiceChargeState] = useState(() => parseFloat(localStorage.getItem('owner_service_charge') || '0'));

  const testRazorpayConnection = async (keyId, secret) => {
    if (!keyId || !secret) {
      showToast('Key ID and Secret are required to test.', false);
      return;
    }
    setVerifyingKeys(true);
    try {
      const res = await verifyRazorpayKeys(keyId, secret);
      if (res.success) {
        showToast('Razorpay connection verified successfully!');
        setForm((f) => ({ ...f, isVerified: true }));
      } else {
        showToast('Verification failed. Check credentials.', false);
        setForm((f) => ({ ...f, isVerified: false }));
      }
    } catch (err) {
      showToast('Verification failed: Bad credentials.', false);
      setForm((f) => ({ ...f, isVerified: false }));
    } finally {
      setVerifyingKeys(false);
    }
  };

  const handleCopyUrl = (table) => {
    const url = `${window.location.origin}/?table=${table}&cafeId=${user?.cafeId || ''}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    showToast('Table URL copied!');
  };

  const showToast = (msg, ok = true) => {setToast({ msg, ok });setTimeout(() => setToast(null), 3000);};

  const openEditBranchModal = (branch) => {
    setForm({
      branchName: branch.branchName || '',
      address: branch.address || '',
      manager: branch.manager || '',
      isActive: branch.isActive !== undefined ? branch.isActive : true
    });
    setEditingBranchId(branch._id);
    setActiveModal('editBranch');
  };

  const handleDeleteBranch = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete branch "${name}"?`)) return;
    setSaving(true);
    try {
      await deleteBranch(id);
      showToast(`Branch "${name}" deleted.`);
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Delete failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [r, br, st] = await Promise.all([getSetupData(), getBranches(), getStaff()]);
      if (r.success) {setCafeData(r.cafe);setPaymentConfig(r.paymentConfig);setOpsConfig(r.operationalConfig);}
      if (br.success) setBranches(br.branches || []);
      if (st.success) setStaffCount(st.staff?.length || 0);
    } catch {showToast('Failed to load.', false);} finally
    {setLoading(false);}
  };

  useEffect(() => {load();}, []);

  const openModal = (key) => {
    const prefill = {
      owner: { name: user?.name || '', phone: user?.phone || '' },
      cafe: { name: cafeData?.name || '', businessType: cafeData?.businessType || 'Cafe', branchCount: cafeData?.branchCount || 1, gstNumber: cafeData?.gstNumber || '' },
      location: { address: cafeData?.address || '', city: cafeData?.city || '', state: cafeData?.state || '', pincode: cafeData?.pincode || '', mapsLocation: cafeData?.mapsLocation || '' },
      hours: { openingTime: cafeData?.openingTime || '', closingTime: cafeData?.closingTime || '', supportNumber: cafeData?.supportNumber || '' },
      payment: { razorpayKeyId: paymentConfig?.razorpayKeyId || '', razorpaySecret: '', upiId: paymentConfig?.upiId || '', bankHolderName: paymentConfig?.bankHolderName || '', accountNumber: paymentConfig?.accountNumber || '', ifscCode: paymentConfig?.ifscCode || '', taxRate: taxRate, serviceCharge: serviceCharge, isVerified: paymentConfig?.isVerified || false },
      ops: { tableCount: operationalConfig?.tables?.length || 0, kitchenDisplayEnabled: operationalConfig?.kitchenDisplayEnabled || false, printerEnabled: operationalConfig?.printerEnabled || false, inventoryEnabled: operationalConfig?.inventoryEnabled || false },
      branch: { branchName: '', address: '', manager: '' },
      qr_codes: {}
    }[key] || {};
    setForm(prefill);
    setActiveModal(key);
  };

  const closeModal = () => setActiveModal(null);

  const saveModal = async () => {
    if (activeModal === 'qr_codes') {
      closeModal();
      return;
    }
    setSaving(true);
    try {
      if (activeModal === 'owner') {await updateOwnerProfile(form);await checkSession();} else
      if (activeModal === 'cafe') await saveSetupData(form);else
      if (activeModal === 'location') await saveSetupData(form);else
      if (activeModal === 'hours') await saveSetupData(form);else
      if (activeModal === 'payment') {
        const { taxRate: newTaxRate, serviceCharge: newServiceCharge, ...paymentFields } = form;
        await saveSetupData({ paymentConfig: paymentFields });
        localStorage.setItem('owner_tax_rate', String(newTaxRate !== undefined ? newTaxRate : 5));
        localStorage.setItem('owner_service_charge', String(newServiceCharge !== undefined ? newServiceCharge : 0));
        setTaxRateState(parseFloat(newTaxRate !== undefined ? newTaxRate : 5));
        setServiceChargeState(parseFloat(newServiceCharge !== undefined ? newServiceCharge : 0));
      } else
      if (activeModal === 'ops') {
        const tables = Array.from({ length: Number(form.tableCount) }, (_, i) => ({ id: `T${i + 1}`, label: `Table-${i + 1}` }));
        await saveSetupData({ operationalConfig: { tables, kitchenDisplayEnabled: form.kitchenDisplayEnabled, printerEnabled: form.printerEnabled, inventoryEnabled: form.inventoryEnabled } });
      } else if (activeModal === 'branch') {await createBranch(form);} else
      if (activeModal === 'editBranch') {await updateBranch(editingBranchId, form);}
      await load();showToast('Saved successfully!');closeModal();
    } catch (err) {showToast(err?.response?.data?.message || 'Save failed.', false);} finally
    {setSaving(false);}
  };

  const fld = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Auto-fill location from device GPS using OpenStreetMap Nominatim (free, no API key)
  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {showToast('Geolocation not supported on this device.', false);return;}
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lon } = coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const a = data.address || {};
          const street = [a.road, a.suburb || a.neighbourhood || a.village].filter(Boolean).join(', ');
          const city = a.city || a.town || a.county || '';
          const state = a.state || '';
          const pin = a.postcode || '';
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
          setForm((f) => ({ ...f, address: street || f.address, city, state, pincode: pin, mapsLocation: mapsUrl }));
          showToast('Location filled from GPS!');
        } catch {showToast('Could not fetch address. Try manually.', false);} finally
        {setGeoLoading(false);}
      },
      (err) => {setGeoLoading(false);showToast(err.code === 1 ? 'Location permission denied.' : 'Could not get location.', false);},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const mask = (v) => v ? '•'.repeat(Math.max(0, v.length - 4)) + v.slice(-4) : '—';

  const cards = [
  {
    key: 'owner', icon: '👤', title: 'Owner Profile',
    rows: [['Name', user?.name], ['Phone', user?.phone], ['Email', user?.email], ['Last Login', fmtDate(user?.lastLogin)]]
  },
  {
    key: 'cafe', icon: '🏪', title: 'Cafe Identity',
    rows: [['Cafe Name', cafeData?.name], ['Type', cafeData?.businessType], ['Staff Count', staffCount], ['GST', cafeData?.gstNumber || '—']]
  },
  {
    key: 'location', icon: '📍', title: 'Location',
    rows: [['Address', cafeData?.address || '—'], ['City', cafeData?.city || '—'], ['State', cafeData?.state || '—'], ['Pincode', cafeData?.pincode || '—']]
  },
  {
    key: 'hours', icon: '⏰', title: 'Business Hours',
    rows: [['Opens', cafeData?.openingTime || '—'], ['Closes', cafeData?.closingTime || '—'], ['Support', cafeData?.supportNumber || '—']]
  },
  {
    key: 'payment', icon: '💳', title: 'Payment Setup',
    rows: [['Razorpay', paymentConfig?.isVerified ? '✅ Verified' : '○ Not set'], ['Tax Rate (GST)', `${taxRate}%`], ['Service Charge', `${serviceCharge}%`], ['UPI ID', paymentConfig?.upiId || '—']]
  },
  {
    key: 'ops', icon: '⚙️', title: 'Operations',
    rows: [['Tables', operationalConfig?.tables?.length || 0], ['Kitchen Display', operationalConfig?.kitchenDisplayEnabled ? 'On' : 'Off'], ['Printer', operationalConfig?.printerEnabled ? 'On' : 'Off']]
  },
  {
    key: 'qr_codes', icon: '📋', title: 'Table QR Codes',
    rows: [['Total Tables', operationalConfig?.tables?.length || 0], ['QR Generator', 'Click to view & download']]
  }];


  const modalFields = {
    owner:
    <>
        <label className="mlabel" htmlFor="profile-owner-name">Owner Name</label>
        <input className="minput" id="profile-owner-name" name="profile-owner-name" value={form.name || ''} onChange={fld('name')} placeholder="Full name" />
        <label className="mlabel" htmlFor="profile-owner-phone">Phone Number</label>
        <input className="minput" id="profile-owner-phone" name="profile-owner-phone" value={form.phone || ''} onChange={fld('phone')} placeholder="+91 XXXXXXXXXX" type="tel" />
      </>,

    cafe:
    <>
        <label className="mlabel" htmlFor="profile-cafe-name">Cafe Name</label>
        <input className="minput" id="profile-cafe-name" name="profile-cafe-name" value={form.name || ''} onChange={fld('name')} />
        <label className="mlabel" htmlFor="profile-business-type">Business Type</label>
        <select className="minput" id="profile-business-type" name="profile-business-type" value={form.businessType || 'Cafe'} onChange={fld('businessType')}>
          {['Cafe', 'Restaurant', 'Bakery', 'Cloud Kitchen'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="mlabel" htmlFor="profile-branch-count">Branch Count</label>
        <input className="minput" id="profile-branch-count" name="profile-branch-count" type="number" min={1} value={form.branchCount || 1} onChange={fld('branchCount')} />
        <label className="mlabel" htmlFor="profile-gst-number">GST Number</label>
        <input className="minput" id="profile-gst-number" name="profile-gst-number" value={form.gstNumber || ''} onChange={fld('gstNumber')} placeholder="22AAAAA0000A1Z5" />
      </>,

    location:
    <>
        {/* GPS auto-fill button */}
        <button
        type="button"
        onClick={fetchCurrentLocation}
        disabled={geoLoading}
        style={{
          width: '100%', padding: '11px', marginBottom: '18px',
          background: geoLoading ? 'rgba(111,78,55,.3)' : 'rgba(111,78,55,.15)',
          border: '1px solid rgba(111,78,55,.5)',
          borderRadius: '10px', color: '#E6D5C3',
          fontWeight: 700, fontSize: '.875rem', cursor: geoLoading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          fontFamily: 'inherit', transition: 'all .2s'
        }}
        onMouseOver={(e) => {if (!geoLoading) e.currentTarget.style.background = 'rgba(111,78,55,.28)';}}
        onMouseOut={(e) => {if (!geoLoading) e.currentTarget.style.background = 'rgba(111,78,55,.15)';}}>
        
          {geoLoading ?
        <><span style={{ width: 14, height: 14, border: '2px solid rgba(230,213,195,.3)', borderTopColor: '#E6D5C3', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> Detecting location…</> :

        <>📍 Use Current Location<span style={{ fontSize: '.75rem', opacity: .7, fontWeight: 500 }}>— auto-fill all fields</span></>
        }
        </button>

        <label className="mlabel" htmlFor="profile-address">Full Address</label>
        <input className="minput" id="profile-address" name="profile-address" value={form.address || ''} onChange={fld('address')} placeholder="Street, Area" />
        <label className="mlabel" htmlFor="profile-city">City</label>
        <input className="minput" id="profile-city" name="profile-city" value={form.city || ''} onChange={fld('city')} />
        <label className="mlabel" htmlFor="profile-state">State</label>
        <input className="minput" id="profile-state" name="profile-state" value={form.state || ''} onChange={fld('state')} />
        <label className="mlabel" htmlFor="profile-pincode">Pincode</label>
        <input className="minput" id="profile-pincode" name="profile-pincode" value={form.pincode || ''} onChange={fld('pincode')} />
        <label className="mlabel" htmlFor="profile-maps-location">Google Maps URL</label>
        <input className="minput" id="profile-maps-location" name="profile-maps-location" value={form.mapsLocation || ''} onChange={fld('mapsLocation')} placeholder="https://maps.google.com/..." />
      </>,

    hours:
    <>
        <label className="mlabel" htmlFor="profile-opening-time">Opening Time</label>
        <input className="minput" id="profile-opening-time" name="profile-opening-time" type="time" value={form.openingTime || ''} onChange={fld('openingTime')} />
        <label className="mlabel" htmlFor="profile-closing-time">Closing Time</label>
        <input className="minput" id="profile-closing-time" name="profile-closing-time" type="time" value={form.closingTime || ''} onChange={fld('closingTime')} />
        <label className="mlabel" htmlFor="profile-support-phone">Support Phone Number</label>
        <input className="minput" id="profile-support-phone" name="profile-support-phone" type="tel" value={form.supportNumber || ''} onChange={fld('supportNumber')} placeholder="+91 XXXXXXXXXX" />
      </>,

    payment:
    <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px', padding: '12px', background: 'rgba(0, 0, 0,0.02)', borderRadius: '8px', border: '1px solid rgba(230,213,195,0.1)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>Razorpay Verification: {form.isVerified ? '✅ Verified' : '❌ Unverified'}</span>
          <button
          type="button"
          onClick={() => testRazorpayConnection(form.razorpayKeyId, form.razorpaySecret)}
          disabled={verifyingKeys}
          style={{ marginTop: '8px', background: verifyingKeys ? '#3D2820' : '#6F4E37', color: 'var(--color-text-primary)', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: verifyingKeys ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>
          
            {verifyingKeys ? 'Testing Connection...' : 'Test Razorpay Connection'}
          </button>
        </div>

        <label className="mlabel" htmlFor="profile-razorpay-key">Razorpay Key ID</label>
        <input className="minput" id="profile-razorpay-key" name="profile-razorpay-key" value={form.razorpayKeyId || ''} onChange={fld('razorpayKeyId')} placeholder="rzp_live_..." />
        <label className="mlabel" htmlFor="profile-razorpay-secret">Razorpay Secret</label>
        <input className="minput" id="profile-razorpay-secret" name="profile-razorpay-secret" type="password" value={form.razorpaySecret || ''} onChange={fld('razorpaySecret')} placeholder="Enter secret (only to change)" />
        
        <label className="mlabel" htmlFor="profile-tax-rate">GST Tax Rate (%)</label>
        <input className="minput" id="profile-tax-rate" name="profile-tax-rate" type="number" min={0} value={form.taxRate !== undefined ? form.taxRate : 5} onChange={fld('taxRate')} />
        <label className="mlabel" htmlFor="profile-service-charge">Service Charge (%)</label>
        <input className="minput" id="profile-service-charge" name="profile-service-charge" type="number" min={0} value={form.serviceCharge !== undefined ? form.serviceCharge : 0} onChange={fld('serviceCharge')} />
        
        <label className="mlabel" htmlFor="profile-upi-id">UPI ID</label>
        <input className="minput" id="profile-upi-id" name="profile-upi-id" value={form.upiId || ''} onChange={fld('upiId')} placeholder="name@upi" />
        <label className="mlabel" htmlFor="profile-bank-holder">Bank Holder Name</label>
        <input className="minput" id="profile-bank-holder" name="profile-bank-holder" value={form.bankHolderName || ''} onChange={fld('bankHolderName')} />
        <label className="mlabel" htmlFor="profile-account-number">Account Number</label>
        <input className="minput" id="profile-account-number" name="profile-account-number" value={form.accountNumber || ''} onChange={fld('accountNumber')} />
        <label className="mlabel" htmlFor="profile-ifsc-code">IFSC Code</label>
        <input className="minput" id="profile-ifsc-code" name="profile-ifsc-code" value={form.ifscCode || ''} onChange={fld('ifscCode')} placeholder="SBIN0001234" />
      </>,

    qr_codes:
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem', opacity: 0.8, margin: 0 }}>Select a table below to view and test its digital QR code. The QR code links directly to your cafe's ordering menu.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="mlabel" style={{ margin: 0 }}>Select Table</label>
          <select
          value={selectedQrTable || ''}
          onChange={(e) => setSelectedQrTable(e.target.value)}
          className="minput">
          
            <option value="" disabled>-- Select a Table --</option>
            {(operationalConfig?.tables || []).map((t) => {
            const num = t.id.replace('T', '');
            return <option key={t.id} value={num}>{t.label}</option>;
          })}
          </select>
        </div>

        {selectedQrTable &&
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '20px', background: 'rgba(0, 0, 0,0.02)', border: '1px dashed rgba(230,213,195,0.2)', borderRadius: '12px', marginTop: '10px' }}>
            <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
              <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}`)}`}
            alt={`Table ${selectedQrTable} QR Code`}
            style={{ display: 'block', width: '150px', height: '150px' }} />
          
            </div>
            
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
            onClick={() => handleCopyUrl(selectedQrTable)}
            className="mbtn-save"
            style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}>
            
                {copiedLink ? '✓ Copied' : '🔗 Copy Link'}
              </button>
              <a
            href={`${window.location.origin}/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}`}
            target="_blank"
            rel="noreferrer"
            className="mbtn-cancel"
            style={{ flex: 1, padding: '8px', fontSize: '0.8rem', textAlign: 'center', textDecoration: 'none', border: '1px solid rgba(230,213,195,0.2)' }}>
            
                🌐 Test Link
              </a>
            </div>
          </div>
      }
      </div>,

    ops:
    <>
        <label className="mlabel" htmlFor="profile-table-count">Number of Tables</label>
        <input className="minput" id="profile-table-count" name="profile-table-count" type="number" min={0} value={form.tableCount || 0} onChange={fld('tableCount')} />
        <div className="mtoggle-row">
          <label className="mlabel" htmlFor="profile-kds-enabled" style={{ margin: 0 }}>Kitchen Display System</label>
          <input type="checkbox" id="profile-kds-enabled" name="profile-kds-enabled" className="mtoggle" checked={!!form.kitchenDisplayEnabled} onChange={fld('kitchenDisplayEnabled')} />
        </div>
        <div className="mtoggle-row">
          <label className="mlabel" htmlFor="profile-printer-enabled" style={{ margin: 0 }}>Invoice Printer</label>
          <input type="checkbox" id="profile-printer-enabled" name="profile-printer-enabled" className="mtoggle" checked={!!form.printerEnabled} onChange={fld('printerEnabled')} />
        </div>
        <div className="mtoggle-row">
          <label className="mlabel" htmlFor="profile-inventory-enabled" style={{ margin: 0 }}>Inventory Tracking</label>
          <input type="checkbox" id="profile-inventory-enabled" name="profile-inventory-enabled" className="mtoggle" checked={!!form.inventoryEnabled} onChange={fld('inventoryEnabled')} />
        </div>
      </>,

    branch:
    <>
        <label className="mlabel" htmlFor="branch-new-name">Branch Name *</label>
        <input className="minput" id="branch-new-name" name="branch-new-name" value={form.branchName || ''} onChange={fld('branchName')} placeholder="e.g. Hyderabad Central" required />
        <label className="mlabel" htmlFor="branch-new-address">Address *</label>
        <input className="minput" id="branch-new-address" name="branch-new-address" value={form.address || ''} onChange={fld('address')} placeholder="Full branch address" required />
        <label className="mlabel" htmlFor="branch-new-manager">Manager Name</label>
        <input className="minput" id="branch-new-manager" name="branch-new-manager" value={form.manager || ''} onChange={fld('manager')} placeholder="Optional" />
      </>,

    editBranch:
    <>
        <label className="mlabel" htmlFor="branch-edit-name">Branch Name *</label>
        <input className="minput" id="branch-edit-name" name="branch-edit-name" value={form.branchName || ''} onChange={fld('branchName')} placeholder="e.g. Hyderabad Central" required />
        <label className="mlabel" htmlFor="branch-edit-address">Address *</label>
        <input className="minput" id="branch-edit-address" name="branch-edit-address" value={form.address || ''} onChange={fld('address')} placeholder="Full branch address" required />
        <label className="mlabel" htmlFor="branch-edit-manager">Manager Name</label>
        <input className="minput" id="branch-edit-manager" name="branch-edit-manager" value={form.manager || ''} onChange={fld('manager')} placeholder="Optional" />
        <div className="mtoggle-row">
          <label className="mlabel" htmlFor="branch-edit-active" style={{ margin: 0 }}>Is Active</label>
          <input type="checkbox" id="branch-edit-active" name="branch-edit-active" className="mtoggle" checked={!!form.isActive} onChange={fld('isActive')} />
        </div>
      </>

  };

  const modalTitles = { owner: 'Edit Owner Profile', cafe: 'Edit Cafe Identity', location: 'Edit Location', hours: 'Edit Business Hours', payment: 'Edit Payment Setup', ops: 'Edit Operations', branch: 'Add New Branch', editBranch: 'Edit Branch Details', qr_codes: 'Table QR Codes' };

  return (
    <OwnerLayout>
      <style>{`
        .pp { max-width:900px; margin:0 auto; padding:28px 20px 60px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .pp { animation:fadeIn .35s ease; }

        /* banner */
        .pp-banner {
          background:linear-gradient(135deg,#1C2420 0%,#121815 55%,#24302A 100%);
          border-radius:16px; position:relative; overflow:hidden;
          margin-bottom:24px; border:1px solid rgba(143,168,155,.1);
          display:flex; align-items:center; justify-content:center;
          padding: 30px 20px;
        }
        .pp-avatar-wrap { 
          display:flex; flex-direction:column; align-items:center; gap:10px; 
        }
        .pp-avatar {
          width:84px; height:84px; border-radius:50%;
          border:4px solid #121815; background:#1C2420;
          display:flex; align-items:center; justify-content:center;
          font-size:2rem; overflow:hidden;
          box-shadow:0 6px 20px rgba(0,0,0,.5);
        }
        .pp-avatar img { width:100%; height:100%; object-fit:cover; }
        .pp-identity h2 { font-size:1.35rem; font-weight:800; color:#FAF6F0; margin:0; text-align:center; }
        .pp-identity p  { font-size:.78rem; color:#788E82; margin:2px 0 0; font-weight:600; text-align:center; }

        /* progress */
        .pp-prog {
          background:rgba(28,36,32,.7); border:1px solid rgba(143,168,155,.1);
          border-radius:12px; padding:14px 18px; margin-bottom:28px;
          display:flex; align-items:center; gap:14px;
        }
        .prog-outer { flex:1; height:7px; background:rgba(0,0,0,.4); border-radius:4px; overflow:hidden; }
        .prog-inner { height:100%; background:linear-gradient(90deg,#8FA89B,#A2B9AC); border-radius:4px; transition:width .4s; }
        .pp-prog span { font-size:.82rem; font-weight:700; color:#FAF6F0; white-space:nowrap; }
        .btn-setup { background:#8FA89B; color:#121815; border:none; padding:8px 16px; border-radius:8px; font-weight:700; font-size:.8rem; cursor:pointer; white-space:nowrap; font-family:inherit; }
        .btn-setup:hover { background:#A2B9AC; }

        /* section card */
        .sec-card {
          background:rgba(28,36,32,.75);
          border:1px solid rgba(143,168,155,.1);
          border-radius:14px; padding:20px;
          cursor:pointer; transition:all .2s;
          position:relative; overflow:hidden;
        }
        .sec-card::after {
          content:''; position:absolute; inset:0;
          background:rgba(143,168,155,0); transition:background .2s;
          border-radius:14px; pointer-events:none;
        }
        .sec-card:hover { border-color:rgba(143,168,155,.28); transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.3); }
        .sec-card:hover::after { background:rgba(143,168,155,.03); }
        .sec-card:active { transform:translateY(0); }

        .sec-card-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .sec-card-icon { font-size:1.1rem; }
        .sec-card-title { font-size:.88rem; font-weight:800; color:#FAF6F0; text-transform:uppercase; letter-spacing:.5px; }
        .sec-card-edit { margin-left:auto; font-size:.7rem; color:#8FA89B; font-weight:700; opacity:.8; }

        .sec-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid rgba(143,168,155,.05); }
        .sec-row:last-child { border-bottom:none; }
        .sec-row-label { font-size:.72rem; color:#788E82; font-weight:600; text-transform:uppercase; letter-spacing:.3px; }
        .sec-row-value { font-size:.82rem; color:#FAF6F0; font-weight:500; text-align:right; max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sec-row-empty { color:#2C3A33; font-style:italic; }

        /* branches card full-width */
        .sec-card-full { grid-column:1/-1; }

        /* modal overlay */
        .moverlay {
          position:fixed; inset:0; z-index:1000;
          background:rgba(0,0,0,.6); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
          padding:20px; animation:fadeIn .2s ease;
        }
        .mcard {
          background:#1C2420; border:1px solid rgba(143,168,155,.18);
          border-radius:18px; padding:28px; width:100%; max-width:480px;
          max-height:88vh; overflow-y:auto;
          box-shadow:0 24px 48px rgba(0,0,0,.6);
          animation:fadeIn .25s ease;
        }
        .mcard::-webkit-scrollbar { width:4px; }
        .mcard::-webkit-scrollbar-track { background:transparent; }
        .mcard::-webkit-scrollbar-thumb { background:#2C3A33; border-radius:4px; }

        .mhead { display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; }
        .mhead h3 { font-size:1.05rem; font-weight:800; color:#FAF6F0; margin:0; }
        .mclose { background:none; border:none; color:#788E82; font-size:1.2rem; cursor:pointer; padding:4px; line-height:1; }
        .mclose:hover { color:#FAF6F0; }

        .mlabel { display:block; font-size:.72rem; font-weight:700; color:#788E82; text-transform:uppercase; letter-spacing:.4px; margin:14px 0 6px; }
        .minput {
          width:100%; padding:10px 14px; box-sizing:border-box;
          background:#121815; border:1px solid rgba(143,168,155,.18);
          border-radius:9px; color:#FAF6F0; font-size:.9rem; font-family:inherit;
          outline:none; transition:border-color .2s;
        }
        .minput:focus { border-color:#8FA89B; }

        .mtoggle-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(143,168,155,.06); }
        .mtoggle { width:18px; height:18px; accent-color:#8FA89B; cursor:pointer; }

        .mfooter { display:flex; gap:10px; margin-top:24px; justify-content:flex-end; }
        .mbtn-save { background:#8FA89B; color:#121815; border:none; padding:11px 24px; border-radius:9px; font-weight:700; font-size:.875rem; cursor:pointer; font-family:inherit; }
        .mbtn-save:hover:not(:disabled) { background:#A2B9AC; }
        .mbtn-save:disabled { opacity:.6; cursor:default; }
        .mbtn-cancel { background:rgba(255,255,255,.06); color:#788E82; border:1px solid rgba(143,168,155,.12); padding:11px 20px; border-radius:9px; font-weight:700; font-size:.875rem; cursor:pointer; font-family:inherit; }
        .mbtn-cancel:hover { background:rgba(255,255,255,.1); color:#FAF6F0; }

        /* branches list */
        .branch-item { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(143,168,155,.06); }
        .branch-name { font-weight:700; color:#FAF6F0; font-size:.875rem; }
        .branch-addr { font-size:.75rem; color:#788E82; margin-top:2px; }
        .badge-on  { background:rgba(46,204,113,.15); color:#2ecc71; padding:2px 9px; border-radius:20px; font-size:.7rem; font-weight:700; }
        .badge-off { background:rgba(255,255,255,.06); color:#2C3A33; padding:2px 9px; border-radius:20px; font-size:.7rem; font-weight:700; }
        .add-branch-row { padding-top:12px; }
        .btn-add { background:transparent; border:1px dashed rgba(143,168,155,.4); color:#8FA89B; padding:9px; border-radius:9px; font-weight:700; font-size:.82rem; cursor:pointer; width:100%; font-family:inherit; transition:all .2s; }
        .btn-add:hover { border-color:#8FA89B; color:#FAF6F0; background:rgba(143,168,155,.08); }

        /* toast */
        .toast { position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; padding:11px 22px; border-radius:10px; font-weight:700; font-size:.875rem; box-shadow:0 8px 24px rgba(0,0,0,.5); animation:fadeIn .25s ease; white-space:nowrap; }
        .tok { background:#27ae60; color:#fff; }
        .terr { background:#e74c3c; color:#fff; }

        .spinner { width:36px; height:36px; border:3px solid rgba(143,168,155,.2); border-top-color:#8FA89B; border-radius:50%; animation:spin 1s linear infinite; margin:80px auto; }
        @keyframes spin { to{transform:rotate(360deg)} }

        @media(max-width:767px) {
          .moverlay { align-items:flex-end; padding:0; }
          .mcard {
            width:100% !important; max-width:100% !important;
            height:100vh !important; max-height:100vh !important;
            border-radius:0 !important; border:none !important;
            margin:0 !important; padding:16px !important;
            display:flex !important; flex-direction:column !important;
          }
          .mfooter {
            position:sticky; bottom:0; background:#1C2420;
            padding:16px 0 8px 0; z-index:10;
          }
        }
      `}</style>

      {toast && <div className={`toast ${toast.ok ? 'tok' : 'terr'}`}>{toast.ok ? '✓' : '⚠'} {toast.msg}</div>}

      <div className="pp">
        {loading ? <div className="spinner" /> : <>

          {/* Banner */}
          <div className="pp-banner">
            <div className="pp-avatar-wrap">
              <div className="pp-avatar">{cafeData?.logoUrl ? <img src={cafeData.logoUrl} alt="cafe" /> : '☕'}</div>
              <div className="pp-identity">
                <h2>{cafeData?.name || 'My Cafe'}</h2>
                <p>{cafeData?.cafeId} · {cafeData?.businessType || 'Cafe'}</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          {!cafeData?.setupCompleted &&
          <div className="pp-prog">
              <span>Setup {cafeData?.address ? '60' : '20'}%</span>
              <div className="prog-outer"><div className="prog-inner" style={{ width: cafeData?.address ? '60%' : '20%' }} /></div>
              <button className="btn-setup" onClick={() => navigate('/owner-setup')}>🚀 Continue Setup</button>
            </div>
          }

          {/* Card Grid */}
          <div className="card-grid">
            {cards.map(({ key, icon, title, rows }) =>
            <div key={key} className="sec-card" onClick={() => openModal(key)} role="button" aria-label={`Edit ${title}`}>
                <div className="sec-card-head">
                  <span className="sec-card-icon">{icon}</span>
                  <span className="sec-card-title">{title}</span>
                  <span className="sec-card-edit">Tap to edit ›</span>
                </div>
                {rows.map(([label, value]) =>
              <div key={label} className="sec-row">
                    <span className="sec-row-label">{label}</span>
                    <span className={`sec-row-value ${!value || value === '—' ? 'sec-row-empty' : ''}`}>{value || '—'}</span>
                  </div>
              )}
              </div>
            )}

            {/* Branches card — full width */}
            <div className="sec-card sec-card-full">
              <div className="sec-card-head">
                <span className="sec-card-icon">🌿</span>
                <span className="sec-card-title">Branches ({branches.length})</span>
              </div>
              {branches.length === 0 && <p style={{ color: '#3D2820', fontStyle: 'italic', fontSize: '.85rem', margin: '4px 0 10px' }}>No branches added yet.</p>}
              {branches.map((b) =>
              <div key={b._id} className="branch-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(230,213,195,.06)' }}>
                  <div>
                    <div className="branch-name" style={{ fontWeight: 700, color: '#E6D5C3', fontSize: '.875rem' }}>{b.branchName}</div>
                    <div className="branch-addr" style={{ fontSize: '.75rem', color: '#7A6055', marginTop: '2px' }}>{b.address}{b.manager ? ` · ${b.manager}` : ''}</div>
                    <span className={b.isActive ? 'badge-on' : 'badge-off'} style={{ display: 'inline-block', marginTop: '4px' }}>{b.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                    onClick={(e) => {e.stopPropagation();openEditBranchModal(b);}}
                    style={{ background: '#3E2723', color: 'var(--color-text-primary)', border: '1px solid rgba(230,213,195,.18)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    
                      ✏️ Edit
                    </button>
                    <button
                    onClick={(e) => {e.stopPropagation();handleDeleteBranch(b._id, b.branchName);}}
                    style={{ background: '#E74C3C', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}
              <div className="add-branch-row">
                <button className="btn-add" onClick={(e) => {e.stopPropagation();openModal('branch');}}>＋ Add New Branch</button>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to sign out?')) {
                  logout();
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(231, 76, 60, 0.5)',
                color: '#E74C3C',
                padding: '12px 30px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.9rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                e.currentTarget.style.borderColor = '#E74C3C';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(231, 76, 60, 0.5)';
              }}>
              
              Sign Out
            </button>
          </div>
        </>}
      </div>

      {/* ── Modal ── */}
      {activeModal &&
      <div className="moverlay" onClick={closeModal}>
          <div className="mcard" onClick={(e) => e.stopPropagation()}>
            <div className="mhead">
              <h3>{modalTitles[activeModal]}</h3>
              <button className="mclose" onClick={closeModal}>✕</button>
            </div>
            {modalFields[activeModal]}
            <div className="mfooter">
              {activeModal === 'qr_codes' ?
            <button className="mbtn-save" onClick={closeModal}>Done</button> :

            <>
                  <button className="mbtn-cancel" onClick={closeModal}>Cancel</button>
                  <button className="mbtn-save" onClick={saveModal} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </>
            }
            </div>
          </div>
        </div>
      }
    </OwnerLayout>);

};

export default OwnerProfilePage;