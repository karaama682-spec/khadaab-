const express = require('express');
const router = express.Router();
const {
    getWallets,
    getWalletById,
    createWallet,
    updateWallet,
    deleteWallet
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');
const { checkPermission, checkAnyPermission } = require('../middleware/roleMiddleware');

// Recording a payment credits a wallet, so any Finance read admits the lookup.
const canReadWallets = checkAnyPermission('Finance', ['Read']);

router.route('/')
    .get(protect, canReadWallets, getWallets)
    .post(protect, checkPermission('Finance', 'Add', 'Wallets'), createWallet);

router.route('/:id')
    .get(protect, canReadWallets, getWalletById)
    .put(protect, checkPermission('Finance', 'Edit', 'Wallets'), updateWallet)
    .delete(protect, checkPermission('Finance', 'Delete', 'Wallets'), deleteWallet);

module.exports = router;
