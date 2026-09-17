import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import {
  getOrders,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordPurchase,
  recordWastage,
  reportShortage,
  getInventoryCategories,
  getMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadMenuItemImage,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAssetUrl,
  getCafeInfo,
  getPaymentInfo
} from '../services/api';
import socket, { connectSocket } from '../socket';
import { printPOSReceipt, printKOT } from '../utils/printHelpers';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/App.css';

const StaffOrderWorkspace = () => {
  const { user } = useAuth();
  const { activeBranchId, branches } = useBranch();
  const userRole = user?.role?.toLowerCase() || '';
  
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
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState('all');
  const [isMenuSubmitting, setIsMenuSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // Menu Modals
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [showEditMenuModal, setShowEditMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    price: '',
    makingCost: '',
    category: 'Signature Chai',
    available: true,
    image: '',
    recipe: [],
    preparationTime: 10
  });

  // Recipe Ingredient Mapping State
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');

  // Category Management Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  // Inventory Filtering & Search
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState('all');
  const [selectedInventoryStatus, setSelectedInventoryStatus] = useState('all');

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
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

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
    totalCost: '',
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

  // Load menu categories
  const fetchMenuCategories = useCallback(async () => {
    try {
      const res = await getCategories();
      if (res && res.success) {
        setMenuCategories(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch menu categories:', err);
    }
  }, []);

  // Load menu items & categories
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const [menuRes, catRes] = await Promise.all([
        getMenu(),
        getCategories().catch(() => ({ success: false }))
      ]);
      if (menuRes && menuRes.success) {
        setMenuItems(menuRes.data);
      }
      if (catRes && catRes.success) {
        setMenuCategories(catRes.data);
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // Memoized Category Stats & Filter for Menu
  const menuCategoryStats = useMemo(() => {
    const counts = {};
    (menuItems || []).forEach((item) => {
      const cat = item.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const allCount = (menuItems || []).length;
    const catNames = Array.from(new Set([
      ...menuCategories.map((c) => (typeof c === 'string' ? c : c.name)),
      ...Object.keys(counts)
    ])).filter(Boolean);

    return {
      allCount,
      list: catNames.map((name) => ({ name, count: counts[name] || 0 }))
    };
  }, [menuCategories, menuItems]);

  // Zero-latency instant search & category filter for Menu (Mobile optimized)
  const filteredMenuItems = useMemo(() => {
    const search = menuSearch.trim().toLowerCase();
    return (menuItems || []).filter((item) => {
      const matchesSearch = !search ||
        item.name.toLowerCase().includes(search) ||
        (item.category || '').toLowerCase().includes(search) ||
        (item.description || '').toLowerCase().includes(search);

      const matchesCategory = selectedMenuCategory === 'all' ||
        (item.category || '').toLowerCase().trim() === selectedMenuCategory.toLowerCase().trim();

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, menuSearch, selectedMenuCategory]);

  // Zero-latency instant search & category/status filter for Inventory (Mobile optimized)
  const filteredInventory = useMemo(() => {
    const search = inventorySearch.trim().toLowerCase();
    return (inventory || []).filter((inv) => {
      const currentStock = inv.quantity !== undefined ? inv.quantity : (inv.stock ?? 0);
      const minAlert = inv.reorderLevel !== undefined ? inv.reorderLevel : (inv.minStock ?? 0);
      const isOutOfStock = currentStock <= 0;
      const isLow = !isOutOfStock && currentStock <= minAlert;

      const matchesSearch = !search ||
        inv.name.toLowerCase().includes(search) ||
        (inv.category || '').toLowerCase().includes(search) ||
        (inv.supplier || '').toLowerCase().includes(search);

      const matchesCategory = selectedInventoryCategory === 'all' ||
        (inv.category || '').toLowerCase().trim() === selectedInventoryCategory.toLowerCase().trim();

      let matchesStatus = true;
      if (selectedInventoryStatus === 'out') matchesStatus = isOutOfStock;
      else if (selectedInventoryStatus === 'low') matchesStatus = isLow;
      else if (selectedInventoryStatus === 'in') matchesStatus = !isOutOfStock && !isLow;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventory, inventorySearch, selectedInventoryCategory, selectedInventoryStatus]);

  // Menu Management Handlers
  const handleAddIngredientToNewItem = () => {
    if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity) <= 0) {
      alert('Please select an ingredient and enter a valid quantity.');
      return;
    }
    const currentRecipe = newMenuItem.recipe || [];
    const exists = currentRecipe.some((i) => i.name === selectedIngredient);
    if (exists) {
      alert('This ingredient is already mapped. You can edit its quantity in the list below.');
      return;
    }
    const updatedRecipe = [...currentRecipe, { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
    const calculatedCost = updatedRecipe.reduce((sum, ing) => {
      const inv = inventory.find((i) => i.name === ing.name);
      return sum + (Number(ing.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
    }, 0);

    setNewMenuItem({
      ...newMenuItem,
      recipe: updatedRecipe,
      makingCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : newMenuItem.makingCost
    });
    setSelectedIngredient('');
    setIngredientQuantity('');
  };

  const handleRemoveIngredientFromNewItem = (ingName) => {
    const updatedRecipe = (newMenuItem.recipe || []).filter((i) => i.name !== ingName);
    const calculatedCost = updatedRecipe.reduce((sum, ing) => {
      const inv = inventory.find((i) => i.name === ing.name);
      return sum + (Number(ing.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
    }, 0);
    setNewMenuItem({
      ...newMenuItem,
      recipe: updatedRecipe,
      makingCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : (updatedRecipe.length === 0 ? '0' : newMenuItem.makingCost)
    });
  };

  const handleAddIngredientToEditingItem = () => {
    if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity) <= 0) {
      alert('Please select an ingredient and enter a valid quantity.');
      return;
    }
    const currentRecipe = editingMenuItem.recipe || [];
    const exists = currentRecipe.some((i) => i.name === selectedIngredient);
    if (exists) {
      alert('This ingredient is already mapped. You can edit its quantity in the list below.');
      return;
    }
    const updatedRecipe = [...currentRecipe, { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
    const calculatedCost = updatedRecipe.reduce((sum, ing) => {
      const inv = inventory.find((i) => i.name === ing.name);
      return sum + (Number(ing.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
    }, 0);

    setEditingMenuItem({
      ...editingMenuItem,
      recipe: updatedRecipe,
      makingCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : editingMenuItem.makingCost
    });
    setSelectedIngredient('');
    setIngredientQuantity('');
  };

  const handleRemoveIngredientFromEditingItem = (ingName) => {
    const updatedRecipe = (editingMenuItem.recipe || []).filter((i) => i.name !== ingName);
    const calculatedCost = updatedRecipe.reduce((sum, ing) => {
      const inv = inventory.find((i) => i.name === ing.name);
      return sum + (Number(ing.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
    }, 0);
    setEditingMenuItem({
      ...editingMenuItem,
      recipe: updatedRecipe,
      makingCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : (updatedRecipe.length === 0 ? '0' : editingMenuItem.makingCost)
    });
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (isMenuSubmitting) return;
    if (!newMenuItem.name || newMenuItem.price === undefined || newMenuItem.price === '') {
      alert('Please fill out required fields (Dish Name, Price).');
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const branchIdToSave = activeBranchId === 'all' ? 'default' : (activeBranchId || 'default');
      const response = await createMenuItem({
        ...newMenuItem,
        price: parseFloat(newMenuItem.price) || 0,
        makingCost: parseFloat(newMenuItem.makingCost) || 0,
        preparationTime: parseInt(newMenuItem.preparationTime, 10) || 10,
        recipe: newMenuItem.recipe || [],
        branchId: branchIdToSave
      });
      if (response.success && response.data) {
        const cleanId = String(response.data._id || response.data.id);
        const itemWithId = { ...response.data, id: cleanId, _id: cleanId };
        setMenuItems((prev) => {
          const exists = prev.some((it) => String(it._id || it.id) === cleanId);
          return exists ? prev.map((it) => String(it._id || it.id) === cleanId ? itemWithId : it) : [...prev, itemWithId];
        });
        setShowAddMenuModal(false);
        setNewMenuItem({
          name: '',
          price: '',
          makingCost: '',
          category: menuCategories[0]?.name || 'Signature Chai',
          available: true,
          image: '',
          recipe: [],
          preparationTime: 10
        });
        alert('Dish added to menu successfully!');
      } else {
        alert(response?.message || 'Failed to create menu item.');
      }
    } catch (err) {
      console.error('Error creating menu item:', err);
      alert(err.response?.data?.message || 'Error creating menu item.');
    } finally {
      setIsMenuSubmitting(false);
    }
  };

  const handleEditMenuItem = async (e) => {
    e.preventDefault();
    if (isMenuSubmitting || !editingMenuItem) return;
    if (!editingMenuItem.name || editingMenuItem.price === undefined || editingMenuItem.price === '') {
      alert('Please fill out required fields (Dish Name, Price).');
      return;
    }
    setIsMenuSubmitting(true);
    try {
      const editId = editingMenuItem._id || editingMenuItem.id;
      const response = await updateMenuItem(editId, {
        ...editingMenuItem,
        price: parseFloat(editingMenuItem.price) || 0,
        makingCost: parseFloat(editingMenuItem.makingCost) || 0,
        preparationTime: parseInt(editingMenuItem.preparationTime, 10) || 10,
        recipe: editingMenuItem.recipe || []
      });
      if (response.success && response.data) {
        const updatedItem = { ...response.data, id: response.data._id || response.data.id };
        setMenuItems((prev) => prev.map((m) => String(m._id || m.id) === String(editId) ? updatedItem : m));
        setShowEditMenuModal(false);
        setEditingMenuItem(null);
        alert('Dish updated successfully!');
      } else {
        alert(response?.message || 'Failed to update menu item.');
      }
    } catch (err) {
      console.error('Error updating menu item:', err);
      alert(err.response?.data?.message || 'Error updating menu item.');
    } finally {
      setIsMenuSubmitting(false);
    }
  };

  const handleDeleteMenuItem = async (id, name) => {
    if (isMenuSubmitting) return;
    if (!window.confirm(`Are you sure you want to remove "${name}" from the cafe menu?`)) return;
    setIsMenuSubmitting(true);
    const cleanId = String(id);
    // Instant optimistic update
    setMenuItems((prev) => prev.filter((item) => String(item._id || item.id) !== cleanId));
    try {
      const response = await deleteMenuItem(id);
      if (!response.success) {
        alert(response.message || 'Failed to remove menu item.');
        fetchMenu();
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      alert(err.response?.data?.message || 'Error deleting menu item.');
      fetchMenu();
    } finally {
      setIsMenuSubmitting(false);
    }
  };

  const handleToggleAvailability = async (item) => {
    const targetId = item._id || item.id;
    const newStatus = !item.available;
    // Instant optimistic UI update
    setMenuItems((prev) =>
      prev.map((m) => (String(m._id || m.id) === String(targetId) ? { ...m, available: newStatus } : m))
    );
    try {
      const response = await updateMenuItem(targetId, { available: newStatus });
      if (!response.success) {
        setMenuItems((prev) =>
          prev.map((m) => (String(m._id || m.id) === String(targetId) ? { ...m, available: item.available } : m))
        );
        alert('Failed to update availability.');
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
      setMenuItems((prev) =>
        prev.map((m) => (String(m._id || m.id) === String(targetId) ? { ...m, available: item.available } : m))
      );
      alert('Server error toggling availability.');
    }
  };

  const handleImageUpload = async (file, isEditing = false) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setImageUploading(true);
    try {
      const res = await uploadMenuItemImage(formData);
      if (res.success && res.imageUrl) {
        if (isEditing) {
          setEditingMenuItem((prev) => ({ ...prev, image: res.imageUrl }));
        } else {
          setNewMenuItem((prev) => ({ ...prev, image: res.imageUrl }));
        }
      } else {
        alert(res.message || 'Image upload failed.');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert(err.response?.data?.message || 'Error uploading image file.');
    } finally {
      setImageUploading(false);
    }
  };

  // Category Management Handlers
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await createCategory({ name: newCategoryName.trim() });
      if (res.success && res.data) {
        setMenuCategories((prev) => [...prev, res.data]);
        setNewCategoryName('');
        alert('Category created successfully!');
      } else {
        alert(res?.message || 'Failed to create category.');
      }
    } catch (err) {
      console.error('Error creating category:', err);
      alert(err.response?.data?.message || 'Error creating category.');
    }
  };

  const handleUpdateCategory = async (catId, newName) => {
    if (!newName.trim()) return;
    try {
      const res = await updateCategory(catId, { name: newName.trim() });
      if (res.success && res.data) {
        setMenuCategories((prev) => prev.map((c) => (c._id === catId ? res.data : c)));
        setEditingCategory(null);
        fetchMenu();
      } else {
        alert(res?.message || 'Failed to update category.');
      }
    } catch (err) {
      console.error('Error updating category:', err);
      alert(err.response?.data?.message || 'Failed to update category.');
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (!window.confirm(`Are you sure you want to delete category "${catName}"?`)) return;
    try {
      const res = await deleteCategory(catId);
      if (res.success) {
        setMenuCategories((prev) => prev.filter((c) => c._id !== catId));
        fetchMenu();
      } else {
        alert(res?.message || 'Failed to delete category.');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      alert(err.response?.data?.message || 'Failed to delete category.');
    }
  };

  // Sync tab data fetches
  useEffect(() => {
    if (tabParam === 'inventory') {
      fetchInventory();
    } else if (tabParam === 'menu') {
      fetchMenu();
      fetchInventory();
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

      const handleOrderCancelled = (cancelledOrder) => {
        const canId = typeof cancelledOrder === 'object' ? cancelledOrder._id : cancelledOrder;
        setOrders((prev) => prev.filter((o) => o._id !== canId));
        playNotificationSound();
        speakText('Order was cancelled by customer.');
      };

      socket.on('order_created', handleOrderCreated);
      socket.on('order_updated', handleOrderUpdated);
      socket.on('order_deleted', handleOrderDeleted);
      socket.on('order_cancelled', handleOrderCancelled);
      socket.on('orderCancelled', handleOrderCancelled);

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
        socket.off('order_cancelled', handleOrderCancelled);
        socket.off('orderCancelled', handleOrderCancelled);
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

  // Mark order as paid - Instant 0ms modal close and smooth background sync
  const handleCollectPayment = async (orderId, paymentMethod) => {
    // 1. Immediately close the modal to eliminate the 5-second freeze
    setPaymentModalOrder(null);
    setPaymentSubmitting(true);
    try {
      await handleStatusTransition(orderId, 'Completed', { paymentStatus: 'Paid', paymentMethod });
      // Refresh completed logs in background if on today's view
      if (typeof fetchCompletedLogs === 'function') {
        fetchCompletedLogs(historyDate || todayDateStr);
      }
    } catch (err) {
      console.error('Error collecting payment:', err);
    } finally {
      setPaymentSubmitting(false);
    }
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
    const qty = parseFloat(purchaseForm.quantityAdded);
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }
    setInventoryActionLoading(true);
    try {
      const res = await recordPurchase({
        itemId: selectedInventoryItem._id,
        quantityAdded: qty,
        costPrice: parseFloat(purchaseForm.costPrice) || 0,
        supplier: purchaseForm.supplier || selectedInventoryItem.supplier || '',
        notes: purchaseForm.notes || ''
      });
      if (res && res.success) {
        alert('Purchase entry recorded successfully.');
        setShowPurchaseModal(false);
        setSelectedInventoryItem(null);
        setPurchaseForm({ quantityAdded: '', totalCost: '', costPrice: '', supplier: '', notes: '' });
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

  // Permission helpers - Always enabled for all staff in workspace for seamless counter operations
  const canPrepare = true;
  const canServe = true;
  const canCollect = true;

  // Table filter state for Live Queue
  const [selectedTableFilter, setSelectedTableFilter] = useState('all');

  // Extract unique active tables and count per table
  const activeTablesList = useMemo(() => {
    const tableMap = new Map();
    orders.forEach((o) => {
      const rawTable = String(o.tableNumber || '').trim();
      const isTakeaway = !rawTable || rawTable.toLowerCase() === 'takeaway' || rawTable.toLowerCase() === 'walk-in';
      const key = isTakeaway ? 'Takeaway' : rawTable;
      tableMap.set(key, (tableMap.get(key) || 0) + 1);
    });

    const entries = Array.from(tableMap.entries());
    entries.sort((a, b) => {
      if (a[0] === 'Takeaway') return 1;
      if (b[0] === 'Takeaway') return -1;
      const numA = parseInt(a[0], 10);
      const numB = parseInt(b[0], 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a[0].localeCompare(b[0]);
    });

    return entries.map(([table, count]) => ({ table, count }));
  }, [orders]);

  // Filter orders by sub-tab columns and selected table
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (subTabParam === 'unpaid' && o.paymentStatus === 'Paid') return false;

      if (selectedTableFilter !== 'all') {
        const rawTable = String(o.tableNumber || '').trim();
        const isTakeaway = !rawTable || rawTable.toLowerCase() === 'takeaway' || rawTable.toLowerCase() === 'walk-in';
        if (selectedTableFilter === 'Takeaway') {
          if (!isTakeaway) return false;
        } else {
          if (rawTable !== selectedTableFilter) return false;
        }
      }

      return true;
    });
  }, [orders, subTabParam, selectedTableFilter]);

  // Statistics summaries
  const stats = useMemo(() => {
    return {
      unpaid: orders.filter((o) => o.paymentStatus !== 'Paid').length,
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
          


          {/* Table Filter Chips */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            padding: '2px 0 6px 0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🪑</span> Tables:
            </span>

            <button
              onClick={() => setSelectedTableFilter('all')}
              style={{
                flexShrink: 0,
                background: selectedTableFilter === 'all' ? 'var(--color-primary)' : 'var(--bg-card)',
                color: selectedTableFilter === 'all' ? '#ffffff' : 'var(--color-text-primary)',
                border: `1px solid ${selectedTableFilter === 'all' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              All ({orders.length})
            </button>

            {activeTablesList.map(({ table, count }) => {
              const isSelected = selectedTableFilter === table;
              return (
                <button
                  key={table}
                  onClick={() => setSelectedTableFilter(isSelected ? 'all' : table)}
                  style={{
                    flexShrink: 0,
                    background: isSelected ? 'var(--color-primary)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--color-text-primary)',
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{table === 'Takeaway' ? '🛍️ Takeaway' : `Table ${table}`}</span>
                  <span style={{
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '10.5px'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
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

                    {/* Quick Order Actions: Add Items, Edit Order, Delete Order */}
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

                        {/* Order Ready Button for Placed and Preparing orders */}
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
                            title="Mark Order Ready (Deducts Ingredients & Notifies Customer)"
                          >
                            ✅ Order Ready
                          </button>
                        )}

                        {/* Mark Paid button for Placed / Preparing */}
                        {(order.status === 'Placed' || order.status === 'Preparing') && (
                          <button
                            disabled={!canCollect}
                            onClick={() => setPaymentModalOrder(order)}
                            style={{
                              background: '#e67e22', color: 'white', border: 'none', padding: '8px 12px',
                              borderRadius: '8px', cursor: canCollect ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 'bold'
                            }}
                          >
                            💵 Mark Paid
                          </button>
                        )}

                        {/* Ready or Delivered status action: Mark Paid & Complete */}
                        {(order.status === 'Ready' || order.status === 'Delivered') && (
                          <button
                            disabled={!canCollect}
                            onClick={() => setPaymentModalOrder(order)}
                            style={{
                              background: canCollect ? '#27ae60' : '#bdc3c7',
                              color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px',
                              cursor: canCollect ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 'bold',
                              display: 'flex', alignItems: 'center', gap: '5px',
                              boxShadow: canCollect ? '0 2px 8px rgba(39, 174, 96, 0.35)' : 'none'
                            }}
                          >
                            💵 Mark Paid / Serve
                          </button>
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
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Sales</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                ₹{historySummary.totalRevenue.toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>💵 Cash Total</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#e67e22', marginTop: '2px' }}>
                ₹{historySummary.cashRevenue.toFixed(2)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>📱 Online Total</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#27ae60', marginTop: '2px' }}>
                ₹{historySummary.upiRevenue.toFixed(2)}
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
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Menu Header & Quick Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📖 Cafe Menu & Dishes
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                Staff access: add new dishes, modify prices, toggle stock availability & manage menu categories.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowCategoryModal(true)}
                style={{
                  background: 'var(--bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
                  padding: '9px 14px', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                📁 Categories ({menuCategoryStats.list.length})
              </button>
              <button
                onClick={() => {
                  fetchInventory();
                  setSelectedIngredient('');
                  setIngredientQuantity('');
                  setNewMenuItem({
                    name: '',
                    price: '',
                    makingCost: '',
                    category: menuCategories[0]?.name || (menuCategoryStats.list[0]?.name || 'Signature Chai'),
                    description: '',
                    available: true,
                    image: '',
                    recipe: [],
                    preparationTime: 10
                  });
                  setShowAddMenuModal(true);
                }}
                style={{
                  background: 'var(--color-primary)', color: 'white', border: 'none',
                  padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 8px rgba(192, 57, 43, 0.25)'
                }}
              >
                ➕ Add Dish
              </button>
            </div>
          </div>

          {/* Real-time Search Input */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search dishes by name, category, or recipe..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 38px 12px 40px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {menuSearch && (
              <button
                onClick={() => setMenuSearch('')}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                  fontSize: '16px', cursor: 'pointer', padding: '4px'
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills (Touch friendly, horizontal scroll) */}
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none'
          }}>
            <button
              onClick={() => setSelectedMenuCategory('all')}
              style={{
                padding: '7px 14px',
                borderRadius: '20px',
                border: selectedMenuCategory === 'all' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: selectedMenuCategory === 'all' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: selectedMenuCategory === 'all' ? 'white' : 'var(--color-text-primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              All Dishes
              <span style={{
                background: selectedMenuCategory === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 800
              }}>
                {menuCategoryStats.allCount}
              </span>
            </button>

            {menuCategoryStats.list.map((cat) => {
              const isSelected = selectedMenuCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedMenuCategory(prev => prev.toLowerCase() === cat.name.toLowerCase() ? 'all' : cat.name)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '20px',
                    border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-primary)' : 'var(--bg-secondary)',
                    color: isSelected ? 'white' : 'var(--color-text-primary)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {cat.name}
                  <span style={{
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 800
                  }}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dishes Grid */}
          {menuLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Loading menu dishes...</p>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
              <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>🍽️</span>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>No dishes found</h4>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                {menuSearch ? `No matches found for "${menuSearch}".` : 'No menu items in this category.'}
              </p>
              {(menuSearch || selectedMenuCategory !== 'all') && (
                <button
                  onClick={() => { setMenuSearch(''); setSelectedMenuCategory('all'); }}
                  style={{
                    marginTop: '14px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--bg-card)',
                    color: 'var(--color-text-primary)',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {filteredMenuItems.map((item) => {
                const isAvailable = item.available !== false;
                return (
                  <div
                    key={item._id || item.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      border: `1.5px solid ${isAvailable ? 'var(--color-border)' : 'rgba(231, 76, 60, 0.4)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      opacity: isAvailable ? 1 : 0.85
                    }}
                  >
                    {/* Item Image with Availability Badge */}
                    <div style={{ position: 'relative', width: '100%', height: '145px', background: '#000' }}>
                      <img
                        src={item.image ? getAssetUrl(item.image) : '/images/default-food.png'}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.src = '/images/default-food.png'; }}
                      />
                      <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                        {item.category || 'General'}
                      </div>
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', color: '#f1c40f', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                        ⏱️ {item.preparationTime || 10}m
                      </div>
                      {!isAvailable && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex', justifyContent: 'center', alignItems: 'center'
                        }}>
                          <span style={{ background: '#e74c3c', color: 'white', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Item Body */}
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: '1.3' }}>
                          {item.name}
                        </strong>
                        <span style={{ color: '#27ae60', fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          ₹{Number(item.price || 0).toFixed(2)}
                        </span>
                      </div>

                      {item.makingCost > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          Making Cost: <strong>₹{item.makingCost}</strong> · Margin: <strong style={{ color: '#27ae60' }}>₹{(item.price - item.makingCost).toFixed(2)}</strong>
                        </div>
                      )}

                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minHeight: '32px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                        {item.description || 'No recipe details uploaded.'}
                      </span>

                      {/* Stock Toggle Button */}
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: `1.5px solid ${isAvailable ? '#27ae60' : '#e74c3c'}`,
                          background: isAvailable ? 'rgba(39, 174, 96, 0.12)' : 'rgba(231, 76, 60, 0.12)',
                          color: isAvailable ? '#27ae60' : '#e74c3c',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          marginTop: '4px'
                        }}
                        title={isAvailable ? 'Click to mark as Out of Stock' : 'Click to mark as In Stock'}
                      >
                        {isAvailable ? '🟢 In Stock (Tap to Out of Stock)' : '🔴 Out of Stock (Tap to In Stock)'}
                      </button>

                      {/* Edit & Delete Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => {
                            fetchInventory();
                            setSelectedIngredient('');
                            setIngredientQuantity('');
                            setEditingMenuItem({
                              _id: item._id || item.id,
                              name: item.name,
                              price: item.price,
                              makingCost: item.makingCost || '',
                              category: item.category || 'Signature Chai',
                              description: item.description || '',
                              available: item.available !== false,
                              image: item.image || '',
                              recipe: item.recipe || [],
                              preparationTime: item.preparationTime || 10
                            });
                            setShowEditMenuModal(true);
                          }}
                          style={{
                            background: 'var(--bg-card)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item._id || item.id, item.name)}
                          style={{
                            background: 'rgba(231, 76, 60, 0.1)',
                            color: '#e74c3c',
                            border: '1px solid rgba(231, 76, 60, 0.3)',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================= TAB 4: INGREDIENT STOCK ======================= */}
      {tabParam === 'inventory' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
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
                padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
                fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 2px 8px rgba(192, 57, 43, 0.25)'
              }}
            >
              ➕ Add Ingredient
            </button>
          </div>

          {/* Real-time Inventory Search Bar */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search ingredients by name, category, or supplier..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 38px 12px 40px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-border)',
                background: 'var(--bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {inventorySearch && (
              <button
                onClick={() => setInventorySearch('')}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                  fontSize: '16px', cursor: 'pointer', padding: '4px'
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Quick Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedInventoryStatus('all')}
              style={{
                padding: '6px 14px', borderRadius: '20px',
                border: selectedInventoryStatus === 'all' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: selectedInventoryStatus === 'all' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: selectedInventoryStatus === 'all' ? 'white' : 'var(--color-text-primary)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              All Items ({inventory.length})
            </button>
            <button
              onClick={() => setSelectedInventoryStatus(prev => prev === 'low' ? 'all' : 'low')}
              style={{
                padding: '6px 14px', borderRadius: '20px',
                border: selectedInventoryStatus === 'low' ? '1.5px solid #f39c12' : '1px solid var(--color-border)',
                background: selectedInventoryStatus === 'low' ? '#f39c12' : 'var(--bg-secondary)',
                color: selectedInventoryStatus === 'low' ? 'white' : '#f39c12',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              ⚠️ Low Stock ({inventory.filter(i => {
                const q = i.quantity !== undefined ? i.quantity : (i.stock ?? 0);
                const min = i.reorderLevel !== undefined ? i.reorderLevel : (i.minStock ?? 0);
                return q > 0 && q <= min;
              }).length})
            </button>
            <button
              onClick={() => setSelectedInventoryStatus(prev => prev === 'out' ? 'all' : 'out')}
              style={{
                padding: '6px 14px', borderRadius: '20px',
                border: selectedInventoryStatus === 'out' ? '1.5px solid #e74c3c' : '1px solid var(--color-border)',
                background: selectedInventoryStatus === 'out' ? '#e74c3c' : 'var(--bg-secondary)',
                color: selectedInventoryStatus === 'out' ? 'white' : '#e74c3c',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              ❌ Out of Stock ({inventory.filter(i => (i.quantity !== undefined ? i.quantity : (i.stock ?? 0)) <= 0).length})
            </button>
            <button
              onClick={() => setSelectedInventoryStatus(prev => prev === 'in' ? 'all' : 'in')}
              style={{
                padding: '6px 14px', borderRadius: '20px',
                border: selectedInventoryStatus === 'in' ? '1.5px solid #27ae60' : '1px solid var(--color-border)',
                background: selectedInventoryStatus === 'in' ? '#27ae60' : 'var(--bg-secondary)',
                color: selectedInventoryStatus === 'in' ? 'white' : '#27ae60',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              ✅ In Stock ({inventory.filter(i => {
                const q = i.quantity !== undefined ? i.quantity : (i.stock ?? 0);
                const min = i.reorderLevel !== undefined ? i.reorderLevel : (i.minStock ?? 0);
                return q > min;
              }).length})
            </button>
          </div>

          {inventoryLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Loading inventory...</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
              No inventory ingredients match your search or filter.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                  {filteredInventory.map((inv) => {
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
      {showTakeOrderModal && (() => {
        const configuredCount = Math.max(12, Number(cafeInfo?.totalTables || currentBranch?.totalTables || 10));
        const tableNums = Array.from({ length: configuredCount }, (_, i) => String(i + 1));
        orders.forEach((o) => {
          const raw = String(o.tableNumber || '').trim();
          if (raw && raw.toLowerCase() !== 'takeaway' && raw.toLowerCase() !== 'walk-in' && !tableNums.includes(raw)) {
            tableNums.push(raw);
          }
        });

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '16px'
          }}>
            <div style={{
              background: 'var(--bg-card)', padding: '22px', borderRadius: '20px',
              width: '100%', maxWidth: '400px', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                    Take New Order
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                    Tap a table to open menu:
                  </p>
                </div>
                <button
                  onClick={() => setShowTakeOrderModal(false)}
                  style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--color-border)',
                    borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* 2-Column Table Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                overflowY: 'auto',
                paddingRight: '4px',
                maxHeight: '340px'
              }}>
                {tableNums.map((tNum) => (
                  <button
                    key={tNum}
                    onClick={() => {
                      setShowTakeOrderModal(false);
                      window.location.href = `/?table=${tNum}&source=staff&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`;
                    }}
                    style={{
                      padding: '13px 10px',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      fontFamily: 'inherit'
                    }}
                  >
                    <span>🪑</span>
                    <span>Table {tNum}</span>
                  </button>
                ))}
              </div>

              {/* Takeaway / Walk-in Button */}
              <button
                onClick={() => {
                  setShowTakeOrderModal(false);
                  window.location.href = `/?table=Takeaway&source=staff&cafeId=${user?.cafeId || ''}&branchId=${activeBranchId || 'default'}`;
                }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px dashed var(--color-primary)',
                  background: 'rgba(224, 142, 39, 0.08)',
                  color: 'var(--color-primary)',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'inherit'
                }}
              >
                <span>🛍️</span>
                <span>Takeaway / Walk-in</span>
              </button>
            </div>
          </div>
        );
      })()}

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
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                Record Purchase Entry
              </h3>
              <button
                onClick={() => { setShowPurchaseModal(false); setSelectedInventoryItem(null); }}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Ingredient: <strong style={{ color: 'var(--color-text-primary)' }}>{selectedInventoryItem.name}</strong> {selectedInventoryItem.unit ? `(${selectedInventoryItem.unit})` : ''}
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Quantity Purchased {selectedInventoryItem.unit ? `(${selectedInventoryItem.unit})` : ''} *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    placeholder="e.g. 10"
                    value={purchaseForm.quantityAdded}
                    onChange={(e) => {
                      const val = e.target.value;
                      const qty = parseFloat(val);
                      const unitCost = parseFloat(purchaseForm.costPrice);
                      let newTotal = purchaseForm.totalCost;
                      if (!isNaN(qty) && qty > 0 && !isNaN(unitCost) && unitCost >= 0) {
                        newTotal = Number((qty * unitCost).toFixed(2));
                      } else if (val === '') {
                        newTotal = '';
                      }
                      setPurchaseForm((prev) => ({
                        ...prev,
                        quantityAdded: val,
                        totalCost: newTotal
                      }));
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Total Bill Amount (₹) <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 150"
                    value={purchaseForm.totalCost}
                    onChange={(e) => {
                      const val = e.target.value;
                      const total = parseFloat(val);
                      const qty = parseFloat(purchaseForm.quantityAdded);
                      let newUnitCost = purchaseForm.costPrice;
                      if (!isNaN(total) && !isNaN(qty) && qty > 0) {
                        newUnitCost = Number((total / qty).toFixed(4));
                      }
                      setPurchaseForm((prev) => ({
                        ...prev,
                        totalCost: val,
                        costPrice: newUnitCost
                      }));
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Cost Price per {selectedInventoryItem.unit || 'Unit'} (₹) *
                  <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontWeight: 'normal', marginLeft: '6px' }}>
                    (Auto-calculated from ingredient / total bill)
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0"
                  placeholder="e.g. 1.50"
                  value={purchaseForm.costPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    const unitCost = parseFloat(val);
                    const qty = parseFloat(purchaseForm.quantityAdded);
                    let newTotal = purchaseForm.totalCost;
                    if (!isNaN(unitCost) && !isNaN(qty) && qty > 0) {
                      newTotal = Number((qty * unitCost).toFixed(2));
                    }
                    setPurchaseForm((prev) => ({
                      ...prev,
                      costPrice: val,
                      totalCost: newTotal
                    }));
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                />
              </div>

              {/* Auto Calculation Preview Banner */}
              {Number(purchaseForm.quantityAdded) > 0 && Number(purchaseForm.costPrice) >= 0 && (
                <div style={{
                  background: 'rgba(46, 204, 113, 0.12)',
                  border: '1px solid rgba(46, 204, 113, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#27ae60',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  <span>✓ <strong>Total Bill:</strong> ₹{(Number(purchaseForm.quantityAdded) * Number(purchaseForm.costPrice)).toFixed(2)}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    ₹{Number(purchaseForm.costPrice).toFixed(2)} per {selectedInventoryItem.unit || 'unit'}
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Supplier
                </label>
                <input
                  type="text"
                  placeholder="e.g. Metro Cash & Carry (Optional)"
                  value={purchaseForm.supplier}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Weekly restocking"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowPurchaseModal(false); setSelectedInventoryItem(null); }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inventoryActionLoading}
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: inventoryActionLoading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '13px' }}
                >
                  {inventoryActionLoading ? 'Saving...' : 'Save Entry'}
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

      {/* ======================= MODAL: ADD MENU DISH ======================= */}
      {showAddMenuModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                ➕ Add New Dish to Menu
              </h3>
              <button
                onClick={() => setShowAddMenuModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Dish Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Dish Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Masala Chai, Peri Peri Fries..."
                  value={newMenuItem.name}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                    color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Category & Prep Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Category *
                  </label>
                  <select
                    value={newMenuItem.category}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                    }}
                  >
                    {menuCategoryStats.list.length > 0 ? (
                      menuCategoryStats.list.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Signature Chai">Signature Chai</option>
                        <option value="Hot Beverages">Hot Beverages</option>
                        <option value="Cold Beverages">Cold Beverages</option>
                        <option value="Snacks & Bites">Snacks & Bites</option>
                        <option value="Desserts">Desserts</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newMenuItem.preparationTime}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, preparationTime: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Selling Price & Making Cost */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#27ae60', marginBottom: '5px' }}>
                    Selling Price (₹) *
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 50"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Making Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 15"
                    value={newMenuItem.makingCost}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, makingCost: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Recipe Mapping (Ingredients) */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px' }}>
                  Recipe Mapping (Ingredients)
                </label>
                
                {(!newMenuItem.recipe || newMenuItem.recipe.length === 0) ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '4px 0 10px 0' }}>
                    No ingredients mapped yet. This item will not deduct stock.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {newMenuItem.recipe.map((ing, idx) => {
                      const invItem = inventory.find((i) => i.name === ing.name);
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              value={ing.quantity}
                              min="0.001"
                              step="0.001"
                              onChange={(e) => {
                                const updated = [...newMenuItem.recipe];
                                updated[idx].quantity = Number(e.target.value);
                                const calculatedCost = updated.reduce((sum, item) => {
                                  const inv = inventory.find((i) => i.name === item.name);
                                  return sum + (Number(item.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
                                }, 0);
                                setNewMenuItem({
                                  ...newMenuItem,
                                  recipe: updated,
                                  makingCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : newMenuItem.makingCost
                                });
                              }}
                              style={{ width: '65px', padding: '4px 6px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{invItem?.unit || 'unit'}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientFromNewItem(ing.name)}
                              style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                              title="Remove ingredient"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Auto Calculated Ingredient Cost Banner */}
                {newMenuItem.recipe && newMenuItem.recipe.length > 0 && (() => {
                  const calcMakingCost = newMenuItem.recipe.reduce((sum, ing) => {
                    const inv = inventory.find(i => i.name === ing.name);
                    return sum + (Number(ing.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
                  }, 0);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 107, 8, 0.08)', border: '1px dashed var(--color-primary)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-primary)' }}>
                        Ingredient Cost from Recipe: <strong style={{ color: 'var(--color-primary)' }}>₹{calcMakingCost.toFixed(2)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewMenuItem({ ...newMenuItem, makingCost: calcMakingCost.toFixed(2) })}
                        style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Use as Making Cost
                      </button>
                    </div>
                  );
                })()}

                {/* Add Ingredient Selector Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Select Ingredient
                    </label>
                    <select
                      value={selectedIngredient}
                      onChange={(e) => setSelectedIngredient(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Choose Ingredient --</option>
                      {inventory.map((inv) => (
                        <option key={inv._id} value={inv.name}>{inv.name} ({inv.unit || 'unit'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      placeholder="e.g. 10"
                      value={ingredientQuantity}
                      onChange={(e) => setIngredientQuantity(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIngredientToNewItem}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px', height: '36px' }}
                  >
                    Map
                  </button>
                </div>
              </div>

              {/* Dish Photo Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Dish Photo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {newMenuItem.image && (
                    <img
                      src={getAssetUrl(newMenuItem.image)}
                      alt="Preview"
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files[0], false)}
                    disabled={imageUploading}
                    style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}
                  />
                </div>
                {imageUploading && <span style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Uploading photo...</span>}
              </div>

              {/* In Stock Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="newMenuItemAvailable"
                  checked={newMenuItem.available}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, available: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="newMenuItemAvailable" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  Item is Available & In-Stock
                </label>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(false)}
                  style={{
                    padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                    background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMenuSubmitting || imageUploading}
                  style={{
                    padding: '10px 22px', borderRadius: '8px', border: 'none',
                    background: 'var(--color-primary)', color: 'white',
                    cursor: isMenuSubmitting || imageUploading ? 'not-allowed' : 'pointer',
                    fontWeight: 800, fontSize: '13px'
                  }}
                >
                  {isMenuSubmitting ? 'Adding...' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: EDIT MENU DISH ======================= */}
      {showEditMenuModal && editingMenuItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                ✏️ Edit Menu Dish
              </h3>
              <button
                onClick={() => { setShowEditMenuModal(false); setEditingMenuItem(null); }}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Dish Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Dish Name *
                </label>
                <input
                  required
                  type="text"
                  value={editingMenuItem.name}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                    color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Category & Prep Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Category *
                  </label>
                  <select
                    value={editingMenuItem.category}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, category: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                    }}
                  >
                    {menuCategoryStats.list.length > 0 ? (
                      menuCategoryStats.list.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Signature Chai">Signature Chai</option>
                        <option value="Hot Beverages">Hot Beverages</option>
                        <option value="Cold Beverages">Cold Beverages</option>
                        <option value="Snacks & Bites">Snacks & Bites</option>
                        <option value="Desserts">Desserts</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingMenuItem.preparationTime}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, preparationTime: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Selling Price & Making Cost */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#27ae60', marginBottom: '5px' }}>
                    Selling Price (₹) *
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    min="0"
                    value={editingMenuItem.price}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, price: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                    Making Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editingMenuItem.makingCost}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, makingCost: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                      color: 'var(--color-text-primary)', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Recipe Mapping (Ingredients) */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px' }}>
                  Recipe Mapping (Ingredients)
                </label>
                
                {(!editingMenuItem.recipe || editingMenuItem.recipe.length === 0) ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '4px 0 10px 0' }}>
                    No ingredients mapped yet. This item will not deduct stock.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {editingMenuItem.recipe.map((ing, idx) => {
                      const invItem = inventory.find((i) => i.name === ing.name);
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              value={ing.quantity}
                              min="0.001"
                              step="0.001"
                              onChange={(e) => {
                                const updated = [...editingMenuItem.recipe];
                                updated[idx].quantity = Number(e.target.value);
                                const calculatedCost = updated.reduce((sum, item) => {
                                  const inv = inventory.find((i) => i.name === item.name);
                                  return sum + (Number(item.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
                                }, 0);
                                setEditingMenuItem({
                                  ...editingMenuItem,
                                  recipe: updated,
                                  makingCost: calculatedCost > 0 ? calculatedCost.toFixed(2) : editingMenuItem.makingCost
                                });
                              }}
                              style={{ width: '65px', padding: '4px 6px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{invItem?.unit || 'unit'}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientFromEditingItem(ing.name)}
                              style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                              title="Remove ingredient"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Auto Calculated Ingredient Cost Banner */}
                {editingMenuItem.recipe && editingMenuItem.recipe.length > 0 && (() => {
                  const calcMakingCost = editingMenuItem.recipe.reduce((sum, ing) => {
                    const inv = inventory.find(i => i.name === ing.name);
                    return sum + (Number(ing.quantity || 0) * Number(inv?.costPrice || inv?.cost || 0));
                  }, 0);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 107, 8, 0.08)', border: '1px dashed var(--color-primary)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-primary)' }}>
                        Ingredient Cost from Recipe: <strong style={{ color: 'var(--color-primary)' }}>₹{calcMakingCost.toFixed(2)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingMenuItem({ ...editingMenuItem, makingCost: calcMakingCost.toFixed(2) })}
                        style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Use as Making Cost
                      </button>
                    </div>
                  );
                })()}

                {/* Add Ingredient Selector Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Select Ingredient
                    </label>
                    <select
                      value={selectedIngredient}
                      onChange={(e) => setSelectedIngredient(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Choose Ingredient --</option>
                      {inventory.map((inv) => (
                        <option key={inv._id} value={inv.name}>{inv.name} ({inv.unit || 'unit'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      placeholder="e.g. 10"
                      value={ingredientQuantity}
                      onChange={(e) => setIngredientQuantity(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)', color: 'var(--color-text-primary)', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIngredientToEditingItem}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px', height: '36px' }}
                  >
                    Map
                  </button>
                </div>
              </div>

              {/* Dish Photo Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
                  Update Dish Photo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {editingMenuItem.image && (
                    <img
                      src={getAssetUrl(editingMenuItem.image)}
                      alt="Current"
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files[0], true)}
                    disabled={imageUploading}
                    style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}
                  />
                </div>
                {imageUploading && <span style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Uploading photo...</span>}
              </div>

              {/* In Stock Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="editMenuItemAvailable"
                  checked={editingMenuItem.available}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, available: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="editMenuItemAvailable" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  Item is Available & In-Stock
                </label>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditMenuModal(false); setEditingMenuItem(null); }}
                  style={{
                    padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)',
                    background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMenuSubmitting || imageUploading}
                  style={{
                    padding: '10px 22px', borderRadius: '8px', border: 'none',
                    background: 'var(--color-primary)', color: 'white',
                    cursor: isMenuSubmitting || imageUploading ? 'not-allowed' : 'pointer',
                    fontWeight: 800, fontSize: '13px'
                  }}
                >
                  {isMenuSubmitting ? 'Saving...' : 'Update Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: MANAGE CATEGORIES ======================= */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                📁 Menu Categories
              </h3>
              <button
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Add Category Form */}
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <input
                type="text"
                placeholder="New Category Name (e.g. Specials)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.03)',
                  color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!newCategoryName.trim()}
                style={{
                  background: 'var(--color-primary)', color: 'white', border: 'none',
                  padding: '10px 16px', borderRadius: '8px', fontWeight: 800, fontSize: '13px',
                  cursor: newCategoryName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCategoryName.trim() ? 1 : 0.6
                }}
              >
                + Add
              </button>
            </form>

            {/* Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {menuCategories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  No custom categories yet.
                </div>
              ) : (
                menuCategories.map((c) => {
                  const catId = c._id || c.id;
                  const isEditing = editingCategory && editingCategory._id === catId;

                  return (
                    <div
                      key={catId || c.name}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '8px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--color-border)'
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', flex: 1, marginRight: '8px' }}>
                          <input
                            type="text"
                            value={editingCategory.name}
                            onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                            style={{
                              flex: 1, padding: '6px 10px', borderRadius: '6px',
                              border: '1px solid var(--color-primary)', background: 'var(--bg-card)',
                              color: 'var(--color-text-primary)', fontSize: '13px'
                            }}
                          />
                          <button
                            onClick={() => handleUpdateCategory(catId, editingCategory.name)}
                            style={{ background: '#27ae60', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
                          {c.name}
                        </strong>
                      )}

                      {!isEditing && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setEditingCategory({ _id: catId, name: c.name })}
                            style={{ background: 'transparent', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer' }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(catId, c.name)}
                            style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#e74c3c', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: 'var(--color-primary)', color: 'white',
                  fontWeight: 800, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick 1-Tap Fast Payment Modal (Cash vs Online) */}
      {paymentModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '20px',
            width: '100%',
            maxWidth: '360px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Collect Payment
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Table <strong>{paymentModalOrder.tableNumber}</strong> • Total: <strong style={{ color: 'var(--color-primary)', fontSize: '16px' }}>₹{paymentModalOrder.totalAmount}</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                disabled={paymentSubmitting}
                onClick={() => handleCollectPayment(paymentModalOrder._id, 'Cash')}
                style={{
                  background: 'rgba(230, 126, 34, 0.1)',
                  border: '1.5px solid #e67e22',
                  color: '#e67e22',
                  borderRadius: '12px',
                  padding: '14px 10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: paymentSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontSize: '22px' }}>💵</span>
                <span>Cash</span>
              </button>

              <button
                type="button"
                disabled={paymentSubmitting}
                onClick={() => handleCollectPayment(paymentModalOrder._id, 'Online')}
                style={{
                  background: 'rgba(39, 174, 96, 0.1)',
                  border: '1.5px solid #27ae60',
                  color: '#27ae60',
                  borderRadius: '12px',
                  padding: '14px 10px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: paymentSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontSize: '22px' }}>📱</span>
                <span>Online (UPI)</span>
              </button>
            </div>

            <button
              type="button"
              disabled={paymentSubmitting}
              onClick={() => setPaymentModalOrder(null)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffOrderWorkspace;


