const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const invoke = (handler, { query = {}, body = {}, params = {}, user = {} }) => new Promise((resolve, reject) => {
  const req = { query, body, params, user };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
  };
  handler(req, res, (err) => {
    if (err) {
      resolve({ statusCode: res.statusCode === 200 ? 500 : res.statusCode, error: err.message });
    } else {
      reject(new Error('unexpected next() with no error'));
    }
  });
});

let mongod;
let getClassTimetable, addExamScheduleSubject, updateExamScheduleSubject, deleteExamScheduleSubject, createExam;
let Branch, Class, Exam, User;
let branch, testClass, adminUser, testExam;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Branch = require('../src/models/Branch');
  Class = require('../src/models/Class');
  Exam = require('../src/models/Exam');
  User = require('../src/models/User');

  ({
    getClassTimetable,
    addExamScheduleSubject,
    updateExamScheduleSubject,
    deleteExamScheduleSubject,
    createExam
  } = require('../src/controllers/examController'));

  branch = await Branch.create({ name: 'Main Campus' });
  adminUser = await User.create({
    fullName: 'Admin User',
    email: 'admin@school.com',
    passwordHash: 'dummy',
    role: 'Institute Admin'
  });

  testClass = await Class.create({
    name: 'Form 4A',
    className: 'Form 4',
    branchId: branch._id,
    academicYear: '2026'
  });

  // Create an exam for this class
  testExam = await Exam.create({
    title: 'First Term Final Examination',
    examType: 'Final',
    branchId: branch._id,
    classId: testClass._id,
    term: 'Term 1',
    academicYear: '2026',
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-11-10'),
    maxMarks: 60,
    subjects: []
  });
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('1. addExamScheduleSubject: validates required subject name', async () => {
  const res = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: { name: '   ', duration: 90 }
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.error, /Subject name is required/i);
});

test('2. addExamScheduleSubject: validates duration > 0', async () => {
  const resInvalid = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: { name: 'Mathematics', duration: 0 }
  });

  assert.equal(resInvalid.statusCode, 400);
  assert.match(resInvalid.error, /Duration must be a positive number/i);

  const resNegative = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: { name: 'Mathematics', duration: -30 }
  });

  assert.equal(resNegative.statusCode, 400);
  assert.match(resNegative.error, /Duration must be a positive number/i);
});

test('3. addExamScheduleSubject: successfully adds scheduled subject with code, date, startTime, duration', async () => {
  const res = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: {
      name: 'English',
      code: '210',
      date: '2026-11-02',
      startTime: '11:30:00',
      duration: 120,
      room: 'Hall B',
      fullMarks: 60
    }
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.subjects.length, 1);
  const scheduled = res.body.subjects[0];
  assert.equal(scheduled.name, 'English');
  assert.equal(scheduled.code, '210');
  assert.equal(scheduled.date, '2026-11-02');
  assert.equal(scheduled.startTime, '11:30:00');
  assert.equal(scheduled.duration, 120);
  assert.equal(scheduled.room, 'Hall B');
  assert.equal(scheduled.day, 'Monday');
  assert.equal(scheduled.endTime, '13:30:00');
});

test('4. addExamScheduleSubject: prevents duplicate subject on same exam', async () => {
  const res = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: {
      name: 'english', // case-insensitive check
      duration: 90
    }
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.error, /already scheduled for this exam/i);
});

