const http = require('http');
const net = require('net');

let ioClient;
try {
  ioClient = require('./server/node_modules/socket.io-client');
} catch (e) {
  try {
    ioClient = require('socket.io-client');
  } catch (err) {
    console.warn('[BRIDGE] socket.io-client not loaded, continuing in local HTTP mode only');
  }
}

const PRINTER_IP = process.env.PRINTER_IP || '192.168.0.101';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100', 10);
const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '8090', 10);
const CAFE_ID = process.env.CAFE_ID || 'CP007';

// Target cloud endpoints to listen for real-time print events (both URLs supported simultaneously)
const CLOUD_URLS = [
  process.env.CLOUD_URL,
  'https://cafe-time.onrender.com',
  'https://cafe-time-iqqb.onrender.com'
].filter(Boolean);

// Unique set of URLs
const UNIQUE_CLOUD_URLS = Array.from(new Set(CLOUD_URLS));

// ESC/POS Commands
const ESC = '\x1b';
const GS = '\x1d';
const LF = '\x0a';

const CMD_INIT = ESC + '@';
const CMD_ALIGN_LEFT = ESC + 'a\x00';
const CMD_ALIGN_CENTER = ESC + 'a\x01';
const CMD_ALIGN_RIGHT = ESC + 'a\x02';
const CMD_BOLD_ON = ESC + 'E\x01';
const CMD_BOLD_OFF = ESC + 'E\x00';
const CMD_FONT_NORMAL = GS + '!\x00';
const CMD_FONT_LARGE = GS + '!\x11'; // Double height and double width
const CMD_FEED_5 = ESC + 'd\x05';
const CMD_CUT = GS + 'V\x42\x00';

// Global In-Memory De-duplication Cache (prevents duplicate prints within 3 seconds)
const recentlyPrinted = new Map();
function shouldPrint(orderId, type) {
  if (!orderId) return true;
  const key = `${String(orderId)}_${type}`;
  const now = Date.now();
  if (recentlyPrinted.has(key)) {
    const lastTime = recentlyPrinted.get(key);
    if (now - lastTime < 3000) {
      console.log(`[BRIDGE] ⚠️ Ignored duplicate print trigger for order ${orderId} (${type}) within 3s`);
      return false;
    }
  }
  recentlyPrinted.set(key, now);
  if (recentlyPrinted.size > 200) {
    for (const [k, time] of recentlyPrinted.entries()) {
      if (now - time > 60000) recentlyPrinted.delete(k);
    }
  }
  return true;
}

function padLine(left, right, width = 48) {
  const spacesNeeded = width - (left.length + right.length);
  if (spacesNeeded <= 0) {
    return left.substring(0, width - right.length - 1) + ' ' + right;
  }
  return left + ' '.repeat(spacesNeeded) + right;
}

function formatItemRow(name, qty, price, total) {
  const nameWidth = 24;
  const qtyWidth = 6;
  const priceWidth = 8;
  const totalWidth = 10;

  const qtyStr = String(qty).padStart(qtyWidth);
  const priceStr = (typeof price === 'number' || !isNaN(Number(price)))
    ? parseFloat(price).toFixed(2).padStart(priceWidth)
    : String(price).padStart(priceWidth);
  const totalStr = (typeof total === 'number' || !isNaN(Number(total)))
    ? parseFloat(total).toFixed(2).padStart(totalWidth)
    : String(total).padStart(totalWidth);

  let nameStr = String(name || 'Item');
  if (nameStr.length > nameWidth) {
    nameStr = nameStr.substring(0, nameWidth - 3) + '...';
  } else {
    nameStr = nameStr.padEnd(nameWidth);
  }

  return `${nameStr}${qtyStr}${priceStr}${totalStr}`;
}

