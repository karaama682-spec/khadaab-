// Dashboard (DashboardOverview + KPICard).
export default {
  en: {
    loading: 'Loading Institute Analytics...',
    kpi: { quickPreview: 'Quick Preview', progress: 'Progress', clickToOpen: 'Click to open', goToPage: 'Go to page' },
    hero: {
      systemActive: 'Institute system is active',
      welcome: 'Welcome back, Admin!',
      intro: 'Here you can see live data on students, teachers and financial activity. Click any card to go straight to its page or view the data details.',
      today: "Today's Date", financialCycle: 'Financial Cycle',
      refreshTitle: 'Refresh the data now', refreshing: 'Refreshing...', refresh: 'Refresh'
    },
    quickActions: {
      addStudent: { title: 'Add Student', subtitle: 'Register new student' },
      studentAttendance: { title: 'Student Attendance', subtitle: 'Mark daily attendance' },
      recordPayment: { title: 'Record Payment', subtitle: 'Collect fee payment' },
      createClass: { title: 'Create Class', subtitle: 'Add new class' }
    },
    cardsTitle: 'System Data Cards',
    cardsCount_one: '{count} card', cardsCount_other: '{count} cards',
    cardsHint: 'Click any card to open its data page, or click the eye icon for a quick preview.',
    filters: { all: 'All', academic: 'Academic', finance: 'Finance', attendance: 'Attendance' },
    recentTransactions: 'Recent Transactions', financialActivity: 'Financial Activity', viewAll: 'View All',
    noTransactions: 'No recent transactions.', systemNotifications: 'System Notifications',
    alertsReminders: 'Alerts & Fee Reminders', noNotifications: 'No notifications found.',
    activity: { system: 'System', transaction: 'Transaction', justNow: 'Just now' },
    modal: { liveValue: 'Live System Value', explanation: 'Data Explanation', close: 'Close', goToPage: 'Go to data page' },
    cards: {
      totalStudents: {
        label: 'Total Students', subtitle: 'All active students', badge: 'Academic', description: 'Active registered students',
        explanation: 'The total number of currently active students enrolled across all classes and levels of the institute.',
        statLabel: 'Active Classes', statValue_one: '{count} class', statValue_other: '{count} classes', actionText: 'Open Student Management'
      },
      totalTeachers: {
        label: 'Total Teachers', subtitle: 'Institute teachers', badge: 'Academic', description: 'Institute teachers',
        explanation: 'The total number of teachers registered at the institute who deliver lessons.',
        statLabel: 'Attendance Today', statValue_one: '{count} present', statValue_other: '{count} present', actionText: 'View Teacher List'
      },
      totalClasses: {
        label: 'Total Classes', subtitle: 'Academic classes', badge: 'Academic', description: 'All academic classes',
        explanation: 'The number of all classes and sections that students are enrolled in.',
        statLabel: 'Average Students per Class', actionText: 'Manage Classes'
      },
      totalGuardians: {
        label: 'Total Guardians', subtitle: 'Parents & guardians', badge: 'Academic', description: "Students' guardians",
        explanation: 'Parents and guardians of students who are registered in the system as direct contacts.',
        statLabel: 'Total Families/Guardians', statValue_one: '{count} person', statValue_other: '{count} people', actionText: 'Manage Guardians'
      },
      totalFeesDue: {
        label: 'Total Fees Due', subtitle: 'Total student fees expected', badge: 'Billing Cycle', description: '',
        explanation: 'The total tuition fees expected from all active students this cycle ({cycle}) — the sum of every student\'s monthly fee. This matches the Monthly Payments figure.',
        statLabel: 'Collected / Pending', actionText: 'Open Monthly Payments'
      },
      feesCollected: {
        label: 'Student Fees Collected', subtitle: 'Fees collected from students', badge: 'Billing Cycle', description: '',
        explanation: 'The total tuition fees collected from students this month ({cycle}). This page shows ONLY the people who paid this month and leaves out those who have not paid yet.',
        statLabel: 'Total Expected', actionText: 'View Payers (Only Paid)'
      },
      pendingFees: {
        label: 'Pending Student Fees', subtitle: 'Unpaid student fees', badge: 'Uncollected', description: '',
        explanation: 'Tuition fees owed by students for the current cycle that have not been paid yet. This page shows ONLY the people who still owe and leaves out those who have paid in full.',
        statLabel: 'Total Expected', actionText: 'View Non-Payers (Only Pending)'
      },
      totalIncome: {
        label: 'Total Income', subtitle: 'All income received', badge: 'Finance Truth', description: '',
        explanation: 'All income received by the system this cycle ({cycle}): student fees ({fees}) + other income ({other}).',
        statLabel: 'Other Income', actionText: 'Open the Cashbook'
      },
      totalExpenses: {
        label: 'Total Expenses', subtitle: 'All expenses', badge: 'Outflows', description: '',
        explanation: 'The total of all expenses paid out this cycle ({cycle}), made up of salaries paid ({salaries}) and other operating expenses ({other}).',
        statLabel: 'Regular Expenses', actionText: 'Manage Expenses'
      },
      balance: {
        label: 'Balance', subtitle: 'Balance (Income − Expenses)', badge: 'Net', badgeDeficit: 'Deficit', description: '',
        explanation: 'The balance for this cycle ({cycle}): Total Income ({income}) minus Total Expenses ({expenses}).',
        statLabel: 'Income / Expenses', actionText: 'Open the Cashbook'
      },
      previousDebt: {
        label: 'Previous Debt', subtitle: 'Debt from previous cycles', badge: 'Previous Cycles', description: 'Before {cycle}',
        explanation: 'Unpaid tuition fees carried over from all previous cycles (before {cycle}). When a cycle ends, its unpaid amount leaves "Pending Student Fees" and is added here. In Monthly Payments, choose the month you want to see the people.',
        statLabel: 'Most Recent Cycle', actionText: 'View Non-Payers (Only Pending)'
      },
      historicalCycleDebt: {
        label: 'Historical Cycle Debt', subtitle: 'Debt frozen at cycle close', badge: 'Sealed History', description: 'Debt recorded at close of {cycle}',
        explanation: 'Historical snapshot of unpaid tuition fees frozen at the close of cycle ({cycle}). Payments made in subsequent cycles do not mutate this record. Click to search debtors in Monthly Payments.',
        statLabel: 'Closed Cycle', actionText: 'View Cycle Payers (Monthly Payments)'
      },
      todayStudentAttendance: {
        label: 'Student Attendance Today', subtitle: 'Student attendance today', badge: 'Today', description: 'Students present today',
        explanation: 'The number of students confirmed present today. The total number of active students is {total}.',
        statLabel: 'Attendance Rate', actionText: 'Take Student Attendance'
      },
      todayTeacherAttendance: {
        label: 'Teacher Attendance Today', subtitle: 'Teacher attendance today', badge: 'Today', description: 'Teachers present today',
        explanation: 'The number of teachers who reported present at the centre today. The institute has {total} teachers in total.',
        statLabel: 'Attendance Rate', actionText: 'Take Teacher Attendance'
      }
    }
  },
  so: {
    loading: 'Waxaa la soo rarayaa xogta machadka...',
    kpi: { quickPreview: 'Faahfaahin Degdeg ah', progress: 'Heerka', clickToOpen: 'Guji si aad u furto', goToPage: 'Tag Bogga' },
    hero: {
      systemActive: 'Nidaamka Machadka Waa Firfircoon yahay',
      welcome: 'Ku soo dhowow, Maamule!',
      intro: 'Halkan waxaad ka arki kartaa xogta dhabta ah ee ardayda, macallimiinta, iyo dhaqdhaqaaqa maaliyadeed. Guji kaar kasta si aad toos ugu tagto boggiisa ama u aragto faahfaahinta xogta.',
      today: 'Taariikhda Maanta', financialCycle: 'Wareegga Maaliyadda',
      refreshTitle: 'Dib u cusboonaysii xogta hadda', refreshing: 'Cusboonaysiinaya...', refresh: 'Cusboonaysii'
    },
    quickActions: {
      addStudent: { title: 'Ku dar Arday', subtitle: 'Diiwaangeli arday cusub' },
      studentAttendance: { title: 'Xaadirinta Ardayda', subtitle: 'Qaado xaadirinta maalinlaha ah' },
      recordPayment: { title: 'Diiwaangeli Lacag-bixin', subtitle: 'Qaado khidmadda' },
      createClass: { title: 'Samee Fasal', subtitle: 'Ku dar fasal cusub' }
    },
    cardsTitle: 'Kaararka Xogta Nidaamka',
    cardsCount_one: '{count} Kaar', cardsCount_other: '{count} Kaar',
    cardsHint: 'Guji kaar kasta si aad toos ugu gasho bogga xogta, ama guji astaanta ilbiriqsiga si aad u aragto faahfaahin degdeg ah.',
    filters: { all: 'Dhammaan', academic: 'Waxbarasho', finance: 'Maaliyadda', attendance: 'Xaadirinta' },
    recentTransactions: 'Macaamilada Dhowaan', financialActivity: 'Dhaqdhaqaaqa Maaliyadda', viewAll: 'Eeg Dhammaan',
    noTransactions: 'Macaamil dhowaan ah ma jiro.', systemNotifications: 'Ogeysiisyada Nidaamka',
    alertsReminders: 'Digniinaha & Xusuusinta Khidmadda', noNotifications: 'Ogeysiis lama helin.',
    activity: { system: 'Nidaamka', transaction: 'Macaamil', justNow: 'Hadda' },
    modal: { liveValue: 'Qiimaha Nidaamka Hadda', explanation: 'Sharaxaadda Xogta', close: 'Xir', goToPage: 'Tag Bogga Xogta' },
    cards: {
      totalStudents: {
        label: 'Ardayda Guud', subtitle: 'Ardayda Guud ee Firfircoon', badge: 'Waxbarasho', description: 'Ardayda firfircoon ee diiwaangashan',
        explanation: 'Tirada guud ee ardayda hadda firfircoon ee dhigata dhammaan fasallada iyo heerarka kala duwan ee machadka.',
        statLabel: 'Fasallada Firfircoon', statValue_one: '{count} Fasal', statValue_other: '{count} Fasal', actionText: 'Fur Maamulka Ardayda'
      },
      totalTeachers: {
        label: 'Macallimiinta Guud', subtitle: 'Macallimiinta Machadka', badge: 'Waxbarasho', description: 'Macallimiinta machadka',
        explanation: 'Wadarta guud ee macallimiinta ka diiwaangashan machadka ee casharrada bixiya.',
        statLabel: 'Xaadirinta Maanta', statValue_one: '{count} Xaadir', statValue_other: '{count} Xaadir', actionText: 'Eeg Liiska Macallimiinta'
      },
      totalClasses: {
        label: 'Fasallada Guud', subtitle: 'Fasallada Waxbarashada', badge: 'Waxbarasho', description: 'Dhammaan fasallada waxbarashada',
        explanation: 'Tirada dhammaan fasallada iyo qaybaha ardaydu ku qoran yihiin.',
        statLabel: 'Celceliska Ardayda/Fasalkii', actionText: 'Maamul Fasallada'
      },
      totalGuardians: {
        label: 'Masuuliyiinta Guud', subtitle: 'Waalidiinta & Masuuliyiinta', badge: 'Waxbarasho', description: 'Masuuliyiinta ardayda',
        explanation: 'Waalidiinta iyo masuuliyiinta ardayda ee xiriirka tooska ah lala leeyahay ee nidaamka ka diiwaangashan.',
        statLabel: 'Wadar Qoys/Masuul', statValue_one: '{count} Qof', statValue_other: '{count} Qof', actionText: 'Maamul Masuuliyiinta'
      },
      totalFeesDue: {
        label: 'Wadarta Khidmadda La Filayo', subtitle: 'Wadarta Lacagaha Ardayda La Filayo', badge: 'Wareegga Lacag-bixinta', description: '',
        explanation: 'Wadarta lacagaha waxbarashada ee laga filayo dhammaan ardayda firfircoon wareeggan ({cycle}) — isku-darka khidmadda bishii ee arday kasta. Waa isla tirada Lacag-bixinta Bishii.',
        statLabel: 'La Qaaday / Ku Dhiman', actionText: 'Fur Lacag-bixinta Bishii'
      },
      feesCollected: {
        label: 'Khidmadda Ardayda La Qaaday', subtitle: 'Lacagaha Ardayda laga Qaaday', badge: 'Wareegga Lacag-bixinta', description: '',
        explanation: 'Wadarta lacagaha waxbarashada ee ardayda laga soo ururiyey bishan ({cycle}). Boggan wuxuu kuu soo saarayaa KELIYA dadka bishan lacagta bixiyey, wuxuuna ka reebayaa dadka aan weli bixin.',
        statLabel: 'Wadarta La Filayo', actionText: 'Eeg Dadka Bixiyey (Kaliya kuwa Bixiyey)'
      },
      pendingFees: {
        label: 'Khidmadda Ardayda Ku Dhiman', subtitle: 'Lacagaha Ardayda Ku Dhiman', badge: 'Aan la Qaadin', description: '',
        explanation: 'Lacagaha waxbarashada ee ardayda lagu leeyahay wareeggan socda ee aan weli la bixin. Boggan wuxuu ku tusayaa KELIYA dadka weli deyntu ku dhiman tahay, wuxuuna ka reebayaa kuwa lacagta wada bixiyey.',
        statLabel: 'Isku-darka La Filayo', actionText: 'Eeg Dadka aan Bixin (Kaliya kuwa Ku Dhiman)'
      },
      totalIncome: {
        label: 'Dakhliga Guud', subtitle: 'Dakhliga Guud ee Soo Galay', badge: 'Xogta Dhabta ah', description: '',
        explanation: 'Dhammaan lacagaha dakhliga ah ee soo galay nidaamka wareeggan ({cycle}): Lacagaha ardayda ({fees}) + Dakhliyada kale ({other}).',
        statLabel: 'Dakhliga Kale', actionText: 'Fur Buugga Lacagta'
      },
      totalExpenses: {
        label: 'Kharashaadka Guud', subtitle: 'Kharashaadka Guud', badge: 'Lacagaha Baxay', description: '',
        explanation: 'Wadarta dhammaan kharashaadka baxay wareeggan ({cycle}), oo isugu jira Mushaharka la bixiyay ({salaries}) iyo kharashaadka kale ee hawlgalka ({other}).',
        statLabel: 'Kharashka Caadiga ah', actionText: 'Maamul Kharashaadka'
      },
      balance: {
        label: 'Haraaga', subtitle: 'Haraaga (Dakhli − Kharash)', badge: 'Saafi', badgeDeficit: 'Yaraansho', description: '',
        explanation: 'Haraaga wareeggan ({cycle}): Dakhliga Guud ({income}) oo laga jaray Kharashaadka Guud ({expenses}).',
        statLabel: 'Dakhli / Kharash', actionText: 'Fur Buugga Lacagta'
      },
      previousDebt: {
        label: 'Deyn Hore', subtitle: 'Deynta Wareegyadii Hore', badge: 'Wareegyadii Hore', description: 'Ka hor {cycle}',
        explanation: 'Lacagaha waxbarashada ee aan la bixin ee ka soo haray dhammaan wareegyadii hore (ka hor {cycle}). Marka wareeg dhammaado, lacagta ku dhiman waxay ka baxdaa "Khidmadda Ardayda Ku Dhiman" waxayna halkan ku soo biirtaa. Lacag-bixinta Bishii ka dooro bishii aad rabto si aad u aragto dadka.',
        statLabel: 'Wareeggii u dambeeyay', actionText: 'Eeg Dadka aan Bixin (Kaliya kuwa Ku Dhiman)'
      },
      historicalCycleDebt: {
        label: 'Deyntii Cycle-kii Xirmay', subtitle: 'Deyntii lagu xiray cycle-kii hore (Snapshot)', badge: 'Taariikh Qufulan', description: 'Deyntii lagu diiwaangeliyay xiritaankii {cycle}',
        explanation: 'Waa sawir rasmi ah (snapshot) oo muujinaya deyntii ku hartay cycle-ka ({cycle}) markii la xirayay. Lacag dambe oo la bixiyo waxba kama beddelayso taariikhdan. Guji si aad ugu baarto Monthly Payments.',
        statLabel: 'Cycle-kii Xirmay', actionText: 'Eeg Payers-ka Cycle-kaas (Monthly Payments)'
      },
      todayStudentAttendance: {
        label: 'Xaadirinta Ardayda Maanta', subtitle: 'Imaanshaha Ardayda Maanta', badge: 'Maanta', description: 'Ardayda xaadirka ah maanta',
        explanation: 'Tirada ardayda maanta la xaqiijiyay inay soo xaadireen. Guud ahaan ardayda firfircooni waa {total}.',
        statLabel: 'Heerka Xaadirka', actionText: 'Qaado Xaadirinta Ardayda'
      },
      todayTeacherAttendance: {
        label: 'Xaadirinta Macallimiinta Maanta', subtitle: 'Imaanshaha Macallimiinta Maanta', badge: 'Maanta', description: 'Macallimiinta xaadirka ah maanta',
        explanation: 'Tirada macallimiinta maanta xarunta soo xaadiray. Guud ahaan macallimiinta machadku waa {total}.',
        statLabel: 'Heerka Xaadirka', actionText: 'Qaado Xaadirinta Macallimiinta'
      }
    }
  }
};
