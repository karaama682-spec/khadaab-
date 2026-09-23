// Monthly Payments (payers per billing cycle, including the printed report).
export default {
  en: {
    title: 'Monthly Payments', subtitle: 'Billing-cycle fee collection (25th → 24th)', cycle: 'Cycle',
    cycleOption: '{month} {year} cycle ({range})', printTitle: 'Print Report', loadFailed: 'Failed to load monthly payments.',
    totalDue: 'Total Fees Due', studentsTotal_one: '{count} student in total', studentsTotal_other: '{count} students in total',
    collected: 'Collected', paidPeople_one: '{count} payer has paid', paidPeople_other: '{count} payers have paid',
    pending: 'Pending', pendingPeople_one: '{count} payer still owes money', pendingPeople_other: '{count} payers still owe money',
    tabPaid: 'Paid', tabPending: 'Pending', searchPlaceholder: 'Search by name or phone number...',
    colPayer: 'Payer Name', colPhones: 'Phone Numbers', colFee: 'Fee', colPaid: 'Paid', colRemaining: 'Remaining',
    statusPaid: 'Paid', statusPartial: 'Partial', statusUnpaid: 'Unpaid', monthlyFee: 'Monthly Fee',
    studentPaid: 'Paid', studentPartial: 'Partial', studentUnpaid: 'Unpaid', payerTotal: 'Payer Total',
    loading: 'Loading monthly payments...', retry: 'Retry Loading',
    emptyPaidTitle: 'No payments have been received this month yet',
    emptyPaidMsg: 'None of the payers have paid for this cycle ({cycle}) yet.',
    emptyPendingTitle: 'All payers have paid in full!', emptyPendingMsg: 'There is no outstanding debt for this cycle.',
    emptyAll: 'No data found for the {month} {year} cycle.', footerCycle: '{month} {year} cycle',
    filteredCount_one: 'Filtered total: {count} payer', filteredCount_other: 'Filtered total: {count} payers',
    footerCollected: 'Collected',
    print: {
      titlePaid: 'STUDENTS & GUARDIANS WHO PAID (FEES COLLECTED)',
      titlePending: 'STUDENTS & GUARDIANS WITH OUTSTANDING FEES (PENDING FEES)',
      titleAll: 'TUITION PAYMENTS REPORT', cycle: 'Cycle', printed: 'Printed', unpaidTotal: 'Unpaid Total'
    }
  },
  so: {
    title: 'Lacag-bixinta Bishii', subtitle: 'Xisaabta Bixinta Lacagaha Wareegga (25-ka → 24-ka)', cycle: 'Wareegga',
    cycleOption: 'Wareegga {month} {year} ({range})', printTitle: 'Daabac warbixinta', loadFailed: 'Soo rarista lacag-bixinta bishii way fashilantay.',
    totalDue: 'Wadarta Khidmadda La Filayo', studentsTotal_one: '{count} arday guud ahaan', studentsTotal_other: '{count} arday guud ahaan',
    collected: 'Lacagta La Bixiyey', paidPeople_one: '{count} qof ayaa lacag bixiyey', paidPeople_other: '{count} qof ayaa lacag bixiyey',
    pending: 'Lacagta Dhiman', pendingPeople_one: '{count} qof ayaa weli lacag ku dhiman tahay', pendingPeople_other: '{count} qof ayaa weli lacag ku dhiman tahay',
    tabPaid: 'Lacagta Bixiyey', tabPending: 'Weli Aan Bixin', searchPlaceholder: 'Raadi magaca ama lambarka taleefanka...',
    colPayer: 'Magaca Bixiyaha', colPhones: 'Lambarada Telefoonka', colFee: 'Wadarta', colPaid: 'La Bixiyey', colRemaining: 'Dhiman',
    statusPaid: 'Bixiyey', statusPartial: 'Qeyb', statusUnpaid: 'Aan Bixin', monthlyFee: 'Khidmadda Bishii',
    studentPaid: 'Bixiyey', studentPartial: 'Qeyb', studentUnpaid: 'Aan Bixin', payerTotal: 'Wadarta Bixiyaha',
    loading: 'Waxaa la soo rarayaa lacag-bixinta bishii...', retry: 'Isku day mar kale',
    emptyPaidTitle: 'Ma jiraan wax lacag ah oo bishan weli la qabtay',
    emptyPaidMsg: 'Dhammaan bixiyeyaasha wareeggan ({cycle}) weli lacag ma bixin.',
    emptyPendingTitle: 'Dhammaan bixiyeyaasha waa wada bixiyeen!', emptyPendingMsg: 'Wax deyn ah oo ku dhiman wareeggan ma jiraan.',
    emptyAll: 'Lama helin wax xog ah oo ku saabsan wareegga {month} {year}.', footerCycle: 'Wareegga {month} {year}',
    filteredCount_one: 'Xisaabta shaandheysan: {count} bixiye', filteredCount_other: 'Xisaabta shaandheysan: {count} bixiye',
    footerCollected: 'La Bixiyey',
    print: {
      titlePaid: 'LIISKA ARDAYDA & WAALIDIINTA LACAGTA BIXIYEY',
      titlePending: 'LIISKA ARDAYDA & WAALIDIINTA DEYNTA KU DHIMAN TAHAY',
      titleAll: 'WARBIXINTA GUUD EE BIXINTA LACAGAHA', cycle: 'Wareegga', printed: 'Daabacay', unpaidTotal: 'Wadarta Dhiman'
    }
  }
};
