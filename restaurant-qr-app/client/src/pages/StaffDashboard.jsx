import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import {
  checkIn,
  checkOut,
  getTodayAttendanceStatus,
  getStaffAttendanceHistory,
  getKioskStaffList,
  submitWorkReport,
  getAssetUrl
} from '../services/api';
import { compressMultipleImages } from '../utils/imageCompressor';
import '../styles/App.css';

const StaffDashboard = () => {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const curMonthPrefix = `${nowIST.getUTCFullYear()}-${String(nowIST.getUTCMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(curMonthPrefix);

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

  // 4-Digit Attendance PIN + Live Camera Verification Modal State
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    action: 'check-in', // 'check-in' | 'check-out'
    staff: null,
    step: 'pin' // 'pin' | 'camera'
  });
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Camera capture states (Mobile & Tablet optimized)
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Cafe Photos Submission state
  const [reportNotes, setReportNotes] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const cafePhotoInputRef = useRef(null);

  const timerRef = useRef(null);
  const pollingRef = useRef(null);

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

  // Helper: Stop active camera stream tracks safely on all devices
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => {
          track.stop();
        });
      } catch (e) {
        console.warn('Track stop error:', e);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch (e) {}
    }
  }, []);

  // Helper: Start front-facing camera with device fallbacks (Tablets / Android / iOS / Desktop)
  const startCameraStream = useCallback(async () => {
    setCameraLoading(true);
    setCameraError('');
    try {
      stopCameraStream();

      let stream = null;
      // 1. Try front camera with ideal dimensions
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (frontErr) {
        console.warn('Front camera constraint failed, trying generic video:', frontErr);
        // 2. Generic fallback for tablets/devices with specific camera configs
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play error (retry with user interaction):', playErr);
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access denied or unavailable. Please enable camera permission in your tablet settings.');
    } finally {
      setCameraLoading(false);
    }
  }, [stopCameraStream]);

  // Helper: Tablet & Mobile Bulletproof Snapshot & Compression (~25KB–35KB)
  const captureAndCompressPhoto = useCallback(() => {
    try {
      const video = videoRef.current;
      if (!video) return null;

      // Resolve actual video pixel dimensions or fallback to container size
      let width = video.videoWidth || video.clientWidth || 480;
      let height = video.videoHeight || video.clientHeight || 480;
      if (width <= 0) width = 480;
      if (height <= 0) height = 480;

      const canvas = document.createElement('canvas');
      const maxDim = 480;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Mirror horizontal for natural selfie view
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      // High efficiency JPEG compression at 0.6 (~25KB-35KB)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      return dataUrl;
    } catch (err) {
      console.error('Photo capture error:', err);
      return null;
    }
  }, []);

  const generateMonthOptions = () => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      list.push({ val, label: i === 0 ? `This Month (${label})` : label });
    }
    list.push({ val: 'all', label: 'All Time History' });
    return list;
  };

  const handleExportStaffExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Shift & Attendance Logs
      const shiftRows = historyData.map((h, i) => {
        const wage = h.dailyWageEarned !== undefined ? h.dailyWageEarned : (activeStaffMember?.dailyRate || 0);
        const penalty = h.totalPenaltyAmount || 0;
        return {
          "Sl No": i + 1,
          "Date": h.date || (h.checkInTime ? new Date(h.checkInTime).toLocaleDateString('en-IN') : ''),
          "Staff Name": activeStaffMember?.name || '',
          "Staff Role": activeStaffMember?.role || '',
          "Check In Time": h.checkInTime ? new Date(h.checkInTime).toLocaleTimeString('en-IN') : '-',
          "Check Out Time": h.checkOutTime ? new Date(h.checkOutTime).toLocaleTimeString('en-IN') : (h.activeSessionNumber ? 'Shift In Progress' : '-'),
          "Duration (Mins)": h.totalDuration || 0,
          "Hours Worked": Number(((h.totalDuration || 0) / 60).toFixed(1)),
          "Status": h.status || 'Present',
          "Base Rate (₹)": activeStaffMember?.dailyRate || 0,
          "Late Cut (₹)": penalty,
          "Net Wage Earned (₹)": wage
        };
      });

      if (shiftRows.length === 0) {
        shiftRows.push({ "Status": "No records found for this period" });
      }

      const wsShifts = XLSX.utils.json_to_sheet(shiftRows);
      XLSX.utils.book_append_sheet(wb, wsShifts, "Shift & Wage Logs");

      // Sheet 2: Monthly Summary
      const summaryRows = [{
        "Staff Name": activeStaffMember?.name || '',
        "Staff ID": activeStaffMember?._id || '',
        "Role": activeStaffMember?.role || '',
        "Period": summary?.monthDisplayName || selectedMonth,
        "Present Days": summary?.presentDays || 0,
        "Absent Days": summary?.absentDays || 0,
        "Late Days": summary?.lateDays || 0,
        "Total Working Hours": summary?.totalWorkingHours || 0,
        "Total Wages Earned (₹)": summary?.salaryEarnedThisMonth || 0,
        "Paid by Owner (₹)": summary?.paidThisMonth || 0,
        "Unpaid Due (₹)": summary?.unpaidThisMonth || 0
      }];

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Monthly Summary");

      const sanitizedName = (activeStaffMember?.name || 'Staff').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Staff_Ledger_${sanitizedName}_${selectedMonth}.xlsx`;
      try {
        XLSX.writeFile(wb, filename);
      } catch (writeErr) {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 500);
      }
    } catch (err) {
      console.error('Error exporting staff Excel:', err);
      alert('Failed to export Excel. Please try again.');
    }
  };

  // Fetch initial data & branch kiosk staff roster
  const fetchData = useCallback(async (isSilent = false, overrideStaffId = null, overrideMonth = null) => {
    try {
      if (!isSilent) setLoading(true);
      setErrorMsg('');

      // 1. Resolve geolocation in background asynchronously
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
      const resolvedMonth = overrideMonth || selectedMonth;

      // 2. Fetch Kiosk roster and Attendance concurrently in parallel
      const [kioskRes, todayRes, historyRes] = await Promise.all([
        getKioskStaffList({ branchId: branchParam }).catch((err) => {
          console.warn('Kiosk list fetch error:', err);
          return { success: false };
        }),
        getTodayAttendanceStatus({ ...(coords || {}), staffId: resolvedTargetId }),
        getStaffAttendanceHistory({ staffId: resolvedTargetId, month: resolvedMonth })
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

      if (todayRes && todayRes.success) {
        setTodayStatus(todayRes);
      }

      if (historyRes && historyRes.success) {
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
      if (!isSilent) setErrorMsg('Failed to sync attendance details with server.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [activeBranchId, user, selectedStaffId, coords, selectedMonth]);

  // Initial load
  useEffect(() => {
    setTodayStatus(null);
    setHistoryData([]);
    setLoading(true);
    fetchData();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopCameraStream();
    };
  }, [activeBranchId]);

  // Live auto-checkout & status polling (every 10s) — ensures seamless zero-refresh UI updates
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(() => {
      const targetId = selectedStaffId || user?._id;
      if (targetId && !pinModal.isOpen) {
        getTodayAttendanceStatus({ ...(coords || {}), staffId: targetId })
          .then((res) => {
            if (res && res.success) {
              setTodayStatus((prev) => {
                const prevCheckedIn = prev?.checkedIn;
                const prevCheckedOut = prev?.checkedOut;
                const newCheckedIn = res.checkedIn;
                const newCheckedOut = res.checkedOut;
                const prevSession = prev?.attendance?.activeSessionNumber;
                const newSession = res.attendance?.activeSessionNumber;

                if (prevCheckedIn !== newCheckedIn || prevCheckedOut !== newCheckedOut || prevSession !== newSession) {
                  getStaffAttendanceHistory({ staffId: targetId }).then((hist) => {
                    if (hist?.success) {
                      setHistoryData(hist.history || []);
                      setSummary(hist.summary || { totalWorkingHours: 0, attendancePercentage: 0, lateDays: 0, presentDays: 0 });
                    }
                  });
                }
                return res;
              });
            }
          })
          .catch((err) => console.warn('Silent attendance poll error:', err.message));
      }
    }, 10000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedStaffId, user, coords, pinModal.isOpen]);

  // Instant Zero-Lag staff switching in kiosk roster
  const handleSelectStaff = async (staffId) => {
    if (String(staffId) === String(selectedStaffId)) return;
    setSelectedStaffId(staffId);
    setErrorMsg('');
    setSuccessMsg('');
    setTodayStatus(null);
    setHistoryData([]);
    setLoading(true);

    try {
      const [todayRes, historyRes] = await Promise.all([
        getTodayAttendanceStatus({ ...(coords || {}), staffId }),
        getStaffAttendanceHistory({ staffId, month: selectedMonth })
      ]);
      if (todayRes && todayRes.success) {
        setTodayStatus(todayRes);
      }
      if (historyRes && historyRes.success) {
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

  // Re-fetch history when selectedMonth changes
  useEffect(() => {
    const targetId = selectedStaffId || user?._id;
    if (targetId) {
      getStaffAttendanceHistory({ staffId: targetId, month: selectedMonth }).then((res) => {
        if (res && res.success) {
          setHistoryData(res.history || []);
          setSummary(res.summary || { totalWorkingHours: 0, attendancePercentage: 0, lateDays: 0, presentDays: 0 });
        }
      }).catch(err => console.error('Month change history fetch error:', err));
    }
  }, [selectedMonth]);

  // Update live shift duration timer
  useEffect(() => {
    let interval = null;
    const activeSession = (todayStatus?.attendance?.shiftSessions || []).find(s => !s.checkOutTime) ||
                          (todayStatus?.checkedIn && !todayStatus?.checkedOut ? todayStatus?.attendance : null);

    if (activeSession && activeSession.checkInTime) {
      const startTime = new Date(activeSession.checkInTime).getTime();

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

  // Helper: Validate if Check-in is currently allowed
  const getShiftCheckInStatus = (staff) => {
    if (!staff || !staff.shiftStartTime) {
      return { isAllowed: true, reason: '' };
    }

    const shiftStartTime = staff.shiftStartTime;
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
    const earlyOpenMins = shiftStartMins - 15;

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
        reason: `🔒 Check-in opens at ${formatMin(earlyOpenMins)} (15 minutes before your ${formatMin(shiftStartMins)} shift)`
      };
    }

    return { isAllowed: true, reason: '' };
  };

  // Open 4-digit PIN verification modal for Check-In
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
      staff: activeStaffMember,
      step: 'pin'
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
      staff: activeStaffMember,
      step: 'pin'
    });
  };

  const closePinModal = () => {
    stopCameraStream();
    setPinModal({ isOpen: false, action: 'check-in', staff: null, step: 'pin' });
    setEnteredPin('');
    setPinError('');
    setCameraError('');
  };

  // Handle advance from Step 1 (PIN) to Step 2 (Camera) for check-in, or submit directly for check-out
  const handlePinComplete = (pinVal) => {
    const pin = String(pinVal !== undefined ? pinVal : enteredPin).trim();
    if (pin.length !== 4) {
      setPinError('Please enter all 4 digits of your Attendance PIN.');
      return;
    }

    setPinError('');
    if (pinModal.action === 'check-in') {
      setPinModal(prev => ({ ...prev, step: 'camera' }));
      startCameraStream();
    } else {
      handleVerifyAndSubmitAttendance(pin, null);
    }
  };

  // Verify PIN & submit attendance with zero-hang fast execution
  const handleVerifyAndSubmitAttendance = async (pinToSubmit, photoBase64) => {
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

    // Fast GPS resolution: use cached coords or race with 1.5s timeout (never hang on tablets)
    let lat = coords?.latitude || 0;
    let lng = coords?.longitude || 0;

    if (!lat && navigator.geolocation) {
      try {
        const fastPos = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(null), 1500);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeout);
              resolve(pos.coords);
            },
            () => {
              clearTimeout(timeout);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 1500, maximumAge: 60000 }
          );
        });
        if (fastPos) {
          lat = fastPos.latitude;
          lng = fastPos.longitude;
          setCoords({ latitude: lat, longitude: lng });
        }
      } catch (geoErr) {
        console.warn('Fast geo lookup skipped:', geoErr);
      }
    }

    try {
      if (isCheckIn) {
        const userAgent = navigator.userAgent;
        let deviceInfo = 'Tablet Kiosk';
        if (/iPad|tablet/i.test(userAgent)) deviceInfo = 'iPad Kiosk';
        else if (/mobile/i.test(userAgent)) deviceInfo = 'Mobile Kiosk';
        else if (/chrome/i.test(userAgent)) deviceInfo = 'Chrome Kiosk';
        else if (/safari/i.test(userAgent)) deviceInfo = 'Safari Kiosk';

        const res = await checkIn({
          staffId: currentTargetId,
          latitude: lat,
          longitude: lng,
          deviceInfo,
          attendancePin: pin,
          imageData: photoBase64 || undefined
        });

        if (res.success) {
          stopCameraStream();
          closePinModal();
          setSuccessMsg(`✓ Attendance marked successfully for ${currentTargetName}!`);
          fetchData(false, currentTargetId);
        } else {
          setPinError(res.message || 'Check-in validation failed.');
        }
      } else {
        const res = await checkOut({
          staffId: currentTargetId,
          latitude: lat,
          longitude: lng,
          attendancePin: pin
        });

        if (res.success) {
          closePinModal();
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
        if (pinModal.step === 'camera') {
          stopCameraStream();
          setPinModal(prev => ({ ...prev, step: 'pin' }));
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Keyboard support for 4-digit PIN modal
  useEffect(() => {
    if (!pinModal.isOpen || pinModal.step !== 'pin') return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        if (enteredPin.length < 4) {
          const nextPin = enteredPin + e.key;
          setEnteredPin(nextPin);
          setPinError('');
          if (nextPin.length === 4) {
            handlePinComplete(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        setEnteredPin(prev => prev.slice(0, -1));
        setPinError('');
      } else if (e.key === 'Escape') {
        if (!actionLoading) {
          closePinModal();
        }
      } else if (e.key === 'Enter') {
        if (enteredPin.length === 4 && !actionLoading) {
          handlePinComplete(enteredPin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinModal.isOpen, pinModal.step, enteredPin, actionLoading, pinModal.action]);

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

  const currentDailyWage = todayStatus?.todayWageEarned !== undefined 
    ? todayStatus.todayWageEarned 
    : (todayStatus?.attendance?.dailyWageEarned !== undefined 
        ? todayStatus.attendance.dailyWageEarned 
        : (activeStaffMember?.dailyRate || user?.dailyRate || 0));

  const currentUnpaidDue = summary?.unpaidSalaryBalance !== undefined
    ? Number(summary.unpaidSalaryBalance)
    : (activeStaffMember?.remainingSalaryBalance !== undefined
        ? Number(activeStaffMember.remainingSalaryBalance)
        : (summary?.salaryEarnedThisMonth !== undefined
            ? Number(summary.salaryEarnedThisMonth)
            : historyData.reduce((sum, r) => sum + (r.dailyWageEarned !== undefined ? Number(r.dailyWageEarned) : (activeStaffMember?.dailyRate || 0)), 0)
          )
      );

  // Filtered staff list for kiosk search
  const filteredKioskStaff = kioskStaffList.filter(s => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase();
    return (s.name && s.name.toLowerCase().includes(q)) || 
           (s.employeeId && String(s.employeeId).toLowerCase().includes(q)) ||
           (s.staffRole && s.staffRole.toLowerCase().includes(q));
  });

  // Determine active open session or completed sessions for multi-shift split flow
  const shiftSessions = todayStatus?.attendance?.shiftSessions || [];
  const completedSessions = shiftSessions.filter(s => !!s.checkOutTime);
  const activeSession = shiftSessions.find(s => !s.checkOutTime) ||
                        (todayStatus?.checkedIn && !todayStatus?.checkedOut ? todayStatus?.attendance : null);

  const isCheckedIn = !!activeSession && !activeSession.checkOutTime;

  // Active shift number calculation
  const totalConfiguredShifts = (activeStaffMember?.scheduleType === 'SPLIT' && Array.isArray(activeStaffMember?.shifts) && activeStaffMember.shifts.length > 0)
    ? activeStaffMember.shifts.length
    : 1;
  const currentShiftNumber = activeSession ? (activeSession.sessionNumber || 1) : (completedSessions.length + 1);
  const canStartNextShift = !isCheckedIn && currentShiftNumber <= totalConfiguredShifts;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                ⏰ Shift: {activeStaffMember?.shiftStartTime || '09:00'} - {activeStaffMember?.shiftEndTime || '18:00'}
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
              {todayStatus?.checkedIn ? "Today's Wage Credited" : "Shift Rate"}
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2ecc71' }}>
              ₹{currentDailyWage}
            </span>
          </div>

          {isCheckedIn && (
            <div style={{
              background: 'rgba(46, 204, 113, 0.12)',
              border: '1px solid #2ecc71',
              borderRadius: '10px',
              padding: '8px 14px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '11px', color: '#27ae60', display: 'block', fontWeight: 700 }}>
                ● Active Shift {currentShiftNumber}
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

          {/* ─── ACTIVE STAFF TERMINAL CARD (Zero-lag skeleton when loading) ─── */}
          {loading ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '220px',
              gap: '12px'
            }}>
              <div className="spinner" style={{ width: '32px', height: '32px', borderColor: 'var(--color-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Syncing {activeStaffMember?.name}'s live shift status...
              </span>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#3498db',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 800
                  }}>
                    {activeStaffMember?.name?.charAt(0)?.toUpperCase() || 'S'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {activeStaffMember?.name}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                        ({activeStaffMember?.employeeId || 'EMP'})
                      </span>
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      ⏰ Shift: {activeStaffMember?.shiftStartTime || '09:00'} - {activeStaffMember?.shiftEndTime || '18:00'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', fontWeight: 600 }}>
                      Shift Rate
                    </span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--color-text-primary)' }}>
                      ₹{activeStaffMember?.dailyRate || 0} <span style={{ fontSize: '11px', fontWeight: 500 }}>/ shift</span>
                    </strong>
                  </div>

                  <div style={{ textAlign: 'right', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#d35400', display: 'block', fontWeight: 700 }}>
                      💰 Unpaid Salary (To Receive)
                    </span>
                    <strong style={{ fontSize: '1.2rem', color: '#27ae60' }}>
                      ₹{currentUnpaidDue.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* ─── ACTIVE SHIFT SESSION BANNER (if currently checked in) ─── */}
              {isCheckedIn && (
                <div style={{
                  background: 'rgba(46, 204, 113, 0.08)',
                  border: '1.5px solid #2ecc71',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <strong style={{ color: '#27ae60', fontSize: '14px', display: 'block' }}>
                      ● ACTIVE WORKING SESSION (SHIFT {currentShiftNumber})
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Checked in at: {formatTime(activeSession.checkInTime)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#27ae60', fontFamily: 'monospace' }}>
                        {elapsedTime}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── MAIN ATTENDANCE ACTION BUTTON (Clock In / Clock Out) ─── */}
              <div style={{ marginTop: '6px' }}>
                {isCheckedIn ? (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleCheckOut}
                    className="btn"
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: '#e74c3c',
                      borderColor: '#e74c3c',
                      color: '#fff',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: 800,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(231, 76, 60, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>⏹</span>
                    {actionLoading ? 'Processing Check-Out...' : `End Shift ${currentShiftNumber} & Check Out (${activeStaffMember?.name})`}
                  </button>
                ) : canStartNextShift ? (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleConfirmAttendance}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: 800,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(255, 107, 8, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>📸</span>
                    {actionLoading ? 'Initializing Camera & PIN...' : `Check In for Shift ${currentShiftNumber} (${activeStaffMember?.name})`}
                  </button>
                ) : (
                  <div style={{
                    background: 'rgba(52, 152, 219, 0.08)',
                    border: '1.5px solid #3498db',
                    borderRadius: '12px',
                    padding: '14px',
                    textAlign: 'center',
                    color: '#2980b9',
                    fontWeight: 700,
                    fontSize: '14px'
                  }}>
                    ✓ All shifts for today have been completed for {activeStaffMember?.name}. Great job!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── SUMMARY METRICS (Presents, Absents, Unpaid Balance) ─── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px'
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '16px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block' }}>
                Presents (This Month)
              </span>
              <strong style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2ecc71', display: 'block', marginTop: '4px' }}>
                {summary.presentDays || (historyData.filter(h => h.status === 'Present' || h.status === 'Late').length)} Days
              </strong>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '16px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block' }}>
                Absents (This Month)
              </span>
              <strong style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e74c3c', display: 'block', marginTop: '4px' }}>
                {summary.absentDays !== undefined ? summary.absentDays : Math.max(0, 30 - (summary.presentDays || historyData.length))} Days
              </strong>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '16px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  Unpaid Salary Due (To Receive)
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(46, 204, 113, 0.15)', color: '#27ae60', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                  Pending Payout
                </span>
              </div>
              <strong style={{ fontSize: '1.8rem', fontWeight: 800, color: '#27ae60', display: 'block', marginTop: '4px' }}>
                ₹{currentUnpaidDue.toFixed(2)}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Earned: ₹{(summary?.totalEarnedAllTime || currentUnpaidDue).toFixed(2)} • Paid by Owner: ₹{(summary?.totalPaidAllTime || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* ─── MONTHLY SHIFT & WAGE LOGS TABLE ─── */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Shift & Wage Logs ({activeStaffMember?.name || 'Staff'}) — {summary?.monthDisplayName || (selectedMonth === 'all' ? 'All Time' : selectedMonth)}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Detailed record of check-in, check-out, working hours, and daily wages earned
                </p>
              </div>

              {/* Controls: Month Selector and Excel Download */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--color-border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {generateMonthOptions().map(opt => (
                    <option key={opt.val} value={opt.val}>{opt.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleExportStaffExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#27ae60',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(39, 174, 96, 0.3)'
                  }}
                  title="Download full monthly staff attendance and payroll ledger to Excel"
                >
                  <span>📥</span>
                  <span>Export to Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Check In</th>
                    <th style={{ padding: '10px 12px' }}>Check Out</th>
                    <th style={{ padding: '10px 12px' }}>Wage Earned</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Selfie (12h)</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>
                        No attendance records found for this staff member.
                      </td>
                    </tr>
                  ) : (
                    historyData.map((record, idx) => {
                      const wage = record.dailyWageEarned !== undefined ? record.dailyWageEarned : (activeStaffMember?.dailyRate || 0);
                      const isLate = record.status === 'Late';
                      const penalty = record.totalPenaltyAmount || 0;
                      const hasSelfie = record.image && !record.imageExpired;

                      return (
                        <tr key={record._id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px', fontWeight: 700 }}>
                            {formatDate(record.date)}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                            {formatTime(record.checkInTime)}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                            {record.checkOutTime ? formatTime(record.checkOutTime) : (
                              <span style={{ color: '#27ae60', fontWeight: 700 }}>Shift In Progress</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 800, color: '#27ae60' }}>
                            ₹{wage}
                            {penalty > 0 && (
                              <span style={{ fontSize: '11px', color: '#e74c3c', marginLeft: '6px' }}>
                                (-₹{penalty} late cut)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: isLate ? 'rgba(243, 156, 18, 0.15)' : 'rgba(46, 204, 113, 0.15)',
                              color: isLate ? '#d35400' : '#27ae60'
                            }}>
                              {record.status || 'Present'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {hasSelfie ? (
                              <a
                                href={record.image.startsWith('data:') ? record.image : getAssetUrl(record.image)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: 'var(--color-primary)',
                                  textDecoration: 'none',
                                  background: 'rgba(255, 107, 8, 0.08)',
                                  padding: '4px 8px',
                                  borderRadius: '6px'
                                }}
                              >
                                <img
                                  src={record.image.startsWith('data:') ? record.image : getAssetUrl(record.image)}
                                  alt="Selfie"
                                  style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                View
                              </a>
                            ) : record.imageExpired ? (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                🔒 Purged (12h)
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: SUBMIT CAFE PHOTOS (Workstation Sanitization & Prep)    */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cafe_photos' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              📸 Submit Daily Cafe & Station Photos
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Take photos of cleaned counters, sanitized equipment, prepped kitchen ingredients, and opening/closing readiness.
            </p>
          </div>

          {reportError && (
            <div style={{
              background: '#FDF2F2',
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
              background: '#F3FAF7',
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

          <form onSubmit={handleSubmitCafePhotos} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'block', marginBottom: '8px' }}>
                Capture or Select Photos (Up to 15 photos, automatically optimized)
              </label>
              
              <input
                type="file"
                ref={cafePhotoInputRef}
                onChange={handleCafePhotoSelect}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
              />

              <div
                onClick={() => cafePhotoInputRef.current && cafePhotoInputRef.current.click()}
                style={{
                  border: '2px dashed var(--color-primary, #ff6b08)',
                  borderRadius: '14px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'rgba(255, 107, 8, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '2.4rem', display: 'block', marginBottom: '8px' }}>📷</span>
                <strong style={{ fontSize: '14px', color: 'var(--color-primary, #ff6b08)', display: 'block' }}>
                  Click to open Camera or Upload Cafe Photos
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '4px' }}>
                  JPEG / PNG formats accepted • Max 15 photos
                </span>
              </div>
            </div>

            {/* Photo Previews */}
            {photoPreviews.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Selected Photos ({photoPreviews.length} / 15)
                </span>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: '10px'
                }}>
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100%', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                      <img src={preview} alt={`Preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px'
                        }}
                      >
                        ✕
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
      {/* 2-STEP ATTENDANCE PIN + MANDATORY LIVE CAMERA POPUP MODAL         */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {pinModal.isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              closePinModal();
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
              onClick={closePinModal}
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

            {/* ═════════════════════════════════════════════════════════ */}
            {/* STEP 2: LIVE SELFIE CAMERA CAPTURE (12h AUTO-PURGE)       */}
            {/* ═════════════════════════════════════════════════════════ */}
            {pinModal.step === 'camera' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {/* Header Badge */}
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'var(--color-primary, #ff6b08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                    marginBottom: '12px'
                  }}
                >
                  📸
                </div>

                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                  Smile for Check-In Selfie!
                </h3>

                <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: '#27ae60', fontWeight: 700, textAlign: 'center' }}>
                  🔒 Auto-purged from cloud & storage in 12 hours
                </p>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 107, 8, 0.1)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  marginBottom: '14px'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary, #ff6b08)' }}>
                    👤 {pinModal.staff?.name || activeStaffMember?.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                    ({pinModal.staff?.employeeId || activeStaffMember?.employeeId || 'EMP'})
                  </span>
                </div>

                {/* Camera Viewport Container (Tablet & Mobile Optimized) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '300px',
                  height: '240px',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  background: '#111',
                  marginBottom: '16px',
                  border: '2px solid var(--color-primary, #ff6b08)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    webkit-playsinline="true"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)'
                    }}
                  />

                  {/* Top Live Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    color: '#2ecc71',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }} />
                    LIVE CAMERA
                  </div>

                  {/* Camera Loading Spinner */}
                  {cameraLoading && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.85)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: '#fff'
                    }}>
                      <div className="spinner" style={{ width: '28px', height: '28px', borderColor: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Starting camera...</span>
                    </div>
                  )}

                  {/* Face Guide Oval */}
                  {!cameraLoading && !cameraError && (
                    <div style={{
                      position: 'absolute',
                      width: '140px',
                      height: '170px',
                      borderRadius: '50%',
                      border: '2px dashed rgba(255, 255, 255, 0.45)',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>

                {/* Camera Warning if denied */}
                {cameraError && (
                  <div style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(243, 156, 18, 0.12)',
                    border: '1px solid #f39c12',
                    color: '#d35400',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    textAlign: 'center',
                    marginBottom: '14px'
                  }}>
                    ⚠️ {cameraError}
                  </div>
                )}

                {/* Primary: Snap Photo & Clock In */}
                <button
                  type="button"
                  disabled={actionLoading || cameraLoading}
                  onClick={() => {
                    const photo = captureAndCompressPhoto();
                    handleVerifyAndSubmitAttendance(enteredPin, photo);
                  }}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    marginBottom: '10px',
                    boxShadow: '0 6px 20px rgba(255, 107, 8, 0.3)',
                    cursor: (actionLoading || cameraLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {actionLoading ? '⏳ Clocking In...' : '📸 Snap Photo & Clock In'}
                </button>

                {/* Back to PIN button */}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    stopCameraStream();
                    setPinModal(prev => ({ ...prev, step: 'pin' }));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  ← Back to Change PIN
                </button>
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════ */
              /* STEP 1: 4-DIGIT ATTENDANCE PIN ENTRY                      */
              /* ═════════════════════════════════════════════════════════ */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: pinModal.action === 'check-out' ? 'rgba(231, 76, 60, 0.12)' : 'rgba(255, 107, 8, 0.12)',
                    color: pinModal.action === 'check-out' ? '#e74c3c' : 'var(--color-primary, #ff6b08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    marginBottom: '14px'
                  }}
                >
                  {pinModal.action === 'check-out' ? '⏹' : '🔒'}
                </div>

                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                  {pinModal.action === 'check-out' ? 'Confirm Check-Out' : 'Staff Check-In'}
                </h3>

                <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                  Enter the 4-digit PIN for <strong>{pinModal.staff?.name || activeStaffMember?.name}</strong>
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
                              handlePinComplete(nextPin);
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
                    onClick={closePinModal}
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
                    onClick={() => handlePinComplete(enteredPin)}
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
                      ? 'Verifying...' 
                      : pinModal.action === 'check-in' 
                        ? 'Next: Selfie 📸' 
                        : 'Confirm Check-Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;