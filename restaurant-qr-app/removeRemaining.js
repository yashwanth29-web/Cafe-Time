const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');

const filesToProcess = [
  'OwnerDashboard.jsx',
  'WaiterDashboard.jsx',
  'CashierDashboard.jsx',
  'ManagerDashboard.jsx',
  'KitchenDashboard.jsx'
];

filesToProcess.forEach(file => {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Remove the invisible emoji variation selector (U+FE0F)
  content = content.replace(/\uFE0F/g, '');

  // Remove some more overly verbose text if missed
  content = content.replace(/<p style={{ margin: '4px 0 0 0', color: 'var\(--color-text-secondary\)', fontSize: '0.85rem' }}>\s*<\/p>/g, '');
  
  // Clean up "Refresh in: Xs" in WaiterDashboard
  content = content.replace(/<div style={{ fontSize: '13px', color: 'var\(--color-text-secondary\)', background: 'rgba\(0, 0, 0,0.03\)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var\(--color-border\)' }}>\s*Refresh in:<strong style={{ color: 'var\(--color-primary\)' }}>\{refreshCountdown\}s<\/strong>\s*<\/div>/g, '');

  // Clean up "Refresh in" in ManagerDashboard
  content = content.replace(/<div style={{ fontSize: '13px', color: 'var\(--color-text-secondary\)', background: 'rgba\(0, 0, 0,0.03\)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var\(--color-border\)' }}>\s*Refresh in:<strong style={{ color: 'var\(--color-primary\)' }}>\{refreshCountdown\}s<\/strong>\s*<\/div>/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned up ${file}`);
  }
});
