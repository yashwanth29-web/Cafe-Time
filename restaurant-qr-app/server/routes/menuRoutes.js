const express = require('express');
const router = express.Router();
const { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');

router.get('/', getMenuItems);
router.post('/', createMenuItem);
router.patch('/:id', updateMenuItem);
router.delete('/:id', deleteMenuItem);

module.exports = router;
