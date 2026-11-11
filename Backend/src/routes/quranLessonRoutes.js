const express = require('express');
const router = express.Router();
const {
    getQuranLessonRecords,
    createQuranLessonRecord,
    updateQuranLessonRecord,
    deleteQuranLessonRecord,
    getClassQuranSheet,
    batchRecordQuranLessons,
    updateStudentQuranProgress,
    assignStudentQuranPlan,
    getAccountabilityReport
} = require('../controllers/quranLessonController');
const { protect } = require('../middleware/authMiddleware');

router.get('/class-sheet', protect, getClassQuranSheet);
router.post('/batch', protect, batchRecordQuranLessons);
router.put('/progress/:studentId', protect, updateStudentQuranProgress);
router.put('/admin/assign-expectation', protect, assignStudentQuranPlan);
router.get('/accountability/report', protect, getAccountabilityReport);

router.route('/')
    .get(protect, getQuranLessonRecords)
    .post(protect, createQuranLessonRecord);

router.route('/:id')
    .put(protect, updateQuranLessonRecord)
    .delete(protect, deleteQuranLessonRecord);

module.exports = router;
