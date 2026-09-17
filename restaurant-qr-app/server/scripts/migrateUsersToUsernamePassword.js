const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DEFAULT_PASS_ADMIN = 'SuperAdmin@123';
const DEFAULT_PASS_STAFF = 'Cafe@12345';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB successfully.');

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');

  // Drop old unique index on email if present so it doesn't conflict with sparse/null emails
  try {
    await usersCollection.dropIndex('email_1');
    console.log('Dropped old email_1 index.');
  } catch (e) {
    // Index may not exist or named differently
  }

  // Ensure unique index on username
  try {
    await usersCollection.createIndex({ username: 1 }, { unique: true, sparse: true });
    console.log('Created unique index on username_1.');
  } catch (e) {
    console.log('Username index notice:', e.message);
  }

  const users = await usersCollection.find({}).toArray();
  console.log(`Found ${users.length} users to inspect/migrate.`);

  const usedUsernames = new Set();
  const report = [];

  const superAdminHash = await bcrypt.hash(DEFAULT_PASS_ADMIN, 12);
  const staffHash = await bcrypt.hash(DEFAULT_PASS_STAFF, 12);

  for (const user of users) {
    let username = user.username;
    const isSuperAdmin = user.role === 'super_admin' || 
      (user.email && user.email.toLowerCase() === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase());

    if (!username || username.trim() === '') {
      // Derive candidate username
      if (isSuperAdmin) {
        username = 'superadmin';
      } else {
        const namePart = (user.name || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 15);
        const emailPart = (user.email || '')
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 15);

        let candidate = namePart || emailPart || `user${user.role || 'staff'}`;

        // If duplicate, append role or number
        if (usedUsernames.has(candidate)) {
          candidate = `${candidate}_${(user.role || 'staff').toLowerCase()}`;
        }
        if (usedUsernames.has(candidate) && user.cafeId) {
          candidate = `${candidate}_${user.cafeId.toLowerCase()}`;
        }
        let counter = 1;
        let finalCandidate = candidate;
        while (usedUsernames.has(finalCandidate)) {
          finalCandidate = `${candidate}${counter}`;
          counter++;
        }
        username = finalCandidate;
      }
    }

    username = username.toLowerCase().trim();
    usedUsernames.add(username);

    // Hash password if not already set
    let passwordHash = user.password;
    let initialPasswordGiven = '(already set)';

    if (!passwordHash) {
      if (isSuperAdmin) {
        passwordHash = superAdminHash;
        initialPasswordGiven = DEFAULT_PASS_ADMIN;
      } else {
        passwordHash = staffHash;
        initialPasswordGiven = DEFAULT_PASS_STAFF;
      }
    }

    const displayName = user.displayName || user.name || username;

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          username,
          displayName,
          password: passwordHash,
          mustChangePassword: false,
          role: isSuperAdmin ? 'super_admin' : (user.role || 'staff'),
          isActive: user.isActive !== undefined ? user.isActive : true
        }
      }
    );

    report.push({
      id: user._id.toString(),
      name: displayName,
      role: isSuperAdmin ? 'super_admin' : (user.role || 'staff'),
      username,
      initialPassword: initialPasswordGiven,
      cafeId: user.cafeId || 'N/A',
      assignedBranch: user.assignedBranch || 'N/A'
    });
  }

  console.log('\n================ MIGRATION REPORT ================');
  console.table(report);
  console.log('==================================================\n');

  await mongoose.disconnect();
  console.log('Migration completed successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