function formatKotItemRow(qty, name, notes = '', width = 48) {
  const qtyTag = `[${String(qty).padStart(2)}x] `;
  const maxNameLen = notes ? 26 : width - qtyTag.length;
  let itemName = String(name || 'Item');
  if (itemName.length > maxNameLen) {
    itemName = itemName.substring(0, maxNameLen - 3) + '...';
  }
  
  if (notes) {
    const leftPart = (qtyTag + itemName).padEnd(32);
    const notePart = `(${notes})`.substring(0, 15);
    return leftPart + notePart;
  }
  return qtyTag + itemName;
}

function compileReceiptBuffer(orderData, type = 'POS') {
  let commands = [];

  // Initialize printer
  commands.push(CMD_INIT);

  const cafeTitle = (orderData.cafeName || 'DR . Chai Cafe').toUpperCase();
  const branchText = orderData.branchName && orderData.branchName !== 'default' 
    ? `BRANCH: ${orderData.branchName.toUpperCase()}` 
    : 'BRANCH: CP007-B1';
  const addressText = orderData.branchAddress ? orderData.branchAddress.toUpperCase() : 'MANGALAGIRI';
  const gstinText = orderData.cafeGstNumber ? `GSTIN: ${orderData.cafeGstNumber}` : '';
  const dateObj = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
  const dateStr = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const totalAmount = parseFloat(orderData.grandTotal !== undefined ? orderData.grandTotal : (orderData.totalAmount || 0));
  const rawSubtotal = totalAmount / 1.05; // 5% inclusive GST base
  const taxableValue = parseFloat(rawSubtotal.toFixed(2));
  const totalGst = parseFloat((totalAmount - taxableValue).toFixed(2));

  if (type === 'KOT') {
    // ==================== KOT RECEIPT ====================
    commands.push(CMD_ALIGN_CENTER);
    commands.push('='.repeat(48) + LF);
    commands.push(CMD_FONT_LARGE);
    commands.push(CMD_BOLD_ON);
    commands.push(`*** ${cafeTitle} ***` + LF);
    commands.push(CMD_FONT_NORMAL);
    commands.push(CMD_BOLD_ON);
    commands.push('KOT' + LF);
    commands.push(CMD_BOLD_OFF);
    commands.push('-'.repeat(48) + LF);

    // KOT Meta (Table & Token prominently)
    commands.push(CMD_ALIGN_LEFT);
    commands.push(CMD_BOLD_ON);
    const tableStr = `TABLE: ${orderData.tableNumber || 'N/A'}`.padEnd(24);
    const tokenStr = `TOKEN: #${orderData.kotId || String(orderData.invoiceId || orderData._id || '').slice(-4).toUpperCase()}`;
    commands.push(tableStr + tokenStr + LF);
    
    if (orderData.customerName) {
      commands.push(`CUSTOMER: ${orderData.customerName}` + LF);
    }
    commands.push(CMD_BOLD_OFF);
    commands.push('='.repeat(48) + LF);

    // KOT Item Headers
    commands.push(CMD_BOLD_ON);
    commands.push(padLine('QTY   ITEM DESCRIPTION', 'NOTES', 48) + LF);
    commands.push(CMD_BOLD_OFF);
    commands.push('-'.repeat(48) + LF);

    // KOT Items
    const items = orderData.items || [];
    items.forEach(item => {
      const q = item.quantity || 1;
      const n = item.name || 'Item';
      const note = item.specialInstructions || item.note || item.notes || '';
      commands.push(CMD_BOLD_ON);
      commands.push(formatKotItemRow(q, n, note) + LF);
      commands.push(CMD_BOLD_OFF);
    });

    commands.push('-'.repeat(48) + LF);

    // Special Instructions
    const specialNotes = String(orderData.specialInstructions || orderData.notes || orderData.note || orderData.instructions || orderData.special_instructions || '').trim();
    if (specialNotes) {
      commands.push(CMD_BOLD_ON);
      commands.push('SPECIAL INSTRUCTIONS:' + LF);
      commands.push(`>> ${specialNotes}` + LF);
      commands.push(CMD_BOLD_OFF);
      commands.push('='.repeat(48) + LF);
    }

    // Bill Amount in KOT
    commands.push(CMD_BOLD_ON);
    commands.push(padLine('TOTAL AMOUNT:', `INR ${totalAmount.toFixed(2)}`) + LF);
    commands.push(CMD_BOLD_OFF);
    commands.push('='.repeat(48) + LF);

    // KOT Footer
    commands.push(CMD_ALIGN_CENTER);
    commands.push(CMD_BOLD_ON);
    commands.push('*** FOR KITCHEN USE ONLY ***' + LF);
    commands.push(CMD_BOLD_OFF);

  } else {
    // ==================== POS TAX INVOICE ====================
    commands.push(CMD_ALIGN_CENTER);
    commands.push('='.repeat(48) + LF);
    commands.push(CMD_FONT_LARGE);
    commands.push(CMD_BOLD_ON);
    commands.push(cafeTitle + LF);
    commands.push(CMD_FONT_NORMAL);
    commands.push(CMD_BOLD_OFF);
    commands.push('='.repeat(48) + LF);

    // Cafe & Branch Sub-header
    if (addressText) {
      commands.push(`${branchText}, ${addressText}` + LF);
    } else {
      commands.push(branchText + LF);
    }
    if (gstinText) {
      commands.push(gstinText + LF);
    }
    commands.push('-'.repeat(48) + LF);
    commands.push(CMD_BOLD_ON);
    commands.push('*** TAX INVOICE ***' + LF);
    commands.push(CMD_BOLD_OFF);
    commands.push('-'.repeat(48) + LF);

    // Bill Metadata
    commands.push(CMD_ALIGN_LEFT);
    const invoiceId = orderData.invoiceId || ('INV-' + String(orderData._id || '').slice(-6).toUpperCase());
    const tableNumber = orderData.tableNumber || 'N/A';
    commands.push(padLine(`Bill No  : ${invoiceId}`, `Date: ${dateStr}`) + LF);
    commands.push(padLine(`Table No : Table ${tableNumber}`, `Time: ${timeStr}`) + LF);
    if (orderData.customerName) {
      commands.push(`Customer : ${orderData.customerName}` + LF);
    }
    commands.push('-'.repeat(48) + LF);

    // Items Column Header
    commands.push(CMD_BOLD_ON);
    commands.push(formatItemRow('ITEM NAME', 'QTY', 'RATE', 'AMOUNT') + LF);
    commands.push(CMD_BOLD_OFF);
    commands.push('-'.repeat(48) + LF);

    // Items List (Inclusive GST Rate Breakdown)
    const items = orderData.items || [];
    items.forEach(item => {
      const q = item.quantity || 1;
      const rawPrice = item.price || 0;
      // Taxable rate per unit (without 5% GST)
      const baseUnitRate = rawPrice / 1.05;
      const lineBaseTotal = baseUnitRate * q;
      commands.push(formatItemRow(item.name || 'Item', q, baseUnitRate, lineBaseTotal) + LF);
    });

    commands.push('-'.repeat(48) + LF);

    // Tax Breakdown Summary (5% Inclusive GST)
    commands.push(CMD_ALIGN_RIGHT);
    commands.push(padLine('Subtotal (Taxable Value):', `INR ${taxableValue.toFixed(2)}`) + LF);
    commands.push(LF);
    commands.push(padLine('TOTAL GST (5% Included):', `INR ${totalGst.toFixed(2)}`) + LF);
    commands.push('='.repeat(48) + LF);

    // Grand Total (Big Bold)
    commands.push(CMD_BOLD_ON);
    commands.push(padLine('  GRAND TOTAL:', `INR ${totalAmount.toFixed(2)}`) + LF);
    commands.push(CMD_BOLD_OFF);
    commands.push('='.repeat(48) + LF);

    // Footer
    commands.push(CMD_ALIGN_CENTER);
    commands.push(LF);
    commands.push('Thank You for Dining With Us!' + LF);
    commands.push('Please Visit Again' + LF);
    commands.push('Powered by CafeTime Smart POS' + LF);
    commands.push('='.repeat(48) + LF);
  }

  // Feed and Cut
  commands.push(CMD_FEED_5);
  commands.push(CMD_CUT);

  return Buffer.from(commands.join(''), 'binary');
}

