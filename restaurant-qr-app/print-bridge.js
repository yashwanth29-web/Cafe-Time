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
const CLOUD_URL = process.env.CLOUD_URL || 'https://cafe-time-iqqb.onrender.com';
const CAFE_ID = process.env.CAFE_ID || 'CP007';

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

  let nameStr = name || 'Item';
  if (nameStr.length > nameWidth) {
    nameStr = nameStr.substring(0, nameWidth - 3) + '...';
  } else {
    nameStr = nameStr.padEnd(nameWidth);
  }

  return `${nameStr}${qtyStr}${priceStr}${totalStr}`;
}

function compileReceiptBuffer(orderData, type = 'POS') {
  let commands = [];

  commands.push(CMD_INIT);
  commands.push(CMD_ALIGN_CENTER);
  commands.push(CMD_FONT_LARGE);
  commands.push(CMD_BOLD_ON);

  if (type === 'KOT') {
    commands.push('KITCHEN ORDER TICKET (KOT)' + LF);
    commands.push(CMD_FONT_NORMAL);
    commands.push(CMD_BOLD_OFF);
    commands.push((orderData.cafeName || 'Cafe').toUpperCase() + LF);
  } else {
    commands.push((orderData.cafeName || 'Cafe').toUpperCase() + LF);
    commands.push(CMD_FONT_NORMAL);
    commands.push(CMD_BOLD_OFF);
  }

  if (orderData.branchName && orderData.branchName !== 'default') {
    commands.push(`Branch: ${orderData.branchName}` + LF);
  }
  if (orderData.branchAddress) {
    commands.push(orderData.branchAddress + LF);
  }

  commands.push('='.repeat(48) + LF);

  commands.push(CMD_ALIGN_LEFT);
  commands.push(CMD_BOLD_ON);

  if (type === 'KOT') {
    commands.push(`KOT No:    ${orderData.kotId || 'KOT-' + String(orderData._id || '').slice(-6).toUpperCase()}` + LF);
  } else {
    commands.push(`Order ID:  ${orderData.invoiceId || orderData._id || 'N/A'}` + LF);
  }

  commands.push(`Table No:  ${orderData.tableNumber || 'N/A'}` + LF);
  commands.push(CMD_BOLD_OFF);

  const orderDate = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
  commands.push(`Date/Time: ${orderDate.toLocaleString()}` + LF);

  if (orderData.customerName) {
    commands.push(`Customer:  ${orderData.customerName}` + LF);
  }
  const specialNotes = String(orderData.specialInstructions || orderData.notes || orderData.note || orderData.instructions || orderData.special_instructions || '').trim();
  if (specialNotes) {
    commands.push(CMD_BOLD_ON);
    commands.push(`Notes:     ${specialNotes}` + LF);
    commands.push(CMD_BOLD_OFF);
  }

  commands.push('-'.repeat(48) + LF);

  const headerCol = formatItemRow('ITEM', 'QTY', 'PRICE', 'TOTAL');
  commands.push(CMD_BOLD_ON);
  commands.push(headerCol + LF);
  commands.push(CMD_BOLD_OFF);
  commands.push('-'.repeat(48) + LF);

  const items = orderData.items || [];
  items.forEach(item => {
    const itemTotal = (item.quantity || 1) * (item.price || 0);
    commands.push(formatItemRow(item.name || 'Item', item.quantity || 1, item.price || 0, itemTotal) + LF);
  });

  commands.push('-'.repeat(48) + LF);

  commands.push(CMD_ALIGN_RIGHT);

  if (type !== 'KOT') {
    if (orderData.subtotal !== undefined) {
      commands.push(padLine('Subtotal:', parseFloat(orderData.subtotal).toFixed(2)) + LF);
    }
    if (orderData.tax !== undefined) {
      commands.push(padLine('Tax / GST:', parseFloat(orderData.tax).toFixed(2)) + LF);
    }
  }

  commands.push(CMD_BOLD_ON);
  const grandTotal = orderData.grandTotal !== undefined ? orderData.grandTotal : orderData.totalAmount;
  commands.push(padLine('GRAND TOTAL:', parseFloat(grandTotal || 0).toFixed(2)) + LF);
  commands.push(CMD_BOLD_OFF);

  commands.push('='.repeat(48) + LF);

  commands.push(CMD_ALIGN_CENTER);
  if (type === 'KOT') {
    commands.push('For Kitchen Use Only' + LF);
  } else {
    commands.push('Thank you for ordering with us!' + LF);
    commands.push('Please visit again.' + LF);
  }

  commands.push(CMD_FEED_5);
  commands.push(CMD_CUT);

  return Buffer.from(commands.join(''), 'latin1');
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

        console.log(`[BRIDGE] Received local HTTP print job (${type}) for order ${orderData._id || 'N/A'}`);
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
  console.log(`    Cloud Tunnel Target: ${CLOUD_URL}`);
  console.log(`=======================================================`);
});

// 2. Setup Real-time Cloud Socket.IO Tunnel to Render
if (ioClient) {
  function connectCloudSocket() {
    console.log(`[CLOUD TUNNEL] Connecting to cloud server at ${CLOUD_URL}...`);
    const socket = ioClient(CLOUD_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity
    });

    socket.on('connect', () => {
      console.log(`[CLOUD TUNNEL] ✅ Connected to Render Cloud! Tunnel Socket ID: ${socket.id}`);
      socket.emit('join_room', { cafeId: CAFE_ID, branchId: 'default' });
    });

    socket.on('print:job', async (data) => {
      try {
        const orderData = data.order || data;
        const type = data.type || 'POS';
        console.log(`[CLOUD TUNNEL] ⚡ Received cloud print job (${type}) for order ${orderData._id || 'N/A'}`);
        const buffer = compileReceiptBuffer(orderData, type);
        await sendToPrinter(PRINTER_IP, PRINTER_PORT, buffer);
        console.log(`[CLOUD TUNNEL] ✅ Printed successfully to RETSOL RTP-81!`);
      } catch (err) {
        console.error('[CLOUD TUNNEL] Print error:', err.message);
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[CLOUD TUNNEL] Disconnected from cloud server: ${reason}. Will auto-reconnect...`);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[CLOUD TUNNEL] Connection attempt notice: ${err.message}`);
    });
  }

  connectCloudSocket();
}
