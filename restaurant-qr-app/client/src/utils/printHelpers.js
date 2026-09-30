import API from '../services/api';

/**
 * ─────────────────────────────────────────────────────────────
 * BLUETOOTH THERMAL PRINTER DRIVER (Web Bluetooth API)
 * Seamlessly pairs with any portable 58mm / 80mm Bluetooth ESC/POS printer
 * Works 100% side-by-side with existing Wi-Fi / LAN cable printer!
 * ─────────────────────────────────────────────────────────────
 */
let bluetoothPrinterDevice = null;
let bluetoothPrinterCharacteristic = null;

// Standard ESC/POS Thermal Printer BLE Services & Characteristics
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common ESC/POS Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // PosBank / Xprinter
  '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // ISSC Transparent Service
];

const BLE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '49535343-8841-43f4-a8d4-ecbe34729bb3'
];

export const isBluetoothSupported = () => {
  return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
};

export const isBluetoothPrinterConnected = () => {
  return Boolean(
    bluetoothPrinterDevice &&
    bluetoothPrinterDevice.gatt &&
    bluetoothPrinterDevice.gatt.connected &&
    bluetoothPrinterCharacteristic
  );
};

export const getBluetoothPrinterName = () => {
  return bluetoothPrinterDevice ? (bluetoothPrinterDevice.name || 'Bluetooth Printer') : null;
};

/**
 * Connect to a nearby Bluetooth Thermal Printer via browser prompt
 */
export const connectBluetoothPrinter = async () => {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported on this browser/device. Please use Google Chrome or Chrome for Android.');
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICES
    });

    if (!device) throw new Error('No Bluetooth device selected.');

    const server = await device.gatt.connect();
    let foundChar = null;

    for (const serviceUuid of BLE_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        if (service) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              foundChar = char;
              break;
            }
          }
        }
        if (foundChar) break;
      } catch (e) {
        // Continue searching fallback services
      }
    }

    if (!foundChar) {
      // Fallback: search all available services
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            foundChar = char;
            break;
          }
        }
        if (foundChar) break;
      }
    }

    if (!foundChar) {
      throw new Error('Connected to Bluetooth device, but no writable print service found.');
    }

    bluetoothPrinterDevice = device;
    bluetoothPrinterCharacteristic = foundChar;

    device.addEventListener('gattserverdisconnected', () => {
      console.log('[PRINT] Bluetooth printer disconnected');
      bluetoothPrinterCharacteristic = null;
    });

    return {
      success: true,
      name: device.name || 'Bluetooth Thermal Printer'
    };
  } catch (err) {
    console.error('[PRINT] Bluetooth connection failed:', err);
    throw err;
  }
};

/**
 * Disconnect current Bluetooth printer
 */
export const disconnectBluetoothPrinter = () => {
  if (bluetoothPrinterDevice && bluetoothPrinterDevice.gatt && bluetoothPrinterDevice.gatt.connected) {
    bluetoothPrinterDevice.gatt.disconnect();
  }
  bluetoothPrinterDevice = null;
  bluetoothPrinterCharacteristic = null;
};

/**
 * Write raw ESC/POS byte chunks to Bluetooth characteristic
 */
