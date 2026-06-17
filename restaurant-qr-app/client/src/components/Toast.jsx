import React, { useState, useEffect, createContext, useContext } from 'react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

// Global fallback object so we can import 'toast' directly
export const toast = {
  success: (msg, dur) => window.toast?.success(msg, dur) || console.log('success:', msg),
  error: (msg, dur) => window.toast?.error(msg, dur) || console.error('error:', msg),
  warning: (msg, dur) => window.toast?.warning(msg, dur) || console.warn('warning:', msg),
  info: (msg, dur) => window.toast?.info(msg, dur) || console.log('info:', msg),
};

export const confirm = (msg) => window.toast?.confirm(msg) || Promise.resolve(true);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const handleConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  };

  const toastMethods = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
    confirm: handleConfirm,
  };

  // Expose to window and override window.alert
  useEffect(() => {
    window.toast = toastMethods;
    window.alert = (msg) => {
      const lower = (msg || '').toLowerCase();
      if (lower.includes('success') || lower.includes('complete') || lower.includes('saved') || lower.includes('registered') || lower.includes('created') || lower.includes('updated')) {
        toastMethods.success(msg);
      } else if (lower.includes('fail') || lower.includes('error') || lower.includes('invalid') || lower.includes('cannot') || lower.includes('denied') || lower.includes('required')) {
        toastMethods.error(msg);
      } else if (lower.includes('warning') || lower.includes('alert') || lower.includes('reorder') || lower.includes('shortage') || lower.includes('low')) {
        toastMethods.warning(msg);
      } else {
        toastMethods.info(msg);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      
      {confirmDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifycontent: 'center',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          `}</style>
          <div style={{
            background: '#1C2420',
            border: '1px solid rgba(143, 168, 155, 0.2)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            fontFamily: "'Outfit', sans-serif",
            animation: 'scaleUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#F8F5F0', fontSize: '1.1rem', fontWeight: 800 }}>Confirm Action</h4>
            <p style={{ margin: '0 0 24px 0', color: '#B4C4B9', fontSize: '0.9rem', lineHeight: '1.5' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }} 
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(143, 168, 155, 0.2)',
                  color: '#B4C4B9',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmDialog.resolve(true);
                  setConfirmDialog(null);
                }} 
                style={{
                  background: '#8FA89B',
                  border: 'none',
                  color: '#121815',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '350px',
      width: '100%',
      pointerEvents: 'none'
    }}>
      <style>{`
        @keyframes toast-in-right {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast-item {
          animation: toast-in-right 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15) forwards;
          pointer-events: auto;
          transition: all 0.25s ease;
        }
      `}</style>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: '#2ecc71',
          icon: '✅'
        };
      case 'error':
        return {
          bg: '#e74c3c',
          icon: '❌'
        };
      case 'warning':
        return {
          bg: '#f1c40f',
          icon: '⚠️'
        };
      case 'info':
      default:
        return {
          bg: '#3498db',
          icon: 'ℹ️'
        };
    }
  };

  const colors = getColors();

  return (
    <div className="toast-item" style={{
      backgroundColor: '#1E1E1E',
      color: '#FFFFFF',
      borderLeft: `5px solid ${colors.bg}`,
      borderRadius: '10px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontFamily: "'Outfit', sans-serif",
      fontSize: '14px',
      lineHeight: '1.4',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center' }}>{colors.icon}</span>
        <span>{toast.message}</span>
      </div>
      <button onClick={onClose} style={{
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.4)',
        cursor: 'pointer',
        fontSize: '18px',
        padding: 0,
        lineHeight: 1
      }}
      onMouseEnter={(e) => e.target.style.color = '#FFF'}
      onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.4)'}>
        ×
      </button>
    </div>
  );
};
