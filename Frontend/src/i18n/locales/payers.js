// Payers (fee-payer directory, checklist print & PDF, edit payer).
export default {
  en: {
    title: 'Payers', subtitle: 'Fee Payer Directory & Checklist', loading: 'Loading Payers...', loadingRows: 'Loading payers...',
    loadFailed: 'Failed to load payers.', printChecklist: 'Print Checklist',
    searchPlaceholder: 'Search by payer name, number 1, or number 2...', colName: 'Payer Name',
    colNumbers: 'Numbers (Phone 1 & 2)', colTotal: 'Total Money', editTitle: 'Edit Payer',
    empty: "No payers found. They appear here once students with a responsible person's number are added.",
    grandTotal: 'Grand Total', acrossPayers_one: 'Total money across {count} payer', acrossPayers_other: 'Total money across {count} payers',
    matchingSearch: 'Matching this search: {amount} ({shown} of {total})',
    editPayer: 'Edit Payer', editSubtitle: 'Edit the payer and their linked students', syncTitle: 'Default Student Sync',
    syncMessage: 'When you change the number or the name, all {count} students listed below automatically get the updated phone number and parent name.',
    namePlaceholder: 'e.g. Maxamed Axmed Cali', phone1Label: 'Phone 1 (Primary / Number 1)', updatesStudents: 'Updates Students',
    phone1Placeholder: 'e.g. 615123456', phone2Label: 'Phone 2 (Second Number / Alternate)',
    phone2Placeholder: 'e.g. 615987654 (Optional second number)',
    phoneRequired: 'Primary phone number is required.',
    updated_one: 'Payer and {count} linked student updated successfully.', updated_other: 'Payer and {count} linked students updated successfully.',
    updateErrorTitle: 'Update Error', updateFailed: 'Failed to update payer.',
    pdf: {
      title: 'MACHAD INSTITUTE - PAYERS CHECKLIST', generated: 'Generated', payers: 'Payers', payerName: 'PAYER NAME',
      number: 'NUMBER', students: 'STUDENTS', total: 'TOTAL ($)', paid: 'PAID', file: 'Machad_Payers_Checklist'
    }
  },
  so: {
    title: 'Bixiyeyaasha', subtitle: 'Hagaha & Liiska Hubinta Bixiyeyaasha Khidmadda', loading: 'Waxaa la soo rarayaa bixiyeyaasha...', loadingRows: 'Waxaa la soo rarayaa bixiyeyaasha...',
    loadFailed: 'Soo rarista bixiyeyaasha way fashilantay.', printChecklist: 'Daabac Liiska Hubinta',
    searchPlaceholder: 'Ku raadi magaca bixiyaha, lambarka 1, ama lambarka 2...', colName: 'Magaca Bixiyaha',
    colNumbers: 'Lambarada (Telefoonka 1 & 2)', colTotal: 'Wadarta Lacagta', editTitle: 'Wax ka beddel Bixiyaha',
    empty: 'Bixiye lama helin. Waxay halkan ka muuqdaan marka la daro arday leh lambarka qofka masuulka ka ah.',
    grandTotal: 'Wadarta Guud', acrossPayers_one: 'Wadarta lacagta {count} bixiye', acrossPayers_other: 'Wadarta lacagta {count} bixiye',
    matchingSearch: 'Waxa raadintan u dhigma: {amount} ({shown} ka mid ah {total})',
    editPayer: 'Wax ka beddel Bixiyaha', editSubtitle: 'Wax ka beddel bixiyaha & ardayda ku xiran', syncTitle: 'Isku-xirka Ardayda',
    syncMessage: 'Markii aad beddesho lambarka ama magaca, dhammaan {count} arday ee hoos ku xusan si toos ah ayey taleefankooda iyo magaca waalidka ugu cusboonaanayaan.',
    namePlaceholder: 'tusaale: Maxamed Axmed Cali', phone1Label: 'Telefoonka 1 (Koowaad / Lambarka 1)', updatesStudents: 'Waxay Cusboonaysiisaa Ardayda',
    phone1Placeholder: 'tusaale: 615123456', phone2Label: 'Telefoonka 2 (Lambarka Labaad)',
    phone2Placeholder: 'tusaale: 615987654 (lambar labaad oo ikhtiyaari ah)',
    phoneRequired: 'Lambarka telefoonka koowaad waa qasab.',
    updated_one: 'Bixiyaha iyo {count} arday oo ku xiran si guul leh ayaa loo cusbooneysiiyey.', updated_other: 'Bixiyaha iyo {count} arday oo ku xiran si guul leh ayaa loo cusbooneysiiyey.',
    updateErrorTitle: 'Khalad Cusboonaysiin', updateFailed: 'Cusboonaysiinta bixiyaha way fashilantay.',
    pdf: {
      title: 'MACHADKA - LIISKA HUBINTA BIXIYEYAASHA', generated: 'La sameeyey', payers: 'Bixiyeyaasha', payerName: 'MAGACA BIXIYAHA',
      number: 'LAMBARKA', students: 'ARDAYDA', total: 'WADARTA ($)', paid: 'LA BIXIYEY', file: 'Liiska_Hubinta_Bixiyeyaasha'
    }
  }
};
