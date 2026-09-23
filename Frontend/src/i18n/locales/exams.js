// Examinations: exam management, mark entry, results (screen, print & PDF).
export default {
  en: {
    loadFailed: 'Failed to load exams.', selectExam: 'Select Exam', selectExamOption: '-- Select an exam --',
    manage: {
      title: 'Examinations', subtitle: 'Create exams · enter marks · publish results', loading: 'Loading Exams...',
      newExam: 'New Exam', editTitle: 'Edit Exam', updateExam: 'Update Exam', createExam: 'Create Exam',
      searchPlaceholder: 'Search by title, type, or class...', colExam: 'Exam', colSubjects: 'Subjects', colMarksEntered: 'Marks Entered',
      enterMarks: 'Enter Marks', viewResults: 'View Results', unpublish: 'Unpublish', publish: 'Publish results',
      empty: 'No exams yet. Click "New Exam" to create one.', titleLabel: 'Exam Title *', titlePlaceholder: 'e.g. Mid-Term Examination',
      typeLabel: 'Exam Type', classLabel: 'Class *', term: 'Term', termPlaceholder: 'Term 1', examDate: 'Exam Date',
      subjectsMarks: 'Subjects & Marks', addSubject: 'Add Subject', subjectName: 'Subject Name', fullMarks: 'Full Marks',
      passMarks: 'Pass Marks', subjectPlaceholder: 'e.g. Quran, Tajweed, Maths',
      validation: 'Validation', titleRequired: 'Enter an exam title.', classRequired: 'Select a class.',
      subjectRequired: 'Add at least one subject.', passExceeds: 'Pass marks cannot exceed full marks.',
      updatedTitle: 'Updated', updated: 'Exam updated.', createdTitle: 'Created', created: 'Exam created.', saveFailed: 'Failed to save exam.',
      deleteTitle: 'Delete Exam?', deleteConfirm: 'Delete "{title}" and all its entered marks? This cannot be undone.',
      removed: 'Exam removed.', deleteFailed: 'Failed to delete exam.', publishedTitle: 'Published', unpublishedTitle: 'Unpublished',
      published: 'Results are now published.', unpublished: 'Results hidden from published state.', statusFailed: 'Failed to update status.'
    },
    marks: {
      title: 'Mark Entry', subtitle: "Enter each student's marks per subject", save: 'Save Marks',
      loadFailed: 'Failed to load exam data.', invalidTitle: 'Invalid marks', invalidRange: '{name}: {subject} must be between 0 and {max}.',
      nothingTitle: 'Nothing to save', nothing: 'Enter marks for at least one student.', savedTitle: 'Saved', saved: 'Marks saved.',
      saveFailed: 'Failed to save marks.', summary: '{count} students · Total {total} marks',
      selectHint: 'Select an exam to enter marks.', noStudents: "No students in this exam's class yet.",
      subjectHeader: '/{full} · pass {pass}'
    },
    results: {
      title: 'Exam Results', subtitle: 'Ranked result sheet · grades · report cards', exportPdf: 'Export PDF',
      loadFailed: 'Failed to load results.', loading: 'Loading results...', selectHint: 'Select an exam to view results.',
      passed: 'Passed', passRate: '{rate}% pass rate', failed: 'Failed', notGraded: '{count} not graded',
      classAverage: 'Class Average', graded: '{graded}/{total} graded', topStudent: 'Top Student', noMarks: 'No marks yet',
      rank: 'Rank', grade: 'Grade', result: 'Result', absentShort: 'AB', noStudents: 'No students in this class.',
      tip: 'Tip: click a student row to open their report card.', reportCard: 'Report Card', percentage: 'Percentage',
      subject: 'Subject', marks: 'Marks', passUpper: 'PASS', failUpper: 'FAIL',
      status: { Pass: 'Pass', Fail: 'Fail', Pending: 'Pending' },
      pdf: { sheet: 'RESULT SHEET', rank: 'RANK', student: 'STUDENT', total: 'TOTAL', grade: 'GRD', result: 'RES', file: 'Result_Sheet' }
    }
  },
  so: {
    loadFailed: 'Soo rarista imtixaannada way fashilantay.', selectExam: 'Dooro Imtixaanka', selectExamOption: '-- Dooro imtixaan --',
    manage: {
      title: 'Imtixaannada', subtitle: 'Samee imtixaanno · geli dhibcaha · daabac natiijooyinka', loading: 'Waxaa la soo rarayaa imtixaannada...',
      newExam: 'Imtixaan Cusub', editTitle: 'Wax ka beddel Imtixaanka', updateExam: 'Cusboonaysii Imtixaanka', createExam: 'Samee Imtixaanka',
      searchPlaceholder: 'Ku raadi magaca, nooca, ama fasalka...', colExam: 'Imtixaanka', colSubjects: 'Maaddooyinka', colMarksEntered: 'Dhibcaha La Geliyey',
      enterMarks: 'Geli Dhibcaha', viewResults: 'Eeg Natiijooyinka', unpublish: 'Ka qaad daabacaadda', publish: 'Daabac natiijooyinka',
      empty: 'Weli imtixaan ma jiro. Guji "Imtixaan Cusub" si aad mid u sameyso.', titleLabel: 'Magaca Imtixaanka *', titlePlaceholder: 'tusaale: Imtixaanka Bartamaha Termiga',
      typeLabel: 'Nooca Imtixaanka', classLabel: 'Fasalka *', term: 'Termiga', termPlaceholder: 'Termiga 1', examDate: 'Taariikhda Imtixaanka',
      subjectsMarks: 'Maaddooyinka & Dhibcaha', addSubject: 'Ku dar Maaddo', subjectName: 'Magaca Maaddada', fullMarks: 'Dhibcaha Buuxa',
      passMarks: 'Dhibcaha Gudbitaanka', subjectPlaceholder: 'tusaale: Quraan, Tajwiid, Xisaab',
      validation: 'Xaqiijin', titleRequired: 'Geli magaca imtixaanka.', classRequired: 'Dooro fasal.',
      subjectRequired: 'Ku dar ugu yaraan hal maaddo.', passExceeds: 'Dhibcaha gudbitaanku kama badnaan karaan dhibcaha buuxa.',
      updatedTitle: 'Waa la cusbooneysiiyey', updated: 'Imtixaanka waa la cusbooneysiiyey.', createdTitle: 'Waa la sameeyey', created: 'Imtixaanka waa la sameeyey.', saveFailed: 'Kaydinta imtixaanka way fashilantay.',
      deleteTitle: 'Tirtir Imtixaanka?', deleteConfirm: 'Tirtir "{title}" iyo dhammaan dhibcihiisa la geliyey? Tan dib looma celin karo.',
      removed: 'Imtixaanka waa la tirtiray.', deleteFailed: 'Tirtirista imtixaanka way fashilantay.', publishedTitle: 'Waa la daabacay', unpublishedTitle: 'Daabacaadda waa laga qaaday',
      published: 'Natiijooyinka hadda waa la daabacay.', unpublished: 'Natiijooyinka waa laga qariyey daabacaadda.', statusFailed: 'Cusboonaysiinta xaaladda way fashilantay.'
    },
    marks: {
      title: 'Gelinta Dhibcaha', subtitle: 'Geli dhibcaha arday kasta ee maaddo kasta', save: 'Kaydi Dhibcaha',
      loadFailed: 'Soo rarista xogta imtixaanka way fashilantay.', invalidTitle: 'Dhibco aan sax ahayn', invalidRange: '{name}: {subject} waa inay u dhexeyso 0 iyo {max}.',
      nothingTitle: 'Wax la kaydiyo ma jiro', nothing: 'Geli dhibcaha ugu yaraan hal arday.', savedTitle: 'Waa la kaydiyey', saved: 'Dhibcaha waa la kaydiyey.',
      saveFailed: 'Kaydinta dhibcaha way fashilantay.', summary: '{count} arday · Wadarta {total} dhibcood',
      selectHint: 'Dooro imtixaan si aad u geliso dhibcaha.', noStudents: 'Weli arday kuma jiraan fasalka imtixaankan.',
      subjectHeader: '/{full} · gudbid {pass}'
    },
    results: {
      title: 'Natiijooyinka Imtixaanka', subtitle: 'Xaashida natiijooyinka la kala horreysiiyey · darajooyinka · kaararka warbixinta', exportPdf: 'Soo Saar PDF',
      loadFailed: 'Soo rarista natiijooyinka way fashilantay.', loading: 'Waxaa la soo rarayaa natiijooyinka...', selectHint: 'Dooro imtixaan si aad u aragto natiijooyinka.',
      passed: 'Gudbay', passRate: '{rate}% heerka gudbitaanka', failed: 'Dhacay', notGraded: '{count} aan la qiimeyn',
      classAverage: 'Celceliska Fasalka', graded: '{graded}/{total} la qiimeeyey', topStudent: 'Ardayga Ugu Sarreeya', noMarks: 'Weli dhibco ma jiraan',
      rank: 'Kaalinta', grade: 'Darajada', result: 'Natiijada', absentShort: 'MQ', noStudents: 'Fasalkan arday kuma jiraan.',
      tip: 'Talo: guji safka arday si aad u furto kaarkiisa warbixinta.', reportCard: 'Kaarka Warbixinta', percentage: 'Boqolleyda',
      subject: 'Maaddada', marks: 'Dhibcaha', passUpper: 'GUDBAY', failUpper: 'DHACAY',
      status: { Pass: 'Gudbay', Fail: 'Dhacay', Pending: 'Lama qiimeyn' },
      pdf: { sheet: 'XAASHIDA NATIIJADA', rank: 'KAALIN', student: 'ARDAYGA', total: 'WADARTA', grade: 'DRJ', result: 'NTJ', file: 'Xaashida_Natiijada' }
    }
  }
};
