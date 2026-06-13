const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');

const filesToProcess = [
  'OwnerDashboard.jsx',
  'WaiterDashboard.jsx',
  'CashierDashboard.jsx',
  'ManagerDashboard.jsx',
  'KitchenDashboard.jsx'
];

// Regex to match most common emojis
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F200}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;

// Additional explicit targets
const explicitEmojis = ['🛎️', '🍳', '🖨️', '💵', '📋', '🧑‍🍳', '📦', '📈', '⚙️', '⚠️', '✅', '⭐', '🗑️', '✏️', '👥', '📝', '⏱️', '📅', '💵', '💳', '🍲', '🍹', '🍔', '🧾', '📊', '🔔', '🔒', '❌', '✔️', '➕', '➖'];

filesToProcess.forEach(file => {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Strip all emojis via regex
  content = content.replace(emojiRegex, '');
  
  // Strip explicit list just in case
  explicitEmojis.forEach(emoji => {
    content = content.split(emoji).join('');
  });

  // Clean up double spaces left behind by emoji removal
  content = content.replace(/  +/g, ' ');
  // Clean up space before closing tag due to emoji removal
  content = content.replace(/ \</g, '<');
  content = content.replace(/\> /g, '>');
  content = content.replace(/ \)/g, ')');
  content = content.replace(/\( /g, '(');

  // Manual specific text simplifications for WaiterDashboard
  content = content.replace("Serve prepared orders and handle table payments.", "");
  content = content.replace("Customer wants to pay cash!", "Awaiting Cash");
  content = content.replace("Cash Payment Requested", "Cash Requested");

  // OwnerDashboard manual simplifications
  content = content.replace("Inspect uploaded photos and proof of work completed by staff members. Records automatically auto-purge in 24 hours.", "");
  content = content.replace("Filter attendance records by date range and branch location.", "");

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned up ${file}`);
  } else {
    console.log(`No changes needed in ${file}`);
  }
});
