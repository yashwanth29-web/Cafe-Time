const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../../client/src/styles/App.css');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Fix Layout CSS classes for Light Theme
  content = content.replace(/\.mh-name\s*\{[^}]*color:\s*#fff[^}]*\}/g, ".mh-name { font-size: 16px; font-weight: 900; color: var(--color-text-primary); letter-spacing: -0.3px; }");
  content = content.replace(/\.mh-icon-btn\s*\{[^}]*color:\s*#E6D5C3[^}]*\}/g, ".mh-icon-btn {\n  width: 40px; height: 40px; border-radius: 50%;\n  background: rgba(0,0,0,0.03);\n  border: 1px solid rgba(0,0,0,0.05);\n  display: flex; align-items: center; justify-content: center;\n  cursor: pointer; font-size: 16px; color: var(--color-text-primary);\n  transition: all 0.2s; position: relative;\n}");
  content = content.replace(/\.mh-avatar\s*\{[^}]*color:\s*#fff[^}]*\}/g, ".mh-avatar {\n  width: 36px; height: 36px; border-radius: 50%;\n  background: var(--color-text-primary); color: var(--bg-primary);\n  display: flex; align-items: center; justify-content: center;\n  font-weight: 800; font-size: 14px;\n  border: 2px solid var(--color-border); cursor: pointer;\n}");
  content = content.replace(/\.hamburger-btn\s*\{[^}]*color:\s*#E6D5C3[^}]*\}/g, ".hamburger-btn {\n  display: none;\n  width: 40px; height: 40px; border-radius: 8px;\n  background: rgba(0,0,0,0.03);\n  border: 1px solid rgba(0,0,0,0.05);\n  color: var(--color-text-primary); font-size: 18px; cursor: pointer;\n  align-items: center; justify-content: center;\n}");
  
  content = content.replace(/\.bnav-icon\s*\{[^}]*color:\s*rgba\(255,\s*255,\s*255,\s*0\.6\)[^}]*\}/g, ".bnav-icon {\n  width: 40px; height: 36px;\n  display: flex; align-items: center; justify-content: center;\n  border-radius: 10px;\n  font-size: 20px;\n  transition: all 0.2s ease;\n  color: var(--color-text-secondary);\n}");
  content = content.replace(/\.bnav-label\s*\{[^}]*color:\s*rgba\(255,\s*255,\s*255,\s*0\.5\)[^}]*\}/g, ".bnav-label {\n  font-size: 10px; font-weight: 600;\n  color: var(--color-text-secondary);\n  transition: color 0.2s ease;\n  white-space: nowrap;\n  letter-spacing: 0.2px;\n}");
  content = content.replace(/\.bnav-item\.active\s*\.bnav-icon\s*\{[^}]*color:\s*#FFFFFF[^}]*\}/g, ".bnav-item.active .bnav-icon {\n  background: rgba(194, 125, 95, 0.15);\n  color: var(--color-text-primary);\n}");
  
  // Let's also fix the border colors for these headers/footers
  content = content.replace(/border-bottom:\s*1px solid #2d2d2d;/g, "border-bottom: 1px solid var(--color-border);");
  content = content.replace(/border-top:\s*1px solid #2d2d2d;/g, "border-top: 1px solid var(--color-border);");
  content = content.replace(/border-right:\s*1px solid #2d2d2d;/g, "border-right: 1px solid var(--color-border);");

  fs.writeFileSync(targetFile, content);
  console.log('App.css layout classes updated.');
} else {
  console.log('File not found');
}
