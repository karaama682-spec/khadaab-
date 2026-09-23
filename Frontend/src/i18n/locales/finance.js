// Finance: Teacher Salaries, Expenses, Transactions ledger, Wallets.
export default {
  en: {
    updatedTitle: 'Updated', createdTitle: 'Created', paidFromWallet: 'Paid From Wallet', amountLabel: 'Amount ($) *',
    selectWallet: '-- Select Wallet --', paymentMethod: 'Payment Method', mobileMoneyEvc: 'Mobile Money (Evc Plus)',
    optionalNotes: 'Optional notes...', optionalDescription: 'Optional description...',
    salaries: {
      title: 'Teacher Salaries', subtitle: 'Payroll & Disbursements', loading: 'Loading Salaries...', disburse: 'Disburse Salary',
      addTitle: 'Disburse Teacher Salary', editTitle: 'Edit Salary Record', searchPlaceholder: 'Search by teacher name or month...',
      empty: 'No salary records found. Click "Disburse Salary" to add one.', monthLabel: 'Month *',
      walletLabel: 'Disbursement Wallet / Account *', required: 'Teacher and salary amount are required.',
      updated: 'Salary record updated.', disbursed: 'Teacher salary disbursed successfully.', saveFailed: 'Failed to save salary record.',
      deleteTitle: 'Delete Salary?', deleteConfirm: 'This action cannot be undone.', deletedMsg: 'Salary record deleted.',
      deleteFailed: 'Failed to delete salary record.'
    },
    expenses: {
      title: 'Expenses', subtitle: 'Institute Expenditures', loading: 'Loading Expenses...', recordNew: 'Record New Expense',
      record: 'Record Expense', editTitle: 'Edit Expense', searchPlaceholder: 'Search by title or category...', colTitle: 'Title',
      empty: 'No expenses recorded. Click "Record New Expense" to add one.', titleLabel: 'Expense Title *',
      titlePlaceholder: 'e.g. Electricity Bill', walletLabel: 'Paid From Wallet / Account *',
      categories: { Utilities: 'Utilities', Maintenance: 'Maintenance', Supplies: 'Supplies', Rent: 'Rent', Transport: 'Transport', Events: 'Events', Other: 'Other' },
      required: 'Title and amount are required.', updated: 'Expense record updated.', recorded: 'Expense recorded successfully.',
      saveFailed: 'Failed to save expense.', deleteTitle: 'Delete Expense?', deleteConfirm: 'This action cannot be undone.',
      deletedMsg: 'Expense deleted.', deleteFailed: 'Failed to delete expense.'
    },
    transactions: {
      title: 'Transactions', subtitle: 'Financial Ledger', loading: 'Loading Transactions...',
      generatedFrom: 'Generated from Cashbook, Payments, Salaries & Expenses', searchPlaceholder: 'Search by description or type...',
      empty: 'No transactions yet. They appear here automatically when a cashbook entry, payment, salary or expense is recorded.',
      editTitle: 'Edit Transaction', typeLabel: 'Transaction Type', amountRequired: 'Amount is required.',
      updated: 'Transaction updated.', updateFailed: 'Failed to update transaction.', deleteTitle: 'Delete Transaction?',
      deleteConfirm: 'This cannot be undone.', deletedMsg: 'Transaction deleted.', deleteFailed: 'Failed to delete transaction.'
    },
    wallets: {
      title: 'Wallets', subtitle: 'Fund Accounts', loading: 'Loading Wallets...', addNew: 'Add New Wallet', editTitle: 'Edit Wallet',
      create: 'Create Wallet', searchPlaceholder: 'Search wallets...', colName: 'Wallet Name', colAccount: 'Account No.',
      empty: 'No wallets found. Click "Add New Wallet" to create one.', nameLabel: 'Wallet Name *', namePlaceholder: 'e.g. Main Cash Box',
      typeLabel: 'Wallet Type', bankAccount: 'Bank Account', initialBalance: 'Initial Balance', usd: 'USD - US Dollar',
      sos: 'SOS - Somali Shilling', accountNumber: 'Account Number', accountPlaceholder: 'Institute bank / mobile-money account number',
      nameRequired: 'Wallet name is required.', updated: 'Wallet updated.', created: 'Wallet created successfully.',
      saveFailed: 'Failed to save wallet.', deleteTitle: 'Delete Wallet?', deleteConfirm: 'This cannot be undone.',
      deletedMsg: 'Wallet deleted.', deleteFailed: 'Failed to delete wallet.'
    }
  },
  so: {
    updatedTitle: 'Waa la cusbooneysiiyey', createdTitle: 'Waa la sameeyey', paidFromWallet: 'Laga Bixiyey Kaydka', amountLabel: 'Lacagta ($) *',
    selectWallet: '-- Dooro Kaydka Lacagta --', paymentMethod: 'Habka Lacag-bixinta', mobileMoneyEvc: 'Lacag Moobeel (EVC Plus)',
    optionalNotes: 'Qoraallo (ikhtiyaari)...', optionalDescription: 'Faahfaahin (ikhtiyaari)...',
    salaries: {
      title: 'Mushaharka Macallimiinta', subtitle: 'Mushaharaadka & Bixinta', loading: 'Waxaa la soo rarayaa mushaharaadka...', disburse: 'Bixi Mushaharka',
      addTitle: 'Bixi Mushaharka Macallinka', editTitle: 'Wax ka beddel Diiwaanka Mushaharka', searchPlaceholder: 'Ku raadi magaca macallinka ama bisha...',
      empty: 'Diiwaan mushahar lama helin. Guji "Bixi Mushaharka" si aad mid ugu darto.', monthLabel: 'Bisha *',
      walletLabel: 'Kaydka / Akoonka Laga Bixinayo *', required: 'Macallinka iyo qadarka mushaharka waa qasab.',
      updated: 'Diiwaanka mushaharka waa la cusbooneysiiyey.', disbursed: 'Mushaharka macallinka si guul leh ayaa loo bixiyey.', saveFailed: 'Kaydinta diiwaanka mushaharka way fashilantay.',
      deleteTitle: 'Tirtir Mushaharka?', deleteConfirm: 'Tan dib looma celin karo.', deletedMsg: 'Diiwaanka mushaharka waa la tirtiray.',
      deleteFailed: 'Tirtirista diiwaanka mushaharka way fashilantay.'
    },
    expenses: {
      title: 'Kharashaadka', subtitle: 'Kharashaadka Machadka', loading: 'Waxaa la soo rarayaa kharashaadka...', recordNew: 'Diiwaangeli Kharash Cusub',
      record: 'Diiwaangeli Kharashka', editTitle: 'Wax ka beddel Kharashka', searchPlaceholder: 'Ku raadi magaca ama qaybta...', colTitle: 'Magaca',
      empty: 'Kharash lama diiwaangelin. Guji "Diiwaangeli Kharash Cusub" si aad mid ugu darto.', titleLabel: 'Magaca Kharashka *',
      titlePlaceholder: 'tusaale: Biilka Korontada', walletLabel: 'Kaydka / Akoonka Laga Bixiyey *',
      categories: { Utilities: 'Adeegyada Guud', Maintenance: 'Dayactir', Supplies: 'Agab', Rent: 'Kiro', Transport: 'Gaadiid', Events: 'Munaasabado', Other: 'Kale' },
      required: 'Magaca iyo lacagta waa qasab.', updated: 'Diiwaanka kharashka waa la cusbooneysiiyey.', recorded: 'Kharashka si guul leh ayaa loo diiwaangeliyey.',
      saveFailed: 'Kaydinta kharashka way fashilantay.', deleteTitle: 'Tirtir Kharashka?', deleteConfirm: 'Tan dib looma celin karo.',
      deletedMsg: 'Kharashka waa la tirtiray.', deleteFailed: 'Tirtirista kharashka way fashilantay.'
    },
    transactions: {
      title: 'Macaamilada', subtitle: 'Diiwaanka Maaliyadda', loading: 'Waxaa la soo rarayaa macaamilada...',
      generatedFrom: 'Waxaa laga sameeyey Buugga Lacagta, Lacag-bixinta, Mushaharaadka & Kharashaadka', searchPlaceholder: 'Ku raadi faahfaahinta ama nooca...',
      empty: 'Weli macaamil ma jiro. Si toos ah ayay halkan uga muuqdaan marka la diiwaangeliyo gelin buugga lacagta, lacag-bixin, mushahar ama kharash.',
      editTitle: 'Wax ka beddel Macaamilka', typeLabel: 'Nooca Macaamilka', amountRequired: 'Lacagta waa qasab.',
      updated: 'Macaamilka waa la cusbooneysiiyey.', updateFailed: 'Cusboonaysiinta macaamilka way fashilantay.', deleteTitle: 'Tirtir Macaamilka?',
      deleteConfirm: 'Tan dib looma celin karo.', deletedMsg: 'Macaamilka waa la tirtiray.', deleteFailed: 'Tirtirista macaamilka way fashilantay.'
    },
    wallets: {
      title: 'Kaydadka Lacagta', subtitle: 'Akoonnada Lacagta', loading: 'Waxaa la soo rarayaa kaydadka lacagta...', addNew: 'Ku dar Kayd Cusub', editTitle: 'Wax ka beddel Kaydka',
      create: 'Samee Kaydka', searchPlaceholder: 'Raadi kaydadka lacagta...', colName: 'Magaca Kaydka', colAccount: 'Lambarka Akoonka',
      empty: 'Kayd lacageed lama helin. Guji "Ku dar Kayd Cusub" si aad mid u sameyso.', nameLabel: 'Magaca Kaydka *', namePlaceholder: 'tusaale: Sanduuqa Lacagta ee Guud',
      typeLabel: 'Nooca Kaydka', bankAccount: 'Akoon Bangi', initialBalance: 'Haraaga Bilowga', usd: 'USD - Doollarka Maraykanka',
      sos: 'SOS - Shilinka Soomaaliga', accountNumber: 'Lambarka Akoonka', accountPlaceholder: 'Lambarka akoonka bangiga / lacagta moobeelka ee machadka',
      nameRequired: 'Magaca kaydka waa qasab.', updated: 'Kaydka waa la cusbooneysiiyey.', created: 'Kaydka si guul leh ayaa loo sameeyey.',
      saveFailed: 'Kaydinta kaydka way fashilantay.', deleteTitle: 'Tirtir Kaydka?', deleteConfirm: 'Tan dib looma celin karo.',
      deletedMsg: 'Kaydka waa la tirtiray.', deleteFailed: 'Tirtirista kaydka way fashilantay.'
    }
  }
};
