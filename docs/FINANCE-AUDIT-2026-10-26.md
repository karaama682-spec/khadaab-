# Baaritaanka Finance iyo Dashboard Cards — 26 October 2026

## Xadka baaritaanka iyo xaqiijinta

Waxaa la baaray controllers, models, routes, permissions, billing-cycle utilities, snapshots, dashboard, shaashadaha Finance iyo warbixinnada la xiriira. Database-ka nool lama xiriirin, xog maaliyadeedna lama beddelin. Application code lama sixin.

Waxaa la fuliyey `node docs/finance-audit-checks.cjs`: **8/8 isolated reproductions ayaa xaqiijiyey hab-dhaqannada lagu tilmaamay**. Script-ku wuxuu adeegsadaa controller-ka dhabta ah iyo model doubles ku jira memory; tani ma aha integration test ama xaqiijin xogta production-ka.

Waxaa kaloo la isku dayey 16 tests oo ku jira dashboardFinance, cycleDebtSnapshot, feeHistory, payerArrears iyo transactionNumberValidation. Dhammaantood waxaa hor istaagay MongoMemoryServer oo ku dhacay `Mongod internal error (fassert() failure)` markii uu kacayey. Sidaas darteed natiijadooda laguma caddeyn karo saxnaanta ama khaladka application-ka.

P1 = mudnaan sare: amni ama khalad saameeya lacagta iyo saxnaanta xisaabta. P2 = warbixin, muuqaal, ama isku-waafajin u baahan sixid. Liiskani wuxuu ku daraa saddexdii arrimood ee hore loo sheegay, wuxuuna ku darayaa kuwa kale ee hadda la helay.

## Khaladaadka iyo meelaha halistu ka jirto

### 1. P1 — Endpoints maaliyadeed ayaa ku filan qof kasta oo logged in ah

`Backend/src/routes/salaryRoutes.js:13`, `expenseRoutes.js:13`, iyo `transactionRoutes.js:13` waxay isticmaalaan `protect` oo keliya. `protect` wuxuu xaqiijiyaa login-ka; ma hubiyo Finance Read/Write. Sidaas darteed user aan Finance loo oggolayn wuxuu API-gaas si toos ah uga akhrisan ama uga beddeli karaa xogta. Qarin button ama page kama ilaalinayso API-ga. Cycle-adjustment reads-na sidoo kale Finance permission ma hubiyaan.

**Sixid:** endpoints-ka ku dabaq permission resolver-ka la wada isticmaalo, oo tijaabi teacher iyo read-only roles.

### 2. P1 — Edit la diiday wuxuu hore u beddelay wallet-ka [la soo celiyey]

`Backend/src/controllers/cashbookController.js:556`: wallet-kii hore ayaa laga rogaa lacagta ka hor `findByIdAndUpdate(... runValidators: true)`. Haddii validation-ku diido amount/date/entity, wallet-ka hore durba waa isbeddelay. Tijaabada amount=-1: request wuu fashilmay, balance 100 wuxuu noqday 80.

Create/edit/delete/restore guud ahaan waxay sameeyaan writes badan oo kala go'an; ma laha database transaction. Cilad dhexda timaadda waxay kala jari kartaa Cashbook, Payment, Salary, Transaction iyo Wallet. Concurrent payments-na waxay isticmaalaan read-modify-save, taas oo lumin karta update haddii laba request isku mar yimaadaan.

**Sixid:** marka hore validate, kadib writes-ka isku xiran ku samee database transaction iyo atomic balance updates.

### 3. P1 — Cashbook laba jeer la tirtiro wuxuu laba jeer rogayaa lacagta [la soo celiyey]

`Backend/src/controllers/cashbookController.js:610`: `deleteEntry` ma diido entry horay `isDeleted=true` u ahaa. Balance 100 iyo income 20: delete koowaad = 80, delete labaad = 60. Retry request ayaa keeni kara khaladkan xitaa haddii UI-gu safka qariyo.

**Sixid:** delete-ku ha noqdo idempotent; hubi oo si atomic ah u beddel active/deleted state.

### 4. P1 — Tirtiridda Payment/Salary ku xiran Cashbook waxay jebisaa xiriirka [Payment la soo celiyey]

