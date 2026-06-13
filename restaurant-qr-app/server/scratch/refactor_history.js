const fs = require('fs');
const path = require('path');

const cartPagePath = path.join(__dirname, '../../client/src/pages/CartPage.jsx');
const historyPagePath = path.join(__dirname, '../../client/src/pages/OrderHistory.jsx');
const appPath = path.join(__dirname, '../../client/src/App.jsx');
const customerMenuPath = path.join(__dirname, '../../client/src/pages/CustomerMenu.jsx');

// --- 1. REFACTOR OrderHistory.jsx ---
let historyContent = fs.readFileSync(historyPagePath, 'utf8');

// The OrderHistory component doesn't need cart props. 
// It also needs to always show the tracker if there are orders, otherwise show a "No active orders" message.
historyContent = historyContent.replace(
  /const OrderHistory = \(\{.*?\}\) => \{/,
  `const OrderHistory = ({ cafeId }) => {`
);

// We need to ensure it doesn't try to render the Cart UI.
// We replace everything from `// Dynamic Live Tracker Success / Invoice view` down to the end of the file with just the return statement for the tracker or empty state.
const splitMarker = '// Dynamic Live Tracker Success / Invoice view';
const historyParts = historyContent.split(splitMarker);
let historyTop = historyParts[0];

// Remove handlePlaceOrder and totals from historyTop
historyTop = historyTop.replace(/\/\/ Totals calculations[\s\S]*?const handlePlaceOrder[\s\S]*?\} finally \{\s*setLoading\(false\);\s*\}\s*\};/g, '');

// Adjust the render block
let historyBottom = `
  // Dynamic Live Tracker Success / Invoice view
  if (activeOrders.length > 0 || completedOrders.length > 0) {
    return (
${historyParts[1].substring(historyParts[1].indexOf('<div className="main-content"'), historyParts[1].indexOf('return (', historyParts[1].indexOf('<div className="main-content"')))}
  }

  return (
    <div className="cart-page" style={{ textAlign: 'center', padding: '100px 20px' }}>
      <h2>Order History</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '20px' }}>You have no active or recently completed orders in this session.</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
        View Menu
      </Link>
    </div>
  );
};

export default OrderHistory;
`;

// Also fix the link at the bottom of the success tracker to say "Go Back to Menu"
historyBottom = historyBottom.replace(/Order More Delicacies/g, 'Order More Delicacies');

fs.writeFileSync(historyPagePath, historyTop + historyBottom);


// --- 2. REFACTOR CartPage.jsx ---
let cartContent = fs.readFileSync(cartPagePath, 'utf8');

// Import useNavigate
cartContent = cartContent.replace(/import { Link } from 'react-router-dom';/, `import { Link, useNavigate } from 'react-router-dom';`);

// Add useNavigate to component
cartContent = cartContent.replace(/const CartPage = \(\{.*?\}\) => \{/, `$&
  const navigate = useNavigate();`);

// In CartPage, when order is placed successfully, navigate to /history
cartContent = cartContent.replace(
  /setActiveOrders\(prev => \[\.\.\.prev\.filter\(o => o\._id !== response\.data\._id\), response\.data\]\);\s*setSuccess\(true\);/g,
  `setActiveOrders(prev => [...prev.filter(o => o._id !== response.data._id), response.data]);
        navigate('/history');`
);

// Remove the tracker polling and fetching logic from CartPage
cartContent = cartContent.replace(/\/\/ Fetch active orders on mount[\s\S]*?\/\/ Totals calculations/g, '// Totals calculations');
// Also remove triggerPaidFeedback, playChime, speakThankYou
cartContent = cartContent.replace(/\/\/ Helper to play a pleasant service alert chime[\s\S]*?\/\/ Totals calculations/g, '// Totals calculations');

// Remove the tracker UI from CartPage completely
const cartParts = cartContent.split(splitMarker);
let cartTop = cartParts[0];
let cartBottom = `
  return (
${cartParts[1].substring(cartParts[1].indexOf('<div className="cart-page"'))}`;

fs.writeFileSync(cartPagePath, cartTop + cartBottom);


// --- 3. REFACTOR App.jsx ---
let appContent = fs.readFileSync(appPath, 'utf8');

if (!appContent.includes('OrderHistory')) {
  appContent = appContent.replace(/import CartPage from '\.\/pages\/CartPage';/, `import CartPage from './pages/CartPage';\nimport OrderHistory from './pages/OrderHistory';`);
  appContent = appContent.replace(/<Route path="\/cart" element=\{<CartPage .*? \/>\} \/>/, `$&
        <Route path="/history" element={<OrderHistory cafeId={cafeId} />} />`);
  fs.writeFileSync(appPath, appContent);
}

// --- 4. REFACTOR CustomerMenu.jsx ---
let menuContent = fs.readFileSync(customerMenuPath, 'utf8');
if (!menuContent.includes('/history')) {
  // We need to check if there are active order IDs on mount and show the button
  menuContent = menuContent.replace(/const \[loading, setLoading\] = useState\(true\);/, `$&
  const [hasHistory, setHasHistory] = useState(false);`);
  
  menuContent = menuContent.replace(/useEffect\(\(\) => \{/, `$&
    const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');
    if (activeIds.length > 0) setHasHistory(true);
`);

  // Add the button near the sticky cart banner
  menuContent = menuContent.replace(/\{totalItems > 0 &&/, `
      {hasHistory && totalItems === 0 && (
        <div className="sticky-cart-banner" style={{ background: 'var(--color-primary)' }}>
          <Link to="/history" className="sticky-cart-banner-content" style={{ justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '15px' }}>🧾 View My Orders & Tracker</span>
          </Link>
        </div>
      )}
      
      {totalItems > 0 &&`);
      
  fs.writeFileSync(customerMenuPath, menuContent);
}

console.log("Refactoring complete.");
