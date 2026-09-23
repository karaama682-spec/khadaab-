import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SUPPORTED_LANGUAGES, getLanguage, setCurrentLanguage, translate, translateValue,
  dateLocale, monthNames, monthShortNames
} from './core.js';

// Legacy Arabic support: common words rendered outside the key-based system are
// swapped in the DOM while Arabic is active (and swapped back when leaving it).
const legacyArabic = {
  'Add': 'إضافة', 'Edit': 'تعديل', 'Delete': 'حذف', 'Save': 'حفظ', 'Save Changes': 'حفظ التغييرات', 'Cancel': 'إلغاء', 'Close': 'إغلاق', 'Search': 'بحث', 'Filter': 'تصفية', 'Export': 'تصدير', 'Print': 'طباعة', 'Refresh': 'تحديث', 'Actions': 'إجراءات', 'Status': 'الحالة', 'Name': 'الاسم', 'Email': 'البريد الإلكتروني', 'Phone': 'الهاتف', 'Address': 'العنوان', 'Date': 'التاريخ', 'Amount': 'المبلغ', 'Total': 'الإجمالي', 'Description': 'الوصف', 'Notes': 'ملاحظات', 'Submit': 'إرسال', 'Back': 'رجوع', 'Next': 'التالي', 'Previous': 'السابق', 'View': 'عرض', 'Details': 'التفاصيل', 'Active': 'نشط', 'Inactive': 'غير نشط', 'Paid': 'مدفوع', 'Unpaid': 'غير مدفوع', 'Present': 'حاضر', 'Absent': 'غائب', 'Loading...': 'جارٍ التحميل...', 'No data available': 'لا توجد بيانات', 'Create': 'إنشاء', 'Update': 'تحديث', 'Student': 'طالب', 'Teacher': 'معلم', 'Class': 'فصل', 'Payment': 'دفع', 'Expense': 'مصروف', 'Salary': 'راتب', 'User': 'مستخدم', 'Role': 'دور', 'Permission': 'صلاحية'
};
const legacyArabicReverse = Object.fromEntries(Object.entries(legacyArabic).map(([english, arabic]) => [arabic, english]));
const translateText = (text, language) => {
  const trimmed = text.trim();
  const translated = language === 'ar' ? legacyArabic[trimmed] : legacyArabicReverse[trimmed];
  return translated ? text.replace(trimmed, translated) : text;
};
const localizeElement = (element, language) => {
  if (!element || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(element.tagName) || element.isContentEditable) return;
  ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
    if (element.hasAttribute?.(attribute)) element.setAttribute(attribute, translateText(element.getAttribute(attribute), language));
  });
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => { node.nodeValue = translateText(node.nodeValue, language); });
};

const LanguageContext = createContext(null);
export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getLanguage);
  const setLanguage = useCallback((value) => {
    const next = SUPPORTED_LANGUAGES.includes(value) ? value : 'en';
    // Update the module-level language first so non-React helpers used during
    // the re-render (date/cycle labels, API messages) already see the new one.
    setCurrentLanguage(next);
    setLanguageState(next);
  }, []);
  useEffect(() => {
    localStorage.setItem('appLanguage', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    const localize = (node = document.body) => localizeElement(node, language);
    localize();
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) localize(node);
      if (node.nodeType === Node.TEXT_NODE) node.nodeValue = translateText(node.nodeValue, language);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key, vars) => translate(key, vars, language),
    // Display label for a stored value (status, role, method…); value unchanged.
    tv: (stored) => translateValue(stored, language),
    locale: dateLocale(language),
    months: monthNames(language),
    monthsShort: monthShortNames(language)
  }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
};

export { translate, translateValue, dateLocale } from './core.js';
