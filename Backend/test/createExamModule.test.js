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
let createExam, saveExamResults, getClassBroadsheet, getExamResults;
let Branch, Class, Subject, Student, Exam, ExamResult, User;
let branch1, branch2, classA, classB, teacherUser, adminUser, student1, student2, subjectMathA, subjectMathB;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Branch = require('../src/models/Branch');
  Class = require('../src/models/Class');
  Subject = require('../src/models/Subject');
  Student = require('../src/models/Student');
  Exam = require('../src/models/Exam');
  ExamResult = require('../src/models/ExamResult');
  User = require('../src/models/User');

  ({ createExam, saveExamResults, getClassBroadsheet, getExamResults } = require('../src/controllers/examController'));

  // 1. Create Branches
  branch1 = await Branch.create({ name: 'Laanta 1aad (Branch 1)' });
  branch2 = await Branch.create({ name: 'Laanta 2aad (Branch 2)' });

  // 2. Create Users
  adminUser = await User.create({
    fullName: 'Admin User',
    email: 'admin@mach.so',
    passwordHash: 'dummyhash',
    role: 'Institute Admin'
  });

  teacherUser = await User.create({
    fullName: 'Teacher Cali',
    email: 'teacher@mach.so',
    passwordHash: 'dummyhash',
    role: 'Teacher'
  });

  // 3. Create Classes
  classA = await Class.create({
    name: 'Fasalka 1aad A',
    className: 'Fasalka 1aad A',
    branchId: branch1._id
  });

  classB = await Class.create({
    name: 'Fasalka 1aad B',
    className: 'Fasalka 1aad B',
    branchId: branch2._id
  });

  // 4. Create Subjects for Classes
  subjectMathA = await Subject.create({
    name: 'Xisaab',
    classIds: [classA._id],
    teacherId: teacherUser._id,
    branchId: branch1._id,
    nisfiFullMarks: 40,
    nihaayiFullMarks: 60,
    fullMarks: 100,
    passMarks: 40,
    status: 'Active'
  });

  subjectMathB = await Subject.create({
    name: 'Xisaab',
    classIds: [classB._id],
    branchId: branch2._id,
    nisfiFullMarks: 40,
    nihaayiFullMarks: 60,
    fullMarks: 100,
    passMarks: 40,
    status: 'Active'
  });

  // 5. Create Students
  student1 = await Student.create({
    fullName: 'Axmed Cali',
    fatherName: 'Cali Maxamed',
    fatherPhone: '0615551111',
    studentCode: 'ST-001',
    classId: classA._id,
    branchId: branch1._id
  });

  student2 = await Student.create({
    fullName: 'Faadumo Xasan',
    fatherName: 'Xasan Cali',
    fatherPhone: '0615552222',
    studentCode: 'ST-002',
    classId: classB._id,
    branchId: branch2._id
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('1. Validates required fields, date order, and maximum marks on exam creation', async () => {
  // Missing title
  const r1 = await invoke(createExam, {
    body: { title: '', classIds: [classA._id], maxMarks: 50 },
    user: adminUser
  });
  assert.strictEqual(r1.statusCode, 400);
  assert.ok(r1.error.includes('title is required'));

  // Missing classIds
  const r2 = await invoke(createExam, {
    body: { title: 'Mid-Term Exam', classIds: [], maxMarks: 50 },
    user: adminUser
  });
  assert.strictEqual(r2.statusCode, 400);
  assert.ok(r2.error.includes('select at least one class'));

  // Invalid maxMarks (0 or negative)
  const r3 = await invoke(createExam, {
    body: { title: 'Mid-Term Exam', classIds: [classA._id], maxMarks: 0 },
    user: adminUser
  });
  assert.strictEqual(r3.statusCode, 400);
  assert.ok(r3.error.includes('greater than 0'));

  // Invalid date range (endDate < startDate)
  const r4 = await invoke(createExam, {
    body: {
      title: 'Mid-Term Exam',
      classIds: [classA._id],
      maxMarks: 50,
      startDate: '2026-11-10',
      endDate: '2026-11-05'
    },
    user: adminUser
  });
  assert.strictEqual(r4.statusCode, 400);
  assert.ok(r4.error.includes('earlier than start date'));
});

test('2. Creates exams for multiple classes in one operation with auto-populated subjects and configured max marks', async () => {
  const res = await invoke(createExam, {
    body: {
      title: 'Imtixaanka Nisfi Term 1',
      examType: 'Mid-Term',
      classIds: [classA._id, classB._id],
      term: 'Term 1',
      academicYear: '2026-2027',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      maxMarks: 45
    },
    user: adminUser
  });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.length, 2);

  const examForClassA = res.body.find(e => String(e.classId._id || e.classId) === String(classA._id));
  const examForClassB = res.body.find(e => String(e.classId._id || e.classId) === String(classB._id));

  assert.ok(examForClassA, 'Exam created for Class A');
  assert.ok(examForClassB, 'Exam created for Class B');
  assert.strictEqual(examForClassA.maxMarks, 45);
  assert.strictEqual(examForClassB.maxMarks, 45);
  assert.strictEqual(examForClassA.status, 'Scheduled');

  // Verify subjects automatically populated from class subjects with max marks = 45
  assert.strictEqual(examForClassA.subjects.length, 1);
  assert.strictEqual(examForClassA.subjects[0].name, 'Xisaab');
  assert.strictEqual(examForClassA.subjects[0].nisfiFullMarks, 45);
  assert.strictEqual(examForClassA.subjects[0].fullMarks, 45);

  assert.strictEqual(examForClassB.subjects.length, 1);
  assert.strictEqual(examForClassB.subjects[0].name, 'Xisaab');
  assert.strictEqual(examForClassB.subjects[0].nisfiFullMarks, 45);
});

test('3. Prevents duplicate exam creation for the same class and term', async () => {
  const dupRes = await invoke(createExam, {
    body: {
      title: 'Imtixaanka Nisfi Term 1',
      examType: 'Mid-Term',
      classIds: [classA._id],
      term: 'Term 1',
      academicYear: '2026-2027',
      maxMarks: 45
    },
    user: adminUser
  });

  assert.strictEqual(dupRes.statusCode, 400);
  assert.ok(dupRes.error.includes('already exists'));
});

test('4. Enforces mark bounds: rejects negative marks and marks exceeding configured maxMarks', async () => {
  const examDoc = await Exam.findOne({ classId: classA._id, examType: 'Mid-Term' });

  // Exceeds maxMarks (45)
  const overRes = await invoke(saveExamResults, {
    params: { id: examDoc._id },
    body: {
      results: [
        {
          studentId: student1._id,
          marks: [{ subject: 'Xisaab', nisfi: 50 }] // 50 > 45!
        }
      ]
    },
    user: adminUser
  });

  assert.strictEqual(overRes.statusCode, 400);
  assert.ok(overRes.error.includes('45'));

  // Negative mark (-5)
  const negRes = await invoke(saveExamResults, {
    params: { id: examDoc._id },
    body: {
      results: [
        {
          studentId: student1._id,
          marks: [{ subject: 'Xisaab', nisfi: -5 }]
        }
      ]
    },
    user: adminUser
  });

  assert.strictEqual(negRes.statusCode, 400);
  assert.ok(negRes.error.includes('waa inay u dhexeeyaan 0 iyo'));
});

test('5. Enforces teacher authorization on marks entry', async () => {
  // Class B exam: teacherUser does NOT teach class B
  const examB = await Exam.findOne({ classId: classB._id, examType: 'Mid-Term' });

  const unauthorizedRes = await invoke(saveExamResults, {
    params: { id: examB._id },
    body: {
      results: [
        {
          studentId: student2._id,
          marks: [{ subject: 'Xisaab', nisfi: 40 }]
        }
      ]
    },
    user: teacherUser // not assigned to class B!
  });

  assert.strictEqual(unauthorizedRes.statusCode, 403);
  assert.ok(unauthorizedRes.error.includes('Not authorized'));

  // Class A exam: teacherUser DOES teach Xisaab in class A
  const examA = await Exam.findOne({ classId: classA._id, examType: 'Mid-Term' });
  const authorizedRes = await invoke(saveExamResults, {
    params: { id: examA._id },
    body: {
      results: [
        {
          studentId: student1._id,
          marks: [{ subject: 'Xisaab', nisfi: 40 }]
        }
      ]
    },
    user: teacherUser
  });

  assert.strictEqual(authorizedRes.statusCode, 200);
  assert.strictEqual(authorizedRes.body.saved, 1);
});

test('6. Nisfi and Nihaayi Result Calculation: combines configured Nisfi (40/45) and Nihaayi (50/55) dynamically into 90/100', async () => {
  // Create Nihaayi (Final) exam for Class A with maxMarks = 55
  const finalRes = await invoke(createExam, {
    body: {
      title: 'Imtixaanka Nihaayi Term 1',
      examType: 'Final',
      classIds: [classA._id],
      term: 'Term 1',
      academicYear: '2026-2027',
      maxMarks: 55
    },
    user: adminUser
  });

  assert.strictEqual(finalRes.statusCode, 201);
  const finalExamA = Array.isArray(finalRes.body) ? finalRes.body[0] : finalRes.body;
  assert.strictEqual(finalExamA.maxMarks, 55);

  // Save Final mark: 50 out of 55
  const saveFinalRes = await invoke(saveExamResults, {
    params: { id: finalExamA._id },
    body: {
      results: [
        {
          studentId: student1._id,
          marks: [{ subject: 'Xisaab', nihaayi: 50 }]
        }
      ]
    },
    user: adminUser
  });
  assert.strictEqual(saveFinalRes.statusCode, 200);

  // Fetch Class Broadsheet (Nisfi 40/45 + Nihaayi 50/55 = 90/100)
  const broadsheetRes = await invoke(getClassBroadsheet, {
    params: { classId: classA._id },
    query: { term: 'Term 1', academicYear: '2026-2027' },
    user: adminUser
  });

  assert.strictEqual(broadsheetRes.statusCode, 200);
  const data = broadsheetRes.body;

  // Check config
  assert.strictEqual(data.config.nisfiMax, 45, 'Configured Nisfi max is 45');
  assert.strictEqual(data.config.nihaayiMax, 55, 'Configured Nihaayi max is 55');
  assert.strictEqual(data.config.combinedMax, 100, 'Combined max is 45 + 55 = 100');

  // Check student result
  const studentRow = data.results.find(r => String(r.studentId) === String(student1._id));
  assert.ok(studentRow, 'Student row found');

  const mathRes = studentRow.subjects.find(s => s.subject === 'Xisaab');
  assert.ok(mathRes, 'Math subject result found');
  assert.strictEqual(mathRes.nisfi, 40, 'Nisfi obtained is 40');
  assert.strictEqual(mathRes.nihaayi, 50, 'Nihaayi obtained is 50');
  assert.strictEqual(mathRes.marksObtained, 90, 'Combined mark obtained is 40 + 50 = 90');
  assert.strictEqual(mathRes.fullMarks, 100, 'Subject full marks is 45 + 55 = 100');
  assert.strictEqual(studentRow.totalObtained, 90);
  assert.strictEqual(studentRow.totalFull, 100);
  assert.strictEqual(studentRow.percentage, 90);
  assert.strictEqual(studentRow.status, 'Pass');
});
