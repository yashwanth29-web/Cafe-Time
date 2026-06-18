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
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

WorkReportSchema.index({ cafeId: 1, date: -1 });
WorkReportSchema.index({ cafeId: 1, branchId: 1, date: -1 });

module.exports = mongoose.model('WorkReport', WorkReportSchema);
