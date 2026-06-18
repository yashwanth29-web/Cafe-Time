import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMenu, getBranches, placeOrder } from '../services/api';
import { toast } from '../components/Toast';
import '../styles/App.css';

const ManualOrderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form States
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Pending');
  const [orderSource, setOrderSource] = useState('MANUAL');
  const [selectedBranch, setSelectedBranch] = useState(user?.assignedBranch || '');

  // Menu & Branches States
  const [menuItems, setMenuItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  
  // Cart/Selected Items State
  const [cart, setCart] = useState({}); // { [itemId]: { item, quantity } }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch menu and branch details
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const menuRes = await getMenu();
        if (menuRes.success) {
          setMenuItems(menuRes.data);
          // Extract unique categories
          const cats = ['All', ...new Set(menuRes.data.map(item => item.category))];
          setCategories(cats);
        }

        // Only load branches if user has owner/manager level access to select branch
        if (['admin', 'owner', 'manager'].includes(user?.role?.toLowerCase())) {
          const branchRes = await getBranches();
          if (branchRes.success) {
            const branchList = branchRes.branches || [];
            setBranches(branchList);
            if (branchList.length > 0 && !selectedBranch) {
              setSelectedBranch(branchList[0].branchId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load manual order form data:', err);
        toast.error('Failed to load menu data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, selectedBranch]);

  // Adjust table requirement based on order source
  useEffect(() => {
    if (orderSource === 'TAKEAWAY') {
      setTableNumber('Takeaway');
    } else if (orderSource === 'WALK_IN') {
      setTableNumber('Walk-in');
    } else if (tableNumber === 'Takeaway' || tableNumber === 'Walk-in') {
      setTableNumber('');
    }
  }, [orderSource]);

  // Add/remove item helpers
  const updateQuantity = (item, delta) => {
    const itemId = item.id || item._id;
    setCart((prev) => {
      const updated = { ...prev };
      const currentQty = updated[itemId]?.quantity || 0;
      const newQty = currentQty + delta;
      
      if (newQty <= 0) {
        delete updated[itemId];
      } else {
        updated[itemId] = { item, quantity: newQty };
      }
      return updated;
    });
  };

  // Calculations
  const cartItems = Object.values(cart);
  const totalBill = cartItems.reduce((sum, item) => sum + item.item.price * item.quantity, 0);

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast.info('Please select at least one menu item.');
      return;
    }

    if (!tableNumber) {
      toast.info('Please specify a Table Number or select Takeaway/Walk-in.');
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        tableNumber,
        items: cartItems.map(c => ({
          id: c.item.id || c.item._id,
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity
        })),
        totalAmount: totalBill,
        subtotal: totalBill,
        tax: 0,
        grandTotal: totalBill,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        specialInstructions: specialNotes.trim(),
        paymentMethod,
        paymentStatus: paymentMethod === 'Pending' ? 'Pending' : 'Paid',
        orderSource,
        branchId: selectedBranch || user?.assignedBranch || 'CD001-B01',
        cafeId: user?.cafeId || 'CD001',
        createdBy: user?.name || 'Staff',
        createdByRole: user?.role || 'staff'
      };

      const response = await placeOrder(orderPayload);
      if (response.success) {
        toast.success('Order Created Successfully! Kitchen Notified.');
        // Clear state
        setCart({});
        setTableNumber('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setSpecialNotes('');
        setPaymentMethod('Pending');
        setOrderSource('MANUAL');
        
        // Redirect based on role to let them see active pipeline
        if (['admin', 'owner'].includes(user?.role?.toLowerCase())) {
          navigate('/owner/dashboard');
        } else {
          navigate('/waiter/dashboard');
        }
      } else {
        toast.error(response.message || 'Failed to place order.');
      }
    } catch (err) {
      console.error('Manual order submission failed:', err);
      toast.error(err.response?.data?.message || 'Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Menu Items
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ color: 'var(--color-text-primary)', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
            📝 Manual Order Entry
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Enter orders verbally taken from walk-in, takeaway, or phone call customers.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div className="spinner" style={{ margin: '0 auto 15px auto', borderColor: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading catalog data...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="manual-order-form-grid">
          
          {/* Left Column: Menu Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Search & Category Filter */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search dishes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="manual-order-search-input"
                />
              </div>

              {/* Category Pills */}
              <div className="manual-order-categories">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: '1px solid var(--color-border)',
                      background: selectedCategory === cat ? 'var(--color-primary)' : 'rgba(0,0,0,0.1)',
                      color: selectedCategory === cat ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items List */}
            <div className="manual-order-menu-items-grid">
              {filteredMenuItems.map((item) => {
                const itemId = item.id || item._id;
                const qty = cart[itemId]?.quantity || 0;
                return (
                  <div
                    key={itemId}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: item.available ? 1 : 0.6
                    }}
                  >
                    <div>
                      <span style={{
                        fontSize: '10px',
                        background: 'rgba(255, 107, 8, 0.15)',
                        color: 'var(--color-primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {item.category}
                      </span>
                      <h4 style={{ margin: '8px 0 4px 0', fontSize: '1rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>{item.name}</h4>
                      <p style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0', minHeight: '36px' }}>{item.description || 'No description available'}</p>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: '12px',
                      marginTop: '8px'
                    }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem' }}>₹{item.price.toFixed(2)}</span>
                      
                      {!item.available ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 'bold' }}>Out of Stock</span>
                      ) : qty > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, -1)}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.15)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                          >-</button>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-primary)', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, 1)}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.15)', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                          >+</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateQuantity(item, 1)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Order Configuration Summary */}
          <div className="manual-order-cart-panel">
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary)', fontWeight: 800 }}>
                🛒 Order Configuration
              </h3>

              {/* Order Info Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Order Type *</label>
                  <select
                    value={orderSource}
                    onChange={(e) => setOrderSource(e.target.value)}
                    className="form-input"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  >
                    <option value="MANUAL">Manual Dine-in</option>
                    <option value="TAKEAWAY">Takeaway</option>
                    <option value="WALK_IN">Walk-in</option>
                    <option value="DINE_IN">Dine-in</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Table Number / Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Table 5, Counter 1"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    disabled={orderSource === 'TAKEAWAY' || orderSource === 'WALK_IN'}
                    className="form-input"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  />
                </div>

                {/* Branch Selection (Owner/Manager role permission) */}
                {['admin', 'owner', 'manager'].includes(user?.role?.toLowerCase()) && branches.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label">Branch *</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(0,0,0,0.15)' }}
                    >
                      {branches.map(b => (
                        <option key={b.branchId} value={b.branchId}>{b.branchName}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Name (Optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="form-input"
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="Phone (Optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(0,0,0,0.15)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      placeholder="Email (Optional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(0,0,0,0.15)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Special Notes / Requests</label>
                  <textarea
                    placeholder="e.g. Extra spicy, no onions, sugar free..."
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    className="form-input"
                    rows={2}
                    style={{ background: 'rgba(0,0,0,0.15)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Payment Method *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {['Pending', 'Cash', 'UPI', 'Card'].map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          background: paymentMethod === method ? 'var(--color-primary)' : 'rgba(0,0,0,0.1)',
                          color: paymentMethod === method ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'all 0.2s'
                        }}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bill items review list */}
              {cartItems.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '16px',
                  marginTop: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Itemized Listing</span>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {cartItems.map((cartItem) => (
                      <div key={cartItem.item.id || cartItem.item._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        <span>
                          <strong>{cartItem.quantity}x</strong> {cartItem.item.name}
                        </span>
                        <span>₹{(cartItem.item.price * cartItem.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total amount summary & place order button */}
              <div style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>Estimated Total</span>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2ecc71' }}>₹{totalBill.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setCart({}); navigate(-1); }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '12px', background: '#27AE60', borderColor: '#27AE60' }}
                  disabled={submitting}
                >
                  {submitting ? 'Placing Order...' : '🚀 Place Order'}
                </button>
              </div>
            </div>
          </div>
          
        </form>
      )}
    </div>
  );
};

export default ManualOrderPage;
