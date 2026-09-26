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
 * Auto-cleanup: Purges expired attachments of work reports via storageCleanupService
 */
const runAutoCleanup = async () => {
  try {
    const { cleanupExpiredWorkReports } = require('../services/storageCleanupService');
    return await cleanupExpiredWorkReports();
  } catch (error) {
    console.error('[AUTO-CLEANUP] Error delegating to storageCleanupService:', error);
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

    // Support both multipart file uploads and base64 payloads
    let photos = [];
    const gridFsFileIds = [];
    const gridFsFilenames = [];

    if (req.files && req.files.length > 0) {
      if (req.files.length > 15) {
        req.files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (e) {}
        });
        return res.status(400).json({ success: false, message: 'You can upload a maximum of 15 photos per report.' });
      }
      photos = req.files.map(file => `/uploads/${file.filename}`);
      try {
        const { syncToGridFS } = require('../utils/gridfs');
        for (const file of req.files) {
          const gfsFile = await syncToGridFS(file);
          if (gfsFile) {
            gridFsFileIds.push(gfsFile._id);
            gridFsFilenames.push(gfsFile.filename);
          }
        }
      } catch (err) {
        console.error('Error syncing work report photos to GridFS:', err);
      }
    } else if (req.body.photos && Array.isArray(req.body.photos) && req.body.photos.length > 0) {
      if (req.body.photos.length > 15) {
        return res.status(400).json({ success: false, message: 'You can upload a maximum of 15 photos per report.' });
      }
      const uploadDir = path.join(__dirname, '../public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const { syncToGridFS } = require('../utils/gridfs');

      for (let i = 0; i < req.body.photos.length; i++) {
        const item = req.body.photos[i];
        if (typeof item === 'string' && item.startsWith('data:image')) {
          const base64Data = item.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const filename = `cafe-cam-${Date.now()}-${i}-${Math.round(Math.random() * 1E9)}.jpg`;
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, buffer);

          photos.push(`/uploads/${filename}`);

          const fileObj = {
            path: filePath,
            filename: filename,
            originalname: filename,
            mimetype: 'image/jpeg',
            size: buffer.length
          };
          const gfsFile = await syncToGridFS(fileObj);
          if (gfsFile) {
            gridFsFileIds.push(gfsFile._id);
            gridFsFilenames.push(gfsFile.filename);
          }
        } else if (typeof item === 'string') {
          photos.push(item);
        }
      }
    }

    if (photos.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo upload is required.' });
    }

    // 1. Verify user details
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member profile not found.' });
    }

    let branch;
    if (!staff.assignedBranch) {
      // Find any branch belonging to this cafe
      branch = await Branch.findOne({ cafeId: staff.cafeId });
      if (!branch) {
        return res.status(400).json({ success: false, message: 'No branch has been created yet. Please contact the owner.' });
      }
    } else {
      branch = await Branch.findOne({ branchId: staff.assignedBranch, cafeId: staff.cafeId });
      if (!branch) {
        return res.status(404).json({ success: false, message: 'Assigned branch details not found.' });
      }
    }

    const gridFsFileId = gridFsFileIds.length > 0 ? gridFsFileIds[0] : null;
    const gridFsFilename = gridFsFilenames.length > 0 ? gridFsFilenames[0] : '';

    // 4. Create work report
    const newReport = await WorkReport.create({
      staffId,
      staffName: staff.name,
      branchId: branch.branchId,
      branchName: branch.branchId,
      cafeId: staff.cafeId,
      notes: notes || '',
      photos,
      date: getISTDate(),
      gridFsFileIds,
      gridFsFilenames,
      gridFsFileId,
      gridFsFilename
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
    const cafeId = req.user.cafeId;
    const { date, range, staffId, branchId } = req.query;

    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Your user profile does not have a cafe assignment.' });
    }

    const query = { cafeId };
    
    // Branch filter: only apply if specific branch requested
    const requestedBranch = branchId || req.headers['x-branch-id'];
    if (requestedBranch && requestedBranch !== 'all') {
      query.$or = [
        { branchId: requestedBranch },
        { branchName: requestedBranch }
      ];
    }

    // Staff filter
    if (staffId && staffId !== 'all') {
      query.staffId = staffId;
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

    const reports = await WorkReport.find(query)
      .populate('staffId', 'name staffRole employeeId username avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

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
