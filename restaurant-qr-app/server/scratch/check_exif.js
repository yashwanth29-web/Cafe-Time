const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../public/uploads');

const run = () => {
  const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('dish-') && f.endsWith('.jpg'));
  
  files.forEach(f => {
    const p = path.join(uploadsDir, f);
    const content = fs.readFileSync(p);
    
    // Search for common metadata strings or tags in the first 2048 bytes
    const header = content.slice(0, 2048).toString('utf8');
    const strings = header.match(/[\w\.\-\_]{4,100}/g) || [];
    const interesting = strings.filter(s => 
      s.toLowerCase().includes('soda') || 
      s.toLowerCase().includes('tea') || 
      s.toLowerCase().includes('coffee') || 
      s.toLowerCase().includes('juice') || 
      s.toLowerCase().includes('milk') || 
      s.toLowerCase().includes('shake') || 
      s.toLowerCase().includes('biscuit') || 
      s.toLowerCase().includes('puff') || 
      s.toLowerCase().includes('bun') || 
      s.toLowerCase().includes('samosa') || 
      s.toLowerCase().includes('sandwich') || 
      s.toLowerCase().includes('fries') ||
      s.toLowerCase().includes('dish') ||
      s.toLowerCase().includes('original')
    );
    
    if (interesting.length > 0) {
      console.log(`File ${f}:`, interesting);
    }
  });
};

run();
