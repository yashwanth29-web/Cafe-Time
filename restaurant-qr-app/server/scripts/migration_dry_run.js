const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

// Helper to generate a secure, readable temporary password
function generateSecureTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Tmp#${token}`;
}

async function dryRun() {
  console.log('--- DATABASE MIGRATION DRY-RUN ---');
  await mongoose.connect(process.env.MONGO_URI);
  const users = await mongoose.connection.db.collection('users').find({}).toArray();

  const proposedMapping = [];
  const usernameSet = new Set();
  const collisionList = [];

  for (const user of users) {
    const isSuperAdmin = user.role === 'super_admin' || 
      (user.email && user.email.toLowerCase() === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase());

    let candidateUsername = user.username;
    if (!candidateUsername || candidateUsername.trim() === '') {
      if (isSuperAdmin) {
        candidateUsername = 'superadmin';
      } else {
        const namePart = (user.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
        const emailPart = (user.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
        candidateUsername = namePart || emailPart || `user_${user.role || 'staff'}`;
      }
    }

    candidateUsername = candidateUsername.toLowerCase().trim();

    // Check collision
    if (usernameSet.has(candidateUsername)) {
      collisionList.push(candidateUsername);
      let counter = 1;
      let resolved = `${candidateUsername}_${(user.role || 'staff').toLowerCase()}`;
      while (usernameSet.has(resolved)) {
        resolved = `${candidateUsername}${counter}`;
        counter++;
      }
      candidateUsername = resolved;
    }

    usernameSet.add(candidateUsername);

    const tempPassword = generateSecureTempPassword();

    proposedMapping.push({
      _id: user._id.toString(),
      displayName: user.displayName || user.name || 'User',
      role: isSuperAdmin ? 'super_admin' : (user.role || 'staff'),
      cafeId: user.cafeId || 'N/A',
      assignedBranch: user.assignedBranch || 'N/A',
      proposedUsername: candidateUsername,
      generatedTempPassword: tempPassword,
      mustChangePassword: true,
      isActive: user.isActive !== undefined ? user.isActive : true
    });
  }

  console.log('\n--- PROPOSED USERNAME MAPPING & UNIQUE TEMPORARY CREDENTIALS ---');
  console.table(proposedMapping.map(p => ({
    _id: p._id,
    Name: p.displayName,
    Role: p.role,
    Username: p.proposedUsername,
    TempPassword: p.generatedTempPassword,
    Cafe: p.cafeId,
    Branch: p.assignedBranch,
    Active: p.isActive
  })));

  console.log(`\nTotal Users: ${proposedMapping.length}`);
  console.log(`Unique Usernames: ${usernameSet.size}`);
  console.log(`Collisions Detected & Resolved: ${collisionList.length} (${collisionList.join(', ') || 'None'})`);
  console.log('-----------------------------------------------------------------\n');

  await mongoose.disconnect();
}

dryRun().catch(e => {
  console.error('Dry-run failed:', e);
  process.exit(1);
});
