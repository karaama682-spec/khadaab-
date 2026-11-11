const mongoose = require('mongoose');

const quranLessonRecordSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true
    },
    studentName: {
        type: String,
        required: true,
        trim: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    halaqahName: {
        type: String,
        trim: true,
        default: ''
    },
    surahName: {
        type: String,
        required: true,
        trim: true
    },
    surahNumber: {
        type: Number
    },
    fromVerse: {
        type: Number,
        default: 1
    },
    toVerse: {
        type: Number
    },
    lessonType: {
        type: String,
        enum: ['sabaq', 'sabqi', 'manzil', 'dars'],
        default: 'sabaq'
    },
    status: {
        type: String,
        enum: ['passed', 'repeat', 'in_progress'],
        default: 'passed'
    },
    repeatCount: {
        type: Number,
        default: 1,
        min: 1
    },
    note: {
        type: String,
        trim: true,
        default: ''
    },
    // Accountability & Audit: Expected lesson set by Admin vs actual delivered
    studentType: {
        type: String,
        enum: ['LAQDIIN', 'HOREED'],
        default: 'LAQDIIN'
    },
    expectedSurahNumber: {
        type: Number
    },
    expectedSurahName: {
        type: String,
        trim: true
    },
    expectedFromVerse: {
        type: Number
    },
    expectedToVerse: {
        type: Number
    },
    expectedPageOrLines: {
        type: String,
        trim: true,
        default: ''
    },
    actualSurahNumber: {
        type: Number
    },
    actualSurahName: {
        type: String,
        trim: true
    },
    actualFromVerse: {
        type: Number
    },
    actualToVerse: {
        type: Number
    },
    // Did teacher deviate from Admin's assigned lesson?
    isDeviated: {
        type: Boolean,
        default: false,
        index: true
    },
    // Mandatory if teacher modified Admin's assignment
    deviationReason: {
        type: String,
        trim: true,
        default: ''
    },
    // Isku-xir evaluation (Horeed students on scheduled revision days)
    isIskuXirDay: {
        type: Boolean,
        default: false
    },
    iskuXirResult: {
        type: String,
        enum: ['passed', 'repeat', 'none'],
        default: 'none'
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    auditHistory: [
        {
            action: { type: String, required: true },
            performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            role: { type: String },
            timestamp: { type: Date, default: Date.now },
            details: { type: String }
        }
    ],
    date: {
        type: Date,
        default: Date.now,
        index: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch'
    }
}, { timestamps: true });

module.exports = mongoose.model('QuranLessonRecord', quranLessonRecordSchema);