`Backend/src/controllers/paymentController.js:141` iyo `salaryController.js:100`: delete-ku wuxuu rogayaa wallet-ka isaga oo aan eegayn `sourceEntryId`. Cashbook entry-ga iyo transaction-kiisii way sii jiraan, inkastoo lacagtoodii la rogay. Tirtiridda Cashbook-ga kadib waxay isla lacagtii mar kale rogaysaa. Salary delete-ku wuxuu kordhin karaa balance iyadoo Cashbook expense-kii weli muuqdo.

**Sixid:** records-ka sourceEntryId leh waxaa maamula Cashbook keliya, ama adeeg wadajir ah ha wada waafajiyo.

### 5. P1 — Payment, Salary iyo Expense edit ma waafajiyaan balance/ledger [hore loo sheegay; Payment la soo celiyey]

`paymentController.js:131`, `salaryController.js:90`, `expenseController.js:80`: amount, wallet iyo status waa la beddeli karaa iyadoo aan dhaqdhaqaaqii hore la rogin ama kan cusub la gelin. Pending→Paid/Completed sidoo kale ma dhaqaajiso lacagta. Update-yadani ma shitaan `runValidators`.

**Sixid:** adeeg posting/reversal oo isku mid ah isticmaal create/update/delete oo dhan; xaddid fields-ka la oggol yahay.

### 6. P1 — Transactions-ka si madax-bannaan loo beddelo ma laha xeer isku xiran [create la soo celiyey]

`Backend/src/controllers/transactionController.js:20`: create/edit ma beddelaan wallet-ka; delete (`:35`) wuu beddelaa. Delete-ku ma rogo Payment/Salary/Expense/Cashbook source record. Sidaas waxaa suuragal ah in card Income hoos u dhaco, laakiin ardaygu weli paid yahay; ama manual transaction la sameeyo dabadeed la tirtiro oo wallet-ku isbeddelo isagoo aan markii hore isbeddelin.

**Sixid:** ledger-ka source-backed ah ka dhig mid aan si madax-bannaan loo edit/delete karin; manual transactions-na posting rules u samee.

### 7. P1 — Balance lagu xaddido eber waxay lumisaa lacag [hore loo sheegay]

`cashbookController.js:43`, `expenseController.js:73`, `salaryController.js:83`. Wallet 10 leh haddii laga bixiyo 30 wuxuu noqdaa 0; marka expense-ka la tirtiro wuxuu noqonayaa 30, halkii uu ku noqon lahaa 10. Waa khalad reversal oo cad, xitaa haddii negative balance aan la oggolayn.

**Sixid:** haddii overdraft mamnuuc yahay, diid expense-ka ka hor posting; haddii la oggol yahay, kaydi signed balance-ka saxda ah.

### 8. P1 — Category Income→Expense beddelkeedu wuxuu beddelaa taariikhda warbixinta oo keliya

`Backend/src/controllers/cashbookController.js:169`: category type waa la beddeli karaa iyadoo entries hore ku xiran yihiin. Cashbook/report waxay populated category-ga cusub u akhriyaan Expense, laakiin Transaction.type iyo wallet balance wali waa Income. Delete-ka entry-ga dambe wuxuu xitaa isticmaalayaa type-ka cusub si uu u rogo dhaqdhaqaaqii hore.

**Sixid:** category type isticmaalka kadib ha la beddeli karin, ama entries-ka si atomically ah dib ugu post garee.

### 9. P1 — Cashbook salary mirror ma raaco receiver/category beddelka

`Backend/src/controllers/cashbookController.js:591`: Salary.updateMany wuxuu cusboonaysiiyaa amount/date/wallet/month oo keliya. Haddii receiver macallin A laga dhigo B, `teacherId` wali A ayuu ahaanayaa. Expense→Income beddelku salary-gii ma tirtiro; entry aan salary ahayn oo salary loo beddelana mirror cusub lama sameeyo. Restore (`:695`) wuxuu salary abuuri karaa haddii receiver-ku staff yahay, isagoo aan dib u hubin category.type==='Expense'.

**Sixid:** salary mirror-ka ka dib u dhis entry-ga cusub iyadoo la eegayo type iyo receiver, kana dhig idempotent.

### 10. P1 — Payment/Salary/Expense taariikh hore leh waxay ledger-ka ugu dhacaan maanta

