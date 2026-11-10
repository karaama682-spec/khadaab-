const express = require('express');
const router = express.Router();
const {
    getExams,
    getExamById,
    createExam,
    updateExam,
    deleteExam,
    getExamResults,
    saveExamResults,
    getStudentResult,
    publishExam,
    getClassBroadsheet,
    getClassTimetable,
    addExamScheduleSubject,
    updateExamScheduleSubject,
    deleteExamScheduleSubject,
    getExamDashboardSummary
} = require('../controllers/examController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getExams)
    .post(protect, createExam);

router.get('/dashboard-summary', protect, getExamDashboardSummary);
router.get('/class/:classId/broadsheet', protect, getClassBroadsheet);
router.get('/class/:classId/timetable', protect, getClassTimetable);

router.route('/:id')
    .get(protect, getExamById)
    .put(protect, updateExam)
    .delete(protect, deleteExam);

router.patch('/:id/publish', protect, publishExam);

// Schedule / Timetable routes
router.post('/:id/schedule', protect, addExamScheduleSubject);
router.route('/:id/schedule/:subjectId')
    .put(protect, updateExamScheduleSubject)
    .delete(protect, deleteExamScheduleSubject);

router.route('/:id/results')
    .get(protect, getExamResults)
    .post(protect, saveExamResults);

router.get('/:id/results/:studentId', protect, getStudentResult);

module.exports = router;
