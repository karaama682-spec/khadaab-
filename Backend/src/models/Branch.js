const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, { timestamps: true });

// One branch per name. The controller rejects a duplicate case-insensitively
// with a clear message; this index is the backstop for concurrent writes.
branchSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