`paymentController.js:114`, `salaryController.js:73`, `expenseController.js:63`: Transaction.create laguma gudbiyo paymentDate/date. Transaction model-ku wuxuu default ahaan qaataa Date.now. Markaas fiiga wareeggii hore wuxuu ku qormayaa Income-ga maanta, inkastoo paymentDate hore yahay. Cashbook flow-ku `date` wuu gudbiyaa; labada hab isku natiijo ma keenaan.

**Sixid:** dhaqdhaqaaq kasta ku post garee taariikhda dhab ahaan user-ku doortay, target billing cycle-na gooni u hay.

### 11. P1 — Wallet balance waa si toos ah loo overwrite-gareyn karaa, wallet isticmaalanna waa la tirtiri karaa [delete la soo celiyey]

`Backend/src/controllers/walletController.js:29`: req.body oo dhan ayaa update loo diraa; balance waa la beddeli karaa iyadoo ledger adjustment aan la samayn. `:39` wallet waa la tirtiri karaa iyadoo lacag iyo records ku xiran jiraan. Explicit wallet selection-ka controllers-kuna mar walba ma hubiyo Active status-ka.

**Sixid:** opening/adjustment entries u samee balance changes; diid deletion-ka wallet la isticmaalay, ama disable-garee.

### 12. P1 — Cycle lock ma daboolo waddooyinka maaliyadda oo dhan

Cashbook wuxuu leeyahay lock checks. Payment/Salary/Expense/Transaction controllers ma laha isla checks-ka, sidaas darteed API-yadaas ayaa wax uga beddeli kara cycle xiran. `cycleLockController.js:14` sidoo kale wuxuu truthy `customPermissions.Finance.Cashbook` u aqoonsadaa awood quful/furid; object Read-only ah truthy ayuu yahay.

**Sixid:** cycle policy meel dhexe mari dhammaan mutations; LockCycles ha noqdo permission si sax ah loo xalliyo.

### 13. P1 — Tirooyin historical ah oo go'an iyo startup beddelaya exit dates [qayb ahaan hore loo sheegay]

`Backend/src/controllers/cashbookController.js:1221` iyo `Backend/src/services/cycleSnapshotService.js` waxay wareegga 2026-08 ku celiyaan expected=3262.50, collected=2935.50, debt=327.00, iyadoon figures-kaas laga soo xisaabin records-ka markaas jira.

`Backend/src/index.js:74`: marka server-ku kaco, dhammaan Exited students leh exitDate ka dambaysa 24 Sep 2026 ama exitDate maqan waxaa taariikhdooda loo beddelaa cutoff-kaas. Tani waxay beddeli kartaa debt/expected ee wareegyo ay ardaydu dhab ahaan joogeen. Waxaa kaloo la tirtiraa snapshot-ka 2026-09 haddii wax la beddelay.

**Sixid:** ka saar automatic business-data rewrite; historical corrections u samee migration xaddidan, la raadraaci karo, lana xaqiijiyey. Figures-ka la heshiisiiyey xog ahaan kaydi, ha ka dhigin code override.

### 14. P2 — Income kasta oo guardian laga helo waxaa loo qaadan karaa tuition

`Backend/src/controllers/cashbookController.js:55`: syncFeePayments wuxuu eegaa Income iyo senderEntityType=guardian/student; category-ga inuu tuition yahay ma hubiyo. Deeq ama dakhli kale oo guardian bixiyey ayaa markaas yareyn kara deynta carruurtiisa.

**Sixid:** category-ga ku dar posting purpose cad sida tuition/donation/other.

### 15. P2 — Lacag ka badan 12 wareeg oo fiig ah allocation ma hesho

`Backend/src/controllers/cashbookController.js:97`: allocation-ku wuxuu joogsanayaa 12 cycles; `leftover` dambe la diidi maayo, credit ahaan lama kaydiyo, response-kana lama sheego. Wallet-ku wuxuu qaataa amount-ka oo dhan, laakiin student credit wuxuu helayaa qayb keliya. UI cap-ku API-ga ma ilaalinayo.

**Sixid:** surplus credit si cad u kaydi ama amount-ka ka badan xadka diid.

