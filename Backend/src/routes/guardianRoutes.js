const express = require('express');
const router = express.Router();
const {
    getGuardians,
    getGuardianById,
    createGuardian,
    updateGuardian,
    deleteGuardian
} = require('../controllers/guardianController');
const { protect } = require('../middleware/authMiddleware');
const { checkPermission, checkAnyPermissionSet } = require('../middleware/roleMiddleware');

// Payers are read while registering a student as well as from the Payers screen,
// so either grant admits a read.
const canReadPayers = checkAnyPermissionSet([
    { moduleName: 'Finance', actions: ['Read'], subModuleName: 'Payers' },
    { moduleName: 'Academic Management', actions: ['Read'], subModuleName: 'Students' },
    { moduleName: 'Reports', actions: ['Read'] }
]);

// Registering a student creates or reuses the payer record, so the student Add
// grant has to admit this write too.
const canWritePayers = checkAnyPermissionSet([
    { moduleName: 'Finance', actions: ['Add', 'Edit'], subModuleName: 'Payers' },
    { moduleName: 'Academic Management', actions: ['Add', 'Edit'], subModuleName: 'Students' }
]);

router.route('/')
    .get(protect, canReadPayers, getGuardians)
    .post(protect, canWritePayers, createGuardian);

router.route('/:id')
    .get(protect, canReadPayers, getGuardianById)
    .put(protect, canWritePayers, updateGuardian)
    .delete(protect, checkPermission('Finance', 'Delete', 'Payers'), deleteGuardian);

module.exports = router;
