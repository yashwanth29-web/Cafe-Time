import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import {
  checkIn,
  checkOut,
  getTodayAttendanceStatus,
  getStaffAttendanceHistory,
  getKioskStaffList,
  submitWorkReport,
  startExtraWork,
  stopExtraWork,
  getAssetUrl
} from '../services/api';
import { compressMultipleImages } from '../utils/imageCompressor';
import '../styles/App.css';

const StaffDashboard = () => {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Sub-view toggle: 'attendance' (Mark Attendance & Shift Wages) vs 'cafe_photos' (Submit Cafe Photos)
  const [activeTab, setActiveTab] = useState(() => tabParam === 'report' ? 'cafe_photos' : 'attendance');

  useEffect(() => {
    if (tabParam === 'report') {
      setActiveTab('cafe_photos');
    } else {
      setActiveTab('attendance');
    }
  }, [tabParam]);

  // Kiosk Multi-Staff Mode states
  const [kioskStaffList, setKioskStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(() => user?._id || '');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Attendance state
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
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [coords, setCoords] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00h 00m 00s');

  // 4-Digit Attendance PIN Verification Modal State
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    action: 'check-in', // 'check-in' | 'check-out'
    staff: null
  });
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Cafe Photos Submission state
  const [reportNotes, setReportNotes] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const cafePhotoInputRef = useRef(null);

  const timerRef = useRef(null);

  // Active staff object resolved from kiosk list or current user
  const activeStaffMember = kioskStaffList.find(s => String(s._id) === String(selectedStaffId)) || {
    _id: user?._id,
    name: user?.name || 'Staff Member',
    employeeId: user?.employeeId || 'N/A',
    role: user?.role || 'Staff',
    assignedBranch: user?.assignedBranch || 'default',
    shiftStartTime: user?.shiftStartTime || '09:00',
    shiftEndTime: user?.shiftEndTime || '18:00',
    leanTimeMinutes: user?.leanTimeMinutes !== undefined ? user?.leanTimeMinutes : 30,
    dailyRate: user?.dailyRate || 0
  };

  // Fetch initial data & branch kiosk staff roster
  const fetchData = async (isSilent = false, overrideStaffId = null) => {
    try {
      if (!isSilent) setLoading(true);
      setErrorMsg('');

      // 1. Resolve geolocation in the background asynchronously without blocking the UI
      if (navigator.geolocation && !coords) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const currentCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setCoords(currentCoords);
          },
          () => {},
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
      }

      const branchParam = activeBranchId || user?.assignedBranch || 'default';
      let resolvedTargetId = overrideStaffId || selectedStaffId || user?._id;

      // 2. Fetch Kiosk roster and Attendance concurrently in parallel for maximum speed
      const [kioskRes, todayRes, historyRes] = await Promise.all([
        getKioskStaffList({ branchId: branchParam }).catch((err) => {
          console.warn('Kiosk list fetch error:', err);
          return { success: false };
        }),
        getTodayAttendanceStatus({ ...(coords || {}), staffId: resolvedTargetId }),
        getStaffAttendanceHistory({ staffId: resolvedTargetId })
      ]);

      if (kioskRes && kioskRes.success && Array.isArray(kioskRes.staff)) {
        setKioskStaffList(kioskRes.staff);
        if (!selectedStaffId || !kioskRes.staff.some(s => String(s._id) === String(selectedStaffId))) {
          if (kioskRes.staff.length > 0) {
            resolvedTargetId = kioskRes.staff[0]._id;
            setSelectedStaffId(resolvedTargetId);
          }
        }
      }

      if (todayRes.success) {
        setTodayStatus(todayRes);
      }

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
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    setTodayStatus(null);
    setHistoryData([]);
    setLoading(true);
    fetchData();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeBranchId]);

  // When staff switches their profile on the shared device
  const handleSelectStaff = async (staffId) => {
    setSelectedStaffId(staffId);
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const [todayRes, historyRes] = await Promise.all([
        getTodayAttendanceStatus({ ...(coords || {}), staffId }),
        getStaffAttendanceHistory({ staffId })
      ]);
      if (todayRes.success) {
        setTodayStatus(todayRes);
      }
      if (historyRes.success) {
        setHistoryData(historyRes.history || []);
        setSummary(historyRes.summary || {
          totalWorkingHours: 0,
          attendancePercentage: 0,
          lateDays: 0,
          presentDays: 0
        });
      }
    } catch (err) {
      console.error('Staff switch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update live shift duration timer
  useEffect(() => {
    let interval = null;
    if (todayStatus?.checkedIn && !todayStatus?.checkedOut && todayStatus?.attendance?.checkInTime) {
      const startTime = new Date(todayStatus.attendance.checkInTime).getTime();

      const updateTimer = () => {
        const diffMs = Date.now() - startTime;
        if (diffMs < 0) {
          setElapsedTime('00h 00m 00s');
          return;
        }
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;

        const pad = (num) => String(num).padStart(2, '0');
        setElapsedTime(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime('00h 00m 00s');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [todayStatus]);

  // Helper: Validate if Check-in is currently within the allowed 10-minute pre-shift and grace window
  const getShiftCheckInStatus = (staff) => {
    if (!staff || !staff.shiftStartTime) {
      return { isAllowed: true, reason: '' };
    }

    const shiftStartTime = staff.shiftStartTime;
    const leanTimeMinutes = staff.leanTimeMinutes !== undefined ? Number(staff.leanTimeMinutes) : 30;

    let sHour = 9, sMin = 0;
    const isPM = /PM/i.test(shiftStartTime);
    const isAM = /AM/i.test(shiftStartTime);
    const cleanTime = shiftStartTime.replace(/\s*(AM|PM)\s*/i, '').trim();
    const parts = cleanTime.split(':').map(Number);
    sHour = parts[0] || 0;
    sMin = parts[1] || 0;
    if (isPM && sHour < 12) sHour += 12;
    if (isAM && sHour === 12) sHour = 0;

    const shiftStartMins = sHour * 60 + sMin;
    const earlyOpenMins = shiftStartMins - 10;
    const graceCutoffMins = shiftStartMins + leanTimeMinutes;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const formatMin = (m) => {
      let normalized = ((m % 1440) + 1440) % 1440;
      const h = Math.floor(normalized / 60);
      const mins = normalized % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
    };

    if (currentMins < earlyOpenMins) {
      return {
        isAllowed: false,
        isTooEarly: true,
        opensAt: formatMin(earlyOpenMins),
        shiftStart: formatMin(shiftStartMins),
        reason: `🔒 Check-in opens at ${formatMin(earlyOpenMins)} (10 minutes before your ${formatMin(shiftStartMins)} shift)`
      };
    }

    if (currentMins > graceCutoffMins) {
      return {
        isAllowed: false,
        isExpired: true,
        deadline: formatMin(graceCutoffMins),
        shiftStart: formatMin(shiftStartMins),
        reason: `⚠️ Shift attendance window expired at ${formatMin(graceCutoffMins)} (Shift was: ${formatMin(shiftStartMins)})`
      };
    }

    return { isAllowed: true, reason: '' };
  };

  // Open 4-digit PIN verification modal for Instant Check-In
  const handleConfirmAttendance = () => {
    setErrorMsg('');
    setSuccessMsg('');

    const checkInWindow = getShiftCheckInStatus(activeStaffMember);
    if (!checkInWindow.isAllowed) {
      setErrorMsg(checkInWindow.reason);
      return;
    }

    setEnteredPin('');
    setPinError('');
    setPinModal({
      isOpen: true,
      action: 'check-in',
      staff: activeStaffMember
    });
  };

  // Open 4-digit PIN verification modal for Check-Out
  const handleCheckOut = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setEnteredPin('');
    setPinError('');
    setPinModal({
      isOpen: true,
      action: 'check-out',
      staff: activeStaffMember
    });
  };

  // Verify 4-Digit PIN and submit Attendance (Check-in or Check-out)
  const handleVerifyAndSubmitAttendance = (pinToSubmit) => {
    const pin = String(pinToSubmit !== undefined ? pinToSubmit : enteredPin).trim();
    if (pin.length !== 4) {
      setPinError('Please enter all 4 digits of your Attendance PIN.');
      return;
    }

    setPinError('');
    setActionLoading(true);

    const targetStaff = pinModal.staff || activeStaffMember;
    const currentTargetId = targetStaff?._id || selectedStaffId || user?._id;
    const currentTargetName = targetStaff?.name || activeStaffMember?.name || 'Staff';
    const isCheckIn = pinModal.action === 'check-in';

    if (!navigator.geolocation) {
      setActionLoading(false);
      setPinError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });

        try {
          if (isCheckIn) {
            const userAgent = navigator.userAgent;
            let deviceInfo = 'Kiosk Device';
            if (/mobile/i.test(userAgent)) deviceInfo = 'Mobile Kiosk';
            if (/chrome/i.test(userAgent)) deviceInfo = 'Chrome Kiosk';
            if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) deviceInfo = 'Safari Kiosk';

            const res = await checkIn({
              staffId: currentTargetId,
              latitude,
              longitude,
              deviceInfo,
              attendancePin: pin
            });

            if (res.success) {
              setPinModal({ isOpen: false, action: 'check-in', staff: null });
              setEnteredPin('');
              setSuccessMsg(`✓ Attendance marked successfully for ${currentTargetName} (${targetStaff?.employeeId || 'ID Verified'})!`);
              fetchData(false, currentTargetId);
            } else {
              setPinError(res.message || 'Check-in validation failed.');
            }
          } else {
            const res = await checkOut({
              staffId: currentTargetId,
              latitude,
              longitude,
              attendancePin: pin
            });

            if (res.success) {
              setPinModal({ isOpen: false, action: 'check-out', staff: null });
              setEnteredPin('');
              setSuccessMsg(`✓ Shift check-out completed for ${currentTargetName}!`);
              fetchData(false, currentTargetId);
            } else {
              setPinError(res.message || 'Check-out request failed.');
            }
          }
        } catch (err) {
          console.error('Attendance submit error:', err);
          const msg = err.response?.data?.message || (isCheckIn ? 'Check-in failed. Please verify your 4-digit PIN.' : 'Check-out failed. Please verify your 4-digit PIN.');
          setPinError(msg);
          if (msg.toLowerCase().includes('pin')) {
            setEnteredPin('');
          }
        } finally {
          setActionLoading(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setActionLoading(false);
        setPinError('GPS location is required to verify presence at the cafe counter. Please allow location access in browser settings.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Keyboard support for 4-digit PIN modal
  useEffect(() => {
    if (!pinModal.isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        if (enteredPin.length < 4) {
          const nextPin = enteredPin + e.key;
          setEnteredPin(nextPin);
          setPinError('');
          if (nextPin.length === 4) {
            handleVerifyAndSubmitAttendance(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        setEnteredPin(prev => prev.slice(0, -1));
        setPinError('');
      } else if (e.key === 'Escape') {
        if (!actionLoading) {
          setPinModal({ isOpen: false, action: 'check-in', staff: null });
          setEnteredPin('');
          setPinError('');
        }
      } else if (e.key === 'Enter') {
        if (enteredPin.length === 4 && !actionLoading) {
          handleVerifyAndSubmitAttendance(enteredPin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinModal.isOpen, enteredPin, actionLoading, pinModal.action, pinModal.staff, activeStaffMember]);

  // Overtime Extra Work Start/Stop
  const handleStartExtraWork = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    const currentTargetId = selectedStaffId || user?._id;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await startExtraWork({ staffId: currentTargetId, latitude: position.coords.latitude, longitude: position.coords.longitude });
          if (res.success) {
            setSuccessMsg('Extra work session started.');
            fetchData(false, currentTargetId);
          }
        } catch (err) {
          setErrorMsg(err.response?.data?.message || 'Failed to start extra work.');
        } finally {
          setActionLoading(false);
        }
      },
      () => {
        setActionLoading(false);
        setErrorMsg('GPS location required.');
      }
    );
  };

  const handleStopExtraWork = () => {
    if (!window.confirm('Stop extra work session?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    const currentTargetId = selectedStaffId || user?._id;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await stopExtraWork({ staffId: currentTargetId, latitude: position.coords.latitude, longitude: position.coords.longitude });
          if (res.success) {
            setSuccessMsg('Extra work session completed.');
            fetchData(false, currentTargetId);
          }
        } catch (err) {
          setErrorMsg(err.response?.data?.message || 'Failed to stop extra work.');
        } finally {
          setActionLoading(false);
        }
      },
      () => {
        setActionLoading(false);
        setErrorMsg('GPS location required.');
      }
    );
  };

  // Cafe Photos Handlers
  const handleCafePhotoSelect = async (e) => {
    setReportError('');
    setReportSuccess('');
    const rawFiles = Array.from(e.target.files);
    if (!rawFiles || rawFiles.length === 0) return;

    if (selectedPhotos.length + rawFiles.length > 15) {
      setReportError('Maximum 15 cafe photos allowed per submission.');
      return;
    }

    try {
      // Auto-compress large camera photos (e.g. 8MB -> ~150KB)
      const compressedFiles = await compressMultipleImages(rawFiles, { maxWidth: 1280, maxHeight: 1280, quality: 0.75 });
      const newSelected = [...selectedPhotos, ...compressedFiles].slice(0, 15);
      setSelectedPhotos(newSelected);

      const newPreviews = [...photoPreviews];
      compressedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          newPreviews.push(event.target.result);
          if (newPreviews.length === newSelected.length) {
            setPhotoPreviews([...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    } catch (compressErr) {
      console.warn('Image compression warning, using original files:', compressErr);
      const newSelected = [...selectedPhotos, ...rawFiles].slice(0, 15);
      setSelectedPhotos(newSelected);
    }
  };

  const removePhoto = (index) => {
    const updatedPhotos = selectedPhotos.filter((_, i) => i !== index);
    const updatedPreviews = photoPreviews.filter((_, i) => i !== index);
    setSelectedPhotos(updatedPhotos);
    setPhotoPreviews(updatedPreviews);
  };

  const handleSubmitCafePhotos = async (e) => {
    e.preventDefault();
    setReportError('');
    setReportSuccess('');

    if (selectedPhotos.length === 0) {
      setReportError('Please capture or upload at least one photo of the cafe / workstation.');
      return;
    }

    setReportLoading(true);
    try {
      const formData = new FormData();
      selectedPhotos.forEach((file) => {
        formData.append('photos', file);
      });
      formData.append('notes', reportNotes);

      const res = await submitWorkReport(formData);
      if (res.success) {
        setReportSuccess('Cafe photos submitted successfully! Owner and Manager can now inspect them.');
        setReportNotes('');
        setSelectedPhotos([]);
        setPhotoPreviews([]);
      } else {
        setReportError(res.message || 'Failed to submit cafe photos.');
      }
    } catch (err) {
      console.error('Submit cafe photos error:', err);
      setReportError(err.response?.data?.message || 'Server error submitting cafe photos.');
    } finally {
      setReportLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const [year, month, day] = dateString.split('-');
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  const currentDailyWage = todayStatus?.todayWageEarned || todayStatus?.attendance?.dailyWageEarned || todayStatus?.staff?.todayWageEarned || todayStatus?.staff?.dailyRate || activeStaffMember?.dailyRate || user?.dailyRate || 0;

  const currentUnpaidDue = summary?.unpaidSalaryBalance !== undefined
    ? Number(summary.unpaidSalaryBalance)
    : (activeStaffMember?.remainingSalaryBalance !== undefined
        ? Number(activeStaffMember.remainingSalaryBalance)
        : (summary?.salaryEarnedThisMonth !== undefined
            ? Number(summary.salaryEarnedThisMonth)
            : historyData.reduce((sum, r) => sum + (r.dailyWageEarned !== undefined ? Number(r.dailyWageEarned) : (r.status === 'Half Day' ? (activeStaffMember?.dailyRate || user?.dailyRate || 0) * 0.5 : (activeStaffMember?.dailyRate || user?.dailyRate || 0))), 0)
          )
      );

  const currentTotalEarned = summary?.totalEarnedAllTime !== undefined
    ? Number(summary.totalEarnedAllTime)
    : (activeStaffMember?.totalEarnedAllTime !== undefined
        ? Number(activeStaffMember.totalEarnedAllTime)
        : currentUnpaidDue
      );

  const currentTotalPaid = summary?.totalPaidAllTime !== undefined
    ? Number(summary.totalPaidAllTime)
    : Number(activeStaffMember?.totalPaidAllTime || 0);

  // Filtered staff list for kiosk search
  const filteredKioskStaff = kioskStaffList.filter(s => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase();
    return (s.name && s.name.toLowerCase().includes(q)) || 
           (s.employeeId && String(s.employeeId).toLowerCase().includes(q)) ||
           (s.staffRole && s.staffRole.toLowerCase().includes(q));
  });

  return (
    <div className="fade-in" style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      
      {/* ─── Top Header Hub: Staff Welcome & Quick Stats ─── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-card, #fff) 0%, rgba(255, 107, 8, 0.05) 100%)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--color-primary, #ff6b08)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(255, 107, 8, 0.3)'
          }}>
            {activeStaffMember?.name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {activeStaffMember?.name || user?.name || 'Staff Member'}
              </h2>
              <span style={{
                background: 'rgba(255, 107, 8, 0.12)',
                color: 'var(--color-primary, #ff6b08)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                {activeStaffMember?.staffRole || activeStaffMember?.role || user?.role || 'Staff'}
              </span>
              <span style={{
                background: 'rgba(52, 152, 219, 0.12)',
                color: '#2980b9',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                ID: {activeStaffMember?.employeeId || user?.employeeId || 'EMP-001'}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
              Branch: <strong>{todayStatus?.branchName || activeStaffMember?.assignedBranch || user?.assignedBranch || 'default'}</strong> • {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(52, 152, 219, 0.12)', color: '#2980b9', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ⏰ Shift: {activeStaffMember?.shiftStartTime || todayStatus?.staff?.shiftStartTime || user?.shiftStartTime || '09:00'} - {activeStaffMember?.shiftEndTime || todayStatus?.staff?.shiftEndTime || user?.shiftEndTime || '18:00'}
              </span>
              <span style={{ background: 'rgba(243, 156, 18, 0.12)', color: '#d35400', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ⏳ Grace Period: {activeStaffMember?.leanTimeMinutes !== undefined ? activeStaffMember?.leanTimeMinutes : (todayStatus?.staff?.leanTimeMinutes !== undefined ? todayStatus?.staff?.leanTimeMinutes : 30)}m
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Earnings & Shift Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'var(--bg-secondary, #f8f9fa)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '8px 14px',
            textAlign: 'right'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', fontWeight: 600 }}>
              {todayStatus?.checkedIn ? "Today's Wage Credited" : "Standard Daily Rate"}
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2ecc71' }}>
              ₹{currentDailyWage}
            </span>
          </div>

          {todayStatus?.checkedIn && !todayStatus?.checkedOut && (
            <div style={{
              background: 'rgba(46, 204, 113, 0.12)',
              border: '1px solid #2ecc71',
              borderRadius: '10px',
              padding: '8px 14px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '11px', color: '#27ae60', display: 'block', fontWeight: 700 }}>
                ● Active Shift
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#27ae60', fontFamily: 'monospace' }}>
                {elapsedTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Two Master Action Tabs Switcher ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <button
          type="button"
          onClick={() => { setActiveTab('attendance'); }}
          style={{
            padding: '16px 20px',
            borderRadius: '14px',
            border: activeTab === 'attendance' ? '2px solid var(--color-primary, #ff6b08)' : '1px solid var(--color-border)',
            background: activeTab === 'attendance' ? 'rgba(255, 107, 8, 0.08)' : 'var(--bg-card)',
            color: activeTab === 'attendance' ? 'var(--color-primary, #ff6b08)' : 'var(--color-text-primary)',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: activeTab === 'attendance' ? '0 4px 14px rgba(255,107,8,0.18)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>📋</span>
          1. Mark Attendance & Shift Wages
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('cafe_photos'); }}
          style={{
            padding: '16px 20px',
            borderRadius: '14px',
            border: activeTab === 'cafe_photos' ? '2px solid var(--color-primary, #ff6b08)' : '1px solid var(--color-border)',
            background: activeTab === 'cafe_photos' ? 'rgba(255, 107, 8, 0.08)' : 'var(--bg-card)',
            color: activeTab === 'cafe_photos' ? 'var(--color-primary, #ff6b08)' : 'var(--color-text-primary)',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: activeTab === 'cafe_photos' ? '0 4px 14px rgba(255,107,8,0.18)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>📸</span>
          2. Submit Cafe Photos
        </button>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div style={{
          backgroundColor: '#FDF2F2',
          borderLeft: '4px solid #EC5B5B',
          color: '#8A2525',
          padding: '14px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: '#F3FAF7',
          borderLeft: '4px solid #2ecc71',
          color: '#27ae60',
          padding: '14px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => {
              setSuccessMsg('');
              const input = document.getElementById('kiosk-staff-search');
              if (input) input.focus();
            }}
            style={{
              background: '#2ecc71',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            👤 Next Staff Member →
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: MARK ATTENDANCE & SHIFT WAGES (Kiosk Terminal & Logs)  */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* ─── KIOSK DEVICE STAFF SELECTOR BAR ─── */}
          {kioskStaffList.length > 0 && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--color-primary, #ff6b08)',
              borderRadius: '14px',
              padding: '16px 20px',
              boxShadow: '0 4px 16px rgba(255, 107, 8, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.5rem' }}>📱</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      Branch Attendance Kiosk ({kioskStaffList.length} Team Members)
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Select your name or Employee ID below to mark check-in / check-out
                    </p>
                  </div>
                </div>

                {/* Search Input for fast roster filtering */}
                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <input
                    id="kiosk-staff-search"
                    type="text"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="🔍 Search Staff Name / ID..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      fontSize: '12.5px',
                      background: 'var(--bg-secondary, #f8f9fa)'
                    }}
                  />
                  {staffSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStaffSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Staff Member Pill Selector Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '10px',
                maxHeight: '180px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}>
                {filteredKioskStaff.map((staff) => {
                  const isSelected = String(staff._id) === String(selectedStaffId);
                  const isDone = staff.isCheckedIn && staff.isCheckedOut;
                  const isInShift = staff.isCheckedIn && !staff.isCheckedOut;

                  return (
                    <div
                      key={staff._id}
                      onClick={() => handleSelectStaff(staff._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--color-primary, #ff6b08)' : '1px solid var(--color-border)',
                        background: isSelected ? 'rgba(255, 107, 8, 0.1)' : 'var(--bg-secondary, #fafafa)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--color-primary, #ff6b08)' : '#ccc',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 800,
                          flexShrink: 0
                        }}>
                          {staff.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{
                            display: 'block',
                            fontSize: '13px',
                            color: isSelected ? 'var(--color-primary, #ff6b08)' : 'var(--color-text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {staff.name}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                            {staff.employeeId || 'EMP'} • {staff.shiftStartTime || '09:00'}-{staff.shiftEndTime || '18:00'}
                          </span>
                        </div>
                      </div>

                      {/* Status and due badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isInShift ? 'rgba(46, 204, 113, 0.15)' : isDone ? 'rgba(52, 152, 219, 0.15)' : 'rgba(0,0,0,0.06)',
                          color: isInShift ? '#27ae60' : isDone ? '#2980b9' : 'var(--color-text-secondary)'
                        }}>
                          {isInShift ? '● Working' : isDone ? '✓ Done' : '○ Absent'}
                        </span>
                        {(staff.remainingSalaryBalance !== undefined && staff.remainingSalaryBalance > 0) && (
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: '#27ae60',
                            background: 'rgba(39, 174, 96, 0.1)',
                            padding: '1px 5px',
                            borderRadius: '3px'
                          }}>
                            Due: ₹{staff.remainingSalaryBalance}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Two-Column Grid: Attendance Action Card & Wage Receipt Card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Card A: 1-Click Check-in & Check-out Control */}
            <div className="staff-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    Staff Shift Terminal
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Active Member: <strong style={{ color: 'var(--color-primary, #ff6b08)' }}>{activeStaffMember?.name}</strong> ({activeStaffMember?.employeeId || 'ID Verified'})
                  </p>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: todayStatus?.checkedIn ? (todayStatus?.checkedOut ? 'rgba(52, 152, 219, 0.12)' : 'rgba(46, 204, 113, 0.12)') : 'rgba(231, 76, 60, 0.12)',
                  color: todayStatus?.checkedIn ? (todayStatus?.checkedOut ? '#2980b9' : '#27ae60') : '#e74c3c'
                }}>
                  {todayStatus?.checkedIn ? (todayStatus?.checkedOut ? '✓ Completed Today' : '● Shift Active') : '○ Not Checked In'}
                </span>
              </div>

              {/* Profile & Salary Overview Box */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 8, 0.06) 0%, rgba(255, 107, 8, 0.02) 100%)',
                border: '1px solid rgba(255, 107, 8, 0.25)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'var(--color-primary, #ff6b08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    boxShadow: '0 4px 12px rgba(255, 107, 8, 0.25)',
                    flexShrink: 0
                  }}>
                    {activeStaffMember?.name?.charAt(0)?.toUpperCase() || 'S'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {activeStaffMember?.name}
                      </h4>
                      <span style={{ fontSize: '11px', background: 'rgba(52, 152, 219, 0.15)', color: '#2980b9', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        {activeStaffMember?.role || 'Staff'} • {activeStaffMember?.employeeId || 'EMP'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      ⏰ Shift: <strong>{activeStaffMember?.shiftStartTime || '09:00'} - {activeStaffMember?.shiftEndTime || '18:00'}</strong> (Grace: {activeStaffMember?.leanTimeMinutes || 30}m)
                    </div>
                  </div>
                </div>

                {/* Live Salary Badges in Staff Card */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  background: 'var(--bg-card, #ffffff)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', fontWeight: 600 }}>Daily Shift Rate</span>
                    <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                      ₹{activeStaffMember?.dailyRate || user?.dailyRate || 0} <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>/ shift</span>
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#e67e22', display: 'block', fontWeight: 700 }}>
                      💰 Unpaid Salary (To Receive)
                    </span>
                    <strong style={{ fontSize: '15px', color: '#27ae60', fontWeight: 800 }}>
                      ₹{currentUnpaidDue.toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '2px' }}>
                      Earned: ₹{currentTotalEarned.toFixed(2)} • Paid: ₹{currentTotalPaid.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct 1-Click Check-In / Check-Out Controls */}
              {!todayStatus?.checkedIn ? (
                (() => {
                  const checkInWindow = getShiftCheckInStatus(activeStaffMember);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={handleConfirmAttendance}
                        disabled={actionLoading || !checkInWindow.isAllowed}
                        className="btn btn-primary"
                        style={{
                          padding: '16px',
                          fontSize: '15.5px',
                          fontWeight: 800,
                          boxShadow: checkInWindow.isAllowed ? '0 6px 20px rgba(255,107,8,0.3)' : 'none',
                          cursor: (actionLoading || !checkInWindow.isAllowed) ? 'not-allowed' : 'pointer',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          opacity: checkInWindow.isAllowed ? 1 : 0.65,
                          background: !checkInWindow.isAllowed ? '#888' : undefined,
                          borderColor: !checkInWindow.isAllowed ? '#888' : undefined
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{checkInWindow.isAllowed ? '👉' : '🔒'}</span>
                        {actionLoading 
                          ? 'Verifying GPS & Marking Check-In...' 
                          : checkInWindow.isTooEarly 
                            ? `Check-in Opens at ${checkInWindow.opensAt}` 
                            : checkInWindow.isExpired
                              ? 'Attendance Window Closed'
                              : `Mark Check-In for ${activeStaffMember?.name}`}
                      </button>

                      {!checkInWindow.isAllowed && (
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: checkInWindow.isTooEarly ? 'rgba(230, 126, 34, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                          border: `1px solid ${checkInWindow.isTooEarly ? '#e67e22' : '#e74c3c'}`,
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: checkInWindow.isTooEarly ? '#d35400' : '#c0392b',
                          textAlign: 'center'
                        }}>
                          {checkInWindow.reason}
                        </div>
                      )}

                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary, #f8f9fa)',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        textAlign: 'center'
                      }}>
                        📍 <strong>GPS Geofence:</strong> Presence is verified automatically against cafe counter coordinates.
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Already Checked In Controls */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {!todayStatus?.checkedOut ? (
                    <>
                      {/* Active Shift Banner */}
                      <div style={{
                        background: 'rgba(46, 204, 113, 0.08)',
                        border: '1px solid #2ecc71',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#27ae60', fontWeight: 700, textTransform: 'uppercase' }}>
                            ● Active Working Session
                          </span>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Checked in at: {formatTime(todayStatus?.attendance?.checkInTime)}
                          </div>
                        </div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#27ae60', fontFamily: 'monospace' }}>
                          {elapsedTime}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCheckOut}
                        disabled={actionLoading}
                        style={{
                          background: '#e74c3c',
                          color: '#fff',
                          border: 'none',
                          padding: '15px',
                          borderRadius: '12px',
                          fontSize: '15px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(231, 76, 60, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {actionLoading ? 'Processing Checkout...' : `⏹️ End Shift & Check Out (${activeStaffMember?.name})`}
                      </button>

                      {/* Overtime Trigger during shift */}
                      {todayStatus?.attendance?.isExtraWorkActive ? (
                        <button
                          type="button"
                          onClick={handleStopExtraWork}
                          disabled={actionLoading}
                          className="btn btn-secondary"
                          style={{ padding: '10px', fontWeight: 700, color: '#e74c3c' }}
                        >
                          ⏹️ Stop Extra Work / Overtime
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartExtraWork}
                          disabled={actionLoading}
                          className="btn btn-secondary"
                          style={{ padding: '10px', fontWeight: 700 }}
                        >
                          ⏱️ Start Extra Work / Overtime
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{
                        background: 'rgba(46, 204, 113, 0.1)',
                        border: '1.5px solid #2ecc71',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        color: '#27ae60',
                        fontWeight: 700
                      }}>
                        <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>✓</div>
                        <div>Shift Completed & Checked Out for Today ({activeStaffMember?.name})</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 500 }}>
                          Duration: {todayStatus?.attendance?.totalDuration ? `${Math.floor(todayStatus.attendance.totalDuration / 60)}h ${todayStatus.attendance.totalDuration % 60}m` : 'Completed'} • Day Wage Finalized: <strong>₹{currentDailyWage}</strong>
                        </div>
                      </div>

                      {/* Overtime Trigger after Checkout */}
                      {todayStatus?.attendance?.isExtraWorkActive ? (
                        <button
                          type="button"
                          onClick={handleStopExtraWork}
                          disabled={actionLoading}
                          style={{
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            padding: '13px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          ⏹️ Stop Extra Work / Overtime ({activeStaffMember?.name})
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartExtraWork}
                          disabled={actionLoading}
                          className="btn btn-secondary"
                          style={{ padding: '12px', fontWeight: 700, border: '1.5px dashed var(--color-primary, #ff6b08)', color: 'var(--color-primary, #ff6b08)' }}
                        >
                          ⏱️ Start Extra Work / Overtime ({activeStaffMember?.name})
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Monthly Aggregates Summary for Active Staff */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginTop: '10px'
          }}>
            <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block' }}>Presents (This Month)</span>
              <strong style={{ fontSize: '1.6rem', color: '#27ae60', marginTop: '6px', display: 'block', fontWeight: 800 }}>{summary.presentDays || 0} Days</strong>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block' }}>Absents (This Month)</span>
              <strong style={{ fontSize: '1.6rem', color: '#e74c3c', marginTop: '6px', display: 'block', fontWeight: 800 }}>
                {summary.absentDays !== undefined ? summary.absentDays : Math.max(0, new Date().getDate() - (summary.presentDays || 0))} Days
              </strong>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '14px', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Unpaid Salary Due (To Receive)</span>
                <span style={{ fontSize: '10.5px', background: 'rgba(39, 174, 96, 0.12)', color: '#27ae60', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>Pending Payout</span>
              </div>
              <strong style={{ fontSize: '1.6rem', color: '#27ae60', marginTop: '6px', display: 'block', fontWeight: 800 }}>
                ₹{currentUnpaidDue.toFixed(2)}
              </strong>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span>Earned: <strong>₹{currentTotalEarned.toFixed(2)}</strong></span>
                <span>•</span>
                <span>Paid by Owner: <strong style={{ color: '#2980b9' }}>₹{currentTotalPaid.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* 30-Day Shift & Wage History Table for Active Staff */}
          <div className="staff-dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Past 30 Days Shift & Wage Logs ({activeStaffMember?.name})
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Detailed record of check-in, check-out, duration, and calculated day wages
                </p>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {historyData.length} records found
              </span>
            </div>

            {historyData.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--bg-secondary, #f8f9fa)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                <strong style={{ color: 'var(--color-text-primary)' }}>No past attendance records found for {activeStaffMember?.name} in the last 30 days.</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Mark attendance today to record first shift.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left', minWidth: '520px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--color-border)', background: 'var(--bg-secondary, #f8f9fa)' }}>
                      <th style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Check In</th>
                      <th style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Check Out</th>
                      <th style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Wage Earned</th>
                      <th style={{ padding: '12px 14px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((record) => {
                      const statusColor = record.status === 'Late' ? '#f39c12' : '#2ecc71';
                      const wage = record.dailyWageEarned !== undefined ? record.dailyWageEarned : (record.status === 'Half Day' ? (activeStaffMember?.dailyRate || user?.dailyRate || 0) * 0.5 : (activeStaffMember?.dailyRate || user?.dailyRate || 0));

                      return (
                        <tr key={record._id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.15s' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatDate(record.date)}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                            {formatTime(record.checkInTime)}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                            {record.checkOutTime ? formatTime(record.checkOutTime) : 'Shift In Progress'}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#2ecc71' }}>
                            ₹{wage}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: SUBMIT CAFE PHOTOS (Proof of Cleanliness / Shifts)    */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cafe_photos' && (
        <div className="staff-dashboard-card" style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Submit Daily Cafe & Work Photos
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
              Upload proof-of-work photos (cleaned tables, sanitized kitchen, prep counter, register area). Photos can be submitted anytime during the day (No shift cutoff time).
            </p>
          </div>

          {reportError && (
            <div style={{
              backgroundColor: '#FDF2F2',
              borderLeft: '4px solid #EC5B5B',
              color: '#8A2525',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              fontWeight: 600
            }}>
              {reportError}
            </div>
          )}

          {reportSuccess && (
            <div style={{
              backgroundColor: '#F3FAF7',
              borderLeft: '4px solid #2ecc71',
              color: '#27ae60',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              fontWeight: 700
            }}>
              {reportSuccess}
            </div>
          )}

          <form onSubmit={handleSubmitCafePhotos} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Hidden Photo file picker */}
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              ref={cafePhotoInputRef}
              style={{ display: 'none' }}
              onChange={handleCafePhotoSelect}
            />

            {/* Photo Capture Dropzone */}
            <div
              onClick={() => cafePhotoInputRef.current?.click()}
              style={{
                border: '2px dashed var(--color-primary, #ff6b08)',
                borderRadius: '14px',
                padding: '30px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 107, 8, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📷</div>
              <strong style={{ fontSize: '15px', color: 'var(--color-primary, #ff6b08)', display: 'block' }}>
                Tap to Open Camera or Choose Photos
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                Capture up to 15 photos of cafe floor, kitchen, and counters (JPG, PNG, WEBP)
              </span>
            </div>

            {/* Photo Previews Grid */}
            {photoPreviews.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Selected Photos ({photoPreviews.length} / 15)
                  </label>
                  <button
                    type="button"
                    onClick={() => { setSelectedPhotos([]); setPhotoPreviews([]); }}
                    style={{ background: 'transparent', border: 'none', color: '#e74c3c', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '12px'
                }}>
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} style={{
                      position: 'relative',
                      height: '110px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                      <img src={preview} alt={`Upload ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'block', marginBottom: '6px' }}>
                Shift Notes / Work Summary (Optional)
              </label>
              <textarea
                rows="3"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="e.g. Completed kitchen sanitization, cleaned table section A, prepped milk and coffee beans for tomorrow..."
                className="form-input"
                style={{ width: '100%', borderRadius: '10px', padding: '10px 12px', fontSize: '13px' }}
              />
            </div>

            <button
              type="submit"
              disabled={reportLoading || selectedPhotos.length === 0}
              className="btn btn-primary"
              style={{
                padding: '14px',
                fontSize: '15px',
                fontWeight: 800,
                opacity: selectedPhotos.length === 0 ? 0.6 : 1,
                cursor: selectedPhotos.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {reportLoading ? 'Uploading Photos...' : '🚀 Submit Cafe Photos'}
            </button>
          </form>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* 4-DIGIT ATTENDANCE PIN VERIFICATION POPUP MODAL                   */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {pinModal.isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setPinModal({ isOpen: false, action: 'check-in', staff: null });
              setEnteredPin('');
              setPinError('');
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3500,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--color-primary, #ff6b08)',
              borderRadius: '20px',
              padding: '28px 24px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                if (!actionLoading) {
                  setPinModal({ isOpen: false, action: 'check-in', staff: null });
                  setEnteredPin('');
                  setPinError('');
                }
              }}
              disabled={actionLoading}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0, 0, 0, 0.06)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                color: 'var(--color-text-secondary)'
              }}
            >
              ✕
            </button>

            {/* Modal Header Badge & Staff Info */}
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: pinModal.action === 'check-in' ? 'var(--color-primary, #ff6b08)' : '#e74c3c',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                fontWeight: 800,
                boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                marginBottom: '14px'
              }}
            >
              🔐
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', textAlign: 'center' }}>
              {pinModal.action === 'check-in' ? 'Check-In Verification' : 'Check-Out Verification'}
            </h3>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 107, 8, 0.1)',
              padding: '4px 12px',
              borderRadius: '20px',
              marginBottom: '10px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary, #ff6b08)' }}>
                👤 {pinModal.staff?.name || activeStaffMember?.name}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                ({pinModal.staff?.employeeId || activeStaffMember?.employeeId || 'EMP'})
              </span>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              Enter the 4-digit PIN set up by the owner to confirm attendance.
            </p>

            {/* 4-Digit Slot Display */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
              {[0, 1, 2, 3].map((idx) => {
                const char = enteredPin[idx] || '';
                const isCurrent = enteredPin.length === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      width: '48px',
                      height: '54px',
                      borderRadius: '12px',
                      border: isCurrent 
                        ? '2px solid var(--color-primary, #ff6b08)' 
                        : char 
                          ? '2px solid #2ecc71' 
                          : '1.5px solid var(--color-border)',
                      background: char ? 'rgba(46, 204, 113, 0.08)' : 'var(--bg-secondary, #f8f9fa)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                      boxShadow: isCurrent ? '0 0 12px rgba(255, 107, 8, 0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {char ? '●' : ''}
                  </div>
                );
              })}
            </div>

            {/* Error Message */}
            {pinError && (
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(231, 76, 60, 0.12)',
                  border: '1.5px solid #e74c3c',
                  color: '#c0392b',
                  fontSize: '12px',
                  fontWeight: 700,
                  textAlign: 'center',
                  marginBottom: '14px',
                  boxSizing: 'border-box'
                }}
              >
                ⚠️ {pinError}
              </div>
            )}

            {/* On-Screen Touch Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                width: '100%',
                maxWidth: '260px',
                marginBottom: '18px'
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    if (btn === 'C') {
                      setEnteredPin('');
                      setPinError('');
                    } else if (btn === '⌫') {
                      setEnteredPin(prev => prev.slice(0, -1));
                      setPinError('');
                    } else {
                      if (enteredPin.length < 4) {
                        const nextPin = enteredPin + btn;
                        setEnteredPin(nextPin);
                        setPinError('');
                        if (nextPin.length === 4) {
                          handleVerifyAndSubmitAttendance(nextPin);
                        }
                      }
                    }
                  }}
                  style={{
                    height: '52px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border)',
                    background: btn === 'C' ? 'rgba(231, 76, 60, 0.1)' : btn === '⌫' ? 'rgba(243, 156, 18, 0.1)' : 'var(--bg-secondary, #f8f9fa)',
                    color: btn === 'C' ? '#e74c3c' : btn === '⌫' ? '#d35400' : 'var(--color-text-primary)',
                    fontSize: btn === '⌫' ? '1.3rem' : '1.25rem',
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s ease',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setPinModal({ isOpen: false, action: 'check-in', staff: null });
                  setEnteredPin('');
                  setPinError('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading || enteredPin.length !== 4}
                onClick={() => handleVerifyAndSubmitAttendance(enteredPin)}
                className="btn btn-primary"
                style={{
                  flex: 1.5,
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13px',
                  background: pinModal.action === 'check-out' ? '#e74c3c' : undefined,
                  borderColor: pinModal.action === 'check-out' ? '#e74c3c' : undefined,
                  cursor: (actionLoading || enteredPin.length !== 4) ? 'not-allowed' : 'pointer',
                  opacity: enteredPin.length === 4 ? 1 : 0.6
                }}
              >
                {actionLoading 
                  ? 'Verifying GPS & PIN...' 
                  : pinModal.action === 'check-in' 
                    ? 'Confirm Check-In' 
                    : 'Confirm Check-Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;