const WorkReport = require('../models/WorkReport');
const User = require('../models/User');
const Branch = require('../models/Branch');
const fs = require('fs');
const path = require('path');

// Helper: Get IST Date String (YYYY-MM-DD)
const getISTDate = (date = new Date()) => {
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + tzOffset);
  return istTime.toISOString().split('T')[0];
};

/**
 * Auto-cleanup: Purges reports and deletes their files if created > 24 hours ago
 */
const runAutoCleanup = async () => {
  try {
    const cutOff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const expiredReports = await WorkReport.find({ createdAt: { $lt: cutOff } });

    if (expiredReports.length === 0) {
      return { success: true, count: 0 };
    }

    let deletedFiles = 0;
    for (const report of expiredReports) {
      if (report.photos && Array.isArray(report.photos)) {
        for (const photoUrl of report.photos) {
          try {
            // photoUrl format: http://domain/uploads/report-xxxx.png
            const filename = photoUrl.substring(photoUrl.lastIndexOf('/') + 1);
            const filePath = path.join(__dirname, '../public/uploads', filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              deletedFiles++;
            }
          } catch (fileErr) {
            console.error(`[AUTO-CLEANUP] Failed to delete image file: ${photoUrl}`, fileErr);
          }
        }
      }
      await WorkReport.findByIdAndDelete(report._id);
    }

    console.log(`[AUTO-CLEANUP] Purged ${expiredReports.length} reports and deleted ${deletedFiles} image files (24h retention policy).`);
    return { success: true, reportsPurged: expiredReports.length, filesDeleted: deletedFiles };
  } catch (error) {
    console.error('[AUTO-CLEANUP] Critical error in purging expired work reports:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Staff creates a new Work Report
 */
const createReport = async (req, res) => {
  try {
    // Proactively trigger cleanup to prevent accumulation
    runAutoCleanup();

    const staffId = req.user._id;
    const { notes } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo upload is required.' });
    }

    if (req.files.length > 10) {
      // Cleanup uploaded files immediately before returning
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(400).json({ success: false, message: 'You can upload a maximum of 10 photos per report.' });
    }

    // 1. Verify user details
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member profile not found.' });
    }

    let branch;
    const hasBranches = await Branch.exists({ cafeId: staff.cafeId });
    if (!hasBranches) {
      // Single-Cafe Mode: Auto create/fetch default branch
      branch = await Branch.findOne({ branchId: 'default', cafeId: staff.cafeId });
      if (!branch) {
        const cafe = await Cafe.findOne({ cafeId: staff.cafeId });
        branch = await Branch.create({
          branchId: 'default',
          branchName: 'Primary Location',
          cafeId: staff.cafeId,
          address: (cafe && cafe.address) || 'Default Address',
          manager: 'Owner',
          latitude: 0,
          longitude: 0,
          allowedRadius: 30,
          isActive: true
        });
      }
    } else {
      // Multi-Branch Mode: Enforce staff.assignedBranch
      if (!staff.assignedBranch) {
        return res.status(400).json({ success: false, message: 'No branch assigned to your account. You must be assigned to a branch to upload work reports.' });
      }
      branch = await Branch.findOne({ branchId: staff.assignedBranch, cafeId: staff.cafeId });
      if (!branch) {
        return res.status(404).json({ success: false, message: 'Assigned branch details not found.' });
      }
    }

    // 3. Construct absolute image URLs
    const protocol = req.protocol;
    const host = req.get('host');
    const photos = req.files.map(file => `${protocol}://${host}/uploads/${file.filename}`);

    // 4. Create work report
    const newReport = await WorkReport.create({
      staffId,
      staffName: staff.name,
      branchId: branch.branchId,
      branchName: branch.branchName,
      cafeId: staff.cafeId,
      notes: notes || '',
      photos,
      date: getISTDate()
    });

    return res.status(201).json({
      success: true,
      message: 'Work report submitted successfully.',
      report: newReport
    });
  } catch (error) {
    console.error('createReport error:', error);
    // Cleanup uploaded files in case of server failure
    if (req.files) {
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
    }
    return res.status(500).json({ success: false, message: 'Server error saving work report.' });
  }
};

/**
 * Owners/Managers retrieve reports for their cafe
 */
const getReports = async (req, res) => {
  try {
    // Proactively trigger cleanup
    runAutoCleanup();

    const cafeId = req.user.cafeId;
    const { date, range, staffId, branchId } = req.query;

    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Your user profile does not have a cafe assignment.' });
    }

    const query = { cafeId };

    // Staff filter
    if (staffId) {
      query.staffId = staffId;
    }

    // Branch filter
    if (branchId) {
      query.branchId = branchId;
    }

    // Range / Date filters
    if (date) {
      query.date = date; // Expect YYYY-MM-DD
    } else if (range === 'today') {
      query.date = getISTDate();
    } else if (range === 'this_week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query.createdAt = { $gte: sevenDaysAgo };
    }

    const reports = await WorkReport.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('getReports error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving work reports.' });
  }
};

module.exports = {
  createReport,
  getReports,
  runAutoCleanup
};
