const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../../client/src/components/SaaSLayout.jsx');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  
  // Text colors
  content = content.replace(/color:\s*['"]#fff(?:fff)?['"]/gi, "color: 'var(--color-text-primary)'");
  
  // SVG stroke color logic
  content = content.replace(/const strokeColor = isActive \? '#FFFFFF' : 'rgba\(255, 255, 255, 0\.6\)';/g, "const strokeColor = isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';");
  
  // Backgrounds / Hovers
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.04\)/g, "rgba(0, 0, 0, 0.04)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.08\)/g, "rgba(0, 0, 0, 0.08)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.05\)/g, "rgba(0, 0, 0, 0.05)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.06\)/g, "rgba(0, 0, 0, 0.06)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.15\)/g, "rgba(0, 0, 0, 0.15)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.02\)/g, "rgba(0, 0, 0, 0.02)");
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.03\)/g, "rgba(0, 0, 0, 0.03)");

  fs.writeFileSync(targetFile, content);
  console.log('SaaSLayout updated.');
} else {
  console.log('File not found');
}
