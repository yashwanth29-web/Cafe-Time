export const printPOSReceipt = (order, user = null, cafe = null) => {
  const printWindow = window.open('', '_blank', 'width=450,height=700');
  if (!printWindow) {
    alert('Popup blocker prevented printing receipt. Please allow popups.');
    return;
  }

  // Inclusive GST Calculations (5% standard GST for cafes)
  const grandTotal = order.totalAmount || 0;
  const subtotal = grandTotal / 1.05;
  const gstAmount = grandTotal - subtotal;

  const cafeName = cafe?.name || 'Dr. Chai Cafe';
  const cafeAddress = cafe?.address || 'Main Road, Near Metro Station, Hyderabad';
  const cafeGST = cafe?.gstNumber || '36AAAAA1111A1Z1';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${item.name}</td>
      <td style="padding: 6px 0; text-align: center; font-family: monospace; font-size: 12px;">${item.quantity}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px;">₹${item.price.toFixed(2)}</td>
      <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 12px;">₹${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
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
          }
          .invoice-box {
            max-width: 80mm;
            margin: 0 auto;
            padding: 5px;
          }
          /* A4 scale support */
          @media screen and (min-width: 600px) {
            .invoice-box {
              max-width: 100mm;
              border: 1px solid #ccc;
              padding: 20px;
              border-radius: 5px;
              margin-top: 20px;
            }
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
          
          /* Control panel for screen preview */
          .no-print {
            background: #f1f1f1;
            padding: 10px;
            text-align: center;
            border-bottom: 1px solid #ccc;
            margin-bottom: 15px;
          }
          .print-btn {
            background: #27ae60;
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
          }
          .print-btn:hover { background: #2196f3; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
            .invoice-box { border: none; max-width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="print-btn" onclick="window.print()">🖨️ Print / Download PDF</button>
        </div>
        <div class="invoice-box">
          <div class="header text-center">
            <h2>${cafeName}</h2>
            <p>${cafeAddress}</p>
            <p class="bold">GSTIN: ${cafeGST}</p>
          </div>

          <table class="info-table">
            <tr>
              <td class="bold">Invoice No:</td>
              <td>${order._id.toUpperCase()}</td>
            </tr>
            <tr>
              <td class="bold">Order No:</td>
              <td>#${order._id.slice(-6).toUpperCase()}</td>
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
              <td>Subtotal (Tax Excl.):</td>
              <td class="text-right">₹${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>CGST (2.5%):</td>
              <td class="text-right">₹${(gstAmount / 2).toFixed(2)}</td>
            </tr>
            <tr>
              <td>SGST (2.5%):</td>
              <td class="text-right">₹${(gstAmount / 2).toFixed(2)}</td>
            </tr>
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
  printWindow.document.close();
};

export const printKOT = (order, user = null, cafe = null) => {
  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (!printWindow) {
    alert('Popup blocker prevented printing KOT. Please allow popups.');
    return;
  }

  const cafeName = cafe?.name || 'Dr. Chai Cafe';
  const branchName = user?.assignedBranch || cafe?.city || 'Main Branch';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 8px 0; font-size: 16px; font-weight: bold; font-family: monospace;">${item.name}</td>
      <td style="padding: 8px 0; text-align: center; font-size: 18px; font-weight: bold; font-family: monospace;">${item.quantity}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
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
          }
          .kot-box {
            max-width: 80mm;
            margin: 0 auto;
          }
          @media screen and (min-width: 600px) {
            .kot-box {
              max-width: 90mm;
              border: 2px solid #000;
              padding: 15px;
            }
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
          .no-print {
            background: #f1f1f1;
            padding: 10px;
            text-align: center;
            border-bottom: 1px solid #ccc;
            margin-bottom: 15px;
          }
          .print-btn {
            background: #000;
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
          }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
            .kot-box { border: none; max-width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="print-btn" onclick="window.print()">🖨️ Print KOT</button>
        </div>
        <div class="kot-box">
          <div class="header text-center">
            <h2>KITCHEN ORDER TICKET (KOT)</h2>
            <p class="bold" style="font-size: 14px;">${cafeName}</p>
            <p>${branchName ? `Branch: ${branchName}` : ''}</p>
          </div>

          <table class="meta-table">
            <tr>
              <td class="bold">KOT No:</td>
              <td>#${order._id.slice(-6).toUpperCase()}</td>
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
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
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
  printWindow.document.close();
};
