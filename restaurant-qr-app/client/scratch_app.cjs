const fs = require('fs');
const filePath = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/App.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = '{/* Auth Flow */}';

if (content.indexOf(targetStr) !== -1) {
  content = content.replace(targetStr, `<Route path="/history" element={<OrderHistory cafeId={cafeIdParam || 'CD001'} />} />\n\n          {/* Auth Flow */}`);
  fs.writeFileSync(filePath, content);
  console.log('App.jsx updated with /history route.');
} else {
  console.log('Target string not found.');
}
