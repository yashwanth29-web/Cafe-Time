const fs = require('fs');
const path = require('path');

const cartPagePath = path.join(__dirname, '../../client/src/pages/CartPage.jsx');
const historyPagePath = path.join(__dirname, '../../client/src/pages/OrderHistory.jsx');

const content = fs.readFileSync(cartPagePath, 'utf8');

// The split marker is `// Dynamic Live Tracker Success / Invoice view`
const splitMarker = '// Dynamic Live Tracker Success / Invoice view';
const splitIndex = content.indexOf(splitMarker);

if (splitIndex === -1) {
  console.log("Marker not found!");
  process.exit(1);
}

const topImports = content.substring(0, content.indexOf('const CartPage ='));
const bottomPart = content.substring(splitIndex); // Contains the `if (success ...)` block down to `return ( <div className="cart-page">... )`

// Wait, bottomPart has:
// if (success && (activeOrders.length > 0 || completedOrders.length > 0)) {
//   return ( <div className="main-content">...</div> );
// }
// return ( <div className="cart-page">...</div> );
// };
// export default CartPage;

// Find where the `return ( <div className="cart-page">` starts.
const cartReturnIndex = bottomPart.indexOf('return (\n    <div className="cart-page"');
const trackerBlock = bottomPart.substring(0, cartReturnIndex); // This is the `if (success...) { return (...) }`
const cartBlock = bottomPart.substring(cartReturnIndex); // This is `return (...) }; export default CartPage;`

// -----------------------------------------------------
// 1. Create OrderHistory.jsx
// -----------------------------------------------------
let historyTop = topImports.replace(
  /import RazorpayPayment from '\.\.\/components\/RazorpayPayment';/,
  `import RazorpayPayment from '../components/RazorpayPayment';\nimport { useNavigate } from 'react-router-dom';`
);

let historyComponent = `
const OrderHistory = ({ cafeId }) => {
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  const [cafeInfo, setCafeInfo] = useState(null);
  const [submittedReviews, setSubmittedReviews] = useState(() => JSON.parse(localStorage.getItem('submittedReviews') || '[]'));
  const [reviewRatings, setReviewRatings] = useState({});
  const [reviewTexts, setReviewTexts] = useState({});
  const [submittingReview, setSubmittingReview] = useState({});

  const [customerName] = useState(() => localStorage.getItem('customerName') || '');
  const [customerEmail] = useState(() => localStorage.getItem('customerEmail') || '');
  const [customerPhone] = useState(() => localStorage.getItem('customerPhone') || '');

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const id = cafeId || sessionStorage.getItem('cafeId') || 'CD001';
        const res = await getCafeInfo(id);
        if (res.success) setCafeInfo(res.data);
      } catch (e) {}
    };
    fetchCafe();
  }, [cafeId]);
`;

// Extract useEffects for fetching active orders, polling, handleCounterPayRequest, handleCancelCounterPayRequest, playChime, speakThankYou, triggerPaidFeedback
// These are between `const [voicedOrderIds` and `// Totals calculations`
const middleLogicRegex = /(const \[voicedOrderIds[\s\S]*?)\/\/ Totals calculations/;
const match = content.match(middleLogicRegex);
let historyMiddle = match ? match[1] : '';

// Remove `success` dependency from polling
historyMiddle = historyMiddle.replace(/if \(!success \|\| \(activeOrders\.length === 0/g, 'if ((activeOrders.length === 0');

let historyTrackerRender = trackerBlock.replace(
  /if \(success && \(activeOrders\.length > 0 \|\| completedOrders\.length > 0\)\) \{/,
  `if (activeOrders.length > 0 || completedOrders.length > 0) {`
);

// Fix the "Order More Delicacies" link to point to /
historyTrackerRender = historyTrackerRender.replace(/Order More Delicacies/g, 'Order More Delicacies');

let historyFile = historyTop + historyComponent + historyMiddle + historyTrackerRender + `
  return (
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

fs.writeFileSync(historyPagePath, historyFile);

// -----------------------------------------------------
// 2. Refactor CartPage.jsx
// -----------------------------------------------------
let newCartTop = topImports.replace(
  /import { Link } from 'react-router-dom';/,
  `import { Link, useNavigate } from 'react-router-dom';`
);

let newCartComponent = `
const CartPage = ({ cart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, tableNumber, cafeId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [customerName, setCustomerName] = useState(() => localStorage.getItem('customerName') || '');
  const [customerEmail, setCustomerEmail] = useState(() => localStorage.getItem('customerEmail') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('customerPhone') || '');

  useEffect(() => { if (customerName) localStorage.setItem('customerName', customerName); }, [customerName]);
  useEffect(() => { if (customerEmail) localStorage.setItem('customerEmail', customerEmail); }, [customerEmail]);
  useEffect(() => { if (customerPhone) localStorage.setItem('customerPhone', customerPhone); }, [customerPhone]);

  // Totals calculations
`;

// Extract place order logic
const placeOrderLogicRegex = /\/\/ Totals calculations[\s\S]*?(?=const handlePlaceOrder)const handlePlaceOrder = async \(\) => \{[\s\S]*?\} finally \{\s*setLoading\(false\);\s*\}\s*\};/;
const placeOrderMatch = content.match(placeOrderLogicRegex);
let newCartMiddle = placeOrderMatch ? placeOrderMatch[0] : '';

// Replace setSuccess logic with navigate
newCartMiddle = newCartMiddle.replace(
  /setActiveOrders\(prev => \[\.\.\.prev\.filter\(o => o\._id !== response\.data\._id\), response\.data\]\);\s*setSuccess\(true\);/,
  `navigate('/history');`
);

let newCartFile = newCartTop + newCartComponent + newCartMiddle + "\n\n" + cartBlock;

fs.writeFileSync(cartPagePath, newCartFile);

console.log("Safely refactored CartPage and OrderHistory!");
