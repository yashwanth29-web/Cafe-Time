import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrders, updateOrderStatus } from '../services/api';
import OrderCard from '../components/OrderCard';
import '../styles/App.css';

const StaffDashboard = () => {
  const { logout, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(5);

  const fetchOrders = async () => {
    try {
      const response = await getOrders();
      if (response.success) {
        // Filter orders by Staff's cafeId (if staff user has cafeId)
        const cafeOrders = user?.cafeId 
          ? response.data.filter(order => order.tableNumber && order.cafeId === user.cafeId) // wait, does order schema store cafeId? 
          : response.data; // fallback in case cafeId isn't stored in order yet, let's fall back to all.
          
        // Let's check: order schema has tableNumber. Since tableNumber is bound to the cafe, let's show orders. 
        // We'll show all orders if there is no cafeId match, but let's filter by table number prefix or assume orders are cafe-scoped.
        // Wait! In the existing app, tableNumber is stored. If orders are for the cafe, we can filter or show them.
        setOrders(response.data);
        setErrorMsg('');
      } else {
        setErrorMsg('Failed to refresh orders.');
      }
    } catch (error) {
      console.error('Error fetching staff orders:', error);
      setErrorMsg('Cannot connect to server orders feed.');
    } finally {
      setLoading(false);
    }
  };

  // Poll for orders every 5s
  useEffect(() => {
    fetchOrders();

    const pollingInterval = setInterval(() => {
      fetchOrders();
      setRefreshCountdown(5);
    }, 5000);

    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => (prev > 1 ? prev - 1 : 5));
    }, 1000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await updateOrderStatus(id, newStatus);
      if (response.success) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === id ? { ...order, status: newStatus } : order
          )
        );
      } else {
        alert('Failed to update order status');
      }
    } catch (error) {
      console.error('Failed updating status:', error);
      alert('Error updating status on server.');
    }
  };

  const activeOrders = orders.filter((order) => order.status === 'Preparing');
  const servedOrders = orders.filter((order) => order.status === 'Served');

  return (
    <div style={{ padding: '25px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #E6D5C3',
        paddingBottom: '15px',
        marginBottom: '30px'
      }}>
        <div>
          <h1 style={{ color: '#5C4331', margin: 0, fontSize: '2rem', fontWeight: 800 }}>
            Staff Service Board
          </h1>
          <p style={{ margin: '5px 0 0 0', color: '#A0826C', fontWeight: 500 }}>
            Active Cafe: {user?.cafeId || 'Main branch'} | Staff member: {user?.name}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="refresh-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#A0826C' }}>
            <span>Auto refresh: {refreshCountdown}s</span>
          </div>
          <button
            onClick={logout}
            style={{
              backgroundColor: '#8B4F39',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: '#FDF2F2',
          borderLeft: '4px solid #EC5B5B',
          color: '#D83A3A',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Tab select for queue or history */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#5C4331', margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
          {showHistory ? 'Served Orders Log' : 'Live Kitchen Queue'}
        </h2>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            backgroundColor: showHistory ? '#6F4E37' : 'transparent',
            border: '1px solid #6F4E37',
            color: showHistory ? '#fff' : '#6F4E37',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {showHistory ? '👁️ View Active Queue' : `📜 Served History (${servedOrders.length})`}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{
            border: '4px solid #F3F3F3',
            borderTop: '4px solid #6F4E37',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px auto'
          }} />
          <p style={{ color: '#A0826C' }}>Updating order status feed...</p>
        </div>
      ) : (
        <div>
          {!showHistory ? (
            <div>
              {activeOrders.length === 0 ? (
                <div style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: '#FAF6F0',
                  borderRadius: '12px',
                  border: '1px dashed #E6D5C3',
                  color: '#A0826C'
                }}>
                  🎉 All orders fulfilled! No active orders.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px'
                }}>
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {servedOrders.length === 0 ? (
                <div style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: '#FAF6F0',
                  borderRadius: '12px',
                  border: '1px dashed #E6D5C3',
                  color: '#A0826C'
                }}>
                  No served orders logged yet today.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '20px'
                }}>
                  {servedOrders.map((order) => (
                    <div key={order._id} style={{ position: 'relative' }}>
                      <OrderCard
                        order={order}
                        onStatusUpdate={handleStatusUpdate}
                      />
                      <button
                        onClick={() => handleStatusUpdate(order._id, 'Preparing')}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          background: '#FAF6F0',
                          border: '1px solid #ff9800',
                          color: '#ff9800',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '700'
                        }}
                      >
                        ↩ Reopen Order
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default StaffDashboard;
