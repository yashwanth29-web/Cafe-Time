const net = require('net');

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
const CMD_FEED_5 = ESC + 'd\x05'; // Feed 5 lines
const CMD_CUT = GS + 'V\x42\x00'; // Feed 0 and cut

/**
 * Format left and right text to fit a specific width (default 48 characters)
 */
function padLine(left, right, width = 48) {
  const spacesNeeded = width - (left.length + right.length);
  if (spacesNeeded <= 0) {
    return left.substring(0, width - right.length - 1) + ' ' + right;
  }
  return left + ' '.repeat(spacesNeeded) + right;
}

/**
 * Formats a single item row in a 4-column layout for POS (Total width = 48 chars)
 * Name: 24 chars, Qty: 6 chars, Rate: 8 chars, Amount: 10 chars
 */
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

/**
 * Formats a KOT item row with quantity and optional modifier/note
 */
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

/**
 * Compiles the ESC/POS binary buffer for receipt printing
 */
function compileReceiptBuffer(orderData, type = 'POS') {
  let commands = [];

  // Initialize printer
  commands.push(CMD_INIT);

  const cafeTitle = (orderData.cafeName || 'DR . Chai Cafe').toUpperCase();
  const branchText = orderData.branchName && orderData.branchName !== 'default' 
    ? `BRANCH: ${orderData.branchName.toUpperCase()}` 
    : 'BRANCH: CP007-B1';
  const addressText = orderData.branchAddress ? orderData.branchAddress.toUpperCase() : '';
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

  // Convert to latin1 Buffer to preserve exact ESC/POS command sequences
  return Buffer.from(commands.join(''), 'latin1');
}

/**
 * printReceipt(orderData, type)
 * Connects to the network printer via TCP socket and prints a receipt.
 * 
 * @param {Object} orderData - The order details
 * @param {string} type - 'POS' or 'KOT' (default 'POS')
 * @returns {Promise<boolean>} Resolves to true if printed successfully, false otherwise
 */
async function printReceipt(orderData, type = 'POS') {
  const printerIp = process.env.PRINTER_IP || '192.168.0.101';
  const printerPort = parseInt(process.env.PRINTER_PORT || '9100', 10);

  console.log(`[PRINTER SERVICE] Initiating print job (${type}) for order ${orderData.invoiceId || orderData._id || 'N/A'} to ${printerIp}:${printerPort}`);

  try {
    const rawBuffer = compileReceiptBuffer(orderData, type);

    await sendToPrinter(printerIp, printerPort, rawBuffer);
    console.log(`[PRINTER SERVICE] Print job (${type}) completed successfully for order ${orderData.invoiceId || orderData._id || 'N/A'}`);
    return true;
  } catch (error) {
    console.error(`[PRINTER SERVICE] Failed to print receipt (${type}) for order ${orderData.invoiceId || orderData._id || 'N/A'}. Error:`, error.message);
    return false;
  }
}

/**
 * Sends buffer to printer over TCP socket
 */
function sendToPrinter(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    // Set connection timeout (5 seconds)
    client.setTimeout(5000);

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
      reject(new Error('Connection timed out'));
    });
  });
}

module.exports = {
  printReceipt
};
