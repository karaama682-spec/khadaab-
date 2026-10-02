const express = require('express');
const router = express.Router();
const {
    getQuranSurahRecords,
    createQuranSurahRecord,
    updateQuranSurahRecord,
    deleteQuranSurahRecord
} = require('../controllers/quranSurahController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getQuranSurahRecords)
    .post(protect, createQuranSurahRecord);

router.route('/:id')
    .put(protect, updateQuranSurahRecord)
    .delete(protect, deleteQuranSurahRecord);

module.exports = router;
