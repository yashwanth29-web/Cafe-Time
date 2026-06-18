import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
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
 reorderCategories,
 getInventoryCategories,
 createInventoryCategory,
 deleteInventoryCategory,
 uploadMenuItemImage,
 getBranches,
 createBranch,
 updateBranch,
 deleteBranch,
 getOwnerTodayAttendance,
 getOwnerAttendanceReports,
 getWorkReports,
 getReviews,
 getAssetUrl } from
'../services/api';
import { useAuth } from '../context/AuthContext';
import OwnerLayout from '../components/OwnerLayout';

const AdminMenuImage = ({ item }) =>{
 const isValidUrl = (url) =>{
 if (!url || typeof url !== 'string' || url.trim() === '') return false;
 return url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
 };

 const getCategoryIcon = (categoryName) =>{
 const cat = (categoryName || '').toLowerCase();
 if (cat.includes('chai') || cat.includes('tea')) return '';
 if (cat.includes('coffee')) return '';
 if (cat.includes('juice') || cat.includes('cooler') || cat.includes('drink') || cat.includes('beverage')) return '';
 if (cat.includes('milkshake') || cat.includes('shake')) return '';
 if (cat.includes('starter') || cat.includes('bite') || cat.includes('snack')) return '';
 if (cat.includes('fry') || cat.includes('fries') || cat.includes('potato')) return '';
 if (cat.includes('burger')) return '';
 if (cat.includes('sandwich')) return '';
 if (cat.includes('pizza')) return '';
 if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('cake')) return '';
 return '';
 };

 const [imgFailed, setImgFailed] = useState(!isValidUrl(item.image));
 const [prevImage, setPrevImage] = useState(item.image);
 const resolvedSrc = getAssetUrl(item.image);

 if (item.image !== prevImage) {
 setPrevImage(item.image);
 setImgFailed(!isValidUrl(item.image));
 }

 if (imgFailed) {
 return (
<div
 className="admin-menu-img"
 style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 background: 'linear-gradient(135deg, #1C2B24 0%, #121815 100%)',
 color: 'var(--color-primary)',
 fontSize: '36px',
 userSelect: 'none',
 flexDirection: 'column',
 gap: '4px'
 }}>
 
 {getCategoryIcon(item.category)}
</div>);

 }

 return (
<img
 src={resolvedSrc}
 alt={item.name}
 className="admin-menu-img"
 onError={() =>setImgFailed(true)} />);

};

