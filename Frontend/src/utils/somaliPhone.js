export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const isValidSomaliMobile = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return /^\d{9}$/.test(str);
};

export const isValidTransactionNumber = isValidSomaliMobile;

export const formatPhoneHint = 'Must be exactly 9 digits (0-9)';
