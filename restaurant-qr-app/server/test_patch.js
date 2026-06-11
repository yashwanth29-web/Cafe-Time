const axios = require('axios');

async function run() {
  try {
    const res = await axios.patch('http://localhost:5000/api/orders/6a2a632505afed0ff9b8a2b8', {
      paymentMethod: 'Counter'
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
