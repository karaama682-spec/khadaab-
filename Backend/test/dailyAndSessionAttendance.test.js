const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const StudentAttendance = require('../src/models/StudentAttendance');
require('../src/models/Class');
require('../src/models/Student');
require('../src/models/Branch');
require('../src/models/User');
const {
  getStudentAttendances,
  createStudentAttendance,
  deleteStudentAttendance
} = require('../src/controllers/studentAttendanceController');

const invoke = (handler, { query = {}, params = {}, body = {}, user = {} } = {}) =>
  new Promise((resolve, reject) => {
    const req = { query, params, body, user };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ statusCode: this.statusCode, body: payload }); }
    };
    handler(req, res, (err) => reject(err || new Error('unexpected next()')));
  });

test('Daily Attendance and Session Attendance are independent and coexist without overwriting', async (t) => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  t.after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  const studentId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();
  const date = '2026-09-19';

  // 1. Create Daily Attendance: Present
  const dailyRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Present'
    }]
  });

  assert.strictEqual(dailyRes.statusCode, 201);
  assert.strictEqual(dailyRes.body.length, 1);
  const dailyRecord = dailyRes.body[0];
  assert.strictEqual(dailyRecord.attendanceType, 'Daily');
  assert.strictEqual(dailyRecord.status, 'Present');
  assert.strictEqual(dailyRecord.session, null);

  // 2. Create Session Attendance: Morning -> Late
  const morningRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Session',
      session: 'Morning',
      status: 'Late',
      arrivalTime: '07:15',
      description: 'Traffic delay'
    }]
  });

  assert.strictEqual(morningRes.statusCode, 201);
  const morningRecord = morningRes.body[0];
  assert.strictEqual(morningRecord.attendanceType, 'Session');
  assert.strictEqual(morningRecord.session, 'Morning');
  assert.strictEqual(morningRecord.status, 'Late');
  assert.strictEqual(morningRecord.arrivalTime, '07:15');

  // 3. Create Session Attendance: Breakfast -> Partial
  const breakfastRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Session',
      session: 'Breakfast',
      status: 'Partial',
      description: 'Left early for appointment'
    }]
  });

  assert.strictEqual(breakfastRes.statusCode, 201);
  const breakfastRecord = breakfastRes.body[0];
  assert.strictEqual(breakfastRecord.attendanceType, 'Session');
  assert.strictEqual(breakfastRecord.session, 'Breakfast');
  assert.strictEqual(breakfastRecord.status, 'Partial');

  // 4. Verify all three exist independently in database
  const getRes = await invoke(getStudentAttendances, {
    query: { studentId: studentId.toString(), date }
  });

  assert.strictEqual(getRes.statusCode, 200);
  assert.strictEqual(getRes.body.length, 3, 'Expected Daily, Morning, and Breakfast to all exist together');

  const foundDaily = getRes.body.find(r => r.attendanceType === 'Daily');
  assert.ok(foundDaily);
  assert.strictEqual(foundDaily.status, 'Present');

  const foundMorning = getRes.body.find(r => r.session === 'Morning');
  assert.ok(foundMorning);
  assert.strictEqual(foundMorning.status, 'Late');
  assert.strictEqual(foundMorning.arrivalTime, '07:15');

  const foundBreakfast = getRes.body.find(r => r.session === 'Breakfast');
  assert.ok(foundBreakfast);
  assert.strictEqual(foundBreakfast.status, 'Partial');

  // 5. Update Daily Attendance to Absent - should NOT affect Morning or Breakfast
  const updateDailyRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Absent',
      description: 'Not feeling well'
    }]
  });

  assert.strictEqual(updateDailyRes.statusCode, 201);

  const getResAfterDailyUpdate = await invoke(getStudentAttendances, {
    query: { studentId: studentId.toString(), date }
  });
  assert.strictEqual(getResAfterDailyUpdate.body.length, 3, 'Updating Daily must not delete or duplicate session records');
  const updatedDaily = getResAfterDailyUpdate.body.find(r => r.attendanceType === 'Daily');
  assert.strictEqual(updatedDaily.status, 'Absent');
  const stillMorning = getResAfterDailyUpdate.body.find(r => r.session === 'Morning');
  assert.strictEqual(stillMorning.status, 'Late');

  // 6. Delete Session Morning - should NOT affect Daily or Breakfast
  const deleteRes = await invoke(deleteStudentAttendance, {
    params: { id: morningRecord._id.toString() }
  });
  assert.strictEqual(deleteRes.statusCode, 200);

  const getResAfterDelete = await invoke(getStudentAttendances, {
    query: { studentId: studentId.toString(), date }
  });
  assert.strictEqual(getResAfterDelete.body.length, 2, 'Morning session removed, Daily and Breakfast remain intact');
  assert.ok(getResAfterDelete.body.some(r => r.attendanceType === 'Daily'));
  assert.ok(getResAfterDelete.body.some(r => r.session === 'Breakfast'));
  assert.ok(!getResAfterDelete.body.some(r => r.session === 'Morning'));
});

