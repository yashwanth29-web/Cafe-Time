const fs = require('fs');
const path = require('path');

const compDir = path.join(__dirname, '../../client/src/components');
if (fs.existsSync(compDir)) {
  const files = fs.readdirSync(compDir).filter(f => f.endsWith('.jsx'));
  for (const file of files) {
    const filePath = path.join(compDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    content = content.replace(/color:\s*['"]#fff(?:fff)?['"]/gi, "color: 'var(--color-text-primary)'");
    content = content.replace(/color:\s*['"]#FAF6F0['"]/gi, "color: 'var(--color-text-primary)'");
    content = content.replace(/color:\s*['"]#E6D5C3['"]/gi, "color: 'var(--color-text-secondary)'");
    content = content.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,[^)]+\)['"]/gi, "color: 'var(--color-text-secondary)'");
    content = content.replace(/color:\s*['"]white['"]/gi, "color: 'var(--color-text-primary)'");
    content = content.replace(/color:\s*#fff(?:fff)?;/gi, 'color: var(--color-text-primary);');
    content = content.replace(/color:\s*#FAF6F0;/gi, 'color: var(--color-text-primary);');
    content = content.replace(/color:\s*#E6D5C3;/gi, 'color: var(--color-text-secondary);');
    content = content.replace(/color:\s*white;/gi, 'color: var(--color-text-primary);');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Updated ' + file);
    }
  }
}
