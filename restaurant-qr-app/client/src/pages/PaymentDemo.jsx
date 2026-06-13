import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import RazorpayPayment from '../components/RazorpayPayment';

const PaymentDemo = () => {
  const [customerDetails, setCustomerDetails] = useState({
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    phone: '9876543210'
  });

  const [paymentStatus, setPaymentStatus] = useState(null); // 'success' | 'failed' | null
  const [createdOrder, setCreatedOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Sample order data requested: Coffee = ₹50, Burger = ₹120, Sandwich = ₹80. Total = ₹250.
  const demoCart = [
  {
    item: {
      id: 'demo_coffee_01',
      name: 'Filter Coffee',
      price: 50
    },
    quantity: 1
  },
  {
    item: {
      id: 'demo_burger_02',
      name: 'Cheese Burger',
      price: 120
    },
    quantity: 1
  },
  {
    item: {
      id: 'demo_sandwich_03',
      name: 'Veg Club Sandwich',
      price: 80
    },
    quantity: 1
  }];


  const totalAmount = demoCart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomerDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentSuccess = (order) => {
    setPaymentStatus('success');
    setCreatedOrder(order);
    setErrorMessage('');
  };

  const handlePaymentError = (errorMsg) => {
    setPaymentStatus('failed');
    setErrorMessage(errorMsg);
  };

  return (
    <div className="payment-demo-container" style={{
      maxWidth: '900px',
      margin: '40px auto',
      padding: '0 20px',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span style={{
          background: 'rgba(212, 175, 55, 0.1)',
          color: '#d4af37',
          padding: '6px 16px',
          borderRadius: '50px',
          fontSize: '13px',
          fontWeight: '700',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          border: '1px solid rgba(212, 175, 55, 0.2)'
        }}>Sandbox Integration</span>
        <h1 style={{
          fontSize: '36px',
          fontWeight: '900',
          marginTop: '12px',
          background: 'linear-gradient(135deg, #ffffff 0%, #a5a5a5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>Razorpay Payment Demo</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
          Test the end-to-end checkout flow using Razorpay Sandbox Mode.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px',
        alignItems: 'start'
      }}>
        
        {/* Left Side: Instructions and Customer Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Customer Details Card */}
          <div className="summary-card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border)',
            padding: '24px',
            borderRadius: '16px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: 'var(--color-text-primary)' }}>
              👤 Customer Information
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '700' }}>FULL NAME</label>
                <input
                  type="text"
                  name="name"
                  value={customerDetails.name}
                  onChange={handleInputChange}
                  placeholder="Enter name"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0, 0, 0,0.05)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px'
                  }} />
                
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '700' }}>EMAIL ADDRESS</label>
                <input
                  type="email"
                  name="email"
                  value={customerDetails.email}
                  onChange={handleInputChange}
                  placeholder="Enter email"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0, 0, 0,0.05)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px'
                  }} />
                
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '700' }}>CONTACT PHONE</label>
                <input
                  type="text"
                  name="phone"
                  value={customerDetails.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'rgba(0, 0, 0,0.05)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '14px'
                  }} />
                
              </div>
            </div>
          </div>

          {/* Test Instructions Card */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.02)',
            border: '1px dashed var(--color-border)',
            padding: '24px',
            borderRadius: '16px',
            fontSize: '13px',
            lineHeight: '1.6'
          }}>
            <h4 style={{ color: 'var(--color-text-primary)', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              💡 Testing Sandbox Instructions
            </h4>
            <ul style={{ paddingLeft: '18px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>When the Checkout opens, select <strong>Netbanking</strong> ➔ choose any bank (e.g. SBI) ➔ click <strong>Pay</strong> ➔ click <strong>Success</strong>.</li>
              <li>Or select <strong>Card</strong> ➔ use Razorpay test card credentials (available on Razorpay docs) ➔ Enter dummy OTP (e.g. 123456).</li>
              <li>To test a failed flow: click the close icon in the Razorpay modal, or select Netbanking ➔ choose <strong>Failure</strong> on the test page.</li>
              <li><strong>Verify Records:</strong> Log in to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" style={{ color: '#d4af37', textDecoration: 'underline' }}>Razorpay Dashboard</a>. Toggle to <strong>Test Mode</strong> in the bottom-left sidebar, then click on <strong>Transactions</strong> ➔ <strong>Payments</strong> to find records matching the <code>Payment ID</code>.</li>
            </ul>
          </div>

        </div>

        {/* Right Side: Bill Card & Result Screen */}
        <div>
          {paymentStatus === 'success' && createdOrder ? (
          /* PAYMENT SUCCESS SCREEN */
          <div style={{
            background: 'rgba(27, 77, 62, 0.2)',
            border: '1px solid #1b4d3e',
            padding: '30px',
            borderRadius: '16px',
            textAlign: 'center',
            animation: 'scaleUp 0.3s ease-out'
          }}>
              <div style={{
              width: '60px',
              height: '60px',
              background: '#1b4d3e',
              color: '#85e3b2',
              fontSize: '28px',
              lineHeight: '60px',
              borderRadius: '50%',
              margin: '0 auto 20px auto'
            }}>✅</div>
              
              <h2 style={{ color: '#85e3b2', fontWeight: '900', fontSize: '22px', marginBottom: '8px' }}>
                Payment Successful!
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                The signature was validated by the backend. The order and payment documents have been safely written to MongoDB.
              </p>

              <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'left',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '24px',
              border: '1px solid rgba(0, 0, 0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>MongoDB Order ID:</span>
                  <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', fontWeight: '600' }}>{createdOrder._id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Razorpay Order ID:</span>
                  <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{createdOrder.razorpayOrderId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Razorpay Payment ID:</span>
                  <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{createdOrder.razorpayPaymentId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Total Paid:</span>
                  <span style={{ color: '#d4af37', fontWeight: '800' }}>₹{createdOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Payment Status:</span>
                  <span style={{ color: '#85e3b2', fontWeight: '700' }}>{createdOrder.paymentStatus}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                onClick={() => {
                  setPaymentStatus(null);
                  setCreatedOrder(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}>
                
                  Test Another Payment
                </button>
                <Link
                to="/admin"
                className="btn btn-primary"
                style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                
                  Verify in Dashboard
                </Link>
              </div>
            </div>) :
          paymentStatus === 'failed' ? (
          /* PAYMENT FAILED SCREEN */
          <div style={{
            background: 'rgba(126, 34, 34, 0.2)',
            border: '1px solid #7e2222',
            padding: '30px',
            borderRadius: '16px',
            textAlign: 'center',
            animation: 'scaleUp 0.3s ease-out'
          }}>
              <div style={{
              width: '60px',
              height: '60px',
              background: '#7e2222',
              color: '#f87171',
              fontSize: '28px',
              lineHeight: '60px',
              borderRadius: '50%',
              margin: '0 auto 20px auto'
            }}>❌</div>

              <h2 style={{ color: '#f87171', fontWeight: '900', fontSize: '22px', marginBottom: '8px' }}>
                Payment Failed!
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                Checkout process unsuccessful or signature mismatch validation.
              </p>

              <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '12px 16px',
              borderRadius: '12px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#fff',
              marginBottom: '24px',
              border: '1px solid rgba(0, 0, 0,0.05)'
            }}>
                <strong>Error Details:</strong> {errorMessage}
              </div>

              <button
              onClick={() => {
                setPaymentStatus(null);
                setErrorMessage('');
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}>
              
                Try Again
              </button>
            </div>) : (

          /* INVOICE BILL CARD */
          <div className="cart-summary-card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border)',
            padding: '24px',
            borderRadius: '16px',
            margin: '0'
          }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                🧾 Cafe Invoice Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                {demoCart.map((item) =>
              <div key={item.item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'var(--color-text-primary)', fontWeight: '600', fontSize: '14px' }}>{item.item.name}</div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Qty: {item.quantity}</div>
                    </div>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>₹{item.item.price * item.quantity}</span>
                  </div>
              )}
              </div>

              <div style={{
              borderTop: '1px dashed var(--color-border)',
              borderBottom: '1px dashed var(--color-border)',
              padding: '14px 0',
              margin: '16px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: '700', fontSize: '14px' }}>TOTAL BILL AMOUNT</span>
                <span style={{ color: '#d4af37', fontWeight: '950', fontSize: '20px' }}>₹{totalAmount.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: '24px' }}>
                <RazorpayPayment
                cart={demoCart}
                tableNumber="Demo-Table"
                customerDetails={customerDetails}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError} />
              
              </div>
            </div>)
          }
        </div>

      </div>
    </div>);

};

export default PaymentDemo;