test('5. addExamScheduleSubject: adds second subject (Mathematics) and verifies Sunday & Thursday (5/11/2026)', async () => {
  const res = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: {
      name: 'Mathematics',
      code: '101',
      date: '2026-11-01', // earlier date than English (Sunday)
      startTime: '08:30:00',
      duration: 90,
      room: 'Hall A'
    }
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.subjects.length, 2);
  const mathSub = res.body.subjects.find(s => s.name === 'Mathematics');
  assert.equal(mathSub.day, 'Sunday');
  assert.equal(mathSub.endTime, '10:00:00');

  // Test user's specific example date: 5/11/2026 (2026-11-05 -> Thursday)
  const resThursday = await invoke(addExamScheduleSubject, {
    params: { id: testExam._id.toString() },
    body: {
      name: 'Science',
      code: '301',
      date: '2026-11-05',
      startTime: '10:00:00',
      duration: 90
    }
  });

  assert.equal(resThursday.statusCode, 201);
  const sciSub = resThursday.body.subjects.find(s => s.name === 'Science');
  assert.equal(sciSub.day, 'Thursday');
  assert.equal(sciSub.endTime, '11:30:00');
});

test('6. getClassTimetable: returns timetable sorted chronologically by date and startTime', async () => {
  const res = await invoke(getClassTimetable, {
    params: { classId: testClass._id.toString() },
    query: { term: 'Term 1', academicYear: '2026' }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.exams.length, 1);
  const exam = res.body.exams[0];
  assert.equal(exam.subjects.length, 3);

  // Mathematics (2026-11-01) must appear before English (2026-11-02) and Science (2026-11-05)
  assert.equal(exam.subjects[0].name, 'Mathematics');
  assert.equal(exam.subjects[0].date, '2026-11-01');
  assert.equal(exam.subjects[1].name, 'English');
  assert.equal(exam.subjects[1].date, '2026-11-02');
  assert.equal(exam.subjects[2].name, 'Science');
  assert.equal(exam.subjects[2].date, '2026-11-05');
});

test('7. updateExamScheduleSubject: updates details and validates duration and duplicate name', async () => {
  const exam = await Exam.findById(testExam._id);
  const mathSubject = exam.subjects.find(s => s.name === 'Mathematics');
  assert.ok(mathSubject, 'Mathematics subject exists');

  // Attempt duplicate name update to 'English'
  const resDuplicate = await invoke(updateExamScheduleSubject, {
    params: { id: testExam._id.toString(), subjectId: mathSubject._id.toString() },
    body: { name: 'English' }
  });
  assert.equal(resDuplicate.statusCode, 400);
  assert.match(resDuplicate.error, /already exists on this exam/i);

  // Attempt invalid duration
  const resInvalidDur = await invoke(updateExamScheduleSubject, {
    params: { id: testExam._id.toString(), subjectId: mathSubject._id.toString() },
    body: { duration: -10 }
  });
  assert.equal(resInvalidDur.statusCode, 400);

  // Successful update
  const resValid = await invoke(updateExamScheduleSubject, {
    params: { id: testExam._id.toString(), subjectId: mathSubject._id.toString() },
    body: {
      duration: 105,
      startTime: '09:00:00',
      room: 'Main Auditorium'
    }
  });

  assert.equal(resValid.statusCode, 200);
  const updatedMath = resValid.body.subjects.find(s => s.name === 'Mathematics');
  assert.equal(updatedMath.duration, 105);
  assert.equal(updatedMath.startTime, '09:00:00');
  assert.equal(updatedMath.room, 'Main Auditorium');
});

test('8. deleteExamScheduleSubject: removes subject from exam schedule', async () => {
  const exam = await Exam.findById(testExam._id);
  const englishSubject = exam.subjects.find(s => s.name === 'English');

  const res = await invoke(deleteExamScheduleSubject, {
    params: { id: testExam._id.toString(), subjectId: englishSubject._id.toString() }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.subjects.length, 2);
  assert.ok(res.body.subjects.some(s => s.name === 'Mathematics'));
  assert.ok(res.body.subjects.some(s => s.name === 'Science'));

  // Deleting again or non-existent returns 404
  const resNotFound = await invoke(deleteExamScheduleSubject, {
    params: { id: testExam._id.toString(), subjectId: englishSubject._id.toString() }
  });
  assert.equal(resNotFound.statusCode, 404);
});
