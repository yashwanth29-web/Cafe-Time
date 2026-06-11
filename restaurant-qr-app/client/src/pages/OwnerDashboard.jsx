import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { 
  getOrders, 
  getMenu, 
  createMenuItem, 
  updateMenuItem, 
  deleteMenuItem,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getSetupData,
  saveSetupData,
  verifyRazorpayKeys,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryLogs,
  getWastageReport,
  getConsumptionReport,
  recordPurchase,
  recordWastage,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getInventoryCategories,
  createInventoryCategory,
  deleteInventoryCategory,
  uploadMenuItemImage
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import OwnerLayout from '../components/OwnerLayout';

const OwnerDashboard = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState(() => {
    const tab = tabParam || location.state?.activeTab || 'analytics';
    return tab === 'settings' ? 'config' : tab;
  });

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam === 'settings' ? 'config' : tabParam);
    } else {
      setActiveTab('analytics');
    }
  }, [tabParam]);

  // Base Data States
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Form / Dialog States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // New staff input state
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    staffRole: 'waiter'
  });

  // New menu item input state
  // Dynamic Category States
  const [categories, setCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');

  // Dynamic Inventory Category States
  const [inventoryCategories, setInventoryCategories] = useState([]);
  const [invCategoryLoading, setInvCategoryLoading] = useState(false);
  const [invCategoryError, setInvCategoryError] = useState('');
  const [newInvCategoryName, setNewInvCategoryName] = useState('');

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: 'Signature Chai',
    description: '',
    available: true,
    image: '',
    recipe: [],
    preparationTime: 10
  });

  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');

  const handleAddIngredientToNewItem = () => {
    if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity) <= 0) {
      alert('Please select an ingredient and enter a valid quantity.');
      return;
    }
    if (newItem.recipe && newItem.recipe.find(ing => ing.name === selectedIngredient)) {
      alert('Ingredient already added to recipe.');
      return;
    }
    const updatedRecipe = [...(newItem.recipe || []), { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
    setNewItem({ ...newItem, recipe: updatedRecipe });
    setSelectedIngredient('');
    setIngredientQuantity('');
  };

  const handleRemoveIngredientFromNewItem = (name) => {
    const updatedRecipe = (newItem.recipe || []).filter(ing => ing.name !== name);
    setNewItem({ ...newItem, recipe: updatedRecipe });
  };

  const handleAddIngredientToEditingItem = () => {
    if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity) <= 0) {
      alert('Please select an ingredient and enter a valid quantity.');
      return;
    }
    if (editingItem.recipe && editingItem.recipe.find(ing => ing.name === selectedIngredient)) {
      alert('Ingredient already added to recipe.');
      return;
    }
    const updatedRecipe = [...(editingItem.recipe || []), { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
    setEditingItem({ ...editingItem, recipe: updatedRecipe });
    setSelectedIngredient('');
    setIngredientQuantity('');
  };

  const handleRemoveIngredientFromEditingItem = (name) => {
    const updatedRecipe = (editingItem.recipe || []).filter(ing => ing.name !== name);
    setEditingItem({ ...editingItem, recipe: updatedRecipe });
  };

  // Dynamic QR / Table States
  const [selectedQrTable, setSelectedQrTable] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dynamicTables, setDynamicTables] = useState(['1', '2', '3', '4', '5']);

  // Settings / Config States
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [isRazorpayVerified, setIsRazorpayVerified] = useState(false);
  const [verifyingKeys, setVerifyingKeys] = useState(false);
  const [taxRate, setTaxRate] = useState(5); // mock GST
  const [serviceCharge, setServiceCharge] = useState(2.5); // mock service charge
  const [settingsMsg, setSettingsMsg] = useState('');

  // Database Inventory State
  const [inventoryList, setInventoryList] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [wastageReport, setWastageReport] = useState({ totalCost: 0, count: 0, data: [] });
  const [consumptionReport, setConsumptionReport] = useState({ totalCost: 0, count: 0, data: [] });
  const [inventorySubTab, setInventorySubTab] = useState('levels');
  
  // Modals / forms state for Inventory
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [showEditInventoryModal, setShowEditInventoryModal] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState(null);
  const [newInventoryItem, setNewInventoryItem] = useState({
    name: '',
    quantity: 0,
    stock: 0,
    reorderLevel: 0,
    minStock: 0,
    unit: '',
    costPrice: 0,
    cost: 0,
    sellingPrice: 0,
    supplier: '',
    branch: 'Main',
    category: 'Ingredients'
  });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    itemId: '',
    itemName: '',
    quantityAdded: 0,
    costPrice: 0,
    supplier: '',
    notes: ''
  });
  const [wastageForm, setWastageForm] = useState({
    itemId: '',
    itemName: '',
    quantityWasted: 0,
    type: 'Wastage',
    reason: ''
  });

  // Mock Customer Reviews State
  const [reviewsList] = useState([
    { id: 1, author: 'Sai Prasad', rating: 5, text: 'Awesome QR ordering experience! The Gourmet Cheeseburger was cooked to perfection.', date: 'Today' },
    { id: 2, author: 'Kamala Bevara', rating: 4, text: 'Very convenient cashier-less flow. Loved the fast preparation time.', date: 'Yesterday' },
    { id: 3, author: 'Jai Kalki', rating: 5, text: 'Super clean interface. Razorpay online payment was smooth and instant.', date: '3 days ago' }
  ]);

  // Search states
  const [menuSearch, setMenuSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');

  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(menuSearch.toLowerCase())
  );

  const filteredInventoryList = inventoryList.filter(item =>
    item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(inventorySearch.toLowerCase())
  );

  const [imageUploading, setImageUploading] = useState(false);

  const handleImageUpload = async (file, isEditing = false) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      setImageUploading(true);
      const res = await uploadMenuItemImage(formData);
      if (res.success) {
        if (isEditing) {
          setEditingItem(prev => ({ ...prev, image: res.imageUrl }));
        } else {
          setNewItem(prev => ({ ...prev, image: res.imageUrl }));
        }
      } else {
        alert(res.message || 'Image upload failed.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error.response?.data?.message || 'Error uploading image file.');
    } finally {
      setImageUploading(false);
    }
  };

  const presetCategories = [
    'Signature Chai',
    'Coffee Selection',
    'Fresh Juices & Coolers',
    'Thick Milkshakes',
    'Starters & Bites',
    'French Fries'
  ];

  // Load Setup Config
  const loadSetupConfig = async () => {
    try {
      const res = await getSetupData();
      if (res.success) {
        if (res.operationalConfig?.tables) {
          const t = res.operationalConfig.tables.map(tbl => tbl.id.replace('T', ''));
          if (t.length > 0) setDynamicTables(t);
        }
        if (res.paymentConfig) {
          setRazorpayKeyId(res.paymentConfig.razorpayKeyId || '');
          setRazorpaySecret(res.paymentConfig.razorpaySecret || '');
          setIsRazorpayVerified(res.paymentConfig.isVerified || false);
        }
      }
    } catch (err) {
      console.error('Error fetching tables/keys setup:', err);
    }
  };

  // Fetch Orders (Monitoring)
  const fetchOrders = async () => {
    try {
      const response = await getOrders();
      if (response.success) {
        const cafeOrders = user?.cafeId 
          ? response.data.filter(order => order.cafeId === user.cafeId)
          : response.data;
        setOrders(cafeOrders);
        setOrdersError('');
      } else {
        setOrdersError('Failed to refresh orders.');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrdersError('Cannot connect to local server orders feed.');
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch Menu
  const fetchMenu = async () => {
    setMenuLoading(true);
    try {
      const response = await getMenu();
      if (response.success) {
        setMenuItems(response.data);
        setMenuError('');
      } else {
        setMenuError('Failed to load cafe menu.');
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
      setMenuError('Cannot connect to local server menu database.');
    } finally {
      setMenuLoading(false);
    }
  };

  // Fetch Categories
  const fetchCategories = async () => {
    setCategoryLoading(true);
    try {
      const response = await getCategories();
      if (response && response.success) {
        setCategories(response.data);
        setCategoryError('');
      } else {
        setCategoryError('Failed to load categories.');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategoryError('Cannot connect to category database.');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const response = await createCategory({ name: newCategoryName });
      if (response.success) {
        setCategories([...categories, response.data]);
        setNewCategoryName('');
        alert('Category created successfully!');
      } else {
        alert(response.message || 'Failed to create category.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error creating category.');
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory || !categoryNameInput.trim()) return;
    try {
      const response = await updateCategory(editingCategory._id, { name: categoryNameInput });
      if (response.success) {
        setCategories(categories.map(c => c._id === editingCategory._id ? response.data : c));
        // Update menu items in local state
        setMenuItems(menuItems.map(item => item.category === editingCategory.name ? { ...item, category: response.data.name } : item));
        setEditingCategory(null);
        setCategoryNameInput('');
        alert('Category updated successfully!');
      } else {
        alert(response.message || 'Failed to update category.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error updating category.');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this category? All menu items in this category will be moved to Uncategorized.')) return;
    try {
      const categoryToDelete = categories.find(c => c._id === catId);
      const response = await deleteCategory(catId);
      if (response.success) {
        setCategories(categories.filter(c => c._id !== catId));
        if (categoryToDelete) {
          setMenuItems(menuItems.map(item => item.category === categoryToDelete.name ? { ...item, category: 'Uncategorized' } : item));
        }
        alert('Category deleted successfully.');
      } else {
        alert(response.message || 'Failed to delete category.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error deleting category.');
    }
  };

  // Fetch Inventory Categories
  const fetchInventoryCategories = async () => {
    setInvCategoryLoading(true);
    try {
      const response = await getInventoryCategories();
      if (response && response.success) {
        setInventoryCategories(response.data);
        setInvCategoryError('');
      } else {
        setInvCategoryError('Failed to load stock categories.');
      }
    } catch (error) {
      console.error('Error fetching inventory categories:', error);
      setInvCategoryError('Cannot connect to stock categories database.');
    } finally {
      setInvCategoryLoading(false);
    }
  };

  const handleCreateInventoryCategory = async (e) => {
    e.preventDefault();
    if (!newInvCategoryName.trim()) return;
    try {
      const response = await createInventoryCategory({ name: newInvCategoryName });
      if (response.success) {
        setInventoryCategories([...inventoryCategories, response.data]);
        setNewInvCategoryName('');
        alert('Stock category created successfully!');
      } else {
        alert(response.message || 'Failed to create category.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error creating category.');
    }
  };

  const handleDeleteInventoryCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category? All items in this category will be moved to Uncategorized.')) return;
    try {
      const catToDelete = inventoryCategories.find(c => c._id === id);
      const response = await deleteInventoryCategory(id);
      if (response.success) {
        setInventoryCategories(inventoryCategories.filter(c => c._id !== id));
        if (catToDelete) {
          setInventoryList(inventoryList.map(item => item.category === catToDelete.name ? { ...item, category: 'Uncategorized' } : item));
        }
        alert('Stock category deleted successfully.');
      } else {
        alert(response.message || 'Failed to delete category.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error deleting category.');
    }
  };

  // Fetch Staff
  const fetchStaffList = async () => {
    setStaffLoading(true);
    try {
      const response = await getStaff();
      if (response.success) {
        setStaff(response.staff);
        setStaffError('');
      } else {
        setStaffError('Failed to load staff roster.');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      setStaffError('Cannot connect to local server staff database.');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    loadSetupConfig();

    if (activeTab === 'staff') {
      fetchStaffList();
    }
    if (activeTab === 'inventory' || activeTab === 'analytics' || activeTab === 'menu') {
      fetchInventoryList();
      fetchCategories();
      fetchInventoryCategories();
    }

    // Live background polling every 5 seconds for orders & inventory levels
    const pollingInterval = setInterval(() => {
      fetchOrders();
      
      if (activeTab === 'inventory' || activeTab === 'analytics' || activeTab === 'menu') {
        const fetchInventorySilent = async () => {
          try {
            const [invRes, logsRes, wasteRes, consRes] = await Promise.all([
              getInventory(),
              getInventoryLogs(),
              getWastageReport(),
              getConsumptionReport()
            ]);
            
            if (invRes.success) setInventoryList(invRes.data);
            if (logsRes.success) setInventoryLogs(logsRes.data);
            if (wasteRes.success) setWastageReport(wasteRes);
            if (consRes.success) setConsumptionReport(consRes);
          } catch (err) {
            console.error('Silent inventory refresh failed:', err);
          }
        };
        fetchInventorySilent();
      }
    }, 5000);

    return () => clearInterval(pollingInterval);
  }, [activeTab]);

  // Register new staff
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email || !newStaff.phone || !newStaff.staffRole) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      setStaffLoading(true);
      const response = await createStaff(newStaff);
      if (response.success) {
        alert(`Staff member "${newStaff.name}" registered successfully.`);
        setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter' });
        fetchStaffList();
      }
    } catch (error) {
      console.error('Error creating staff:', error);
      alert(error.response?.data?.message || 'Failed to create staff member.');
    } finally {
      setStaffLoading(false);
    }
  };

  // Edit staff
  const handleEditStaff = async (e) => {
    e.preventDefault();
    if (!editingStaff.name || !editingStaff.email || !editingStaff.phone || !editingStaff.staffRole) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      setStaffLoading(true);
      const response = await updateStaff(editingStaff._id, {
        name: editingStaff.name,
        email: editingStaff.email,
        phone: editingStaff.phone,
        staffRole: editingStaff.staffRole,
        isActive: editingStaff.isActive
      });
      if (response.success) {
        alert('Staff member updated successfully.');
        setShowEditStaffModal(false);
        setEditingStaff(null);
        fetchStaffList();
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      alert(error.response?.data?.message || 'Failed to update staff member.');
    } finally {
      setStaffLoading(false);
    }
  };

  // Delete staff
  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Are you sure you want to remove this staff member?')) {
      return;
    }
    try {
      setStaffLoading(true);
      const response = await deleteStaff(id);
      if (response.success) {
        alert(response.message || 'Staff member deleted successfully.');
        fetchStaffList();
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert(error.response?.data?.message || 'Failed to delete staff member.');
    } finally {
      setStaffLoading(false);
    }
  };

  // Menu toggles
  const handleToggleAvailability = async (item) => {
    const updatedStatus = !item.available;
    try {
      const response = await updateMenuItem(item.id, { available: updatedStatus });
      if (response.success) {
        setMenuItems((prevItems) =>
          prevItems.map((m) => m.id === item.id ? { ...m, available: updatedStatus } : m)
        );
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  };

  // Delete menu item
  const handleDeleteMenuItem = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this menu item?')) {
      try {
        const response = await deleteMenuItem(id);
        if (response.success) {
          setMenuItems((prevItems) => prevItems.filter((item) => item.id !== id));
        }
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  // Add menu item
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price || !newItem.category || !newItem.description) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      const response = await createMenuItem(newItem);
      if (response.success) {
        setMenuItems((prevItems) => [...prevItems, response.data]);
        setShowAddModal(false);
        setNewItem({
          name: '',
          price: '',
          category: 'Signature Chai',
          description: '',
          available: true,
          image: '',
          recipe: [],
          preparationTime: 10
        });
      }
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  // Edit menu item
  const handleEditMenuItem = async (e) => {
    e.preventDefault();
    if (!editingItem.name || !editingItem.price || !editingItem.category || !editingItem.description) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      const response = await updateMenuItem(editingItem.id, editingItem);
      if (response.success) {
        setMenuItems((prevItems) =>
          prevItems.map((m) => (m.id === editingItem.id ? response.data : m))
        );
        setShowEditModal(false);
        setEditingItem(null);
      }
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  // Fetch Inventory List
  async function fetchInventoryList() {
    setInventoryLoading(true);
    try {
      const [invRes, logsRes, wasteRes, consRes] = await Promise.all([
        getInventory(),
        getInventoryLogs(),
        getWastageReport(),
        getConsumptionReport()
      ]);
      
      if (invRes.success) {
        setInventoryList(invRes.data);
        setInventoryError('');
      } else {
        setInventoryError('Failed to load inventory.');
      }

      if (logsRes.success) {
        setInventoryLogs(logsRes.data);
      }
      if (wasteRes.success) {
        setWastageReport(wasteRes);
      }
      if (consRes.success) {
        setConsumptionReport(consRes);
      }
    } catch (error) {
      console.error('Error fetching inventory analytics:', error);
      setInventoryError('Cannot connect to inventory database.');
    } finally {
      setInventoryLoading(false);
    }
  };

  // Restock inventory item
  const handleRestockItem = async (id, currentStock) => {
    try {
      const response = await updateInventoryItem(id, { stock: currentStock + 50 });
      if (response.success) {
        setInventoryList(prev => prev.map(item => item._id === id ? response.data : item));
      }
    } catch (error) {
      console.error('Error restocking item:', error);
    }
  };

  const handleAddInventoryItem = async (e) => {
    e.preventDefault();
    try {
      const response = await createInventoryItem(newInventoryItem);
      if (response.success) {
        setInventoryList(prev => [...prev, response.data]);
        setShowAddInventoryModal(false);
        setNewInventoryItem({
          name: '',
          quantity: 0,
          stock: 0,
          reorderLevel: 0,
          minStock: 0,
          unit: '',
          costPrice: 0,
          cost: 0,
          sellingPrice: 0,
          supplier: '',
          branch: 'Main',
          category: 'Ingredients'
        });
        fetchInventoryList(); // reload all stats & logs as well
      }
    } catch (error) {
      console.error('Error adding inventory item:', error);
      alert('Error creating inventory item');
    }
  };

  // Edit Inventory Item
  const handleEditInventoryItem = async (e) => {
    e.preventDefault();
    try {
      const response = await updateInventoryItem(editingInventoryItem._id, editingInventoryItem);
      if (response.success) {
        setInventoryList(prev => prev.map(item => item._id === editingInventoryItem._id ? response.data : item));
        setShowEditInventoryModal(false);
        setEditingInventoryItem(null);
      }
    } catch (error) {
      console.error('Error updating inventory item:', error);
      alert('Error updating inventory item');
    }
  };

  // Delete Inventory Item
  const handleDeleteInventoryItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ingredient?')) return;
    try {
      const response = await deleteInventoryItem(id);
      if (response.success) {
        setInventoryList(prev => prev.filter(item => item._id !== id));
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Error deleting inventory item');
    }
  };

  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    try {
      const response = await recordPurchase({
        itemId: purchaseForm.itemId,
        quantityAdded: Number(purchaseForm.quantityAdded),
        costPrice: Number(purchaseForm.costPrice),
        supplier: purchaseForm.supplier,
        notes: purchaseForm.notes
      });
      if (response.success) {
        alert('Purchase recorded successfully.');
        setShowPurchaseModal(false);
        fetchInventoryList(); // reload all stats & logs
      }
    } catch (error) {
      console.error('Error recording purchase:', error);
      alert(error.response?.data?.message || 'Error recording purchase');
    }
  };

  const handleRecordWastage = async (e) => {
    e.preventDefault();
    try {
      const response = await recordWastage({
        itemId: wastageForm.itemId,
        quantityWasted: Number(wastageForm.quantityWasted),
        type: wastageForm.type,
        reason: wastageForm.reason
      });
      if (response.success) {
        alert('Wastage recorded successfully.');
        setShowWastageModal(false);
        fetchInventoryList(); // reload all stats & logs
      }
    } catch (error) {
      console.error('Error recording wastage:', error);
      alert(error.response?.data?.message || 'Error recording wastage');
    }
  };

  // Save Settings Config
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMsg('');
    try {
      const payload = {
        paymentConfig: {
          razorpayKeyId,
          razorpaySecret,
          isVerified: isRazorpayVerified
        }
      };
      const response = await saveSetupData(payload);
      if (response.success) {
        setSettingsMsg('Configuration saved successfully!');
        setTimeout(() => setSettingsMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setSettingsMsg('Server error saving details.');
    }
  };

  // Test Razorpay Keys
  const testRazorpayConnection = async () => {
    if (!razorpayKeyId || !razorpaySecret) {
      alert('Razorpay Key ID and Secret are required.');
      return;
    }
    setVerifyingKeys(true);
    try {
      const res = await verifyRazorpayKeys(razorpayKeyId, razorpaySecret);
      if (res.success) {
        setIsRazorpayVerified(true);
        alert('Razorpay connection verified successfully!');
      } else {
        setIsRazorpayVerified(false);
        alert('Verification failed. Check credentials.');
      }
    } catch (err) {
      setIsRazorpayVerified(false);
      alert('Verification failed: Bad credentials.');
    } finally {
      setVerifyingKeys(false);
    }
  };

  // Copy table URL
  const handleCopyUrl = (table) => {
    const url = `${window.location.origin}/?table=${table}&cafeId=${user?.cafeId || ''}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatLastSeen = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today ${timeString}` : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${timeString}`;
  };

  // Analytical Calculations
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedOrders = orders.filter(o => o.paymentStatus === 'Paid');
  
  const todayOrders = completedOrders.filter(o => new Date(o.createdAt) >= startOfToday);
  const todayRevenue = todayOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  
  const monthlyOrders = completedOrders.filter(o => new Date(o.createdAt) >= startOfMonth);
  const monthlyRevenue = monthlyOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  
  const totalOrdersCount = orders.length;

  const getWeeklySalesData = () => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      const dayOrders = completedOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= startOfDay && orderDate < endOfDay;
      });

      const daySales = dayOrders.reduce((acc, o) => acc + o.totalAmount, 0);
      result.push({
        day: d.toDateString() === now.toDateString() ? 'Today' : dayLabels[d.getDay()],
        sales: Math.round(daySales * 100) / 100
      });
    }
    return result;
  };

  const weeklySalesData = getWeeklySalesData();
  const maxWeeklySales = Math.max(...weeklySalesData.map(d => d.sales), 1);

  const totalInventoryValue = inventoryList.reduce((acc, item) => acc + ((item.quantity !== undefined ? item.quantity : item.stock) * (item.costPrice !== undefined ? item.costPrice : item.cost)), 0);

  const purchaseLogs = inventoryLogs.filter(log => log.type === 'Purchase' || log.type === 'Initial');
  const totalInventoryCost = purchaseLogs.reduce((acc, log) => acc + (log.cost || 0), 0);

  const deductionLogs = inventoryLogs.filter(log => log.type === 'Deduction');
  const totalInventoryConsumption = deductionLogs.reduce((acc, log) => acc + (log.cost || 0), 0);

  const lowStockAlertsCount = inventoryList.filter(item => item.status === 'LOW_STOCK' || item.status === 'OUT_OF_STOCK' || (item.quantity !== undefined ? item.quantity : item.stock) <= (item.reorderLevel !== undefined ? item.reorderLevel : item.minStock)).length;

  const wastageLogs = inventoryLogs.filter(log => log.type === 'Wastage' || log.type === 'Damaged');
  const totalWastageCost = wastageLogs.reduce((acc, log) => acc + (log.cost || 0), 0);

  const getTopConsumedIngredients = () => {
    const consumptionMap = {};
    inventoryLogs
      .filter(log => log.type === 'Deduction')
      .forEach(log => {
        const name = log.itemName;
        const qty = Math.abs(log.quantityChanged || 0);
        consumptionMap[name] = (consumptionMap[name] || 0) + qty;
      });
      
    return Object.entries(consumptionMap)
      .map(([name, qty]) => {
        const item = inventoryList.find(i => i.name === name);
        return { name, quantity: qty, unit: item?.unit || 'g' };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  };

  return (
    <OwnerLayout>
      <div className="owner-dashboard">
        
        {/* Style Overrides */}
        <style>{`
          .dashboard-tab-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--color-border);
            padding-bottom: 12px;
            overflow-x: auto;
          }
          .dashboard-tab {
            background: transparent;
            border: none;
            color: var(--color-text-secondary);
            font-family: var(--font-family);
            font-size: 15px;
            font-weight: 700;
            padding: 8px 14px;
            cursor: pointer;
            transition: var(--transition-smooth);
            position: relative;
            white-space: nowrap;
          }
          .dashboard-tab:hover, .dashboard-tab.active {
            color: var(--color-primary);
          }
          .dashboard-tab.active::after {
            content: '';
            position: absolute;
            bottom: -13px;
            left: 0;
            width: 100%;
            height: 3px;
            background-color: var(--color-primary);
          }
          .dashboard-header-clean {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            background: rgba(43, 29, 21, 0.4);
            border: 1px solid rgba(230, 213, 195, 0.1);
            border-radius: 12px;
            padding: 16px 20px;
          }
          .dashboard-header-clean h2 {
            font-size: 1.35rem;
            font-weight: 800;
            color: #FAF6F0;
            margin: 0;
          }
          .dashboard-header-clean p {
            font-size: 0.8rem;
            color: #A0826C;
            margin: 2px 0 0 0;
            font-weight: 600;
          }
          .analytics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .analytics-card {
            background: var(--bg-card);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 20px;
            position: relative;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
          }
          .analytics-card h4 {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .analytics-card .val {
            font-size: 24px;
            font-weight: 800;
            color: #fff;
            margin-top: 8px;
            display: block;
          }
          .analytics-card .sub {
            font-size: 11px;
            color: var(--color-success);
            margin-top: 5px;
            display: block;
            font-weight: bold;
          }
          .card-deck {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          @media (min-width: 768px) {
            .card-deck {
              grid-template-columns: 2fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
          }
          .chart-card {
            background: var(--bg-card);
            border: 1px solid var(--color-border);
            border-radius: 16px;
            padding: 20px;
          }
          @media (min-width: 768px) {
            .chart-card {
              padding: 25px;
            }
          }
          .menu-grid-admin {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
          }
          @media (min-width: 768px) {
            .menu-grid-admin {
              grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
              gap: 20px;
            }
          }
          .owner-double-deck {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
          }
          @media (min-width: 768px) {
            .owner-double-deck {
              grid-template-columns: 1fr 1fr;
              gap: 30px;
            }
          }
          .admin-menu-card {
            background: var(--bg-card);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            gap: 16px;
            position: relative;
          }
          .admin-menu-card.unavailable {
            opacity: 0.6;
          }
          .admin-menu-img {
            width: 80px;
            height: 80px;
            border-radius: 8px;
            object-fit: cover;
            flex-shrink: 0;
          }
          .admin-menu-info {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .admin-menu-title {
            font-size: 15px;
            font-weight: 700;
            color: #fff;
          }
          .admin-menu-desc {
            font-size: 12px;
            color: var(--color-text-secondary);
            margin-top: 4px;
            line-height: 1.4;
          }
          .admin-menu-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
          }
          .admin-menu-price {
            font-weight: bold;
            color: var(--color-primary);
          }
        `}</style>

        {/* Dashboard Header */}
        <div className="dashboard-header-clean">
          <div>
            <h2>
              {activeTab === 'analytics' && '📊 Business Analytics & Financials'}
              {activeTab === 'menu' && '📋 Manage Cafe Dishes'}
              {activeTab === 'staff' && '👥 Employee Accounts'}
              {activeTab === 'inventory' && '📦 Ingredient Stock & Valuations'}
              {activeTab === 'orders' && '👁️ Live Orders Monitor (Read-Only)'}
              {activeTab === 'reviews' && '⭐ Customer Reviews & Complaints'}
              {activeTab === 'config' && '⚙️ Taxes, Gateways & Tables'}
            </h2>
            <p>Cafe Owner Portal — Business Administration & Strategic Monitoring</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="dashboard-tab-bar">
          <button onClick={() => setActiveTab('analytics')} className={`dashboard-tab ${activeTab === 'analytics' ? 'active' : ''}`}>
            📊 Analytics
          </button>
          <button onClick={() => setActiveTab('menu')} className={`dashboard-tab ${activeTab === 'menu' ? 'active' : ''}`}>
            📋 Menu Items ({menuItems.length})
          </button>
          <button onClick={() => setActiveTab('staff')} className={`dashboard-tab ${activeTab === 'staff' ? 'active' : ''}`}>
            👥 Staff Roster ({staff.length})
          </button>
          <button onClick={() => setActiveTab('inventory')} className={`dashboard-tab ${activeTab === 'inventory' ? 'active' : ''}`}>
            📦 Inventory Reports
          </button>
          <button onClick={() => setActiveTab('orders')} className={`dashboard-tab ${activeTab === 'orders' ? 'active' : ''}`}>
            👁️ Monitor Orders ({orders.length})
          </button>
          <button onClick={() => setActiveTab('reviews')} className={`dashboard-tab ${activeTab === 'reviews' ? 'active' : ''}`}>
            ⭐ Reviews
          </button>
          <button onClick={() => setActiveTab('config')} className={`dashboard-tab ${activeTab === 'config' ? 'active' : ''}`}>
            ⚙️ Settings & QRs
          </button>
        </div>

        {/* TAB 1: BUSINESS ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="fade-in">
            {/* Revenue Analytics Cards */}
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Today's Settle Revenue</h4>
                <span className="val" style={{ color: '#2ecc71' }}>₹{todayRevenue.toFixed(2)}</span>
                <span className="sub">↑ 14% vs yesterday</span>
              </div>
              <div className="analytics-card">
                <h4>Monthly Settle Revenue</h4>
                <span className="val">₹{monthlyRevenue.toFixed(2)}</span>
                <span className="sub">↑ 8% this month</span>
              </div>
              <div className="analytics-card">
                <h4>Estimated Inventory Value</h4>
                <span className="val" style={{ color: '#e67e22' }}>₹{totalInventoryValue.toFixed(2)}</span>
                <span className="sub">All stock items valued</span>
              </div>
              <div className="analytics-card">
                <h4>Total Ticket Orders</h4>
                <span className="val">{totalOrdersCount} orders</span>
                <span className="sub" style={{ color: '#ff9800' }}>Active monitoring active</span>
              </div>
            </div>

            {/* Inventory Analytics Cards */}
            <div className="analytics-grid" style={{ marginTop: '16px' }}>
              <div className="analytics-card">
                <h4>Total Inventory Cost</h4>
                <span className="val" style={{ color: '#9b59b6' }}>₹{totalInventoryCost.toFixed(2)}</span>
                <span className="sub">Initial stock + Purchases</span>
              </div>
              <div className="analytics-card">
                <h4>Inventory Consumption</h4>
                <span className="val" style={{ color: '#16a085' }}>₹{totalInventoryConsumption.toFixed(2)}</span>
                <span className="sub">Cost of sold ingredients</span>
              </div>
              <div className="analytics-card">
                <h4>Wastage & Spoiled Cost</h4>
                <span className="val" style={{ color: '#e74c3c' }}>₹{totalWastageCost.toFixed(2)}</span>
                <span className="sub">Spoiled & damaged items</span>
              </div>
              <div className="analytics-card" onClick={() => setActiveTab('inventory')} style={{ cursor: 'pointer' }}>
                <h4>Low Stock Alerts</h4>
                <span className="val" style={{ color: lowStockAlertsCount > 0 ? '#e74c3c' : '#2ecc71' }}>
                  {lowStockAlertsCount} items
                </span>
                <span className="sub" style={{ color: lowStockAlertsCount > 0 ? '#e74c3c' : '#2ecc71' }}>
                  {lowStockAlertsCount > 0 ? '⚠️ Stock replenishment needed' : '✓ All items in stock'}
                </span>
              </div>
            </div>

            <div className="card-deck">
              {/* Premium Sales Graphics */}
              <div className="chart-card">
                <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 20px 0', fontWeight: 700 }}>
                  📈 Weekly Sales Performance (Last 7 Days)
                </h3>
                
                {/* Micro SVG Flexbox chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                  {weeklySalesData.map((d, index) => {
                    const percent = (d.sales / maxWeeklySales) * 100;
                    return (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                        <span style={{ fontSize: '10px', color: '#FAF6F0', fontWeight: 'bold', marginBottom: '6px' }}>₹{d.sales}</span>
                        <div style={{
                          width: '100%',
                          height: `${percent}%`,
                          background: 'linear-gradient(to top, #6F4E37, #C69B7B)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease'
                        }} />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', fontWeight: 'bold' }}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Branch Performance Comparison */}
              <div className="chart-card">
                <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 20px 0', fontWeight: 700 }}>
                  🏢 Branch Performance
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                      <span style={{ color: '#fff' }}>Main Branch</span>
                      <strong style={{ color: 'var(--color-primary)' }}>60%</strong>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '60%', height: '100%', background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                      <span style={{ color: '#fff' }}>Uptown Branch</span>
                      <strong style={{ color: 'var(--color-primary)' }}>40%</strong>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '40%', height: '100%', background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Best / Worst Selling items */}
            <div className="owner-double-deck">
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ color: '#2ecc71', margin: '0 0 15px 0', fontSize: '1rem' }}>🔥 Top Selling Cafe Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: '#fff' }}>1. Gourmet Double Cheeseburger</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>242 sold</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: '#fff' }}>2. Creamy Iced Latte</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>198 sold</span>
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ color: '#e74c3c', margin: '0 0 15px 0', fontSize: '1rem' }}>❄️ Slow Selling Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: '#fff' }}>1. Hot Pepper Veggie Soup</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>3 sold</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span style={{ color: '#fff' }}>2. Classic Black Tea</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>8 sold</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: MENU MANAGEMENT */}
        {activeTab === 'menu' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>📋 Cafe Dishes</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Create, edit, or delete items from the customer ordering menu.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowCategoryModal(true)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>
                  📁 Manage Categories
                </button>
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
                  ➕ Add Menu Item
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="🔍 Search dishes by name or category..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--bg-secondary)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {menuLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
                <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading menu items...</p>
              </div>
            ) : (
              <div className="menu-grid-admin">
                {filteredMenuItems.map(item => (
                  <div key={item.id} className={`admin-menu-card ${!item.available ? 'unavailable' : ''}`}>
                    <img src={item.image || '/images/default-food.png'} alt={item.name} className="admin-menu-img" onError={(e) => { e.target.src = '/images/default-food.png'; }} />
                    <div className="admin-menu-info">
                      <div>
                        <div className="admin-menu-title">{item.name}</div>
                        <div className="admin-menu-desc">{item.description}</div>
                      </div>
                      <div className="admin-menu-meta">
                        <span className="admin-menu-price">₹{parseFloat(item.price).toFixed(2)}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => { setEditingItem({ ...item }); setShowEditModal(true); }} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '11px', width: 'auto' }}>✏️ Edit</button>
                          <button onClick={() => handleDeleteMenuItem(item.id)} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '11px', width: 'auto', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>🗑️ Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STAFF ROSTER */}
        {activeTab === 'staff' && (
          <div className="fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
              {/* Register staff */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
                <h4 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 700 }}>Register New Staff Member</h4>
                <form onSubmit={handleAddStaff} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Full Name *</label>
                    <input type="text" className="form-input" placeholder="Staff name" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Email Address *</label>
                    <input type="email" className="form-input" placeholder="staff@cafe.com" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Phone Number *</label>
                    <input type="text" className="form-input" placeholder="Phone number" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Staff Role *</label>
                    <select className="form-input" value={newStaff.staffRole ? newStaff.staffRole.toLowerCase() : 'waiter'} onChange={(e) => setNewStaff({ ...newStaff, staffRole: e.target.value })} required>
                      <option value="chef">Chef</option>
                      <option value="waiter">Waiter</option>
                      <option value="barista">Barista</option>
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="staff">Staff / Server</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '10px', fontSize: '14px', width: '100%' }} disabled={staffLoading}>
                      Add Staff Member
                    </button>
                  </div>
                </form>
              </div>

              {/* Staff table */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
                <h4 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 700 }}>Staff Roster List</h4>
                {staffLoading && staff.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading staff roster...</p>
                  </div>
                ) : (
                  <>
                    <div className="desktop-tablet-staff" style={{ display: 'none', width: '100%', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
                            <th style={{ padding: '10px' }}>Name</th>
                            <th style={{ padding: '10px' }}>Email</th>
                            <th style={{ padding: '10px' }}>Phone</th>
                            <th style={{ padding: '10px' }}>Role</th>
                            <th style={{ padding: '10px' }}>Last Seen</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staff.map(member => (
                            <tr key={member._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '12px 10px', color: '#fff', fontWeight: 600 }}>{member.name}</td>
                              <td style={{ padding: '12px 10px' }}>{member.email}</td>
                              <td style={{ padding: '12px 10px' }}>{member.phone}</td>
                              <td style={{ padding: '12px 10px' }}>
                                <span className="admin-menu-badge" style={{ textTransform: 'capitalize' }}>{member.staffRole}</span>
                              </td>
                              <td style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                                {formatLastSeen(member.lastSeen)}
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <span style={{
                                  backgroundColor: member.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                                  color: member.isActive ? '#2ecc71' : '#e74c3c',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}>
                                  {member.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button onClick={() => { setEditingStaff({ ...member }); setShowEditStaffModal(true); }} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}>✏️ Edit</button>
                                  <button onClick={() => handleDeleteStaff(member._id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>🗑️ Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mobile-only-staff" style={{ display: 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {staff.map(member => (
                          <div key={member._id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{member.name}</span>
                              <span className="admin-menu-badge" style={{ textTransform: 'capitalize', background: 'rgba(255, 107, 8, 0.15)', color: '#FF6B08', fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>{member.staffRole}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.6' }}>
                              <div>📧 {member.email}</div>
                              <div>📞 {member.phone}</div>
                              <div style={{ marginTop: '4px' }}>Seen: {formatLastSeen(member.lastSeen)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                              <span style={{
                                backgroundColor: member.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                                color: member.isActive ? '#2ecc71' : '#e74c3c',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {member.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => { setEditingStaff({ ...member }); setShowEditStaffModal(true); }} className="btn btn-secondary touch-btn" style={{ padding: '8px 12px', fontSize: '13px', minHeight: '44px' }}>✏️ Edit</button>
                                <button onClick={() => handleDeleteStaff(member._id)} className="btn btn-secondary touch-btn" style={{ padding: '8px 12px', fontSize: '13px', minHeight: '44px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>🗑️ Delete</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="fade-in">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>📦 Smart Multi-Branch Ingredient Hub</h3>
                <button 
                  onClick={() => setShowAddInventoryModal(true)} 
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                >
                  ➕ Add Ingredient
                </button>
              </div>

              {/* Sub-tab bar */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', overflowX: 'auto' }}>
                <button onClick={() => setInventorySubTab('levels')} style={{ background: inventorySubTab === 'levels' ? '#6F4E37' : 'transparent', color: '#fff', border: inventorySubTab === 'levels' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>📋 Stock Directory</button>
                <button onClick={() => setInventorySubTab('movements')} style={{ background: inventorySubTab === 'movements' ? '#6F4E37' : 'transparent', color: '#fff', border: inventorySubTab === 'movements' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>⏳ Movement Ledger</button>
                <button onClick={() => setInventorySubTab('wastage')} style={{ background: inventorySubTab === 'wastage' ? '#6F4E37' : 'transparent', color: '#fff', border: inventorySubTab === 'wastage' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>🥀 Wastage Reports</button>
                <button onClick={() => setInventorySubTab('suppliers')} style={{ background: inventorySubTab === 'suppliers' ? '#6F4E37' : 'transparent', color: '#fff', border: inventorySubTab === 'suppliers' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>🤝 Supplier Registry</button>
              </div>

              {inventoryError && (
                <div style={{ backgroundColor: 'var(--color-danger-bg)', borderLeft: '4px solid var(--color-danger)', color: '#fff', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>
                  ⚠️ {inventoryError}
                </div>
              )}

              {inventoryLoading && inventoryList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Synchronizing stock records...</p>
                </div>
              ) : (
                <div>
                  {/* SUBTAB 1: Stock levels table */}
                  {inventorySubTab === 'levels' && (
                    <div>
                      <div style={{ marginBottom: '20px' }}>
                        <input
                          type="text"
                          placeholder="🔍 Search ingredients by name or category..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--bg-secondary)',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)', color: '#FAF6F0' }}>
                              <th style={{ padding: '8px' }}>Ingredient Name</th>
                              <th style={{ padding: '8px' }}>Category</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Stock Level</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                              <th style={{ padding: '8px', textAlign: 'right' }}>Cost Price</th>
                              <th style={{ padding: '8px', textAlign: 'right' }}>Selling Price</th>
                              <th style={{ padding: '8px' }}>Supplier</th>
                              <th style={{ padding: '8px' }}>Branch</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Reorder Level</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInventoryList.map(item => {
                              const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
                              const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
                              const isLow = qtyVal <= reorderVal;
                              const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;
                            
                            let statusColor = '#2ECC71';
                            if (qtyVal <= 0) statusColor = '#E74C3C';
                            else if (isLow) statusColor = '#F39C12';

                            return (
                              <tr key={item._id} style={{ borderBottom: '1px solid #432E22' }}>
                                <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 'bold' }}>{item.name}</td>
                                <td style={{ padding: '10px 8px', color: '#E6D5C3' }}>{item.category || 'Ingredients'}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isLow ? '#E74C3C' : '#fff' }}>
                                  {qtyVal} {item.unit}
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                  <span style={{
                                    backgroundColor: `${statusColor}1A`,
                                    border: `1px solid ${statusColor}`,
                                    color: statusColor,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                  }}>
                                    {qtyVal <= 0 ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'IN_STOCK'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{costPriceVal?.toFixed(2)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(item.sellingPrice || 0).toFixed(2)}</td>
                                <td style={{ padding: '10px 8px' }}>{item.supplier || 'N/A'}</td>
                                <td style={{ padding: '10px 8px' }}>{item.branch || 'Main'}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{reorderVal} {item.unit}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <button 
                                      onClick={() => {
                                        setPurchaseForm({
                                          itemId: item._id,
                                          itemName: item.name,
                                          quantityAdded: 0,
                                          costPrice: costPriceVal,
                                          supplier: item.supplier || '',
                                          notes: ''
                                        });
                                        setShowPurchaseModal(true);
                                      }}
                                      style={{ background: '#27AE60', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                    >
                                      ➕ Purchase
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setWastageForm({
                                          itemId: item._id,
                                          itemName: item.name,
                                          quantityWasted: 0,
                                          type: 'Wastage',
                                          reason: ''
                                        });
                                        setShowWastageModal(true);
                                      }}
                                      style={{ background: '#E74C3C', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                    >
                                      🥀 Wastage
                                    </button>
                                    <button 
                                      onClick={() => { setEditingInventoryItem({ ...item }); setShowEditInventoryModal(true); }} 
                                      style={{ background: 'transparent', color: '#FAF6F0', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                    >
                                      ✏️
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteInventoryItem(item._id)} 
                                      style={{ background: 'transparent', color: '#E74C3C', border: '1px solid #E74C3C', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                  {/* SUBTAB 2: Movement Logs */}
                  {inventorySubTab === 'movements' && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--color-border)', color: '#FAF6F0' }}>
                            <th style={{ padding: '8px' }}>Timestamp</th>
                            <th style={{ padding: '8px' }}>Ingredient</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Type</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Stock Adjustment</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Calculated Cost</th>
                            <th style={{ padding: '8px' }}>Reason / Context</th>
                            <th style={{ padding: '8px' }}>Operator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryLogs.map(log => {
                            const isPositive = log.quantityChanged > 0;
                            const typeColor = log.type === 'Purchase' || log.type === 'Initial' ? '#2ECC71' : log.type === 'Wastage' || log.type === 'Damaged' ? '#E74C3C' : '#F39C12';
                            return (
                              <tr key={log._id} style={{ borderBottom: '1px solid #432E22' }}>
                                <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
                                  {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 'bold' }}>{log.itemName}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                  <span style={{
                                    backgroundColor: `${typeColor}1A`,
                                    border: `1px solid ${typeColor}`,
                                    color: typeColor,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                  }}>
                                    {log.type}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isPositive ? '#2ECC71' : '#E74C3C' }}>
                                  {isPositive ? `+${log.quantityChanged}` : log.quantityChanged}
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#FAF6F0' }}>
                                  ₹{(log.cost || 0).toFixed(2)}
                                </td>
                                <td style={{ padding: '10px 8px', color: '#E6D5C3' }}>{log.reason}</td>
                                <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.userEmail || 'system'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SUBTAB 3: Wastage Reports */}
                  {inventorySubTab === 'wastage' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="analytics-grid">
                        <div className="analytics-card" style={{ background: '#1F140E' }}>
                          <h4>Total Wastage Events</h4>
                          <span className="val" style={{ color: '#e74c3c' }}>{wastageReport.count}</span>
                        </div>
                        <div className="analytics-card" style={{ background: '#1F140E' }}>
                          <h4>Aggregate Cost of Wastage</h4>
                          <span className="val" style={{ color: '#e74c3c' }}>₹{(wastageReport.totalCost || 0).toFixed(2)}</span>
                        </div>
                        <div className="analytics-card" style={{ background: '#1F140E' }}>
                          <h4>Total Recipe Deductions Cost</h4>
                          <span className="val" style={{ color: '#16a085' }}>₹{(consumptionReport.totalCost || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <h4 style={{ color: '#FAF6F0', margin: '10px 0 0 0' }}>Detailed Wastage & Spoilage Log</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--color-border)', color: '#FAF6F0' }}>
                            <th style={{ padding: '8px' }}>Date</th>
                            <th style={{ padding: '8px' }}>Ingredient</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Type</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Quantity Lost</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Wasted Cost</th>
                            <th style={{ padding: '8px' }}>Wastage Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryLogs.filter(log => log.type === 'Wastage' || log.type === 'Damaged').map(log => (
                            <tr key={log._id} style={{ borderBottom: '1px solid #432E22' }}>
                              <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
                                {new Date(log.createdAt).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 'bold' }}>{log.itemName}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>{log.type}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', color: '#E74C3C', fontWeight: 'bold' }}>
                                {Math.abs(log.quantityChanged)}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#E74C3C', fontWeight: 'bold' }}>
                                  ₹{log.cost.toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 8px', color: '#E6D5C3' }}>{log.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SUBTAB 4: Suppliers */}
                  {inventorySubTab === 'suppliers' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {Array.from(new Set(inventoryList.map(item => item.supplier || 'Unassigned Supplier'))).map(sup => {
                        const supItems = inventoryList.filter(item => (item.supplier || 'Unassigned Supplier') === sup);
                        const totalSupplierValue = supItems.reduce((sum, i) => sum + ((i.quantity || i.stock) * (i.costPrice || i.cost)), 0);
                        return (
                          <div key={sup} style={{ background: '#1F140E', border: '1px solid #432E22', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #432E22', paddingBottom: '8px', marginBottom: '12px' }}>
                              <strong style={{ color: '#fff', fontSize: '1rem' }}>🤝 {sup}</strong>
                              <span style={{ fontSize: '11px', background: '#6F4E37', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                {supItems.length} Products
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {supItems.map(item => (
                                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                  <span style={{ color: '#E6D5C3' }}>{item.name}</span>
                                  <strong style={{ color: '#fff' }}>{item.quantity || item.stock} {item.unit}</strong>
                                </div>
                              ))}
                            </div>
                            <div style={{ borderTop: '1px dashed #432E22', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                              <span>Total Value:</span>
                              <strong style={{ color: '#2ECC71' }}>₹{totalSupplierValue.toFixed(2)}</strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ORDERS MONITOR (READ-ONLY) */}
        {activeTab === 'orders' && (
          <div className="fade-in">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', overflowX: 'auto' }}>
              <h3 style={{ color: '#fff', margin: '0 0 15px 0', fontSize: '1.2rem' }}>👁️ Live Cafe Order Monitor (Read-Only)</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                Operational staff handles accepting and cooking. This panel provides real-time transaction overview only.
              </p>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)' }}>
                    <th style={{ padding: '8px' }}>Order ID</th>
                    <th style={{ padding: '8px' }}>Table</th>
                    <th style={{ padding: '8px' }}>Amount</th>
                    <th style={{ padding: '8px' }}>Items</th>
                    <th style={{ padding: '8px' }}>Kitchen Status</th>
                    <th style={{ padding: '8px' }}>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 600 }}>
                        #{order._id.substring(order._id.length - 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '12px 8px' }}>Table {order.tableNumber}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>₹{order.totalAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : order.status === 'Delivered' ? '#9b59b6' : order.status === 'Completed' ? '#27AE60' : '#7f8c8d',
                          background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : order.status === 'Delivered' ? 'rgba(155,89,182,0.1)' : order.status === 'Completed' ? 'rgba(39,174,96,0.1)' : 'rgba(127,140,141,0.1)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          color: order.paymentStatus === 'Paid' ? '#27AE60' : '#E74C3C',
                          fontWeight: 'bold'
                        }}>
                          {order.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: CUSTOMER REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="fade-in">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
              <h3 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700 }}>⭐ Customer Feedback & Comments</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {reviewsList.map(r => (
                  <div key={r.id} style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--color-border)',
                    padding: '16px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: '#fff' }}>{r.author}</strong>
                      <span style={{ color: '#ff9800' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', color: '#E6D5C3', fontSize: '0.85rem', lineHeight: '1.4' }}>{r.text}</p>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{r.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SETTINGS & QRS */}
        {activeTab === 'config' && (
          <div className="fade-in">
            {/* Payment Integration settings */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', marginBottom: '30px' }}>
              <h3 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700 }}>⚙️ Setup Payment Gateways</h3>
              {settingsMsg && (
                <div style={{ background: 'rgba(39,174,96,0.15)', borderLeft: '4px solid #27AE60', color: '#27AE60', padding: '12px', marginBottom: '20px', borderRadius: '4px' }}>
                  {settingsMsg}
                </div>
              )}
              <form onSubmit={handleSaveSettings}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Razorpay Key ID</label>
                    <input type="text" className="form-input" value={razorpayKeyId} onChange={(e) => setRazorpayKeyId(e.target.value)} placeholder="rzp_test_..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Razorpay Secret Key</label>
                    <input type="password" className="form-input" value={razorpaySecret} onChange={(e) => setRazorpaySecret(e.target.value)} placeholder="••••••••••••••••••••" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '15px', borderRadius: '8px', border: '1px dashed #5C4331', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isRazorpayVerified ? '#2ECC71' : '#E6D5C3' }}>
                      Status: {isRazorpayVerified ? 'Keys Verified & Configured ✓' : 'Verification Required'}
                    </span>
                  </div>
                  <button type="button" onClick={testRazorpayConnection} className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }} disabled={verifyingKeys}>
                    {verifyingKeys ? 'Verifying...' : 'Test Razorpay Connection'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>GST Tax Rate (%)</label>
                    <input type="number" className="form-input" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value))} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ color: '#fff' }}>Service Charge (%)</label>
                    <input type="number" className="form-input" value={serviceCharge} onChange={(e) => setServiceCharge(parseFloat(e.target.value))} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  Save Configuration
                </button>
              </form>
            </div>

            {/* QR Code generator */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
              <h3 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 700 }}>📋 Table QR Codes Generator</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                Select a table to dynamically render its scan QR code. Customers can scan it to order directly.
              </p>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {dynamicTables.map((table) => (
                  <button
                    key={table}
                    onClick={() => setSelectedQrTable(selectedQrTable === table ? null : table)}
                    className="category-chip"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-sm)',
                      background: selectedQrTable === table ? 'var(--color-primary)' : 'transparent',
                      border: '1px solid var(--color-primary)',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Table {table} QR
                  </button>
                ))}
              </div>

              {selectedQrTable && (
                <div style={{
                  padding: '20px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
                    Scan QR for Table {selectedQrTable}
                  </h4>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}`)}`} 
                      alt={`Table ${selectedQrTable} QR Code`}
                      style={{ width: '150px', height: '150px', display: 'block' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a href={`/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', width: 'auto' }}>
                      🔗 Open Menu Tab
                    </a>
                    <button onClick={() => handleCopyUrl(selectedQrTable)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}>
                      {copiedLink ? '✓ Copied!' : '📋 Copy URL'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL 1: ADD NEW MENU ITEM */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">➕ Add New Cafe Item</h3>
                <button onClick={() => setShowAddModal(false)} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleAddMenuItem}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Dish Name *</label>
                    <input type="text" required placeholder="Gourmet double cheeseburger" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Price (₹) *</label>
                      <input type="number" required step="0.01" min="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="form-input">
                        {(categories.length > 0 ? categories.map(c => c.name) : presetCategories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea required rows="3" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} className="form-input"></textarea>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preparation Time (minutes) *</label>
                    <input type="number" required min="1" value={newItem.preparationTime || 10} onChange={(e) => setNewItem({ ...newItem, preparationTime: parseInt(e.target.value) })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dish Image</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="add-dish-image"
                        onChange={(e) => handleImageUpload(e.target.files[0], false)} 
                        style={{ display: 'none' }} 
                      />
                      <label 
                        htmlFor="add-dish-image" 
                        className="btn btn-secondary" 
                        style={{ 
                          width: 'auto', 
                          padding: '10px 18px', 
                          cursor: 'pointer', 
                          margin: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          border: '1px solid var(--color-border)',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: '#fff',
                          minHeight: '44px'
                        }}
                      >
                        📷 Choose Image File
                      </label>
                      {imageUploading ? (
                        <span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Uploading...</span>
                      ) : newItem.image ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img src={newItem.image} alt="Dish preview" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
                          <span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>✓ Uploaded</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No file selected (using default)</span>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ borderTop: '1px solid #432E22', paddingTop: '15px', marginTop: '15px' }}>
                    <label className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>🍳 Recipe Mapping (Ingredients)</label>
                    {(!newItem.recipe || newItem.recipe.length === 0) ? (
                      <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '5px 0' }}>No ingredients mapped yet. This item will not deduct stock.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {newItem.recipe.map((ing, idx) => {
                          const invItem = inventoryList.find(i => i.name === ing.name);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '6px' }}>
                              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{ing.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{ing.quantity} {invItem?.unit || 'g'}</span>
                                <button type="button" onClick={() => handleRemoveIngredientFromNewItem(ing.name)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Select Ingredient</label>
                        <select value={selectedIngredient} onChange={(e) => setSelectedIngredient(e.target.value)} className="form-input" style={{ padding: '8px' }}>
                          <option value="">-- Choose Ingredient --</option>
                          {inventoryList.map(inv => (
                            <option key={inv._id} value={inv.name}>{inv.name} ({inv.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
                        <input type="number" step="0.001" min="0.001" placeholder="e.g. 10" value={ingredientQuantity} onChange={(e) => setIngredientQuantity(e.target.value)} className="form-input" style={{ padding: '8px' }} />
                      </div>
                      <button type="button" onClick={handleAddIngredientToNewItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>➕ Map</button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Add Item</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: EDIT MENU ITEM */}
        {showEditModal && editingItem && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">✏️ Edit Cafe Item</h3>
                <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleEditMenuItem}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Dish Name *</label>
                    <input type="text" required value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Price (₹) *</label>
                      <input type="number" required step="0.01" min="0.01" value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <select value={editingItem.category} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} className="form-input">
                        {(categories.length > 0 ? categories.map(c => c.name) : presetCategories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea required rows="3" value={editingItem.description} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} className="form-input"></textarea>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preparation Time (minutes) *</label>
                    <input type="number" required min="1" value={editingItem.preparationTime || 10} onChange={(e) => setEditingItem({ ...editingItem, preparationTime: parseInt(e.target.value) })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dish Image</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="edit-dish-image"
                        onChange={(e) => handleImageUpload(e.target.files[0], true)} 
                        style={{ display: 'none' }} 
                      />
                      <label 
                        htmlFor="edit-dish-image" 
                        className="btn btn-secondary" 
                        style={{ 
                          width: 'auto', 
                          padding: '10px 18px', 
                          cursor: 'pointer', 
                          margin: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          border: '1px solid var(--color-border)',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: '#fff',
                          minHeight: '44px'
                        }}
                      >
                        📷 Choose Image File
                      </label>
                      {imageUploading ? (
                        <span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Uploading...</span>
                      ) : editingItem.image ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img src={editingItem.image} alt="Dish preview" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
                          <span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>✓ Uploaded</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No file selected (using default)</span>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ borderTop: '1px solid #432E22', paddingTop: '15px', marginTop: '15px' }}>
                    <label className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>🍳 Recipe Mapping (Ingredients)</label>
                    {(!editingItem.recipe || editingItem.recipe.length === 0) ? (
                      <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '5px 0' }}>No ingredients mapped yet. This item will not deduct stock.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {editingItem.recipe.map((ing, idx) => {
                          const invItem = inventoryList.find(i => i.name === ing.name);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '6px' }}>
                              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{ing.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{ing.quantity} {invItem?.unit || 'g'}</span>
                                <button type="button" onClick={() => handleRemoveIngredientFromEditingItem(ing.name)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Select Ingredient</label>
                        <select value={selectedIngredient} onChange={(e) => setSelectedIngredient(e.target.value)} className="form-input" style={{ padding: '8px' }}>
                          <option value="">-- Choose Ingredient --</option>
                          {inventoryList.map(inv => (
                            <option key={inv._id} value={inv.name}>{inv.name} ({inv.unit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
                        <input type="number" step="0.001" min="0.001" placeholder="e.g. 10" value={ingredientQuantity} onChange={(e) => setIngredientQuantity(e.target.value)} className="form-input" style={{ padding: '8px' }} />
                      </div>
                      <button type="button" onClick={handleAddIngredientToEditingItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>➕ Map</button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: MANAGE CATEGORIES */}
        {showCategoryModal && (
          <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 className="modal-title">📁 Manage Menu Categories</h3>
                <button onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }} className="modal-close">&times;</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Add new Category */}
                <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <input
                    type="text"
                    required
                    placeholder="New category name..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="form-input"
                    style={{ marginBottom: 0, flexGrow: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
                    ➕ Add
                  </button>
                </form>

                {/* Edit existing Category */}
                {editingCategory && (
                  <form onSubmit={handleUpdateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255, 107, 8, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-primary)' }}>
                    <input
                      type="text"
                      required
                      placeholder="Rename category..."
                      value={categoryNameInput}
                      onChange={(e) => setCategoryNameInput(e.target.value)}
                      className="form-input"
                      style={{ marginBottom: 0, flexGrow: 1 }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
                      💾 Save
                    </button>
                    <button type="button" onClick={() => { setEditingCategory(null); setCategoryNameInput(''); }} className="btn btn-secondary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
                      Cancel
                    </button>
                  </form>
                )}

                {/* List Categories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ color: '#fff', fontSize: '14px', margin: '0 0 5px 0' }}>Existing Categories:</h4>
                  {categoryLoading && categories.length === 0 ? (
                    <div className="spinner" style={{ margin: '10px auto', borderColor: 'var(--color-primary)', width: '20px', height: '20px', borderWidth: '2px' }} />
                  ) : (categories.length > 0 ? categories : presetCategories.map((name, idx) => ({ _id: idx, name }))).map((cat) => (
                    <div
                      key={cat._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--color-border)',
                        padding: '8px 12px',
                        borderRadius: '8px'
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{cat.name}</span>
                      {/* Only show edit/delete if it's a real db category */}
                      {cat._id && typeof cat._id === 'string' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => { setEditingCategory(cat); setCategoryNameInput(cat.name); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px' }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat._id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '13px' }}
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Default Preset</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: ADD INVENTORY ITEM */}
        {showAddInventoryModal && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">➕ Add Ingredient</h3>
                <button onClick={() => setShowAddInventoryModal(false)} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleAddInventoryItem}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Ingredient Name *</label>
                    <input type="text" required value={newInventoryItem.name} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, name: e.target.value })} className="form-input" placeholder="e.g. Tomato Sauce" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Initial Stock *</label>
                      <input type="number" required value={newInventoryItem.stock} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, stock: Number(e.target.value), quantity: Number(e.target.value) })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Safety Minimum *</label>
                      <input type="number" required value={newInventoryItem.minStock} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, minStock: Number(e.target.value), reorderLevel: Number(e.target.value) })} className="form-input" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Unit of Measurement *</label>
                      <input type="text" required value={newInventoryItem.unit} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })} className="form-input" placeholder="e.g. kg, pcs, g, liters" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cost per Unit (₹) *</label>
                      <input type="number" step="0.001" required value={newInventoryItem.cost} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, cost: Number(e.target.value), costPrice: Number(e.target.value) })} className="form-input" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Selling Price (₹) *</label>
                      <input type="number" step="0.01" required value={newInventoryItem.sellingPrice} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, sellingPrice: Number(e.target.value) })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <input type="text" required value={newInventoryItem.category} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, category: e.target.value })} className="form-input" placeholder="e.g. Ingredients, Dairy, Beverage Raw" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Supplier *</label>
                      <input type="text" required value={newInventoryItem.supplier} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, supplier: e.target.value })} className="form-input" placeholder="Supplier name" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Branch *</label>
                      <input type="text" required value={newInventoryItem.branch} onChange={(e) => setNewInventoryItem({ ...newInventoryItem, branch: e.target.value })} className="form-input" placeholder="e.g. Main, Uptown" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowAddInventoryModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Add Ingredient</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: EDIT INVENTORY ITEM */}
        {showEditInventoryModal && editingInventoryItem && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">✏️ Edit Ingredient</h3>
                <button onClick={() => { setShowEditInventoryModal(false); setEditingInventoryItem(null); }} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleEditInventoryItem}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Ingredient Name *</label>
                    <input type="text" required value={editingInventoryItem.name} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, name: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Current Stock *</label>
                      <input type="number" required value={editingInventoryItem.stock} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, stock: Number(e.target.value), quantity: Number(e.target.value) })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Safety Minimum *</label>
                      <input type="number" required value={editingInventoryItem.minStock} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, minStock: Number(e.target.value), reorderLevel: Number(e.target.value) })} className="form-input" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Unit of Measurement *</label>
                      <input type="text" required value={editingInventoryItem.unit} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, unit: e.target.value })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cost per Unit (₹) *</label>
                      <input type="number" step="0.001" required value={editingInventoryItem.cost} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, cost: Number(e.target.value), costPrice: Number(e.target.value) })} className="form-input" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Selling Price (₹) *</label>
                      <input type="number" step="0.01" required value={editingInventoryItem.sellingPrice || 0} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, sellingPrice: Number(e.target.value) })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <input type="text" required value={editingInventoryItem.category || 'Ingredients'} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, category: e.target.value })} className="form-input" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Supplier *</label>
                      <input type="text" required value={editingInventoryItem.supplier || ''} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, supplier: e.target.value })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Branch *</label>
                      <input type="text" required value={editingInventoryItem.branch || 'Main'} onChange={(e) => setEditingInventoryItem({ ...editingInventoryItem, branch: e.target.value })} className="form-input" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => { setShowEditInventoryModal(false); setEditingInventoryItem(null); }} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD PURCHASE */}
        {showPurchaseModal && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">➕ Record Purchase Entry</h3>
                <button onClick={() => setShowPurchaseModal(false)} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleRecordPurchase}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Ingredient: <strong>{purchaseForm.itemName}</strong></label>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Quantity Purchased *</label>
                      <input type="number" required min="1" value={purchaseForm.quantityAdded} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantityAdded: Number(e.target.value) })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cost Price per Unit (₹) *</label>
                      <input type="number" step="0.001" required min="0.001" value={purchaseForm.costPrice} onChange={(e) => setPurchaseForm({ ...purchaseForm, costPrice: Number(e.target.value) })} className="form-input" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier *</label>
                    <input type="text" required value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} className="form-input" rows="2" placeholder="e.g. Weekly restocking"></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowPurchaseModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Entry</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD WASTAGE */}
        {showWastageModal && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">🥀 Record Wastage / Spoilage</h3>
                <button onClick={() => setShowWastageModal(false)} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleRecordWastage}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Ingredient: <strong>{wastageForm.itemName}</strong></label>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Quantity Wasted *</label>
                      <input type="number" required min="1" value={wastageForm.quantityWasted} onChange={(e) => setWastageForm({ ...wastageForm, quantityWasted: Number(e.target.value) })} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Wastage Type *</label>
                      <select value={wastageForm.type} onChange={(e) => setWastageForm({ ...wastageForm, type: e.target.value })} className="form-input">
                        <option value="Wastage">Spoiled / Expired (Wastage)</option>
                        <option value="Damaged">Damaged / Dropped (Damaged)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason / Notes *</label>
                    <input type="text" required value={wastageForm.reason} onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })} className="form-input" placeholder="e.g. Power outage defrosted, dropped tray" />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => setShowWastageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Entry</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: EDIT STAFF MEMBER */}
        {showEditStaffModal && editingStaff && (
          <div className="modal-overlay">
            <div className="modal-container">
              <div className="modal-header">
                <h3 className="modal-title">✏️ Edit Staff Member</h3>
                <button onClick={() => { setShowEditStaffModal(false); setEditingStaff(null); }} className="modal-close">&times;</button>
              </div>
              <form onSubmit={handleEditStaff}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input type="text" required value={editingStaff.name} onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input type="email" required value={editingStaff.email} onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input type="text" required value={editingStaff.phone} onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })} className="form-input" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Staff Role *</label>
                      <select value={editingStaff.staffRole ? editingStaff.staffRole.toLowerCase() : ''} onChange={(e) => setEditingStaff({ ...editingStaff, staffRole: e.target.value })} className="form-input">
                        <option value="chef">Chef</option>
                        <option value="waiter">Waiter</option>
                        <option value="barista">Barista</option>
                        <option value="cashier">Cashier</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff / Server</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status *</label>
                      <select value={editingStaff.isActive ? 'true' : 'false'} onChange={(e) => setEditingStaff({ ...editingStaff, isActive: e.target.value === 'true' })} className="form-input">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" onClick={() => { setShowEditStaffModal(false); setEditingStaff(null); }} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </OwnerLayout>
  );
};

export default OwnerDashboard;
