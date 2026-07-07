const fs = require('fs');
let code = fs.readFileSync('c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/SuperAdminDashboard.jsx', 'utf8');

const replacements = [
  { from: /'<div ([^>]+)><HeartPulse size={20} \/> System Diagnostics & Node Health<\/div>'/g, to: "<div $1><HeartPulse size={20} /> System Diagnostics & Node Health</div>" },
  { from: /'<div ([^>]+)><Ticket size={20} \/> Cafe Support Center<\/div>'/g, to: "<div $1><Ticket size={20} /> Cafe Support Center</div>" },
  { from: /'<div ([^>]+)><Banknote size={20} \/> Revenue Monitoring & SaaS Analytics<\/div>'/g, to: "<div $1><Banknote size={20} /> Revenue Monitoring & SaaS Analytics</div>" },
  { from: /'<div ([^>]+)><Building size={20} \/> Multi-Branch Monitor<\/div>'/g, to: "<div $1><Building size={20} /> Multi-Branch Monitor</div>" },
  { from: /'<span ([^>]+)><AlertCircle size={14} \/> \$\{health\.printerFailures\} Failures<\/span>'/g, to: "<span $1><AlertCircle size={14} /> {health.printerFailures} Failures</span>" },
  { from: /'<span ([^>]+)><AlertCircle size={14} \/> \$\{health\.paymentFailures\} Failed<\/span>'/g, to: "<span $1><AlertCircle size={14} /> {health.paymentFailures} Failed</span>" },
  { from: /'<div ([^>]+)><Plus size={16} \/> Register Cafe<\/div>'/g, to: "<div $1><Plus size={16} /> Register Cafe</div>" },
  { from: /'<div ([^>]+)><X size={16} \/> Close Form<\/div>'/g, to: "<div $1><X size={16} /> Close Form</div>" },
  { from: /'<span ([^>]+)>Completed <CheckCircle size={12} \/><\/span>'/g, to: "<span $1>Completed <CheckCircle size={12} /></span>" },
  { from: /'<span ([^>]+)>Pending <RefreshCw size={12} \/><\/span>'/g, to: "<span $1>Pending <RefreshCw size={12} /></span>" },
  { from: /'<span ([^>]+)>Normal <CheckCircle size={12} \/><\/span>'/g, to: "<span $1>Normal <CheckCircle size={12} /></span>" },
  { from: /'<div ([^>]+)><CreditCard size={20} \/> Subscription Management<\/div>'/g, to: "<div $1><CreditCard size={20} /> Subscription Management</div>" }
];

replacements.forEach(r => {
  code = code.replace(r.from, r.to);
});

// Also fix the Close buttons that became empty `<button...></button>` due to stripping `X`
code = code.replace(/(<button[^>]*>)(<\/button>)/g, (match, p1, p2) => {
  // If it's a modal close button
  if (p1.includes('setSelectedCafeForDetails(null)') || p1.includes('setEditingCafe(null)') || p1.includes('setEditingSubscriptionCafe(null)')) {
    return p1 + "<X size={20} />" + p2;
  }
  return match;
});

// Also replace `<Building size={12} style={{ marginRight: '4px', display: 'inline' }} />` that were placed inside quotes
code = code.replace(/'<Building size=\{12\} style=\{\{ marginRight: \\'4px\\', display: \\'inline\\' \}\} \/> '/g, "<Building size={12} style={{ marginRight: '4px', display: 'inline' }} /> ");

fs.writeFileSync('c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/SuperAdminDashboard.jsx', code);
console.log('Fixed syntax strings.');
