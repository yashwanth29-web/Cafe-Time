import React, { useState, useEffect } from 'react';
import { createPaymentOrder, verifyPayment, payExistingOrder } from '../services/api';

const RazorpayPayment = ({
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
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // Dynamically load Razorpay checkout script
  useEffect(() => {
    const loadScript = () => {
      if (window.Razorpay) {
        setScriptLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setScriptLoaded(true);
        console.log('Razorpay Checkout SDK loaded successfully.');
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay Checkout SDK.');
      };
      document.body.appendChild(script);
    };

    loadScript();
  }, []);

  const handlePayment = async () => {
    if (!scriptLoaded) {
      alert('Razorpay Checkout SDK is still loading. Please try again in a moment.');
      return;
    }

    const { name, email, phone } = customerDetails;
    if (!name || !phone) {
      alert('Please fill in your name and contact number before proceeding.');
      return;
    }

    setLoading(true);
    setProcessingStatus('Initiating transaction...');

    try {
      let orderData;
      if (existingOrderId) {
        // Pay for an existing order in the database
        orderData = await payExistingOrder({ appOrderId: existingOrderId });
      } else {
        // Create a new order during checkout
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

      if (!orderData.success) {
        throw new Error(orderData.message || 'Failed to initiate order payment on server.');
      }

      setProcessingStatus('Opening secure gateway...');

      // 2. Configure and Open Razorpay Checkout Modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise
        currency: orderData.currency,
        name: 'CoffeeDay Cafe',
        description: `Cafe Order for Table ${tableNumber || 'Takeaway'}`,
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&auto=format&fit=crop&q=60', // beautiful cafe logo icon
        order_id: orderData.razorpayOrderId,
        handler: async function (response) {
          // Payment successful inside checkout modal
          setProcessingStatus('Verifying payment signature...');

          try {
            const verificationPayload = {
              appOrderId: orderData.appOrderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            };

            const verificationResult = await verifyPayment(verificationPayload);

            if (verificationResult.success) {
              setProcessingStatus('Success!');
              if (onPaymentSuccess) {
                onPaymentSuccess(verificationResult.data);
              }
            } else {
              throw new Error(verificationResult.message || 'Signature verification failed.');
            }
          } catch (verifyError) {
            console.error('Verification request failed:', verifyError);
            const errMsg = verifyError.response?.data?.message || verifyError.message || 'Signature verification error';
            if (onPaymentError) onPaymentError(errMsg);
          } finally {
            setLoading(false);
            setProcessingStatus('');
          }
        },
        prefill: {
          name: name,
          email: email || 'customer@example.com',
          contact: phone
        },
        readonly: {
          contact: false,
          email: false,
          name: false
        },
        notes: {
          appOrderId: orderData.appOrderId
        },
        theme: {
          color: '#d4af37' // premium elegant cafe gold color
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setProcessingStatus('');
            if (onPaymentError) {
              onPaymentError('Payment window was closed by the user.');
            }
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();

    } catch (error) {
      console.error('Razorpay payment initialization flow failed:', error);
      const errMsg = error.response?.data?.message || error.message || 'Payment initiation error';
      if (onPaymentError) onPaymentError(errMsg);
      setLoading(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="payment-checkout-container" style={{ width: '100%' }}>
      <button
        type="button"
        onClick={handlePayment}
        disabled={isDisabled || loading || !scriptLoaded}
        className={`btn btn-checkout-rzp ${isDisabled || loading || !scriptLoaded ? 'btn-disabled' : ''}`}
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
          cursor: isDisabled || loading || !scriptLoaded ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)',
          color: 'var(--color-text-primary)',
          boxShadow: '0 6px 20px rgba(170, 130, 10, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
        
        {loading ?
        <>
            <span className="spinner-rzp" style={{
            width: '20px',
            height: '20px',
            border: '3px solid rgba(0, 0, 0,0.3)',
            borderTop: '3px solid #ffffff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block'
          }}></span>
            <span>{processingStatus || 'Processing...'}</span>
          </> :

        <>
            <span>💳</span>
            <span>{buttonText}</span>
          </>
        }
      </button>
      
      {!scriptLoaded &&
      <p style={{
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        marginTop: '6px'
      }}>
          Loading secure Razorpay SDK...
        </p>
      }
    </div>);

};

export default RazorpayPayment;