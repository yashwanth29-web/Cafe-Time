import API, { getAssetUrl } from '../services/api';

/**
 * Sends print job directly to local network printer bridge (HTTP / Port 8090)
 * Only attempted if running on localhost/LAN HTTP (not blocked by HTTPS Mixed Content)
 */
export const sendDirectToPrinterBridge = async (order, type = 'POS', cafe = null, branch = null) => {
  if (window.location.protocol === 'https:') {
    return false; // Modern browsers block HTTP 8090 from HTTPS due to Mixed Content policy
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
      cafeName: order.cafeName || cafe?.name || 'Cafe',
      branchName: order.branchName || branch?.branchName || '',
      branchAddress: order.branchAddress || branch?.address || cafe?.address || '',
      cafeSupportNumber: order.cafeSupportNumber || cafe?.phone || cafe?.contact || '',
      cafeGstNumber: order.cafeGstNumber || cafe?.gstNumber || ''
    }
  };

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 350);

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
 * Prints Customer POS Receipt
 * 1. Emits cloud print job to Render Socket.IO for counter hardware printer
 * 2. Opens instant 80mm thermal print dialog on tablet/mobile/desktop
 */
export const printPOSReceipt = (order, user = null, cafe = null, branch = null) => {
  if (!order) return;

  // 1. Notify cloud bridge in background (Fire-and-forget)
  if (order._id) {
    API.post(`/orders/${order._id}/print`, { type: 'POS' }).catch(() => {});
  }

  const gstRate = cafe?.gstRate || 0;
  const platformCharge = cafe?.serviceChargeRate || 0;
  const itemsSubtotal = (order.items || []).reduce((acc, curr) => acc + (curr.price || 0) * (curr.quantity || 1), 0);
  const gstAmount = itemsSubtotal * (gstRate / 100);
  const grandTotal = order.totalAmount || (itemsSubtotal + gstAmount + platformCharge);

  const cafeName = order.cafeName || cafe?.name || 'DR.CAFE CHAI';
  const displayBranchName = order.branchName || branch?.branchName || 'Branch: CP007-B1';
  const displayAddress = order.branchAddress || branch?.address || cafe?.address || 'mangalagiri, Andhra Pradesh';
  const displayContact = order.cafeSupportNumber || cafe?.phone || cafe?.contact || branch?.manager || '';
  const logoUrl = getAssetUrl(order.cafeLogo || cafe?.logoUrl || (cafe?.logo ? `/uploads/${cafe.logo}` : ''));
  const cafeGST = order.cafeGstNumber || cafe?.gstNumber || '';
  const specialNotes = String(order.specialInstructions || order.notes || order.note || order.instructions || '').trim();

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding: 5px 0; font-family: monospace; font-size: 13px; font-weight: bold; text-align: left;">${item.name}</td>
      <td style="padding: 5px 0; text-align: center; font-family: monospace; font-size: 13px; font-weight: bold;">${item.quantity}</td>
      <td style="padding: 5px 0; text-align: right; font-family: monospace; font-size: 13px;">${(item.price || 0).toFixed(2)}</td>
      <td style="padding: 5px 0; text-align: right; font-family: monospace; font-size: 13px; font-weight: bold;">${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
    </tr>
  `).join('');

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Receipt - ${order.invoiceId || String(order._id || '').slice(-6).toUpperCase()}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            background: #fff;
            margin: 0 auto;
            padding: 8px;
            width: 100%;
            max-width: 80mm;
            font-size: 12px;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 17px; font-weight: 900; margin: 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta { font-size: 11px; margin: 2px 0; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px dashed #000; margin: 6px 0; }
          .notes-box {
            background: #f0f0f0;
            border: 1px solid #000;
            padding: 5px 8px;
            margin: 6px 0;
            font-size: 12.5px;
            font-weight: bold;
          }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          .flex-between { display: flex; justify-content: space-between; margin: 3px 0; }
          .grand-total { font-size: 16px; font-weight: 900; padding: 4px 0; }
          @media print {
            body { padding: 3mm 1mm; width: 76mm; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          ${logoUrl ? `<img src="${logoUrl}" style="max-height: 40px; margin-bottom: 4px;" alt="Logo" />` : ''}
          <div class="title">${cafeName}</div>
          ${displayBranchName ? `<div class="meta bold">${displayBranchName}</div>` : ''}
          ${displayAddress ? `<div class="meta">${displayAddress}</div>` : ''}
          ${displayContact ? `<div class="meta">Tel: ${displayContact}</div>` : ''}
          ${cafeGST ? `<div class="meta bold">GSTIN: ${cafeGST}</div>` : ''}
        </div>

        <div class="double-divider"></div>

        <div>
          <div class="flex-between">
            <span class="bold">Order ID:  ${order.invoiceId || 'INV-' + String(order._id || '').slice(-6).toUpperCase()}</span>
            <span class="bold">Table No: ${order.tableNumber || 'N/A'}</span>
          </div>
          <div class="flex-between meta">
            <span>Date/Time: ${new Date(order.createdAt || Date.now()).toLocaleDateString()}, ${new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="meta">Customer:  ${order.customerName || 'Guest Customer'}</div>
          ${specialNotes ? `<div class="notes-box">Notes:     ${specialNotes}</div>` : ''}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left; padding-bottom: 4px;">ITEM</th>
              <th style="text-align: center; padding-bottom: 4px;">QTY</th>
              <th style="text-align: right; padding-bottom: 4px;">PRICE</th>
              <th style="text-align: right; padding-bottom: 4px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div>
          <div class="flex-between">
            <span>Subtotal:</span>
            <span>${itemsSubtotal.toFixed(2)}</span>
          </div>
          ${gstRate > 0 ? `
            <div class="flex-between">
              <span>Tax / GST:</span>
              <span>${gstAmount.toFixed(2)}</span>
            </div>
          ` : `
            <div class="flex-between">
              <span>Tax / GST:</span>
              <span>0.00</span>
            </div>
          `}
          <div class="double-divider"></div>
          <div class="flex-between grand-total">
            <span>GRAND TOTAL:</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
          <div class="double-divider"></div>
        </div>

        <div class="center" style="margin-top: 10px;">
          <p class="bold" style="margin: 2px 0;">Thank you for ordering with us!</p>
          <p style="margin: 2px 0; font-size: 11px;">Please visit again.</p>
        </div>
      </body>
    </html>
  `;

  // Synchronously execute print
  let iframe = document.getElementById('receipt-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '300px';
    iframe.style.height = '300px';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-999';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(receiptHtml);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print execution error:', e);
    }
  }, 200);
};

