import API, { getAssetUrl } from '../services/api';

export const printPOSReceipt = async (order, user = null, cafe = null, branch = null) => {
  try {
    const response = await API.post(`/orders/${order._id}/print`, { type: 'POS' });
    if (response.data?.success) {
      console.log('[PRINT] POS receipt sent to network printer successfully.');
      return;
    }
  } catch (err) {
    console.error('[PRINT] Failed to print POS receipt via network printer, falling back to browser print:', err.message);
  }

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
  const itemsSubtotal = order.items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const gstAmount = itemsSubtotal * (gstRate / 100);
  const grandTotal = order.totalAmount || (itemsSubtotal + gstAmount + platformCharge);

  const cafeName = order.cafeName || cafe?.name || 'Our Cafe';
  const displayBranchName = order.branchName || branch?.branchName || '';
  const displayAddress = order.branchAddress || branch?.address || cafe?.address || '';
  const displayContact = order.cafeSupportNumber || cafe?.phone || cafe?.contact || branch?.manager || '';
  const logoUrl = getAssetUrl(order.cafeLogo || cafe?.logoUrl || (cafe?.logo ? `/uploads/${cafe.logo}` : ''));
  const cafeGST = order.cafeGstNumber || cafe?.gstNumber || '';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${item.name}</td>
      <td style="padding: 6px 0; text-align: center; font-family: monospace; font-size: 12px;">${item.quantity}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px;">₹${item.price.toFixed(2)}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px;">₹${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${order._id.toUpperCase()}</title>
        <style>
          @page { size: auto; margin: 5mm; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            color: #000; 
            background: #fff; 
            margin: 0; 
            padding: 10px;
            font-size: 12px;
            line-height: 1.4;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .invoice-box {
            width: 100%;
            max-width: 80mm;
            padding: 5px;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .header { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .header h2 { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
          .header p { margin: 2px 0; font-size: 10px; }
          .info-table { width: 100%; margin-bottom: 10px; font-size: 11px; }
          .info-table td { padding: 2px 0; vertical-align: top; }
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .items-table th { border-bottom: 1px dashed #000; border-top: 1px dashed #000; padding: 5px 0; font-size: 11px; font-weight: bold; }
          .items-table td { padding: 4px 0; }
          .totals { border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; font-size: 11px; }
          .totals td { padding: 2px 0; }
          .footer { border-top: 1px dashed #000; padding-top: 8px; margin-top: 12px; font-size: 10px; }
          .footer p { margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header text-center">
            ${logoUrl ? `<div style="margin-bottom: 8px;"><img src="${logoUrl}" style="max-height: 45px; border-radius: 50%; object-fit: cover;" /></div>` : ''}
            <h2 style="font-size: 14px; margin-bottom: 2px;">${cafeName}</h2>
            <h3 style="font-size: 12px; margin: 0 0 4px 0; font-weight: normal;">${displayBranchName}</h3>
            <p>${displayAddress}</p>
            ${displayContact ? `<p>Contact: ${displayContact}</p>` : ''}
            <p class="bold">GSTIN: ${cafeGST}</p>
          </div>

          <table class="info-table">
            <tr>
              <td class="bold">Invoice No:</td>
              <td>${(order.invoiceId || order._id).toUpperCase()}</td>
            </tr>
            <tr>
              <td class="bold">Order No:</td>
              <td>#${(order.receiptId || order._id.slice(-6)).toUpperCase()}</td>
            </tr>
            <tr>
              <td class="bold">Date/Time:</td>
              <td>${new Date(order.createdAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="bold">Table:</td>
              <td>Table ${order.tableNumber}</td>
            </tr>
            <tr>
              <td class="bold">Customer:</td>
              <td>${order.customerName || 'Walk-in Customer'}</td>
            </tr>
            ${order.customerPhone ? `
            <tr>
              <td class="bold">Phone:</td>
              <td>${order.customerPhone}</td>
            </tr>` : ''}
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th>Qty</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table class="totals" style="width: 100%;">
            <tr>
              <td>Subtotal:</td>
              <td class="text-right">₹${itemsSubtotal.toFixed(2)}</td>
            </tr>
            ${gstRate > 0 ? `
            <tr>
              <td>CGST (${(gstRate / 2).toFixed(1)}%):</td>
              <td class="text-right">₹${(gstAmount / 2).toFixed(2)}</td>
            </tr>
            <tr>
              <td>SGST (${(gstRate / 2).toFixed(1)}%):</td>
              <td class="text-right">₹${(gstAmount / 2).toFixed(2)}</td>
            </tr>
            ` : ''}
            ${platformCharge > 0 ? `
            <tr>
              <td>Platform Charge:</td>
              <td class="text-right">₹${platformCharge.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="bold" style="font-size: 13px;">
              <td style="border-top: 1px dashed #000; padding-top: 4px;">GRAND TOTAL:</td>
              <td class="text-right" style="border-top: 1px dashed #000; padding-top: 4px;">₹${grandTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="font-size: 10px; color: #555;">Payment Method:</td>
              <td class="text-right bold" style="font-size: 10px;">${order.paymentMethod || 'Counter'}</td>
            </tr>
          </table>

          <div class="footer text-center">
            <p class="bold">Thank you for visiting us!</p>
            <p>Please share your valuable feedback.</p>
            <p style="font-size: 8px; margin-top: 10px; color: #555;">
              Printed By: ${user?.name || 'Cashier'} | Ref ID: ${order._id.substring(0, 8)}
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
  try {
    const response = await API.post(`/orders/${order._id}/print`, { type: 'KOT' });
    if (response.data?.success) {
      console.log('[PRINT] KOT sent to network printer successfully.');
      return;
    }
  } catch (err) {
    console.error('[PRINT] Failed to print KOT via network printer, falling back to browser print:', err.message);
  }

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

          ${order.specialInstructions ? `
          <div class="instructions-box">
            <div class="bold">⚠️ Special Instructions:</div>
            <div style="font-weight: bold; margin-top: 4px; font-size: 13px;">${order.specialInstructions}</div>
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