test('Daily Attendance: Edit transitions (Absent->Present, Present->Absent, Absent->Absent new description), uniqueness, and Delete Daily isolation', async (t) => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  t.after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  await StudentAttendance.createIndexes();

  const studentId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();
  const date = '2026-09-20';

  // Also create a Session Attendance record to verify Delete Daily does not touch it
  const sessionRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Session',
      session: 'Morning',
      status: 'Late',
      arrivalTime: '08:15',
      description: 'Traffic'
    }]
  });
  assert.strictEqual(sessionRes.statusCode, 201);
  const sessionId = sessionRes.body[0]._id;

  // 1. Initial Save: Absent with description
  const saveDailyRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Absent',
      description: 'Fever and headache'
    }]
  });

  assert.strictEqual(saveDailyRes.statusCode, 201);
  const savedDaily = saveDailyRes.body[0];
  const initialDailyId = savedDaily._id.toString();
  assert.strictEqual(savedDaily.status, 'Absent');
  assert.strictEqual(savedDaily.description, 'Fever and headache');
  assert.strictEqual(savedDaily.attendanceType, 'Daily');

  let allDailyInDb = await StudentAttendance.find({ studentId, date, attendanceType: 'Daily' });
  assert.strictEqual(allDailyInDb.length, 1, 'Only 1 Daily record in DB');

  // 2. Edit Daily: Absent -> Present (description must be cleared, same record updated)
  const editToPresentRes = await invoke(createStudentAttendance, {
    body: [{
      _id: savedDaily._id,
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Present',
      description: ''
    }]
  });

  assert.strictEqual(editToPresentRes.statusCode, 201);
  const updatedToPresent = editToPresentRes.body[0];
  assert.strictEqual(updatedToPresent._id.toString(), initialDailyId, 'Must update existing record, not create duplicate');
  assert.strictEqual(updatedToPresent.status, 'Present');
  assert.strictEqual(updatedToPresent.description, '', 'Present status must clear description');

  allDailyInDb = await StudentAttendance.find({ studentId, date, attendanceType: 'Daily' });
  assert.strictEqual(allDailyInDb.length, 1, 'Still strictly 1 Daily record after Absent -> Present');

  // 3. Edit Daily: Present -> Absent with a description
  const editToAbsentRes = await invoke(createStudentAttendance, {
    body: [{
      _id: savedDaily._id,
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Absent',
      description: 'Doctor appointment'
    }]
  });

  assert.strictEqual(editToAbsentRes.statusCode, 201);
  const updatedToAbsent = editToAbsentRes.body[0];
  assert.strictEqual(updatedToAbsent._id.toString(), initialDailyId, 'Must update existing record, not create duplicate');
  assert.strictEqual(updatedToAbsent.status, 'Absent');
  assert.strictEqual(updatedToAbsent.description, 'Doctor appointment');

  allDailyInDb = await StudentAttendance.find({ studentId, date, attendanceType: 'Daily' });
  assert.strictEqual(allDailyInDb.length, 1, 'Still strictly 1 Daily record after Present -> Absent');

  // 4. Edit Daily: Absent -> Absent with a new description
  const editDescriptionRes = await invoke(createStudentAttendance, {
    body: [{
      _id: savedDaily._id,
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Absent',
      description: 'Specialist visit in hospital'
    }]
  });

  assert.strictEqual(editDescriptionRes.statusCode, 201);
  const updatedDescription = editDescriptionRes.body[0];
  assert.strictEqual(updatedDescription._id.toString(), initialDailyId, 'Must update existing record, not create duplicate');
  assert.strictEqual(updatedDescription.status, 'Absent');
  assert.strictEqual(updatedDescription.description, 'Specialist visit in hospital');

  allDailyInDb = await StudentAttendance.find({ studentId, date, attendanceType: 'Daily' });
  assert.strictEqual(allDailyInDb.length, 1, 'Still strictly 1 Daily record after description change');

  // 5. Uniqueness: Direct insert attempt with duplicate (studentId + date + Daily) must be prevented
  let duplicateThrew = false;
  try {
    await StudentAttendance.create({
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Present'
    });
  } catch (err) {
    duplicateThrew = true;
    assert.strictEqual(err.code, 11000, 'Unique index must prevent duplicate Daily record');
  }
  assert.ok(duplicateThrew, 'Expected duplicate key error 11000 on duplicate Daily insert');

  // 6. Delete Daily: Must delete ONLY the Daily record; Session Attendance must remain untouched
  const deleteDailyRes = await invoke(deleteStudentAttendance, {
    params: { id: initialDailyId }
  });
  assert.strictEqual(deleteDailyRes.statusCode, 200);

  // Verify Daily is deleted
  const dailyAfterDelete = await StudentAttendance.findById(initialDailyId);
  assert.strictEqual(dailyAfterDelete, null, 'Daily record must be deleted');

  // Verify Session record still exists
  const sessionAfterDelete = await StudentAttendance.findById(sessionId);
  assert.ok(sessionAfterDelete, 'Session attendance must NOT be affected by Delete Daily');
  assert.strictEqual(sessionAfterDelete.attendanceType, 'Session');
  assert.strictEqual(sessionAfterDelete.session, 'Morning');
  assert.strictEqual(sessionAfterDelete.status, 'Late');
});

