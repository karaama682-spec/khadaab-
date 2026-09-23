// Reports: Fee Payment, Payment Responsibility (guardians), Category Summary,
// Cashbook Payment Report — screen, print and PDF text.
export default {
  en: {
    common: {
      printReport: 'Print Report', allWallets: 'All Wallets', instituteName: 'MACHAD EDUCATIONAL INSTITUTE',
      reportDate: 'Report Date', accountantSignature: 'Accountant / Cashier Signature', directorStamp: 'Director / Management Stamp',
      unknownPayer: 'Unknown Payer', searchPayer: 'Search payer name or phone...', systemName: 'Institute Management System',
      loadFailed: 'Failed to load report data.', allTime: 'All Time', period: 'Period', reportPeriod: 'Report period',
      currentPeriod: 'Current Period (25→24)'
    },
    fee: {
      loading: 'Loading Fee Payment Report...', loadFailed: 'Failed to load payment report data.',
      subtitle: 'Machad Institute Student Fee Collection & Financial Statements', noResponsible: 'No responsible party',
      totalCollected: 'Total Money Collected', paidEntries_one: '{count} Paid entry', paidEntries_other: '{count} Paid entries',
      totalPending: 'Total Pending Fee', pendingEntries_one: '{count} Pending entry', pendingEntries_other: '{count} Pending entries',
      grandTotal: 'Grand Total Money', sumRows: 'Sum of all {count} report rows',
      status: { All: 'All', Paid: 'Paid', Unpaid: 'Unpaid', Remaining: 'Remaining' },
      officialTitle: 'Official Fee Payment & Collection Report', subtotalTitle: 'Payer Payment Subtotal',
      subtotalHint: 'Completed payments grouped by responsible party, matching the filters above.',
      subtotalCount_one: 'Subtotal · {count} payer', subtotalCount_other: 'Subtotal · {count} payers',
      noCompleted: 'No completed payments match the current filters.', responsibleParty: 'Responsible Party',
      payments: 'Payments', subtotal: 'Subtotal', payerPhone: 'Payer Phone', monthDate: 'Month / Date',
      depositWallet: 'Deposit Wallet', paidCol: 'Paid ($)', unpaidCol: 'Unpaid ($)', current: 'Current',
      empty: 'No fee payment records found.', totalPaidUnpaid: 'TOTAL PAID / UNPAID',
      pdf: {
        title: 'MACHAD INSTITUTE - FEE PAYMENT REPORT', totalEntries: 'Total Entries', payerPhone: 'PAYER PHONE',
        month: 'MONTH', wallet: 'WALLET', paid: 'PAID ($)', unpaid: 'UNPAID ($)', totalPaid: 'TOTAL PAID',
        file: 'Machad_Fee_Payment_Report'
      }
    },
    guardian: {
      title: 'Payment Responsibility', printTitle: 'Payment Responsibility Report', subtitle: 'Who has paid student fees',
      loading: 'Loading payment responsibility data...', loadFailed: 'Failed to load data.',
      alreadyPaidTitle: 'Already Paid', alreadyPaid: 'All students already paid for this month.',
      confirmTitle: 'Confirm Payment', confirmMessage: 'Record payment for {count} student(s) under "{name}"?\nTotal: ${amount} ({month})',
      yesRecord: 'Yes, Record', recordedTitle: 'Payment Recorded', recorded: 'All fees recorded for {name}.',
      recordFailed: 'Failed to record payment.', totalRecords: 'Total records', paidUpper: 'PAID', pendingUpper: 'PENDING',
      totalGuardians: 'Total Guardians', paidThisMonth: 'Paid This Month', notYetPaid: 'Not Yet Paid',
      searchPlaceholder: 'Search by guardian name or phone number...', colGuardian: 'Guardian / Responsible',
      colPhone: 'Phone Number', colPaid: 'Paid?', noMatch: 'No guardians match your search.', none: 'No guardians found.',
      studentsPaid: '{paid}/{total} students', thisMonth: 'This Month', allPaid: 'All Paid', remaining: '{count} remaining',
      recording: 'Recording...', markAllPaid: 'Mark All Paid', noStudents: 'No students connected to this guardian.',
      totalFees: 'Total Fees',
      pdf: { title: 'PAYMENT RESPONSIBILITY REPORT', phone: 'PHONE', relationship: 'RELATIONSHIP', file: 'Payment_Responsibility' }
    },
    category: {
      loading: 'Loading Category Summary Report...', subtitle: 'Income & Expense totals grouped by category',
      uncategorised: 'Uncategorised', categoryCount_one: '{count} category', categoryCount_other: '{count} categories',
      categoryName: 'Category Name', entries: 'Entries', totalAmount: 'Total Amount ($)',
      noToneRecords: { income: 'No income records in this period.', expense: 'No expense records in this period.' },
      noRecords: 'No records in this period', sectionTotal: '{title} Total',
      incomeSummary: 'Income Summary', expenseSummary: 'Expense Summary', netIncomeFull: 'Net Income (Income − Expense)',
      incomeCategories_one: '{count} income category', incomeCategories_other: '{count} income categories',
      expenseCategories_one: '{count} expense category', expenseCategories_other: '{count} expense categories',
      netIncome: 'Net Income', incomeMinusExpense: 'Income minus Expense',
      pdf: {
        title: 'MACHAD INSTITUTE - CATEGORY SUMMARY REPORT', categoryName: 'CATEGORY NAME', type: 'TYPE', entries: 'ENTRIES',
        sectionTotal: '{heading} TOTAL', income: 'INCOME SUMMARY', expense: 'EXPENSE SUMMARY',
        net: 'NET INCOME (Income - Expense)', file: 'Machad_Category_Summary'
      }
    },
    payment: {
      loading: 'Loading Payment Report...', subtitle: 'All money movements — credit & debit ledger', credit: 'Credit', debit: 'Debit',
      filterPayments: 'Filter payments', searchLabel: 'Search by Name or Phone Number', searchPlaceholder: 'Search by Name or Phone Number...',
      typeFilter: { All: 'All', Credit: 'Credit (Income)', Debit: 'Debit (Expense)' },
      amountCol: 'Amount ($)', empty: 'No payment records found for the selected filters.', summary: 'Financial Summary',
      totalIncome: 'Total Income', totalExpense: 'Total Expense', totalIncomeCol: 'Total Income ($)',
      totalExpenseCol: 'Total Expense ($)', netIncomeCol: 'Net Income ($)',
      pdf: {
        title: 'MACHAD INSTITUTE - PAYMENT REPORT', category: 'CATEGORY', sender: 'SENDER', receiver: 'RECEIVER',
        amount: 'AMOUNT ($)', date: 'DATE', summary: 'FINANCIAL SUMMARY', file: 'Machad_Payment_Report'
      }
    }
  },
  so: {
    common: {
      printReport: 'Daabac Warbixinta', allWallets: 'Dhammaan Kaydadka', instituteName: 'MACHADKA WAXBARASHADA',
      reportDate: 'Taariikhda Warbixinta', accountantSignature: 'Saxiixa Xisaabiyaha / Qasnajiga', directorStamp: 'Shaabadda Agaasimaha / Maamulka',
      unknownPayer: 'Bixiye Aan La Aqoon', searchPayer: 'Raadi magaca bixiyaha ama telefoonka...', systemName: 'Nidaamka Maamulka Machadka',
      loadFailed: 'Soo rarista xogta warbixinta way fashilantay.', allTime: 'Dhammaan Waqtiyada', period: 'Muddada', reportPeriod: 'Muddada warbixinta',
      currentPeriod: 'Muddada Hadda (25→24)'
    },
    fee: {
      loading: 'Waxaa la soo rarayaa warbixinta lacag-bixinta khidmadda...', loadFailed: 'Soo rarista xogta warbixinta lacag-bixinta way fashilantay.',
      subtitle: 'Ururinta Khidmadda Ardayda & Warbixinnada Maaliyadda ee Machadka', noResponsible: 'Masuul ma leh',
      totalCollected: 'Wadarta Lacagta La Ururiyey', paidEntries_one: '{count} gelin la bixiyey', paidEntries_other: '{count} gelin oo la bixiyey',
      totalPending: 'Wadarta Khidmadda Ku Dhiman', pendingEntries_one: '{count} gelin ku dhiman', pendingEntries_other: '{count} gelin oo ku dhiman',
      grandTotal: 'Wadarta Guud ee Lacagta', sumRows: 'Isku-darka dhammaan {count} safka warbixinta',
      status: { All: 'Dhammaan', Paid: 'La bixiyey', Unpaid: 'Aan la bixin', Remaining: 'Haraaga' },
      officialTitle: 'Warbixinta Rasmiga ah ee Lacag-bixinta & Ururinta Khidmadda', subtotalTitle: 'Wadar-hoosaadka Lacag-bixinta Bixiyeyaasha',
      subtotalHint: 'Lacag-bixinnada dhammaaday oo loo kala qaybiyey masuulka, una dhigma shaandhaynta kore.',
      subtotalCount_one: 'Wadar-hoosaad · {count} bixiye', subtotalCount_other: 'Wadar-hoosaad · {count} bixiye',
      noCompleted: 'Lacag-bixin dhammaatay oo u dhiganta shaandhaynta hadda ma jirto.', responsibleParty: 'Masuulka',
      payments: 'Lacag-bixinnada', subtotal: 'Wadar-hoosaad', payerPhone: 'Telefoonka Bixiyaha', monthDate: 'Bisha / Taariikhda',
      depositWallet: 'Kaydka Lagu Shubay', paidCol: 'La bixiyey ($)', unpaidCol: 'Aan la bixin ($)', current: 'Hadda',
      empty: 'Diiwaan lacag-bixin khidmad lama helin.', totalPaidUnpaid: 'WADARTA LA BIXIYEY / AAN LA BIXIN',
      pdf: {
        title: 'MACHADKA - WARBIXINTA LACAG-BIXINTA KHIDMADDA', totalEntries: 'Wadarta Gelinnada', payerPhone: 'TELEFOONKA BIXIYAHA',
        month: 'BISHA', wallet: 'KAYDKA', paid: 'LA BIXIYEY ($)', unpaid: 'AAN LA BIXIN ($)', totalPaid: 'WADARTA LA BIXIYEY',
        file: 'Warbixinta_Lacag_Bixinta_Khidmadda'
      }
    },
    guardian: {
      title: 'Masuuliyadda Lacag-bixinta', printTitle: 'Warbixinta Masuuliyadda Lacag-bixinta', subtitle: 'Yaa bixiyey khidmadda ardayda',
      loading: 'Waxaa la soo rarayaa xogta masuuliyadda lacag-bixinta...', loadFailed: 'Soo rarista xogta way fashilantay.',
      alreadyPaidTitle: 'Horey Ayaa Loo Bixiyey', alreadyPaid: 'Dhammaan ardayda horey ayay u bixiyeen bishan.',
      confirmTitle: 'Xaqiiji Lacag-bixinta', confirmMessage: 'Ma diiwaangelinaysaa lacag-bixinta {count} arday ee hoos yimaada "{name}"?\nWadarta: ${amount} ({month})',
      yesRecord: 'Haa, Diiwaangeli', recordedTitle: 'Lacag-bixinta Waa La Diiwaangeliyey', recorded: 'Dhammaan khidmadaha {name} waa la diiwaangeliyey.',
      recordFailed: 'Diiwaangelinta lacag-bixinta way fashilantay.', totalRecords: 'Wadarta diiwaannada', paidUpper: 'LA BIXIYEY', pendingUpper: 'KU DHIMAN',
      totalGuardians: 'Masuuliyiinta Guud', paidThisMonth: 'Bixiyey Bishan', notYetPaid: 'Weli Aan Bixin',
      searchPlaceholder: 'Ku raadi magaca masuulka ama lambarka telefoonka...', colGuardian: 'Masuulka',
      colPhone: 'Lambarka Telefoonka', colPaid: 'La bixiyey?', noMatch: 'Masuul u dhigma raadintaada ma jiro.', none: 'Masuul lama helin.',
      studentsPaid: '{paid}/{total} arday', thisMonth: 'Bishan', allPaid: 'Dhammaan Waa La Bixiyey', remaining: '{count} ayaa haray',
      recording: 'Waa la diiwaangelinayaa...', markAllPaid: 'Calaamadee Dhammaan inay Bixiyeen', noStudents: 'Masuulkan arday kuma xirna.',
      totalFees: 'Wadarta Khidmadda',
      pdf: { title: 'WARBIXINTA MASUULIYADDA LACAG-BIXINTA', phone: 'TELEFOONKA', relationship: 'XIRIIRKA', file: 'Masuuliyadda_Lacag_Bixinta' }
    },
    category: {
      loading: 'Waxaa la soo rarayaa warbixinta soo-koobidda qaybaha...', subtitle: 'Wadarta dakhliga & kharashka oo loo kala qaybiyey qaybaha',
      uncategorised: 'Qayb la\'aan', categoryCount_one: '{count} qayb', categoryCount_other: '{count} qaybood',
      categoryName: 'Magaca Qaybta', entries: 'Gelinnada', totalAmount: 'Wadarta Lacagta ($)',
      noToneRecords: { income: 'Muddadan diiwaan dakhli ah kuma jiro.', expense: 'Muddadan diiwaan kharash ah kuma jiro.' },
      noRecords: 'Muddadan diiwaan kuma jiro', sectionTotal: 'Wadarta {title}',
      incomeSummary: 'Soo-koobidda Dakhliga', expenseSummary: 'Soo-koobidda Kharashka', netIncomeFull: 'Dakhliga Saafiga ah (Dakhli − Kharash)',
      incomeCategories_one: '{count} qayb dakhli', incomeCategories_other: '{count} qaybood oo dakhli ah',
      expenseCategories_one: '{count} qayb kharash', expenseCategories_other: '{count} qaybood oo kharash ah',
      netIncome: 'Dakhliga Saafiga ah', incomeMinusExpense: 'Dakhliga oo laga jaray kharashka',
      pdf: {
        title: 'MACHADKA - WARBIXINTA SOO-KOOBIDDA QAYBAHA', categoryName: 'MAGACA QAYBTA', type: 'NOOCA', entries: 'GELINNADA',
        sectionTotal: 'WADARTA {heading}', income: 'SOO-KOOBIDDA DAKHLIGA', expense: 'SOO-KOOBIDDA KHARASHKA',
        net: 'DAKHLIGA SAAFIGA AH (Dakhli - Kharash)', file: 'Soo_Koobidda_Qaybaha'
      }
    },
    payment: {
      loading: 'Waxaa la soo rarayaa warbixinta lacag-bixinta...', subtitle: 'Dhammaan dhaqdhaqaaqa lacagta — diiwaanka soo-galka & bixidda', credit: 'Soo-gal', debit: 'Bixid',
      filterPayments: 'Shaandhee lacag-bixinnada', searchLabel: 'Ku raadi Magaca ama Lambarka Telefoonka', searchPlaceholder: 'Ku raadi magaca ama lambarka telefoonka...',
      typeFilter: { All: 'Dhammaan', Credit: 'Soo-gal (Dakhli)', Debit: 'Bixid (Kharash)' },
      amountCol: 'Lacagta ($)', empty: 'Shaandhaynta la doortay diiwaan lacag-bixin ah looma helin.', summary: 'Soo-koobidda Maaliyadda',
      totalIncome: 'Dakhliga Guud', totalExpense: 'Kharashka Guud', totalIncomeCol: 'Dakhliga Guud ($)',
      totalExpenseCol: 'Kharashka Guud ($)', netIncomeCol: 'Dakhliga Saafiga ah ($)',
      pdf: {
        title: 'MACHADKA - WARBIXINTA LACAG-BIXINTA', category: 'QAYBTA', sender: 'DIRAHA', receiver: 'QAATAHA',
        amount: 'LACAGTA ($)', date: 'TAARIIKHDA', summary: 'SOO-KOOBIDDA MAALIYADDA', file: 'Warbixinta_Lacag_Bixinta'
      }
    }
  }
};
