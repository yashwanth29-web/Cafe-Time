const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'OwnerDashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Strip remaining missed emojis
const extraEmojis = ['⏰', '🚪', '💼', '📊', '📈', '📋', '🧑‍🍳', '🛎️', '🍳', '💵', '📦'];
extraEmojis.forEach(emoji => {
  content = content.split(emoji).join('');
});

// Remove verbose texts and sub spans in attendance/staff
const phrasesToRemove = [
  '<span className="sub">Configured in roster</span>',
  '<span className="sub">Includes late entries</span>',
  '<span className="sub">No check-in record</span>',
  '<span className="sub">Checked in after grace period</span>',
  '<span className="sub">Active check-in sessions</span>',
  '<span className="sub">Completed today\'s shift</span>',
  '<span className="sub">Out of active roster</span>',
  '<span className="sub">Total working duration</span>',
  '<span className="sub">Require attention</span>'
];

phrasesToRemove.forEach(phrase => {
  content = content.replace(phrase, '');
});

// Fix any empty lines left by removal
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned up OwnerDashboard.jsx attendance texts');
