// ============================================================================
// Translation core — framework-free so it can be used both by React components
// (through useLanguage) and by plain modules (API client, date/cycle helpers).
//
// Keys are dotted paths into the dictionaries built in ./locales/index.js,
// e.g. t('students.title'). Features:
//   • Interpolation:  t('common.pageOf', { page: 2, total: 9 })  →  "{page}" / "{total}"
//   • Plurals:        t('x.count', { count })  picks `count_one` / `count_other`
//     when those keys exist (falls back to the bare key).
//   • Fallback:       missing in the selected language → English → the key itself.
// ============================================================================
import dictionaries, { apiMessages } from './locales/index.js';

export const SUPPORTED_LANGUAGES = ['en', 'so', 'ar'];

let currentLanguage = (() => {
  try {
    const stored = localStorage.getItem('appLanguage');
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : 'en';
  } catch {
    return 'en';
  }
})();

export const getLanguage = () => currentLanguage;
export const setCurrentLanguage = (language) => {
  currentLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
};

const lookup = (dict, key) => {
  if (!dict) return undefined;
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
};

const interpolate = (text, vars) => (vars
  ? text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : match))
  : text);

export const translate = (key, vars, language = currentLanguage) => {
  if (!key) return '';
  const dict = dictionaries[language] || dictionaries.en;
  let resolvedKey = key;
  if (vars && typeof vars.count === 'number') {
    const pluralKey = `${key}_${vars.count === 1 ? 'one' : 'other'}`;
    if (lookup(dict, pluralKey) !== undefined || lookup(dictionaries.en, pluralKey) !== undefined) resolvedKey = pluralKey;
  }
  let value = lookup(dict, resolvedKey);
  if (value === undefined) value = lookup(dictionaries.en, resolvedKey);
  if (value === undefined) {
    // Optional { defaultValue } for dynamic keys that may legitimately be absent.
    if (vars && vars.defaultValue !== undefined) return vars.defaultValue;
    if (import.meta.env?.DEV) console.warn(`[i18n] Missing translation key: ${key}`);
    return key;
  }
  return typeof value === 'string' ? interpolate(value, vars) : value;
};

// Locale passed to toLocaleDateString / toLocaleTimeString / Intl. English keeps
// `undefined` (the browser default) so existing English output is unchanged.
// Many browsers ship without Somali ICU data and silently fall back to English
// ("PM", "September"). In that case use en-GB, which formats numerically with a
// 24-hour clock, so no English words appear. Month names are rendered with
// monthNames() at the call sites that need them.
const somaliDateLocale = (() => {
  try { return Intl.DateTimeFormat.supportedLocalesOf(['so']).length ? 'so' : 'en-GB'; } catch { return 'en-GB'; }
})();
export const dateLocale = (language = currentLanguage) => (language === 'so' ? somaliDateLocale : undefined);

// Full month names for the selected language (index 0 = January).
export const monthNames = (language = currentLanguage) => translate('common.months', undefined, language);
export const monthShortNames = (language = currentLanguage) => translate('common.monthsShort', undefined, language);

// Display label for a stored enum/status value (e.g. "Paid", "Active", "Cash").
// The stored value itself is never changed; unknown values are shown as-is.
export const translateValue = (value, language = currentLanguage) => {
  if (value === undefined || value === null || value === '') return value;
  const text = String(value);
  const hit = lookup(dictionaries[language], `values.${text}`);
  return typeof hit === 'string' ? hit : text;
};

// Backend (API) messages are English (a few are Somali). They are translated for
// display only: Somali mode maps English → Somali (exact, then patterns); English
// mode maps the few Somali server messages → English.
export const translateApiMessage = (message, language = currentLanguage) => {
  if (typeof message !== 'string' || !message) return message;
  if (language === 'en') return apiMessages.toEnglish[message.trim()] || message;
  if (language !== 'so') return message;
  const exact = apiMessages.exact[message.trim()];
  if (exact) return exact;
  for (const [pattern, replacement] of apiMessages.patterns) {
    if (pattern.test(message)) return message.replace(pattern, replacement);
  }
  return message;
};
