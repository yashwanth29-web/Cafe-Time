const fs = require('fs');
const path = require('path');

const targetFiles = [
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
    
    // Replace color: '#fff' with color: 'var(--color-text-primary)'
    content = content.replace(/color:\s*['"]#fff(?:fff)?['"]/g, "color: 'var(--color-text-primary)'");
    
    // Replace color: '#FAF6F0' with color: 'var(--color-text-primary)'
    content = content.replace(/color:\s*['"]#FAF6F0['"]/gi, "color: 'var(--color-text-primary)'");
    
    // Replace background: '#121212' or '#1a1a1a' with var(--bg-secondary) etc if applicable
    // But mostly we just care about text colors.
    
    // Replace rgba(255,255,255,0.05) border bottoms with var(--color-border)
    content = content.replace(/1px solid rgba\(255,\s*255,\s*255,\s*0\.05\)/g, "1px solid var(--color-border)");
    
    // Any remaining #fff we should replace carefully.
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${path.basename(file)}`);
  }
}

console.log("Color replacement complete.");
