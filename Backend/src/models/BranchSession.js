const mongoose = require('mongoose');

// The three attendance sessions are the SAME for every branch — only their times
// differ per branch. Session names are therefore a fixed enum, and one row exists
// per (branch, name). The unique index below prevents a branch from ever getting
// two Morning rows.
const SESSION_NAMES = ['Morning', 'Breakfast', 'Evening'];

// Times are stored as 24-hour "HH:MM" strings, matching the existing attendance
// arrivalTime format. Morning 06:55, Breakfast 10:30, Evening 13:20 (01:20 PM).
const DEFAULT_TIMES = {
    Morning: '06:55',
    Breakfast: '10:30',
    Evening: '13:20'
};

const branchSessionSchema = new mongoose.Schema({
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true
    },
    name: {
        type: String,
        enum: SESSION_NAMES,
        required: true
    },
    time: {
        type: String, // 24-hour HH:MM
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

// One Morning/Breakfast/Evening per branch — never two of the same name.
branchSessionSchema.index({ branchId: 1, name: 1 }, { unique: true });

const BranchSession = mongoose.model('BranchSession', branchSessionSchema);

BranchSession.SESSION_NAMES = SESSION_NAMES;
BranchSession.DEFAULT_TIMES = DEFAULT_TIMES;

module.exports = BranchSession;