### 16. P2 — Deyn hore ayaa ka lumi karta card-ka marka arday baxo/inactive noqdo

`Backend/src/controllers/cashbookController.js:1266`: computePreviousDebt wuxuu student set-ka ka xushaa status-ka maanta iyo exitDate marka loo eego dhammaadka cycle-kii ugu dambeeyey. Arday hadda Exited/Inactive ah ayaa sidaas looga saari karaa deyntii uu hore u lahaa, inkastoo aan lacag laga bixin. Tirintu sidoo kale waxay ka bilaabataa payment-kii ugu horreeyey ee system-ka; haddii aan payment jirin debt=0.

**Sixid:** caddee muddada system-ku bilaabay iyo debt-ka arday baxay; deyn hore ha lumin sababta oo ah status hadda la beddelay.

### 17. P2 — Guardian report wuxuu partial payment u calaamadiyaa fully paid

`Frontend/src/pages/GuardianPaymentReport.jsx:80`: wuxuu Set ka dhisaa students leh wax Completed payment ah. Fiig 100 ah oo 1 laga bixiyey waxaa loo tirin karaa paid; amount-ka la bixiyey iyo inta dhiman lama barbar dhigo. Mark All Paid-na students-kaas wuu ka boodaa.

`Frontend/src/pages/FeePaymentReport.jsx:103`: remaining grouping-ku wuxuu adeegsadaa legacy `p.month`, halka fee calculation-ku adeegsado billingCycle. Historical rows leh kala-duwanaanshahan waxay keeni karaan remaining aan la mid ahayn Monthly Payments.

**Sixid:** labada report isticmaal cycle resolver iyo fee/paid/remaining calculation-ka la wadaago.

### 18. P2 — Cashbook reports iyo dashboard ma isticmaalaan isla ledger-ka

`Frontend/src/pages/CashbookCategoryReport.jsx:121`: opening balance wuxuu ka yimaadaa Cashbook entries oo keliya, iyadoo wallets-ku initial balance yeelan karaan, direct Payment/Salary/Expense-na ay sameeyaan Transactions aan Cashbook entry lahayn. Closing balance-kaas sidaas lama mid noqon karo wallet-ka. Dashboard Total Income/Expenses waxay ka yimaadaan Transactions oo dhan.

**Sixid:** caddee report-ku inuu Cashbook-only yahay, ama dhis unified ledger oo opening balances iyo dhammaan flows ka kooban.

### 19. P2 — Cycle validator wuxuu aqbalaa bil aan jirin [la soo celiyey]

`Backend/src/utils/billingCycle.js`: isValidCycleKey wuxuu eegaa format oo keliya. `2026-99` iyo `2026-00` waa accepted, Date-na way u rogaan sannad/bil kale. Frontend cycle inputs qaarkood regex-kaas oo kale ayay isticmaalaan.

**Sixid:** hubi month 01–12, taariikh sax ah, iyo cycle key canonical ah.

### 20. P2 — Adjustments report wuxuu ku dari karaa entries trash ku jira

`Backend/src/controllers/cycleLockController.js:100`: priorAdjustments/currentCycleAdjustments queries ma saaraan `isDeleted=true`. Entry la tirtiray oo wallet effect laga rogay ayaa weli lagu dari karaa netImpactOnOpeningBalance.

**Sixid:** ka saar deleted rows marka impact la xisaabinayo; haddii audit ahaan la tuso, si cad deleted ugu calaamadee oo total-ka ha gelin.

### 21. P1 — Dashboard cash totals waa branch-specific, fee totals-na institute-wide [filter la xaqiijiyey]

`Backend/src/controllers/dashboardController.js:170,177`: Total Income/Expenses waxay ku daraan branchQuery. `computeFeeTotals`, `computePreviousDebt`, salary totals iyo debt/advance payment totals isku branch filter ma laha. User laan gaar ah ku xiran ayaa arki kara Income laantiisa iyo Fees machadka oo dhan. Waxaa ka dhalan kara otherIncome=0 iyadoo sharaxaadda total-ku is qaban la'dahay.

Existing dashboardFinance test wuxuu filayaa institute-wide laakiin hal branch oo keliya ayuu seed-gareeyaa; sidaas kuma qaban karo multi-branch mismatch-kan.

