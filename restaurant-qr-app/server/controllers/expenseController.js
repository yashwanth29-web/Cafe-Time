const Expense = require('../models/Expense');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');

// @desc    Get expenses for a cafe / branch
// @route   GET /api/expenses
// @access  Private (Owner/Admin)
exports.getExpenses = async (req, res) => {
  try {
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Cafe ID is required' });
    }

    const { branchId, date, month, startDate, endDate, periodTag } = req.query;
    const query = { cafeId };

    if (branchId && branchId !== 'all') {
      query.branchId = branchId;
    }

    if (periodTag && periodTag !== 'all') {
      query.periodTag = periodTag;
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

    const { title, amount, category, paymentMode, date, notes, branchId, periodTag } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Expense title is required' });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount greater than 0 is required' });
    }

    let expenseDate;
    if (date) {
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        expenseDate = new Date(`${date}T12:00:00+05:30`);
      } else {
        expenseDate = new Date(date);
      }
    } else {
      expenseDate = new Date();
    }

    const newExpense = new Expense({
      cafeId,
      branchId: branchId || req.branchId || 'default',
      title: title.trim(),
      amount: parsedAmount,
      category: category || 'Miscellaneous',
      paymentMode: paymentMode || 'Cash',
      periodTag: (periodTag === 'Daily' ? 'Today' : (periodTag || 'Today')),
      date: expenseDate,
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
    const { title, amount, category, paymentMode, date, notes, periodTag } = req.body;

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
    if (periodTag !== undefined) expense.periodTag = periodTag === 'Daily' ? 'Today' : periodTag;
    if (date !== undefined) {
      if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        expense.date = new Date(`${date}T12:00:00+05:30`);
      } else {
        expense.date = date ? new Date(date) : new Date();
      }
    }
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

// @desc    Get executive financial P&L summary (Revenue, Recipe Making Cost, Other Expenses, Total Expenses, Net Profit)
// @route   GET /api/expenses/financial-summary
// @access  Private (Owner/Admin)
exports.getFinancialSummary = async (req, res) => {
  try {
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Cafe ID is required' });
    }

    const { branchId, period = 'today' } = req.query;

    // Timezone calculations for IST (UTC+5:30)
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const year = istTime.getUTCFullYear();
    const month = istTime.getUTCMonth();
    const date = istTime.getUTCDate();

    let startDate;
    if (period === 'today') {
      startDate = new Date(Date.UTC(year, month, date) - (5.5 * 60 * 60 * 1000));
    } else if (period === 'week') {
      // 7 days ago
      startDate = new Date(Date.UTC(year, month, date - 6) - (5.5 * 60 * 60 * 1000));
    } else if (period === '15days') {
      // 15 days ago
      startDate = new Date(Date.UTC(year, month, date - 14) - (5.5 * 60 * 60 * 1000));
    } else if (period === 'month') {
      // 1st of current month
      startDate = new Date(Date.UTC(year, month, 1) - (5.5 * 60 * 60 * 1000));
    } else {
      startDate = new Date(Date.UTC(year, month, date) - (5.5 * 60 * 60 * 1000));
    }

    const orderQuery = {
      cafeId,
      status: { $in: ['Ready', 'Delivered', 'Completed'] },
      paymentStatus: 'Paid',
      createdAt: { $gte: startDate }
    };

    const expenseQuery = {
      cafeId,
      date: { $gte: startDate }
    };

    if (branchId && branchId !== 'all') {
      orderQuery.branchId = branchId;
      expenseQuery.branchId = branchId;
    }

    // Run parallel queries
    const [orders, menuItems, expenses] = await Promise.all([
      Order.find(orderQuery).select('totalAmount items createdAt paymentMethod').lean(),
      MenuItem.find({ cafeId }).select('_id name makingCost price category').lean(),
      Expense.find(expenseQuery).sort({ date: -1 }).lean()
    ]);

    // Build fast lookup maps for making costs
    const menuCostById = {};
    const menuCostByName = {};
    menuItems.forEach((m) => {
      const cost = Number(m.makingCost) || 0;
      if (m._id) menuCostById[String(m._id)] = cost;
      if (m.name) menuCostByName[m.name.toLowerCase().trim()] = cost;
    });

    let totalSales = 0;
    let menuMakingCost = 0;
    const dishCostMap = {};

    orders.forEach((order) => {
      totalSales += Number(order.totalAmount) || 0;
      if (Array.isArray(order.items)) {
        order.items.forEach((it) => {
          const qty = Number(it.quantity) || 1;
          const idKey = String(it.id || it._id || '');
          const nameKey = (it.name || '').toLowerCase().trim();
          const unitCost = menuCostById[idKey] ?? menuCostByName[nameKey] ?? 0;
          const itemCost = unitCost * qty;
          const price = Number(it.price || 0);
          const revenue = price * qty;
          menuMakingCost += itemCost;

          const dishName = it.name || 'Unknown Dish';
          if (!dishCostMap[dishName]) {
            dishCostMap[dishName] = {
              name: dishName,
              quantity: 0,
              quantitySold: 0,
              unitMakingCost: unitCost,
              sellingPrice: price,
              totalMakingCost: 0,
              totalRevenue: 0,
              grossProfit: 0,
              marginPct: 0
            };
          }
          dishCostMap[dishName].quantity += qty;
          dishCostMap[dishName].quantitySold += qty;
          dishCostMap[dishName].totalMakingCost += itemCost;
          dishCostMap[dishName].totalRevenue += revenue;
          dishCostMap[dishName].grossProfit = dishCostMap[dishName].totalRevenue - dishCostMap[dishName].totalMakingCost;
          dishCostMap[dishName].marginPct = dishCostMap[dishName].totalRevenue > 0
            ? Number(((dishCostMap[dishName].grossProfit / dishCostMap[dishName].totalRevenue) * 100).toFixed(1))
            : 0;
        });
      }
    });

    const dishCostBreakdown = Object.values(dishCostMap)
      .sort((a, b) => b.totalMakingCost - a.totalMakingCost);

    let otherExpenses = 0;
    const categoryBreakdown = {};
    expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      otherExpenses += amt;
      const cat = exp.category || 'Miscellaneous';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
    });

    const totalExpenses = Number((menuMakingCost + otherExpenses).toFixed(2));
    const grossProfit = Number((totalSales - menuMakingCost).toFixed(2));
    const netProfit = Number((totalSales - totalExpenses).toFixed(2));
    const netMargin = totalSales > 0 ? Number(((netProfit / totalSales) * 100).toFixed(1)) : 0;
    const grossMargin = totalSales > 0 ? Number(((grossProfit / totalSales) * 100).toFixed(1)) : 0;

    const summaryObj = {
      period,
      startDate,
      totalSales: Number(totalSales.toFixed(2)),
      recipeMakingCost: Number(menuMakingCost.toFixed(2)),
      menuMakingCost: Number(menuMakingCost.toFixed(2)),
      otherExpensesTotal: Number(otherExpenses.toFixed(2)),
      otherExpenses: Number(otherExpenses.toFixed(2)),
      totalAllExpenses: totalExpenses,
      totalExpenses,
      grossProfit,
      grossMargin,
      trueNetProfit: netProfit,
      netProfit,
      trueNetMarginPct: netMargin,
      netMargin,
      paidOrdersCount: orders.length,
      ordersCount: orders.length,
      otherExpensesCount: expenses.length,
      expensesCount: expenses.length
    };

    return res.status(200).json({
      success: true,
      data: {
        ...summaryObj,
        summary: summaryObj,
        dishCostBreakdown,
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error('getFinancialSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to calculate financial summary', error: error.message });
  }
};
