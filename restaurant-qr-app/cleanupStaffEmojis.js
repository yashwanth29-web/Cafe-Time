const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'StaffDashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let original = content;

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F200}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;

content = content.replace(emojiRegex, '');
content = content.replace(/\uFE0F/g, ''); // Variation selector
content = content.replace(/  +/g, ' '); // Clean double spaces

if (content !== original) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleaned up remaining generic emojis in StaffDashboard.jsx');
} else {
  console.log('No generic emojis found in StaffDashboard.jsx');
}