**Sixid:** dhammaan finance KPIs hal scope raaci; multi-branch regression test ku dar.

### 22. P2 — Dashboard wuxuu isku daraa cash date iyo billing-cycle attribution

`dashboardController.js:182`: salary aggregation-ku wuxuu OR ku wada xiraa paymentDate, createdAt iyo billingCycle. Salary 400 ah oo November loogu hormariyey October wuxuu geli karaa salary total-ka labada wareeg. `:260`: totalStudentFeesCollected wuxuu isku daraa current-cycle fee attribution iyo arrears/advance cash receipts. Fee horay loo bixiyey ayaa current-cycle collected ku jira isagoo aan cash income hadda ahayn.

`Frontend/src/pages/DashboardOverview.jsx:157`: Other Income waxaa laga helaa Total Income − totalStudentCollected, negative-na 0 ayaa lagu qariyaa; Other Expenses-na sidaas oo kale. Tani ma caddeyneyso saxnaanta kala-baxa.

**Sixid:** cards-ka u qeex cash received vs tuition credited; components lagu kala jarayo ha adeegsadaan isla basis, scope iyo dates. In advances lagu daro cash Income laftiisu khalad ma aha; isku darka basis-yada iyo sharaxaadaha ayaa khaladka keenaya.

### 23. P2 — Gujinta cards qaarkood ma furto xogtii tirada samaysay

`Frontend/src/pages/DashboardOverview.jsx:270`: Debt Fees Collected wuxuu furaa `view=previousDebt`, taas oo ah unpaid/live arrears, ma aha receipts-kii deynta laga qabtay. Previous Debt-na selected historical cycle lama gudbiyo; backend getPayers (`cashbookController.js:1664`) wuxuu khasbaa currentCycle.

Total Income/Expenses waxay furaan Cashbook, halka cards-ku ka yimaadaan Transactions. Cashbook filter (`CashbookManagement.jsx:921`) wuxuu adeegsadaa targetMonth, card-kuna cash date; isla cycle la doortay ayaa xitaa rows kala duwan soo celin kara. Advance card-kuna wuxuu furaa Cashbook aan advance-only filter lahayn. Cashbook wuxuu default ahaan furaa category panel.

**Sixid:** card kasta u samee drilldown adeegsada query-ga KPI-ga iyo cycle/scope/status saxda ah.

### 24. P2 — Refresh iyo cycle switching waxay muujin karaan cards aan cusubayn

`Backend/src/controllers/dashboardController.js:17`: 30-second server cache lama invalidate-gareeyo finance writes kadib; frontend Refresh backend-cache bypass ma samaynayo. `DashboardOverview.jsx:96`: marka cycle la beddelo xogtii hore waa la hayaa ilaa fetch dhammaado, mana jiro request sequencing/cancellation. Haddii requests-ku kala hormaraan, selected cycle B waxaa lagu tusin karaa data cycle A. Fetch error-ku console keliya ayuu galaa iyadoo figures hore muuqdaan.

**Sixid:** invalidate backend cache, muuji stale/loading/error, hubi response cycle inuu yahay selected cycle, jooji response-kii duqoobay.

### 25. P2 — Bars-ka yar ee cards-ku waa qurxin, xog ma aha

`Frontend/src/pages/KPICard.jsx:23`: sparkline=[24,34,28,46,38,56,50] waa array go'an oo card kasta la tuso haddii progress uusan jirin. Looma xisaabin income/expense history. Trend la waayo wuxuu default ahaan u janjeeraa rose styling sababta `undefined >= 0` ay false u tahay. Quick Preview-na wuxuu tusaa value iyo sharaxaad hore u jirtay; ma dalbado faahfaahinta transactions.

**Sixid:** qurxintaas si aan trend loogu fahmin u beddel, ama ku xidh historical data dhab ah.

## Sida 10-ka card ee Finance-ku hadda u shaqeeyaan

Dashboard wuxuu dalbadaa `GET /api/dashboard?cycle=YYYY-MM`. Cycle-ku wuxuu socdaa 25-ka bisha key-ga ilaa 24-ka bisha xigta, UTC. Tusaale 2026-10 = 25 Oct–24 Nov 2026. Cards-ka wuxuu frontend-ku qariyaa haddii Finance permission uusan arkin; backend-ku sidoo kale leeyahay permission logic u gaar ah oo aan dhammaan xaaladaha la mid ahayn resolver-ka guud.

