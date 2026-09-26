const CashRegister = require('../models/CashRegister');
const Order = require('../models/Order');

// Helper to format date YYYY-MM-DD
const formatDateStr = (d = new Date()) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// @desc    Get daily cash register record & history
// @route   GET /api/cash-register
// @access  Private (Owner/Admin)
exports.getCashRegister = async (req, res) => {
  try {
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Cafe ID is required' });
    }

    const branchId = req.query.branchId || req.branchId || 'default';
    const targetDate = req.query.date || formatDateStr();

    // Find today's / target date's record
    let currentRecord = await CashRegister.findOne({
      cafeId,
      branchId,
      date: targetDate
    }).lean();

    // If no record exists for target date, check if yesterday's closing cash can be auto-suggested
    if (!currentRecord) {
      const yesterday = new Date(targetDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateStr(yesterday);

      const yesterdayRecord = await CashRegister.findOne({
        cafeId,
        branchId,
        date: yesterdayStr
      }).lean();

      let yesterdayCashAmount = yesterdayRecord ? (yesterdayRecord.netCashInHand || 0) : 0;
      let bankBalanceAmount = yesterdayRecord ? (yesterdayRecord.bankBalance || 0) : 0;

      // If no manual register was saved for yesterday, calculate directly from yesterday's completed cash orders!
      if (!yesterdayRecord || yesterdayCashAmount === 0) {
        try {
          const yStart = new Date(yesterdayStr);
          yStart.setHours(0, 0, 0, 0);
          const yEnd = new Date(yesterdayStr);
          yEnd.setHours(23, 59, 59, 999);

          const orderQuery = {
            cafeId,
            createdAt: { $gte: yStart, $lte: yEnd },
            status: { $in: ['Ready', 'Delivered', 'Completed'] },
            $or: [
              { paymentMethod: { $regex: /^cash$/i } },
              { 'paymentDetails.method': { $regex: /^cash$/i } }
            ]
          };
          if (branchId && branchId !== 'all' && branchId !== 'default') {
            orderQuery.branchId = branchId;
          }

          const yesterdayOrders = await Order.find(orderQuery).select('totalAmount').lean();
          const calculatedYesterdayCash = yesterdayOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
          if (calculatedYesterdayCash > 0) {
            yesterdayCashAmount = calculatedYesterdayCash;
          }
        } catch (calcErr) {
          console.warn('Error calculating yesterday cash orders:', calcErr);
        }
      }

      // Calculate today's cash & online sales from live completed orders
      let todayCashAmount = 0;
      let todayOnlineAmount = 0;
      try {
        const tStart = new Date(targetDate);
        tStart.setHours(0, 0, 0, 0);
        const tEnd = new Date(targetDate);
        tEnd.setHours(23, 59, 59, 999);

        const todayOrderQuery = {
          cafeId,
          createdAt: { $gte: tStart, $lte: tEnd },
          status: { $in: ['Ready', 'Delivered', 'Completed'] }
        };
        if (branchId && branchId !== 'all' && branchId !== 'default') {
          todayOrderQuery.branchId = branchId;
        }

        const todayOrdersList = await Order.find(todayOrderQuery, 'totalAmount grandTotal paymentMethod paymentDetails', { lean: true }).limit(500);
        todayOrdersList.forEach((o) => {
          const amt = Number(o.grandTotal !== undefined ? o.grandTotal : (o.totalAmount || 0));
          const method = String(o.paymentMethod || o.paymentDetails?.method || '').toLowerCase();
          if (method === 'cash') {
            todayCashAmount += amt;
          } else {
            todayOnlineAmount += amt;
          }
        });
      } catch (tErr) {
        console.warn('Error calculating today cash & online orders:', tErr);
      }

      currentRecord = {
        cafeId,
        branchId,
        date: targetDate,
        yesterdayCash: yesterdayCashAmount,
        todayCash: todayCashAmount,
        bankBalance: 0,
        purchasesAmount: 0,
        purchasesNote: '',
        netCashInHand: (yesterdayCashAmount + todayCashAmount),
        notes: '',
        isNew: true
      };
    }

    // Also fetch last 7 days history
    const history = await CashRegister.find({
      cafeId,
      branchId
    })
      .sort({ date: -1 })
      .limit(7)
      .lean();

    return res.status(200).json({
      success: true,
      data: currentRecord,
      history
    });
  } catch (error) {
    console.error('Error fetching cash register:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch cash register', error: error.message });
  }
};

// @desc    Save/Upsert daily cash register record
// @route   POST /api/cash-register
// @access  Private (Owner/Admin)
exports.saveCashRegister = async (req, res) => {
  try {
    const cafeId = req.cafeId || req.body.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Cafe ID is required' });
    }

    const branchId = req.body.branchId || req.branchId || 'default';
    const targetDate = req.body.date || formatDateStr();

    const yesterdayCash = Math.max(0, Number(req.body.yesterdayCash) || 0);
    const todayCash = Math.max(0, Number(req.body.todayCash) || 0);
    const bankBalance = Math.max(0, Number(req.body.bankBalance) || 0);
    const purchasesAmount = Math.max(0, Number(req.body.purchasesAmount) || 0);
    const purchasesNote = (req.body.purchasesNote || '').trim();
    const notes = (req.body.notes || '').trim();

    // Auto calculate net cash in hand
    const netCashInHand = (yesterdayCash + todayCash) - purchasesAmount;

    const updatedRecord = await CashRegister.findOneAndUpdate(
      { cafeId, branchId, date: targetDate },
      {
        $set: {
          yesterdayCash,
          todayCash,
          bankBalance,
          purchasesAmount,
          purchasesNote,
          netCashInHand,
          notes,
          updatedBy: req.user ? (req.user.name || req.user.email || 'Owner') : 'Owner'
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Cash register updated successfully',
      data: updatedRecord
    });
  } catch (error) {
    console.error('Error saving cash register:', error);
    return res.status(500).json({ success: false, message: 'Failed to save cash register', error: error.message });
  }
};

// @desc    Delete a daily cash register record
// @route   DELETE /api/cash-register/:id
// @access  Private (Owner/Admin)
exports.deleteCashRegister = async (req, res) => {
  try {
    const cafeId = req.cafeId || (req.user && req.user.cafeId);
    const { id } = req.params;

    const query = { _id: id };
    if (cafeId) query.cafeId = cafeId;

    const record = await CashRegister.findOneAndDelete(query);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Cash register record not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Cash register record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cash register record:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete cash register record', error: error.message });
  }
};

