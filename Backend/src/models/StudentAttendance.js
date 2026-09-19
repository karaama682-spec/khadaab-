const mongoose = require('mongoose');

const studentAttendanceSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    status: {
        type: String,
        enum: ['Present', 'Late', 'Absent', 'Partial'],
        default: 'Present'
    },
    attendanceType: {
        type: String,
        enum: ['Daily', 'Session'],
        default: 'Daily'
    },
    session: {
        type: String,
        enum: ['Morning', 'Breakfast', 'Evening', null],
        default: null
    },
    arrivalTime: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Index for fast lookups by student, date, attendanceType, and session
studentAttendanceSchema.index({ studentId: 1, date: -1, attendanceType: 1, session: 1, createdAt: -1 });
studentAttendanceSchema.index({ classId: 1, date: -1, attendanceType: 1 });

// Enforce that Daily attendance is unique per student per date
studentAttendanceSchema.index(
    { studentId: 1, date: 1 },
    {
        unique: true,
        partialFilterExpression: { attendanceType: 'Daily' },
        name: 'unique_student_date_daily'
    }
);

const StudentAttendance = mongoose.model('StudentAttendance', studentAttendanceSchema);

// A previous version created a non-partial unique { studentId, date } index that blocked sessions.
// We remove that legacy index if present, while keeping the partial unique index for Daily attendance.
StudentAttendance.removeLegacyDailyUniqueIndex = async () => {
    let indexes = [];
    try {
        indexes = await StudentAttendance.collection.indexes();
    } catch (error) {
        // A fresh database has no collection or indexes yet.
        if (error.code !== 26) throw error;
    }

    const legacyIndex = indexes.find(index =>
        index.unique &&
        index.name !== 'unique_student_date_daily' &&
        index.key?.studentId === 1 &&
        index.key?.date === 1 &&
        Object.keys(index.key).length === 2 &&
        !index.partialFilterExpression
    );

    if (legacyIndex) {
        await StudentAttendance.collection.dropIndex(legacyIndex.name);
        console.log('Removed legacy student attendance daily unique index.');
    }

    await StudentAttendance.createIndexes();
};

module.exports = StudentAttendance;
