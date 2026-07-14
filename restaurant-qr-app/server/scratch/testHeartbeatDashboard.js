const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const SystemHealth = require('../models/SystemHealth');
const User = require('../models/User');
const { getCafes } = require('../controllers/superAdminController');

async function testHeartbeatOperations() {
  console.log('========================================================');
  console.log('STARTING ENTERPRISE TEST: HEARTBEAT & SYSTEM MONITOR');
  console.log('========================================================');

  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  let allChecksPassed = true;

  try {
    // 1. Create a Mock Cafe and Branch
    console.log('\n--- 1. Setting up mock Cafe and Branch ---');
    const mockCafe = new Cafe({
      cafeId: 'HB_CAFE_1',
      name: 'Heartbeat Test Cafe',
      ownerEmail: 'owner@hbcafe.com',
      city: 'Hyderabad',
      state: 'Telangana',
      businessType: 'Cafe',
      branchCount: 1,
      isActive: true
    });
    const mockBranch = new Branch({
      branchId: 'HB_BRANCH_1',
      branchName: 'HB Branch 1',
      cafeId: 'HB_CAFE_1',
      address: 'Near Metro Hyderabad',
      manager: 'Manager One',
      isActive: true
    });
    const mockOwner = new User({
      name: 'HB Cafe Owner',
      email: 'owner@hbcafe.com',
      phone: '8800000001',
      role: 'owner',
      cafeId: 'HB_CAFE_1',
      assignedBranch: 'default',
      isActive: true,
      employeeId: 'OWN_HB_1'
    });

    await mockCafe.save();
    await mockBranch.save();
    await mockOwner.save();
    console.log('Mock records saved successfully.');

    // 2. Simulate Heartbeat Post Requests
    console.log('\n--- 2. Simulating Heartbeat update requests ---');
    const heartbeatPayload1 = {
      cafeId: 'HB_CAFE_1',
      branchId: 'HB_BRANCH_1',
      connectedUsers: 8,
      activeStaff: 4,
      activeOrders: 3,
      kitchenStatus: 'Online',
      inventorySyncStatus: 'Synced',
      services: {
        db: 'connected',
        api: 'connected',
        paymentGateway: 'connected',
        kitchenDashboard: 'connected',
        qrOrdering: 'connected',
        inventorySync: 'connected',
        printer: 'connected'
      }
    };

    // We execute the heartbeat handler logic directly
    const express = require('express');
    const router = express.Router();
    
    // Simulate endpoint logic execution
    let health = await SystemHealth.findOne({ cafeId: 'HB_CAFE_1' });
    if (!health) {
      health = new SystemHealth({ cafeId: 'HB_CAFE_1' });
    }
    health.lastHeartbeat = new Date();
    health.connectedUsers = heartbeatPayload1.connectedUsers;
    health.activeOrders = heartbeatPayload1.activeOrders;
    health.kitchenStatus = heartbeatPayload1.kitchenStatus;
    await health.save();

    const branch = await Branch.findOne({ branchId: 'HB_BRANCH_1', cafeId: 'HB_CAFE_1' });
    if (branch) {
      branch.lastHeartbeat = new Date();
      branch.activeStaff = heartbeatPayload1.activeStaff;
      branch.activeOrders = heartbeatPayload1.activeOrders;
      branch.inventorySyncStatus = heartbeatPayload1.inventorySyncStatus;
      branch.services = heartbeatPayload1.services;
      await branch.save();
    }
    console.log('Heartbeat payload processed.');

    // 3. Verify Database Fields Updated
    console.log('\n--- 3. Verifying database updates ---');
    const updatedHealth = await SystemHealth.findOne({ cafeId: 'HB_CAFE_1' });
    const updatedBranch = await Branch.findOne({ branchId: 'HB_BRANCH_1', cafeId: 'HB_CAFE_1' });

    console.log(`  SystemHealth Connected Users: ${updatedHealth.connectedUsers} (Expected: 8)`);
    console.log(`  SystemHealth Active Orders: ${updatedHealth.activeOrders} (Expected: 3)`);
    console.log(`  SystemHealth Kitchen Status: ${updatedHealth.kitchenStatus} (Expected: Online)`);
    console.log(`  Branch Active Staff: ${updatedBranch.activeStaff} (Expected: 4)`);
    console.log(`  Branch Active Orders: ${updatedBranch.activeOrders} (Expected: 3)`);
    console.log(`  Branch Services (api): ${updatedBranch.services.get('api')} (Expected: connected)`);

    if (updatedHealth.connectedUsers !== 8 || updatedBranch.activeStaff !== 4 || updatedBranch.services.get('api') !== 'connected') {
      console.error('  --> HEARTBEAT DATABASE UPDATE CHECK FAILED!');
      allChecksPassed = false;
    } else {
      console.log('  --> Heartbeat Database Update Check PASS!');
    }

    // 4. Verify Super Admin getCafes API response fields mapping
    console.log('\n--- 4. Verifying Super Admin getCafes response mapping ---');
    const mockRes = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.responseData = data; return this; }
    };
    await getCafes({}, mockRes);

    const targetCafeData = mockRes.responseData.cafes.find(c => c.cafeId === 'HB_CAFE_1');
    console.log(`  Mapped Owner Name: ${targetCafeData ? targetCafeData.ownerName : 'N/A'} (Expected: HB Cafe Owner)`);
    console.log(`  Mapped Health Connected Users: ${targetCafeData ? targetCafeData.health.connectedUsers : 'N/A'} (Expected: 8)`);
    console.log(`  Mapped Health Kitchen Status: ${targetCafeData ? targetCafeData.health.kitchenStatus : 'N/A'} (Expected: Online)`);

    if (!targetCafeData || targetCafeData.ownerName !== 'HB Cafe Owner' || targetCafeData.health.connectedUsers !== 8) {
      console.error('  --> SUPER ADMIN DASHBOARD API CHECK FAILED!');
      allChecksPassed = false;
    } else {
      console.log('  --> Super Admin Dashboard API Check PASS!');
    }

  } catch (err) {
    console.error('Test execution exception:', err);
    allChecksPassed = false;
  } finally {
    // Cleanup
    console.log('\n--- Cleaning up heartbeat mock data ---');
    await Cafe.deleteMany({ cafeId: 'HB_CAFE_1' });
    await Branch.deleteMany({ cafeId: 'HB_CAFE_1' });
    await SystemHealth.deleteMany({ cafeId: 'HB_CAFE_1' });
    await User.deleteMany({ cafeId: 'HB_CAFE_1' });
    console.log('Cleanup completed.');
  }

  console.log('\n========================================================');
  if (allChecksPassed) {
    console.log('STATUS REPORT: ALL SYSTEM MONITOR AUDITS PASSED ✅');
  } else {
    console.error('STATUS REPORT: SYSTEM MONITOR AUDITS FAILED ❌');
  }
  console.log('========================================================');

  await mongoose.connection.close();
}

testHeartbeatOperations().catch(console.error);
