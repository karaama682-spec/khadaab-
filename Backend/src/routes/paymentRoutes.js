const express = require('express');
const router = express.Router();
const {
    getPayments,
    getPaymentById,
    createPayment,
    updatePayment,
    deletePayment
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { checkAnyPermission, checkAnyPermissionSet } = require('../middleware/roleMiddleware');

// Payments feed both the Finance screens and the fee reports; no sub-module is
// named so any Finance area grant qualifies, matching how the pages read them.
const canReadPayments = checkAnyPermissionSet([
    { moduleName: 'Finance', actions: ['Read'] },
    { moduleName: 'Reports', actions: ['Read'] }
]);
const canWritePayments = checkAnyPermission('Finance', ['Add', 'Edit']);

router.route('/')
    .get(protect, canReadPayments, getPayments)
    .post(protect, canWritePayments, createPayment);

router.route('/:id')
    .get(protect, canReadPayments, getPaymentById)
    .put(protect, canWritePayments, updatePayment)
    .delete(protect, checkAnyPermission('Finance', ['Delete']), deletePayment);

module.exports = router;
