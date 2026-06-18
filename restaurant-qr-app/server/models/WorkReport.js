const mongoose = require('mongoose');

const WorkReportSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staffName: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: String,
    required: true
  },
  branchName: {
    type: String,
    required: true
  },
  cafeId: {
    type: String,
    required: true,
    index: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  photos: [
    {
      type: String,
      required: true
    }
  ],
  date: {
    type: String,
    required: true,
    index: true
  },
  gridFsFileIds: [
    {
      type: mongoose.Schema.Types.ObjectId
    }
  ],
  gridFsFilenames: [
    {
      type: String
    }
  ],
  gridFsFileId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  gridFsFilename: {
    type: String,
    default: ''
  },
  attachmentsExpired: {
    type: Boolean,
    default: false
  },
  attachmentsExpiredAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkReport', WorkReportSchema);