| Card | Xisaabta hadda | Gujinta hadda | Xaddidaadda muhiimka ah |
|---|---|---|---|
| Wadarta Khidmadda La Filayo | Isugeynta fee-ga student kasta ee cycle-ka, laga eegayo feeHistory | Monthly Payments, cycle-ka la doortay | Fee totals institute-wide; historical snapshot/2026-08 override ayaa beddeli kara source-ka |
| Khidmadda Bisha ee La Qaaday | Student kasta: min(fee, Completed payments attributed to cycle), kadib sum | Monthly Payments, status=paid | Cash received bishan keliya ma aha; `paid` filter-ku wuxuu ku daraa partial payers |
| Khidmadda Ardayda Ku Dhiman | Student kasta: max(0, fee−paid), kadib sum | Monthly Payments, status=pending | Lacagta dhiman, ma aha tirada ardayda; historical view wuxuu adeegsadaa snapshot |
| Deymihii Hore ee la Qabtay | Completed Payments: paymentDate gudaha cycle-ka, billingCycle ka hor cycle-ka | Live Previous Debt list | Link-ku wuxuu tusaa deyn taagan, ma aha lacagtii deynta laga qabtay |
| Lacagaha Hormariska ah | Completed Payments: paymentDate gudaha cycle-ka, billingCycle ka dambeeya cycle-ka | Cashbook cycle-ka la doortay | Form-ku marka targetMonth la beddelo date wuu beddeli karaa; link-ku advance-only ma aha |
| Dakhliga Guud | Sum Transactions.amount, type=Income, date gudaha cycle-ka, branchQuery haddii user-ku laan leeyahay | Cashbook | Direct payments iyo cashbook data ma aha hal dataset; targetMonth vs date filter kala duwan |
| Kharashaadka Guud | Sum Transactions.amount, type=Expense, date gudaha cycle-ka, branchQuery haddii jiro | Cashbook | Isla dataset/scope mismatch-ka Income |
| Haraaga | Total Income − Total Expenses ee cycle-ka | Cashbook | Waa net movement-ka cycle-ka; opening balance ama wallet balance ma aha |
| Deyn Hore | Sum unpaid fees dhammaan cycles ka hor selected cycle, live payments la adeegsanayo | Live Previous Debt list | Link-ku selected cycle wuu lumiyaa; Exited/Inactive debt ayaa ka bixi karta |
| Deyntii Cycle-kii Xirmay | Frozen snapshot: selected cycle haddii xirmay, haddii kale cycle-kii hore | Monthly Payments, snapshot, pending | Frozen debt iyo live debt si ula kac ah way kala duwanaan karaan; 2026-08 override jira |

Card-ka oo la gujiyo wuxuu furayaa page-ka ku qoran config. Eye icon-ka wuxuu furaa modal sharaxaad leh iyo isla tiradii card-ka; ma aha transaction-by-transaction audit. Progress-ka Fees Collected waa collected/expected×100. Bars-ka kale intooda badan waa qurxin go'an.

## Mudnaanta sixidda

1. Xir API permissions-ka maqan; ilaali source-linked records iyo cycle locks dhammaan endpoints-ka.
2. Middee posting/reversal, atomic transactions, validation iyo idempotency; ka saar zero-clamping-ka lacagta luminaya.
3. Sax category changes, salary mirrors, dates, wallet deletion iyo opening-balance adjustments.
4. Ka saar hard-coded overrides/startup rewrites iyadoo taariikhda la xaqiijinayo; dib u heshiisii records-ka jira ka hor inta balance dib loo xisaabin.
5. Middee scope/basis-ka cards-ka, sax links/reports/cache, kadib ku tijaabi multi-branch, partial payment, arrears, advance, invalid edit, duplicate delete iyo concurrent writes.

Audit-kan wuxuu muujinayaa cilladaha code-ka iyo xaaladaha ay ku dhacaan. Ma caddeynayo in balance kasta oo database-kaaga hadda yaal khaldan yahay; taas waxay u baahan tahay reconciliation read-only ah oo xogta dhabta ah lagu sameeyo.
