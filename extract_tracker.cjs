const fs = require('fs');

const originalPath = 'c:/CoffeeDayCafe/original.jsx';
const orderHistoryPath = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/OrderHistory.jsx';

let originalContent = fs.readFileSync(originalPath, 'utf16le'); // PowerShell default >

const splitMarker = '// Dynamic Live Tracker Success / Invoice view';
const cartMarker2 = '  return (\n    <div className="cart-page">';
const cartMarker3 = '  return (\r\n    <div className="cart-page">';
const cartMarker4 = 'return (\r\n<div className="cart-page">';
const cartMarker5 = 'return (\n<div className="cart-page">';

const splitIdx = originalContent.indexOf(splitMarker);
let returnIdx = originalContent.indexOf(cartMarker2, splitIdx);
if (returnIdx === -1) returnIdx = originalContent.indexOf(cartMarker3, splitIdx);
if (returnIdx === -1) returnIdx = originalContent.indexOf(cartMarker4, splitIdx);
if (returnIdx === -1) returnIdx = originalContent.indexOf(cartMarker5, splitIdx);

if (splitIdx !== -1 && returnIdx !== -1) {
  let trackerCode = originalContent.substring(splitIdx, returnIdx);

  let orderHistory = fs.readFileSync(orderHistoryPath, 'utf8');
  
  // Clean up the tracker code using simple string replacement
  const targetStr = "if (success && (activeOrders.length > 0 || completedOrders.length > 0)) {";
  trackerCode = trackerCode.replace(targetStr, "if (activeOrders.length > 0 || completedOrders.length > 0) {");
  trackerCode = trackerCode.replace(/Order More Delicacies/g, "View Menu");
  
  const targetReturnString2 = "  return (\n    <div className=\"cart-page\" style={{ textAlign: 'center', padding: '100px 20px' }}>";

  let insertIdx = orderHistory.indexOf(targetReturnString2);
  if (insertIdx === -1) {
     insertIdx = orderHistory.indexOf("  return (\r\n    <div className=\"cart-page\" style={{ textAlign: 'center', padding: '100px 20px' }}>");
  }
  
  if (insertIdx !== -1) {
    const newOrderHistory = orderHistory.substring(0, insertIdx) + trackerCode + '\n' + orderHistory.substring(insertIdx);
    fs.writeFileSync(orderHistoryPath, newOrderHistory);
    console.log('Successfully injected tracker UI into OrderHistory.jsx');
  } else {
    console.log('Could not find insert index in OrderHistory.jsx');
  }
} else {
  console.log('Could not find tracker UI boundaries, splitIdx:', splitIdx, 'returnIdx:', returnIdx);
}
