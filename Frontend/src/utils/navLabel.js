import { NAV_CONFIG } from '../constants.jsx';
import { translate } from '../i18n/core.js';

// Permission matrices are keyed by the English NAV_CONFIG labels (that is what
// the stored permissions and permission checks use). This returns the label in
// the selected language for display only; unknown labels are shown unchanged.
export const navLabel = (label) => {
  for (const item of NAV_CONFIG) {
    if (item.label === label) return translate(`nav.${item.translationKey}`, { defaultValue: label });
    const sub = item.subItems?.find((s) => s.label === label);
    if (sub) return translate(`nav.${sub.translationKey}`, { defaultValue: label });
  }
  return label;
};
