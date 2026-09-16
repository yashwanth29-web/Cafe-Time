import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { getOrders, updateOrderStatus, updateOrder, deleteOrder, getInventory, createInventoryItem, updateInventoryItem, recordPurchase, recordWastage, reportShortage, getInventoryCategories, getMenu, getAssetUrl, getCafeInfo, getPaymentInfo } from '../services/api';
import socket, { connectSocket } from '../socket';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/App.css';

const StaffOrderWorkspace = () => {
  const { user } = useAuth();
  const { activeBranchId, branches } = useBranch();
  
  const [cafeInfo, setCafeInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  
  const seenOrderIdsRef = useRef(new Set());
  const seenPaidOrderIdsRef = useRef(new Set());
  
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'orders';
  const subTabParam = searchParams.get('sub') || 'all';
  
  // Local state for modals & sub-menus
  const [showTakeOrderModal, setShowTakeOrderModal] = useState(false);
  const [takeOrderTable, setTakeOrderTable] = useState('');
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [selectedItemForShortage, setSelectedItemForShortage] = useState(null);
  const [shortageReason, setShortageReason] = useState('');
  
  const [paymentInfo, setPaymentInfo] = useState({ enableUpi: false, upiId: '' });
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiOrder, setUpiOrder] = useState(null);

  // Auto-print KOT toggle - default to TRUE (ON)
  const [autoPrintKOT, setAutoPrintKOT] = useState(() => {
    const saved = localStorage.getItem('autoPrintKOT');
    return saved === null ? true : saved === 'true';
  });
  const autoPrintKOTRef = useRef(autoPrintKOT);
  useEffect(() => {
    autoPrintKOTRef.current = autoPrintKOT;
    localStorage.setItem('autoPrintKOT', String(autoPrintKOT));
  }, [autoPrintKOT]);

  // Order Management: Add Items, Edit Order, Delete Order
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [selectedOrderForAddItems, setSelectedOrderForAddItems] = useState(null);
  const [itemsToAdd, setItemsToAdd] = useState([]);
  const [addItemSearchQuery, setAddItemSearchQuery] = useState('');
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderActionLoading, setOrderActionLoading] = useState(false);

  // Inventory Management states for Staff
  const [categories, setCategories] = useState([]);
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [addInventoryForm, setAddInventoryForm] = useState({
    name: '',
    unit: 'kg',
    quantity: '',
    reorderLevel: '5',
    totalCost: '',
    costPrice: '',
    category: 'General',
    supplier: '',
    supplierPhone: ''
  });

  const [showEditInventoryModal, setShowEditInventoryModal] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState(null);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({
    quantityAdded: '',
    costPrice: '',
    supplier: '',
    notes: ''
  });

  const [showWastageModal, setShowWastageModal] = useState(false);
  const [wastageForm, setWastageForm] = useState({
    quantityWasted: '',
    type: 'spoiled',
    reason: ''
  });
  const [inventoryActionLoading, setInventoryActionLoading] = useState(false);
  
  // Fetch Cafe Details & Payment Info
  useEffect(() => {
    const fetchCafeAndPayment = async () => {
      if (user?.cafeId) {
        try {
          const res = await getCafeInfo(user.cafeId);
          if (res.success) {
            setCafeInfo(res.data);
          }
          if (activeBranchId) {
            const payRes = await getPaymentInfo();
            if (payRes.success && payRes.data) {
              setPaymentInfo(payRes.data);
            }
          }
        } catch (e) {
          console.error('Error fetching cafe or payment info:', e);
        }
      }
    };
    fetchCafeAndPayment();
  }, [user, activeBranchId]);
  
  // Audio chimes
  const playNotificationSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioContext.currentTime); // A5
        gain2.gain.setValueAtTime(0.15, audioContext.currentTime);
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.18);
      }, 130);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }, []);
  
  // Web Speech synthesis
  const speakText = useCallback((text) => {
    if (!soundEnabledRef.current || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed:', e);
    }
  }, []);

  const userCafeId = user?.cafeId;

  // Fetch initial orders
  const fetchWorkspaceOrders = useCallback(async () => {
    if (!userCafeId || !activeBranchId) return;
    try {
      setErrorMsg('');
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const response = await getOrders({ active: true, cafeId: userCafeId, branchId: activeBranchId, date: todayStr });
      if (response.success) {
        setOrders(response.data);
        
        // Track seen orders to avoid chime alerts for existing orders on load
        const activeOrders = response.data.filter(o => o.status === 'Placed' || o.status === 'Preparing');
        const paidOrders = response.data.filter(o => o.paymentStatus === 'Paid');
        
        if (seenOrderIdsRef.current.size === 0) {
          activeOrders.forEach(o => seenOrderIdsRef.current.add(o._id));
        }
        if (seenPaidOrderIdsRef.current.size === 0) {
          paidOrders.forEach(o => seenPaidOrderIdsRef.current.add(o._id));
        }
      } else {
        setErrorMsg('Failed to refresh order queue.');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setErrorMsg('Cannot connect to order service feed.');
    } finally {
      setLoading(false);
    }
  }, [userCafeId, activeBranchId]);

  // Load inventory list
  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const response = await getInventory();
      if (response && response.success) {
        setInventory(response.data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  // Load menu items
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const response = await getMenu();
      if (response && response.success) {
        setMenuItems(response.data);
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // Sync tab data fetches
  useEffect(() => {
    if (tabParam === 'inventory') {
      fetchInventory();
    } else if (tabParam === 'menu') {
      fetchMenu();
    }
  }, [tabParam, fetchInventory, fetchMenu, activeBranchId]);

  // Connect socket and register listeners
  useEffect(() => {
    setOrders([]);
    setLoading(true);
    fetchWorkspaceOrders();

    if (userCafeId && activeBranchId) {
      connectSocket(userCafeId, activeBranchId);

      const handleOrderCreated = (newOrder) => {
        // Only accept real-time order creation if it matches the current branch context
        if (activeBranchId && activeBranchId !== 'all') {
          const activeBranchDoc = (branches || []).find(b => b.branchId === activeBranchId || b._id === activeBranchId);
          const orderBranchDoc = (branches || []).find(b => b.branchId === newOrder.branchId || b._id === newOrder.branchId);
          const activeBranchObjectId = activeBranchDoc ? String(activeBranchDoc._id) : '';
          const orderBranchObjectId = orderBranchDoc ? String(orderBranchDoc._id) : newOrder.branchId;

          if (activeBranchObjectId && activeBranchObjectId !== orderBranchObjectId) {
            return; // Ignore order from another branch
          }
        }

        setOrders((prev) => {
          if (prev.some((o) => o._id === newOrder._id)) return prev;
          
          if (!seenOrderIdsRef.current.has(newOrder._id)) {
            seenOrderIdsRef.current.add(newOrder._id);
            playNotificationSound();
            const tableMsg = newOrder.tableNumber && newOrder.tableNumber !== 'Takeaway' && newOrder.tableNumber !== 'Walk-in'
              ? `for Table ${newOrder.tableNumber}`
              : 'for Takeaway';
            speakText(`New order received ${tableMsg}.`);
            if (autoPrintKOTRef.current) {
              try {
                printKOT(newOrder, user, cafeInfo, currentBranch);
              } catch (kotErr) {
                console.warn('Auto print KOT failed:', kotErr);
              }
            }
          }
          return [newOrder, ...prev];
        });
      };

      const handleOrderUpdated = (updatedOrder) => {
        setOrders((prev) => {
          const index = prev.findIndex((o) => o._id === updatedOrder._id);
          
          // Sound updates for payments
          if (updatedOrder.paymentStatus === 'Paid' && !seenPaidOrderIdsRef.current.has(updatedOrder._id)) {
            seenPaidOrderIdsRef.current.add(updatedOrder._id);
            playNotificationSound();
            const tableMsg = updatedOrder.tableNumber && updatedOrder.tableNumber !== 'Takeaway' && updatedOrder.tableNumber !== 'Walk-in'
              ? `for Table ${updatedOrder.tableNumber}`
              : 'for Takeaway';
            speakText(`Payment received ${tableMsg}. Amount ${Math.round(updatedOrder.totalAmount)} rupees.`);
          }

          if (index !== -1) {
            // Keep in local list if still active, otherwise filter completed
            if (updatedOrder.status === 'Completed' || updatedOrder.paymentStatus === 'Paid') {
              return prev.filter((o) => o._id !== updatedOrder._id);
            }
            return prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o));
          } else {
            // If new to active orders list (e.g. state transitioned back)
            if (updatedOrder.status !== 'Completed' && updatedOrder.paymentStatus !== 'Paid') {
              return [updatedOrder, ...prev];
            }
            return prev;
          }
        });
      };

      const handleOrderDeleted = (data) => {
        const delId = typeof data === 'object' ? data.orderId || data._id : data;
        setOrders((prev) => prev.filter((o) => o._id !== delId));
      };

      socket.on('order_created', handleOrderCreated);
      socket.on('order_updated', handleOrderUpdated);
      socket.on('order_deleted', handleOrderDeleted);

      // Graceful poll if socket goes down
      const pollTimer = setInterval(() => {
        if (socket && !socket.connected) {
          fetchWorkspaceOrders();
        }
      }, 5000);

      return () => {
        socket.off('order_created', handleOrderCreated);
        socket.off('order_updated', handleOrderUpdated);
        socket.off('order_deleted', handleOrderDeleted);
        clearInterval(pollTimer);
      };
    }
  }, [userCafeId, activeBranchId, fetchWorkspaceOrders, playNotificationSound, speakText]);

  // Delete order handler (calls deleteOrder which deletes order and restores deducted inventory)
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? Deducted inventory ingredients for this order will be automatically restored.')) {
      return;
    }
    try {
      const res = await deleteOrder(orderId);
      if (res && res.success) {
        setOrders((prev) => prev.filter((o) => o._id !== orderId));
        alert('Order deleted successfully and inventory restored.');
      } else {
        alert(res?.message || 'Failed to delete order.');
      }
    } catch (err) {
      console.error('Delete order error:', err);
      alert(err.response?.data?.message || 'Failed to delete order.');
    }
  };

  // Open Add Items Modal for an existing order
  const handleOpenAddItems = (order) => {
    setSelectedOrderForAddItems(order);
    setItemsToAdd([]);
    setAddItemSearchQuery('');
    if (menuItems.length === 0) {
      fetchMenu();
    }
    setShowAddItemsModal(true);
  };

  // Save additional items to order
  const handleSaveAddItems = async () => {
    if (!selectedOrderForAddItems || itemsToAdd.length === 0) return;
    setOrderActionLoading(true);
    try {
      const mergedItems = [...selectedOrderForAddItems.items];
      for (const add of itemsToAdd) {
        const itemId = String(add.id || add._id || '');
        const existingIdx = mergedItems.findIndex(
          (it) => (it.id && (String(it.id) === itemId)) ||
                  (it.menuItemId && String(it.menuItemId) === itemId) ||
                  it.name.toLowerCase() === add.name.toLowerCase()
        );
        if (existingIdx !== -1) {
          mergedItems[existingIdx] = {
            ...mergedItems[existingIdx],
            id: String(mergedItems[existingIdx].id || mergedItems[existingIdx]._id || itemId),
            quantity: mergedItems[existingIdx].quantity + add.quantity
          };
        } else {
          mergedItems.push({
            id: itemId || String(Date.now()),
            menuItemId: add._id,
            name: add.name,
            price: add.price,
            quantity: add.quantity,
            image: add.image
          });
        }
      }
      const res = await updateOrder(selectedOrderForAddItems._id, { items: mergedItems });
      if (res && res.success) {
        setOrders((prev) => prev.map((o) => (o._id === res.data._id ? res.data : o)));
        setShowAddItemsModal(false);
        setSelectedOrderForAddItems(null);
        setItemsToAdd([]);
        alert('Items added to order successfully!');
      } else {
        alert(res?.message || 'Failed to add items.');
      }
    } catch (err) {
      console.error('Add items error:', err);
      alert(err.response?.data?.message || 'Failed to add items to order.');
    } finally {
      setOrderActionLoading(false);
    }
  };

  // Open Edit Order Modal
  const handleOpenEditOrder = (order) => {
    setEditingOrder({
      _id: order._id,
      tableNumber: order.tableNumber,
      specialInstructions: order.specialInstructions || '',
      items: order.items.map((it) => ({
        ...it,
        id: String(it.id || it._id || Math.random().toString(36).substring(2, 9))
      }))
    });
    setShowEditOrderModal(true);
  };

  // Save edited order
  const handleSaveEditOrder = async () => {
    if (!editingOrder) return;
    if (!editingOrder.items || editingOrder.items.length === 0) {
      alert('Order must contain at least 1 item.');
      return;
    }
    setOrderActionLoading(true);
    try {
      const res = await updateOrder(editingOrder._id, {
        tableNumber: editingOrder.tableNumber,
        specialInstructions: editingOrder.specialInstructions,
        items: editingOrder.items
      });
      if (res && res.success) {
        setOrders((prev) => prev.map((o) => (o._id === res.data._id ? res.data : o)));
        setShowEditOrderModal(false);
        setEditingOrder(null);
        alert('Order updated successfully!');
      } else {
        alert(res?.message || 'Failed to update order.');
      }
    } catch (err) {
      console.error('Update order error:', err);
      alert(err.response?.data?.message || 'Failed to update order.');
    } finally {
      setOrderActionLoading(false);
    }
  };

  // Status updates
  const handleStatusTransition = async (orderId, targetStatus, payload = {}) => {
    let originalOrders;
    
    // Optimistic state update
    setOrders((prev) => {
      originalOrders = prev;
      
      return prev.map((o) => {
        if (o._id === orderId) {
          const updatedObj = { ...o, status: targetStatus, ...payload };
          const nowStr = new Date().toISOString();
          
          if (targetStatus === 'Preparing') {
            updatedObj.preparingBy = user?._id || null;
            updatedObj.preparingByName = user?.name || 'Staff';
            updatedObj.preparingAt = nowStr;
          } else if (targetStatus === 'Ready') {
            updatedObj.readyBy = user?._id || null;
            updatedObj.readyByName = user?.name || 'Staff';
            updatedObj.readyAt = nowStr;
          } else if (targetStatus === 'Delivered') {
            updatedObj.servedBy = user?._id || null;
            updatedObj.servedByName = user?.name || 'Staff';
            updatedObj.servedAt = nowStr;
          } else if (targetStatus === 'Completed') {
            updatedObj.paidBy = user?._id || null;
            updatedObj.paidByName = user?.name || 'Staff';
            updatedObj.paidAt = nowStr;
            updatedObj.paymentStatus = 'Paid';
            if (payload.paymentMethod) {
              updatedObj.paymentMethod = payload.paymentMethod;
            } else if (o.paymentMethod === 'Pending' || !o.paymentMethod) {
              updatedObj.paymentMethod = 'Cash';
            }
          }
          return updatedObj;
        }
        return o;
      }).filter((o) => o.status !== 'Completed' || o.paymentStatus === 'Pending');
    });

    try {
      const res = await updateOrderStatus(orderId, { status: targetStatus, ...payload });
      if (res.success) {
        setOrders((prev) => {
          const isStillActive = res.data.status !== 'Completed' || res.data.paymentStatus === 'Pending';
          if (isStillActive) {
            if (prev.some((o) => o._id === orderId)) {
              return prev.map((o) => (o._id === orderId ? { ...o, ...res.data } : o));
            } else {
              return [res.data, ...prev];
            }
          } else {
            return prev.filter((o) => o._id !== orderId);
          }
        });
      } else {
        if (originalOrders) setOrders(originalOrders);
        alert(res.message || 'Status transition failed.');
      }
    } catch (err) {
      console.error('Error changing status:', err);
      if (originalOrders) setOrders(originalOrders);
      alert(err.response?.data?.message || 'Server permission error.');
    }
  };

  // Mark order as paid
  const handleCollectPayment = async (orderId, paymentMethod) => {
    if (!window.confirm(`Confirm payment received via ${paymentMethod}?`)) return;
    await handleStatusTransition(orderId, 'Completed', { paymentStatus: 'Paid', paymentMethod });
  };

  // Report item shortage
  const handleShortageSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForShortage || !shortageReason) return;
    try {
      const res = await reportShortage({ itemId: selectedItemForShortage._id, reason: shortageReason });
      if (res && res.success) {
        alert('Shortage reported successfully.');
        setShowShortageModal(false);
        setShortageReason('');
        fetchInventory();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to report shortage.');
    }
  };

  // Fetch Inventory Categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getInventoryCategories();
        if (res && res.success) {
          setCategories(res.data);
        }
      } catch (err) {
        console.warn('Could not fetch categories:', err);
      }
    };
    fetchCats();
  }, []);

  // Add Inventory Item
  const handleAddInventoryItem = async (e) => {
    e.preventDefault();
    if (inventoryActionLoading) return;
    setInventoryActionLoading(true);
    try {
      const payload = {
        name: addInventoryForm.name,
        unit: addInventoryForm.unit,
        quantity: parseFloat(addInventoryForm.quantity) || 0,
        reorderLevel: parseFloat(addInventoryForm.reorderLevel) || 5,
        costPrice: parseFloat(addInventoryForm.costPrice) || 0,
        category: addInventoryForm.category || 'General',
        supplier: addInventoryForm.supplier || '',
        supplierPhone: addInventoryForm.supplierPhone || '',
        branch: currentBranch?.branchName || currentBranch?.name || 'Main'
      };
      const res = await createInventoryItem(payload);
      if (res && res.success) {
        alert('Ingredient added successfully.');
        setShowAddInventoryModal(false);
        setAddInventoryForm({ name: '', unit: 'kg', quantity: '', reorderLevel: '5', totalCost: '', costPrice: '', category: 'General', supplier: '', supplierPhone: '' });
        fetchInventory();
      }
    } catch (err) {
      console.error('Error adding inventory item:', err);
      alert(err.response?.data?.message || 'Failed to add ingredient.');
    } finally {
      setInventoryActionLoading(false);
    }
  };

  // Edit Inventory Item
  const handleEditInventoryItem = async (e) => {
    e.preventDefault();
    if (!editingInventoryItem || inventoryActionLoading) return;
    setInventoryActionLoading(true);
    try {
      const payload = {
        ...editingInventoryItem,
        quantity: parseFloat(editingInventoryItem.quantity) || 0,
        reorderLevel: parseFloat(editingInventoryItem.reorderLevel) || 5,
        costPrice: parseFloat(editingInventoryItem.costPrice) || 0,
        sellingPrice: 0,
        branch: editingInventoryItem.branch || currentBranch?.branchName || currentBranch?.name || 'Main'
      };
      const res = await updateInventoryItem(editingInventoryItem._id, payload);
      if (res && res.success) {
        alert('Ingredient updated successfully.');
        setShowEditInventoryModal(false);
        setEditingInventoryItem(null);
        fetchInventory();
      }
    } catch (err) {
      console.error('Error updating ingredient:', err);
      alert(err.response?.data?.message || 'Failed to update ingredient.');
    } finally {
      setInventoryActionLoading(false);
    }
  };

  // Record Stock Purchase
  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    if (!selectedInventoryItem || inventoryActionLoading) return;
    setInventoryActionLoading(true);
    try {
      const res = await recordPurchase({
        itemId: selectedInventoryItem._id,
        quantityAdded: parseFloat(purchaseForm.quantityAdded),
        costPrice: parseFloat(purchaseForm.costPrice) || 0,
        supplier: purchaseForm.supplier || selectedInventoryItem.supplier || '',
        notes: purchaseForm.notes || ''
      });
      if (res && res.success) {
        alert('Stock purchase recorded successfully.');
        setShowPurchaseModal(false);
        setSelectedInventoryItem(null);
        setPurchaseForm({ quantityAdded: '', costPrice: '', supplier: '', notes: '' });
        fetchInventory();
      }
    } catch (err) {
      console.error('Error recording purchase:', err);
      alert(err.response?.data?.message || 'Failed to record purchase.');
    } finally {
      setInventoryActionLoading(false);
    }
  };

  // Record Stock Wastage
  const handleRecordWastage = async (e) => {
    e.preventDefault();
    if (!selectedInventoryItem || inventoryActionLoading) return;
    setInventoryActionLoading(true);
    try {
      const res = await recordWastage({
        itemId: selectedInventoryItem._id,
        quantityWasted: parseFloat(wastageForm.quantityWasted),
        type: wastageForm.type || 'spoiled',
        reason: wastageForm.reason || ''
      });
      if (res && res.success) {
        alert('Wastage logged successfully.');
        setShowWastageModal(false);
        setSelectedInventoryItem(null);
        setWastageForm({ quantityWasted: '', type: 'spoiled', reason: '' });
        fetchInventory();
      }
    } catch (err) {
      console.error('Error recording wastage:', err);
      alert(err.response?.data?.message || 'Failed to record wastage.');
    } finally {
      setInventoryActionLoading(false);
    }
  };

  // Download UPI QR as PNG
  const handleDownloadUpiQr = () => {
    const svg = document.getElementById('staff-upi-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `UPI_Payment_Order_${upiOrder?.orderNumber || 'bill'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Active branch context
  const currentBranch = useMemo(() => {
    return branches?.find((b) => b.branchId === activeBranchId) || null;
  }, [branches, activeBranchId]);

  const isUnifiedMode = currentBranch ? !!currentBranch.unifiedStaffMode : false;
  const userRole = (user?.role || '').toLowerCase();

  // Permission helpers (Waiter and Cashier unified: Floor Service + Payment Collection)
  const canPrepare = isUnifiedMode || ['admin', 'owner', 'manager', 'chef'].includes(userRole);
  const canServe = isUnifiedMode || ['admin', 'owner', 'manager', 'waiter', 'cashier', 'waiter_cashier'].includes(userRole);
  const canCollect = isUnifiedMode || ['admin', 'owner', 'manager', 'waiter', 'cashier', 'waiter_cashier'].includes(userRole);

  // Filter orders by sub-tab columns
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (subTabParam === 'all') return true;
      if (subTabParam === 'placed') return o.status === 'Placed';
      if (subTabParam === 'preparing') return o.status === 'Preparing';
      if (subTabParam === 'ready') return o.status === 'Ready';
      if (subTabParam === 'unpaid') return (o.status === 'Delivered' || o.status === 'Completed') && o.paymentStatus === 'Pending';
      return true;
    });
  }, [orders, subTabParam]);

  // Statistics summaries
  const stats = useMemo(() => {
    return {
      placed: orders.filter((o) => o.status === 'Placed').length,
      preparing: orders.filter((o) => o.status === 'Preparing').length,
      ready: orders.filter((o) => o.status === 'Ready').length,
      unpaid: orders.filter((o) => (o.status === 'Delivered' || o.status === 'Completed') && o.paymentStatus === 'Pending').length,
      all: orders.length
    };
  }, [orders]);

  // Completed payments log (receipt history) with Date Filtering & Pagination
  const [completedLogs, setCompletedLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // all, ready, paid, in_progress
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPerPage = 20;

  const todayDateStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayDateStr = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchCompletedLogs = useCallback(async (dateToQuery) => {
    if (!user?.cafeId || !activeBranchId) return;
    setLogsLoading(true);
    try {
      const targetDate = dateToQuery || historyDate;
      const res = await getOrders({ cafeId: user.cafeId, branchId: activeBranchId, date: targetDate });
      if (res.success) {
        setCompletedLogs(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching completed orders:', e);
    } finally {
      setLogsLoading(false);
    }
  }, [user, activeBranchId, historyDate]);

  useEffect(() => {
    if (tabParam === 'receipts') {
      fetchCompletedLogs(historyDate);
    }
  }, [tabParam, historyDate, fetchCompletedLogs]);

  // Reset to page 1 on search, status, or date change
  useEffect(() => {
    setHistoryPage(1);
  }, [historyDate, historySearch, historyStatusFilter, historyPaymentFilter]);

  // Filter completed logs by search query, status, and payment method
  const filteredCompletedLogs = useMemo(() => {
    return completedLogs.filter((log) => {
      const q = historySearch.toLowerCase().trim();
      const matchesSearch = !q ||
        String(log.tableNumber || '').toLowerCase().includes(q) ||
        String(log._id || '').toLowerCase().includes(q) ||
        String(log.tokenNumber || '').toLowerCase().includes(q) ||
        String(log.customerName || '').toLowerCase().includes(q) ||
        String(log.customerMobile || '').toLowerCase().includes(q) ||
        (log.items || []).some(it => (it.name || '').toLowerCase().includes(q));

      const matchesStatus = historyStatusFilter === 'all' ||
        (historyStatusFilter === 'ready' && log.status === 'Ready') ||
        (historyStatusFilter === 'paid' && (log.paymentStatus === 'Paid' || log.status === 'Completed')) ||
        (historyStatusFilter === 'in_progress' && (log.status === 'Placed' || log.status === 'Preparing'));

      const matchesPayment = historyPaymentFilter === 'all' ||
        String(log.paymentMethod || 'cash').toLowerCase() === historyPaymentFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [completedLogs, historySearch, historyStatusFilter, historyPaymentFilter]);

  // Summary analytics for the selected date
  const historySummary = useMemo(() => {
    let totalRev = 0;
    let paidRev = 0;
    let pendingRev = 0;
    let cashRev = 0;
    let upiRev = 0;
    let itemsCount = 0;
    let readyCount = 0;
    let paidCount = 0;
    let inProgressCount = 0;

    completedLogs.forEach((log) => {
      const amt = Number(log.totalAmount) || 0;
      totalRev += amt;
      const isPaid = log.paymentStatus === 'Paid' || log.status === 'Completed';
      if (isPaid) {
        paidRev += amt;
        paidCount++;
        const method = (log.paymentMethod || 'cash').toLowerCase();
        if (method.includes('upi') || method.includes('online') || method.includes('qr')) {
          upiRev += amt;
        } else {
          cashRev += amt;
        }
      } else {
        pendingRev += amt;
      }

      if (log.status === 'Ready') readyCount++;
      if (log.status === 'Placed' || log.status === 'Preparing') inProgressCount++;

      (log.items || []).forEach((it) => {
        itemsCount += (Number(it.quantity) || 1);
      });
    });

    return {
      totalOrders: completedLogs.length,
      totalRevenue: totalRev,
      paidRevenue: paidRev,
      pendingRevenue: pendingRev,
      cashRevenue: cashRev,
      upiRevenue: upiRev,
      totalItems: itemsCount,
      readyCount,
      paidCount,
      inProgressCount
    };
  }, [completedLogs]);

  // Pagination calculation
  const totalHistoryPages = Math.max(1, Math.ceil(filteredCompletedLogs.length / historyPerPage));
  const paginatedCompletedLogs = useMemo(() => {
    const start = (historyPage - 1) * historyPerPage;
    return filteredCompletedLogs.slice(start, start + historyPerPage);
  }, [filteredCompletedLogs, historyPage, historyPerPage]);

  return (
    <div className="workspace-wrapper">
      
      {/* Upper Information Header */}
      <div className="workspace-header-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            📍 {currentBranch?.branchName || 'Workspace'}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Logged in: <strong>{user?.name}</strong> ({userRole.toUpperCase()})
          </span>
        </div>

        {/* Unified mode status banner & Action button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', width: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: isUnifiedMode ? 'rgba(76, 175, 80, 0.12)' : 'rgba(122, 99, 84, 0.08)',
            border: `1px solid ${isUnifiedMode ? 'var(--color-success)' : 'var(--color-border)'}`,
            padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold',
            color: 'var(--color-text-primary)', whiteSpace: 'nowrap'
          }}>
            <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: isUnifiedMode ? 'var(--color-success)' : 'var(--color-text-secondary)', display: 'inline-block' }} />
            Unified Mode: {isUnifiedMode ? 'ON' : 'OFF'}
          </div>

          <button
            onClick={() => setShowTakeOrderModal(true)}
            style={{
              background: 'var(--color-primary)', color: 'white', border: 'none',
              padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12.5px', transition: 'var(--transition-smooth)', whiteSpace: 'nowrap'
            }}
          >
            <span>➕</span> Take Order
          </button>
        </div>
      </div>

      {/* sound preferences & status overview widgets */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
        
        {/* Navigation Tabs */}
        <div className="scrollable-tabs-container" style={{ background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <button
            onClick={() => setSearchParams({ tab: 'orders', sub: subTabParam })}
            style={{
              flexShrink: 0,
              background: tabParam === 'orders' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'orders' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            📋 Live Queue
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'receipts' })}
            style={{
              flexShrink: 0,
              background: tabParam === 'receipts' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'receipts' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            🧾 Order History
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'menu' })}
            style={{
              flexShrink: 0,
              background: tabParam === 'menu' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'menu' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            🍽️ Cafe Menu
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'inventory' })}
            style={{
              flexShrink: 0,
              background: tabParam === 'inventory' ? 'var(--bg-card)' : 'transparent',
              color: tabParam === 'inventory' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
            }}
          >
            📦 Ingredient Stock
          </button>
        </div>

        {/* Sound toggle controls */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{
            flexShrink: 0,
            background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '12px',
            padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: 'bold'
          }}
        >
          {soundEnabled ? '🔊 Sound Alerts ON' : '🔇 Mute Alerts'}
        </button>

        {/* Auto-Print KOT toggle */}
        <button
          onClick={() => setAutoPrintKOT(!autoPrintKOT)}
          style={{
            flexShrink: 0,
            background: autoPrintKOT ? 'rgba(39, 174, 96, 0.15)' : 'transparent',
            border: `1px solid ${autoPrintKOT ? '#27ae60' : 'var(--color-border)'}`,
            borderRadius: '12px', padding: '8px 14px', fontSize: '12px',
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', color: autoPrintKOT ? '#27ae60' : 'var(--color-text-secondary)', fontWeight: 'bold'
          }}
          title="Automatically print Kitchen Order Ticket (KOT) on receipt of new orders"
        >
          {autoPrintKOT ? '🖨️ Auto-Print KOT: ON' : '🖨️ Auto-Print KOT: OFF'}
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: 'var(--color-danger-bg)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-text-primary)', padding: '14px 18px', borderRadius: '8px', fontSize: '13.5px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* ======================= TAB 1: LIVE QUEUE ======================= */}
      {tabParam === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Sub Tab Queue Filter Indicators */}
          <div className="scrollable-tabs-container" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {[
              { id: 'all', label: 'All Orders', count: stats.all, color: 'var(--color-text-primary)' },
              { id: 'placed', label: 'Placed / New', count: stats.placed, color: '#3498db' },
              { id: 'preparing', label: 'Preparing', count: stats.preparing, color: '#ff9800' },
              { id: 'ready', label: 'Ready to Serve', count: stats.ready, color: '#2ecc71' },
              { id: 'unpaid', label: 'Awaiting Payment', count: stats.unpaid, color: '#9b59b6' }
            ].map((col) => (
              <button
                key={col.id}
                onClick={() => setSearchParams({ tab: 'orders', sub: col.id })}
                style={{
                  flexShrink: 0,
                  background: subTabParam === col.id ? 'var(--color-border)' : 'var(--bg-card)',
                  color: col.color, border: '1px solid var(--color-border)', padding: '8px 14px',
                  borderRadius: '10px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {col.label} <span style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>{col.count}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 12px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading workspace queue...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg-card)', border: '1px dashed var(--color-border)', borderRadius: '16px', color: 'var(--color-text-secondary)', fontSize: '14.5px' }}>
              🎉 No orders found in this category. Queue is empty!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {filteredOrders.map((order) => {
                const isUnpaid = order.status === 'Delivered' && order.paymentStatus === 'Pending';
                const ageMinutes = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                
                return (
                  <div
                    key={order._id}
                    style={{
                      background: 'var(--bg-card)', border: `1px solid ${isUnpaid ? '#ff9800' : 'var(--color-border)'}`,
                      borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px',
                      boxShadow: 'var(--shadow-sm)', transition: 'var(--transition-smooth)',
                      borderWidth: isUnpaid ? '2px' : '1px'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>Table {order.tableNumber}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          #{order._id.substring(order._id.length - 6).toUpperCase()} · placed {ageMinutes}m ago
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                        color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : '#9b59b6',
                        background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : 'rgba(155,89,182,0.1)'
                      }}>
                        {order.status}
                      </span>
                    </div>

                    {/* Quick Order Actions: Add Items, Edit Order, Delete Order, New Order for this Table */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'var(--bg-secondary)', padding: '6px 8px', borderRadius: '8px' }}>
                      <button
                        onClick={() => handleOpenAddItems(order)}
                        style={{
                          background: 'rgba(52, 152, 219, 0.12)', color: '#2980b9', border: '1px solid rgba(52, 152, 219, 0.3)',
                          padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="Add items to this existing order"
                      >
                        ➕ Add Items
                      </button>
                      <button
                        onClick={() => handleOpenEditOrder(order)}
                        style={{
                          background: 'rgba(243, 156, 18, 0.12)', color: '#d35400', border: '1px solid rgba(243, 156, 18, 0.3)',
                          padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="Edit order quantities and instructions"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order._id)}
                        style={{
                          background: 'rgba(231, 76, 60, 0.12)', color: '#c0392b', border: '1px solid rgba(231, 76, 60, 0.3)',
                          padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="Delete order and restore inventory"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    {/* Special Instructions */}
                    {order.specialInstructions && (
                      <div style={{ background: 'var(--color-warning-bg)', borderLeft: '3px solid var(--color-warning)', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', color: 'var(--color-text-primary)' }}>
                        ✍️ <em>"{order.specialInstructions}"</em>
                      </div>
                    )}

                    {/* Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                      {order.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            <strong>{it.quantity}x</strong> {it.name}
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline Audit Logs */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '10px', fontSize: '11.5px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {order.preparingByName && <div>👨‍🍳 Preparing by: <strong>{order.preparingByName}</strong></div>}
                      {order.readyByName && <div>Ready by: <strong>{order.readyByName}</strong></div>}
                      {order.servedByName && <div>Served by: <strong>{order.servedByName}</strong></div>}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: 'auto', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Amount Due</span>
                        <strong style={{ fontSize: '1.1rem', color: '#27AE60' }}>₹{order.totalAmount}</strong>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
                        
                        {/* Print KOT button */}
                        <button
                          onClick={() => printKOT(order, user, cafeInfo, currentBranch)}
                          style={{
                            background: '#7f8c8d', color: 'white', border: 'none', padding: '8px 12px',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                          title="Print Kitchen Order Ticket"
                        >
                          🖨️ KOT
                        </button>

                        {/* ONE single button for order ready for Placed and Preparing orders */}
                        {(order.status === 'Placed' || order.status === 'Preparing') && (
                          <button
                            disabled={!canPrepare}
                            onClick={() => handleStatusTransition(order._id, 'Ready')}
                            style={{
                              background: canPrepare ? '#27ae60' : '#bdc3c7',
                              color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px',
                              cursor: canPrepare ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              boxShadow: canPrepare ? '0 2px 8px rgba(39, 174, 96, 0.35)' : 'none'
                            }}
                            title="Mark Order Ready and detect/deduct inventory"
                          >
                            ✅ Order Ready
                          </button>
                        )}

                        {/* Ready status action: Serve Order */}
                        {order.status === 'Ready' && (
                          <button
                            disabled={!canServe}
                            onClick={() => handleStatusTransition(order._id, 'Delivered')}
                            style={{
                              background: canServe ? '#9b59b6' : '#bdc3c7',
                              color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px',
                              cursor: canServe ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold'
                            }}
                          >
                            🚀 Serve Order
                          </button>
                        )}

                        {/* Delivered / unpaid status actions */}
                        {isUnpaid && (
                          <>
                            <button
                              disabled={!canCollect}
                              onClick={() => printPOSReceipt(order, user, cafeInfo, currentBranch)}
                              style={{
                                background: '#2980b9', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold'
                              }}
                            >
                              POS
                            </button>
                            <button
                              disabled={!canCollect}
                              onClick={() => {
                                if (paymentInfo.enableUpi && paymentInfo.upiId) {
                                  setUpiOrder(order);
                                  setShowUpiModal(true);
                                } else {
                                  handleCollectPayment(order._id, 'UPI');
                                }
                              }}
                              style={{
                                background: '#27ae60', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '8px', cursor: canCollect ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                              }}
                            >
                              Collect UPI
                            </button>
                            <button
                              disabled={!canCollect}
                              onClick={() => handleCollectPayment(order._id, 'Cash')}
                              style={{
                                background: '#e67e22', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '8px', cursor: canCollect ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                              }}
                            >
                              Collect Cash
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 2: COMPLETED ORDER HISTORY ======================= */}
      {tabParam === 'receipts' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Header & Date Picker Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                🧾 Order History & Bills
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Showing completed & paid orders for <strong>{new Date(historyDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </p>
            </div>

            {/* Date Pickers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setHistoryDate(todayDateStr)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: historyDate === todayDateStr ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: historyDate === todayDateStr ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: historyDate === todayDateStr ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Today
              </button>
              <button
                onClick={() => setHistoryDate(yesterdayDateStr)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: historyDate === yesterdayDateStr ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: historyDate === yesterdayDateStr ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: historyDate === yesterdayDateStr ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Yesterday
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px 10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>📅</span>
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => {
                    if (e.target.value) setHistoryDate(e.target.value);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <button
                onClick={() => fetchCompletedLogs(historyDate)}
                title="Refresh bills for selected date"
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Daily Summary Ribbon */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            background: 'var(--bg-secondary)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Orders</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {historySummary.totalOrders}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Value</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                ₹{historySummary.totalRevenue.toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Paid Amount</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#27ae60', marginTop: '2px' }}>
                ₹{historySummary.paidRevenue.toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Pending / Ready</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#e67e22', marginTop: '2px' }}>
                ₹{historySummary.pendingRevenue.toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Dishes Ordered</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {historySummary.totalItems} items
              </div>
            </div>
          </div>

          {/* Search & Status/Payment Filters Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Search input */}
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by Table, Token #, Bill ID, Customer..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    paddingRight: historySearch ? '36px' : '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--color-text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All (${historySummary.totalOrders})` },
                  { id: 'ready', label: `Ready (${historySummary.readyCount})` },
                  { id: 'paid', label: `Paid (${historySummary.paidCount})` },
                  { id: 'in_progress', label: `Placed (${historySummary.inProgressCount})` }
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setHistoryStatusFilter(pill.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: historyStatusFilter === pill.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: historyStatusFilter === pill.id ? 'var(--color-primary)' : 'var(--bg-secondary)',
                      color: historyStatusFilter === pill.id ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Orders Content */}
          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Fetching orders for {historyDate}...</p>
            </div>
          ) : filteredCompletedLogs.length === 0 ? (
            <div style={{
              padding: '50px 20px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px dashed var(--color-border)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🧾</div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '15px' }}>
                No orders found
              </div>
              <p style={{ fontSize: '12.5px', marginTop: '4px' }}>
                {historySearch || historyStatusFilter !== 'all' || historyPaymentFilter !== 'all'
                  ? 'No bills match your current search or status filter.'
                  : `No orders were recorded on ${historyDate}.`}
              </p>
              {(historySearch || historyStatusFilter !== 'all' || historyPaymentFilter !== 'all') && (
                <button
                  onClick={() => { setHistorySearch(''); setHistoryStatusFilter('all'); setHistoryPaymentFilter('all'); }}
                  className="btn btn-secondary"
                  style={{ width: 'auto', marginTop: '10px', fontSize: '12px', padding: '6px 14px' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paginatedCompletedLogs.map((log) => {
                const isTableOrder = log.tableNumber && log.tableNumber !== 'Takeaway' && log.tableNumber !== 'Walk-in';
                const timeStr = log.paidAt
                  ? new Date(log.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const tokenStr = log.tokenNumber ? `#${log.tokenNumber}` : `#${String(log._id).slice(-4).toUpperCase()}`;
                const isPaid = log.paymentStatus === 'Paid' || log.status === 'Completed';

                return (
                  <div
                    key={log._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-secondary)',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border)',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ minWidth: '220px', flex: '1 1 300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: isTableOrder ? 'var(--color-primary)' : '#7f8c8d',
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700
                        }}>
                          {isTableOrder ? `Table ${log.tableNumber}` : log.tableNumber || 'Takeaway'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {tokenStr}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          🕒 {timeStr}
                        </span>
                        
                        {/* Status Badge */}
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          background: log.status === 'Ready' ? 'rgba(46, 204, 113, 0.15)' : isPaid ? 'rgba(39, 174, 96, 0.2)' : 'rgba(52, 152, 219, 0.15)',
                          color: log.status === 'Ready' ? '#27ae60' : isPaid ? '#2ecc71' : '#2980b9'
                        }}>
                          {log.status === 'Ready' ? '✅ Ready to Serve' : isPaid ? '💰 Paid & Completed' : `⏳ ${log.status}`}
                        </span>

                        {/* Payment Method Badge */}
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          background: isPaid ? 'rgba(39, 174, 96, 0.12)' : 'rgba(230, 126, 34, 0.15)',
                          color: isPaid ? '#27ae60' : '#e67e22'
                        }}>
                          {isPaid ? `Paid via ${log.paymentMethod || 'Cash'}` : 'Payment Pending'}
                        </span>
                      </div>

                      {/* Items Preview */}
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                        {(log.items || []).map((it, idx) => (
                          <span key={idx} style={{ marginRight: '8px' }}>
                            <strong style={{ color: 'var(--color-text-primary)' }}>{it.quantity}x</strong> {it.name}
                            {idx < (log.items.length - 1) ? ',' : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: isPaid ? '#27ae60' : '#e67e22', fontSize: '1.15rem', fontWeight: 800 }}>
                          ₹{Number(log.totalAmount).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)' }}>
                          ID: {String(log._id).slice(-6).toUpperCase()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => printPOSReceipt(log, user, cafeInfo, currentBranch)}
                          style={{
                            background: 'var(--color-primary)',
                            color: 'white',
                            border: 'none',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Reprint Customer POS Bill"
                        >
                          🖨️ POS
                        </button>
                        <button
                          onClick={() => printKOT(log, user, cafeInfo, currentBranch)}
                          style={{
                            background: 'var(--bg-card)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                          title="Reprint Kitchen KOT Ticket"
                        >
                          🧾 KOT
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {filteredCompletedLogs.length > historyPerPage && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                Showing <strong>{((historyPage - 1) * historyPerPage) + 1}</strong> – <strong>{Math.min(historyPage * historyPerPage, filteredCompletedLogs.length)}</strong> of <strong>{filteredCompletedLogs.length}</strong> bills
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: historyPage === 1 ? 'transparent' : 'var(--bg-secondary)',
                    color: historyPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: historyPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ◀ Prev
                </button>

                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', padding: '0 8px' }}>
                  Page {historyPage} of {totalHistoryPages}
                </span>

                <button
                  disabled={historyPage === totalHistoryPages}
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: historyPage === totalHistoryPages ? 'transparent' : 'var(--bg-secondary)',
                    color: historyPage === totalHistoryPages ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: historyPage === totalHistoryPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======================= TAB 3: CAFE MENU ======================= */}
      {tabParam === 'menu' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            📖 Cafe Menu & Recipes
          </h3>

          {menuLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
              <p>Loading menu...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {menuItems.map((item) => (
                <div key={item._id} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <img
                    src={item.image ? getAssetUrl(item.image) : '/images/default-food.png'}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = '/images/default-food.png'; }}
                  />
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--color-text-primary)' }}>{item.name}</strong>
                      <span style={{ color: '#27ae60', fontSize: '13px', fontWeight: 'bold' }}>₹{item.price}</span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', minHeight: '34px', display: 'block' }}>
                      {item.description || 'No recipe details uploaded.'}
                    </span>
                    
                    {/* Chef stock outage reporter */}
                    {['chef', 'admin', 'owner', 'manager'].includes(userRole) && (
                      <button
                        onClick={() => { setSelectedItemForShortage(item); setShowShortageModal(true); }}
                        style={{
                          background: 'transparent', border: '1px dashed var(--color-danger)', color: 'var(--color-danger)',
                          padding: '6px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginTop: '6px'
                        }}
                      >
                        ⚠️ Report Out of Stock
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 4: INGREDIENT STOCK ======================= */}
      {tabParam === 'inventory' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
                📦 Ingredient Stock Levels
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                Staff access: add ingredients, update stock, log purchases & record kitchen wastage.
              </p>
            </div>
            <button
              onClick={() => {
                setAddInventoryForm({ name: '', unit: 'kg', quantity: '', reorderLevel: '5', costPrice: '', category: 'General', supplier: '', supplierPhone: '' });
                setShowAddInventoryModal(true);
              }}
              style={{
                background: 'var(--color-primary)', color: 'white', border: 'none',
                padding: '9px 16px', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              ➕ Add Ingredient
            </button>
          </div>

          {inventoryLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
              <p>Loading inventory...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              No inventory ingredients configured. Click <strong>+ Add Ingredient</strong> to add your first stock item.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '640px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    <th style={{ padding: '10px 8px' }}>Item Name</th>
                    <th style={{ padding: '10px 8px' }}>Category</th>
                    <th style={{ padding: '10px 8px' }}>Current Stock</th>
                    <th style={{ padding: '10px 8px' }}>Min Alert Level</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((inv) => {
                    const currentStock = inv.quantity !== undefined ? inv.quantity : (inv.stock ?? 0);
                    const minAlert = inv.reorderLevel !== undefined ? inv.reorderLevel : (inv.minStock ?? 0);
                    const isOutOfStock = currentStock <= 0;
                    const isLow = !isOutOfStock && currentStock <= minAlert;
                    return (
                      <tr key={inv._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{inv.name}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>{inv.category || 'General'}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ fontWeight: 700, color: isOutOfStock ? '#e74c3c' : (isLow ? '#f39c12' : 'var(--color-text-primary)') }}>
                            {currentStock}
                          </span>{' '}
                          {inv.unit || 'units'}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
                          {minAlert} {inv.unit || 'units'}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            background: isOutOfStock ? 'rgba(231, 76, 60, 0.15)' : (isLow ? 'rgba(243, 156, 18, 0.15)' : 'rgba(46, 204, 113, 0.15)'),
                            color: isOutOfStock ? '#e74c3c' : (isLow ? '#f39c12' : '#27ae60'),
                            padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold'
                          }}>
                            {isOutOfStock ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setSelectedInventoryItem(inv);
                                setPurchaseForm({ quantityAdded: '', costPrice: inv.costPrice || '', supplier: inv.supplier || '', notes: '' });
                                setShowPurchaseModal(true);
                              }}
                              style={{
                                background: 'rgba(39, 174, 96, 0.15)', color: '#27ae60', border: '1px solid #27ae60',
                                padding: '4px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer'
                              }}
                              title="Purchase and add to stock"
                            >
                              + Purchase
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInventoryItem(inv);
                                setWastageForm({ quantityWasted: '', type: 'spoiled', reason: '' });
                                setShowWastageModal(true);
                              }}
                              style={{
                                background: 'rgba(231, 76, 60, 0.15)', color: '#e74c3c', border: '1px solid #e74c3c',
                                padding: '4px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer'
                              }}
                              title="Record spoiled or wasted stock"
                            >
                              ⚠️ Wastage
                            </button>
                            <button
                              onClick={() => {
                                const qty = inv.quantity !== undefined ? inv.quantity : (inv.stock || 0);
                                const unitCost = inv.costPrice || 0;
                                const totalCost = (qty > 0 && unitCost > 0) ? Number((Number(qty) * Number(unitCost)).toFixed(2)) : '';
                                setEditingInventoryItem({
                                  _id: inv._id,
                                  name: inv.name,
                                  unit: inv.unit || 'kg',
                                  quantity: qty,
                                  reorderLevel: inv.reorderLevel !== undefined ? inv.reorderLevel : (inv.minStock || 5),
                                  costPrice: unitCost,
                                  totalCost: totalCost,
                                  category: inv.category || 'General',
                                  supplier: inv.supplier || '',
                                  supplierPhone: inv.supplierPhone || ''
                                });
                                setShowEditInventoryModal(true);
                              }}
                              style={{
                                background: 'rgba(52, 152, 219, 0.15)', color: '#2980b9', border: '1px solid #2980b9',
                                padding: '4px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer'
                              }}
                              title="Edit all fields of ingredient"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================= MODAL: ADD ITEMS TO ORDER ======================= */}
      {showAddItemsModal && selectedOrderForAddItems && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            width: '100%', maxWidth: '540px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>
                  ➕ Add Items to Order
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '3px' }}>
                  Table {selectedOrderForAddItems.tableNumber} · Order #{selectedOrderForAddItems._id.slice(-6).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => { setShowAddItemsModal(false); setSelectedOrderForAddItems(null); setItemsToAdd([]); }}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <input
                type="text"
                placeholder="Search menu items..."
                value={addItemSearchQuery}
                onChange={(e) => setAddItemSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                  color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none'
                }}
              />
            </div>

            {/* Menu Items List */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {menuLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--color-text-secondary)' }}>
                  Loading menu items...
                </div>
              ) : menuItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--color-text-secondary)' }}>
                  No menu items found.
                </div>
              ) : (
                menuItems
                  .filter((m) => !addItemSearchQuery || m.name.toLowerCase().includes(addItemSearchQuery.toLowerCase()))
                  .map((m) => {
                    const existingInCart = itemsToAdd.find((it) => it._id === m._id);
                    const qty = existingInCart ? existingInCart.quantity : 0;

                    return (
                      <div
                        key={m._id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: '10px',
                          background: qty > 0 ? 'rgba(39, 174, 96, 0.08)' : 'var(--bg-secondary)',
                          border: `1px solid ${qty > 0 ? '#27ae60' : 'var(--color-border)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={m.image ? getAssetUrl(m.image) : '/images/default-food.png'}
                            alt={m.name}
                            style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                            onError={(e) => { e.target.src = '/images/default-food.png'; }}
                          />
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)', display: 'block' }}>
                              {m.name}
                            </strong>
                            <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: 700 }}>
                              ₹{m.price}
                            </span>
                          </div>
                        </div>

                        {qty === 0 ? (
                          <button
                            onClick={() => {
                              setItemsToAdd([...itemsToAdd, { ...m, quantity: 1 }]);
                            }}
                            style={{
                              background: 'var(--color-primary)', color: 'white', border: 'none',
                              padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                              fontWeight: 700, fontSize: '12px'
                            }}
                          >
                            + Add
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                if (qty <= 1) {
                                  setItemsToAdd(itemsToAdd.filter((it) => it._id !== m._id));
                                } else {
                                  setItemsToAdd(itemsToAdd.map((it) => it._id === m._id ? { ...it, quantity: it.quantity - 1 } : it));
                                }
                              }}
                              style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                border: '1px solid var(--color-border)', background: 'var(--bg-card)',
                                color: 'var(--color-text-primary)', fontWeight: 800, cursor: 'pointer'
                              }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                              {qty}
                            </span>
                            <button
                              onClick={() => {
                                setItemsToAdd(itemsToAdd.map((it) => it._id === m._id ? { ...it, quantity: it.quantity + 1 } : it));
                              }}
                              style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                border: 'none', background: 'var(--color-primary)',
                                color: 'white', fontWeight: 800, cursor: 'pointer'
                              }}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  {itemsToAdd.length} item(s) selected
                </span>
                <strong style={{ fontSize: '14px', color: '#27ae60' }}>
                  + ₹{itemsToAdd.reduce((sum, it) => sum + it.price * it.quantity, 0)}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddItemsModal(false); setSelectedOrderForAddItems(null); setItemsToAdd([]); }}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                    background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={itemsToAdd.length === 0 || orderActionLoading}
                  onClick={handleSaveAddItems}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    background: itemsToAdd.length === 0 || orderActionLoading ? '#bdc3c7' : 'var(--color-primary)',
                    color: 'white', cursor: itemsToAdd.length === 0 || orderActionLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '12.5px'
                  }}
                >
                  {orderActionLoading ? 'Adding...' : 'Add to Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDIT ORDER ======================= */}
      {showEditOrderModal && editingOrder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            width: '100%', maxWidth: '480px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>
                  ✏️ Edit Order
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '3px' }}>
                  #{editingOrder._id.slice(-6).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => { setShowEditOrderModal(false); setEditingOrder(null); }}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form Content */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Table Number */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Table Number / Location
                </label>
                <input
                  type="text"
                  value={editingOrder.tableNumber}
                  onChange={(e) => setEditingOrder({ ...editingOrder, tableNumber: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                    color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Special Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Special Instructions / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Less sugar, extra spicy"
                  value={editingOrder.specialInstructions}
                  onChange={(e) => setEditingOrder({ ...editingOrder, specialInstructions: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                    color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Items List with Quantity Controls */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Order Items
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {editingOrder.items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '8px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--color-border)'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)', display: 'block' }}>
                          {it.name}
                        </strong>
                        <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                          ₹{it.price} each = ₹{(it.price * it.quantity).toFixed(2)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (it.quantity <= 1) {
                              setEditingOrder({
                                ...editingOrder,
                                items: editingOrder.items.filter((_, i) => i !== idx)
                              });
                            } else {
                              setEditingOrder({
                                ...editingOrder,
                                items: editingOrder.items.map((item, i) => i === idx ? { ...item, quantity: item.quantity - 1 } : item)
                              });
                            }
                          }}
                          style={{
                            width: '26px', height: '26px', borderRadius: '6px',
                            border: '1px solid var(--color-border)', background: 'var(--bg-card)',
                            color: 'var(--color-text-primary)', fontWeight: 800, cursor: 'pointer'
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder({
                              ...editingOrder,
                              items: editingOrder.items.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item)
                            });
                          }}
                          style={{
                            width: '26px', height: '26px', borderRadius: '6px',
                            border: 'none', background: 'var(--color-primary)',
                            color: 'white', fontWeight: 800, cursor: 'pointer'
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder({
                              ...editingOrder,
                              items: editingOrder.items.filter((_, i) => i !== idx)
                            });
                          }}
                          style={{
                            marginLeft: '6px', background: 'transparent', border: 'none',
                            color: '#e74c3c', cursor: 'pointer', fontSize: '14px'
                          }}
                          title="Remove item"
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Updated Total:
                </span>
                <strong style={{ fontSize: '15px', color: '#27ae60' }}>
                  ₹{editingOrder.items.reduce((s, it) => s + it.price * it.quantity, 0).toFixed(2)}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditOrderModal(false); setEditingOrder(null); }}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                    background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editingOrder.items.length === 0 || orderActionLoading}
                  onClick={handleSaveEditOrder}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    background: editingOrder.items.length === 0 || orderActionLoading ? '#bdc3c7' : 'var(--color-primary)',
                    color: 'white', cursor: editingOrder.items.length === 0 || orderActionLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '12.5px'
                  }}
                >
                  {orderActionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: TAKE ORDER ======================= */}
      {showTakeOrderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>Take New Order</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Enter Table Number (leave blank for takeaway / walk-in):
            </p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. 8"
              value={takeOrderTable}
              onChange={(e) => setTakeOrderTable(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid var(--color-border)', marginBottom: '20px',
                background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)',
                fontFamily: 'inherit', outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`;
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => { setShowTakeOrderModal(false); setTakeOrderTable(''); }}
                style={{
                  padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                  background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px',
                  color: 'var(--color-text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => window.location.href = `/?table=${takeOrderTable || 'Takeaway'}&source=staff&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`}
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: 'none',
                  background: 'var(--color-primary)', color: 'white', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '12.5px'
                }}
              >
                Open Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REPORT INGREDIENT SHORTAGE ======================= */}
      {showShortageModal && selectedItemForShortage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <form onSubmit={handleShortageSubmit} style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '380px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>⚠️ Report Out of Stock</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Are you sure <strong>{selectedItemForShortage.name}</strong> is out of stock? Enter a reason for the log:
            </p>
            <input
              required
              autoFocus
              type="text"
              placeholder="e.g. Out of milk supply"
              value={shortageReason}
              onChange={(e) => setShortageReason(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => { setShowShortageModal(false); setSelectedItemForShortage(null); setShortageReason(''); }}
                style={{
                  padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                  background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px',
                  color: 'var(--color-text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: 'none',
                  background: 'var(--color-danger)', color: 'white', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '12.5px'
                }}
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
      {showUpiModal && upiOrder && paymentInfo.upiId && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>Scan to Pay</h3>
            <p style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '20px' }}>Ask the customer to scan this QR code with their UPI app (GPay, PhonePe, Paytm).</p>
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
              <QRCodeSVG 
                id="staff-upi-qr-code"
                value={`upi://pay?pa=${paymentInfo.upiId}&pn=${encodeURIComponent(cafeInfo?.name || 'Cafe')}&am=${upiOrder.totalAmount}&cu=INR&tn=Order%20${upiOrder.orderNumber}`} 
                size={200} 
                level="M" 
                includeMargin={true}
              />
            </div>
            
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#2c3e50', marginBottom: '8px' }}>
              ₹{upiOrder.totalAmount.toFixed(2)}
            </div>
            <div style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '16px' }}>
              Order #{upiOrder.orderNumber}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleDownloadUpiQr}
                style={{ padding: '10px', background: '#34495e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                📥 Download QR Code
              </button>
              <button 
                onClick={() => {
                  handleCollectPayment(upiOrder._id, 'UPI');
                  setShowUpiModal(false);
                }}
                style={{ padding: '14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                Confirm Payment Received
              </button>
              <button 
                onClick={() => setShowUpiModal(false)}
                style={{ padding: '12px', background: '#ecf0f1', color: '#7f8c8d', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ADD INGREDIENT ======================= */}
      {showAddInventoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 700 }}>
              ➕ Add New Ingredient
            </h3>
            <form onSubmit={handleAddInventoryItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Ingredient Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Arabica Coffee Beans"
                  value={addInventoryForm.name}
                  onChange={(e) => setAddInventoryForm({ ...addInventoryForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Unit *
                  </label>
                  <select
                    value={addInventoryForm.unit}
                    onChange={(e) => setAddInventoryForm({ ...addInventoryForm, unit: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  >
                    {['kg', 'g', 'l', 'ml', 'pcs', 'packets', 'cans', 'boxes'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={addInventoryForm.category}
                    onChange={(e) => setAddInventoryForm({ ...addInventoryForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="General">General</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Produce">Produce</option>
                    <option value="Dry Goods">Dry Goods</option>
                    {categories.map((c) => (
                      <option key={c._id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Initial Stock ({addInventoryForm.unit}) *
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="0"
                    value={addInventoryForm.quantity}
                    onChange={(e) => {
                      const qty = e.target.value === '' ? '' : Number(e.target.value);
                      let newUnitCost = addInventoryForm.costPrice;
                      let newTotal = addInventoryForm.totalCost;
                      if (addInventoryForm.totalCost && qty > 0) {
                        newUnitCost = Number((Number(addInventoryForm.totalCost) / qty).toFixed(4));
                      } else if (addInventoryForm.costPrice && qty > 0) {
                        newTotal = Number((Number(addInventoryForm.costPrice) * qty).toFixed(2));
                      }
                      setAddInventoryForm({
                        ...addInventoryForm,
                        quantity: e.target.value,
                        costPrice: newUnitCost,
                        totalCost: newTotal
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Safety Minimum ({addInventoryForm.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="5"
                    value={addInventoryForm.reorderLevel}
                    onChange={(e) => setAddInventoryForm({ ...addInventoryForm, reorderLevel: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              {/* Total Amount Paid & Unit Cost Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '4px' }}>
                    Total Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 100"
                    value={addInventoryForm.totalCost ?? ''}
                    onChange={(e) => {
                      const tot = e.target.value === '' ? '' : Number(e.target.value);
                      const qty = Number(addInventoryForm.quantity || 0);
                      const computedUnitCost = (tot !== '' && qty > 0) ? Number((tot / qty).toFixed(4)) : (addInventoryForm.costPrice || '');
                      setAddInventoryForm({
                        ...addInventoryForm,
                        totalCost: e.target.value,
                        costPrice: computedUnitCost
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
                    Total bill for stock (e.g. ₹100 for 5000g)
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Unit Cost Price (₹ / {addInventoryForm.unit || 'unit'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={addInventoryForm.costPrice ?? ''}
                    onChange={(e) => {
                      const unitP = e.target.value === '' ? '' : Number(e.target.value);
                      const qty = Number(addInventoryForm.quantity || 0);
                      const computedTotal = (unitP !== '' && qty > 0) ? Number((unitP * qty).toFixed(2)) : (addInventoryForm.totalCost || '');
                      setAddInventoryForm({
                        ...addInventoryForm,
                        costPrice: e.target.value,
                        totalCost: computedTotal
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
                    Auto-calculated per {addInventoryForm.unit || 'unit'}
                  </span>
                </div>
              </div>

              {Number(addInventoryForm.quantity || 0) > 0 && Number(addInventoryForm.costPrice || 0) > 0 && (
                <div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid #2ECC71', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span>✓ <strong>Calculated Cost:</strong> ₹{addInventoryForm.costPrice} per {addInventoryForm.unit || 'unit'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>(₹{Number((Number(addInventoryForm.costPrice) * Number(addInventoryForm.quantity)).toFixed(2))} total for {addInventoryForm.quantity} {addInventoryForm.unit || 'units'})</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddInventoryModal(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inventoryActionLoading}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
                >
                  {inventoryActionLoading ? 'Saving...' : 'Save Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDIT INGREDIENT ======================= */}
      {showEditInventoryModal && editingInventoryItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--color-text-primary)', fontSize: '1.15rem', fontWeight: 700 }}>
              ✏️ Edit Ingredient
            </h3>
            <form onSubmit={handleEditInventoryItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Ingredient Name *
                </label>
                <input
                  required
                  type="text"
                  value={editingInventoryItem.name}
                  onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Unit
                  </label>
                  <select
                    value={editingInventoryItem.unit}
                    onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, unit: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  >
                    {['kg', 'g', 'l', 'ml', 'pcs', 'packets', 'cans', 'boxes'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={editingInventoryItem.category}
                    onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="General">General</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Produce">Produce</option>
                    <option value="Dry Goods">Dry Goods</option>
                    {categories.map((c) => (
                      <option key={c._id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Current Stock ({editingInventoryItem.unit}) *
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={editingInventoryItem.quantity}
                    onChange={(e) => {
                      const qty = e.target.value === '' ? '' : Number(e.target.value);
                      let newUnitCost = editingInventoryItem.costPrice;
                      let newTotal = editingInventoryItem.totalCost;
                      if (editingInventoryItem.totalCost && qty > 0) {
                        newUnitCost = Number((Number(editingInventoryItem.totalCost) / qty).toFixed(4));
                      } else if (editingInventoryItem.costPrice && qty > 0) {
                        newTotal = Number((Number(editingInventoryItem.costPrice) * qty).toFixed(2));
                      }
                      setEditingInventoryItem({
                        ...editingInventoryItem,
                        quantity: e.target.value,
                        costPrice: newUnitCost,
                        totalCost: newTotal
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Safety Minimum ({editingInventoryItem.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingInventoryItem.reorderLevel}
                    onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, reorderLevel: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>

              {/* Total Amount Paid & Unit Cost Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '4px' }}>
                    Total Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 100"
                    value={editingInventoryItem.totalCost ?? ''}
                    onChange={(e) => {
                      const tot = e.target.value === '' ? '' : Number(e.target.value);
                      const qty = Number(editingInventoryItem.quantity || 0);
                      const computedUnitCost = (tot !== '' && qty > 0) ? Number((tot / qty).toFixed(4)) : (editingInventoryItem.costPrice || '');
                      setEditingInventoryItem({
                        ...editingInventoryItem,
                        totalCost: e.target.value,
                        costPrice: computedUnitCost
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
                    Total bill for stock (e.g. ₹100 for 5000g)
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    Unit Cost Price (₹ / {editingInventoryItem.unit || 'unit'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingInventoryItem.costPrice ?? ''}
                    onChange={(e) => {
                      const unitP = e.target.value === '' ? '' : Number(e.target.value);
                      const qty = Number(editingInventoryItem.quantity || 0);
                      const computedTotal = (unitP !== '' && qty > 0) ? Number((unitP * qty).toFixed(2)) : (editingInventoryItem.totalCost || '');
                      setEditingInventoryItem({
                        ...editingInventoryItem,
                        costPrice: e.target.value,
                        totalCost: computedTotal
                      });
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
                    Auto-calculated per {editingInventoryItem.unit || 'unit'}
                  </span>
                </div>
              </div>

              {Number(editingInventoryItem.quantity || 0) > 0 && Number(editingInventoryItem.costPrice || 0) > 0 && (
                <div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid #2ECC71', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span>✓ <strong>Calculated Cost:</strong> ₹{editingInventoryItem.costPrice} per {editingInventoryItem.unit || 'unit'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>(₹{Number((Number(editingInventoryItem.costPrice) * Number(editingInventoryItem.quantity)).toFixed(2))} total for {editingInventoryItem.quantity} {editingInventoryItem.unit || 'units'})</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditInventoryModal(false); setEditingInventoryItem(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inventoryActionLoading}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
                >
                  {inventoryActionLoading ? 'Saving...' : 'Update Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: PURCHASE STOCK ======================= */}
      {showPurchaseModal && selectedInventoryItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#27ae60', fontSize: '1.15rem', fontWeight: 700 }}>
              📦 Purchase & Restock
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Adding stock for: <strong>{selectedInventoryItem.name}</strong> (Current: {selectedInventoryItem.quantity !== undefined ? selectedInventoryItem.quantity : selectedInventoryItem.stock} {selectedInventoryItem.unit})
            </p>
            <form onSubmit={handleRecordPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Quantity to Add ({selectedInventoryItem.unit}) *
                </label>
                <input
                  required
                  autoFocus
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="e.g. 5"
                  value={purchaseForm.quantityAdded}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantityAdded: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Unit Cost Price (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={purchaseForm.costPrice}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, costPrice: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Metro Cash & Carry"
                  value={purchaseForm.supplier}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Notes / Bill Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #4482"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowPurchaseModal(false); setSelectedInventoryItem(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inventoryActionLoading}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#27ae60', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
                >
                  {inventoryActionLoading ? 'Saving...' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: LOG WASTAGE ======================= */}
      {showWastageModal && selectedInventoryItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#e74c3c', fontSize: '1.15rem', fontWeight: 700 }}>
              ⚠️ Record Stock Wastage
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Logging wasted quantity for: <strong>{selectedInventoryItem.name}</strong>
            </p>
            <form onSubmit={handleRecordWastage} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Quantity Wasted ({selectedInventoryItem.unit}) *
                </label>
                <input
                  required
                  autoFocus
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="e.g. 1.5"
                  value={wastageForm.quantityWasted}
                  onChange={(e) => setWastageForm({ ...wastageForm, quantityWasted: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Wastage Type
                </label>
                <select
                  value={wastageForm.type}
                  onChange={(e) => setWastageForm({ ...wastageForm, type: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                >
                  <option value="spoiled">Spoiled / Expired</option>
                  <option value="spill">Spilled / Dropped</option>
                  <option value="burn">Burnt / Preparation Error</option>
                  <option value="damage">Damaged Packaging</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Reason / Explanation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milk turned sour in fridge"
                  value={wastageForm.reason}
                  onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowWastageModal(false); setSelectedInventoryItem(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inventoryActionLoading}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
                >
                  {inventoryActionLoading ? 'Saving...' : 'Record Wastage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffOrderWorkspace;

