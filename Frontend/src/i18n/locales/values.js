// Display labels for values that are STORED in the database (statuses, roles,
// methods, types…). Use tv(value) in components: the stored value is never
// changed and is still what gets sent to the API — only the label is localized.
// English maps each value to itself so English output is exactly unchanged.
const EN = [
  'Active', 'Inactive', 'Disabled', 'Graduated', 'Exited', 'On Leave',
  'Paid', 'Unpaid', 'Pending', 'Partial', 'Completed', 'Failed', 'Cancelled', 'In Progress', 'In-Progress',
  'Present', 'Absent', 'Late', 'Leave', 'Half Day', 'Overtime', 'Remote', 'Excused',
  'Income', 'Expense', 'Asset', 'Liability', 'Equity',
  'Cash', 'Bank', 'Bank Transfer', 'Mobile', 'Mobile Money', 'Card', 'Merchant', 'Other', 'EVC-Plus', 'E-Dahab',
  'Male', 'Female',
  'Daily', 'Weekly', 'Monthly', 'Hourly', 'Session',
  'Morning', 'Breakfast', 'Evening', 'Night', 'Custom',
  'Parent', 'Responsible',
  'Scheduled', 'Ongoing', 'Published', 'Mid-Term', 'Final', 'Quiz',
  'Super Admin', 'Institute Admin', 'Branch Manager', 'Teacher', 'Accountant', 'User', 'Admin', 'Student', 'Guardian',
  'Owner', 'Cashier', 'Manager',
  'Manual', 'System', 'Low', 'Normal', 'High', 'Urgent',
  'Payment', 'Adjustment', 'Opening Balance', 'Salary', 'Fee', 'Transfer',
  'guardian', 'student', 'user', 'teacher', 'manual', 'auto', 'active', 'inactive', 'paid', 'pending', 'partial'
];

export default {
  en: Object.fromEntries(EN.map((v) => [v, v])),
  so: {
    Active: 'Firfircoon', Inactive: 'Aan firfircooneyn', Disabled: 'La joojiyey', Graduated: 'Qalin-jebiyey', Exited: 'Baxay', 'On Leave': 'Fasax ku maqan',
    Paid: 'La bixiyey', Unpaid: 'Aan la bixin', Pending: 'Ku dhiman', Partial: 'Qayb la bixiyey', Completed: 'Dhammaaday', Failed: 'Fashilmay',
    Cancelled: 'La joojiyey', 'In Progress': 'Socda', 'In-Progress': 'Socda',
    Present: 'Joogay', Absent: 'Maqan', Late: 'Daahay', Leave: 'Fasax', 'Half Day': 'Nus maalin', Overtime: 'Saacado dheeraad ah', Remote: 'Meel fog', Excused: 'Cudurdaar',
    Income: 'Dakhli', Expense: 'Kharash', Asset: 'Hanti', Liability: 'Deyn', Equity: 'Raasumaal',
    Cash: 'Lacag caddaan ah', Bank: 'Bangi', 'Bank Transfer': 'Xawilaad bangi', Mobile: 'Moobeel', 'Mobile Money': 'Lacag moobeel',
    Card: 'Kaar', Merchant: 'Ganacsade', Other: 'Kale', 'EVC-Plus': 'EVC-Plus', 'E-Dahab': 'E-Dahab',
    Male: 'Lab', Female: 'Dhedig',
    Daily: 'Maalinle', Weekly: 'Toddobaadle', Monthly: 'Bille', Hourly: 'Saacadle', Session: 'Fadhi',
    Morning: 'Subax', Breakfast: 'Quraac', Evening: 'Galab', Night: 'Habeen', Custom: 'Gaar ah',
    Parent: 'Waalid', Responsible: 'Masuul',
    Scheduled: 'La qorsheeyey', Ongoing: 'Socda', Published: 'La daabacay', 'Mid-Term': 'Bartamaha Termiga', Final: 'Kama dambays', Quiz: 'Kedis',
    'Super Admin': 'Maamulaha Sare', 'Institute Admin': 'Maamulaha Machadka', 'Branch Manager': 'Maareeyaha Laanta',
    Teacher: 'Macallin', Accountant: 'Xisaabiye', User: 'Isticmaale', Admin: 'Maamule', Student: 'Arday', Guardian: 'Masuul',
    Owner: 'Milkiile', Cashier: 'Qasnaji', Manager: 'Maareeye',
    Manual: 'Gacan ku gelin', System: 'Nidaamka', Low: 'Hoose', Normal: 'Caadi', High: 'Sare', Urgent: 'Degdeg',
    Payment: 'Lacag-bixin', Adjustment: 'Hagaajin', 'Opening Balance': 'Haraaga Furitaanka', Salary: 'Mushahar', Fee: 'Khidmad', Transfer: 'Wareejin',
    guardian: 'Masuul', student: 'Arday', user: 'Isticmaale', teacher: 'Macallin', manual: 'Gacan ku gelin', auto: 'Toos',
    active: 'Firfircoon', inactive: 'Aan firfircooneyn', paid: 'La bixiyey', pending: 'Ku dhiman', partial: 'Qayb la bixiyey'
  }
};
