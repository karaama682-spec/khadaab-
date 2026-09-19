const express = require('express');
const router = express.Router();
const {
    getStudentAttendances,
    getStudentAttendanceById,
    createStudentAttendance,
    getStudentAttendanceHistory,
    updateStudentAttendance,
    deleteStudentAttendance
} = require('../controllers/studentAttendanceController');
const { protect } = require('../middleware/authMiddleware');
const { checkAnyPermissionSet } = require('../middleware/roleMiddleware');

// Attendance records are read by the register and by the Attendance Ledger
// report, so either grant admits a read.
const canReadAttendance = checkAnyPermissionSet([
    { moduleName: 'Attendance', actions: ['Read'], subModuleName: 'Student Attendance' },
    { moduleName: 'Reports', actions: ['Read'], subModuleName: 'Attendance Ledger' }
]);

// The register and the report screens both correct attendance.
const canWriteAttendance = checkAnyPermissionSet([
    { moduleName: 'Attendance', actions: ['Add', 'Edit'], subModuleName: 'Student Attendance' },
    { moduleName: 'Reports', actions: ['Add', 'Edit'], subModuleName: 'Attendance Ledger' }
]);

router.route('/')
    .get(protect, canReadAttendance, getStudentAttendances)
    .post(protect, canWriteAttendance, createStudentAttendance);

router.route('/history')
    .get(protect, canReadAttendance, getStudentAttendanceHistory);

router.route('/:id')
    .get(protect, canReadAttendance, getStudentAttendanceById)
    .put(protect, canWriteAttendance, updateStudentAttendance)
    .delete(protect, checkAnyPermissionSet([
        { moduleName: 'Attendance', actions: ['Delete', 'Edit'], subModuleName: 'Student Attendance' },
        { moduleName: 'Reports', actions: ['Delete', 'Edit'], subModuleName: 'Attendance Ledger' }
    ]), deleteStudentAttendance);

module.exports = router;
