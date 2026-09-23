// Shared vocabulary used across many screens (buttons, generic labels, dates,
// alerts, pagination). Somali glossary kept consistent system-wide:
//   Dashboard → Dulmarka Nidaamka · Finance → Maaliyadda · Students → Ardayda
//   Teachers → Macallimiinta · Payers → Bixiyeyaasha · Attendance → Xaadirinta
//   Reports → Warbixinnada · Settings → Dejinta · Payments → Lacag-bixinta
//   Expenses → Kharashaadka · Income → Dakhliga · Classes → Fasallada
//   Guardians → Masuuliyiinta · Cashbook → Buugga Lacagta · Wallets → Kaydadka Lacagta
//   Branches → Laamaha · Billing cycle → Wareegga Lacag-bixinta · Balance → Haraaga
export default {
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    alert: {
      success: 'Woohoo!', error: 'Uh oh!', warning: 'Warning', info: 'Notice', confirm: 'Are you sure?',
      confirmButton: 'Confirm', continueButton: 'Continue', cancelButton: 'Cancel'
    },
    pageOf: 'Page {page} of {total}',
    cancel: 'Cancel', save: 'Save', saveChanges: 'Save Changes', saving: 'Saving...', actions: 'Actions',
    success: 'Success', error: 'Error', deleted: 'Deleted', validationError: 'Validation Error', yesDelete: 'Yes, delete',
    branch: 'Branch', selectBranch: '-- Select Branch --', loading: 'Loading...', search: 'Search', edit: 'Edit',
    delete: 'Delete', close: 'Close', status: 'Status', name: 'Name', phone: 'Phone', date: 'Date', amount: 'Amount',
    total: 'Total', notes: 'Notes', description: 'Description', all: 'All', print: 'Print', export: 'Export',
    refresh: 'Refresh', confirm: 'Confirm', yes: 'Yes', no: 'No', add: 'Add', update: 'Update', view: 'View',
    back: 'Back', next: 'Next', previous: 'Previous', details: 'Details', active: 'Active', inactive: 'Inactive',
    warning: 'Warning', info: 'Info', notice: 'Notice', today: 'Today', class: 'Class', student: 'Student',
    teacher: 'Teacher', guardian: 'Guardian', email: 'Email', address: 'Address', gender: 'Gender', month: 'Month',
    year: 'Year', from: 'From', to: 'To', none: 'None', optional: 'Optional', required: 'Required', clear: 'Clear',
    reset: 'Reset', apply: 'Apply', download: 'Download', upload: 'Upload', import: 'Import', submit: 'Submit',
    selectClass: '-- Select Class --', allClasses: 'All Classes', allBranches: 'All Branches', allStatuses: 'All Statuses',
    noData: 'No data available', notAvailable: 'N/A', unknown: 'Unknown', type: 'Type', method: 'Method', wallet: 'Wallet',
    category: 'Category', balance: 'Balance', paid: 'Paid', remaining: 'Remaining', reference: 'Reference', code: 'Code'
  },
  so: {
    months: ['Jannaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maayo', 'Juun', 'Luulyo', 'Ogosto', 'Sebteembar', 'Oktoobar', 'Noofeembar', 'Diseembar'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Luu', 'Ogo', 'Seb', 'Okt', 'Nof', 'Dis'],
    weekdays: ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimco', 'Sabti'],
    weekdaysShort: ['Axd', 'Isn', 'Tal', 'Arb', 'Kha', 'Jim', 'Sab'],
    alert: {
      success: 'Waa lagu guuleystay!', error: 'Khalad ayaa dhacay!', warning: 'Digniin', info: 'Ogeysiis', confirm: 'Ma hubtaa?',
      confirmButton: 'Xaqiiji', continueButton: 'Sii wad', cancelButton: 'Jooji'
    },
    pageOf: 'Bogga {page} ee {total}',
    cancel: 'Jooji', save: 'Kaydi', saveChanges: 'Kaydi Isbeddellada', saving: 'Waa la kaydinayaa...', actions: 'Ficillada',
    success: 'Guul', error: 'Khalad', deleted: 'La tirtiray', validationError: 'Khalad Xaqiijin', yesDelete: 'Haa, tirtir',
    branch: 'Laanta', selectBranch: '-- Dooro Laanta --', loading: 'Waa la soo rarayaa...', search: 'Raadi', edit: 'Wax ka beddel',
    delete: 'Tirtir', close: 'Xir', status: 'Xaaladda', name: 'Magaca', phone: 'Telefoonka', date: 'Taariikhda', amount: 'Lacagta',
    total: 'Wadarta', notes: 'Qoraallo', description: 'Faahfaahin', all: 'Dhammaan', print: 'Daabac', export: 'Soo Saar',
    refresh: 'Cusboonaysii', confirm: 'Xaqiiji', yes: 'Haa', no: 'Maya', add: 'Ku dar', update: 'Cusboonaysii', view: 'Eeg',
    back: 'Dib u noqo', next: 'Xiga', previous: 'Hore', details: 'Faahfaahin', active: 'Firfircoon', inactive: 'Aan firfircooneyn',
    warning: 'Digniin', info: 'Macluumaad', notice: 'Ogeysiis', today: 'Maanta', class: 'Fasalka', student: 'Ardayga',
    teacher: 'Macallinka', guardian: 'Masuulka', email: 'Iimaylka', address: 'Cinwaanka', gender: 'Jinsiga', month: 'Bisha',
    year: 'Sannadka', from: 'Laga bilaabo', to: 'Ilaa', none: 'Midna', optional: 'Ikhtiyaari', required: 'Qasab', clear: 'Nadiifi',
    reset: 'Dib u deji', apply: 'Dabaq', download: 'Soo deji', upload: 'Soo geli', import: 'Soo Geli', submit: 'Gudbi',
    selectClass: '-- Dooro Fasalka --', allClasses: 'Dhammaan Fasallada', allBranches: 'Dhammaan Laamaha', allStatuses: 'Dhammaan Xaaladaha',
    noData: 'Xog lama hayo', notAvailable: 'Ma jiro', unknown: 'Lama yaqaan', type: 'Nooca', method: 'Habka', wallet: 'Kaydka Lacagta',
    category: 'Qaybta', balance: 'Haraaga', paid: 'La bixiyey', remaining: 'Haraaga', reference: 'Tixraac', code: 'Koodka'
  }
};
