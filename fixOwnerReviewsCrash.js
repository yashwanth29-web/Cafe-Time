const fs = require('fs');
const path = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/OwnerDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'fontWeight: 600\n                    }}>\n                              {item}\n                            </span>',
  'fontWeight: 600\n                    }}>\n                              {item.quantity}x {item.name}\n                            </span>'
);

content = content.replace(
  'fontWeight: 600\r\n                    }}>\r\n                              {item}\r\n                            </span>',
  'fontWeight: 600\r\n                    }}>\r\n                              {item.quantity}x {item.name}\r\n                            </span>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed item rendering');
