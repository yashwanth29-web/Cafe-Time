const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '../../client/src/components/SaaSLayout.jsx'),
  path.join(__dirname, '../../client/src/pages/OwnerDashboard.jsx')
];

for (const file of targetFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace inline css values
    content = content.replace(/['"]#fff(?:fff)?['"]/gi, "'var(--color-text-primary)'");
    content = content.replace(/color:\s*#fff(?:fff)?/gi, "color: var(--color-text-primary)");
    
    // Specifically handle the bottom nav text and SVGs that might have been hardcoded
    // SVG stroke colors in SaaSLayout might use '#FFFFFF' which we replaced with var(--color-text-primary)
    
    // Check if any other weird whites exist
    content = content.replace(/['"]#FAF6F0['"]/gi, "'var(--color-text-primary)'");

    fs.writeFileSync(file, content);
    console.log(`Final color fix applied to ${path.basename(file)}`);
  }
}
