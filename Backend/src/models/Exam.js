const mongoose = require('mongoose');

const examSubjectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    nisfiFullMarks: { type: Number, default: 40, min: 0 },
    nihaayiFullMarks: { type: Number, default: 60, min: 0 },
    fullMarks: { type: Number, default: 100, min: 1 },
    passMarks: { type: Number, default: 40, min: 0 },
    day: { type: String, trim: true, default: '' },
    session: { type: String, trim: true, default: '' },
    date: { type: String, trim: true, default: '' },
    examDate: { type: Date },
    startTime: { type: String, trim: true, default: '09:00' },
    endTime: { type: String, trim: true, default: '' },
    duration: { type: Number, default: 90, min: 1 },
    room: { type: String, trim: true, default: '' }
}, { _id: true });

const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    examType: {
        type: String,
        enum: ['Weekly', 'Monthly', 'Mid-Term', 'Final', 'Quiz', 'Combined'],
        default: 'Mid-Term'
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    term: {
        type: String,
        trim: true,
        default: ''
    },
    academicYear: {
        type: String,
        trim: true,
        default: () => String(new Date().getFullYear())
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    examDate: {
        type: Date,
        default: Date.now
    },
    maxMarks: {
        type: Number,
        required: true,
        default: 100,
        min: 1
    },
    // The subjects included in this exam and their full / pass marks.
    subjects: {
        type: [examSubjectSchema],
        default: []
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        // Scheduled → Ongoing → Completed (marks entered) → Published (visible as results)
        type: String,
        enum: ['Scheduled', 'Ongoing', 'Completed', 'Published'],
        default: 'Scheduled'
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);
