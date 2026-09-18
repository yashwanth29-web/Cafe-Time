import API from '../services/api';

/**
 * Sends print job directly to local network printer bridge (HTTP / Port 8090)
 * Only attempted if running on localhost/LAN HTTP
 */
export const sendDirectToPrinterBridge = async (order, type = 'POS', cafe = null, branch = null) => {
  if (window.location.protocol === 'https:') {
    return false; // Prevent mixed-content blocking on HTTPS
  }

  const savedUrl = localStorage.getItem('printerBridgeUrl');
  const candidateUrls = [
    savedUrl,
    'http://127.0.0.1:8090/print',
    'http://localhost:8090/print'
  ].filter(Boolean);

  const payload = {
    type,
    order: {
      ...order,
      cafeName: order.cafeName || cafe?.name || 'DR.CAFE CHAI',
      branchName: order.branchName || branch?.branchName || 'CP007-B1',
      branchAddress: order.branchAddress || branch?.address || cafe?.address || 'mangalagiri, Andhra Pradesh',
      cafeSupportNumber: order.cafeSupportNumber || cafe?.phone || cafe?.contact || '',
      cafeGstNumber: order.cafeGstNumber || cafe?.gstNumber || ''
    }
  };

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 400);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log(`[PRINT] Direct thermal print (${type}) succeeded via bridge: ${url}`);
          localStorage.setItem('printerBridgeUrl', url);
          return true;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  return false;
};

/**
 * Helper to show non-intrusive toast feedback on tablet
 */
const showPrintToast = (message) => {
  let toast = document.getElementById('print-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'print-toast-notification';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.backgroundColor = '#2c3e50';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    toast.style.zIndex = '999999';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = 'bold';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.transition = 'all 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }
  }, 2500);
};

/**
 * Prints Customer POS Receipt
 * 1. Emits cloud print job to Render Socket.IO for counter hardware printer
 * 2. Tries local LAN bridge if on same Wi-Fi
 * 3. Shows instant success toast on screen
 */
export const printPOSReceipt = async (order, user = null, cafe = null, branch = null) => {
  if (!order) return;

  showPrintToast('🖨️ Printing POS Bill on Thermal Printer...');

  // 1. Try local LAN bridge first if available
  const bridgeSuccess = await sendDirectToPrinterBridge(order, 'POS', cafe, branch);
  if (bridgeSuccess) {
    return;
  }

  // 2. Send to Render Cloud Socket Tunnel to trigger counter printer
  if (order._id) {
    try {
      await API.post(`/orders/${order._id}/print`, { type: 'POS' });
      console.log('[PRINT] POS print job emitted to cloud printer tunnel');
    } catch (err) {
      console.warn('[PRINT] Cloud print notice:', err.message);
    }
  }
};

/**
 * Prints Kitchen Order Ticket (KOT)
 * 1. Emits cloud print job to Render Socket.IO for kitchen hardware printer
 * 2. Tries local LAN bridge if on same Wi-Fi
 * 3. Shows instant success toast on screen
 */
export const printKOT = async (order, user = null, cafe = null, branch = null) => {
  if (!order) return;

  showPrintToast('🍳 Printing KOT Kitchen Slip on Thermal Printer...');

  // 1. Try local LAN bridge first if available
  const bridgeSuccess = await sendDirectToPrinterBridge(order, 'KOT', cafe, branch);
  if (bridgeSuccess) {
    return;
  }

  // 2. Send to Render Cloud Socket Tunnel to trigger kitchen printer
  if (order._id) {
    try {
      await API.post(`/orders/${order._id}/print`, { type: 'KOT' });
      console.log('[PRINT] KOT print job emitted to cloud printer tunnel');
    } catch (err) {
      console.warn('[PRINT] Cloud KOT print notice:', err.message);
    }
  }
};