export const printViaBluetooth = async (uint8ArrayData) => {
  if (!isBluetoothPrinterConnected()) {
    throw new Error('Bluetooth printer is not connected.');
  }

  // Write in 100-byte chunks to avoid BLE buffer saturation
  const CHUNK_SIZE = 100;
  for (let i = 0; i < uint8ArrayData.length; i += CHUNK_SIZE) {
    const chunk = uint8ArrayData.slice(i, i + CHUNK_SIZE);
    if (bluetoothPrinterCharacteristic.writeValueWithoutResponse) {
      await bluetoothPrinterCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await bluetoothPrinterCharacteristic.writeValue(chunk);
    }
    // Small delay between chunks for hardware reliability
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

/**
 * Converts Order and Receipt data into ESC/POS thermal printer bytes
 */
const formatESCPOSTicket = (order, type = 'POS', cafe = null, branch = null) => {
  const encoder = new TextEncoder();
  const bytes = [];

  const write = (str) => {
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) bytes.push(encoded[i]);
  };

  // ESC/POS Commands
  const ESC_INIT = [0x1B, 0x40];
  const ESC_ALIGN_LEFT = [0x1B, 0x61, 0x00];
  const ESC_ALIGN_CENTER = [0x1B, 0x61, 0x01];
  const ESC_BOLD_ON = [0x1B, 0x45, 0x01];
  const ESC_BOLD_OFF = [0x1B, 0x45, 0x00];
  const ESC_CUT = [0x1D, 0x56, 0x41, 0x03]; // Partial cut with feed
  const LF = 0x0A;

  bytes.push(...ESC_INIT);

  // 1. Header (Centered)
  bytes.push(...ESC_ALIGN_CENTER);
  bytes.push(...ESC_BOLD_ON);
  const cafeName = (order.cafeName || cafe?.name || 'DR . Chai Cafe').toUpperCase();
  write(`${cafeName}\n`);
  bytes.push(...ESC_BOLD_OFF);

  const branchAddress = order.branchAddress || branch?.address || cafe?.address || 'mangalagiri, Andhra Pradesh';
  write(`${branchAddress}\n`);
  if (order.cafeSupportNumber || cafe?.phone) {
    write(`Ph: ${order.cafeSupportNumber || cafe?.phone}\n`);
  }
  if (order.cafeGstNumber || cafe?.gstNumber) {
    write(`GSTIN: ${order.cafeGstNumber || cafe?.gstNumber}\n`);
  }
  write('--------------------------------\n');

  // 2. Title & Metadata
  bytes.push(...ESC_BOLD_ON);
  write(type === 'KOT' ? '*** KITCHEN ORDER TICKET (KOT) ***\n' : '*** TAX INVOICE / RECEIPT ***\n');
  bytes.push(...ESC_BOLD_OFF);

  bytes.push(...ESC_ALIGN_LEFT);
  const orderNum = order.orderNumber || (order._id ? order._id.slice(-6).toUpperCase() : 'N/A');
  write(`Order #: ${orderNum}\n`);
  write(`Table #: ${order.tableNumber || order.table || 'Counter'}\n`);
  write(`Date: ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN')}\n`);
  write('--------------------------------\n');

  // 3. Items Table
  write('ITEM                     QTY  AMT\n');
  write('--------------------------------\n');
  const items = order.items || [];
  for (const it of items) {
    const name = (it.name || it.itemName || 'Item').slice(0, 22).padEnd(23, ' ');
    const qty = String(it.quantity || 1).padStart(3, ' ');
    const price = Number(it.price || 0) * Number(it.quantity || 1);
    const amt = String(price.toFixed(0)).padStart(5, ' ');
    write(`${name}${qty}${amt}\n`);
  }
  write('--------------------------------\n');

  // 4. Totals (Right Aligned or Left structured)
  const total = Number(order.totalAmount || 0).toFixed(2);
  bytes.push(...ESC_BOLD_ON);
  write(`TOTAL AMOUNT:            Rs. ${total}\n`);
  bytes.push(...ESC_BOLD_OFF);
  write(`Payment Mode: ${order.paymentMethod || order.paymentMode || 'Cash'}\n`);
  write('--------------------------------\n');

  // 5. Footer
  bytes.push(...ESC_ALIGN_CENTER);
  write('Thank You! Visit Again!\n\n\n');
  bytes.push(LF, LF);
  bytes.push(...ESC_CUT);

  return new Uint8Array(bytes);
};

/**
 * ─────────────────────────────────────────────────────────────
 * Sends print job directly to local network printer bridge (HTTP / Port 8090)
 * Only attempted if running on localhost/LAN HTTP (Preserves Wi-Fi / LAN printer)
 * ─────────────────────────────────────────────────────────────
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
      cafeName: order.cafeName || cafe?.name || 'DR . Chai Cafe',
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
 * 1. Checks if Bluetooth printer is connected; prints directly via Web Bluetooth
 * 2. Tries local LAN bridge (Preserves 100% existing Wi-Fi / LAN cable printer)
 * 3. Emits cloud print job to Render Socket.IO for counter hardware printer
 */
export const printPOSReceipt = async (order, user = null, cafe = null, branch = null) => {
  if (!order) return;

  showPrintToast('🖨️ Printing POS Bill on Thermal Printer...');

  // 1. Direct Bluetooth print if user connected a portable Bluetooth printer
  if (isBluetoothPrinterConnected()) {
    try {
      const bytes = formatESCPOSTicket(order, 'POS', cafe, branch);
      await printViaBluetooth(bytes);
      console.log('[PRINT] POS receipt printed via Bluetooth successfully');
      showPrintToast('🖨️ Bill Printed via Bluetooth Printer!');
      return;
    } catch (btErr) {
      console.warn('[PRINT] Bluetooth print attempt error, falling back to Wi-Fi/LAN/Cloud:', btErr);
    }
  }

  // 2. Try local LAN bridge first if available (Preserves 100% existing Wi-Fi / LAN printer)
  const bridgeSuccess = await sendDirectToPrinterBridge(order, 'POS', cafe, branch);
  if (bridgeSuccess) {
    return;
  }

  // 3. Send to Render Cloud Socket Tunnel to trigger counter printer (Preserves 100% cloud printing)
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
 * 1. Checks if Bluetooth printer is connected; prints directly via Web Bluetooth
 * 2. Tries local LAN bridge (Preserves 100% existing Wi-Fi / LAN cable printer)
 * 3. Emits cloud print job to Render Socket.IO for kitchen hardware printer
 */
export const printKOT = async (order, user = null, cafe = null, branch = null) => {
  if (!order) return;

  showPrintToast('🍳 Printing KOT Kitchen Slip on Thermal Printer...');

  // 1. Direct Bluetooth print if user connected a portable Bluetooth printer
  if (isBluetoothPrinterConnected()) {
    try {
      const bytes = formatESCPOSTicket(order, 'KOT', cafe, branch);
      await printViaBluetooth(bytes);
      console.log('[PRINT] KOT slip printed via Bluetooth successfully');
      showPrintToast('🍳 KOT Slip Printed via Bluetooth Printer!');
      return;
    } catch (btErr) {
      console.warn('[PRINT] Bluetooth KOT attempt error, falling back to Wi-Fi/LAN/Cloud:', btErr);
    }
  }

  // 2. Try local LAN bridge first if available (Preserves 100% existing Wi-Fi / LAN printer)
  const bridgeSuccess = await sendDirectToPrinterBridge(order, 'KOT', cafe, branch);
  if (bridgeSuccess) {
    return;
  }

  // 3. Send to Render Cloud Socket Tunnel to trigger kitchen printer (Preserves 100% cloud printing)
  if (order._id) {
    try {
      await API.post(`/orders/${order._id}/print`, { type: 'KOT' });
      console.log('[PRINT] KOT print job emitted to cloud printer tunnel');
    } catch (err) {
      console.warn('[PRINT] Cloud KOT print notice:', err.message);
    }
  }
};
