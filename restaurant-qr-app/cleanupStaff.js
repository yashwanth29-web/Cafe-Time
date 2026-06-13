const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'StaffDashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error("StaffDashboard.jsx not found!");
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Strip explicit emojis
const explicitEmojis = ['🏃‍♂️', '📅', '📍', '🚪', '📊', '📜', '📝', '⚠️', '✅'];
explicitEmojis.forEach(emoji => {
  content = content.split(emoji + ' ').join('');
  content = content.split(emoji).join('');
});

// Remove verbose texts
const paragraphsToRemove = [
  '<p style={{ margin: \'4px 0 0 0\', color: \'var(--color-text-secondary)\', fontSize: \'0.85rem\' }}>\\s*Record attendance and submit daily operational work proof.\\s*</p>',
  '<p style={{ color: \'var(--color-text-secondary)\', fontSize: \'0.85rem\', marginBottom: \'24px\', lineHeight: \'1.5\' }}>\\s*Owners require proof that work has been successfully completed \\(e\\.g\\., tables cleaned, kitchen sanitized, counter wiped, opening/closing prep done\\)\\. Upload multiple photos \\(up to 10\\) to a single report\\. Note that images are temporary records and are auto-deleted after 24 hours\\.\\s*</p>'
];

paragraphsToRemove.forEach(regexStr => {
  content = content.replace(new RegExp(regexStr, 'g'), '');
});

// Fix spacing issues created by removing paragraphs
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned up StaffDashboard.jsx');
