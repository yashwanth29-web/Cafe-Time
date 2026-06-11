const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

async function run() {
  const secret = process.env.JWT_SECRET || 'super_secret_cafe_key_12345';
  
  // Admin User details
  const payload = {
    id: '6a26f1e88af328b3b5bae2b8'
  };

  const token = jwt.sign(payload, secret, { expiresIn: '1d' });
  console.log('Generated Token:', token);

  try {
    const res = await axios.patch('http://localhost:5000/api/orders/6a2a632505afed0ff9b8a2b8', {
      paymentMethod: 'Counter'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Success:', res.status, res.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Data:', error.response.data);
    } else {
      console.error('Network/Other Error:', error.message);
    }
  }
}

run();
