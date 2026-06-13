const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;

const directories = [
  path.join(__dirname, '../../client/src/pages'),
  path.join(__dirname, '../../client/src/components')
];

// Dark colors that require white text
const darkBackgrounds = [
  '#E74C3C', '#e74c3c', // Red
  '#33271c', '#33271C', // Dark Brown
  '#27ae60', '#27AE60', '#2ECC71', // Green
  'var(--color-primary)', '#C27D5F', // Primary Terracotta
  '#F1C40F', '#f1c40f', // Warning/Yellow (sometimes light, but we keep white if they explicitly put it on dark warning)
  '#6F4E37', // Brown
  '#1F140E', // Darker brown
  '#3D2820', // Dark
  '#3f3f3f', '#333' // Greys
];

function isDarkBackground(bgString) {
  if (!bgString) return false;
  // If it's a transparent white overlay used as hover in dark mode, it's not a dark background, it's light now
  if (bgString.includes('rgba(255') || bgString.includes('rgba(255, 255, 255')) return false;
  if (bgString.includes('transparent') || bgString.includes('none')) return false;
  
  for (const dark of darkBackgrounds) {
    if (bgString.includes(dark)) return true;
  }
  
  // Also check if it's a dark RGBA (like black or dark grey)
  if (bgString.includes('rgba(0') || bgString.includes('rgba(0, 0, 0, 0.8)')) return true;
  
  return false;
}

function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  // Parse code into AST
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e);
    return;
  }

  let changed = false;

  traverse(ast, {
    ObjectExpression(path) {
      const properties = path.node.properties;
      let bgColor = null;
      
      // First pass: find background color
      for (const prop of properties) {
        if (prop.type === 'ObjectProperty' && prop.key && (prop.key.name === 'background' || prop.key.name === 'backgroundColor')) {
          if (prop.value.type === 'StringLiteral') {
            bgColor = prop.value.value;
          } else if (prop.value.type === 'TemplateLiteral') {
            // Very simplified check for template literals
            bgColor = prop.value.quasis.map(q => q.value.raw).join('');
          }
        }
      }

      // Second pass: process colors and transparent backgrounds
      for (const prop of properties) {
        if (prop.type === 'ObjectProperty' && prop.key) {
          
          // Fix transparent white backgrounds (used for dark mode hovers) -> transparent black
          if ((prop.key.name === 'background' || prop.key.name === 'backgroundColor' || prop.key.name === 'border' || prop.key.name === 'borderBottom' || prop.key.name === 'borderTop') && prop.value.type === 'StringLiteral') {
            if (prop.value.value.includes('rgba(255, 255, 255') || prop.value.value.includes('rgba(255,255,255')) {
              prop.value.value = prop.value.value.replace(/rgba\(255,\s*255,\s*255/g, 'rgba(0, 0, 0');
              changed = true;
            }
          }

          // Fix text colors
          if (prop.key.name === 'color') {
            const isDark = isDarkBackground(bgColor);
            
            if (prop.value.type === 'StringLiteral') {
              const val = prop.value.value.toLowerCase();
              if (val === '#fff' || val === '#ffffff' || val === 'white' || val === '#faf6f0') {
                if (!isDark) {
                  prop.value.value = 'var(--color-text-primary)';
                  changed = true;
                } else {
                  // Ensure it is pure #fff so it looks crisp on dark background
                  prop.value.value = '#fff'; 
                  changed = true;
                }
              } else if (val === 'var(--color-text-primary)' && isDark) {
                // If we previously aggressively replaced it, revert it back to #fff on dark buttons
                prop.value.value = '#fff';
                changed = true;
              }
            } else if (prop.value.type === 'ConditionalExpression') {
              // Handle color: isLow ? '#E74C3C' : '#fff'
              if (prop.value.consequent.type === 'StringLiteral') {
                const val = prop.value.consequent.value.toLowerCase();
                if (val === '#fff' || val === '#ffffff' || val === 'white') {
                   if (!isDark) {
                     prop.value.consequent.value = 'var(--color-text-primary)';
                     changed = true;
                   }
                } else if (val === 'var(--color-text-primary)' && isDark) {
                   prop.value.consequent.value = '#fff';
                   changed = true;
                }
              }
              if (prop.value.alternate.type === 'StringLiteral') {
                const val = prop.value.alternate.value.toLowerCase();
                if (val === '#fff' || val === '#ffffff' || val === 'white') {
                   if (!isDark) {
                     prop.value.alternate.value = 'var(--color-text-primary)';
                     changed = true;
                   }
                } else if (val === 'var(--color-text-primary)' && isDark) {
                   prop.value.alternate.value = '#fff';
                   changed = true;
                }
              }
            }
          }
        }
      }
    }
  });

  if (changed) {
    const output = generator(ast, {
      retainLines: true,
      retainFunctionParens: true,
      jsescOption: { quotes: 'single', minimal: true }
    }, code);
    fs.writeFileSync(filePath, output.code);
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

for (const dir of directories) {
  walkDir(dir);
}

console.log("Smart color refactor complete.");
