const mongoose = require('mongoose');

// Allocates gap-free sequence numbers for system-generated identifiers.
// A single atomic $inc per allocation means two concurrent registrations can
// never receive the same number, unlike a Date.now() or count()+1 approach.
const counterSchema = new mongoose.Schema({
    _id: {
        type: String // e.g. "student:2026"
    },
    sequence: {
        type: Number,
        default: 0
    }
}, { versionKey: false });

const Counter = mongoose.model('Counter', counterSchema);

// Returns the next number for the given key, creating the counter on first use.
Counter.next = async (key) => {
    const result = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return result.sequence;
};

module.exports = Counter;
