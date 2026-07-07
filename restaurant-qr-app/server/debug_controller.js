const mongoose = require('mongoose');
const { updateMenuItem } = require('./controllers/menuController');
require('dotenv').config();

async function debug() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe');
  console.log('Connected to DB');

  // Let's find a master item
  const MenuItem = require('./models/MenuItem');
  const masterItem = await MenuItem.findOne({ cafeId: 'CD001', branchId: 'default' });
  console.log('Master item:', masterItem.name, masterItem._id, masterItem.cafeId, masterItem.branchId);

  // Mock req and res
  const req = {
    params: { id: masterItem._id.toString() },
    body: { price: 999.99 },
    user: { cafeId: 'CP002' },
    branchId: 'CP002-BR1'
  };

  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log('Response:', this.statusCode, data);
    }
  };

  // Run the controller!
  try {
    await updateMenuItem(req, res);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
  }
}
debug();
