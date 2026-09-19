export const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const isValidSomaliMobile = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return /^\d{9,10}$/.test(str);
};

export const isValidTransactionNumber = isValidSomaliMobile;

export const formatPhoneHint = 'Must be 9 or 10 digits (0-9)';
