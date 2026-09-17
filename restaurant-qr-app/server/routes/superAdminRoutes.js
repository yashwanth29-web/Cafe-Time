const express = require('express');
const router = express.Router();
const { createOwner, resetOwnerPassword, getCafes, updateCafe, deleteCafe, restoreCafe, getTickets, updateTicketStatus } = require('../controllers/superAdminController');
const { getBranches, createBranch, updateBranch, deleteBranch } = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes under /api/superadmin to only super_admin role
router.use(protect);
router.use(restrictTo('super_admin'));

router.post('/create-owner', createOwner);
router.post('/reset-owner-password', resetOwnerPassword);
router.get('/cafes', getCafes);
router.put('/cafe/:id', updateCafe);
router.delete('/cafe/:id', deleteCafe);
router.post('/cafe/:id/restore', restoreCafe);

router.get('/tickets', getTickets);
router.patch('/tickets/:id', updateTicketStatus);

// Branches Management for Super Admin
router.get('/branches', getBranches);
router.post('/branches', createBranch);
router.put('/branches/:id', updateBranch);
router.delete('/branches/:id', deleteBranch);

module.exports = router;
