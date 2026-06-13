const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');

// 1. Fix CustomerMenu.jsx
const customerMenuPath = path.join(pagesDir, 'CustomerMenu.jsx');
let menuContent = fs.readFileSync(customerMenuPath, 'utf8');
menuContent = menuContent.replace(
  "const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');\n    if (activeIds.length > 0) setHasHistory(true);",
  "const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');\n    const completedIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');\n    if (activeIds.length > 0 || completedIds.length > 0) setHasHistory(true);"
);
fs.writeFileSync(customerMenuPath, menuContent, 'utf8');


// 2. Fix OrderHistory.jsx
const orderHistoryPath = path.join(pagesDir, 'OrderHistory.jsx');
let historyContent = fs.readFileSync(orderHistoryPath, 'utf8');

historyContent = historyContent.replace(
  "const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');\n      if (activeIds.length === 0) {\n        setSuccess(false);\n        return;\n      }",
  "const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');\n      const completedIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');\n      if (activeIds.length === 0 && completedIds.length === 0) {\n        setSuccess(false);\n        return;\n      }"
);

historyContent = historyContent.replace(
  "const fetchedActive = [];\n      const fetchedCompleted = [];\n      let updatedIds = [...activeIds];",
  "const fetchedActive = [];\n      const fetchedCompleted = [];\n      let updatedIds = [...activeIds];\n      let updatedCompIds = [...completedIds];"
);

historyContent = historyContent.replace(
  "updatedIds = updatedIds.filter((x) => x !== id);\n              if (!voicedOrderIds.includes(id)) {",
  "updatedIds = updatedIds.filter((x) => x !== id);\n              if (!updatedCompIds.includes(id)) updatedCompIds.push(id);\n              if (!voicedOrderIds.includes(id)) {"
);

historyContent = historyContent.replace(
  "sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n\n      if (fetchedActive.length > 0",
  "// Also fetch completed\n      for (const cid of completedIds) {\n        try {\n          const res = await getOrderById(cid);\n          if (res.success) fetchedCompleted.push(res.data);\n        } catch(e) {}\n      }\n\n      sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n      sessionStorage.setItem('completedOrderIds', JSON.stringify(updatedCompIds));\n\n      if (fetchedActive.length > 0"
);

historyContent = historyContent.replace(
  "let updatedIds = [...activeIds];\n\n      for (const order of activeOrders) {",
  "let updatedIds = [...activeIds];\n      const currentCompIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');\n      let updatedCompIds = [...currentCompIds];\n\n      for (const order of activeOrders) {"
);

historyContent = historyContent.replace(
  "updatedIds = updatedIds.filter((x) => x !== order._id);\n              newlyCompleted.push(res.data);",
  "updatedIds = updatedIds.filter((x) => x !== order._id);\n              if (!updatedCompIds.includes(order._id)) updatedCompIds.push(order._id);\n              newlyCompleted.push(res.data);"
);

historyContent = historyContent.replace(
  "sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n        if (updatedList.length > 0)",
  "sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n        sessionStorage.setItem('completedOrderIds', JSON.stringify(updatedCompIds));\n        if (updatedList.length > 0)"
);

fs.writeFileSync(orderHistoryPath, historyContent, 'utf8');


// 3. Fix CartPage.jsx
const cartPagePath = path.join(pagesDir, 'CartPage.jsx');
let cartContent = fs.readFileSync(cartPagePath, 'utf8');

cartContent = cartContent.replace(
  "const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');\n      if (activeIds.length === 0) {\n        setSuccess(false);\n        return;\n      }",
  "const activeIds = JSON.parse(sessionStorage.getItem('activeOrderIds') || '[]');\n      const completedIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');\n      if (activeIds.length === 0 && completedIds.length === 0) {\n        setSuccess(false);\n        return;\n      }"
);

cartContent = cartContent.replace(
  "const fetchedActive = [];\n      const fetchedCompleted = [];\n      let updatedIds = [...activeIds];",
  "const fetchedActive = [];\n      const fetchedCompleted = [];\n      let updatedIds = [...activeIds];\n      let updatedCompIds = [...completedIds];"
);

cartContent = cartContent.replace(
  "updatedIds = updatedIds.filter((x) => x !== id);\n              if (!voicedOrderIds.includes(id)) {",
  "updatedIds = updatedIds.filter((x) => x !== id);\n              if (!updatedCompIds.includes(id)) updatedCompIds.push(id);\n              if (!voicedOrderIds.includes(id)) {"
);

cartContent = cartContent.replace(
  "sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n\n      if (fetchedActive.length > 0",
  "// Also fetch completed\n      for (const cid of completedIds) {\n        try {\n          const res = await getOrderById(cid);\n          if (res.success) fetchedCompleted.push(res.data);\n        } catch(e) {}\n      }\n\n      sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n      sessionStorage.setItem('completedOrderIds', JSON.stringify(updatedCompIds));\n\n      if (fetchedActive.length > 0"
);

cartContent = cartContent.replace(
  "let updatedIds = [...activeIds];\n\n      for (const order of activeOrders) {",
  "let updatedIds = [...activeIds];\n      const currentCompIds = JSON.parse(sessionStorage.getItem('completedOrderIds') || '[]');\n      let updatedCompIds = [...currentCompIds];\n\n      for (const order of activeOrders) {"
);

cartContent = cartContent.replace(
  "updatedIds = updatedIds.filter((x) => x !== order._id);\n              newlyCompleted.push(res.data);",
  "updatedIds = updatedIds.filter((x) => x !== order._id);\n              if (!updatedCompIds.includes(order._id)) updatedCompIds.push(order._id);\n              newlyCompleted.push(res.data);"
);

cartContent = cartContent.replace(
  "sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n        if (updatedList.length > 0)",
  "sessionStorage.setItem('activeOrderIds', JSON.stringify(updatedIds));\n        sessionStorage.setItem('completedOrderIds', JSON.stringify(updatedCompIds));\n        if (updatedList.length > 0)"
);

fs.writeFileSync(cartPagePath, cartContent, 'utf8');

console.log('Fixed session storage logic in CustomerMenu, OrderHistory, CartPage');