const OwnerDashboard = () =>{
 const { logout, user } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const [searchParams] = useSearchParams();
 const tabParam = searchParams.get('tab');

 // Navigation Tabs
 const [activeTab, setActiveTab] = useState(() =>{
 const tab = tabParam || location.state?.activeTab || 'analytics';
 if (tab === 'reviews') return 'menu';
 if (tab === 'reports' || tab === 'attendance') return 'staff';
 if (tab === 'settings' || tab === 'config') return 'analytics'; // will redirect in useEffect
 return tab;
 });

 const [menuSubTab, setMenuSubTab] = useState(() =>{
 return tabParam === 'reviews' ? 'reviews' : 'dishes';
 });

 const [staffSubTab, setStaffSubTab] = useState(() =>{
 return tabParam === 'reports' ? 'reports' : tabParam === 'attendance' ? 'attendance' : 'roster';
 });

 useEffect(() =>{
 if (tabParam) {
 if (tabParam === 'reviews') {
 setActiveTab('menu');
 setMenuSubTab('reviews');
 } else if (tabParam === 'reports') {
 setActiveTab('staff');
 setStaffSubTab('reports');
 } else if (tabParam === 'attendance') {
 setActiveTab('staff');
 setStaffSubTab('attendance');
 } else if (tabParam === 'settings' || tabParam === 'config') {
 navigate('/owner/profile');
 } else {
 setActiveTab(tabParam);
 if (tabParam === 'menu') {
 setMenuSubTab('dishes');
 }
 if (tabParam === 'staff') {
 setStaffSubTab('roster');
 }
 }
 } else {
 setActiveTab('analytics');
 }
 }, [tabParam, navigate]);

 // Base Data States
 const [orders, setOrders] = useState([]);
 const [ordersLoading, setOrdersLoading] = useState(true);
 const [ordersError, setOrdersError] = useState('');
 const [orderDateFilter, setOrderDateFilter] = useState(() => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
 });
 const [orderSearchQuery, setOrderSearchQuery] = useState('');
 const [menuItems, setMenuItems] = useState([]);
 const [menuLoading, setMenuLoading] = useState(false);
 const [menuError, setMenuError] = useState('');
 const [staff, setStaff] = useState([]);
 const [staffLoading, setStaffLoading] = useState(false);
 const [staffError, setStaffError] = useState('');
 const [staffSearchQuery, setStaffSearchQuery] = useState('');
 const [staffFilterRole, setStaffFilterRole] = useState('');
 const [staffFilterBranch, setStaffFilterBranch] = useState('');
 const [staffFilterStatus, setStaffFilterStatus] = useState('');

 // Branch & Attendance States
 const [branches, setBranches] = useState([]);
 const [branchesLoading, setBranchesLoading] = useState(false);
 const [branchesError, setBranchesError] = useState('');
 const [showAddBranchModal, setShowAddBranchModal] = useState(false);
 const [showEditBranchModal, setShowEditBranchModal] = useState(false);
 const [editingBranch, setEditingBranch] = useState(null);
 const [newBranch, setNewBranch] = useState({
 branchName: '',
 address: '',
 manager: '',
 latitude: '',
 longitude: '',
 allowedRadius: 30
 });
 const [detectingLocation, setDetectingLocation] = useState(false);
 const [attendanceRecords, setAttendanceRecords] = useState([]);
 const [attendanceSummary, setAttendanceSummary] = useState({
 totalStaff: 0,
 present: 0,
 absent: 0,
 late: 0,
 checkedOut: 0,
 currentlyWorking: 0
 });
 const [attendanceLoading, setAttendanceLoading] = useState(false);
 const [reportRange, setReportRange] = useState('daily');
 const [reportBranch, setReportBranch] = useState('');
 const [attendanceReports, setAttendanceReports] = useState(null);

 // Work Report states
 const [workReports, setWorkReports] = useState([]);
 const [reportsLoading, setReportsLoading] = useState(false);
 const [reportsError, setReportsError] = useState('');
 const [reportsFilterRange, setReportsFilterRange] = useState('today'); // 'today', 'this_week', 'all'
 const [reportsFilterStaff, setReportsFilterStaff] = useState('');
 const [reportsFilterBranch, setReportsFilterBranch] = useState('');
 const [selectedReport, setSelectedReport] = useState(null);

 // Form / Dialog States
 const [showAddModal, setShowAddModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showEditStaffModal, setShowEditStaffModal] = useState(false);
 const [showAddStaffModal, setShowAddStaffModal] = useState(false);
 const [editingStaff, setEditingStaff] = useState(null);
 const [editingItem, setEditingItem] = useState(null);

 // New staff input state
 const [newStaff, setNewStaff] = useState({
 name: '',
 email: '',
 phone: '',
 staffRole: 'waiter',
 assignedBranch: ''
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

 const handleAddIngredientToNewItem = () =>{
 if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity)<= 0) {
 alert('Please select an ingredient and enter a valid quantity.');
 return;
 }
 if (newItem.recipe && newItem.recipe.find((ing) =>ing.name === selectedIngredient)) {
 alert('Ingredient already added to recipe.');
 return;
 }
 const updatedRecipe = [...(newItem.recipe || []), { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
 setNewItem({ ...newItem, recipe: updatedRecipe });
 setSelectedIngredient('');
 setIngredientQuantity('');
 };

 const handleRemoveIngredientFromNewItem = (name) =>{
 const updatedRecipe = (newItem.recipe || []).filter((ing) =>ing.name !== name);
 setNewItem({ ...newItem, recipe: updatedRecipe });
 };

 const handleAddIngredientToEditingItem = () =>{
 if (!selectedIngredient || !ingredientQuantity || parseFloat(ingredientQuantity)<= 0) {
 alert('Please select an ingredient and enter a valid quantity.');
 return;
 }
 if (editingItem.recipe && editingItem.recipe.find((ing) =>ing.name === selectedIngredient)) {
 alert('Ingredient already added to recipe.');
 return;
 }
 const updatedRecipe = [...(editingItem.recipe || []), { name: selectedIngredient, quantity: parseFloat(ingredientQuantity) }];
 setEditingItem({ ...editingItem, recipe: updatedRecipe });
 setSelectedIngredient('');
 setIngredientQuantity('');
 };

 const handleRemoveIngredientFromEditingItem = (name) =>{
 const updatedRecipe = (editingItem.recipe || []).filter((ing) =>ing.name !== name);
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

 // Customer Reviews States
 const [reviews, setReviews] = useState([]);
 const [reviewsLoading, setReviewsLoading] = useState(false);
 const [reviewsError, setReviewsError] = useState('');
 const [reviewsSummary, setReviewsSummary] = useState({
 totalReviews: 0,
 averageRating: 0,
 distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
 });
 const [reviewsFilterRating, setReviewsFilterRating] = useState('');

 // Search states
 const [menuSearch, setMenuSearch] = useState('');
 const [inventorySearch, setInventorySearch] = useState('');

 const filteredMenuItems = menuItems.filter((item) =>
 item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
 (item.category || '').toLowerCase().includes(menuSearch.toLowerCase())
);

  const filteredInventoryList = inventoryList.filter((item) =>
  item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
  (item.category || '').toLowerCase().includes(inventorySearch.toLowerCase())
);

  const filteredStaff = staff.filter(member => {
    const query = staffSearchQuery.toLowerCase();
    const matchesSearch = !staffSearchQuery || 
      (member.name || '').toLowerCase().includes(query) ||
      (member.phone || '').toLowerCase().includes(query) ||
      (member.email || '').toLowerCase().includes(query) ||
      (member.employeeId || '').toLowerCase().includes(query);
    
    const matchesRole = !staffFilterRole || (member.staffRole || '').toLowerCase() === staffFilterRole.toLowerCase();
    const matchesBranch = !staffFilterBranch || member.assignedBranch === staffFilterBranch;
    const matchesStatus = !staffFilterStatus || (
      staffFilterStatus === 'active' ? member.isActive : !member.isActive
    );

    return matchesSearch && matchesRole && matchesBranch && matchesStatus;
  });

 const [imageUploading, setImageUploading] = useState(false);

 const handleImageUpload = async (file, isEditing = false) =>{
 if (!file) return;
 const formData = new FormData();
 formData.append('image', file);

 try {
 setImageUploading(true);
 const res = await uploadMenuItemImage(formData);
 if (res.success) {
 if (isEditing) {
 setEditingItem((prev) =>({ ...prev, image: res.imageUrl }));
 } else {
 setNewItem((prev) =>({ ...prev, image: res.imageUrl }));
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
 'French Fries'];

 // Load Setup Config
 const loadSetupConfig = async () =>{
 try {
 const res = await getSetupData();
 if (res.success) {
 if (res.operationalConfig?.tables) {
 const t = res.operationalConfig.tables.map((tbl) =>tbl.id.replace('T', ''));
 if (t.length >0) setDynamicTables(t);
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
 const fetchOrders = async () =>{
 try {
 const response = await getOrders();
 if (response.success) {
 const cafeOrders = user?.cafeId ?
 response.data.filter((order) =>order.cafeId === user.cafeId) :
 response.data;
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
 const fetchMenu = async (isSilent = false) =>{
 if (!isSilent) setMenuLoading(true);
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
 const fetchCategories = async (isSilent = false) =>{
 if (!isSilent) setCategoryLoading(true);
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

 const handleCreateCategory = async (e) =>{
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

 const handleUpdateCategory = async (e) =>{
 e.preventDefault();
 if (!editingCategory || !categoryNameInput.trim()) return;
 try {
 const response = await updateCategory(editingCategory._id, { name: categoryNameInput });
 if (response.success) {
 setCategories(categories.map((c) =>c._id === editingCategory._id ? response.data : c));
 // Update menu items in local state
 setMenuItems(menuItems.map((item) =>item.category === editingCategory.name ? { ...item, category: response.data.name } : item));
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

 const handleDeleteCategory = async (catId) =>{
 if (!window.confirm('Are you sure you want to delete this category? All menu items in this category will be moved to Uncategorized.')) return;
 try {
 const categoryToDelete = categories.find((c) =>c._id === catId);
 const response = await deleteCategory(catId);
 if (response.success) {
 setCategories(categories.filter((c) =>c._id !== catId));
 if (categoryToDelete) {
 setMenuItems(menuItems.map((item) =>item.category === categoryToDelete.name ? { ...item, category: 'Uncategorized' } : item));
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

 const handleCategoryDragStart = (e, index) =>{
 e.dataTransfer.setData('text/plain', index);
 };

 const handleCategoryDragOver = (e) =>{
 e.preventDefault();
 };

 const handleCategoryDrop = async (e, targetIndex) =>{
 e.preventDefault();
 const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
 if (sourceIndex === targetIndex) return;

 const updated = [...categories];
 const [dragged] = updated.splice(sourceIndex, 1);
 updated.splice(targetIndex, 0, dragged);

 // Optimistic UI update
 setCategories(updated);

 try {
 const orderedIds = updated.map((c) =>c._id);
 await reorderCategories(orderedIds);
 } catch (err) {
 console.error('Error reordering categories:', err);
 alert('Failed to save category order.');
 fetchCategories();
 }
 };

 const moveCategory = async (index, direction) =>{
 const updated = [...categories];
 if (direction === 'up' && index >0) {
 const temp = updated[index];
 updated[index] = updated[index - 1];
 updated[index - 1] = temp;
 } else if (direction === 'down' && index< updated.length - 1) {
 const temp = updated[index];
 updated[index] = updated[index + 1];
 updated[index + 1] = temp;
 } else {
 return;
 }

 // Optimistic UI update
 setCategories(updated);

 try {
 const orderedIds = updated.map((c) =>c._id);
 await reorderCategories(orderedIds);
 } catch (err) {
 console.error('Error reordering categories:', err);
 alert('Failed to save category order.');
 fetchCategories();
 }
 };

 // Fetch Inventory Categories
 const fetchInventoryCategories = async () =>{
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

 const handleCreateInventoryCategory = async (e) =>{
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

 const handleDeleteInventoryCategory = async (id) =>{
 if (!window.confirm('Are you sure you want to delete this category? All items in this category will be moved to Uncategorized.')) return;
 try {
 const catToDelete = inventoryCategories.find((c) =>c._id === id);
 const response = await deleteInventoryCategory(id);
 if (response.success) {
 setInventoryCategories(inventoryCategories.filter((c) =>c._id !== id));
 if (catToDelete) {
 setInventoryList(inventoryList.map((item) =>item.category === catToDelete.name ? { ...item, category: 'Uncategorized' } : item));
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
 const fetchStaffList = async () =>{
 setStaffLoading(true);
 try {
 const response = await getStaff();
 if (response.success) {
 setStaff(response.staff);
 setStaffError('');
 } else {
 setStaffError('Failed to load jail barrier.');
 }
 } catch (error) {
 console.error('Error fetching staff:', error);
 setStaffError('Cannot connect to local server staff database.');
 } finally {
 setStaffLoading(false);
 }
 };

 // Fetch Branches
 const fetchBranches = async () =>{
 setBranchesLoading(true);
 try {
 const res = await getBranches();
 if (res.success) {
 setBranches(res.branches);
 setBranchesError('');
 } else {
 setBranchesError('Failed to load branches.');
 }
 } catch (error) {
 console.error('Error fetching branches:', error);
 setBranchesError('Cannot connect to branch database.');
 } finally {
 setBranchesLoading(false);
 }
 };

 // Fetch Attendance Today Dashboard
 const fetchAttendanceToday = async () =>{
 setAttendanceLoading(true);
 try {
 const res = await getOwnerTodayAttendance();
 if (res.success) {
 setAttendanceSummary(res.summary);
 setAttendanceRecords(res.records);
 }
 } catch (error) {
 console.error('Error fetching today attendance:', error);
 } finally {
 setAttendanceLoading(false);
 }
 };

 // Fetch Attendance Reports
 const fetchAttendanceReportsData = async () =>{
 setAttendanceLoading(true);
 try {
 const res = await getOwnerAttendanceReports({ range: reportRange, branchId: reportBranch });
 if (res.success) {
 setAttendanceReports(res);
 }
 } catch (error) {
 console.error('Error fetching reports:', error);
 } finally {
 setAttendanceLoading(false);
 }
 };

 const fetchWorkReports = async () =>{
 setReportsLoading(true);
 setReportsError('');
 try {
 const params = {};
 if (reportsFilterRange) params.range = reportsFilterRange;
 if (reportsFilterStaff) params.staffId = reportsFilterStaff;
 if (reportsFilterBranch) params.branchId = reportsFilterBranch;

 const res = await getWorkReports(params);
 if (res.success) {
 setWorkReports(res.reports || []);
 } else {
 setReportsError(res.message || 'Failed to fetch work reports.');
 }
 } catch (err) {
 console.error('Error fetching work reports:', err);
 setReportsError('Server error fetching work reports.');
 } finally {
 setReportsLoading(false);
 }
 };

 const fetchReviewsData = async () =>{
 setReviewsLoading(true);
 setReviewsError('');
 try {
 const params = {};
 if (reviewsFilterRating) {
 params.rating = reviewsFilterRating;
 }
 const response = await getReviews(params);
 if (response && response.success) {
 setReviews(response.data || []);
 if (response.summary) {
 setReviewsSummary(response.summary);
 }
 } else {
 setReviewsError('Failed to retrieve customer reviews.');
 }
 } catch (err) {
 console.error('Error fetching reviews:', err);
 setReviewsError(err.response?.data?.message || 'Server error while fetching customer reviews.');
 } finally {
 setReviewsLoading(false);
 }
 };

 useEffect(() =>{
 if (activeTab === 'menu' && menuSubTab === 'reviews') {
 fetchReviewsData();
 }
 }, [activeTab, menuSubTab, reviewsFilterRating]);

 useEffect(() =>{
 if (activeTab === 'staff' && staffSubTab === 'attendance') {
 fetchAttendanceReportsData();
 }
 }, [reportRange, reportBranch, activeTab, staffSubTab]);

 useEffect(() =>{
 if (activeTab === 'staff' && staffSubTab === 'reports') {
 fetchWorkReports();
 fetchStaffList();
 fetchBranches();
 }
 }, [reportsFilterRange, reportsFilterStaff, reportsFilterBranch, activeTab, staffSubTab]);

 useEffect(() => {
   loadSetupConfig();
 }, []);

 useEffect(() =>{
 if (activeTab === 'orders' || activeTab === 'analytics') {
 fetchOrders();
 }
 if (activeTab === 'menu') {
 fetchMenu();
 fetchCategories();
 }
 if (activeTab === 'staff') {
 fetchStaffList();
 fetchBranches();
 }
 if (activeTab === 'config') {
 fetchBranches();
 }
 if (activeTab === 'staff' && staffSubTab === 'attendance') {
 fetchAttendanceToday();
 fetchBranches();
 }
 if (activeTab === 'inventory' || activeTab === 'analytics') {
 fetchInventoryList();
 fetchInventoryCategories();
 }

  // Live background polling for orders (real-time visibility)
  const pollingInterval = setInterval(() =>{
  fetchOrders();
  }, 10000); // Poll orders every 10 seconds

  // Separate interval for heavier but still useful background updates (inventory list and reviews)
  const heavyPollingInterval = setInterval(() => {
  if (activeTab === 'inventory') {
  const fetchInventoryListSilent = async () => {
  try {
  const invRes = await getInventory();
  if (invRes.success) setInventoryList(invRes.data);
  } catch (err) {
  console.error('Silent inventory refresh failed:', err);
  }
  };
  fetchInventoryListSilent();
  }
  if (activeTab === 'menu' && menuSubTab === 'reviews') {
  const fetchReviewsSilent = async () => {
  try {
  const params = {};
  if (reviewsFilterRating) params.rating = reviewsFilterRating;
  const response = await getReviews(params);
  if (response && response.success) {
  setReviews(response.data || []);
  if (response.summary) setReviewsSummary(response.summary);
  }
  } catch (err) {
  console.error('Silent reviews refresh failed:', err);
  }
  };
  fetchReviewsSilent();
  }
  }, 30000); // Poll heavier items every 30 seconds

  return () => {
  clearInterval(pollingInterval);
  clearInterval(heavyPollingInterval);
  };
 }, [activeTab, menuSubTab, staffSubTab, reviewsFilterRating]);

 // Register new staff
 const handleAddStaff = async (e) =>{
 e.preventDefault();
 if (!newStaff.name || !newStaff.phone || !newStaff.staffRole) {
 alert('Name, Phone Number, and Role are required.');
 return;
 }
 try {
 setStaffLoading(true);
 const response = await createStaff(newStaff);
 if (response.success) {
 alert(response.message || `Staff member "${newStaff.name}" registered successfully.`);
 setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '' });
 setShowAddStaffModal(false);
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
 const handleEditStaff = async (e) =>{
 e.preventDefault();
 if (!editingStaff.name || !editingStaff.phone || !editingStaff.staffRole) {
 alert('Name, Phone Number, and Role are required.');
 return;
 }
 try {
 setStaffLoading(true);
 const response = await updateStaff(editingStaff._id, {
 name: editingStaff.name,
 email: editingStaff.email,
 phone: editingStaff.phone,
 staffRole: editingStaff.staffRole,
 assignedBranch: editingStaff.assignedBranch,
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
 const handleDeleteStaff = async (id) =>{
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

 // Branch Handlers
 const handleAddBranch = async (e) =>{
 e.preventDefault();
 if (!newBranch.branchName || !newBranch.address) {
 alert('Branch Name and Address are required.');
 return;
 }
 try {
 setBranchesLoading(true);
 const res = await createBranch({
 branchName: newBranch.branchName,
 address: newBranch.address,
 manager: newBranch.manager,
 latitude: newBranch.latitude ? Number(newBranch.latitude) : 0,
 longitude: newBranch.longitude ? Number(newBranch.longitude) : 0,
 allowedRadius: newBranch.allowedRadius ? Number(newBranch.allowedRadius) : 30,
 isActive: true
 });
 if (res.success) {
 alert(`Branch "${newBranch.branchName}" created successfully.`);
 setNewBranch({ branchName: '', address: '', manager: '', latitude: '', longitude: '', allowedRadius: 30 });
 setShowAddBranchModal(false);
 fetchBranches();
 }
 } catch (error) {
 console.error('Error creating branch:', error);
 alert(error.response?.data?.message || 'Failed to create branch.');
 } finally {
 setBranchesLoading(false);
 }
 };

 const handleEditBranch = async (e) =>{
 e.preventDefault();
 if (!editingBranch.branchName || !editingBranch.address) {
 alert('Branch Name and Address are required.');
 return;
 }
 try {
 setBranchesLoading(true);
 const res = await updateBranch(editingBranch._id, {
 branchName: editingBranch.branchName,
 address: editingBranch.address,
 manager: editingBranch.manager,
 latitude: editingBranch.latitude ? Number(editingBranch.latitude) : 0,
 longitude: editingBranch.longitude ? Number(editingBranch.longitude) : 0,
 allowedRadius: editingBranch.allowedRadius ? Number(editingBranch.allowedRadius) : 30,
 isActive: editingBranch.isActive
 });
 if (res.success) {
 alert(`Branch updated successfully.`);
 setShowEditBranchModal(false);
 setEditingBranch(null);
 fetchBranches();
 }
 } catch (error) {
 console.error('Error updating branch:', error);
 alert(error.response?.data?.message || 'Failed to update branch.');
 } finally {
 setBranchesLoading(false);
 }
 };

 const handleDetectLocation = (type) =>{
 if (!navigator.geolocation) {
 alert("Geolocation is not supported by your browser");
 return;
 }
 setDetectingLocation(true);
 navigator.geolocation.getCurrentPosition(
 (position) =>{
 const { latitude, longitude } = position.coords;
 if (type === 'new') {
 setNewBranch((prev) =>({
 ...prev,
 latitude: latitude.toFixed(6),
 longitude: longitude.toFixed(6)
 }));
 } else if (type === 'edit') {
 setEditingBranch((prev) =>({
 ...prev,
 latitude: latitude.toFixed(6),
 longitude: longitude.toFixed(6)
 }));
 }
 setDetectingLocation(false);
 },
 (error) =>{
 console.error("Error detecting location:", error);
 alert(`Failed to get location: ${error.message}. Please check if location access is blocked by your browser settings.`);
 setDetectingLocation(false);
 },
 { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
);
 };

 const handleDeleteBranch = async (id) =>{
 if (!window.confirm('Are you sure you want to remove this branch?')) return;
 try {
 setBranchesLoading(true);
 const res = await deleteBranch(id);
 if (res.success) {
 alert(res.message || 'Branch deleted successfully.');
 fetchBranches();
 }
 } catch (error) {
 console.error('Error deleting branch:', error);
 alert(error.response?.data?.message || 'Failed to delete branch.');
 } finally {
 setBranchesLoading(false);
 }
 };

 // Menu toggles
 const handleToggleAvailability = async (item) =>{
 const updatedStatus = !item.available;
 try {
 const response = await updateMenuItem(item.id, { available: updatedStatus });
 if (response.success) {
 setMenuItems((prevItems) =>
 prevItems.map((m) =>m.id === item.id ? { ...m, available: updatedStatus } : m)
);
 }
 } catch (error) {
 console.error('Error toggling availability:', error);
 }
 };

 // Delete menu item
 const handleDeleteMenuItem = async (id) =>{
 if (window.confirm('Are you sure you want to permanently delete this menu item?')) {
 try {
 const response = await deleteMenuItem(id);
 if (response.success) {
 setMenuItems((prevItems) =>prevItems.filter((item) =>item.id !== id));
 }
 } catch (error) {
 console.error('Error deleting item:', error);
 }
 }
 };

 // Add menu item
 const handleAddMenuItem = async (e) =>{
 e.preventDefault();
 if (!newItem.name || !newItem.price || !newItem.category || !newItem.description) {
 alert('Please fill out all required fields.');
 return;
 }
 try {
 const response = await createMenuItem(newItem);
 if (response.success) {
 setMenuItems((prevItems) =>[...prevItems, response.data]);
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
 const handleEditMenuItem = async (e) =>{
 e.preventDefault();
 if (!editingItem.name || !editingItem.price || !editingItem.category || !editingItem.description) {
 alert('Please fill out all required fields.');
 return;
 }
 try {
 const response = await updateMenuItem(editingItem.id, editingItem);
 if (response.success) {
 setMenuItems((prevItems) =>
 prevItems.map((m) =>m.id === editingItem.id ? response.data : m)
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
 getConsumptionReport()]
);

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
 const handleRestockItem = async (id, currentStock) =>{
 try {
 const response = await updateInventoryItem(id, { stock: currentStock + 50 });
 if (response.success) {
 setInventoryList((prev) =>prev.map((item) =>item._id === id ? response.data : item));
 }
 } catch (error) {
 console.error('Error restocking item:', error);
 }
 };

 const handleAddInventoryItem = async (e) =>{
 e.preventDefault();
 try {
 const response = await createInventoryItem(newInventoryItem);
 if (response.success) {
 setInventoryList((prev) =>[...prev, response.data]);
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
 const handleEditInventoryItem = async (e) =>{
 e.preventDefault();
 try {
 const response = await updateInventoryItem(editingInventoryItem._id, editingInventoryItem);
 if (response.success) {
 setInventoryList((prev) =>prev.map((item) =>item._id === editingInventoryItem._id ? response.data : item));
 setShowEditInventoryModal(false);
 setEditingInventoryItem(null);
 }
 } catch (error) {
 console.error('Error updating inventory item:', error);
 alert('Error updating inventory item');
 }
 };

 // Delete Inventory Item
 const handleDeleteInventoryItem = async (id) =>{
 if (!window.confirm('Are you sure you want to delete this ingredient?')) return;
 try {
 const response = await deleteInventoryItem(id);
 if (response.success) {
 setInventoryList((prev) =>prev.filter((item) =>item._id !== id));
 }
 } catch (error) {
 console.error('Error deleting inventory item:', error);
 alert('Error deleting inventory item');
 }
 };

 const handleRecordPurchase = async (e) =>{
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

 const handleRecordWastage = async (e) =>{
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
 const handleSaveSettings = async (e) =>{
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
 setTimeout(() =>setSettingsMsg(''), 3000);
 }
 } catch (err) {
 console.error('Error saving settings:', err);
 setSettingsMsg('Server error saving details.');
 }
 };

 // Test Razorpay Keys
 const testRazorpayConnection = async () =>{
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
 const handleCopyUrl = (table) =>{
 const url = `${window.location.origin}/?table=${table}&cafeId=${user?.cafeId || ''}`;
 navigator.clipboard.writeText(url);
 setCopiedLink(true);
 setTimeout(() =>setCopiedLink(false), 2000);
 };

 const formatLastSeen = (dateStr) =>{
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

 const completedOrders = orders.filter((o) =>o.paymentStatus === 'Paid');

 const todayOrders = completedOrders.filter((o) =>new Date(o.createdAt) >= startOfToday);
 const todayRevenue = todayOrders.reduce((acc, o) =>acc + o.totalAmount, 0);

 const monthlyOrders = completedOrders.filter((o) =>new Date(o.createdAt) >= startOfMonth);
 const monthlyRevenue = monthlyOrders.reduce((acc, o) =>acc + o.totalAmount, 0);

 const totalOrdersCount = orders.length;

 const getWeeklySalesData = () =>{
 const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 const result = [];
 for (let i = 6; i >= 0; i--) {
 const d = new Date();
 d.setDate(d.getDate() - i);
 const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
 const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

 const dayOrders = completedOrders.filter((o) =>{
 const orderDate = new Date(o.createdAt);
 return orderDate >= startOfDay && orderDate< endOfDay;
 });

 const daySales = dayOrders.reduce((acc, o) =>acc + o.totalAmount, 0);
 result.push({
 day: d.toDateString() === now.toDateString() ? 'Today' : dayLabels[d.getDay()],
 sales: Math.round(daySales * 100) / 100
 });
 }
 return result;
 };

 const weeklySalesData = getWeeklySalesData();
 const maxWeeklySales = Math.max(...weeklySalesData.map((d) =>d.sales), 1);

 const totalInventoryValue = inventoryList.reduce((acc, item) =>acc + (item.quantity !== undefined ? item.quantity : item.stock) * (item.costPrice !== undefined ? item.costPrice : item.cost), 0);

 const purchaseLogs = inventoryLogs.filter((log) =>log.type === 'Purchase' || log.type === 'Initial');
 const totalInventoryCost = purchaseLogs.reduce((acc, log) =>acc + (log.cost || 0), 0);

 const deductionLogs = inventoryLogs.filter((log) =>log.type === 'Deduction');
 const totalInventoryConsumption = deductionLogs.reduce((acc, log) =>acc + (log.cost || 0), 0);

 const lowStockAlertsCount = inventoryList.filter((item) =>item.status === 'LOW_STOCK' || item.status === 'OUT_OF_STOCK' || (item.quantity !== undefined ? item.quantity : item.stock)<= (item.reorderLevel !== undefined ? item.reorderLevel : item.minStock)).length;

 const wastageLogs = inventoryLogs.filter((log) =>log.type === 'Wastage' || log.type === 'Damaged');
 const totalWastageCost = wastageLogs.reduce((acc, log) =>acc + (log.cost || 0), 0);

 const getTopConsumedIngredients = () =>{
 const consumptionMap = {};
 inventoryLogs.
 filter((log) =>log.type === 'Deduction').
 forEach((log) =>{
 const name = log.itemName;
 const qty = Math.abs(log.quantityChanged || 0);
 consumptionMap[name] = (consumptionMap[name] || 0) + qty;
 });

 return Object.entries(consumptionMap).
 map(([name, qty]) =>{
 const item = inventoryList.find((i) =>i.name === name);
 return { name, quantity: qty, unit: item?.unit || 'g' };
 }).
 sort((a, b) =>b.quantity - a.quantity).
 slice(0, 5);
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
 color: var(--color-text-primary);
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
 color: var(--color-text-primary);
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
  /* ── Menu Grid: 1-col on mobile, 2-col on small tablets, 3-col on desktop ── */
  .menu-grid-admin {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  }
  @media (min-width: 600px) {
  .menu-grid-admin {
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  }
  }
  @media (min-width: 768px) {
  .menu-grid-admin {
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  }
  }
  @media (min-width: 1200px) {
  .menu-grid-admin {
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  }
  }
 /* ── Menu Card: vertical card layout ── */
 .admin-menu-card {
 background: var(--bg-card);
 border: 1px solid var(--color-border);
 border-radius: 12px;
 overflow: hidden;
 display: flex;
 flex-direction: column;
 position: relative;
 transition: border-color 0.2s ease, transform 0.15s ease;
 }
 .admin-menu-card:hover {
 border-color: var(--color-primary);
 transform: translateY(-2px);
 box-shadow: 0 8px 24px rgba(0,0,0,0.3);
 }
 .admin-menu-card.unavailable {
 opacity: 0.55;
 }
 /* Image: full-width with fixed aspect ratio */
 .admin-menu-img {
 width: 100%;
 aspect-ratio: 4/3;
 object-fit: cover;
 flex-shrink: 0;
 border-radius: 0;
 }
 /* Info section: grows to fill */
 .admin-menu-info {
 flex-grow: 1;
 display: flex;
 flex-direction: column;
 padding: 10px;
 gap: 4px;
 }
 .admin-menu-title {
 font-size: 13px;
 font-weight: 700;
 color: var(--color-text-primary);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 }
 @media (min-width: 768px) {
 .admin-menu-title { font-size: 14px; }
 .admin-menu-info { padding: 14px; gap: 6px; }
 }
 .admin-menu-desc {
 font-size: 11px;
 color: var(--color-text-secondary);
 line-height: 1.35;
 display: -webkit-box;
 -webkit-line-clamp: 2;
 -webkit-box-orient: vertical;
 overflow: hidden;
 flex-grow: 1;
 }
 .admin-menu-meta {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-top: 8px;
 gap: 6px;
 }
 .admin-menu-price {
 font-size: 13px;
 font-weight: 800;
 color: var(--color-primary);
 flex-shrink: 0;
 }
 /* Action buttons: icon-only on smallest screens */
 .menu-card-actions {
 display: flex;
 gap: 4px;
 }
 .menu-card-btn {
 padding: 4px 6px;
 font-size: 11px;
 width: auto;
 border-radius: 6px;
 }
 .menu-card-btn .btn-text { display: none; }
 @media (min-width: 480px) {
 .menu-card-btn { padding: 4px 8px; }
 .menu-card-btn .btn-text { display: inline; }
 }
 /* ── Menu header actions ── */
 .menu-header-actions {
 display: flex;
 gap: 8px;
 flex-shrink: 0;
 }
 @media (max-width: 479px) {
 .menu-header-actions .btn-label { display: none; }
 .menu-header-actions button { padding: 8px 10px !important; }
 }
 /* ── Review summary grid ── */
 .reviews-summary-grid {
 display: grid;
 grid-template-columns: 1fr;
 gap: 12px;
 margin-bottom: 20px;
 }
 @media (min-width: 520px) {
 .reviews-summary-grid {
 grid-template-columns: 1fr 1fr;
 }
 }
 /* ── Owner double deck ── */
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
 .orders-monitor-wrapper {
 padding: 12px;
 }
 .orders-monitor-grid {
 display: grid;
 grid-template-columns: repeat(2, 1fr);
 gap: 10px;
 }
 @media (min-width: 600px) {
 .orders-monitor-wrapper {
 padding: 25px;
 }
 .orders-monitor-grid {
 grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
 gap: 16px;
 }
 }
 `}</style>

 {/* Navigation Tabs removed to prevent duplicate navigation */}

 {/* TAB 1: BUSINESS ANALYTICS */}
 {activeTab === 'analytics' &&
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
<div className="analytics-card">
<h4>Low Stock Alerts</h4>
<span className="val" style={{ color: lowStockAlertsCount >0 ? '#e74c3c' : '#2ecc71' }}>
 {lowStockAlertsCount} items
</span>
<span className="sub" style={{ color: lowStockAlertsCount >0 ? '#e74c3c' : '#2ecc71' }}>
 {lowStockAlertsCount >0 ? ' Stock replenishment needed' : ' All items in stock'}
</span>
</div>
</div>

<div className="card-deck">
 {/* Premium Sales Graphics */}
<div className="chart-card">
<h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.1rem', margin: '0 0 20px 0', fontWeight: 700 }}>
 Weekly Sales Performance (Last 7 Days)
</h3>
 
 {/* Micro SVG Flexbox chart */}
<div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
 {weeklySalesData.map((d, index) =>{
 const percent = d.sales / maxWeeklySales * 100;
 return (
<div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
<span style={{ fontSize: '10px', color: 'var(--color-text-primary)', fontWeight: 'bold', marginBottom: '6px' }}>₹{d.sales}</span>
<div style={{
 width: '100%',
 height: `${percent}%`,
 background: 'linear-gradient(to top, #6F4E37, #C69B7B)',
 borderRadius: '4px 4px 0 0',
 transition: 'height 0.3s ease'
 }} />
<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px', fontWeight: 'bold' }}>{d.day}</span>
</div>);

 })}
</div>
</div>

 {/* Branch Performance Comparison */}
<div className="chart-card">
<h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.1rem', margin: '0 0 20px 0', fontWeight: 700 }}>
 Branch Performance
</h3>
<div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
<div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
<span style={{ color: 'var(--color-text-primary)' }}>Main Branch</span>
<strong style={{ color: 'var(--color-primary)' }}>60%</strong>
</div>
<div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
<div style={{ width: '60%', height: '100%', background: 'var(--color-primary)' }} />
</div>
</div>
<div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
<span style={{ color: 'var(--color-text-primary)' }}>Uptown Branch</span>
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
<h4 style={{ color: '#2ecc71', margin: '0 0 15px 0', fontSize: '1rem' }}>Top Selling Cafe Items</h4>
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
<span style={{ color: 'var(--color-text-primary)' }}>1. Gourmet Double Cheeseburger</span>
<span style={{ color: 'var(--color-text-secondary)' }}>242 sold</span>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
<span style={{ color: 'var(--color-text-primary)' }}>2. Creamy Iced Latte</span>
<span style={{ color: 'var(--color-text-secondary)' }}>198 sold</span>
</div>
</div>
</div>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px' }}>
<h4 style={{ color: '#e74c3c', margin: '0 0 15px 0', fontSize: '1rem' }}> Slow Selling Items</h4>
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
<span style={{ color: 'var(--color-text-primary)' }}>1. Hot Pepper Veggie Soup</span>
<span style={{ color: 'var(--color-text-secondary)' }}>3 sold</span>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
<span style={{ color: 'var(--color-text-primary)' }}>2. Classic Black Tea</span>
<span style={{ color: 'var(--color-text-secondary)' }}>8 sold</span>
</div>
</div>
</div>
</div>

</div>
 }

 {/* TAB 2: MENU MANAGEMENT */}
 {activeTab === 'menu' &&
<div style={{ animation: 'fadeIn 0.3s ease-out' }}>
 {/* Sub-tab Switcher for Menu & Reviews */}
<div style={{
 display: 'flex',
 gap: '8px',
 background: 'rgba(0, 0, 0, 0.02)',
 padding: '6px',
 borderRadius: '12px',
 border: '1px solid var(--color-border)',
 marginBottom: '24px',
 maxWidth: '100%',
 overflowX: 'auto',
 whiteSpace: 'nowrap'
 }} className="no-scrollbar">
<button
 onClick={() =>setMenuSubTab('dishes')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: menuSubTab === 'dishes' ? 'var(--color-primary)' : 'transparent',
 color: menuSubTab === 'dishes' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Menu Items
</button>
<button
 onClick={() =>setMenuSubTab('reviews')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: menuSubTab === 'reviews' ? 'var(--color-primary)' : 'transparent',
 color: menuSubTab === 'reviews' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Customer Reviews
</button>
</div>

 {menuSubTab === 'dishes' ?
<>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
<div style={{ minWidth: 0 }}>
<h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>Cafe Dishes</h3>
<p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>Manage your customer ordering menu</p>
</div>
<div className="menu-header-actions">
<button onClick={() =>setShowCategoryModal(true)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 14px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: '13px' }}>
📂 <span className="btn-label">Categories</span>
</button>
<button onClick={() =>setShowAddModal(true)} className="btn btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '13px' }}>
➕ <span className="btn-label">Add Item</span>
</button>
</div>
</div>

<div style={{ marginBottom: '20px' }}>
<input
 type="text"
 placeholder=" Search dishes by name or category..."
 value={menuSearch}
 onChange={(e) =>setMenuSearch(e.target.value)}
 style={{
 width: '100%',
 padding: '12px 16px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 fontSize: '14px',
 outline: 'none'
 }} />
 
</div>

 {menuLoading ?
<div style={{ textAlign: 'center', padding: '40px 0', width: '100%' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading menu items...</p>
</div>:

<div className="menu-grid-admin">
 {filteredMenuItems.map((item) =>
<div key={item.id} className={`admin-menu-card ${!item.available ? 'unavailable' : ''}`}>
<AdminMenuImage item={item} />
<div className="admin-menu-info">
<div className="admin-menu-title">{item.name}</div>
<div className="admin-menu-desc">{item.description}</div>
<div className="admin-menu-meta">
<span className="admin-menu-price">₹{parseFloat(item.price).toFixed(2)}</span>
<div className="menu-card-actions">
  <button onClick={() =>{setEditingItem({ ...item });setShowEditModal(true);}} className="btn btn-secondary menu-card-btn">✏️<span className="btn-text"> Edit</span></button>
  <button onClick={() =>handleDeleteMenuItem(item.id)} className="btn btn-secondary menu-card-btn" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>🗑️<span className="btn-text"> Del</span></button>
</div>
</div>
</div>
</div>
)}
</div>
 }
</>:

<div className="fade-in">
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '16px' }}>
 
 {/* Ratings Summary Cards */}
<div className="reviews-summary-grid">
 {/* Summary Box */}
<div style={{
 background: 'rgba(0, 0, 0, 0.02)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '16px',
 display: 'flex',
 alignItems: 'center',
 gap: '16px'
 }}>
<div style={{ textAlign: 'center', flexShrink: 0 }}>
<div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{reviewsSummary.averageRating}</div>
<div style={{ marginTop: '6px', fontSize: '1rem', color: '#ff9800', letterSpacing: '1px' }}>
 {''.repeat(Math.round(reviewsSummary.averageRating))}{''.repeat(5 - Math.round(reviewsSummary.averageRating))}
</div>
</div>
<div>
<div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>Avg Rating</div>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>Based on {reviewsSummary.totalReviews} ratings</div>
</div>
</div>

 {/* Distribution Box */}
<div style={{
 background: 'rgba(0, 0, 0, 0.02)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '16px',
 display: 'flex',
 flexDirection: 'column',
 gap: '6px'
 }}>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Rating Breakdown</div>
 {[5, 4, 3, 2, 1].map((stars) =>{
 const count = reviewsSummary.distribution?.[stars] || 0;
 const pct = reviewsSummary.totalReviews >0 ? count / reviewsSummary.totalReviews * 100 : 0;
 return (
<div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
<span style={{ width: '12px', color: '#ff9800', fontWeight: 'bold' }}>{stars}</span>
<span style={{ color: '#ff9800', fontSize: '10px' }}></span>
<div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(0, 0, 0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
<div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#ff9800', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
</div>
<span style={{ width: '24px', color: 'var(--color-text-secondary)', textAlign: 'right', fontSize: '11px' }}>{count}</span>
</div>);

 })}
</div>
</div>

 {/* Filter Panel */}
<div style={{
 display: 'flex',
 flexWrap: 'wrap',
 justifyContent: 'space-between',
 alignItems: 'center',
 gap: '10px',
 marginBottom: '16px',
 background: 'rgba(0, 0, 0, 0.02)',
 padding: '10px 14px',
 borderRadius: '10px',
 border: '1px solid var(--color-border)'
 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>Filter:</label>
<select
 value={reviewsFilterRating}
 onChange={(e) =>setReviewsFilterRating(e.target.value)}
 style={{
 backgroundColor: 'rgba(0,0,0,0.3)',
 border: '1px solid var(--color-border)',
 borderRadius: '8px',
 padding: '6px 10px',
 color: 'var(--color-text-primary)',
 fontSize: '12px',
 outline: 'none',
 fontFamily: 'inherit'
 }}>
 
<option value="">All Ratings</option>
<option value="5">5 Stars</option>
<option value="4">4 Stars</option>
<option value="3">3 Stars</option>
<option value="2">2 Stars</option>
<option value="1">1 Star</option>
</select>
</div>
<button
 onClick={fetchReviewsData}
 className="btn btn-secondary"
 style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}>
 
 Refresh
</button>
</div>

 {reviewsLoading ?
<div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
<div className="spinner-rzp" style={{
 width: '28px',
 height: '28px',
 border: '3px solid rgba(0, 0, 0,0.1)',
 borderTop: '3px solid var(--color-primary)',
 borderRadius: '50%',
 animation: 'spin 0.8s linear infinite',
 display: 'inline-block',
 marginBottom: '10px'
 }}></div>
<div>Retrieving live customer feedback...</div>
</div>:
 reviewsError ?
<div style={{ padding: '20px', background: 'rgba(231, 76, 60, 0.1)', borderLeft: '4px solid #E74C3C', borderRadius: '4px', color: '#E74C3C' }}>
 {reviewsError}
</div>:
 reviews.length === 0 ?
<div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0, 0, 0,0.01)', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
 No reviews found matching the selected filters.
</div>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
 {reviews.map((r) =>
<div key={r._id} style={{
 background: 'rgba(0, 0, 0,0.02)',
 border: '1px solid var(--color-border)',
 padding: '14px',
 borderRadius: '12px',
 display: 'flex',
 flexDirection: 'column',
 gap: '8px',
 transition: 'border-color 0.2s'
 }}>
 {/* Review Header */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
<span style={{
 width: '34px', height: '34px', flexShrink: 0,
 borderRadius: '50%',
 background: 'linear-gradient(135deg, #8FA89B 0%, #4d6b5e 100%)',
 color: 'var(--color-text-primary)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontWeight: 800, fontSize: '14px'
 }}>
 {(r.customerName || 'A')[0].toUpperCase()}
</span>
<div style={{ minWidth: 0 }}>
<div style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
<div style={{ color: '#ff9800', fontSize: '12px', letterSpacing: '1px', marginTop: '1px' }}>
 {''.repeat(r.rating)}{''.repeat(5 - r.rating)}
</div>
</div>
</div>
 {r.createdAt &&
<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
 {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
</span>
 }
</div>
 
 {/* Review Text */}
 {r.reviewText ?
<p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '1.5', borderLeft: '2px solid var(--color-primary)', paddingLeft: '10px' }}>
 {r.reviewText}
</p>:

<p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '12px', fontStyle: 'italic' }}>No comment provided.</p>
 }

 {/* Ordered Items */}
 {r.orderedItems && r.orderedItems.length >0 &&
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
 {r.orderedItems.map((item, idx) =>
<span key={idx} style={{
 background: 'rgba(143, 168, 155, 0.1)',
 border: '1px solid rgba(143, 168, 155, 0.2)',
 color: 'var(--color-primary)',
 padding: '2px 7px',
 borderRadius: '4px',
 fontSize: '11px',
 fontWeight: 600
 }}>
 {item.quantity}x {item.name}
</span>
)}
</div>
 }
</div>
)}
</div>
 }
</div>
</div>
 }
</div>
 }

 {/* TAB 3: STAFF ROSTER */}
 {activeTab === 'staff' &&
<div className="fade-in">
 {/* Sub-tab Switcher for Staff, Reports & Attendance */}
<div style={{
 display: 'flex',
 gap: '8px',
 background: 'rgba(0, 0, 0, 0.02)',
 padding: '6px',
 borderRadius: '12px',
 border: '1px solid var(--color-border)',
 marginBottom: '24px',
 maxWidth: '100%',
 overflowX: 'auto',
 whiteSpace: 'nowrap'
 }} className="no-scrollbar">
<button
 onClick={() =>setStaffSubTab('roster')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'roster' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'roster' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
  Jail Barrier
</button>
<button
 onClick={() =>setStaffSubTab('reports')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'reports' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'reports' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Daily Work Reports
</button>
<button
 onClick={() =>setStaffSubTab('attendance')}
 style={{
 padding: '8px 16px',
 borderRadius: '8px',
 border: 'none',
 background: staffSubTab === 'attendance' ? 'var(--color-primary)' : 'transparent',
 color: staffSubTab === 'attendance' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
 fontSize: '13.5px',
 fontWeight: 700,
 cursor: 'pointer',
 transition: 'all 0.2s',
 fontFamily: 'inherit'
 }}>
 
 Attendance Logs
</button>
</div>

 {staffSubTab === 'roster' &&
<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

 {/* ─── Add Staff Modal ─── */}
 {showAddStaffModal &&
<div
 onClick={(e) =>{if (e.target === e.currentTarget) {setShowAddStaffModal(false);setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '' });}}}
 style={{
 position: 'fixed', inset: 0, zIndex: 3000,
 background: 'rgba(0,0,0,0.75)',
 backdropFilter: 'blur(10px)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 padding: '16px',
 animation: 'fadeIn 0.2s ease'
 }}>
 
<div style={{
 background: 'var(--bg-card)',
 border: '1px solid var(--color-border)',
 borderRadius: '20px',
 padding: '28px 24px',
 width: '100%',
 maxWidth: '440px',
 boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
 animation: 'slideUp 0.25s ease'
 }}>
 {/* Modal Header */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Add New Staff</h3>
<p style={{ color: 'var(--color-text-secondary)', margin: '4px 0 0 0', fontSize: '0.82rem' }}>Register a new team member to the jail barrier</p>
</div>
<button
 onClick={() =>{setShowAddStaffModal(false);setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '' });}}
 style={{
 background: 'rgba(0, 0, 0,0.06)', border: '1px solid rgba(0, 0, 0,0.08)',
 borderRadius: '50%', width: '36px', height: '36px',
 color: 'var(--color-text-primary)', fontSize: '18px', cursor: 'pointer',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0
 }}>
 ×</button>
</div>

 {/* Form */}
<form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-full-name" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name *</label>
<input type="text" id="roster-full-name" name="roster-full-name" className="form-input" placeholder="e.g. Ravi Kumar" value={newStaff.name} onChange={(e) =>setNewStaff({ ...newStaff, name: e.target.value })} required />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-email-address" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address<span style={{ opacity: 0.5 }}>(Optional)</span></label>
<input type="email" id="roster-email-address" name="roster-email-address" className="form-input" placeholder="staff@cafe.com" value={newStaff.email} onChange={(e) =>setNewStaff({ ...newStaff, email: e.target.value })} />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-phone-number" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number *</label>
<input type="text" id="roster-phone-number" name="roster-phone-number" className="form-input" placeholder="e.g. 9876543210" value={newStaff.phone} onChange={(e) =>setNewStaff({ ...newStaff, phone: e.target.value })} required />
</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-staff-role" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff Role *</label>
<select id="roster-staff-role" name="roster-staff-role" className="form-input" value={newStaff.staffRole ? newStaff.staffRole.toLowerCase() : 'waiter'} onChange={(e) =>setNewStaff({ ...newStaff, staffRole: e.target.value })} required>
<option value="chef">Chef</option>
<option value="waiter">Waiter</option>
<option value="barista">Barista</option>
<option value="cashier">Cashier</option>
<option value="manager">Manager</option>
<option value="staff">Staff / Server</option>
</select>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="roster-assigned-branch" className="form-label" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Branch *</label>
<select id="roster-assigned-branch" name="roster-assigned-branch" className="form-input" value={newStaff.assignedBranch} onChange={(e) =>setNewStaff({ ...newStaff, assignedBranch: e.target.value })} required>
<option value="">-- Select --</option>
 {branches.map((b) =>
<option key={b.branchId} value={b.branchId}>{b.branchName}</option>
)}
</select>
</div>
</div>
<div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
<button
 type="button"
 onClick={() =>{setShowAddStaffModal(false);setNewStaff({ name: '', email: '', phone: '', staffRole: 'waiter', assignedBranch: '' });}}
 style={{
 flex: 1, padding: '12px', borderRadius: '10px',
 border: '1px solid var(--color-border)', background: 'transparent',
 color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 600,
 cursor: 'pointer', fontFamily: 'inherit'
 }}>
 Cancel</button>
<button
 type="submit"
 className="btn btn-primary"
 style={{ flex: 2, padding: '12px', borderRadius: '10px', fontSize: '14px' }}
 disabled={staffLoading}>
 
 {staffLoading ? ' Adding...' : ' Add Staff Member'}
</button>
</div>
</form>
</div>
</div>
 }

 {/* Staff Roster List Card */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Jail Barrier List</h4>
<button
 onClick={() =>setShowAddStaffModal(true)}
 style={{
 display: 'flex', alignItems: 'center', gap: '8px',
 background: 'var(--color-primary)', color: 'var(--color-text-primary)',
 border: 'none', borderRadius: '10px',
 padding: '8px 16px', fontSize: '13px', fontWeight: 700,
 cursor: 'pointer', fontFamily: 'inherit',
 boxShadow: '0 4px 16px rgba(143,168,155,0.4)',
 transition: 'all 0.2s ease'
 }}
 onMouseEnter={(e) =>{e.currentTarget.style.transform = 'translateY(-1px)';e.currentTarget.style.boxShadow = '0 6px 20px rgba(143,168,155,0.5)';}}
 onMouseLeave={(e) =>{e.currentTarget.style.transform = 'translateY(0)';e.currentTarget.style.boxShadow = '0 4px 16px rgba(143,168,155,0.4)';}}>
 
<span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
<span>Add Staff</span>
</button>
</div>

{/* Search and Filters Bar */}
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginBottom: '20px',
  alignItems: 'center'
}} className="staff-filters-bar">
  {/* Search input */}
  <div style={{ position: 'relative', gridColumn: 'span 2' }} className="staff-search-wrapper">
    <span style={{
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--color-text-secondary)',
      fontSize: '14px',
      pointerEvents: 'none'
    }}>🔍</span>
    <input
      type="text"
      placeholder="Search by name, phone, ID..."
      value={staffSearchQuery}
      onChange={(e) => setStaffSearchQuery(e.target.value)}
      className="form-input"
      style={{
        paddingLeft: '36px',
        width: '100%',
        margin: 0
      }}
    />
  </div>

  {/* Filter by Role */}
  <div style={{ position: 'relative' }}>
    <select
      value={staffFilterRole}
      onChange={(e) => setStaffFilterRole(e.target.value)}
      className="form-input"
      style={{ width: '100%', margin: 0 }}
    >
      <option value="">All Roles</option>
      <option value="chef">Chef</option>
      <option value="waiter">Waiter</option>
      <option value="barista">Barista</option>
      <option value="cashier">Cashier</option>
      <option value="manager">Manager</option>
      <option value="staff">Staff / Server</option>
    </select>
  </div>

  {/* Filter by Branch */}
  <div style={{ position: 'relative' }}>
    <select
      value={staffFilterBranch}
      onChange={(e) => setStaffFilterBranch(e.target.value)}
      className="form-input"
      style={{ width: '100%', margin: 0 }}
    >
      <option value="">All Branches</option>
      {branches.map((b) => (
        <option key={b.branchId} value={b.branchId}>{b.branchName}</option>
      ))}
    </select>
  </div>

  {/* Filter by Status */}
  <div style={{ position: 'relative' }}>
    <select
      value={staffFilterStatus}
      onChange={(e) => setStaffFilterStatus(e.target.value)}
      className="form-input"
      style={{ width: '100%', margin: 0 }}
    >
      <option value="">All Statuses</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  </div>
</div>

{/* Clear Filters Button */}
{(staffSearchQuery || staffFilterRole || staffFilterBranch || staffFilterStatus) && (
  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
    <button
      onClick={() => {
        setStaffSearchQuery('');
        setStaffFilterRole('');
        setStaffFilterBranch('');
        setStaffFilterStatus('');
      }}
      style={{
        background: 'transparent',
        border: '1px solid var(--color-danger)',
        color: 'var(--color-danger)',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      Clear Filters
    </button>
  </div>
)}

 {staffLoading && staff.length === 0 ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading jail barrier...</p>
</div>:

<>
{filteredStaff.length === 0 ? (
  <div style={{
    padding: '50px 20px',
    textAlign: 'center',
    background: 'rgba(0, 0, 0,0.01)',
    borderRadius: '12px',
    border: '1px dashed var(--color-border)',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic'
  }}>
    No staff members found matching the selected filters.
  </div>
) : (
  <>
  <div className="desktop-tablet-staff" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
  <thead>
  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
  <th style={{ padding: '10px' }}>Emp ID</th>
  <th style={{ padding: '10px' }}>Name</th>
  <th style={{ padding: '10px' }}>Email</th>
  <th style={{ padding: '10px' }}>Phone</th>
  <th style={{ padding: '10px' }}>Role</th>
  <th style={{ padding: '10px' }}>Branch</th>
  <th style={{ padding: '10px' }}>Last Seen</th>
  <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
  <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
  </tr>
  </thead>
  <tbody>
   {filteredStaff.map((member) =>
  <tr key={member._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
  <td style={{ padding: '12px 10px', color: 'var(--color-primary)', fontWeight: 'bold' }}>{member.employeeId || 'N/A'}</td>
  <td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{member.name}</td>
  <td style={{ padding: '12px 10px' }}>{member.email || 'N/A'}</td>
  <td style={{ padding: '12px 10px' }}>{member.phone}</td>
  <td style={{ padding: '12px 10px' }}>
  <span className="admin-menu-badge" style={{ textTransform: 'capitalize' }}>{member.staffRole}</span>
  </td>
  <td style={{ padding: '12px 10px' }}>
   {branches.find((b) =>b.branchId === member.assignedBranch)?.branchName || 'Unassigned'}
  </td>
  <td style={{ padding: '12px 10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
   {formatLastSeen(member.lastSeen)}
  </td>
  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
  <span style={{
   backgroundColor: member.isActive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
   color: member.isActive ? 'var(--color-success)' : 'var(--color-danger)',
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
  <button onClick={() =>{setEditingStaff({ ...member });setShowEditStaffModal(true);}} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}> Edit</button>
  <button onClick={() =>handleDeleteStaff(member._id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}> Delete</button>
  </div>
  </td>
  </tr>
  )}
  </tbody>
  </table>
  </div>

  <div className="mobile-only-staff">
  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
   {filteredStaff.map((member) =>
  <div key={member._id} style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
  <span style={{ color: 'var(--color-text-primary)', fontSize: '16px', fontWeight: 'bold' }}>{member.name}</span>
  <span className="admin-menu-badge" style={{ textTransform: 'capitalize', background: 'rgba(255, 107, 8, 0.15)', color: '#FF6B08', fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>{member.staffRole}</span>
  </div>
  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.6' }}>
  <div>🆔 ID:<span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{member.employeeId || 'N/A'}</span></div>
  <div>{member.email || 'No Email'}</div>
  <div>{member.phone}</div>
  <div>Branch:<span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{branches.find((b) =>b.branchId === member.assignedBranch)?.branchName || 'Unassigned'}</span></div>
  <div style={{ marginTop: '4px' }}>Seen: {formatLastSeen(member.lastSeen)}</div>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
  <span style={{
   backgroundColor: member.isActive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
   color: member.isActive ? 'var(--color-success)' : 'var(--color-danger)',
   padding: '4px 10px',
   borderRadius: '12px',
   fontSize: '12px',
   fontWeight: 'bold'
   }}>
   {member.isActive ? 'Active' : 'Inactive'}
  </span>
  <div style={{ display: 'flex', gap: '10px' }}>
  <button onClick={() =>{setEditingStaff({ ...member });setShowEditStaffModal(true);}} className="btn btn-secondary touch-btn" style={{ padding: '8px 12px', fontSize: '13px', minHeight: '44px' }}> Edit</button>
  <button onClick={() =>handleDeleteStaff(member._id)} className="btn btn-secondary touch-btn" style={{ padding: '8px 12px', fontSize: '13px', minHeight: '44px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}> Delete</button>
  </div>
  </div>
  </div>
  )}
  </div>
  </div>
  </>
)}
</>
 }
</div>
</div>
 }

 {staffSubTab === 'attendance' &&
<div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
 {/* Overview cards */}
<div className="analytics-grid">
<div className="analytics-card" style={{ background: '#1a130f' }}>
<h4>Total Active Staff</h4>
<span className="val">{attendanceSummary.totalStaff || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#0e1a12' }}>
<h4>Present Today</h4>
<span className="val" style={{ color: '#2ecc71' }}>{attendanceSummary.present || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#1c100e' }}>
<h4>Absent Today</h4>
<span className="val" style={{ color: '#e74c3c' }}>{attendanceSummary.absent || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#1c1c0e' }}>
<h4> Late Arrivals</h4>
<span className="val" style={{ color: '#f1c40f' }}>{attendanceSummary.late || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#160e1a' }}>
<h4>Currently Working</h4>
<span className="val" style={{ color: '#3498db' }}>{attendanceSummary.currentlyWorking || 0}</span>

</div>
<div className="analytics-card" style={{ background: '#13191f' }}>
<h4>Checked Out</h4>
<span className="val" style={{ color: '#9b59b6' }}>{attendanceSummary.checkedOut || 0}</span>

</div>
</div>

 {/* Today's Live Records Table */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.20rem', fontWeight: 700 }}>Today's Attendance Log</h3>
 {attendanceLoading ?
<div style={{ textAlign: 'center', padding: '20px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading today's logs...</p>
</div>:
 attendanceRecords.length === 0 ?
<div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
 No check-in logs recorded today yet.
</div>:

<div style={{ overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
<th style={{ padding: '10px' }}>Staff Name</th>
<th style={{ padding: '10px' }}>Branch</th>
<th style={{ padding: '10px' }}>Check In</th>
<th style={{ padding: '10px' }}>Check Out</th>
<th style={{ padding: '10px' }}>Duration</th>
<th style={{ padding: '10px' }}>Status</th>
<th style={{ padding: '10px' }}>Verification Distance</th>
<th style={{ padding: '10px' }}>Device</th>
</tr>
</thead>
<tbody>
 {attendanceRecords.map((rec) =>{
 const durationHrs = rec.totalDuration ? `${Math.floor(rec.totalDuration / 60)}h ${rec.totalDuration % 60}m` : 'Active';
 const statusColor = rec.status === 'Late' ? '#f1c40f' : '#2ecc71';
 return (
<tr key={rec._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
<td style={{ padding: '12px 10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{rec.staffName}</td>
<td style={{ padding: '12px 10px' }}>{rec.branchName}</td>
<td style={{ padding: '12px 10px' }}>{rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
<td style={{ padding: '12px 10px' }}>{rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
<td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{durationHrs}</td>
<td style={{ padding: '12px 10px' }}>
<span style={{
 backgroundColor: `${statusColor}22`,
 border: `1px solid ${statusColor}`,
 color: statusColor,
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 {rec.status}
</span>
</td>
<td style={{ padding: '12px 10px' }}>
<span style={{ color: rec.distanceFromCafe<= 30 ? '#2ecc71' : '#e67e22' }}>
 {rec.distanceFromCafe} meters
</span>
</td>
<td style={{ padding: '12px 10px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>{rec.deviceInfo}</td>
</tr>);

 })}
</tbody>
</table>
</div>
 }
</div>

 {/* Attendance Analytics & Reports */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.20rem', fontWeight: 700 }}>Historical Attendance Reports</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}></p>
</div>
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
<select className="form-input" style={{ width: '130px', margin: 0 }} value={reportRange} onChange={(e) =>setReportRange(e.target.value)}>
<option value="daily">Past 24 Hours</option>
<option value="weekly">Past 7 Days</option>
<option value="monthly">Past 30 Days</option>
</select>
<select className="form-input" style={{ width: '180px', margin: 0 }} value={reportBranch} onChange={(e) =>setReportBranch(e.target.value)}>
<option value="">All Branches</option>
 {branches.map((b) =>
<option key={b.branchId} value={b.branchId}>{b.branchName}</option>
)}
</select>
</div>
</div>

 {attendanceReports &&
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
<div className="analytics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: 0 }}>
<div className="analytics-card" style={{ background: 'rgba(0, 0, 0,0.01)' }}>
<h4>Attendance Percentage (%)</h4>
<span className="val" style={{ color: 'var(--color-primary)' }}>{attendanceReports.summary.attendancePercentage}%</span>

</div>
<div className="analytics-card" style={{ background: 'rgba(0, 0, 0,0.01)' }}>
<h4>Cumulative Working Hours</h4>
<span className="val" style={{ color: '#2ecc71' }}>{attendanceReports.summary.totalHours} hrs</span>

</div>
<div className="analytics-card" style={{ background: 'rgba(0, 0, 0,0.01)' }}>
<h4>Late Arrival Incidents</h4>
<span className="val" style={{ color: '#f1c40f' }}>{attendanceReports.summary.lateArrivals} times</span>

</div>
</div>

 {/* Branch wise performance */}
 {attendanceReports.branchReports && attendanceReports.branchReports.length >0 &&
<div style={{ marginTop: '10px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', marginBottom: '10px' }}>Branch Attendance Performance Breakdown</h4>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
<th style={{ padding: '8px' }}>Branch Name</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Total Check-ins</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Total Hours Logged</th>
</tr>
</thead>
<tbody>
 {attendanceReports.branchReports.map((br, idx) =>
<tr key={idx} style={{ borderBottom: '1px solid rgba(0, 0, 0,0.03)' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{br.branchName || 'Main Branch'}</td>
<td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>{br.presentCount}</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: '#2ecc71', fontWeight: 'bold' }}>{br.workingHours} hrs</td>
</tr>
)}
</tbody>
</table>
</div>
 }

 {/* Filtered records detail log */}
<div style={{ marginTop: '10px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', marginBottom: '10px' }}>Detailed History Records ({attendanceReports.records.length})</h4>
<div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
<th style={{ padding: '10px' }}>Date</th>
<th style={{ padding: '10px' }}>Staff Name</th>
<th style={{ padding: '10px' }}>Branch</th>
<th style={{ padding: '10px' }}>Check In</th>
<th style={{ padding: '10px' }}>Check Out</th>
<th style={{ padding: '10px' }}>Status</th>
</tr>
</thead>
<tbody>
 {attendanceReports.records.map((r) =>
<tr key={r._id} style={{ borderBottom: '1px solid rgba(0, 0, 0,0.03)' }}>
<td style={{ padding: '10px', color: 'var(--color-text-primary)' }}>{new Date(r.checkInTime).toLocaleDateString()}</td>
<td style={{ padding: '10px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{r.staffName}</td>
<td style={{ padding: '10px' }}>{r.branchName}</td>
<td style={{ padding: '10px' }}>{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
<td style={{ padding: '10px' }}>{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active'}</td>
<td style={{ padding: '10px' }}>
<span style={{
 color: r.status === 'Late' ? '#f1c40f' : '#2ecc71',
 fontWeight: 'bold'
 }}>
 {r.status}
</span>
</td>
</tr>
)}
</tbody>
</table>
</div>
</div>
</div>
 }
</div>
</div>
 }

 {staffSubTab === 'reports' &&
<div>
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Staff Daily Work Reports</h3>

</div>
</div>

 {/* Filters Panel */}
<div style={{
 display: 'flex',
 flexWrap: 'wrap',
 gap: '15px',
 background: 'rgba(0, 0, 0,0.02)',
 padding: '16px',
 borderRadius: '12px',
 border: '1px solid var(--color-border)',
 marginBottom: '24px'
 }}>
 {/* Filter 1: Range */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px' }}>
<label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Time Range</label>
<select
 value={reportsFilterRange}
 onChange={(e) =>setReportsFilterRange(e.target.value)}
 className="form-input"
 style={{ margin: 0 }}>
 
<option value="today">Today</option>
<option value="this_week">This Week (Last 7 Days)</option>
<option value="all">All Available</option>
</select>
</div>

 {/* Filter 2: Staff */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
<label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Staff Member</label>
<select
 value={reportsFilterStaff}
 onChange={(e) =>setReportsFilterStaff(e.target.value)}
 className="form-input"
 style={{ margin: 0 }}>
 
<option value="">All Staff</option>
 {staff.map((member) =>
<option key={member._id} value={member._id}>
 {member.name} ({member.staffRole || member.role})
</option>
)}
</select>
</div>

 {/* Filter 3: Branch */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
<label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Branch</label>
<select
 value={reportsFilterBranch}
 onChange={(e) =>setReportsFilterBranch(e.target.value)}
 className="form-input"
 style={{ margin: 0 }}>
 
<option value="">All Branches</option>
 {branches.map((b) =>
<option key={b._id} value={b.branchId}>
 {b.branchName}
</option>
)}
</select>
</div>

 {/* Clear button if active filters */}
 {(reportsFilterStaff || reportsFilterBranch || reportsFilterRange !== 'today') &&
<div style={{ display: 'flex', alignItems: 'flex-end' }}>
<button
 onClick={() =>{
 setReportsFilterRange('today');
 setReportsFilterStaff('');
 setReportsFilterBranch('');
 }}
 style={{
 backgroundColor: 'transparent',
 border: '1px solid #ff4d4d',
 borderRadius: '8px',
 padding: '8px 16px',
 color: '#ff4d4d',
 fontSize: '0.85rem',
 fontWeight: 'bold',
 cursor: 'pointer',
 transition: 'all 0.2s'
 }}>
 
 Clear Filters
</button>
</div>
 }
</div>

 {/* Reports List/Grid */}
 {reportsLoading ?
<div style={{ textAlign: 'center', padding: '50px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)' }}>Loading daily work reports...</p>
</div>:
 reportsError ?
<div style={{ color: '#ff4d4d', padding: '10px 0', fontSize: '0.9rem' }}> {reportsError}</div>:
 workReports.length === 0 ?
<div style={{
 padding: '50px 20px',
 textAlign: 'center',
 background: 'rgba(0, 0, 0,0.01)',
 borderRadius: '12px',
 border: '1px dashed var(--color-border)',
 color: 'var(--color-text-secondary)',
 fontStyle: 'italic'
 }}>
 No work reports found matching the selected filters.
</div>:

<div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
 gap: '20px'
 }}>
 {workReports.map((report) =>
<div
 key={report._id}
 onClick={() =>setSelectedReport(report)}
 style={{
 background: 'var(--bg-card)',
 border: '1px solid var(--color-border)',
 borderRadius: '12px',
 padding: '16px',
 cursor: 'pointer',
 transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
 display: 'flex',
 flexDirection: 'column',
 justifyContent: 'space-between',
 minHeight: '220px',
 boxShadow: 'var(--shadow-sm)'
 }}
 onMouseEnter={(e) =>{
 e.currentTarget.style.borderColor = 'var(--color-primary)';
 e.currentTarget.style.transform = 'translateY(-2px)';
 e.currentTarget.style.boxShadow = 'var(--shadow-md)';
 }}
 onMouseLeave={(e) =>{
 e.currentTarget.style.borderColor = 'var(--color-border)';
 e.currentTarget.style.transform = 'translateY(0)';
 e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
 }}>
 
<div>
 {/* Header details */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
<div>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', display: 'block' }}>{report.staffName}</strong>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Branch: {report.branchName}</span>
</div>
<span style={{
 backgroundColor: 'rgba(255, 107, 8, 0.1)',
 border: '1px solid var(--color-primary)',
 color: 'var(--color-primary)',
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '0.75rem',
 fontWeight: 'bold'
 }}>
 {report.photos.length} {report.photos.length === 1 ? 'photo' : 'photos'}
</span>
</div>

 {/* Thumbnail of first photo */}
<div style={{
 width: '100%',
 height: '110px',
 borderRadius: '8px',
 overflow: 'hidden',
 marginBottom: '10px',
 border: '1px solid var(--color-border)',
 background: '#000'
 }}>
<img
 src={getAssetUrl(report.photos[0])}
 alt="Work Proof"
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 loading="lazy" />
 
</div>

 {/* Note excerpt */}
 {report.notes &&
<p style={{
 margin: 0,
 fontSize: '0.8rem',
 color: 'var(--color-text-secondary)',
 lineHeight: '1.4',
 overflow: 'hidden',
 textOverflow: 'ellipsis',
 whiteSpace: 'nowrap'
 }}>
 {report.notes}
</p>
 }
</div>

 {/* Footer time */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', borderTop: '1px solid rgba(0, 0, 0,0.04)', paddingTop: '8px' }}>
<span>{new Date(report.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
<span> {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
</div>
</div>
)}
</div>
 }
</div>
</div>
 }
</div>
 }

 {activeTab === 'inventory' &&
<div className="fade-in">
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Smart Multi-Branch Ingredient Hub</h3>
<button
 onClick={() =>setShowAddInventoryModal(true)}
 className="btn btn-primary"
 style={{ width: 'auto', padding: '10px 20px' }}>
 
 Add Ingredient
</button>
</div>

 {/* Sub-tab bar */}
<div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', overflowX: 'auto' }}>
<button onClick={() =>setInventorySubTab('levels')} style={{ background: inventorySubTab === 'levels' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'levels' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Stock Directory</button>
<button onClick={() =>setInventorySubTab('movements')} style={{ background: inventorySubTab === 'movements' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'movements' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Movement Ledger</button>
<button onClick={() =>setInventorySubTab('wastage')} style={{ background: inventorySubTab === 'wastage' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'wastage' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Wastage Reports</button>
<button onClick={() =>setInventorySubTab('suppliers')} style={{ background: inventorySubTab === 'suppliers' ? '#6F4E37' : 'transparent', color: 'var(--color-text-primary)', border: inventorySubTab === 'suppliers' ? 'none' : '1px solid #432E22', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Supplier Registry</button>
</div>

 {inventoryError &&
<div style={{ backgroundColor: 'var(--color-danger-bg)', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-text-primary)', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>
  {inventoryError}
</div>
 }

 {inventoryLoading && inventoryList.length === 0 ?
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Synchronizing stock records...</p>
</div>:

<div>
 {/* SUBTAB 1: Stock levels */}
 {inventorySubTab === 'levels' &&
<div>
<div style={{ marginBottom: '16px' }}>
<input
 type="text"
 placeholder=" Search ingredients..."
 value={inventorySearch}
 onChange={(e) =>setInventorySearch(e.target.value)}
 style={{
 width: '100%', padding: '10px 14px',
 borderRadius: '10px', border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)', color: 'var(--color-text-primary)',
 fontSize: '14px', outline: 'none', fontFamily: 'inherit',
 boxSizing: 'border-box'
 }} />
 
</div>

 {/* Mobile/Tablet: Card grid */}
<div className="inv-mobile-cards">
 {filteredInventoryList.map((item) =>{
 const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
 const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
 const isLow = qtyVal<= reorderVal;
 const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;
 let statusColor = '#2ECC71';let statusLabel = 'IN STOCK';
 if (qtyVal<= 0) {statusColor = '#E74C3C';statusLabel = 'OUT';} else
 if (isLow) {statusColor = '#F39C12';statusLabel = 'LOW';}
 return (
<div key={item._id} style={{
 background: 'rgba(0, 0, 0,0.02)', border: `1px solid ${isLow || qtyVal<= 0 ? statusColor + '44' : 'var(--color-border)'}`,
 borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
 }}>
 {/* Top row: name + status badge */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
<div style={{ minWidth: 0 }}>
<div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginTop: '2px' }}>{item.category || 'Ingredients'}</div>
</div>
<span style={{
 background: `${statusColor}18`, border: `1px solid ${statusColor}`,
 color: statusColor, padding: '2px 8px', borderRadius: '6px',
 fontSize: '10px', fontWeight: 700, flexShrink: 0
 }}>{statusLabel}</span>
</div>

 {/* Mid row: stock + cost */}
<div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
<div style={{ textAlign: 'center' }}>
<div style={{ color: isLow ? statusColor : 'var(--color-text-primary)', fontWeight: 800, fontSize: '18px', lineHeight: 1 }}>{qtyVal}</div>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginTop: '2px' }}>{item.unit} · Stock</div>
</div>
<div style={{ textAlign: 'center' }}>
<div style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '15px', lineHeight: 1 }}>₹{(costPriceVal || 0).toFixed(2)}</div>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginTop: '2px' }}>Cost/unit</div>
</div>
<div style={{ textAlign: 'center' }}>
<div style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '13px', lineHeight: 1 }}>{reorderVal} {item.unit}</div>
<div style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginTop: '2px' }}>Reorder at</div>
</div>
</div>

 {/* Actions */}
<div style={{ display: 'flex', gap: '6px', borderTop: '1px solid rgba(0, 0, 0,0.06)', paddingTop: '10px' }}>
<button
 onClick={() =>{setPurchaseForm({ itemId: item._id, itemName: item.name, quantityAdded: 0, costPrice: costPriceVal, supplier: item.supplier || '', notes: '' });setShowPurchaseModal(true);}}
 style={{ flex: 1, background: 'rgba(46,204,113,0.1)', color: '#2ECC71', border: '1px solid #2ECC71', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
 Purchase</button>
<button
 onClick={() =>{setWastageForm({ itemId: item._id, itemName: item.name, quantityWasted: 0, type: 'Wastage', reason: '' });setShowWastageModal(true);}}
 style={{ flex: 1, background: 'rgba(231,76,60,0.1)', color: '#E74C3C', border: '1px solid #E74C3C', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
 Wastage</button>
<button
 onClick={() =>{setEditingInventoryItem({ ...item });setShowEditInventoryModal(true);}}
 style={{ flex: 1, background: 'rgba(0, 0, 0,0.06)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
 ✏️ Edit</button>
<button
 onClick={() =>handleDeleteInventoryItem(item._id)}
 style={{ flex: 1, background: 'rgba(231,76,60,0.06)', color: '#E74C3C', border: '1px solid #E74C3C', padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit' }}>
 🗑️ Delete</button>
</div>
</div>);

 })}
 {filteredInventoryList.length === 0 &&
<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
 No ingredients found.
</div>
 }
</div>

 {/* Desktop: scrollable table */}
<div className="inv-desktop-table">
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
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
 {filteredInventoryList.map((item) =>{
 const qtyVal = item.quantity !== undefined ? item.quantity : item.stock;
 const reorderVal = item.reorderLevel !== undefined ? item.reorderLevel : item.minStock;
 const isLow = qtyVal<= reorderVal;
 const costPriceVal = item.costPrice !== undefined ? item.costPrice : item.cost;
 let statusColor = '#2ECC71';
 if (qtyVal<= 0) statusColor = '#E74C3C';else
 if (isLow) statusColor = '#F39C12';
 return (
<tr key={item._id} style={{ borderBottom: '1px solid #432E22' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{item.name}</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{item.category || 'Ingredients'}</td>
<td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: isLow ? '#E74C3C' : 'var(--color-text-primary)' }}>{qtyVal} {item.unit}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>
<span style={{ backgroundColor: `${statusColor}1A`, border: `1px solid ${statusColor}`, color: statusColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
 {qtyVal<= 0 ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'IN_STOCK'}
</span>
</td>
<td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{costPriceVal?.toFixed(2)}</td>
<td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(item.sellingPrice || 0).toFixed(2)}</td>
<td style={{ padding: '10px 8px' }}>{item.supplier || 'N/A'}</td>
<td style={{ padding: '10px 8px' }}>{item.branch || 'Main'}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>{reorderVal} {item.unit}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>
<div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
<button onClick={() =>{setPurchaseForm({ itemId: item._id, itemName: item.name, quantityAdded: 0, costPrice: costPriceVal, supplier: item.supplier || '', notes: '' });setShowPurchaseModal(true);}} style={{ background: '#27AE60', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Purchase</button>
<button onClick={() =>{setWastageForm({ itemId: item._id, itemName: item.name, quantityWasted: 0, type: 'Wastage', reason: '' });setShowWastageModal(true);}} style={{ background: '#E74C3C', color: 'var(--color-text-primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Wastage</button>
<button onClick={() =>{setEditingInventoryItem({ ...item });setShowEditInventoryModal(true);}} style={{ background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️ Edit</button>
<button onClick={() =>handleDeleteInventoryItem(item._id)} style={{ background: 'transparent', color: '#E74C3C', border: '1px solid #E74C3C', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
</div>
</td>
</tr>);

 })}
</tbody>
</table>
</div>
</div>
 }

 {/* SUBTAB 2: Movement Logs */}
 {inventorySubTab === 'movements' &&
<div style={{ overflowX: 'auto' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
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
 {inventoryLogs.map((log) =>{
 const isPositive = log.quantityChanged >0;
 const typeColor = log.type === 'Purchase' || log.type === 'Initial' ? '#2ECC71' : log.type === 'Wastage' || log.type === 'Damaged' ? '#E74C3C' : '#F39C12';
 return (
<tr key={log._id} style={{ borderBottom: '1px solid #432E22' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
 {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{log.itemName}</td>
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
<td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-text-primary)' }}>
 ₹{(log.cost || 0).toFixed(2)}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.reason}</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.userEmail || 'system'}</td>
</tr>);

 })}
</tbody>
</table>
</div>
 }

 {/* SUBTAB 3: Wastage Reports */}
 {inventorySubTab === 'wastage' &&
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

<h4 style={{ color: 'var(--color-text-primary)', margin: '10px 0 0 0' }}>Detailed Wastage & Spoilage Log</h4>
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
<thead>
<tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
<th style={{ padding: '8px' }}>Date</th>
<th style={{ padding: '8px' }}>Ingredient</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Type</th>
<th style={{ padding: '8px', textAlign: 'center' }}>Quantity Lost</th>
<th style={{ padding: '8px', textAlign: 'right' }}>Wasted Cost</th>
<th style={{ padding: '8px' }}>Wastage Reason</th>
</tr>
</thead>
<tbody>
 {inventoryLogs.filter((log) =>log.type === 'Wastage' || log.type === 'Damaged').map((log) =>
<tr key={log._id} style={{ borderBottom: '1px solid #432E22' }}>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>
 {new Date(log.createdAt).toLocaleDateString()}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{log.itemName}</td>
<td style={{ padding: '10px 8px', textAlign: 'center' }}>{log.type}</td>
<td style={{ padding: '10px 8px', textAlign: 'center', color: '#E74C3C', fontWeight: 'bold' }}>
 {Math.abs(log.quantityChanged)}
</td>
<td style={{ padding: '10px 8px', textAlign: 'right', color: '#E74C3C', fontWeight: 'bold' }}>
 ₹{log.cost.toFixed(2)}
</td>
<td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)' }}>{log.reason}</td>
</tr>
)}
</tbody>
</table>
</div>
 }

 {/* SUBTAB 4: Suppliers */}
 {inventorySubTab === 'suppliers' &&
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '16px' }}>
 {Array.from(new Set(inventoryList.map((item) =>item.supplier || 'Unassigned Supplier'))).map((sup) =>{
 const supItems = inventoryList.filter((item) =>(item.supplier || 'Unassigned Supplier') === sup);
 const totalSupplierValue = supItems.reduce((sum, i) =>sum + (i.quantity || i.stock) * (i.costPrice || i.cost), 0);
 return (
<div key={sup} style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '1rem' }}>{sup}</strong>
<span style={{ fontSize: '11px', background: '#6F4E37', color: 'var(--color-text-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
 {supItems.length} Products
</span>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 {supItems.map((item) =>
<div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
<span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
<strong style={{ color: 'var(--color-text-primary)' }}>{item.quantity || item.stock} {item.unit}</strong>
</div>
)}
</div>
<div style={{ borderTop: '1px dashed var(--color-border)', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
<span>Total Value:</span>
<strong style={{ color: '#2ECC71' }}>₹{totalSupplierValue.toFixed(2)}</strong>
</div>
</div>);

 })}
</div>
 }
</div>
 }
</div>
</div>
 }

 {/* TAB 5: ORDERS MONITOR (READ-ONLY) */}
 {activeTab === 'orders' &&
<div className="fade-in">
<div className="orders-monitor-wrapper" style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', overflowX: 'auto' }}>

{/* Filter Controls for Orders */}
<div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Select Date</label>
 <input 
 type="date" 
 value={orderDateFilter} 
 onChange={(e) => setOrderDateFilter(e.target.value)}
 style={{
 padding: '10px 14px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 outline: 'none',
 fontFamily: 'inherit',
 fontSize: '14px'
 }}
 />
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
 <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>Search Orders</label>
 <input 
 type="text" 
 placeholder="Search by Order ID, Table number, or Status..."
 value={orderSearchQuery} 
 onChange={(e) => setOrderSearchQuery(e.target.value)}
 style={{
 padding: '10px 14px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 background: 'var(--bg-secondary)',
 color: 'var(--color-text-primary)',
 outline: 'none',
 fontFamily: 'inherit',
 width: '100%',
 fontSize: '14px'
 }}
 />
 </div>
</div>

<div className="orders-monitor-grid">
 {orders
 .filter((order) => {
 if (!order.createdAt) return true;
 const localDate = new Date(order.createdAt);
 const orderDateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
 
 const matchesDate = orderDateStr === orderDateFilter;
 if (!matchesDate) return false;
 
 if (!orderSearchQuery) return true;
 
 const q = orderSearchQuery.toLowerCase();
 return (
 (order._id && order._id.toLowerCase().includes(q)) || 
 (order.tableNumber && String(order.tableNumber).toLowerCase().includes(q)) || 
 (order.status && order.status.toLowerCase().includes(q)) ||
 (order.items && order.items.some(i => i.name && i.name.toLowerCase().includes(q)))
 );
 })
 .map((order) =>
<div key={order._id} style={{
 background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)',
 borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
 }}>
 {/* Header: Order ID + Status */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '15px' }}>
 #{order._id.substring(order._id.length - 8).toUpperCase()}
</span>
<span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>· Table {order.tableNumber}</span>
</div>
<span style={{
 color: order.status === 'Placed' ? '#3498db' : order.status === 'Preparing' ? '#ff9800' : order.status === 'Ready' ? '#2ecc71' : order.status === 'Delivered' ? '#9b59b6' : order.status === 'Completed' ? '#27AE60' : '#7f8c8d',
 background: order.status === 'Placed' ? 'rgba(52,152,219,0.1)' : order.status === 'Preparing' ? 'rgba(255,152,0,0.1)' : order.status === 'Ready' ? 'rgba(46,204,113,0.1)' : order.status === 'Delivered' ? 'rgba(155,89,182,0.1)' : order.status === 'Completed' ? 'rgba(39,174,96,0.1)' : 'rgba(127,140,141,0.1)',
 padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
 }}>
 {order.status}
</span>
</div>

 {/* Items List */}
<div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
 {order.items.map((i, idx) =>
<div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: idx !== order.items.length - 1 ? '4px' : 0 }}>
<span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{i.quantity}x</span>
<span>{i.name}</span>
</div>
)}
</div>

 {/* Footer: Amount + Payment Status */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(0, 0, 0,0.1)', paddingTop: '12px' }}>
<div style={{ display: 'flex', flexDirection: 'column' }}>
<span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Total Amount</span>
<span style={{ color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '16px' }}>₹{order.totalAmount.toFixed(2)}</span>
</div>
<span style={{
 color: order.paymentStatus === 'Paid' ? '#27AE60' : '#E74C3C',
 fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
 }}>
 {order.paymentStatus === 'Paid' ? ' Paid' : ' Pending'}
</span>
</div>
</div>
)}
 {orders.length === 0 &&
<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
 No active orders at the moment.
</div>
 }
</div>
</div>
</div>
 }

 {/* TAB 7: SETTINGS & QRS */}
 {activeTab === 'config' &&
<div className="fade-in">
 {/* Payment Integration settings */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', marginBottom: '30px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 700 }}> Setup Payment Gateways</h3>
 {settingsMsg &&
<div style={{ background: 'rgba(39,174,96,0.15)', borderLeft: '4px solid #27AE60', color: '#27AE60', padding: '12px', marginBottom: '20px', borderRadius: '4px' }}>
 {settingsMsg}
</div>
 }
<form onSubmit={handleSaveSettings}>
<div className="form-row" style={{ marginBottom: '20px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="settings-razorpay-key-id" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Razorpay Key ID</label>
<input type="text" id="settings-razorpay-key-id" name="settings-razorpay-key-id" className="form-input" value={razorpayKeyId} onChange={(e) =>setRazorpayKeyId(e.target.value)} placeholder="rzp_test_..." />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="settings-razorpay-secret" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Razorpay Secret Key</label>
<input type="password" id="settings-razorpay-secret" name="settings-razorpay-secret" className="form-input" value={razorpaySecret} onChange={(e) =>setRazorpaySecret(e.target.value)} placeholder="••••••••••••••••••••" />
</div>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '15px', borderRadius: '8px', border: '1px dashed #5C4331', marginBottom: '20px' }}>
<div>
<span style={{ fontWeight: 600, fontSize: '0.85rem', color: isRazorpayVerified ? '#2ECC71' : '#E6D5C3' }}>
 Status: {isRazorpayVerified ? 'Keys Verified & Configured ' : 'Verification Required'}
</span>
</div>
<button type="button" onClick={testRazorpayConnection} className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }} disabled={verifyingKeys}>
 {verifyingKeys ? 'Verifying...' : 'Test Razorpay Connection'}
</button>
</div>

<div className="form-row" style={{ marginBottom: '20px' }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="settings-tax-rate" className="form-label" style={{ color: 'var(--color-text-primary)' }}>GST Tax Rate (%)</label>
<input type="number" id="settings-tax-rate" name="settings-tax-rate" className="form-input" value={taxRate} onChange={(e) =>setTaxRate(parseFloat(e.target.value))} />
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
<label htmlFor="settings-service-charge" className="form-label" style={{ color: 'var(--color-text-primary)' }}>Service Charge (%)</label>
<input type="number" id="settings-service-charge" name="settings-service-charge" className="form-input" value={serviceCharge} onChange={(e) =>setServiceCharge(parseFloat(e.target.value))} />
</div>
</div>

<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
 Save Configuration
</button>
</form>
</div>

 {/* QR Code generator */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px' }}>
<h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 700 }}>Table QR Codes Generator</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
 Select a table to dynamically render its scan QR code. Customers can scan it to order directly.
</p>
 
<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
 {dynamicTables.map((table) =>
<button
 key={table}
 onClick={() =>setSelectedQrTable(selectedQrTable === table ? null : table)}
 className="category-chip"
 style={{
 padding: '8px 16px',
 fontSize: '13px',
 borderRadius: 'var(--radius-sm)',
 background: selectedQrTable === table ? 'var(--color-primary)' : 'transparent',
 border: '1px solid var(--color-primary)',
 color: 'var(--color-text-primary)',
 cursor: 'pointer'
 }}>
 
 Table {table} QR
</button>
)}
</div>

 {selectedQrTable &&
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
<h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
 Scan QR for Table {selectedQrTable}
</h4>
<div style={{ background: 'white', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
<img
 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}`)}`}
 alt={`Table ${selectedQrTable} QR Code`}
 style={{ width: '150px', height: '150px', display: 'block' }} />
 
</div>
<div style={{ display: 'flex', gap: '10px' }}>
<a href={`/?table=${selectedQrTable}&cafeId=${user?.cafeId || ''}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', width: 'auto' }}>
 Open Menu Tab
</a>
<button onClick={() =>handleCopyUrl(selectedQrTable)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}>
 {copiedLink ? ' Copied!' : ' Copy URL'}
</button>
</div>
</div>
 }
</div>

 {/* Branch Management Section */}
<div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', padding: '25px', borderRadius: '16px', marginTop: '30px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<div>
<h3 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Cafe Branch & Location Management</h3>
<p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
 Configure physical branch geofences for attendance tracking validation.
</p>
</div>
<button onClick={() =>setShowAddBranchModal(true)} className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
 Add New Branch
</button>
</div>

 {branchesLoading && branches.length === 0 ?
<div style={{ textAlign: 'center', padding: '20px 0' }}>
<div className="spinner" style={{ margin: '0 auto 10px auto', borderColor: 'var(--color-primary)' }} />
<p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading branches...</p>
</div>:
 branches.length === 0 ?
<div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
 No branches configured yet. Add one to start tracking location-based attendance.
</div>:

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '20px' }}>
 {branches.map((b) =>
<div key={b._id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
<h4 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{b.branchName}</h4>
<span style={{
 backgroundColor: b.isActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
 color: b.isActive ? '#2ecc71' : '#e74c3c',
 padding: '2px 8px',
 borderRadius: '10px',
 fontSize: '11px',
 fontWeight: 'bold'
 }}>
 {b.isActive ? 'Active' : 'Inactive'}
</span>
</div>
<div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
<div><strong>Manager:</strong>{b.manager || 'Unassigned'}</div>
<div><strong>Address:</strong>{b.address}</div>
<div><strong>Coordinates:</strong>{b.latitude}, {b.longitude}</div>
<div><strong>Geo-Fence:</strong>{b.allowedRadius} meters radius</div>
</div>
<div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
<button onClick={() =>{setEditingBranch({ ...b });setShowEditBranchModal(true);}} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', flex: 1, minHeight: '34px' }}>
  Edit
</button>
<button onClick={() =>handleDeleteBranch(b._id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', flex: 1, minHeight: '34px' }}>
  Delete
</button>
</div>
</div>
)}
</div>
 }
</div>

</div>
 }

 {/* MODAL 1: ADD NEW MENU ITEM */}
 {showAddModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Add New Cafe Item</h3>
<button onClick={() =>setShowAddModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleAddMenuItem}>
<div className="modal-body">
<div className="form-group">
<label htmlFor="add-item-name" className="form-label">Dish Name *</label>
<input type="text" id="add-item-name" name="add-item-name" required placeholder="Gourmet double cheeseburger" value={newItem.name} onChange={(e) =>setNewItem({ ...newItem, name: e.target.value })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-item-price" className="form-label">Price (₹) *</label>
<input type="number" id="add-item-price" name="add-item-price" required step="0.01" min="0.01" value={newItem.price} onChange={(e) =>setNewItem({ ...newItem, price: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-item-category" className="form-label">Category *</label>
<select id="add-item-category" name="add-item-category" value={newItem.category} onChange={(e) =>setNewItem({ ...newItem, category: e.target.value })} className="form-input">
 {(categories.length >0 ? categories.map((c) =>c.name) : presetCategories).map((cat) =>
<option key={cat} value={cat}>{cat}</option>
)}
</select>
</div>
</div>
<div className="form-group">
<label htmlFor="add-item-description" className="form-label">Description *</label>
<textarea id="add-item-description" name="add-item-description" required rows="3" value={newItem.description} onChange={(e) =>setNewItem({ ...newItem, description: e.target.value })} className="form-input"></textarea>
</div>
<div className="form-group">
<label htmlFor="add-item-prep-time" className="form-label">Preparation Time (minutes) *</label>
<input type="number" id="add-item-prep-time" name="add-item-prep-time" required min="1" value={newItem.preparationTime || 10} onChange={(e) =>setNewItem({ ...newItem, preparationTime: parseInt(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<span id="add-item-image-label" className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Dish Image</span>
<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} aria-labelledby="add-item-image-label">
<input
 type="file"
 accept="image/*"
 id="add-dish-image"
 onChange={(e) =>handleImageUpload(e.target.files[0], false)}
 style={{ display: 'none' }} />
 
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
 background: 'rgba(0, 0, 0,0.05)',
 borderRadius: '8px',
 fontSize: '13px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 minHeight: '44px'
 }}>
 
 Choose Image File
</label>
 {imageUploading ?
<span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Uploading...</span>:
 newItem.image ?
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<img src={getAssetUrl(newItem.image)} alt="Dish preview" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
<span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>Uploaded</span>
</div>:

<span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No file selected (using default)</span>
 }
</div>
</div>
<div className="form-group" style={{ borderTop: '1px solid #432E22', paddingTop: '15px', marginTop: '15px' }}>
<span id="add-item-recipe-label" className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Recipe Mapping (Ingredients)</span>
 {!newItem.recipe || newItem.recipe.length === 0 ?
<p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '5px 0' }}>No ingredients mapped yet. This item will not deduct stock.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
 {newItem.recipe.map((ing, idx) =>{
 const invItem = inventoryList.find((i) =>i.name === ing.name);
 return (
<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '6px' }}>
<span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
<input type="number" value={ing.quantity} min="0.001" step="0.001" onChange={(e) => { const updated = [...newItem.recipe]; updated[idx].quantity = Number(e.target.value); setNewItem({ ...newItem, recipe: updated }); }} style={{ width: '60px', padding: '4px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent', textAlign: 'center' }} />
<span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{invItem?.unit || 'g'}</span>
<button type="button" onClick={() =>handleRemoveIngredientFromNewItem(ing.name)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
</div>
</div>);

 })}
</div>
 }
<div className="recipe-map-grid" aria-labelledby="add-item-recipe-label">
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="add-item-ingredient-select" className="form-label" style={{ fontSize: '11px' }}>Select Ingredient</label>
<select id="add-item-ingredient-select" name="add-item-ingredient-select" value={selectedIngredient} onChange={(e) =>setSelectedIngredient(e.target.value)} className="form-input" style={{ padding: '8px' }}>
<option value="">-- Choose Ingredient --</option>
 {inventoryList.map((inv) =>
<option key={inv._id} value={inv.name}>{inv.name} ({inv.unit})</option>
)}
</select>
</div>
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="add-item-ingredient-qty" className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
<input type="number" id="add-item-ingredient-qty" name="add-item-ingredient-qty" step="0.001" min="0.001" placeholder="e.g. 10" value={ingredientQuantity} onChange={(e) =>setIngredientQuantity(e.target.value)} className="form-input" style={{ padding: '8px' }} />
</div>
<button type="button" onClick={handleAddIngredientToNewItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>Map</button>
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowAddModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Add Item</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 2: EDIT MENU ITEM */}
 {showEditModal && editingItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Cafe Item</h3>
<button onClick={() =>{setShowEditModal(false);setEditingItem(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditMenuItem}>
<div className="modal-body">
<div className="form-group">
<label htmlFor="edit-item-name" className="form-label">Dish Name *</label>
<input type="text" id="edit-item-name" name="edit-item-name" required value={editingItem.name} onChange={(e) =>setEditingItem({ ...editingItem, name: e.target.value })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-item-price" className="form-label">Price (₹) *</label>
<input type="number" id="edit-item-price" name="edit-item-price" required step="0.01" min="0.01" value={editingItem.price} onChange={(e) =>setEditingItem({ ...editingItem, price: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-item-category" className="form-label">Category *</label>
<select id="edit-item-category" name="edit-item-category" value={editingItem.category} onChange={(e) =>setEditingItem({ ...editingItem, category: e.target.value })} className="form-input">
 {(categories.length >0 ? categories.map((c) =>c.name) : presetCategories).map((cat) =>
<option key={cat} value={cat}>{cat}</option>
)}
</select>
</div>
</div>
<div className="form-group">
<label htmlFor="edit-item-description" className="form-label">Description *</label>
<textarea id="edit-item-description" name="edit-item-description" required rows="3" value={editingItem.description} onChange={(e) =>setEditingItem({ ...editingItem, description: e.target.value })} className="form-input"></textarea>
</div>
<div className="form-group">
<label htmlFor="edit-item-prep-time" className="form-label">Preparation Time (minutes) *</label>
<input type="number" id="edit-item-prep-time" name="edit-item-prep-time" required min="1" value={editingItem.preparationTime || 10} onChange={(e) =>setEditingItem({ ...editingItem, preparationTime: parseInt(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<span id="edit-item-image-label" className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Dish Image</span>
<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} aria-labelledby="edit-item-image-label">
<input
 type="file"
 accept="image/*"
 id="edit-dish-image"
 onChange={(e) =>handleImageUpload(e.target.files[0], true)}
 style={{ display: 'none' }} />
 
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
 background: 'rgba(0, 0, 0,0.05)',
 borderRadius: '8px',
 fontSize: '13px',
 fontWeight: 'bold',
 color: 'var(--color-text-primary)',
 minHeight: '44px'
 }}>
 
 Choose Image File
</label>
 {imageUploading ?
<span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Uploading...</span>:
 editingItem.image ?
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<img src={getAssetUrl(editingItem.image)} alt="Dish preview" style={{ width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-primary)' }} />
<span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 'bold' }}>Uploaded</span>
</div>:

<span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No file selected (using default)</span>
 }
</div>
</div>
<div className="form-group" style={{ borderTop: '1px solid #432E22', paddingTop: '15px', marginTop: '15px' }}>
<span id="edit-item-recipe-label" className="form-label" style={{ color: 'var(--color-primary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Recipe Mapping (Ingredients)</span>
 {!editingItem.recipe || editingItem.recipe.length === 0 ?
<p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '5px 0' }}>No ingredients mapped yet. This item will not deduct stock.</p>:

<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
 {editingItem.recipe.map((ing, idx) =>{
 const invItem = inventoryList.find((i) =>i.name === ing.name);
 return (
<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0,0.02)', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: '6px' }}>
<span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
<input type="number" value={ing.quantity} min="0.001" step="0.001" onChange={(e) => { const updated = [...editingItem.recipe]; updated[idx].quantity = Number(e.target.value); setEditingItem({ ...editingItem, recipe: updated }); }} style={{ width: '60px', padding: '4px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent', textAlign: 'center' }} />
<span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{invItem?.unit || 'g'}</span>
<button type="button" onClick={() =>handleRemoveIngredientFromEditingItem(ing.name)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
</div>
</div>);

 })}
</div>
 }
<div className="recipe-map-grid" aria-labelledby="edit-item-recipe-label">
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="edit-item-ingredient-select" className="form-label" style={{ fontSize: '11px' }}>Select Ingredient</label>
<select id="edit-item-ingredient-select" name="edit-item-ingredient-select" value={selectedIngredient} onChange={(e) =>setSelectedIngredient(e.target.value)} className="form-input" style={{ padding: '8px' }}>
<option value="">-- Choose Ingredient --</option>
 {inventoryList.map((inv) =>
<option key={inv._id} value={inv.name}>{inv.name} ({inv.unit})</option>
)}
</select>
</div>
<div className="form-group" style={{ marginBottom: 0 }}>
<label htmlFor="edit-item-ingredient-qty" className="form-label" style={{ fontSize: '11px' }}>Quantity</label>
<input type="number" id="edit-item-ingredient-qty" name="edit-item-ingredient-qty" step="0.001" min="0.001" placeholder="e.g. 10" value={ingredientQuantity} onChange={(e) =>setIngredientQuantity(e.target.value)} className="form-input" style={{ padding: '8px' }} />
</div>
<button type="button" onClick={handleAddIngredientToEditingItem} className="btn btn-secondary" style={{ width: 'auto', padding: '9px 12px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>Map</button>
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditModal(false);setEditingItem(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Update & Save</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: MANAGE CATEGORIES */}
 {showCategoryModal &&
<div className="modal-overlay">
<div className="modal-container" style={{ maxWidth: '500px' }}>
<div className="modal-header">
<h3 className="modal-title">Manage Menu Categories</h3>
<button onClick={() =>{setShowCategoryModal(false);setEditingCategory(null);}} className="modal-close">&times;</button>
</div>
<div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
 {/* Add new Category */}
<form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(0, 0, 0,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
<input
 type="text"
 id="new-category-name"
 name="new-category-name"
 aria-label="New Category Name"
 required
 placeholder="New category name..."
 value={newCategoryName}
 onChange={(e) =>setNewCategoryName(e.target.value)}
 className="form-input"
 style={{ marginBottom: 0, flexGrow: 1 }} />
 
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
 Add
</button>
</form>

 {/* Edit existing Category */}
 {editingCategory &&
<form onSubmit={handleUpdateCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255, 107, 8, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-primary)' }}>
<input
 type="text"
 id="rename-category-name"
 name="rename-category-name"
 aria-label="Rename Category Name"
 required
 placeholder="Rename category..."
 value={categoryNameInput}
 onChange={(e) =>setCategoryNameInput(e.target.value)}
 className="form-input"
 style={{ marginBottom: 0, flexGrow: 1 }} />
 
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
 Save
</button>
<button type="button" onClick={() =>{setEditingCategory(null);setCategoryNameInput('');}} className="btn btn-secondary" style={{ width: 'auto', padding: '0 15px', height: '42px', fontSize: '13px' }}>
 Cancel
</button>
</form>
 }

 {/* List Categories */}
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '14px', margin: '0 0 5px 0' }}>Existing Categories (Drag or use arrows to reorder):</h4>
 {categoryLoading && categories.length === 0 ?
<div className="spinner" style={{ margin: '10px auto', borderColor: 'var(--color-primary)', width: '20px', height: '20px', borderWidth: '2px' }} />:

 (categories.length >0 ? categories : presetCategories.map((name, idx) =>({ _id: idx, name }))).map((cat, idx) =>
<div
 key={cat._id}
 draggable={cat._id && typeof cat._id === 'string'}
 onDragStart={(e) =>handleCategoryDragStart(e, idx)}
 onDragOver={handleCategoryDragOver}
 onDrop={(e) =>handleCategoryDrop(e, idx)}
 style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 background: 'rgba(0, 0, 0,0.02)',
 border: '1px solid var(--color-border)',
 padding: '10px 14px',
 borderRadius: '10px',
 cursor: cat._id && typeof cat._id === 'string' ? 'grab' : 'default',
 transition: 'all 0.2s ease',
 userSelect: 'none'
 }}
 onDragEnd={(e) =>{e.currentTarget.style.opacity = '1';}}
 onDragLeave={(e) =>{e.currentTarget.style.background = 'rgba(255,255,255,0.02)';}}
 onDragEnter={(e) =>{e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)';}}>
 
<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 {cat._id && typeof cat._id === 'string' &&
<span style={{ color: 'var(--color-text-secondary)', cursor: 'grab', fontSize: '14px' }}></span>
 }
<span style={{ color: 'var(--color-text-primary)', fontSize: '14.5px', fontWeight: 700 }}>{cat.name}</span>
</div>
 
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
 {/* Reordering arrows */}
 {cat._id && typeof cat._id === 'string' &&
<div style={{ display: 'flex', gap: '4px' }}>
<button
 type="button"
 disabled={idx === 0}
 onClick={() =>moveCategory(idx, 'up')}
 style={{
 background: 'rgba(0, 0, 0,0.04)',
 border: 'none',
 color: idx === 0 ? 'rgba(255,255,255,0.1)' : '#fff',
 borderRadius: '4px',
 padding: '4px 8px',
 cursor: idx === 0 ? 'not-allowed' : 'pointer',
 fontSize: '11px'
 }}>
 
 ▲
</button>
<button
 type="button"
 disabled={idx === categories.length - 1}
 onClick={() =>moveCategory(idx, 'down')}
 style={{
 background: 'rgba(0, 0, 0,0.04)',
 border: 'none',
 color: idx === categories.length - 1 ? 'rgba(255,255,255,0.1)' : '#fff',
 borderRadius: '4px',
 padding: '4px 8px',
 cursor: idx === categories.length - 1 ? 'not-allowed' : 'pointer',
 fontSize: '11px'
 }}>
 
 ▼
</button>
</div>
 }

 {/* Edit/Delete */}
 {cat._id && typeof cat._id === 'string' ?
<div style={{ display: 'flex', gap: '10px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
<button
 type="button"
 onClick={() =>{setEditingCategory(cat);setCategoryNameInput(cat.name);}}
 style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px' }}>
 
 
</button>
<button
 type="button"
 onClick={() =>handleDeleteCategory(cat._id)}
 style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '13px' }}>
 
 
</button>
</div>:

<span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Preset</span>
 }
</div>
</div>
)
 }
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowCategoryModal(false);setEditingCategory(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Close</button>
</div>
</div>
</div>
 }

 {/* MODAL 4: ADD INVENTORY ITEM */}
 {showAddInventoryModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Add Ingredient</h3>
<button onClick={() =>setShowAddInventoryModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleAddInventoryItem}>
<div className="modal-body">
<div className="form-group">
<label htmlFor="add-inv-name" className="form-label">Ingredient Name *</label>
<input type="text" id="add-inv-name" name="add-inv-name" required value={newInventoryItem.name} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, name: e.target.value })} className="form-input" placeholder="e.g. Tomato Sauce" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-stock" className="form-label">Initial Stock *</label>
<input type="number" id="add-inv-stock" name="add-inv-stock" required value={newInventoryItem.stock} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, stock: Number(e.target.value), quantity: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-inv-minstock" className="form-label">Safety Minimum *</label>
<input type="number" id="add-inv-minstock" name="add-inv-minstock" required value={newInventoryItem.minStock} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, minStock: Number(e.target.value), reorderLevel: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-unit" className="form-label">Unit of Measurement *</label>
<input type="text" id="add-inv-unit" name="add-inv-unit" required value={newInventoryItem.unit} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })} className="form-input" placeholder="e.g. kg, pcs, g, liters" />
</div>
<div className="form-group">
<label htmlFor="add-inv-cost" className="form-label">Cost per Unit (₹) *</label>
<input type="number" step="0.001" id="add-inv-cost" name="add-inv-cost" required value={newInventoryItem.cost} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, cost: Number(e.target.value), costPrice: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-sellingprice" className="form-label">Selling Price (₹) *</label>
<input type="number" step="0.01" id="add-inv-sellingprice" name="add-inv-sellingprice" required value={newInventoryItem.sellingPrice} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, sellingPrice: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="add-inv-category" className="form-label">Category *</label>
<input type="text" id="add-inv-category" name="add-inv-category" required value={newInventoryItem.category} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, category: e.target.value })} className="form-input" placeholder="e.g. Ingredients, Dairy, Beverage Raw" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="add-inv-supplier" className="form-label">Supplier *</label>
<input type="text" id="add-inv-supplier" name="add-inv-supplier" required value={newInventoryItem.supplier} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, supplier: e.target.value })} className="form-input" placeholder="Supplier name" />
</div>
<div className="form-group">
<label htmlFor="add-inv-branch" className="form-label">Branch *</label>
<input type="text" id="add-inv-branch" name="add-inv-branch" required value={newInventoryItem.branch} onChange={(e) =>setNewInventoryItem({ ...newInventoryItem, branch: e.target.value })} className="form-input" placeholder="e.g. Main, Uptown" />
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowAddInventoryModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Add Ingredient</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 5: EDIT INVENTORY ITEM */}
 {showEditInventoryModal && editingInventoryItem &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Ingredient</h3>
<button onClick={() =>{setShowEditInventoryModal(false);setEditingInventoryItem(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditInventoryItem}>
<div className="modal-body">
<div className="form-group">
<label htmlFor="edit-inv-name" className="form-label">Ingredient Name *</label>
<input type="text" id="edit-inv-name" name="edit-inv-name" required value={editingInventoryItem.name} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, name: e.target.value })} className="form-input" />
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-stock" className="form-label">Current Stock *</label>
<input type="number" id="edit-inv-stock" name="edit-inv-stock" required value={editingInventoryItem.stock} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, stock: Number(e.target.value), quantity: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-minstock" className="form-label">Safety Minimum *</label>
<input type="number" id="edit-inv-minstock" name="edit-inv-minstock" required value={editingInventoryItem.minStock} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, minStock: Number(e.target.value), reorderLevel: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-unit" className="form-label">Unit of Measurement *</label>
<input type="text" id="edit-inv-unit" name="edit-inv-unit" required value={editingInventoryItem.unit} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, unit: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-cost" className="form-label">Cost per Unit (₹) *</label>
<input type="number" step="0.001" id="edit-inv-cost" name="edit-inv-cost" required value={editingInventoryItem.cost} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, cost: Number(e.target.value), costPrice: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-sellingprice" className="form-label">Selling Price (₹) *</label>
<input type="number" step="0.01" id="edit-inv-sellingprice" name="edit-inv-sellingprice" required value={editingInventoryItem.sellingPrice || 0} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, sellingPrice: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-category" className="form-label">Category *</label>
<input type="text" id="edit-inv-category" name="edit-inv-category" required value={editingInventoryItem.category || 'Ingredients'} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, category: e.target.value })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label htmlFor="edit-inv-supplier" className="form-label">Supplier *</label>
<input type="text" id="edit-inv-supplier" name="edit-inv-supplier" required value={editingInventoryItem.supplier || ''} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, supplier: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label htmlFor="edit-inv-branch" className="form-label">Branch *</label>
<input type="text" id="edit-inv-branch" name="edit-inv-branch" required value={editingInventoryItem.branch || 'Main'} onChange={(e) =>setEditingInventoryItem({ ...editingInventoryItem, branch: e.target.value })} className="form-input" />
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditInventoryModal(false);setEditingInventoryItem(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: RECORD PURCHASE */}
 {showPurchaseModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Record Purchase Entry</h3>
<button onClick={() =>setShowPurchaseModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleRecordPurchase}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Ingredient:<strong>{purchaseForm.itemName}</strong></label>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Quantity Purchased *</label>
<input type="number" required min="1" value={purchaseForm.quantityAdded} onChange={(e) =>setPurchaseForm({ ...purchaseForm, quantityAdded: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Cost Price per Unit (₹) *</label>
<input type="number" step="0.001" required min="0.001" value={purchaseForm.costPrice} onChange={(e) =>setPurchaseForm({ ...purchaseForm, costPrice: Number(e.target.value) })} className="form-input" />
</div>
</div>
<div className="form-group">
<label className="form-label">Supplier *</label>
<input type="text" required value={purchaseForm.supplier} onChange={(e) =>setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Notes</label>
<textarea value={purchaseForm.notes} onChange={(e) =>setPurchaseForm({ ...purchaseForm, notes: e.target.value })} className="form-input" rows="2" placeholder="e.g. Weekly restocking"></textarea>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowPurchaseModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Entry</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL: RECORD WASTAGE */}
 {showWastageModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Record Wastage / Spoilage</h3>
<button onClick={() =>setShowWastageModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleRecordWastage}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Ingredient:<strong>{wastageForm.itemName}</strong></label>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Quantity Wasted *</label>
<input type="number" required min="1" value={wastageForm.quantityWasted} onChange={(e) =>setWastageForm({ ...wastageForm, quantityWasted: Number(e.target.value) })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Wastage Type *</label>
<select value={wastageForm.type} onChange={(e) =>setWastageForm({ ...wastageForm, type: e.target.value })} className="form-input">
<option value="Wastage">Spoiled / Expired (Wastage)</option>
<option value="Damaged">Damaged / Dropped (Damaged)</option>
</select>
</div>
</div>
<div className="form-group">
<label className="form-label">Reason / Notes *</label>
<input type="text" required value={wastageForm.reason} onChange={(e) =>setWastageForm({ ...wastageForm, reason: e.target.value })} className="form-input" placeholder="e.g. Power outage defrosted, dropped tray" />
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowWastageModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Entry</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 3: EDIT STAFF MEMBER */}
 {showEditStaffModal && editingStaff &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Staff Member</h3>
<button onClick={() =>{setShowEditStaffModal(false);setEditingStaff(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditStaff}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Full Name *</label>
<input type="text" required value={editingStaff.name} onChange={(e) =>setEditingStaff({ ...editingStaff, name: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Email Address (Optional)</label>
<input type="email" value={editingStaff.email || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, email: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Phone Number *</label>
<input type="text" required value={editingStaff.phone} onChange={(e) =>setEditingStaff({ ...editingStaff, phone: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Assigned Branch *</label>
<select value={editingStaff.assignedBranch || ''} onChange={(e) =>setEditingStaff({ ...editingStaff, assignedBranch: e.target.value })} className="form-input" required>
<option value="">-- Choose Branch --</option>
 {branches.map((b) =>
<option key={b.branchId} value={b.branchId}>{b.branchName}</option>
)}
</select>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Staff Role *</label>
<select value={editingStaff.staffRole ? editingStaff.staffRole.toLowerCase() : ''} onChange={(e) =>setEditingStaff({ ...editingStaff, staffRole: e.target.value })} className="form-input">
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
<select value={editingStaff.isActive ? 'true' : 'false'} onChange={(e) =>setEditingStaff({ ...editingStaff, isActive: e.target.value === 'true' })} className="form-input">
<option value="true">Active</option>
<option value="false">Inactive</option>
</select>
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditStaffModal(false);setEditingStaff(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 4: ADD BRANCH */}
 {showAddBranchModal &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title">Add New Branch</h3>
<button onClick={() =>setShowAddBranchModal(false)} className="modal-close">&times;</button>
</div>
<form onSubmit={handleAddBranch}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Branch Name *</label>
<input type="text" required value={newBranch.branchName} onChange={(e) =>setNewBranch({ ...newBranch, branchName: e.target.value })} className="form-input" placeholder="e.g. Uptown Branch" />
</div>
<div className="form-group">
<label className="form-label">Branch Address *</label>
<input type="text" required value={newBranch.address} onChange={(e) =>setNewBranch({ ...newBranch, address: e.target.value })} className="form-input" placeholder="123 Main Street" />
</div>
<div className="form-group">
<label className="form-label">Manager Name</label>
<input type="text" value={newBranch.manager} onChange={(e) =>setNewBranch({ ...newBranch, manager: e.target.value })} className="form-input" placeholder="Manager full name" />
</div>
<div className="form-group" style={{ marginBottom: '10px' }}>
<button
 type="button"
 onClick={() =>handleDetectLocation('new')}
 disabled={detectingLocation}
 style={{
 width: '100%',
 padding: '10px 14px',
 background: 'transparent',
 border: '1px dashed #ff6b08',
 borderRadius: '8px',
 color: '#ff6b08',
 cursor: detectingLocation ? 'wait' : 'pointer',
 fontWeight: 'bold',
 fontSize: '13px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px',
 transition: 'all 0.2s'
 }}
 onMouseOver={(e) =>{
 if (!detectingLocation) {
 e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)';
 }
 }}
 onMouseOut={(e) =>{
 e.currentTarget.style.background = 'transparent';
 }}>
 
 {detectingLocation ? ' Detecting current location...' : ' Use Current Location'}
</button>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Latitude *</label>
<input type="number" step="0.000001" required value={newBranch.latitude} onChange={(e) =>setNewBranch({ ...newBranch, latitude: e.target.value })} className="form-input" placeholder="e.g. 16.5062" />
</div>
<div className="form-group">
<label className="form-label">Longitude *</label>
<input type="number" step="0.000001" required value={newBranch.longitude} onChange={(e) =>setNewBranch({ ...newBranch, longitude: e.target.value })} className="form-input" placeholder="e.g. 80.6480" />
</div>
</div>
<div className="form-group">
<label className="form-label">Allowed Geofence Radius *</label>
<select value={newBranch.allowedRadius} onChange={(e) =>setNewBranch({ ...newBranch, allowedRadius: Number(e.target.value) })} className="form-input" required>
<option value={20}>20 meters</option>
<option value={30}>30 meters (Default)</option>
<option value={50}>50 meters</option>
<option value={100}>100 meters</option>
</select>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>setShowAddBranchModal(false)} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Create Branch</button>
</div>
</form>
</div>
</div>
 }

 {/* MODAL 5: EDIT BRANCH */}
 {showEditBranchModal && editingBranch &&
<div className="modal-overlay">
<div className="modal-container">
<div className="modal-header">
<h3 className="modal-title"> Edit Branch Location</h3>
<button onClick={() =>{setShowEditBranchModal(false);setEditingBranch(null);}} className="modal-close">&times;</button>
</div>
<form onSubmit={handleEditBranch}>
<div className="modal-body">
<div className="form-group">
<label className="form-label">Branch Name *</label>
<input type="text" required value={editingBranch.branchName} onChange={(e) =>setEditingBranch({ ...editingBranch, branchName: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Branch Address *</label>
<input type="text" required value={editingBranch.address} onChange={(e) =>setEditingBranch({ ...editingBranch, address: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Manager Name</label>
<input type="text" value={editingBranch.manager || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, manager: e.target.value })} className="form-input" />
</div>
<div className="form-group" style={{ marginBottom: '10px' }}>
<button
 type="button"
 onClick={() =>handleDetectLocation('edit')}
 disabled={detectingLocation}
 style={{
 width: '100%',
 padding: '10px 14px',
 background: 'transparent',
 border: '1px dashed #ff6b08',
 borderRadius: '8px',
 color: '#ff6b08',
 cursor: detectingLocation ? 'wait' : 'pointer',
 fontWeight: 'bold',
 fontSize: '13px',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '8px',
 transition: 'all 0.2s'
 }}
 onMouseOver={(e) =>{
 if (!detectingLocation) {
 e.currentTarget.style.background = 'rgba(255, 107, 8, 0.08)';
 }
 }}
 onMouseOut={(e) =>{
 e.currentTarget.style.background = 'transparent';
 }}>
 
 {detectingLocation ? ' Detecting current location...' : ' Use Current Location'}
</button>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Latitude *</label>
<input type="number" step="0.000001" required value={editingBranch.latitude || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, latitude: e.target.value })} className="form-input" />
</div>
<div className="form-group">
<label className="form-label">Longitude *</label>
<input type="number" step="0.000001" required value={editingBranch.longitude || ''} onChange={(e) =>setEditingBranch({ ...editingBranch, longitude: e.target.value })} className="form-input" />
</div>
</div>
<div className="form-row">
<div className="form-group">
<label className="form-label">Allowed Geofence Radius *</label>
<select value={editingBranch.allowedRadius || 30} onChange={(e) =>setEditingBranch({ ...editingBranch, allowedRadius: Number(e.target.value) })} className="form-input" required>
<option value={20}>20 meters</option>
<option value={30}>30 meters</option>
<option value={50}>50 meters</option>
<option value={100}>100 meters</option>
</select>
</div>
<div className="form-group">
<label className="form-label">Status *</label>
<select value={editingBranch.isActive ? 'true' : 'false'} onChange={(e) =>setEditingBranch({ ...editingBranch, isActive: e.target.value === 'true' })} className="form-input" required>
<option value="true">Active</option>
<option value="false">Inactive</option>
</select>
</div>
</div>
</div>
<div className="modal-footer">
<button type="button" onClick={() =>{setShowEditBranchModal(false);setEditingBranch(null);}} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }}>Cancel</button>
<button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Save Changes</button>
</div>
</form>
</div>
</div>
 }

 {selectedReport &&
<div className="modal-overlay">
<div className="modal-container" style={{ maxWidth: '800px', width: '90%' }}>
<div className="modal-header">
<h3 className="modal-title">Work Report - {selectedReport.staffName}</h3>
<button onClick={() =>setSelectedReport(null)} className="modal-close">&times;</button>
</div>
<div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
 {/* Meta details */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', background: 'rgba(0, 0, 0,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '20px' }}>
<div>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Staff Member</span>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedReport.staffName}</strong>
</div>
<div>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Assigned Branch</span>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{selectedReport.branchName}</strong>
</div>
<div>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Submitted Time</span>
<strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
 {new Date(selectedReport.createdAt).toLocaleDateString()} at {new Date(selectedReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
</strong>
</div>
</div>

 {/* Notes */}
<div style={{ marginBottom: '24px' }}>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 700 }}>Description / Notes:</h4>
<p style={{
 backgroundColor: 'var(--bg-secondary)',
 padding: '12px 16px',
 borderRadius: '8px',
 border: '1px solid var(--color-border)',
 color: 'var(--color-text-primary)',
 fontSize: '0.9rem',
 margin: 0,
 whiteSpace: 'pre-wrap',
 lineHeight: '1.5'
 }}>
 {selectedReport.notes || 'No description notes provided for this report.'}
</p>
</div>

 {/* Photos Grid */}
<div>
<h4 style={{ color: 'var(--color-text-primary)', fontSize: '0.9rem', marginBottom: '12px', fontWeight: 700 }}>
  Photo Gallery ({selectedReport.photos.length} photos)
</h4>
<div style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
 gap: '15px'
 }}>
 {selectedReport.photos.map((photo, idx) =>
<div key={idx} style={{
 borderRadius: '8px',
 overflow: 'hidden',
 border: '1px solid var(--color-border)',
 height: '180px',
 background: '#000',
 cursor: 'zoom-in',
 position: 'relative'
 }}
 onClick={() =>window.open(getAssetUrl(photo), '_blank')}>
 
<img
 src={getAssetUrl(photo)}
 alt={`Report ${idx + 1}`}
 style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
 onMouseEnter={(e) =>{e.currentTarget.style.transform = 'scale(1.05)';}}
 onMouseLeave={(e) =>{e.currentTarget.style.transform = 'scale(1)';}} />
 
<div style={{
 position: 'absolute',
 bottom: '6px',
 right: '6px',
 background: 'rgba(0,0,0,0.6)',
 color: 'var(--color-text-primary)',
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '10px',
 pointerEvents: 'none'
 }}>
 #{idx + 1}
</div>
</div>
)}
</div>
</div>
</div>
<div className="modal-footer" style={{ borderTop: '1px solid rgba(0, 0, 0,0.06)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
 Automatically purged after 24 hours.
</span>
<button
 type="button"
 onClick={() =>setSelectedReport(null)}
 className="btn btn-secondary"
 style={{ width: 'auto', padding: '8px 18px' }}>
 
 Close
</button>
</div>
</div>
</div>
 }

</div>
</OwnerLayout>);

};

export default OwnerDashboard;