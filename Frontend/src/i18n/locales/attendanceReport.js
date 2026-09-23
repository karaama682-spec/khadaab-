// Attendance Ledger report (ledger, daily view, student view, dashboard,
// CSV/PDF exports and the guardian WhatsApp warning message).
export default {
  en: {
    loading: 'Loading Attendance System Datasets...', loadFailed: 'Failed to load report datasets.',
    subtitle: 'Reports & Diagnostics Hub', tabs: { daily: 'Daily View', student: 'Student View' },
    classMissingTitle: 'Class Missing', classMissing: 'Student is not assigned to a class.',
    statusSavedTitle: 'Status Saved to Database', statusSaved: '{name} marked as {status} for {date}.',
    statusSaveFailed: 'Could not record attendance change in database.',
    recordUpdatedTitle: 'Record Updated', recordUpdated: 'Attendance record updated successfully in database.',
    historyUpdateFailed: 'Failed to save historical update.',
    warn: {
      both: 'marked Late {late} times and Absent {absent} times.', late: 'marked Late {late} times.',
      absent: 'marked Absent {absent} times.',
      message: 'Hello {parent}, this is an official notification that your child {student} has reached high attendance concerns: {details} Please coordinate with the management.'
    },
    exportCompleteTitle: 'Export Complete', exportComplete: 'CSV exported successfully as {file}',
    nothingExportTitle: 'Nothing to export', nothingExport: 'Search a Student ID/Code and month with records first.',
    nothingPrintTitle: 'Nothing to print', nothingPrintAll: 'No Late/Absent records to print for this student and month.',
    nothingPrintFiltered: 'No matching records to print for this student and month.',
    csv: { totalPresent: 'Total Present', totalLate: 'Total Late', totalAbsent: 'Total Absent', totalPartial: 'Total Partial', rate: 'Attendance Rate' },
    file: { attendance: 'Attendance', allClasses: 'All_Classes', studentAttendance: 'Student_Attendance' },
    pdf: {
      monthlyLedger: 'MONTHLY ATTENDANCE LEDGER', generatedAt: 'Generated At', classReport: 'ATTENDANCE REPORT',
      overallRate: 'Overall Attendance Rate', rate: 'Rate', dossier: 'STUDENT ATTENDANCE DOSSIER', totalDays: 'Total Days'
    },
    arrivalTime: 'Arrival Time', recordedBy: 'Recorded By', filterBranch: 'Filter Branch', cycleRange: 'Reporting Cycle Range',
    range: { Today: 'Today', 'This Week': 'This Week', 'This Month': 'This Month', Custom: 'Custom' },
    kpi: {
      totalStudents: 'Total Students', totalStudentsDesc: 'Active enrollment roster', present: 'Present Today',
      presentDesc: 'Explicitly present logs', late: 'Late Today', lateDesc: 'Tardiness records', absent: 'Absent Today',
      absentDesc: 'Explicit absence logs', partial: 'Partial Today', partialDesc: 'Partial session logs', rateDesc: 'Present/Late vs Absent'
    },
    trendTitle: 'Daily Attendance Status Trend', noTrend: 'No attendance logged in this range. Change the reporting cycle range above.',
    studentIdCode: 'Student ID / Code', codePlaceholder: 'e.g. 1001',
    only: { Present: 'Present Only', Late: 'Late Only', Absent: 'Absent Only' },
    records: 'Records', dailyHint: 'Enter a Student ID / Code and choose a month to view attendance.',
    noStudentCode: 'No student found with code "{code}".', noRecordsMonth: 'No attendance records for {name} in {month}.',
    filterClass: 'Filter Class', selectClassAudit: 'Select class to audit...',
    kpiClick: 'Click to view students with {status} attendance',
    scope: {
      classPresent: 'Class Present Days', branchPresent: 'Branch Present Days', classLate: 'Class Late Days', branchLate: 'Branch Late Days',
      classAbsent: 'Class Absent Days', branchAbsent: 'Branch Absent Days', classPartial: 'Class Partial Days', branchPartial: 'Branch Partial Days',
      classRate: 'Class Attendance Rate', branchRate: 'Branch Attendance Rate'
    },
    days_one: '{count} Day', days_other: '{count} Days',
    kpiListTitle: '{scope} {status} Students ({count})', hideList: 'Hide List',
    noStudentsStatus: 'No students found with {status} attendance for this date.',
    selectBranchClass: 'Please select a Branch or Class to view attendance ledger records.',
    lookupLabel: 'Lookup Student by Name, Code or Phone', lookupPlaceholder: 'Type student name, student code or guardian phone number...',
    guardianPhone: 'Guardian Phone', warningTitle: 'System Attendance Warning Triggered',
    warningText: 'Student has reached {absent} Absences or {late} Late records. Click the WhatsApp button to alert the parent/guardian phone number.',
    whatsappGuardian: 'WhatsApp Guardian', basicProfile: 'Basic Profile Info', studentCodeId: 'Student Code / ID',
    currentClass: 'Current Academic Class', guardianName: 'Guardian/Responsible Name', guardianPhoneNumber: 'Guardian Phone Number',
    performanceSummary: 'Attendance Performance Summary', exportCsv: 'Export CSV', totalAudited: 'Total Audited',
    totalRate: 'Total Rate Percentage', noHistory: 'No attendance history found.', noStudentSelected: 'No Student Selected',
    noStudentSelectedHint: 'Please search for a student to view their detailed attendance report profile and trigger warning notifications.'
  },
  so: {
    loading: 'Waxaa la soo rarayaa xogta nidaamka xaadirinta...', loadFailed: 'Soo rarista xogta warbixinta way fashilantay.',
    subtitle: 'Xarunta Warbixinnada & Baaritaanka', tabs: { daily: 'Muuqaalka Maalinlaha', student: 'Muuqaalka Ardayga' },
    classMissingTitle: 'Fasal Ma Jiro', classMissing: 'Ardaygan fasal looma qoondeyn.',
    statusSavedTitle: 'Xaaladda Waa La Kaydiyey', statusSaved: '{name} waxaa loo calaamadeeyey {status} taariikhda {date}.',
    statusSaveFailed: 'Isbeddelka xaadirinta lama diiwaangelin karin.',
    recordUpdatedTitle: 'Diiwaanka Waa La Cusbooneysiiyey', recordUpdated: 'Diiwaanka xaadirinta si guul leh ayaa loo cusbooneysiiyey.',
    historyUpdateFailed: 'Kaydinta isbeddelka taariikhda way fashilantay.',
    warn: {
      both: 'loo calaamadeeyey Daahay {late} jeer iyo Maqan {absent} jeer.', late: 'loo calaamadeeyey Daahay {late} jeer.',
      absent: 'loo calaamadeeyey Maqan {absent} jeer.',
      message: 'Salaan {parent}, kani waa ogeysiis rasmi ah oo ku saabsan in ilmahaaga {student} uu gaaray heer walaac xaadirineed: {details} Fadlan la xiriir maamulka.'
    },
    exportCompleteTitle: 'Soo Saaristu Waa Dhammaatay', exportComplete: 'CSV si guul leh ayaa loo soo saaray: {file}',
    nothingExportTitle: 'Wax la soo saaro ma jiro', nothingExport: 'Marka hore raadi aqoonsiga/koodka ardayga iyo bil leh diiwaanno.',
    nothingPrintTitle: 'Wax la daabaco ma jiro', nothingPrintAll: 'Ardaygan iyo bishan diiwaan Daahay/Maqan ah oo la daabaco ma jiro.',
    nothingPrintFiltered: 'Ardaygan iyo bishan diiwaan u dhigma oo la daabaco ma jiro.',
    csv: { totalPresent: 'Wadarta Joogay', totalLate: 'Wadarta Daahay', totalAbsent: 'Wadarta Maqan', totalPartial: 'Wadarta Qayb', rate: 'Heerka Xaadirinta' },
    file: { attendance: 'Xaadirinta', allClasses: 'Dhammaan_Fasallada', studentAttendance: 'Xaadirinta_Ardayga' },
    pdf: {
      monthlyLedger: 'DIIWAANKA XAADIRINTA BISHA', generatedAt: 'La sameeyey', classReport: 'WARBIXINTA XAADIRINTA',
      overallRate: 'Heerka Xaadirinta Guud', rate: 'Heerka', dossier: 'FAYLKA XAADIRINTA ARDAYGA', totalDays: 'Wadarta Maalmaha'
    },
    arrivalTime: 'Waqtiga Imaanshaha', recordedBy: 'Waxaa Diiwaangeliyey', filterBranch: 'Shaandhee Laanta', cycleRange: 'Muddada Warbixinta',
    range: { Today: 'Maanta', 'This Week': 'Toddobaadkan', 'This Month': 'Bishan', Custom: 'Gaar ah' },
    kpi: {
      totalStudents: 'Ardayda Guud', totalStudentsDesc: 'Liiska ardayda firfircoon', present: 'Joogay Maanta',
      presentDesc: 'Diiwaannada joogitaanka', late: 'Daahay Maanta', lateDesc: 'Diiwaannada daahitaanka', absent: 'Maqan Maanta',
      absentDesc: 'Diiwaannada maqnaanshaha', partial: 'Qayb Maanta', partialDesc: 'Diiwaannada fadhiga qaybta ah', rateDesc: 'Joogay/Daahay iyo Maqan'
    },
    trendTitle: 'Isbeddelka Xaaladda Xaadirinta Maalinlaha', noTrend: 'Muddadan xaadirin laguma diiwaangelin. Kor ka beddel muddada warbixinta.',
    studentIdCode: 'Aqoonsiga / Koodka Ardayga', codePlaceholder: 'tusaale: 1001',
    only: { Present: 'Joogay Kaliya', Late: 'Daahay Kaliya', Absent: 'Maqan Kaliya' },
    records: 'Diiwaannada', dailyHint: 'Geli aqoonsiga / koodka ardayga oo dooro bil si aad u aragto xaadirinta.',
    noStudentCode: 'Arday koodkiisu yahay "{code}" lama helin.', noRecordsMonth: 'Ma jiraan diiwaanno xaadirin oo {name} ah bisha {month}.',
    filterClass: 'Shaandhee Fasalka', selectClassAudit: 'Dooro fasal si loo hubiyo...',
    kpiClick: 'Guji si aad u aragto ardayda xaadirintoodu tahay {status}',
    scope: {
      classPresent: 'Maalmaha Joogay ee Fasalka', branchPresent: 'Maalmaha Joogay ee Laanta', classLate: 'Maalmaha Daahay ee Fasalka', branchLate: 'Maalmaha Daahay ee Laanta',
      classAbsent: 'Maalmaha Maqan ee Fasalka', branchAbsent: 'Maalmaha Maqan ee Laanta', classPartial: 'Maalmaha Qaybta ee Fasalka', branchPartial: 'Maalmaha Qaybta ee Laanta',
      classRate: 'Heerka Xaadirinta Fasalka', branchRate: 'Heerka Xaadirinta Laanta'
    },
    days_one: '{count} Maalin', days_other: '{count} Maalmood',
    kpiListTitle: 'Ardayda {status} ee {scope} ({count})', hideList: 'Qari Liiska',
    noStudentsStatus: 'Taariikhdan arday xaadirintoodu tahay {status} lama helin.',
    selectBranchClass: 'Fadlan dooro laan ama fasal si aad u aragto diiwaanka xaadirinta.',
    lookupLabel: 'Ku raadi Ardayga Magaca, Koodka ama Telefoonka', lookupPlaceholder: 'Qor magaca ardayga, koodka ardayga ama lambarka telefoonka masuulka...',
    guardianPhone: 'Telefoonka Masuulka', warningTitle: 'Digniinta Xaadirinta Nidaamka Waa Kacday',
    warningText: 'Ardaygu wuxuu gaaray {absent} maqnaansho ama {late} daahitaan. Guji badhanka WhatsApp si aad u ogeysiiso telefoonka waalidka/masuulka.',
    whatsappGuardian: 'WhatsApp Masuulka', basicProfile: 'Macluumaadka Aasaasiga ah', studentCodeId: 'Koodka / Aqoonsiga Ardayga',
    currentClass: 'Fasalka Waxbarasho ee Hadda', guardianName: 'Magaca Masuulka', guardianPhoneNumber: 'Lambarka Telefoonka Masuulka',
    performanceSummary: 'Soo-koobidda Xaadirinta', exportCsv: 'Soo Saar CSV', totalAudited: 'Wadarta La Hubiyey',
    totalRate: 'Boqolleyda Guud', noHistory: 'Taariikh xaadirin lama helin.', noStudentSelected: 'Arday Lama Dooran',
    noStudentSelectedHint: 'Fadlan raadi arday si aad u aragto warbixinta xaadirintiisa oo faahfaahsan una dirto ogeysiisyada digniinta.'
  }
};
