export const printPOSReceipt = (order, user = null) => {
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (!printWindow) {
    alert('Popup blocker prevented printing receipt. Please allow popups.');
    return;
  }
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 4px 0; font-family: monospace;">${item.name}</td>
      <td style="padding: 4px 0; text-align: center; font-family: monospace;">${item.quantity}</td>
      <td style="padding: 4px 0; text-align: right; font-family: monospace;">₹${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Print POS Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; color: #000; background: #fff; font-size: 12px; }
          h2, p { text-align: center; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { border-bottom: 1px dashed #000; border-top: 1px dashed #000; padding: 5px 0; }
          .total-section { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; text-align: right; font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <h2>COFFEE DAY CAFE</h2>
        <p style="font-size: 10px;">123 Cafe Street, Onboarding City</p>
        <p style="font-size: 10px;">Table: Table ${order.tableNumber}</p>
        <p style="font-size: 10px;">Date: ${new Date(order.createdAt).toLocaleString()}</p>
        <p style="font-size: 9px;">Order ID: ${order._id.toUpperCase()}</p>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th>Qty</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total-section">
          TOTAL: ₹${order.totalAmount.toFixed(2)}
        </div>
        <p style="text-align: center; margin-top: 20px; font-size: 10px; font-weight: bold;">
          Thank you for dining with us!
        </p>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const printKOT = (order) => {
  const printWindow = window.open('', '_blank', 'width=350,height=500');
  if (!printWindow) {
    alert('Popup blocker prevented printing KOT. Please allow popups.');
    return;
  }
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 6px 0; font-size: 16px; font-weight: bold; font-family: monospace;">${item.name}</td>
      <td style="padding: 6px 0; text-align: center; font-size: 18px; font-weight: bold; font-family: monospace;">${item.quantity}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Print KOT</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; color: #000; background: #fff; font-size: 14px; }
          h2, p { text-align: center; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 5px 0; }
        </style>
      </head>
      <body>
        <h2 style="font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 5px;">KOT - KITCHEN TICKET</h2>
        <p style="font-size: 16px; font-weight: bold;">Table: Table ${order.tableNumber}</p>
        <p style="font-size: 12px;">Date: ${new Date(order.createdAt).toLocaleString()}</p>
        <p style="font-size: 11px;">Order ID: ${order._id.substring(order._id.length - 6).toUpperCase()}</p>
        <table>
          <thead>
            <tr>
              <th style="text-align: left; font-size: 14px;">Item Name</th>
              <th style="font-size: 14px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <p style="text-align: center; margin-top: 20px; font-size: 11px; border-top: 1px dashed #000; padding-top: 5px;">
          CoffeeDay Cafe Kitchen
        </p>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
