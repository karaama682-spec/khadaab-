const mongoose = require('mongoose');

const studentSnapshotSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    },
    name: { type: String, default: '' },
    studentCode: { type: String, default: '' },
    className: { type: String, default: '' },
    monthlyFee: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: false }
}, { _id: false });

const payerSnapshotSchema = new mongoose.Schema({
    key: { type: String, required: true },
    name: { type: String, default: 'Unknown' },
    phone: { type: String, default: '' },
    alternatePhone: { type: String, default: '' },
    relationship: { type: String, default: '' },
    guardianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guardian'
    },
    studentIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    studentCount: { type: Number, default: 0 },
    totalFee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    month: { type: String },
    cycle: { type: String },
    students: [studentSnapshotSchema]
}, { _id: false });

const cycleDebtSnapshotSchema = new mongoose.Schema({
    cycle: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    cycleLabel: {
        type: String,
        default: ''
    },
    closedAt: {
        type: Date,
        default: Date.now
    },
    totalDebt: {
        type: Number,
        default: 0
    },
    totalExpected: {
        type: Number,
        default: 0
    },
    totalCollected: {
        type: Number,
        default: 0
    },
    payerCount: {
        type: Number,
        default: 0
    },
    studentCount: {
        type: Number,
        default: 0
    },
    payers: [payerSnapshotSchema]
}, { timestamps: true });

module.exports = mongoose.model('CycleDebtSnapshot', cycleDebtSnapshotSchema);
