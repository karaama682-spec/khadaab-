const assert = require('assert');

// Test data
const { QURAN_SURAHS } = require('../src/data/quranSurahs');

console.log('--- Testing Quran Accountability Logic ---');

// 1. Verify Quran Surahs dataset
assert.strictEqual(QURAN_SURAHS.length, 114, 'Must have 114 Surahs');
assert.strictEqual(QURAN_SURAHS[0].nameAr, 'الفاتحة', 'First Surah is Al-Faatixa');
console.log('✓ Surahs dataset verified (114 surahs)');

// 2. Test Rule 4 Validation: Teacher deviation without reason must be rejected
function validateTeacherLessonSubmission(item, student, userRole) {
    const expConfig = student.expectedLessonConfig || {};
    const expSurah = Number(item.expectedSurahNumber || expConfig.surahNumber || 1);
    const expFrom = Number(item.expectedFromVerse || expConfig.fromVerse || 1);
    const expTo = Number(item.expectedToVerse || expConfig.toVerse || (expFrom + 4));

    const actSurah = Number(item.surahNumber || expSurah);
    const actFrom = Number(item.fromVerse || expFrom);
    const actTo = Number(item.toVerse || expTo);

    const isDeviated = (actSurah !== expSurah) || (actFrom !== expFrom) || (actTo !== expTo);
    const reason = (item.deviationReason || '').trim();

    if (isDeviated && !reason && userRole === 'Teacher') {
        throw new Error('Macallinka looma ogola inuu aayadaha beddelo isagoo aan sabab bixin (Deviation reason is required)');
    }

    return { isDeviated, deviationReason: reason };
}

const mockStudent = {
    fullName: 'Axmed Cali',
    studentType: 'HOREED',
    expectedLessonConfig: {
        surahNumber: 2, // Al-Baqarah
        fromVerse: 1,
        toVerse: 10,
        dailyPace: 10
    }
};

// Case A: Teacher delivers exact lesson -> should succeed without reason
const exactSubmission = {
    surahNumber: 2,
    fromVerse: 1,
    toVerse: 10
};
const resA = validateTeacherLessonSubmission(exactSubmission, mockStudent, 'Teacher');
assert.strictEqual(resA.isDeviated, false, 'Should not be deviated when matching expected');
console.log('✓ Case A: Matching lesson passes without deviation');

// Case B: Teacher changes verses without reason -> MUST FAIL with Rule 4
const deviatedNoReason = {
    surahNumber: 2,
    fromVerse: 1,
    toVerse: 5 // Changed from 10 to 5
};
assert.throws(() => {
    validateTeacherLessonSubmission(deviatedNoReason, mockStudent, 'Teacher');
}, /Deviation reason is required/, 'Must reject deviation without reason for Teacher');
console.log('✓ Case B: Deviated lesson without reason correctly rejected (Rule 4 enforced)');

// Case C: Teacher changes verses WITH reason -> MUST PASS and record reason
const deviatedWithReason = {
    surahNumber: 2,
    fromVerse: 1,
    toVerse: 5,
    deviationReason: 'Ardaygu aayadaha dambe ma soo qaban'
};
const resC = validateTeacherLessonSubmission(deviatedWithReason, mockStudent, 'Teacher');
assert.strictEqual(resC.isDeviated, true, 'Must flag isDeviated as true');
assert.strictEqual(resC.deviationReason, 'Ardaygu aayadaha dambe ma soo qaban', 'Must store deviation reason');
console.log('✓ Case C: Deviated lesson with reason accepted and audited');

// 3. Test Isku-Xir Day Matching for HOREED students
const SOMALI_DAYS = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
function isIskuXirScheduled(student, targetDate) {
    if (student.studentType !== 'HOREED') return false;
    if (!student.iskuXirConfig || !student.iskuXirConfig.isActive) return false;
    const currentDay = SOMALI_DAYS[targetDate.getDay()].toLowerCase();
    const days = (student.iskuXirConfig.revisionDays || []).map(d => String(d).toLowerCase());
    return days.includes(currentDay);
}

const horeedStudent = {
    studentType: 'HOREED',
    iskuXirConfig: {
        isActive: true,
        revisionDays: ['Sabti', 'Talaado']
    }
};

const laqdiinStudent = {
    studentType: 'LAQDIIN',
    iskuXirConfig: {
        isActive: false
    }
};

// Tuesday is day 2 ('Talaado')
const tuesdayDate = new Date('2026-11-10T12:00:00Z'); // Nov 10, 2026 is Tuesday
assert.strictEqual(isIskuXirScheduled(horeedStudent, tuesdayDate), true, 'Tuesday should be Isku-Xir for Horeed student');
assert.strictEqual(isIskuXirScheduled(laqdiinStudent, tuesdayDate), false, 'Laqdiin students do not have Isku-Xir');
console.log('✓ Isku-Xir schedule calculation verified');

// 4. Test Teacher Class Isolation
function canTeacherAccessClass(teacherId, classDoc) {
    if (!classDoc || !classDoc.teacherId) return false;
    return String(classDoc.teacherId) === String(teacherId);
}

assert.strictEqual(canTeacherAccessClass('teacher123', { teacherId: 'teacher123' }), true);
assert.strictEqual(canTeacherAccessClass('teacher123', { teacherId: 'otherTeacher456' }), false);
console.log('✓ Teacher class isolation check verified');

console.log('--- ALL QURAN ACCOUNTABILITY TESTS PASSED! ---');
