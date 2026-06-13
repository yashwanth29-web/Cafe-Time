const fs = require('fs');
const filePath = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/OrderHistory.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const splitIdx = content.indexOf('// Totals calculations');

if (splitIdx !== -1) {
  content = content.substring(0, splitIdx);
  content += `  return (
    <div className="cart-page" style={{ textAlign: 'center', padding: '100px 20px' }}>
      <h2 style={{ color: 'var(--color-primary)' }}>Order History</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '20px' }}>You have no active or recently completed orders in this session.</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
        View Menu
      </Link>
    </div>
  );
};

export default OrderHistory;
`;

  // Fix the component name at the top
  content = content.replace(/const CartPage = \(\{.*?\}\) => \{/, 'const OrderHistory = ({ cafeId }) => {\\n  const navigate = useNavigate();');
  // Add useNavigate import
  content = content.replace(/import \{ Link \} from 'react-router-dom';/, "import { Link, useNavigate } from 'react-router-dom';");

  fs.writeFileSync(filePath, content);
  console.log('OrderHistory trimmed successfully using Totals calculations marker.');
} else {
  console.log('Target string not found.');
}
