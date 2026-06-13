const fs = require('fs');
const path = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/OwnerDashboard.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Add getAssetUrl to imports
content = content.replace("getReviews } from\n'../services/api';", "getReviews,\n  getAssetUrl } from\n'../services/api';");
content = content.replace("getReviews } from\r\n'../services/api';", "getReviews,\n  getAssetUrl } from\n'../services/api';");

// 2. Wrap src={report.photos[0]}
content = content.replace('src={report.photos[0]}', 'src={getAssetUrl(report.photos[0])}');

// 3. Wrap src={item.image ...}
content = content.replace("src={item.image || 'https://via.placeholder.com/60?text=No+Image'}", "src={item.image ? getAssetUrl(item.image) : 'https://via.placeholder.com/60?text=No+Image'}");

// 4. Wrap src={newItem.image}
content = content.replace('src={newItem.image}', 'src={getAssetUrl(newItem.image)}');

// 5. Wrap src={editingItem.image}
content = content.replace('src={editingItem.image}', 'src={getAssetUrl(editingItem.image)}');

// 6. Wrap src={photo}
content = content.replace('src={photo}', 'src={getAssetUrl(photo)}');

// 7. Wrap window.open(photo, '_blank')
content = content.replace("onClick={() => window.open(photo, '_blank')}", "onClick={() => window.open(getAssetUrl(photo), '_blank')}");

fs.writeFileSync(path, content, 'utf8');
console.log('Success');
