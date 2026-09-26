const Expense = require('../models/Expense');

// @desc    Get expenses for a cafe / branch
// @route   GET /api/expenses
// @access  Private (Owner/Admin)
exports.getExpenses = async (req, res) => {
  try {
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Cafe ID is required' });
    }

    const { branchId, date, month, startDate, endDate } = req.query;
    const query = { cafeId };

    if (branchId && branchId !== 'all') {
      query.branchId = branchId;
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (month) {
      // Format: YYYY-MM
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 }).lean();

    const totalAmount = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return res.status(200).json({
      success: true,
      data: expenses,
      totalAmount,
      count: expenses.length
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: error.message });
  }
};

// @desc    Create a new expense
// @route   POST /api/expenses
// @access  Private (Owner/Admin)
exports.createExpense = async (req, res) => {
  try {
    const cafeId = req.cafeId || req.body.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Cafe ID is required' });
    }

    const { title, amount, category, paymentMode, date, notes, branchId } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Expense title is required' });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount greater than 0 is required' });
    }

    const newExpense = new Expense({
      cafeId,
      branchId: branchId || req.branchId || 'default',
      title: title.trim(),
      amount: parsedAmount,
      category: category || 'Miscellaneous',
      paymentMode: paymentMode || 'Cash',
      date: date ? new Date(date) : new Date(),
      notes: (notes || '').trim(),
      recordedBy: req.user ? (req.user.name || req.user.email || 'Owner') : 'Owner'
    });

    await newExpense.save();

    return res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      data: newExpense
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    return res.status(500).json({ success: false, message: 'Failed to record expense', error: error.message });
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private (Owner/Admin)
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, category, paymentMode, date, notes } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (title !== undefined) expense.title = title.trim();
    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid expense amount greater than 0 is required' });
      }
      expense.amount = parsedAmount;
    }
    if (category !== undefined) expense.category = category;
    if (paymentMode !== undefined) expense.paymentMode = paymentMode;
    if (date !== undefined) expense.date = new Date(date);
    if (notes !== undefined) expense.notes = notes.trim();

    await expense.save();

    return res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    return res.status(500).json({ success: false, message: 'Failed to update expense', error: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private (Owner/Admin)
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete expense', error: error.message });
  }
};
