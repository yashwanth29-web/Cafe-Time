const fs = require('fs');
const filePath = 'c:/CoffeeDayCafe/restaurant-qr-app/client/src/pages/CartPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const splitMarker = '// Dynamic Live Tracker Success / Invoice view';
const returnPageMarker = '  return (\n    <div className="cart-page">';
const returnPageMarker2 = '  return (\\n<div className="cart-page">'; // In case of varying newline
const returnPageMarker3 = '<div className="cart-page">';

const splitIdx = content.indexOf(splitMarker);
let returnIdx = content.indexOf(returnPageMarker, splitIdx);

if (returnIdx === -1) {
  returnIdx = content.indexOf(returnPageMarker3, splitIdx);
  if (returnIdx !== -1) {
    // go back to the return statement
    returnIdx = content.lastIndexOf('  return (', returnIdx);
  }
}

if (splitIdx !== -1 && returnIdx !== -1) {
  const top = content.substring(0, splitIdx);
  const bottom = content.substring(returnIdx);

  let newContent = top + bottom;

  // Add useNavigate
  newContent = newContent.replace(/import { Link } from 'react-router-dom';/, "import { Link, useNavigate } from 'react-router-dom';");
  newContent = newContent.replace(/const CartPage = \(\{.*?\}\) => \{/, '$&\\n  const navigate = useNavigate();');

  // Change setSuccess to navigate
  newContent = newContent.replace(/setActiveOrders\(prev => \[\.\.\.prev\.filter\(o => o\._id !== response\.data\._id\), response\.data\]\);\s*setSuccess\(true\);/, "navigate('/history');");
  newContent = newContent.replace(/setActiveOrders\(\(prev\) => \[\.\.\.prev\.filter\(\(o\) => o\._id !== response\.data\._id\), response\.data\]\);\s*setSuccess\(true\);/, "navigate('/history');");

  fs.writeFileSync(filePath, newContent);
  console.log('CartPage trimmed successfully.');
} else {
  console.log('Markers not found. splitIdx:', splitIdx, 'returnIdx:', returnIdx);
}
