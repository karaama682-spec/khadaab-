// Users & Access: System Users, Roles & Permissions, Activity Logs.
export default {
  en: {
    actions: { Read: 'Read', Add: 'Add', Edit: 'Edit', Delete: 'Delete', Export: 'Export' },
    users: {
      title: 'System Users', subtitle: 'Access Control & Identity Management Hub', loading: 'Loading Users...',
      addNew: 'Add New User', newUser: 'New User', editTitle: 'Edit User', deleteButton: 'Delete User',
      searchPlaceholder: 'Search by username or email...', tabAll: 'All Users', tabStaff: 'System Staff', tabTeachers: 'Teachers',
      username: 'Username', roles: 'Roles', role: 'Role', empty: 'No matching users found.',
      deactivate: 'Deactivate User', activate: 'Activate User', modifyDetails: 'Modify User Details', onboard: 'Onboard System Access',
      leaveEmpty: '(Leave empty to keep)', selectRole: 'Select role',
      noRoles: 'No roles available yet. Create roles first in the Roles & Permissions section.',
      permissions: 'Permissions', permissionsHint: 'Choose exactly what this account may do. Anything left unchecked is refused by the server.',
      save: 'Save User', saveFailed: 'Failed to save user.', statusFailed: 'Failed to update status.',
      deleteTitle: 'Delete user?', deleteConfirm: 'Are you sure you want to delete {name}? This cannot be undone.',
      deleteFailed: 'Failed to delete user.'
    },
    roles: {
      title: 'Access Roles', subtitle: 'Security Tiers & Hierarchical Permission Orchestration', defineNew: 'Define New Role',
      searchPlaceholder: 'Search roles...', refresh: 'Refresh Registry', colName: 'Role Name', colUsers: 'Users Count',
      colCreated: 'Created Date', system: 'System', custom: 'Custom', hub: 'Role Hub', edit: 'Edit Role', clone: 'Clone Role',
      delete: 'Delete Role', copySuffix: '(Copy)', modifyTier: 'Modify Access Tier', defineTier: 'Define Access Tier',
      modalHint: 'Configure system-wide role parameters and hierarchical permission matrix.',
      nameLabel: 'Role Identifier Name', namePlaceholder: 'e.g. Regional Compliance Lead',
      descriptionLabel: 'Functional Description', descriptionPlaceholder: 'Describe the scope of authority...',
      matrix: 'Hierarchical Matrix', toggleAll: 'Toggle All System Access', toggleHint: 'Toggle granular sub-module capabilities',
      selectSection: 'Select Section', toggleFeature: 'Toggle all actions for this feature', commit: 'Commit Configuration',
      saveFailed: 'Failed to save role.', deleteTitle: 'Delete role?',
      deleteConfirm: 'Are you sure you want to delete {name}? This cannot be undone.', deleteFailed: 'Failed to delete role.'
    },
    logs: {
      title: 'Security Audit', subtitle: 'Immutable Global Activity Ledger & Forensic Trail', export: 'Export PDF/CSV',
      filters: 'Forensic Filters', reset: 'Reset Matrix', dateRange: 'Date Range', last7: 'Last 7 Days', last30: 'Last 30 Days',
      customRange: 'Custom Range', operator: 'System Operator', module: 'System Module', allModules: 'All Modules',
      actionType: 'Action Protocol', allTypes: 'All Types',
      searchPlaceholder: 'Deep Search Logs by Reference ID, Specific Action or IP Signature...',
      colDate: 'Date & Time', colUser: 'User Operator', colAction: 'Action Executed', colModule: 'Module Hub',
      colReference: 'Record Reference', colIp: 'IP Signature', integrity: 'Snapshot Integrity',
      signed: 'All Logs Cryptographically Signed', retention: 'Retention Policy', retentionValue: '90 Days Rolling Archive (Active)',
      lifecycle: 'Audit Lifecycle Manager', am: 'AM', pm: 'PM',
      users: { 'System Bot': 'System Bot' },
      roles: { Owner: 'Owner', Cashier: 'Cashier', Manager: 'Manager', Admin: 'Admin', Automated: 'Automated' },
      actions: {
        'Sale Created': 'Sale Created', 'Login Success': 'Login Success', 'Inventory Adjusted': 'Inventory Adjusted',
        'User Disabled': 'User Disabled', 'Role Changed': 'Role Changed', 'Expense Deleted': 'Expense Deleted', Logout: 'Logout'
      },
      modules: { Sales: 'Sales', Inventory: 'Inventory', Accounts: 'Accounts', Access: 'Access', Security: 'Security', HR: 'HR', Services: 'Services', Settings: 'Settings' },
      types: { Create: 'Create', Update: 'Update', Delete: 'Delete', Auth: 'Auth', System: 'System' }
    }
  },
  so: {
    actions: { Read: 'Akhri', Add: 'Ku dar', Edit: 'Wax ka beddel', Delete: 'Tirtir', Export: 'Soo saar' },
    users: {
      title: 'Isticmaalayaasha Nidaamka', subtitle: 'Xarunta Maamulka Galitaanka & Aqoonsiga', loading: 'Waxaa la soo rarayaa isticmaalayaasha...',
      addNew: 'Ku dar Isticmaale Cusub', newUser: 'Isticmaale Cusub', editTitle: 'Wax ka beddel Isticmaalaha', deleteButton: 'Tirtir Isticmaalaha',
      searchPlaceholder: 'Ku raadi magaca isticmaalaha ama iimaylka...', tabAll: 'Dhammaan Isticmaalayaasha', tabStaff: 'Shaqaalaha Nidaamka', tabTeachers: 'Macallimiinta',
      username: 'Magaca Isticmaalaha', roles: 'Doorarka', role: 'Doorka', empty: 'Isticmaale u dhigma lama helin.',
      deactivate: 'Jooji Isticmaalaha', activate: 'Hawlgeli Isticmaalaha', modifyDetails: 'Wax ka beddel Xogta Isticmaalaha', onboard: 'Sii Galitaan Nidaamka',
      leaveEmpty: '(Ka tag madhan si uusan isu beddelin)', selectRole: 'Dooro door',
      noRoles: 'Weli door ma jiro. Marka hore doorar ka samee qaybta Doorarka & Ogolaanshaha.',
      permissions: 'Ogolaanshaha', permissionsHint: 'Dooro si sax ah waxa akoonkani sameyn karo. Wax kasta oo aan la calaamadeyn server-ku wuu diidayaa.',
      save: 'Kaydi Isticmaalaha', saveFailed: 'Kaydinta isticmaalaha way fashilantay.', statusFailed: 'Cusboonaysiinta xaaladda way fashilantay.',
      deleteTitle: 'Tirtir isticmaalaha?', deleteConfirm: 'Ma hubtaa inaad tirtirto {name}? Tan dib looma celin karo.',
      deleteFailed: 'Tirtirista isticmaalaha way fashilantay.'
    },
    roles: {
      title: 'Doorarka Galitaanka', subtitle: 'Heerarka Amniga & Habaynta Ogolaanshaha', defineNew: 'Qeex Door Cusub',
      searchPlaceholder: 'Raadi doorarka...', refresh: 'Cusboonaysii Diiwaanka', colName: 'Magaca Doorka', colUsers: 'Tirada Isticmaalayaasha',
      colCreated: 'Taariikhda La Sameeyey', system: 'Nidaamka', custom: 'Gaar ah', hub: 'Xarunta Doorka', edit: 'Wax ka beddel Doorka', clone: 'Nuqul ka samee Doorka',
      delete: 'Tirtir Doorka', copySuffix: '(Nuqul)', modifyTier: 'Wax ka beddel Heerka Galitaanka', defineTier: 'Qeex Heerka Galitaanka',
      modalHint: 'Habee xuduudaha doorka ee nidaamka oo dhan iyo shaxda ogolaanshaha.',
      nameLabel: 'Magaca Doorka', namePlaceholder: 'tusaale: Masuulka Hoggaansanaanta Gobolka',
      descriptionLabel: 'Sharaxaadda Shaqada', descriptionPlaceholder: 'Qeex baaxadda awoodda...',
      matrix: 'Shaxda Ogolaanshaha', toggleAll: 'Beddel Dhammaan Galitaanka Nidaamka', toggleHint: 'Beddel awoodaha qaybaha hoose',
      selectSection: 'Dooro Qaybta', toggleFeature: 'Beddel dhammaan ficillada qaybtan', commit: 'Kaydi Habaynta',
      saveFailed: 'Kaydinta doorka way fashilantay.', deleteTitle: 'Tirtir doorka?',
      deleteConfirm: 'Ma hubtaa inaad tirtirto {name}? Tan dib looma celin karo.', deleteFailed: 'Tirtirista doorka way fashilantay.'
    },
    logs: {
      title: 'Hubinta Amniga', subtitle: 'Diiwaanka Dhaqdhaqaaqa Guud ee Aan La Beddeli Karin', export: 'Soo Saar PDF/CSV',
      filters: 'Shaandhaynta Baaritaanka', reset: 'Dib u deji Shaandhaynta', dateRange: 'Muddada', last7: '7-dii Maalmood ee U Dambeeyay', last30: '30-kii Maalmood ee U Dambeeyay',
      customRange: 'Muddo Gaar ah', operator: 'Hawl-wadeenka Nidaamka', module: 'Qaybta Nidaamka', allModules: 'Dhammaan Qaybaha',
      actionType: 'Nooca Ficilka', allTypes: 'Dhammaan Noocyada',
      searchPlaceholder: 'Ku raadi diiwaannada aqoonsiga tixraaca, ficil gaar ah ama cinwaanka IP...',
      colDate: 'Taariikhda & Waqtiga', colUser: 'Isticmaalaha', colAction: 'Ficilka La Sameeyey', colModule: 'Qaybta',
      colReference: 'Tixraaca Diiwaanka', colIp: 'Cinwaanka IP', integrity: 'Sugnaanta Xogta',
      signed: 'Dhammaan Diiwaannada Waa La Saxiixay', retention: 'Siyaasadda Kaydinta', retentionValue: 'Kayd 90 Maalmood ah (Firfircoon)',
      lifecycle: 'Maamulaha Hubinta', am: 'GH', pm: 'GD',
      users: { 'System Bot': 'Bot-ka Nidaamka' },
      roles: { Owner: 'Milkiile', Cashier: 'Qasnaji', Manager: 'Maareeye', Admin: 'Maamule', Automated: 'Toos' },
      actions: {
        'Sale Created': 'Iib La Sameeyey', 'Login Success': 'Galitaan Guulaystay', 'Inventory Adjusted': 'Kaydka Alaabta La Hagaajiyey',
        'User Disabled': 'Isticmaale La Joojiyey', 'Role Changed': 'Door La Beddelay', 'Expense Deleted': 'Kharash La Tirtiray', Logout: 'Ka Bixid'
      },
      modules: { Sales: 'Iibka', Inventory: 'Kaydka Alaabta', Accounts: 'Xisaabaadka', Access: 'Galitaanka', Security: 'Amniga', HR: 'Shaqaalaha', Services: 'Adeegyada', Settings: 'Dejinta' },
      types: { Create: 'Abuur', Update: 'Cusboonaysii', Delete: 'Tirtir', Auth: 'Galitaan', System: 'Nidaamka' }
    }
  }
};
