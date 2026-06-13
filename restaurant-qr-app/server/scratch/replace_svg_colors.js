const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, '../../client/src/pages'),
  path.join(__dirname, '../../client/src/components')
];

for (const d of dirs) {
  if (fs.existsSync(d)) {
    const files = fs.readdirSync(d).filter(f => f.endsWith('.jsx'));
    for (const file of files) {
      const filePath = path.join(d, file);
      let content = fs.readFileSync(filePath, 'utf8');
      let original = content;
      
      // Fix svg fill and stroke colors
      content = content.replace(/fill=['"]#fff(?:fff)?['"]/gi, "fill='var(--color-text-primary)'");
      content = content.replace(/fill=['"]#FAF6F0['"]/gi, "fill='var(--color-text-primary)'");
      content = content.replace(/fill=['"]#E6D5C3['"]/gi, "fill='var(--color-text-secondary)'");
      
      content = content.replace(/stroke=['"]#fff(?:fff)?['"]/gi, "stroke='var(--color-text-primary)'");
      content = content.replace(/stroke=['"]#FAF6F0['"]/gi, "stroke='var(--color-text-primary)'");
      content = content.replace(/stroke=['"]#E6D5C3['"]/gi, "stroke='var(--color-text-secondary)'");
      
      if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Updated ' + file + ' SVGs');
      }
    }
  }
}
