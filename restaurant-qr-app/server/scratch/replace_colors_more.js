const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '../../client/src/pages/OwnerProfilePage.jsx'),
  path.join(__dirname, '../../client/src/pages/OrderHistory.jsx'),
  path.join(__dirname, '../../client/src/pages/OwnerDashboard.jsx'),
  path.join(__dirname, '../../client/src/pages/ManagerDashboard.jsx'),
  path.join(__dirname, '../../client/src/pages/WaiterDashboard.jsx'),
  path.join(__dirname, '../../client/src/pages/SuperAdminDashboard.jsx'),
  path.join(__dirname, '../../client/src/pages/KitchenDashboard.jsx'),
  path.join(__dirname, '../../client/src/pages/CashierDashboard.jsx'),
  path.join(__dirname, '../../client/src/pages/StaffDashboard.jsx')
];

for (const file of targetFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace hardcoded light CSS values in styles and JSX
    content = content.replace(/color:\s*['"]#fff(?:fff)?['"]/gi, "color: 'var(--color-text-primary)'");
    content = content.replace(/color:\s*['"]#FAF6F0['"]/gi, "color: 'var(--color-text-primary)'");
    content = content.replace(/color:\s*['"]#E6D5C3['"]/gi, "color: 'var(--color-text-secondary)'");
    content = content.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,[^)]+\)['"]/gi, "color: 'var(--color-text-secondary)'");
    content = content.replace(/color:\s*['"]white['"]/gi, "color: 'var(--color-text-primary)'");
    content = content.replace(/1px solid rgba\(255,\s*255,\s*255,\s*0\.\d+\)/g, "1px solid var(--color-border)");
    content = content.replace(/border(?:-[^:]+)?:\s*['"][^'"]*rgba\(255,\s*255,\s*255,\s*0\.\d+\)[^'"]*['"]/g, "borderColor: 'var(--color-border)'");
    
    // Replacements for raw CSS within <style> tags
    content = content.replace(/color:\s*#fff(?:fff)?;/gi, 'color: var(--color-text-primary);');
    content = content.replace(/color:\s*#FAF6F0;/gi, 'color: var(--color-text-primary);');
    content = content.replace(/color:\s*#E6D5C3;/gi, 'color: var(--color-text-secondary);');
    content = content.replace(/color:\s*white;/gi, 'color: var(--color-text-primary);');
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + path.basename(file));
  }
}
