// Settings: System Preferences + Business (institute) Profile.
export default {
  en: {
    preferences: {
      loading: 'Loading system preferences…',
      subtitle: 'Set the language and default regional settings for the system.',
      saving: 'Saving…',
      languageHint: 'Choose the app display language.',
      regionalDefaults: 'Regional defaults', regionalHint: 'Time zone and currency for new records.',
      timezone: 'Time zone', currency: 'Currency', defaultTax: 'Default tax',
      tzMogadishu: 'Mogadishu (EAT)', tzNairobi: 'Nairobi (EAT)', tzUtc: 'UTC',
      usd: 'USD — US Dollar', sos: 'SOS — Somali Shilling',
      identity: 'System identity', identityHint: 'Change the system name, browser title, sidebar text, brand colors, and logo.',
      manageIdentity: 'Manage name and logo'
    },
    profile: {
      successTitle: 'Success!', savedMessage: 'The institute details were saved successfully.', continue: 'Continue',
      failedMessage: 'Failed to update profile.', tryAgain: 'Try again',
      sections: { general: 'General Info', branding: 'Branding', contact: 'Contact Details', hours: 'Operating Hours' },
      loading: 'Loading Profile Data...', verified: 'Verified Somali Professional Business',
      saving: 'Saving...', saveChanges: 'Save Changes', basicInformation: 'Basic Information',
      languageHint: 'Select English or Somali to change the interface language.',
      displayName: 'Display Business Name', displayNamePlaceholder: 'Example: Education Institute',
      displayNameHint: 'This is the official name shown on the login page, the browser and throughout the system.',
      subtitle: 'System Subtitle', subtitlePlaceholder: 'Welcome to the institute management system',
      subtitleHint: 'The short text below the institute name on the login page and in the sidebar.',
      legalName: 'Legal Entity Name', legalNameHint: 'Permanent legal name (used by System Admins for identification).',
      systemIdentifier: 'System Identifier (Read-only)',
      industry: 'Industry', industryPlaceholder: 'e.g. Education & Institute',
      industryOptions: ['Education & Training', 'Islamic & Quran Institute', 'Secondary & Primary School', 'College / University'],
      industryHint: "The institute's sector or specialisation (you can type or change it).",
      baseCurrency: 'Base Currency', usd: 'USD - US Dollar', eur: 'EUR - Euro',
      systemTimezone: 'System Timezone', eat: 'East Africa Time (EAT)', mogadishu: 'Mogadishu (EAT)',
      description: 'Description', brandingAssets: 'Branding & Assets', businessLogo: 'Business Logo',
      logoHint: 'Min 500x500px, PNG or JPG supported.', brandColor: 'Brand Color', accentColor: 'Accent Color',
      contactSocial: 'Contact & Social Presence', email: 'Email Address', phone: 'Phone Number',
      address: 'Main Address', website: 'Website', operatingHours: 'Operating Hours', closed: 'Closed',
      days: { Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Saturday', Sunday: 'Sunday' },
      logoAlt: 'Logo'
    }
  },
  so: {
    preferences: {
      loading: 'Waxaa la soo rarayaa doorbidyada nidaamka…',
      subtitle: 'Deji luqadda iyo dejinta gobolka ee caadiga ah ee nidaamka.',
      saving: 'Waa la kaydinayaa…',
      languageHint: 'Dooro luqadda lagu soo bandhigayo barnaamijka.',
      regionalDefaults: 'Dejinta gobolka', regionalHint: 'Waqtiga iyo lacagta diiwaannada cusub.',
      timezone: 'Aagga waqtiga', currency: 'Lacagta', defaultTax: 'Canshuurta caadiga ah',
      tzMogadishu: 'Muqdisho (EAT)', tzNairobi: 'Nayroobi (EAT)', tzUtc: 'UTC',
      usd: 'USD — Doollarka Maraykanka', sos: 'SOS — Shilinka Soomaaliga',
      identity: 'Aqoonsiga nidaamka', identityHint: 'Beddel magaca nidaamka, cinwaanka browser-ka, qoraalka dhinaca, midabada iyo astaanta.',
      manageIdentity: 'Maamul magaca iyo astaanta'
    },
    profile: {
      successTitle: 'Guul!', savedMessage: 'Xogta machadka si sax ah ayaa loo keydiyay.', continue: 'Sii wad',
      failedMessage: 'Cusboonaysiinta astaanta way fashilantay.', tryAgain: 'Isku day mar kale',
      sections: { general: 'Macluumaadka Guud', branding: 'Summadda', contact: 'Xiriirka', hours: 'Saacadaha Shaqada' },
      loading: 'Waxaa la soo rarayaa xogta astaanta...', verified: 'Ganacsi Soomaaliyeed oo Xirfad leh oo la Xaqiijiyey',
      saving: 'Waa la kaydinayaa...', saveChanges: 'Kaydi Isbeddellada', basicInformation: 'Macluumaadka Aasaasiga ah',
      languageHint: 'Dooro Ingiriisi ama Soomaali si aad u beddesho luqadda muuqaalka.',
      displayName: 'Magaca Machadka', displayNamePlaceholder: 'Tusaale: Machadka Waxbarashada',
      displayNameHint: 'Kani waa magaca rasmiga ah ee ka muuqanaya bogga galitaanka, browser-ka, iyo nidaamka oo dhan.',
      subtitle: 'Qoraalka Hoose', subtitlePlaceholder: 'Ku soo dhowow nidaamka maamulka machadka',
      subtitleHint: 'Qoraalka yar ee ka hooseeya magaca machadka ee bogga galitaanka iyo liiska dhinaca.',
      legalName: 'Magaca Sharciga ah', legalNameHint: 'Magaca sharciga ah ee joogtada ah (maamulayaasha nidaamka ayaa u isticmaala aqoonsi).',
      systemIdentifier: 'Aqoonsiga Nidaamka (Akhris kaliya)',
      industry: 'Qeybta Shaqada', industryPlaceholder: 'tusaale: Waxbarasho & Machad',
      industryOptions: ['Waxbarasho & Tababar', 'Machad Diini & Quraan', 'Dugsi Sare & Dhexe', 'Kulliyad / Jaamacad'],
      industryHint: 'Qeybta ama takhasuska machadka (waad qori kartaa ama beddeli kartaa).',
      baseCurrency: 'Lacagta Aasaasiga ah', usd: 'USD - Doollarka Maraykanka', eur: 'EUR - Yuuro',
      systemTimezone: 'Aagga Waqtiga Nidaamka', eat: 'Waqtiga Bariga Afrika (EAT)', mogadishu: 'Muqdisho (EAT)',
      description: 'Faahfaahin', brandingAssets: 'Summadda & Agabka', businessLogo: 'Astaanta Machadka',
      logoHint: 'Ugu yaraan 500x500px, PNG ama JPG.', brandColor: 'Midabka Summadda', accentColor: 'Midabka Labaad',
      contactSocial: 'Xiriirka & Baraha Bulshada', email: 'Iimaylka', phone: 'Lambarka Telefoonka',
      address: 'Cinwaanka Guud', website: 'Bogga Internetka', operatingHours: 'Saacadaha Shaqada', closed: 'Xiran',
      days: { Monday: 'Isniin', Tuesday: 'Talaado', Wednesday: 'Arbaco', Thursday: 'Khamiis', Friday: 'Jimco', Saturday: 'Sabti', Sunday: 'Axad' },
      logoAlt: 'Astaanta'
    }
  }
};
