const express = require('express');
const router = express.Router();
const {
    getStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent
} = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const { checkPermission, checkAnyPermissionSet } = require('../middleware/roleMiddleware');

// Reading students also backs the attendance and fee reports, so a reporting
// grant is accepted as well as the Students grant itself.
const canReadStudents = checkAnyPermissionSet([
    { moduleName: 'Academic Management', actions: ['Read'], subModuleName: 'Students' },
    { moduleName: 'Reports', actions: ['Read'] }
]);

router.route('/')
    .get(protect, canReadStudents, getStudents)
    .post(protect, checkPermission('Academic Management', 'Add', 'Students'), createStudent);

router.route('/:id')
    .get(protect, canReadStudents, getStudentById)
    .put(protect, checkPermission('Academic Management', 'Edit', 'Students'), updateStudent)
    .delete(protect, checkPermission('Academic Management', 'Delete', 'Students'), deleteStudent);

module.exports = router;
