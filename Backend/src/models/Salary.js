const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet'
    },
    month: {
        type: String, // legacy calendar "YYYY-MM"
        required: true
    },
    // Billing-cycle key (25th→24th) this salary is FOR. Set on new records; null
    // on historical rows (attributed by paymentDate). Backward compatible.
    billingCycle: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String,
        default: 'Cash'
    },
    notes: {
        type: String,
        default: ''
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Paid', 'Pending'],
        default: 'Paid'
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Salary', salarySchema);