function sendToPrinter(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(4000);

    client.connect(port, ip, () => {
      client.write(buffer, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', (err) => {
      client.destroy();
      reject(err);
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Printer connection timed out'));
    });
  });
}

// 1. Setup Local HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', printerIp: PRINTER_IP, printerPort: PRINTER_PORT }));
    return;
  }

  if (req.url === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const orderData = payload.order || payload;
        const type = payload.type || 'POS';
        const orderId = orderData._id || orderData.id || orderData.invoiceId || '';

        if (!shouldPrint(orderId, type)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, message: 'Duplicate suppressed' }));
        }

        console.log(`[BRIDGE] Received local HTTP print job (${type}) for order ${orderId || 'N/A'}`);
        const buffer = compileReceiptBuffer(orderData, type);
        await sendToPrinter(PRINTER_IP, PRINTER_PORT, buffer);
        console.log(`[BRIDGE] Successfully printed (${type}) on ${PRINTER_IP}:${PRINTER_PORT}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Printed successfully' }));
      } catch (err) {
        console.error('[BRIDGE] Print error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(BRIDGE_PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🖨️  CAFE PRINTER BRIDGE RUNNING on port ${BRIDGE_PORT}`);
  console.log(`    Printer Destination: ${PRINTER_IP}:${PRINTER_PORT}`);
  console.log(`    Cloud Targets:       ${UNIQUE_CLOUD_URLS.join(', ')}`);
  console.log(`=======================================================`);
});

