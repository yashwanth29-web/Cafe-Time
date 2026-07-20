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
 * Formats a single item row in a 4-column layout (Total width = 48 chars)
 * Name: 25 chars, Qty: 5 chars, Price: 8 chars, Total: 10 chars
 */
function formatItemRow(name, qty, price, total) {
  const nameWidth = 25;
  const qtyWidth = 5;
  const priceWidth = 8;
  const totalWidth = 10;

  // Format quantities and prices as strings
  const qtyStr = String(qty).padStart(qtyWidth);
  const priceStr = (typeof price === 'number' || !isNaN(Number(price))) 
    ? parseFloat(price).toFixed(2).padStart(priceWidth) 
    : String(price).padStart(priceWidth);
  const totalStr = (typeof total === 'number' || !isNaN(Number(total))) 
    ? parseFloat(total).toFixed(2).padStart(totalWidth) 
    : String(total).padStart(totalWidth);

  // If item name is too long, truncate it
  let nameStr = name;
  if (nameStr.length > nameWidth) {
    nameStr = nameStr.substring(0, nameWidth - 3) + '...';
  } else {
    nameStr = nameStr.padEnd(nameWidth);
  }

  return `${nameStr}${qtyStr}${priceStr}${totalStr}`;
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
 * Compiles the ESC/POS binary buffer for receipt printing
 */
function compileReceiptBuffer(orderData, type = 'POS') {
  let commands = [];

  // Initialize
  commands.push(CMD_INIT);

  // 1. Header Section
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

  // Branch Name / Address if available
  if (orderData.branchName && orderData.branchName !== 'default') {
    commands.push(`Branch: ${orderData.branchName}` + LF);
  }
  if (orderData.branchAddress) {
    commands.push(orderData.branchAddress + LF);
  }
  
  commands.push('='.repeat(48) + LF);

  // 2. Order Metadata
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
  if (orderData.customerPhone) {
    commands.push(`Phone:     ${orderData.customerPhone}` + LF);
  }
  
  commands.push('-'.repeat(48) + LF);

  // 3. Ordered Items Headers
  // Name: 25 chars, Qty: 5 chars, Price: 8 chars, Total: 10 chars
  const headerCol = formatItemRow('ITEM', 'QTY', 'PRICE', 'TOTAL');
  commands.push(CMD_BOLD_ON);
  commands.push(headerCol + LF);
  commands.push(CMD_BOLD_OFF);
  commands.push('-'.repeat(48) + LF);

  // 4. Ordered Items
  const items = orderData.items || [];
  items.forEach(item => {
    const itemTotal = item.quantity * item.price;
    commands.push(formatItemRow(item.name || 'Item', item.quantity, item.price, itemTotal) + LF);
  });

  commands.push('-'.repeat(48) + LF);

  // 5. Total and breakdown
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

  // Footer / Thank you
  commands.push(CMD_ALIGN_CENTER);
  if (type === 'KOT') {
    commands.push('For Kitchen Use Only' + LF);
  } else {
    commands.push('Thank you for ordering with us!' + LF);
    commands.push('Please visit again.' + LF);
  }

  // Feed and Cut
  commands.push(CMD_FEED_5);
  commands.push(CMD_CUT);

  // Convert to latin1 Buffer to preserve exact ESC/POS command sequences
  return Buffer.from(commands.join(''), 'latin1');
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
