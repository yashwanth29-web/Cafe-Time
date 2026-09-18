import API, { getAssetUrl } from '../services/api';

/**
 * Sends print job directly to local network printer bridge (HTTP / Port 8090)
 * Tries localhost, tablet IP, and cafe counter laptop IP.
 */
export const sendDirectToPrinterBridge = async (order, type = 'POS', cafe = null, branch = null) => {
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
      // Continue to next candidate or fallback
    }
  }

  return false;
};

export const printPOSReceipt = async (order, user = null, cafe = null, branch = null) => {
  // Fire server notification in background for cloud listeners
  if (order._id) {
    API.post(`/orders/${order._id}/print`, { type: 'POS' }).catch(() => {});
  }

  // 1. Try direct local Printer Bridge on Wi-Fi (Instant 0.1s silent print)
  const bridgeSuccess = await sendDirectToPrinterBridge(order, 'POS', cafe, branch);
  if (bridgeSuccess) {
    return;
  }

  // 2. Direct Tablet / Phone Browser System Print Dialog (80mm Thermal Receipt)
  let iframe = document.getElementById('receipt-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
  }

  const gstRate = cafe?.gstRate || 0;
  const platformCharge = cafe?.serviceChargeRate || 0;
  const itemsSubtotal = (order.items || []).reduce((acc, curr) => acc + (curr.price || 0) * (curr.quantity || 1), 0);
  const gstAmount = itemsSubtotal * (gstRate / 100);
  const grandTotal = order.totalAmount || (itemsSubtotal + gstAmount + platformCharge);

  const cafeName = order.cafeName || cafe?.name || 'Our Cafe';
  const displayBranchName = order.branchName || branch?.branchName || '';
  const displayAddress = order.branchAddress || branch?.address || cafe?.address || '';
  const displayContact = order.cafeSupportNumber || cafe?.phone || cafe?.contact || branch?.manager || '';
  const logoUrl = getAssetUrl(order.cafeLogo || cafe?.logoUrl || (cafe?.logo ? `/uploads/${cafe.logo}` : ''));
  const cafeGST = order.cafeGstNumber || cafe?.gstNumber || '';

  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${item.name}</td>
      <td style="padding: 6px 0; text-align: center; font-family: monospace; font-size: 12px;">${item.quantity}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px;">₹${(item.price || 0).toFixed(2)}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px;">₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
    </tr>
  `).join('');

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${String(order._id || '').toUpperCase()}</title>
        <style>
          @page { size: auto; margin: 5mm; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            color: #000; 
            margin: 0; 
            padding: 10px;
            font-size: 12px;
            line-height: 1.2;
          }
          .receipt-container { width: 100%; max-width: 80mm; margin: 0 auto; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header-title { font-size: 16px; margin: 4px 0; text-transform: uppercase; font-weight: 900; }
          .logo { max-height: 45px; max-width: 120px; object-fit: contain; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          .flex-between { display: flex; justify-content: space-between; margin: 3px 0; }
          .meta-text { font-size: 11px; margin: 2px 0; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="center">
            ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : ''}
            <div class="header-title">${cafeName}</div>
            ${displayBranchName ? `<div class="meta-text bold">${displayBranchName}</div>` : ''}
            ${displayAddress ? `<div class="meta-text">${displayAddress}</div>` : ''}
            ${displayContact ? `<div class="meta-text">Tel: ${displayContact}</div>` : ''}
            ${cafeGST ? `<div class="meta-text bold">GSTIN: ${cafeGST}</div>` : ''}
          </div>

          <div class="divider"></div>

          <div>
            <div class="flex-between">
              <span class="bold">INVOICE: #${order.invoiceId || String(order._id || '').substring(0, 8).toUpperCase()}</span>
              <span class="bold">TABLE: ${order.tableNumber || 'N/A'}</span>
            </div>
            <div class="flex-between">
              <span>Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</span>
              <span>Time: ${new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            ${(order.specialInstructions || order.notes || order.note || order.instructions) ? `<div class="meta-text bold" style="margin-top: 4px; padding: 3px 6px; background: #f0f0f0; border-radius: 4px;">📝 Note: ${(order.specialInstructions || order.notes || order.note || order.instructions)}</div>` : ''}
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; padding-bottom: 4px;">ITEM</th>
                <th style="text-align: center; padding-bottom: 4px;">QTY</th>
                <th style="text-align: right; padding-bottom: 4px;">PRICE</th>
                <th style="text-align: right; padding-bottom: 4px;">AMT</th>
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
              <span>₹${itemsSubtotal.toFixed(2)}</span>
            </div>
            ${gstRate > 0 ? `
              <div class="flex-between">
                <span>GST (${gstRate}%):</span>
                <span>₹${gstAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${platformCharge > 0 ? `
              <div class="flex-between">
                <span>Platform Fee:</span>
                <span>₹${platformCharge.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="double-divider"></div>
            <div class="flex-between" style="font-size: 15px; font-weight: 900;">
              <span>GRAND TOTAL:</span>
              <span>₹${grandTotal.toFixed(2)}</span>
            </div>
            <div class="double-divider"></div>
            <div class="flex-between meta-text">
              <span>Payment Mode:</span>
              <span class="bold">${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'PENDING'}</span>
            </div>
            <div class="flex-between meta-text">
              <span>Payment Status:</span>
              <span class="bold">${order.paymentStatus ? order.paymentStatus.toUpperCase() : 'UNPAID'}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="center" style="margin-top: 10px;">
            <p class="bold" style="margin: 2px 0;">THANK YOU FOR VISITING!</p>
            <p style="margin: 2px 0; font-size: 10px;">Please visit us again soon.</p>
            <p style="font-size: 8px; margin-top: 10px; color: #555;">
              Printed By: ${user?.name || 'Cashier'} | Ref ID: ${String(order._id || '').substring(0, 8)}
            </p>
          </div>
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 300);
};

export const printKOT = async (order, user = null, cafe = null, branch = null) => {
  // Fire server notification in background for cloud listeners
  if (order._id) {
    API.post(`/orders/${order._id}/print`, { type: 'KOT' }).catch(() => {});
  }

  // 1. Try direct local Printer Bridge on Wi-Fi (Instant 0.1s silent print)
  const bridgeSuccess = await sendDirectToPrinterBridge(order, 'KOT', cafe, branch);
  if (bridgeSuccess) {
    return;
  }

  // 2. Direct Tablet / Phone Browser System Print Dialog (80mm KOT Ticket)
  let iframe = document.getElementById('kot-print-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'kot-print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
  }

  const cafeName = order.cafeName || cafe?.name || 'Our Cafe';
  const displayBranchName = order.branchName || branch?.branchName || '';
  const displayAddress = order.branchAddress || branch?.address || cafe?.address || '';
  const displayContact = order.cafeSupportNumber || cafe?.phone || cafe?.contact || branch?.manager || '';
  const logoUrl = getAssetUrl(order.cafeLogo || cafe?.logoUrl || (cafe?.logo ? `/uploads/${cafe.logo}` : ''));

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 8px 0; font-size: 16px; font-weight: bold; font-family: monospace;">${item.name}</td>
      <td style="padding: 8px 0; text-align: center; font-size: 18px; font-weight: bold; font-family: monospace;">${item.quantity}</td>
      <td style="padding: 8px 0; text-align: right; font-size: 16px; font-weight: bold; font-family: monospace;">₹${item.price.toFixed(2)}</td>
      <td style="padding: 8px 0; text-align: right; font-size: 16px; font-weight: bold; font-family: monospace;">₹${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KOT - ${order._id.slice(-6).toUpperCase()}</title>
        <style>
          @page { size: auto; margin: 5mm; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            color: #000; 
            background: #fff; 
            margin: 0; 
            padding: 10px;
            font-size: 13px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .kot-box {
            width: 100%;
            max-width: 80mm;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px; }
          .header h2 { margin: 0; font-size: 18px; font-weight: bold; }
          .header p { margin: 3px 0; font-size: 11px; }
          .meta-table { width: 100%; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 12px; }
          .meta-table td { padding: 1px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .items-table th { border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 6px 0; font-size: 13px; font-weight: bold; }
          .instructions-box {
            background: #f5f5f5;
            border: 1px dashed #000;
            padding: 8px;
            margin-top: 10px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="kot-box">
          <div class="header text-center">
            <h2>KITCHEN ORDER TICKET (KOT)</h2>
            <p class="bold" style="font-size: 14px; margin: 4px 0 2px 0;">${cafeName}</p>
            <p class="bold" style="font-size: 12px; margin: 0 0 4px 0;">${displayBranchName}</p>
            <p style="font-size: 9px; color: #555; margin: 2px 0;">${displayAddress}</p>
            ${displayContact ? `<p style="font-size: 9px; color: #555; margin: 2px 0;">Contact: ${displayContact}</p>` : ''}
            ${logoUrl ? `<div style="margin-top: 6px;"><img src="${logoUrl}" style="max-height: 35px; border-radius: 50%; object-fit: cover;" /></div>` : ''}
          </div>

          <table class="meta-table">
            <tr>
              <td class="bold">KOT No:</td>
              <td>${(order.kotId || ('KOT-' + order._id.slice(-6))).toUpperCase()}</td>
            </tr>
            <tr>
              <td class="bold">Table No:</td>
              <td class="bold" style="font-size: 15px;">Table ${order.tableNumber}</td>
            </tr>
            <tr>
              <td class="bold">Date/Time:</td>
              <td>${new Date(order.createdAt).toLocaleDateString()} ${new Date(order.createdAt).toLocaleTimeString()}</td>
            </tr>
            <tr>
              <td class="bold">Customer:</td>
              <td>${order.customerName || 'Walk-in'}</td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">Item Name</th>
                <th>Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr>
                <td colspan="3" style="border-top: 1px dashed #000; padding: 6px 0; font-weight: bold;">GRAND TOTAL:</td>
                <td style="border-top: 1px dashed #000; padding: 6px 0; text-align: right; font-weight: bold; font-family: monospace; font-size: 16px;">₹${(order.totalAmount || order.grandTotal || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          ${(order.specialInstructions || order.notes || order.note || order.instructions) ? `
          <div class="instructions-box">
            <div class="bold">⚠️ Special Instructions:</div>
            <div style="font-weight: bold; margin-top: 4px; font-size: 13px;">${(order.specialInstructions || order.notes || order.note || order.instructions)}</div>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 15px; font-size: 10px; border-top: 1px solid #000; padding-top: 6px;">
            Printed By: ${user?.name || 'System Staff'}
          </div>
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 300);
};

