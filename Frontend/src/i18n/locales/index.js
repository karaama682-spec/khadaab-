// Builds the per-language dictionaries from the namespace files in this folder.
// Each namespace file exports { en: {...}, so: {...} } (optionally `ar`), and is
// mounted under its namespace name: t('<namespace>.<key>').
//
// Adding a namespace: create the file, import it here, add it to `namespaces`.
// Run `npm run i18n:check` to confirm English and Somali have identical keys.
import nav from './nav.js';
import common from './common.js';
import values from './values.js';
import auth from './auth.js';
import dashboard from './dashboard.js';
import academic from './academic.js';
import students from './students.js';
import attendance from './attendance.js';
import attendanceReport from './attendanceReport.js';
import exams from './exams.js';
import finance from './finance.js';
import cashbook from './cashbook.js';
import payers from './payers.js';
import monthlyPayments from './monthlyPayments.js';
import reports from './reports.js';
import access from './access.js';
import settings from './settings.js';
import apiMessages from './apiMessages.js';

export const namespaces = {
  nav, common, values, auth, dashboard, academic, students, attendance, attendanceReport,
  exams, finance, cashbook, payers, monthlyPayments, reports, access, settings
};

const build = (language) => Object.fromEntries(
  Object.entries(namespaces)
    .filter(([, ns]) => ns[language])
    .map(([name, ns]) => [name, ns[language]])
);

const dictionaries = { en: build('en'), so: build('so'), ar: build('ar') };

export { apiMessages };
export default dictionaries;
