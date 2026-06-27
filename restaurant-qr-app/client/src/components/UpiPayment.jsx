import React, { useState } from 'react';
import { createPaymentOrder, verifyPayment, payExistingOrder } from '../services/api';

const UpiPayment = ({
  cart,
  tableNumber,
  customerDetails,
  specialInstructions = '',
  onPaymentSuccess,
  onPaymentError,
  isDisabled,
  existingOrderId,
  cafeId,
  buttonText = 'Pay & Place Order'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [paymentData, setPaymentData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initPayment = async () => {
    const { name, email, phone } = customerDetails;
    if (!name || !phone) {
      alert('Please fill in your name and contact number before proceeding.');
      return;
    }

    setLoading(true);
    setProcessingStatus('Initializing order details...');

    try {
      let orderData;
      if (existingOrderId) {
        orderData = await payExistingOrder({ appOrderId: existingOrderId });
      } else {
        const payload = {
          items: cart.map((cartItem) => ({
            id: cartItem.item.id || cartItem.item._id,
            name: cartItem.item.name,
            price: cartItem.item.price,
            quantity: cartItem.quantity
          })),
          tableNumber: tableNumber || 'Takeaway',
          customerName: name,
          customerEmail: email || 'customer@example.com',
          customerPhone: phone,
          cafeId: cafeId || 'CD001',
          specialInstructions: specialInstructions
        };
        orderData = await createPaymentOrder(payload);
      }

      if (orderData.success) {
        setPaymentData(orderData);
        setIsOpen(true);
      } else {
        throw new Error(orderData.message || 'Failed to initialize payment info.');
      }
    } catch (error) {
      console.error('UPI initialization failed:', error);
      const errMsg = error.response?.data?.message || error.message || 'Payment initialization error';
      if (onPaymentError) onPaymentError(errMsg);
      alert(`Error: ${errMsg}`);
    } finally {
      setLoading(false);
      setProcessingStatus('');
    }
  };

  const handleCopy = () => {
    if (paymentData?.upiId) {
      navigator.clipboard.writeText(paymentData.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmitTxn = async (e) => {
    e.preventDefault();
    if (!upiTxnId.trim()) {
      alert('Please enter your 12-digit UPI Transaction ID (UTR).');
      return;
    }
    if (upiTxnId.trim().length < 6) {
      alert('Please enter a valid Transaction ID.');
      return;
    }

    setSubmitting(true);
    setProcessingStatus('Verifying transaction...');

    try {
      const verificationPayload = {
        appOrderId: paymentData.appOrderId,
        razorpayOrderId: paymentData.razorpayOrderId,
        razorpayPaymentId: upiTxnId.trim()
      };

      const verificationResult = await verifyPayment(verificationPayload);

      if (verificationResult.success) {
        setIsOpen(false);
        if (onPaymentSuccess) {
          onPaymentSuccess(verificationResult.data);
        }
      } else {
        throw new Error(verificationResult.message || 'Payment verification failed.');
      }
    } catch (verifyError) {
      console.error('Verification failed:', verifyError);
      const errMsg = verifyError.response?.data?.message || verifyError.message || 'Verification failed';
      alert(`Verification Error: ${errMsg}`);
      if (onPaymentError) onPaymentError(errMsg);
    } finally {
      setSubmitting(false);
      setProcessingStatus('');
    }
  };



  // Generate default UPI URL for QR code
  const upiUrl = paymentData
    ? `upi://pay?pa=${paymentData.upiId}&pn=${encodeURIComponent(
        paymentData.merchantName || 'Cafe'
      )}&am=${paymentData.amount}&cu=INR`
    : '';

  // QR Code URL using public server API
  const qrCodeUrl = paymentData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`
    : '';

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={initPayment}
        disabled={isDisabled || loading}
        className={`btn btn-checkout-rzp ${isDisabled || loading ? 'btn-disabled' : ''}`}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 20px',
          fontSize: '16px',
          fontWeight: '800',
          borderRadius: '12px',
          border: 'none',
          cursor: isDisabled || loading ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)',
          color: '#ffffff',
          boxShadow: '0 6px 20px rgba(170, 130, 10, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {loading ? (
          <>
            <span
              className="spinner-rzp"
              style={{
                width: '20px',
                height: '20px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTop: '3px solid #ffffff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block'
              }}
            ></span>
            <span>{processingStatus || 'Initializing...'}</span>
          </>
        ) : (
          <>
            <span>📱</span>
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {/* UPI Payment Modal */}
      {isOpen && paymentData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              backgroundColor: '#1E140F',
              border: '2px solid #6F4E37',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              color: '#F5EBE6',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              position: 'relative',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#A0826C',
                fontSize: '20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>

            <h3
              style={{
                textAlign: 'center',
                margin: '0 0 16px 0',
                color: '#d4af37',
                fontSize: '18px',
                fontWeight: '800'
              }}
            >
              UPI Online Payment
            </h3>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#A0826C' }}>Payable Amount</p>
              <h2 style={{ margin: 0, color: '#F5EBE6', fontSize: '32px', fontWeight: '800' }}>
                ₹{paymentData.amount.toFixed(2)}
              </h2>
            </div>

            {/* QR Code Container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                margin: '0 auto 20px auto',
                width: 'fit-content'
              }}
            >
              <img src={qrCodeUrl} alt="UPI QR Code" style={{ width: '200px', height: '200px' }} />
              <p
                style={{
                  color: '#33271C',
                  fontSize: '11px',
                  fontWeight: '700',
                  margin: '8px 0 0 0',
                  textAlign: 'center'
                }}
              >
                Scan using any UPI App
              </p>
            </div>

            {/* Payee Info */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '20px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#A0826C' }}>Merchant:</span>
                <span style={{ fontWeight: 'bold' }}>{paymentData.merchantName || 'Cafe'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#A0826C' }}>UPI ID:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'mono', color: '#d4af37' }}>{paymentData.upiId}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: '#6F4E37',
                      border: 'none',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>



            {/* UTR Reference ID Form */}
            <form onSubmit={handleSubmitTxn}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <label
                  htmlFor="upi-utr"
                  style={{ fontSize: '12px', color: '#A0826C', fontWeight: 'bold', textTransform: 'uppercase' }}
                >
                  Enter UPI Transaction ID (12-digit UTR) *
                </label>
                <input
                  id="upi-utr"
                  type="text"
                  placeholder="e.g. 345678901234"
                  value={upiTxnId}
                  onChange={(e) => setUpiTxnId(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                  disabled={submitting}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid #6F4E37',
                    borderRadius: '10px',
                    padding: '12px',
                    color: '#F5EBE6',
                    fontSize: '14px',
                    outline: 'none',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    letterSpacing: '1px'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  background: '#27AE60',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {submitting ? (
                  <>
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '2px solid #ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        display: 'inline-block'
                      }}
                    ></span>
                    <span>Submitting UTR...</span>
                  </>
                ) : (
                  'Confirm & Submit UTR'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpiPayment;
