const jwt = require('jsonwebtoken');
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
require('dotenv').config();

async function verify() {
  const secret = process.env.JWT_SECRET || 'super_secret_cafe_key_12345';
  
  // 1. Create a token for a chef (role: 'chef')
  const payload = {
    id: '6a3019e40ff534755ac2bb3e',
    role: 'chef',
    cafeId: 'CD001'
  };
  const token = jwt.sign(payload, secret, { expiresIn: '1d' });
  console.log('Chef token successfully generated.');

  try {
    // 2. Place a test order via the public POST /api/orders endpoint
    console.log('Placing a test order with item images...');
    const orderRes = await axios.post('http://localhost:5000/api/orders', {
      tableNumber: '12',
      totalAmount: 110,
      customerName: 'Test Image Customer',
      customerPhone: '8888888888',
      items: [
        {
          id: 'item_1',
          name: 'Classic Coffee',
          price: 30,
          quantity: 2,
          image: '/images/default-food.png'
        },
        {
          id: 'item_2',
          name: 'Vanilla Milkshake',
          price: 50,
          quantity: 1,
          image: '/images/default-food.png'
        }
      ]
    });

    if (orderRes.data && orderRes.data.success) {
      const placedOrder = orderRes.data.data;
      console.log(`Order placed successfully with ID: ${placedOrder._id}`);
      
      // Verify stored fields in response
      console.log('Verifying order items from placement response:');
      placedOrder.items.forEach(item => {
        console.log(`- Item: ${item.name}, Image: ${item.image}`);
        if (!item.image) {
          throw new Error(`Item ${item.name} is missing the image field!`);
        }
      });
      
      // 3. Fetch all orders as a chef to verify access and image presence
      console.log('Fetching orders via GET /api/orders as chef...');
      const fetchRes = await axios.get('http://localhost:5000/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (fetchRes.data && fetchRes.data.success) {
        const matchingOrder = fetchRes.data.data.find(o => o._id === placedOrder._id);
        if (matchingOrder) {
          console.log('Found placed order in chef orders list feed.');
          matchingOrder.items.forEach(item => {
            console.log(`- Item: ${item.name}, Image stored in DB: ${item.image}`);
            if (item.image !== '/images/default-food.png') {
              throw new Error(`Item ${item.name} image mismatch in database!`);
            }
          });
          console.log('✅ PERSISTENCE & API TEST SUCCESS: Order item images successfully stored and retrieved!');
        } else {
          throw new Error('Placed order not found in chef orders list feed!');
        }
      } else {
        throw new Error('Failed to fetch chef orders list feed.');
      }

      // Cleanup test order from DB
      await mongoose.connect(process.env.MONGO_URI);
      await Order.findByIdAndDelete(placedOrder._id);
      console.log('Cleaned up test order from database.');
      await mongoose.connection.close();
    } else {
      throw new Error('Failed to place test order.');
    }
  } catch (error) {
    if (error.response) {
      console.error('API Error Status:', error.response.status);
      console.error('API Error Data:', error.response.data);
    } else {
      console.error('Verification Error:', error.message);
    }
    process.exit(1);
  }
}

verify();