/**
 * Prints Kitchen Order Ticket (KOT)
 * 1. Emits cloud print job to Render Socket.IO for kitchen hardware printer
 * 2. Opens instant 80mm KOT print dialog on tablet/mobile/desktop
 */
export const printKOT = (order, user = null, cafe = null, branch = null) => {
  if (!order) return;

  // 1. Notify cloud bridge in background (Fire-and-forget)
  if (order._id) {
    API.post(`/orders/${order._id}/print`, { type: 'KOT' }).catch(() => {});
  }

  const cafeName = order.cafeName || cafe?.name || 'DR.CAFE CHAI';
  const displayBranchName = order.branchName || branch?.branchName || 'Branch: CP007-B1';
  const displayAddress = order.branchAddress || branch?.address || cafe?.address || 'mangalagiri, Andhra Pradesh';
  const specialNotes = String(order.specialInstructions || order.notes || order.note || order.instructions || '').trim();

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding: 6px 0; font-size: 15px; font-weight: bold; font-family: monospace; text-align: left;">${item.name}</td>
      <td style="padding: 6px 0; text-align: center; font-size: 16px; font-weight: bold; font-family: monospace;">${item.quantity}</td>
      <td style="padding: 6px 0; text-align: right; font-size: 14px; font-family: monospace;">${(item.price || 0).toFixed(2)}</td>
      <td style="padding: 6px 0; text-align: right; font-size: 14px; font-weight: bold; font-family: monospace;">${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
    </tr>
  `).join('');

  const kotHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>KOT - ${order.kotId || String(order._id || '').slice(-6).toUpperCase()}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            background: #fff;
            margin: 0 auto;
            padding: 8px;
            width: 100%;
            max-width: 80mm;
            font-size: 12px;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 18px; font-weight: 900; margin: 4px 0; text-transform: uppercase; }
          .meta { font-size: 12px; margin: 2px 0; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px dashed #000; margin: 6px 0; }
          .notes-box {
            background: #e8e8e8;
            border: 2px solid #000;
            padding: 6px 8px;
            margin: 8px 0;
            font-size: 14px;
            font-weight: 900;
          }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .flex-between { display: flex; justify-content: space-between; margin: 3px 0; }
          .grand-total { font-size: 16px; font-weight: 900; padding: 4px 0; }
          @media print {
            body { padding: 3mm 1mm; width: 76mm; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">KITCHEN ORDER TICKET (KOT)</div>
          <div class="bold" style="font-size: 14px;">${cafeName}</div>
          ${displayBranchName ? `<div class="meta bold">${displayBranchName}</div>` : ''}
          ${displayAddress ? `<div class="meta">${displayAddress}</div>` : ''}
        </div>

        <div class="double-divider"></div>

        <div>
          <div class="flex-between">
            <span class="bold" style="font-size: 14px;">KOT No:   ${order.kotId || 'KOT-' + String(order._id || '').slice(-6).toUpperCase()}</span>
            <span class="bold" style="font-size: 14px;">Table No: ${order.tableNumber || 'N/A'}</span>
          </div>
          <div class="meta">Date/Time: ${new Date(order.createdAt || Date.now()).toLocaleDateString()}, ${new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="meta">Customer:  ${order.customerName || 'Guest Customer'}</div>
          ${specialNotes ? `<div class="notes-box">⚠️ Notes: ${specialNotes}</div>` : ''}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="text-align: left; padding-bottom: 4px; font-size: 13px;">ITEM</th>
              <th style="text-align: center; padding-bottom: 4px; font-size: 13px;">QTY</th>
              <th style="text-align: right; padding-bottom: 4px; font-size: 13px;">PRICE</th>
              <th style="text-align: right; padding-bottom: 4px; font-size: 13px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="double-divider"></div>

        <div class="flex-between grand-total">
          <span>GRAND TOTAL:</span>
          <span>${(order.totalAmount || order.grandTotal || 0).toFixed(2)}</span>
        </div>

        <div class="double-divider"></div>

        <div class="center" style="margin-top: 10px; font-weight: bold;">
          For Kitchen Use Only
        </div>
      </body>
    </html>
  `;

  // Synchronously execute print
  let iframe = document.getElementById('kot-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'kot-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '300px';
    iframe.style.height = '300px';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-999';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(kotHtml);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('KOT print execution error:', e);
    }
  }, 200);
};
