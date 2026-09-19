const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

// One number, one canonical form. Digits only, so "+252 614 047 121" and
// "0614047121" reduce to the same thing; the 252 country code is removed only
// when enough digits remain to still be a local number, and leading zeros go
// last. Deliberately length-agnostic: numbers here are not always 9 or 10
// digits, and a rule that assumed a length would either miss a real match or —
// worse — collapse two different people onto one key.
const canonicalPhone = (value) => {
    let d = digitsOnly(value);
    if (!d) return '';
    if (d.startsWith('252') && d.length >= 12) {
        d = d.slice(3);
    }
    return d.replace(/^0+/, '');
};

// Every spelling of a number that could be sitting in the database, so a lookup
// finds an existing record instead of a second one being created for the same
// person. Both the raw digits and the canonical form are included, because
// older rows were stored exactly as they were typed.
const phoneVariants = (value) => {
    const d = digitsOnly(value);
    if (!d) return [];
    const canonical = canonicalPhone(value);
    const set = new Set([d]);
    if (canonical) {
        set.add(canonical);
        set.add(`0${canonical}`);
    }
    return [...set].filter(Boolean);
};

const isValidSomaliMobile = (value) => {
    if (value === null || value === undefined) return false;
    const str = String(value).trim();
    return /^\d{9,10}$/.test(str);
};

module.exports = {
    digitsOnly,
    canonicalPhone,
    phoneVariants,
    isValidSomaliMobile,
    isValidTransactionNumber: isValidSomaliMobile
};