// 2. Setup Real-time Cloud Socket.IO Tunnel for all connected endpoints
if (ioClient) {
  UNIQUE_CLOUD_URLS.forEach((cloudUrl) => {
    function connectCloudSocket() {
      console.log(`[CLOUD TUNNEL] Connecting to cloud server at ${cloudUrl}...`);
      const socket = ioClient(cloudUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity
      });

      socket.on('connect', () => {
        console.log(`[CLOUD TUNNEL] ✅ Connected to Render Cloud (${cloudUrl})! Socket ID: ${socket.id}`);
        socket.emit('join_room', { cafeId: CAFE_ID, branchId: 'default' });
        socket.emit('join_room', { cafeId: CAFE_ID, branchId: 'CP007-B1' });
        socket.emit('join_room', { cafeId: CAFE_ID, branchId: 'all' });
        socket.emit('join_room', { cafeId: 'CD001', branchId: 'default' });
      });

      socket.on('print:job', async (data) => {
        try {
          const orderData = data.order || data;
          const type = data.type || 'POS';
          const orderId = orderData._id || orderData.id || orderData.invoiceId || '';

          if (!shouldPrint(orderId, type)) {
            return;
          }

          console.log(`[CLOUD TUNNEL] ⚡ Received cloud print job (${type}) from ${cloudUrl} for order ${orderId || 'N/A'}`);
          const buffer = compileReceiptBuffer(orderData, type);
          await sendToPrinter(PRINTER_IP, PRINTER_PORT, buffer);
          console.log(`[CLOUD TUNNEL] ✅ Printed successfully to RETSOL RTP-81 (${PRINTER_IP}:${PRINTER_PORT})!`);
        } catch (err) {
          console.error('[CLOUD TUNNEL] Print error:', err.message);
        }
      });

      socket.on('disconnect', (reason) => {
        console.warn(`[CLOUD TUNNEL] Disconnected from ${cloudUrl}: ${reason}. Will auto-reconnect...`);
      });

      socket.on('connect_error', (err) => {
        // Suppress noisy logs during network fluctuation
      });
    }

    connectCloudSocket();
  });
}
