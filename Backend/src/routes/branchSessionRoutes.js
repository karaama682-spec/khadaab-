const express = require('express');
const router = express.Router();
const {
    getBranchSessions,
    updateBranchSessions
} = require('../controllers/branchSessionController');
const { protect } = require('../middleware/authMiddleware');

// Per-branch attendance session times. Session NAMES are shared (Morning,
// Breakfast, Evening); only the TIMES are branch-specific.
router.route('/:branchId')
    .get(protect, getBranchSessions)
    .put(protect, updateBranchSessions);

module.exports = router;
