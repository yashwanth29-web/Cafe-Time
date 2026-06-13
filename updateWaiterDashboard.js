const fs = require('fs');
const path = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/WaiterDashboard.jsx';

let content = fs.readFileSync(path, 'utf8');

// Replace the filter line
const oldFilter = "const pendingCashPayments = orders.filter((o) => o.paymentStatus === 'Pending' && o.paymentMethod === 'Counter');";
const newFilter = "const awaitingPayments = orders.filter((o) => o.paymentStatus === 'Pending' && o.status === 'Delivered');";
content = content.replace(oldFilter, newFilter);

// Replace the UI block
const startMarker = "{/* Pending Cash Payments Column */}";
const endMarker = "{/* Ready for Service Column */}";
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const newUI = `        {/* Awaiting Payments Column */}
        {awaitingPayments.length > 0 &&
        <div style={{ marginBottom: '10px' }}>
            <h3 style={{ color: '#ff9800', fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 152, 0, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
              💵 Awaiting Payment ({awaitingPayments.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {awaitingPayments.map((order) => {
                const wantsCash = order.paymentMethod === 'Counter';
                return (
                  <div key={order._id} style={{
                    background: wantsCash ? 'rgba(255, 152, 0, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    border: wantsCash ? '2px dashed #ff9800' : '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>Table {order.tableNumber}</strong>
                        {wantsCash ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#fff',
                            background: '#e67e22',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            boxShadow: '0 0 6px rgba(230,126,34,0.5)'
                          }}>
                            🛎️ Customer wants to pay cash!
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: 'var(--color-text-secondary)',
                            background: 'rgba(0,0,0,0.05)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)'
                          }}>
                            ⏳ Eating / Unpaid
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#A0826C', display: 'block', marginTop: '4px' }}>
                        Order #{order._id.substring(order._id.length - 4).toUpperCase()} | Total: <strong style={{ color: '#2ecc71' }}>₹{order.totalAmount}</strong>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', display: 'block', marginTop: '2px' }}>
                        {order.items.map((it) => \`\${it.quantity}x \${it.name}\`).join(', ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => printPOSReceipt(order, user, cafeInfo)}
                        className="touch-btn"
                        style={{
                          background: '#2980B9',
                          color: '#fff',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          border: 'none',
                          minHeight: '44px'
                        }}>
                        🖨️ Print POS
                      </button>
                      <button
                        onClick={() => handleMarkPaid(order._id)}
                        className="touch-btn"
                        style={{
                          background: '#27AE60',
                          color: '#fff',
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          border: 'none',
                          minHeight: '44px'
                        }}>
                        💵 Mark Paid
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }

        `;
  
  content = content.substring(0, startIdx) + newUI + content.substring(endIdx);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Success");
} else {
  console.log("Markers not found");
}
