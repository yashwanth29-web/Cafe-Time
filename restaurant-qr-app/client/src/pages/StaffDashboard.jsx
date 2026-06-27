import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
 checkIn,
 checkOut,
 getTodayAttendanceStatus,
 getStaffAttendanceHistory,
 submitWorkReport } from
'../services/api';
import '../styles/App.css';

const StaffDashboard = () => {
 const { logout, user } = useAuth();
 const [searchParams] = useSearchParams();
 const tabParam = searchParams.get('tab');

 // Tab control
 const [activeTab, setActiveTab] = useState(() => tabParam || 'attendance');

 useEffect(() => {
 if (tabParam) {
 setActiveTab(tabParam);
 } else {
 setActiveTab('attendance');
 }
 }, [tabParam]);

 // Attendance states
 const [todayStatus, setTodayStatus] = useState(null);
 const [historyData, setHistoryData] = useState([]);
 const [summary, setSummary] = useState({
 totalWorkingHours: 0,
 attendancePercentage: 0,
 lateDays: 0,
 presentDays: 0
 });

 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState(false);
 const [showTakeOrderModal, setShowTakeOrderModal] = useState(false);
 const [takeOrderTable, setTakeOrderTable] = useState('');
 const [errorMsg, setErrorMsg] = useState('');
 const [successMsg, setSuccessMsg] = useState('');
 const [coords, setCoords] = useState(null);
 const [elapsedTime, setElapsedTime] = useState('00h 00m 00s');

 // Work Report states
 const [reportNotes, setReportNotes] = useState('');
 const [selectedFiles, setSelectedFiles] = useState([]);
 const [filePreviews, setFilePreviews] = useState([]);
 const [reportLoading, setReportLoading] = useState(false);
 const [reportError, setReportError] = useState('');
 const [reportSuccess, setReportSuccess] = useState('');

 const timerRef = useRef(null);

 // Fetch initial data
 const fetchData = async () => {
 try {
 setLoading(true);
 setErrorMsg('');

 const todayRes = await getTodayAttendanceStatus();
 if (todayRes.success) {
 setTodayStatus(todayRes);
 }

 const historyRes = await getStaffAttendanceHistory();
 if (historyRes.success) {
 setHistoryData(historyRes.history || []);
 setSummary(historyRes.summary || {
 totalWorkingHours: 0,
 attendancePercentage: 0,
 lateDays: 0,
 presentDays: 0
 });
 }
 } catch (error) {
 console.error('Error fetching staff attendance data:', error);
 setErrorMsg('Failed to sync attendance details with server.');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchData();
 return () => {
 if (timerRef.current) clearInterval(timerRef.current);
 };
 }, []);

 // Update live shift duration timer
 useEffect(() => {
 if (todayStatus?.checkedIn && !todayStatus?.checkedOut && todayStatus?.attendance?.checkInTime) {
 const startTime = new Date(todayStatus.attendance.checkInTime).getTime();

 if (timerRef.current) clearInterval(timerRef.current);

 const updateTimer = () => {
 const diffMs = Date.now() - startTime;
 if (diffMs < 0) {
 setElapsedTime('00h 00m 00s');
 return;
 }
 const totalSecs = Math.floor(diffMs / 1000);
 const hours = Math.floor(totalSecs / 3600);
 const minutes = Math.floor(totalSecs % 3600 / 60);
 const seconds = totalSecs % 60;

 const pad = (num) => String(num).padStart(2, '0');
 setElapsedTime(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
 };

 updateTimer();
 timerRef.current = setInterval(updateTimer, 1000);
 } else {
 if (timerRef.current) {
 clearInterval(timerRef.current);
 timerRef.current = null;
 }
 setElapsedTime('00h 00m 00s');
 }
 }, [todayStatus]);

 // Request location and perform Check-In
 const handleCheckIn = () => {
 setErrorMsg('');
 setSuccessMsg('');

 if (!navigator.geolocation) {
 setErrorMsg('Geolocation is not supported by your browser.');
 return;
 }

 setActionLoading(true);

 navigator.geolocation.getCurrentPosition(
 async (position) => {
 const { latitude, longitude } = position.coords;
 setCoords({ latitude, longitude });

 try {
 const userAgent = navigator.userAgent;
 let deviceInfo = 'Web Browser';
 if (/mobile/i.test(userAgent)) deviceInfo = 'Mobile Web Browser';
 if (/chrome/i.test(userAgent)) deviceInfo = 'Chrome Browser';
 if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) deviceInfo = 'Safari Browser';
 if (/firefox/i.test(userAgent)) deviceInfo = 'Firefox Browser';

 const res = await checkIn({
 latitude,
 longitude,
 deviceInfo
 });

 if (res.success) {
 setSuccessMsg(res.message || 'Check-in registered successfully!');
 fetchData();
 } else {
 setErrorMsg(res.message || 'Check-in validation failed.');
 }
 } catch (err) {
 console.error('Check-in error:', err);
 setErrorMsg(err.response?.data?.message || 'Check-in request failed. Are you within the cafe geofence?');
 } finally {
 setActionLoading(false);
 }
 },
 (error) => {
 console.error('Geolocation error:', error);
 setActionLoading(false);
 switch (error.code) {
 case error.PERMISSION_DENIED:
 setErrorMsg(
   <div>
     <strong>GPS Location Blocked:</strong> Please allow location access to check in.
     <div style={{ marginTop: '8px', fontSize: '0.75rem', opacity: 0.85, lineHeight: '1.4' }}>
       👉 <strong>Chrome (Mobile/Desktop):</strong> Tap the lock or settings icon next to the address bar, reset/allow "Location".
       <br />
       👉 <strong>Safari (iPhone):</strong> Open iOS Settings &gt; Privacy &gt; Location Services &gt; Safari, and select "While Using the App".
     </div>
   </div>
 );
 break;
 case error.POSITION_UNAVAILABLE:
 setErrorMsg('GPS location is unavailable. Please check if location services/GPS are enabled on your device and you have network connectivity.');
 break;
 case error.TIMEOUT:
 setErrorMsg('GPS request timed out while getting location lock. Please try again in an area with a clear view of the sky or connect to local Wi-Fi.');
 break;
 default:
 setErrorMsg('An unknown location error occurred. Please try again or check device location permission settings.');
 }
 },
 { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
 );
 };

 // Perform Check-Out
 const handleCheckOut = async () => {
 if (!window.confirm('Are you sure you want to check out from your shift?')) {
 return;
 }

 setActionLoading(true);
 setErrorMsg('');
 setSuccessMsg('');

 try {
 const res = await checkOut();
 if (res.success) {
 setSuccessMsg(res.message || 'Check-out registered successfully!');
 fetchData();
 } else {
 setErrorMsg(res.message || 'Check-out request failed.');
 }
 } catch (err) {
 console.error('Check-out error:', err);
 setErrorMsg(err.response?.data?.message || 'Server error processing check-out.');
 } finally {
 setActionLoading(false);
 }
 };

 // File Upload Handlers for Daily Work Report
 const handleFileChange = (e) => {
 setReportError('');
 setReportSuccess('');

 const files = Array.from(e.target.files);

 if (selectedFiles.length + files.length > 10) {
 setReportError('You can upload a maximum of 10 photos per report.');
 return;
 }

 const validFiles = [];
 const validPreviews = [];

 for (const file of files) {
 // Validate file extension
 const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
 if (!validTypes.includes(file.type)) {
 setReportError(`Unsupported file format: ${file.name}. Only JPG, JPEG, PNG, and WEBP formats are supported.`);
 return;
 }

 // Validate size (5MB = 5 * 1024 * 1024)
 if (file.size > 5 * 1024 * 1024) {
 setReportError(`File is too large: ${file.name}. Maximum size per image is 5MB.`);
 return;
 }

 validFiles.push(file);
 validPreviews.push(URL.createObjectURL(file));
 }

 setSelectedFiles((prev) => [...prev, ...validFiles]);
 setFilePreviews((prev) => [...prev, ...validPreviews]);
 };

 const handleRemoveFile = (index) => {
 // Revoke object URL to avoid memory leak
 URL.revokeObjectURL(filePreviews[index]);

 setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
 setFilePreviews((prev) => prev.filter((_, idx) => idx !== index));
 };

 const handleSubmitReport = async (e) => {
 e.preventDefault();
 setReportError('');
 setReportSuccess('');

 if (selectedFiles.length === 0) {
 setReportError('Please upload at least one photo showing proof of completed work.');
 return;
 }

 setReportLoading(true);

 try {
 const formData = new FormData();
 selectedFiles.forEach((file) => {
 formData.append('photos', file);
 });
 formData.append('notes', reportNotes);

 const res = await submitWorkReport(formData);

 if (res.success) {
 setReportSuccess('Daily work report submitted successfully! Temporary records will auto-purge in 24 hours.');
 setReportNotes('');
 setSelectedFiles([]);
 filePreviews.forEach((url) => URL.revokeObjectURL(url));
 setFilePreviews([]);
 } else {
 setReportError(res.message || 'Failed to submit work report.');
 }
 } catch (err) {
 console.error('Work report submit error:', err);
 setReportError(err.response?.data?.message || 'Server error submitting your work report.');
 } finally {
 setReportLoading(false);
 }
 };

 const formatTime = (timeStr) => {
 if (!timeStr) return '--:--';
 const d = new Date(timeStr);
 return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
 };

 const formatDate = (dateStr) => {
 if (!dateStr) return '';
 const d = new Date(dateStr);
 return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
 };

 return (
 <div style={{ padding: '10px 0', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
 {/* Title Header */}
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 borderBottom: '1px solid var(--color-border)',
 paddingBottom: '16px',
 marginBottom: '24px',
 flexWrap: 'wrap',
 gap: '12px'
 }}>
 <div>
 <h2 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
 Staff Daily Activity Station
 </h2>
 <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
 Record attendance and submit daily operational work proof.
 </p>
 </div>
 
 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
 <button
    onClick={() => setShowTakeOrderModal(true)}
    style={{
      background: 'var(--color-primary)',
      color: 'white',
      border: 'none',
      padding: '8px 14px',
      borderRadius: '8px',
      fontWeight: 'bold',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}
  >
    <span style={{ fontSize: '1.2rem' }}>+</span>
    Take Order
  </button>
 <div style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', background: 'rgba(0, 0, 0,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
 Assigned Branch: <strong style={{ color: 'var(--color-text-primary)' }}>{user?.assignedBranch || 'Primary Location'}</strong>
 </div>
 </div>

{showTakeOrderModal && (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  }}>
    <div style={{
      background: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
      width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>Take New Order</h3>
      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        Enter Table Number (leave blank for Takeaway):
      </p>
      <input
        autoFocus
        type="text"
        placeholder="e.g. 5"
        value={takeOrderTable}
        onChange={(e) => setTakeOrderTable(e.target.value)}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px',
          border: '1px solid var(--color-border)', marginBottom: '20px',
          background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-primary)'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}`;
          }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          onClick={() => setShowTakeOrderModal(false)}
          style={{
            padding: '10px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--color-border)', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}`}
          style={{
            padding: '10px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          Open Menu
        </button>
      </div>
    </div>
  </div>
)}
 </div>

 {/* Tabs Menu removed to prevent duplicate navigation */}

 {/* TAB 1: ATTENDANCE & SHIFTS */}
 {activeTab === 'attendance' &&
 <>
 {/* Message alerts */}
 {errorMsg &&
 <div style={{
 backgroundColor: '#FDF2F2',
 borderLeft: '4px solid #EC5B5B',
 color: '#8A2525',
 padding: '14px 16px',
 borderRadius: '8px',
 marginBottom: '20px',
 fontSize: '0.9rem',
 fontWeight: 500
 }}>
 {errorMsg}
 </div>
 }

 {successMsg &&
 <div style={{
 backgroundColor: '#F3FAF7',
 borderLeft: '4px solid #0EA5E9',
 color: '#0369A1',
 padding: '14px 16px',
 borderRadius: '8px',
 marginBottom: '20px',
 fontSize: '0.9rem',
 fontWeight: 500
 }}>
 {successMsg}
 </div>
 }

 {loading ?
 <div style={{ textAlign: 'center', padding: '80px 0' }}>
 <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary, #ff6b08)' }} />
 <p style={{ color: 'var(--color-text-secondary)' }}>Syncing attendance panel status...</p>
 </div> :

 <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
 
 {/* Main Action Block and Stats Block */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
 
 {/* Today's Shift Status Card */}
 <div style={{
 background: 'var(--bg-card, #1A1A1A)',
 border: '1px solid var(--color-border)',
 padding: '24px',
 borderRadius: '16px',
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'space-between',
 boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
 }}>
 <div>
 <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '1px solid rgba(0, 0, 0,0.06)', paddingBottom: '10px' }}>
 Today's Attendance Session
 </h3>
 
 {/* Visual Status Indicator */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
 <div style={{
 width: '12px',
 height: '12px',
 borderRadius: '50%',
 backgroundColor: todayStatus?.checkedIn ?
 todayStatus?.checkedOut ? '#9E8E8E' : '#2ecc71' :
 '#e74c3c',
 boxShadow: todayStatus?.checkedIn && !todayStatus?.checkedOut ?
 '0 0 10px #2ecc71' :
 'none'
 }} />
 <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
 Status: {
 todayStatus?.checkedIn ?
 todayStatus?.checkedOut ?
 'Shift Completed' :
 todayStatus?.attendance?.status === 'Late' ?
 'Working (Late Arrival)' :
 'Currently Working / Present' :

 'Absent / Not Checked In'
 }
 </span>
 </div>

 {/* Session Timestamps */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px dashed rgba(0, 0, 0,0.05)', paddingBottom: '6px' }}>
 <span style={{ color: 'var(--color-text-secondary)' }}>Check In Time</span>
 <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>
 {todayStatus?.checkedIn ? formatTime(todayStatus.attendance.checkInTime) : '--:--'}
 </span>
 </div>
 
 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px dashed rgba(0, 0, 0,0.05)', paddingBottom: '6px' }}>
 <span style={{ color: 'var(--color-text-secondary)' }}>Check Out Time</span>
 <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>
 {todayStatus?.checkedOut ? formatTime(todayStatus.attendance.checkOutTime) : '--:--'}
 </span>
 </div>

 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingBottom: '6px' }}>
 <span style={{ color: 'var(--color-text-secondary)' }}>GPS Distance</span>
 <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>
 {todayStatus?.checkedIn ? `${todayStatus.attendance.distanceFromCafe} meters from Cafe` : 'N/A'}
 </span>
 </div>
 </div>
 </div>

 {/* Dynamic Action Button or Counter */}
 <div>
 {todayStatus?.checkedIn && !todayStatus?.checkedOut &&
 <div style={{
 textAlign: 'center',
 background: 'rgba(255, 107, 8, 0.05)',
 border: '1px solid rgba(255, 107, 8, 0.2)',
 borderRadius: '12px',
 padding: '16px',
 marginBottom: '16px'
 }}>
 <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
 Active Shift Duration
 </span>
 <strong style={{ fontSize: '1.4rem', color: 'var(--color-primary, #ff6b08)', fontFamily: 'monospace' }}>
 {elapsedTime}
 </strong>
 </div>
 }

 {/* Primary Button */}
 {!todayStatus?.checkedIn ?
 <button
 onClick={handleCheckIn}
 disabled={actionLoading}
 style={{
 width: '100%',
 background: 'linear-gradient(135deg, var(--color-primary, #ff6b08) 0%, #d45900 100%)',
 color: 'var(--color-text-primary)',
 border: 'none',
 padding: '15px',
 borderRadius: '12px',
 fontSize: '1rem',
 fontWeight: 800,
 cursor: 'pointer',
 boxShadow: '0 4px 15px rgba(255, 107, 8, 0.3)',
 transition: 'all 0.2s',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px'
 }}
 onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-2px)';}}
 onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)';}}>
 
 {actionLoading ?
 <>
 <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', bordercolor: 'var(--color-text-primary)' }} />
 <span>Verifying Location & Device...</span>
 </> :

 <span>Check In Now</span>
 }
 </button> :
 !todayStatus?.checkedOut ?
 <button
 onClick={handleCheckOut}
 disabled={actionLoading}
 style={{
 width: '100%',
 background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
 color: 'var(--color-text-primary)',
 border: 'none',
 padding: '15px',
 borderRadius: '12px',
 fontSize: '1rem',
 fontWeight: 800,
 cursor: 'pointer',
 boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
 transition: 'all 0.2s',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px'
 }}
 onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-2px)';}}
 onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)';}}>
 
 {actionLoading ?
 <>
 <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', bordercolor: 'var(--color-text-primary)' }} />
 <span>Checking Out...</span>
 </> :

 <span>Check Out Shift</span>
 }
 </button> :

 <div style={{
 textAlign: 'center',
 background: 'rgba(0, 0, 0, 0.02)',
 border: '1px dashed var(--color-border)',
 padding: '14px',
 borderRadius: '12px',
 color: 'var(--color-text-secondary)',
 fontSize: '0.9rem',
 fontWeight: 500
 }}>
 Shift complete. You are logged out for the day.
 </div>
 }
 
 {coords &&
 <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '10px' }}>
 GPS: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
 </div>
 }
 </div>
 </div>

 {/* Attendance Analytics Card */}
 <div style={{
 background: 'var(--bg-card, #1A1A1A)',
 border: '1px solid var(--color-border)',
 padding: '24px',
 borderRadius: '16px',
 boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'space-between'
 }}>
 <div>
 <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '1px solid rgba(0, 0, 0,0.06)', paddingBottom: '10px' }}>
 Monthly Performance (Last 30 Days)
 </h3>

 {/* Progress Wheel / Metric */}
 <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '15px 0' }}>
 <div style={{
 width: '130px',
 height: '130px',
 borderRadius: '50%',
 background: `conic-gradient(var(--color-primary, #ff6b08) ${summary.attendancePercentage || 0}%, rgba(255,255,255,0.05) ${summary.attendancePercentage || 0}% 100%)`,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 position: 'relative',
 boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
 }}>
 <div style={{
 width: '106px',
 height: '106px',
 borderRadius: '50%',
 backgroundColor: '#1E1E1E',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 2
 }}>
 <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--color-text-primary)' }}>
 {summary.attendancePercentage}%
 </span>
 <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
 Attendance
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* Analytics Breakdown Grid */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' }}>
 <div style={{ background: 'rgba(0, 0, 0,0.02)', padding: '12px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', textAlign: 'center' }}>
 <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Hours</span>
 <strong style={{ fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{summary.totalWorkingHours}h</strong>
 </div>
 
 <div style={{ background: 'rgba(0, 0, 0,0.02)', padding: '12px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', textAlign: 'center' }}>
 <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Presents</span>
 <strong style={{ fontSize: '1.1rem', color: '#2ecc71' }}>{summary.presentDays}d</strong>
 </div>

 <div style={{ background: 'rgba(0, 0, 0,0.02)', padding: '12px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', textAlign: 'center' }}>
 <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Late days</span>
 <strong style={{ fontSize: '1.1rem', color: '#f1c40f' }}>{summary.lateDays}d</strong>
 </div>
 </div>
 </div>

 </div>

 {/* 30-Day Attendance Logs */}
 <div style={{
 background: 'var(--bg-card, #1A1A1A)',
 border: '1px solid var(--color-border)',
 padding: '24px',
 borderRadius: '16px',
 boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
 }}>
 <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '1px solid rgba(0, 0, 0,0.06)', paddingBottom: '10px' }}>
 Last 30 Days Shift Log
 </h3>

 {historyData.length === 0 ?
 <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
 No attendance logs found for the last 30 days.
 </div> :

 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
 <thead>
 <tr style={{ borderBottom: '1px solid rgba(0, 0, 0,0.08)' }}>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>Date</th>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>Branch</th>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>Check In</th>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>Check Out</th>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>Hours</th>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>GPS Distance</th>
 <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>Status</th>
 </tr>
 </thead>
 <tbody>
 {historyData.map((record) => {
 const hours = record.totalDuration ? Math.floor(record.totalDuration / 60) : 0;
 const mins = record.totalDuration ? record.totalDuration % 60 : 0;
 const durationStr = record.totalDuration ? `${hours}h ${mins}m` : '--';

 const statusColor = record.status === 'Late' ? '#f1c40f' : '#2ecc71';

 return (
 <tr key={record._id} style={{ borderBottom: '1px solid rgba(0, 0, 0,0.04)', transition: 'background-color 0.15s' }}>
 <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
 {formatDate(record.date)}
 </td>
 <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
 {record.branchName || 'Main Branch'}
 </td>
 <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
 {formatTime(record.checkInTime)}
 </td>
 <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
 {record.checkOutTime ? formatTime(record.checkOutTime) : 'N/A'}
 </td>
 <td style={{ padding: '12px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>
 {durationStr}
 </td>
 <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
 {record.distanceFromCafe !== undefined ? `${record.distanceFromCafe}m` : 'N/A'}
 </td>
 <td style={{ padding: '12px 8px' }}>
 <span style={{
 backgroundColor: `${statusColor}1A`,
 border: `1px solid ${statusColor}`,
 color: statusColor,
 padding: '2px 8px',
 borderRadius: '4px',
 fontSize: '11px',
 fontWeight: 'bold',
 display: 'inline-block'
 }}>
 {record.status || 'Present'}
 </span>
 </td>
 </tr>);

 })}
 </tbody>
 </table>
 </div>
 }
 </div>

 </div>
 }
 </>
 }

 {/* TAB 2: DAILY WORK REPORT SUBMISSION */}
 {activeTab === 'report' &&
 <div style={{
 background: 'var(--bg-card, #1A1A1A)',
 border: '1px solid var(--color-border)',
 padding: '28px',
 borderRadius: '16px',
 boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
 maxWidth: '800px',
 margin: '0 auto'
 }}>
 <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.3rem', fontWeight: 800, margin: '0 0 10px 0' }}>
 Submit Daily Work Report
 </h3>
 <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5' }}>
 Owners require proof that work has been successfully completed (e.g., tables cleaned, kitchen sanitized, counter wiped, opening/closing prep done). Upload multiple photos (up to 10) to a single report. Note that images are temporary records and are auto-deleted after 24 hours.
 </p>

 {reportError &&
 <div style={{
 backgroundColor: '#FDF2F2',
 borderLeft: '4px solid #EC5B5B',
 color: '#8A2525',
 padding: '14px 16px',
 borderRadius: '8px',
 marginBottom: '20px',
 fontSize: '0.9rem',
 fontWeight: 500
 }}>
 {reportError}
 </div>
 }

 {reportSuccess &&
 <div style={{
 backgroundColor: '#F3FAF7',
 borderLeft: '4px solid #0EA5E9',
 color: '#0369A1',
 padding: '14px 16px',
 borderRadius: '8px',
 marginBottom: '20px',
 fontSize: '0.9rem',
 fontWeight: 500
 }}>
 {reportSuccess}
 </div>
 }

 <form onSubmit={handleSubmitReport} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
 
 {/* File Upload Zone */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 <label htmlFor="work-photos" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
 Upload Work Photos <span style={{ color: 'var(--color-primary, #ff6b08)' }}>*</span>
 </label>
 
 <div style={{
 border: '2px dashed var(--color-border)',
 borderRadius: '12px',
 padding: '24px',
 textAlign: 'center',
 backgroundColor: 'rgba(0, 0, 0,0.01)',
 cursor: 'pointer',
 position: 'relative',
 transition: 'all 0.2s'
 }}
 onMouseEnter={(e) => {e.currentTarget.style.borderColor = 'var(--color-primary, #ff6b08)';}}
 onMouseLeave={(e) => {e.currentTarget.style.borderColor = 'var(--color-border)';}}>
 
 <input
 type="file"
 id="work-photos"
 name="work-photos"
 multiple
 accept="image/png, image/jpeg, image/jpg, image/webp"
 onChange={handleFileChange}
 style={{
 position: 'absolute',
 top: 0,
 left: 0,
 width: '100%',
 height: '100%',
 opacity: 0,
 cursor: 'pointer'
 }}
 disabled={reportLoading} />
 
 <div style={{ fontSize: '2rem', marginBottom: '8px' }}></div>
 <strong style={{ color: 'var(--color-text-primary)', display: 'block', fontSize: '0.9rem' }}>
 Tap to upload photos
 </strong>
 <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
 JPG, JPEG, PNG, WEBP formats allowed (Max 5MB each, Limit 10 photos total)
 </span>
 </div>
 </div>

 {/* Thumbnail Preview Area */}
 {filePreviews.length > 0 &&
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
 Selected Photos ({filePreviews.length} of 10)
 </span>
 <div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
 gap: '12px',
 background: 'rgba(0,0,0,0.2)',
 padding: '12px',
 borderRadius: '10px'
 }}>
 {filePreviews.map((url, idx) =>
 <div key={idx} style={{
 position: 'relative',
 width: '80px',
 height: '80px',
 borderRadius: '8px',
 overflow: 'hidden',
 border: '1px solid var(--color-border)'
 }}>
 <img
 src={url}
 alt="Preview"
 style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 
 <button
 type="button"
 onClick={() => handleRemoveFile(idx)}
 style={{
 position: 'absolute',
 top: '2px',
 right: '2px',
 width: '18px',
 height: '18px',
 borderRadius: '50%',
 backgroundColor: 'rgba(239, 68, 68, 0.9)',
 color: 'var(--color-text-primary)',
 border: 'none',
 fontSize: '11px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 cursor: 'pointer',
 fontWeight: 'bold'
 }}>
 
 ×
 </button>
 </div>
 )}
 </div>
 </div>
 }

 {/* Notes Section */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 <label htmlFor="report-notes" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
 Optional Description / Notes
 </label>
 <textarea
 id="report-notes"
 name="report-notes"
 value={reportNotes}
 onChange={(e) => setReportNotes(e.target.value)}
 placeholder="List cleanings or preparations completed (e.g., Tables cleaned, kitchen surfaces sanitized, trash emptied...)"
 rows={4}
 style={{
 width: '100%',
 backgroundColor: 'rgba(0, 0, 0,0.02)',
 border: '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '12px',
 color: 'var(--color-text-primary)',
 fontSize: '0.9rem',
 outline: 'none',
 resize: 'vertical',
 fontFamily: 'inherit'
 }}
 disabled={reportLoading} />
 
 </div>

 {/* Submit Button */}
 <button
 type="submit"
 disabled={reportLoading || selectedFiles.length === 0}
 style={{
 width: '100%',
 background: selectedFiles.length === 0 ?
 'rgba(255,255,255,0.05)' :
 'linear-gradient(135deg, var(--color-primary, #ff6b08) 0%, #d45900 100%)',
 color: selectedFiles.length === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
 border: 'none',
 padding: '15px',
 borderRadius: '12px',
 fontSize: '1rem',
 fontWeight: 800,
 cursor: selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
 boxShadow: selectedFiles.length === 0 ? 'none' : '0 4px 15px rgba(255, 107, 8, 0.3)',
 transition: 'all 0.2s',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px',
 marginTop: '10px'
 }}>
 
 {reportLoading ?
 <>
 <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', bordercolor: 'var(--color-text-primary)' }} />
 <span>Submitting Work Report Proof...</span>
 </> :

 <span> Submit Work Report</span>
 }
 </button>
 </form>
 </div>
 }
 </div>);

};

export default StaffDashboard;