test('Daily Absent Lock: Session Attendance is locked while Daily = Absent, unlocked when Daily = Present, and existing Session records preserved', async (t) => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  t.after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  await StudentAttendance.createIndexes();

  const studentId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();
  const date = '2026-09-21';

  // 1. Save Daily Attendance as Absent
  const dailyAbsentRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Absent',
      description: 'Family emergency'
    }]
  });
  assert.strictEqual(dailyAbsentRes.statusCode, 201);
  const dailyId = dailyAbsentRes.body[0]._id.toString();

  // 2. Attempt to record Morning Session Attendance while Daily = Absent -> MUST FAIL with 400
  let morningBlocked = false;
  try {
    await invoke(createStudentAttendance, {
      body: [{
        studentId,
        classId,
        date,
        attendanceType: 'Session',
        session: 'Morning',
        status: 'Late',
        arrivalTime: '08:45',
        description: 'Late arrival'
      }]
    });
  } catch (err) {
    morningBlocked = true;
    assert.match(err.message, /Session Attendance cannot be recorded/i);
  }
  assert.ok(morningBlocked, 'Morning session recording must be rejected while Daily = Absent');

  // 2b. Attempt to record Breakfast / Evening Session Attendance -> MUST ALSO FAIL with 400
  let breakfastBlocked = false;
  try {
    await invoke(createStudentAttendance, {
      body: [{
        studentId,
        classId,
        date,
        attendanceType: 'Session',
        session: 'Breakfast',
        status: 'Partial',
        description: 'Left early'
      }]
    });
  } catch (err) {
    breakfastBlocked = true;
    assert.match(err.message, /Session Attendance cannot be recorded/i);
  }
  assert.ok(breakfastBlocked, 'Breakfast session recording must be rejected while Daily = Absent');

  // Verify no Session attendance was created in DB
  const sessionRecordsWhileAbsent = await StudentAttendance.find({ studentId, date, attendanceType: 'Session' });
  assert.strictEqual(sessionRecordsWhileAbsent.length, 0, 'No session records should exist while Daily = Absent');

  // 3. Edit Daily: Change Absent -> Present
  const editDailyToPresentRes = await invoke(createStudentAttendance, {
    body: [{
      _id: dailyId,
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Present'
    }]
  });
  assert.strictEqual(editDailyToPresentRes.statusCode, 201);
  assert.strictEqual(editDailyToPresentRes.body[0].status, 'Present');

  // 4. Now that Daily = Present, Morning and Breakfast session attendance CAN be recorded normally
  const morningSessionRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Session',
      session: 'Morning',
      status: 'Late',
      arrivalTime: '08:30',
      description: 'Traffic delay'
    }]
  });
  assert.strictEqual(morningSessionRes.statusCode, 201);
  assert.strictEqual(morningSessionRes.body[0].status, 'Late');
  assert.strictEqual(morningSessionRes.body[0].session, 'Morning');
  const morningSessionId = morningSessionRes.body[0]._id.toString();

  const breakfastSessionRes = await invoke(createStudentAttendance, {
    body: [{
      studentId,
      classId,
      date,
      attendanceType: 'Session',
      session: 'Breakfast',
      status: 'Partial',
      description: 'Attended partial session'
    }]
  });
  assert.strictEqual(breakfastSessionRes.statusCode, 201);
  assert.strictEqual(breakfastSessionRes.body[0].status, 'Partial');

  // 5. Change Daily back to Absent: Existing Session records MUST NOT be deleted or modified
  const editDailyBackToAbsentRes = await invoke(createStudentAttendance, {
    body: [{
      _id: dailyId,
      studentId,
      classId,
      date,
      attendanceType: 'Daily',
      status: 'Absent',
      description: 'Felt ill after morning'
    }]
  });
  assert.strictEqual(editDailyBackToAbsentRes.statusCode, 201);

  // Existing session records must still be present and unmodified
  const morningAfterDailyAbsent = await StudentAttendance.findById(morningSessionId);
  assert.ok(morningAfterDailyAbsent, 'Existing morning session record must NOT be deleted');
  assert.strictEqual(morningAfterDailyAbsent.status, 'Late');
  assert.strictEqual(morningAfterDailyAbsent.description, 'Traffic delay');

  // But new session records (e.g. Evening) or updates while Daily = Absent must be blocked
  let eveningBlocked = false;
  try {
    await invoke(createStudentAttendance, {
      body: [{
        studentId,
        classId,
        date,
        attendanceType: 'Session',
        session: 'Evening',
        status: 'Late',
        arrivalTime: '17:00'
      }]
    });
  } catch (err) {
    eveningBlocked = true;
    assert.match(err.message, /Session Attendance cannot be recorded/i);
  }
  assert.ok(eveningBlocked, 'Evening session recording must be blocked because Daily is currently Absent');

  // 6. Delete Daily deletes only the Daily record and does NOT affect session records
  const deleteDailyRes = await invoke(deleteStudentAttendance, {
    params: { id: dailyId }
  });
  assert.strictEqual(deleteDailyRes.statusCode, 200);

  const dailyAfterDelete = await StudentAttendance.findById(dailyId);
  assert.strictEqual(dailyAfterDelete, null, 'Daily record was deleted');

  const morningStillExists = await StudentAttendance.findById(morningSessionId);
  assert.ok(morningStillExists, 'Session record remains completely intact after Daily is deleted');
});

