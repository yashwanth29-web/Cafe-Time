const fs = require('fs');
const path = require('path');
const pagesDir = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages';

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace common Windows-1252 garbled text back to UTF-8 emojis/symbols
  content = content.replace(/Γé╣/g, '₹');
  content = content.replace(/Γ¡É/g, '⭐');
  content = content.replace(/Γÿà/g, '★'); // Filled star, or maybe it was hollow. Let's use ★
  content = content.replace(/Γ£ö/g, '✔️');
  content = content.replace(/ΓÜá/g, '⚠️');
  content = content.replace(/ΓÅ│/g, '⏳');
  
  // In the screenshot, Γÿà Γÿà Γÿà is shown.
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed encoding in ${file}`);
  }
});
