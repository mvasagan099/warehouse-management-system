# -*- coding: utf-8 -*-
# Adds the Phase 5 strings to en.json and ta.json (deep merge, safe to re-run).
import json

EN = {
 "nav": {"attendance": "Attendance", "documents": "My documents", "imports": "Data import", "notices": "Notifications", "ops": "System health", "profile": "My details", "staff": "Staff", "support": "Support"},
 "validation": {"passwordMin": "At least 10 characters", "passwordStrong": "Use a capital letter, a small letter and a number"},
 "auth": {"tooManyAttempts": "Too many wrong passwords. Wait {{minutes}} minute(s) and try again."},
 "jobRole": {"MANAGER": "Manager", "PICKER": "Picker", "LOADER": "Loader", "SECURITY": "Security", "ACCOUNTANT": "Accountant"},
 "employeeStatus": {"ACTIVE": "Active", "ON_LEAVE": "On leave", "EXITED": "Left"},
 "applicantStatus": {"SHORTLISTED": "Shortlisted"},
 "requestStatus": {"PENDING": "Waiting", "APPROVED": "Approved", "REJECTED": "Not approved"},
 "ticketStatus": {"OPEN": "Open", "IN_PROGRESS": "Being handled", "WAITING_CLIENT": "Waiting for you", "RESOLVED": "Resolved", "CLOSED": "Closed"},
 "hiring": {
  "jobRole": "Job", "salaryMin": "Salary from (₹ a month)", "salaryMax": "Salary up to (₹ a month)", "salaryHint": "Only the administrator can see salary.", "details": "Details",
  "source": "Where they came from", "sourceHint": "Referral, job portal, walk-in...", "expectedJoining": "Expected joining date", "resume": "Resume", "uploadResume": "Upload resume", "openResume": "Open resume", "noResume": "No resume yet.",
  "resumePrivate": "Stored privately. Only the administrator and this warehouse's manager can open it.", "resumeSaved": "Resume saved", "rounds": "Interview rounds", "round": "Round {{n}}", "noRounds": "No interviews yet.",
  "roundDate": "Date and time", "interviewer": "Interviewer", "score": "Score", "addRound": "Add round", "offer": "Offer letter", "makeOffer": "Make offer letter (PDF)", "regenerateOffer": "Make it again",
  "downloadOffer": "Download saved letter", "offerSaved": "Offer letter saved", "offerIssued": "Issued on {{date}}", "thisWarehouse": "this", "headOffice": "Head office"},
 "staff": {
  "title": "Staff", "subtitle": "Everyone who works for you, with their joining and leaving dates.", "none": "No staff yet. People appear here when you create their login.", "showExited": "Show people who left",
  "joiningDate": "Joining date", "emergencyName": "Emergency contact", "emergencyPhone": "Emergency phone", "exit": "Mark as left", "exitTitle": "{{name}} is leaving", "exitHelp": "Their login is switched off. All their records stay.", "exitDate": "Last day", "exited": "Marked as left",
  "privateDetails": "ID and bank", "sensitiveNote": "Private. Only the administrator can see this. It is never shown in lists and the activity log keeps only stars.", "idType": "ID proof type", "uploadId": "Upload ID proof", "openId": "Open ID proof", "idSaved": "ID proof saved",
  "accountHolder": "Account holder", "bankName": "Bank", "accountNo": "Account number", "ifsc": "IFSC", "show": "Show", "hide": "Hide",
  "idTypes": {"AADHAAR": "Aadhaar", "PAN": "PAN", "VOTER_ID": "Voter ID", "DRIVING_LICENCE": "Driving licence", "PASSPORT": "Passport"}},
 "att": {
  "title": "Attendance", "subtitle": "Check in when you arrive and check out when you leave.", "today": "Today", "checkIn": "Check in", "checkOut": "Check out", "in": "In", "out": "Out", "notIn": "Not checked in yet", "done": "Saved", "doneOutside": "Saved. You are away from the warehouse, so your manager will see a note.",
  "savedOffline": "No signal. Saved on this phone and will be sent when you are online.", "waitingToSend": "{{count}} punch(es) waiting to be sent", "outsideRadius": "{{m}} m from the warehouse", "outsideShort": "Away from warehouse", "recent": "Recent days", "noneYet": "Nothing yet.", "fix": "Fix",
  "requestCorrection": "Ask for a correction", "reason": "Reason", "send": "Send", "correctionSent": "Sent to your manager", "month": "Month", "nobodyYet": "Nobody has checked in today.", "noCorrections": "No corrections waiting.", "shiftName": "Shift name", "starts": "Starts", "ends": "Ends", "addShift": "Add shift",
  "reportHelp": "A spreadsheet of everyone's check-in and check-out for the month, with hours.", "downloadCsv": "Download CSV",
  "correction": {"NONE": "—", "PENDING": "Waiting", "APPROVED": "Approved", "REJECTED": "Not approved"}, "tab": {"today": "Today", "corrections": "Corrections", "roster": "Shift roster", "report": "Monthly report"}},
 "crew": {"title": "Workers on this lorry", "help": "For reports only. It does not change what the client is billed.", "onDuty": "on duty", "saved": "Saved", "noStaff": "No staff in this warehouse."},
 "managers": {"manage": "Managers", "title": "Managers of {{name}}", "none": "This warehouse has no manager.", "remove": "Remove", "removed": "Manager removed", "lastWarning": "This is the last manager. The warehouse would have nobody to approve documents.", "removeAnyway": "Remove anyway", "pick": "Choose a manager", "assign": "Assign"},
 "gate": {"counted": "Counted"},
 "offline": {
  "title": "Waiting on this phone", "statusLabel": "Sync status", "offline": "Offline · {{count}} waiting", "syncing": "Sending...", "needsYou": "{{count}} need you", "waitingCount": "{{count}} waiting", "syncNow": "Send now", "empty": "Nothing is waiting.",
  "explain": "Entries made without signal are kept here and sent in order when you are online. Nothing is overwritten without asking you.", "waiting": "Waiting to be sent", "savedOnPhone": "No signal. Saved on this phone.", "savedNoPhoto": "No signal. Saved on this phone (the photo was not saved: add it later).",
  "gateQueued": "Lorry saved on this phone. It will be sent when you are online.", "scanQueued": "Scan saved on this phone for {{slot}}.", "changedMeanwhile": "Someone changed this meanwhile. Reloaded: check and enter it again.",
  "conflict": "Someone else changed this. The server has: {{value}}", "yours": "Yours: {{value}}", "keepServer": "Keep theirs", "useMine": "Use mine", "refused": "The server refused this: {{reason}}", "retry": "Try again", "discard": "Delete",
  "kind": {"gate_entry": "Gate entry", "count": "Dock count", "manual_reading": "Temperature", "scan": "Scan", "attendance": "Attendance"}},
 "dash": {
  "adminTitle": "Administrator overview", "managerTitle": "Manager overview", "revenueMonth": "Revenue this month", "rent": "Rent", "labour": "Labour", "other": "Other", "outstanding": "Outstanding", "expiring": "Expiring stock", "withinDays": "within {{days}} days",
  "openAlerts": "Open alerts", "critical": "{{count}} critical", "sensorsOffline": "Sensors offline", "maintenance": "Maintenance due", "next14": "next 14 days", "occupancyByWarehouse": "Occupancy by warehouse", "occupancyByZone": "Occupancy by zone", "occupied": "Occupied", "slots": "Brigades",
  "topClients": "Top clients (90 days)", "noInvoices": "No invoices yet.", "revenueSplit": "Rent and labour", "changeRequests": "client detail change(s) waiting for approval", "jobFailed": "did not finish: {{error}}", "jobStale": "has not run on time",
  "noManager": "No manager: {{list}}.", "assign": "Assign one", "lorriesToday": "Lorries today", "pendingReceipts": "Waiting to receive", "pendingDispatches": "Dispatches open", "onShift": "Staff on shift", "corrections": "{{count}} correction(s)", "tasks": "Tasks this week", "tickets": "{{count}} ticket(s)",
  "expectedLorries": "Expected today", "noLorries": "No lorries expected.", "staffOnShift": "On shift now", "nobody": "Nobody has checked in."},
 "docs": {"title": "My documents", "subtitle": "Receipts, challans, invoices, credit notes and temperature reports as PDF.", "kind": "Type", "none": "No documents in this period.", "downloadZip": "Download all ({{count}}) as ZIP", "preparing": "Preparing",
  "kinds": {"RECEIPT": "Receipt", "CHALLAN": "Challan", "INVOICE": "Invoice", "CREDIT_NOTE": "Credit note", "TEMP_REPORT": "Temperature report"}},
 "portal": {"brigadesHeld": "Brigades held", "openTickets": "Open support tickets", "profileRequests": "Detail changes waiting", "alertsTitle": "{{count}} temperature alert(s) affect your stock", "seeTempReport": "See the temperature report", "stockByBand": "Stock by temperature band", "noStock": "No stock in the warehouse right now.", "lines": "lines", "openStock": "Open stock",
  "expiring": "Expiring soon", "noExpiring": "Nothing is about to expire.", "recentDocs": "Recent documents", "allDocs": "All documents"},
 "support": {"title": "Support", "subtitleClient": "Ask us anything about your stock, dispatches or invoices.", "subtitleStaff": "Questions from clients.", "new": "New ticket", "none": "No tickets.", "subject": "Subject", "message": "Message", "attach": "Attach photos or PDF", "attachHint": "Up to 5 files, 10 MB each.", "send": "Send", "sent": "Your ticket was sent",
  "reply": "Reply", "close": "Close ticket", "trail": "Messages and status", "you": "You", "staff": "Warehouse team", "attachment": "(attachment)", "filter": {"open": "Open", "all": "All"}},
 "profile": {"title": "My details", "subtitle": "Ask us to change your company details. We check and approve each change.", "askChange": "Ask for this change", "requestSent": "Sent. We will tell you when it is approved.", "pending": "A change you asked for on {{date}} is waiting for approval.",
  "contacts": "People to tell about temperature alerts", "contactsHelp": "These people get an email when your stock is affected (after our manager approves the message).", "getsAlerts": "Gets alerts", "noContacts": "No extra contacts.", "addContact": "Add",
  "fields": {"company_name": "Company name", "gstin": "GSTIN", "pan": "PAN", "address_line1": "Address line 1", "address_line2": "Address line 2", "city": "City", "district": "District", "state": "State", "pincode": "Pincode", "contact_name": "Contact person", "phone": "Phone", "email": "Email"}},
 "notices": {"title": "Notifications", "subtitle": "Stock received, dispatches, invoices, payments, reminders and replies.", "none": "Nothing yet.", "markAll": "Mark all as read"},
 "billing": {"payOnline": "Pay online"},
 "imports": {"title": "Data import", "subtitle": "Start with real data: clients, companies, opening stock and opening balances.", "what": "What are you importing?", "template": "Download template", "chooseFile": "Choose CSV file", "rowsFound": "{{count}} row(s) found", "check": "Check the file", "run": "Import",
  "allGood": "The file is good", "hasErrors": "{{count}} problem(s)", "imported": "Imported", "summary": "{{rows}} rows, {{valid}} good", "nothingSaved": "Nothing has been saved yet.", "row": "Row", "column": "Column", "problem": "Problem", "errorReport": "Download problem list", "missingColumn": "The file needs a column called {{name}}", "done": "Imported {{count}} row(s)",
  "kinds": {"clients": "Clients", "companies": "Company master (senders and receivers)", "opening_stock": "Opening stock (per Brigade slot and batch)", "opening_balances": "Opening balances (per client)"},
  "help": {"clients": "One row per client. company_name is required. Amounts are in rupees.", "companies": "One row per sender or receiver. client_code must already exist.", "opening_stock": "One row per batch in a slot. The slot must be free or already holding the same client's goods, and in a zone that suits the temperature.", "opening_balances": "One row per client: positive = the client owes you, negative = advance held. Dates are YYYY-MM-DD."}},
 "ops": {"title": "System health", "subtitle": "Scheduled jobs, backups, sign-in security and how long records are kept.", "cronTitle": "Scheduled jobs", "cronHelp": "Nightly snapshots, invoice runs, alerts and backups. A job that failed or did not run on time is shown in red here and on your dashboard.",
  "job": "Job", "lastOk": "Last good run", "runs": "Runs", "ok": "OK", "failed": "Failed", "notRunning": "Not running", "backupTitle": "Nightly backup copy", "backupHelp": "A second copy of the key tables, kept 14 days in private storage. Supabase's own backups are separate.", "backupNow": "Back up now",
  "backupDone": "Backup saved in {{folder}}", "noBackups": "No backup yet.", "latest": "Latest", "files": "{{count}} files", "securityTitle": "Sign-in security", "mfaHelp": "Ask for a code from an authenticator app every time the administrator signs in.", "mfaEnrolled": "Authenticator app set up", "mfaNotEnrolled": "Authenticator app not set up",
  "mfaVerifyFirst": "Enter the code from your app once, then you can switch this on.", "mfaEnrolFirst": "Set up the app first.", "mfaRequire": "Require two-factor sign-in for the administrator", "passwordRules": "Passwords need at least 10 characters with a capital letter, a small letter and a number.",
  "retentionTitle": "How long records are kept", "retentionHelp": "Old notices, sent emails and job logs are cleared after these many days.", "retentionFinancial": "Invoices, payments, receipts and challans are never deleted.",
  "retention": {"notifications_days": "Read notifications (days)", "outbox_days": "Sent emails (days)", "cron_runs_days": "Job history (days)", "soft_deleted_days": "Removed contacts (days)"}},
 "mfa": {"title": "Second step", "required": "A code from your authenticator app is needed to continue.", "enrolHelp": "Use an authenticator app (Google Authenticator, Microsoft Authenticator or similar).", "setUp": "Set up", "scan": "Scan this with your authenticator app.", "qrAlt": "QR code for the authenticator app", "orType": "Or type this key:",
  "code": "6-digit code", "codeHint": "From the app", "verify": "Verify", "verified": "Verified", "wrongCode": "That code did not work. Try the new one.", "failed": "Could not start the setup."},
 "audit": {"anyone": "Anyone", "maskedNote": "Bank details, ID proof and device keys are never written here: they show as ***."},
}

TA = {
 "nav": {"attendance": "வருகைப் பதிவு", "documents": "என் ஆவணங்கள்", "imports": "தரவு இறக்குமதி", "notices": "அறிவிப்புகள்", "ops": "அமைப்பு நிலை", "profile": "என் விவரங்கள்", "staff": "ஊழியர்கள்", "support": "உதவி"},
 "validation": {"passwordMin": "குறைந்தது 10 எழுத்துகள்", "passwordStrong": "பெரிய எழுத்து, சிறிய எழுத்து, எண் மூன்றும் வேண்டும்"},
 "auth": {"tooManyAttempts": "தவறான கடவுச்சொல் பல முறை. {{minutes}} நிமிடம் காத்திருந்து மீண்டும் முயலவும்."},
 "jobRole": {"MANAGER": "மேலாளர்", "PICKER": "எடுப்பவர்", "LOADER": "ஏற்றுபவர்", "SECURITY": "காவலர்", "ACCOUNTANT": "கணக்காளர்"},
 "employeeStatus": {"ACTIVE": "பணியில்", "ON_LEAVE": "விடுப்பில்", "EXITED": "விலகினார்"},
 "applicantStatus": {"SHORTLISTED": "தேர்வுப் பட்டியலில்"},
 "requestStatus": {"PENDING": "காத்திருக்கிறது", "APPROVED": "ஒப்புதல் அளிக்கப்பட்டது", "REJECTED": "ஒப்புதல் இல்லை"},
 "ticketStatus": {"OPEN": "திறந்துள்ளது", "IN_PROGRESS": "கவனிக்கப்படுகிறது", "WAITING_CLIENT": "உங்கள் பதிலுக்காக", "RESOLVED": "தீர்க்கப்பட்டது", "CLOSED": "மூடப்பட்டது"},
 "hiring": {
  "jobRole": "பணி", "salaryMin": "சம்பளம் குறைந்தது (மாதம் ₹)", "salaryMax": "சம்பளம் அதிகபட்சம் (மாதம் ₹)", "salaryHint": "சம்பளத்தை நிர்வாகி மட்டுமே பார்க்க முடியும்.", "details": "விவரங்கள்",
  "source": "எங்கிருந்து வந்தவர்", "sourceHint": "பரிந்துரை, வேலை தளம், நேரில்...", "expectedJoining": "எதிர்பார்க்கும் சேரும் தேதி", "resume": "சுயவிவரம்", "uploadResume": "சுயவிவரம் பதிவேற்று", "openResume": "சுயவிவரம் திற", "noResume": "இன்னும் சுயவிவரம் இல்லை.",
  "resumePrivate": "தனிப்பட்டதாக சேமிக்கப்படுகிறது. நிர்வாகியும் இந்தக் கிடங்கின் மேலாளரும் மட்டுமே திறக்க முடியும்.", "resumeSaved": "சுயவிவரம் சேமிக்கப்பட்டது", "rounds": "நேர்காணல் சுற்றுகள்", "round": "சுற்று {{n}}", "noRounds": "இன்னும் நேர்காணல் இல்லை.",
  "roundDate": "தேதி, நேரம்", "interviewer": "நேர்காணல் செய்பவர்", "score": "மதிப்பெண்", "addRound": "சுற்றைச் சேர்", "offer": "பணி நியமனக் கடிதம்", "makeOffer": "நியமனக் கடிதம் உருவாக்கு (PDF)", "regenerateOffer": "மீண்டும் உருவாக்கு",
  "downloadOffer": "சேமித்த கடிதத்தைப் பதிவிறக்கு", "offerSaved": "நியமனக் கடிதம் சேமிக்கப்பட்டது", "offerIssued": "{{date}} அன்று வழங்கப்பட்டது", "thisWarehouse": "இந்த", "headOffice": "தலைமை அலுவலகம்"},
 "staff": {
  "title": "ஊழியர்கள்", "subtitle": "உங்களுக்காக பணிபுரிபவர்கள், சேர்ந்த மற்றும் விலகிய தேதிகளுடன்.", "none": "இன்னும் ஊழியர்கள் இல்லை. உள்நுழைவு உருவாக்கியதும் இங்கே தோன்றுவார்கள்.", "showExited": "விலகியவர்களையும் காட்டு",
  "joiningDate": "சேர்ந்த தேதி", "emergencyName": "அவசரத் தொடர்பு", "emergencyPhone": "அவசர தொலைபேசி", "exit": "விலகியதாகக் குறி", "exitTitle": "{{name}} விலகுகிறார்", "exitHelp": "அவரது உள்நுழைவு நிறுத்தப்படும். எல்லா பதிவுகளும் இருக்கும்.", "exitDate": "கடைசி நாள்", "exited": "விலகியதாகக் குறிக்கப்பட்டது",
  "privateDetails": "அடையாளம், வங்கி", "sensitiveNote": "தனிப்பட்டது. நிர்வாகி மட்டுமே பார்க்க முடியும். பட்டியல்களில் காட்டப்படாது; செயல்பாட்டுப் பதிவில் நட்சத்திரங்கள் மட்டுமே இருக்கும்.", "idType": "அடையாளச் சான்று வகை", "uploadId": "அடையாளச் சான்று பதிவேற்று", "openId": "அடையாளச் சான்றைத் திற", "idSaved": "அடையாளச் சான்று சேமிக்கப்பட்டது",
  "accountHolder": "கணக்கு உரிமையாளர்", "bankName": "வங்கி", "accountNo": "கணக்கு எண்", "ifsc": "IFSC", "show": "காட்டு", "hide": "மறை",
  "idTypes": {"AADHAAR": "ஆதார்", "PAN": "பான்", "VOTER_ID": "வாக்காளர் அட்டை", "DRIVING_LICENCE": "ஓட்டுநர் உரிமம்", "PASSPORT": "கடவுச்சீட்டு"}},
 "att": {
  "title": "வருகைப் பதிவு", "subtitle": "வந்ததும் பதிவு செய்யுங்கள்; கிளம்பும்போது வெளியேற்றம் பதிவு செய்யுங்கள்.", "today": "இன்று", "checkIn": "வருகை", "checkOut": "புறப்பாடு", "in": "வருகை", "out": "புறப்பாடு", "notIn": "இன்னும் வருகை பதிவு இல்லை", "done": "சேமிக்கப்பட்டது", "doneOutside": "சேமிக்கப்பட்டது. நீங்கள் கிடங்கிலிருந்து தொலைவில் உள்ளீர்கள்; மேலாளருக்குக் குறிப்பு தெரியும்.",
  "savedOffline": "சிக்னல் இல்லை. இந்த போனில் சேமிக்கப்பட்டது; இணையம் வந்ததும் அனுப்பப்படும்.", "waitingToSend": "{{count}} பதிவு அனுப்ப காத்திருக்கிறது", "outsideRadius": "கிடங்கிலிருந்து {{m}} மீ", "outsideShort": "கிடங்கிற்கு வெளியே", "recent": "சமீபத்திய நாட்கள்", "noneYet": "இன்னும் எதுவும் இல்லை.", "fix": "திருத்து",
  "requestCorrection": "திருத்தம் கேளுங்கள்", "reason": "காரணம்", "send": "அனுப்பு", "correctionSent": "மேலாளருக்கு அனுப்பப்பட்டது", "month": "மாதம்", "nobodyYet": "இன்று யாரும் வருகை பதிவு செய்யவில்லை.", "noCorrections": "திருத்தங்கள் எதுவும் காத்திருக்கவில்லை.", "shiftName": "ஷிப்ட் பெயர்", "starts": "தொடக்கம்", "ends": "முடிவு", "addShift": "ஷிப்ட் சேர்",
  "reportHelp": "மாதம் முழுவதும் அனைவரின் வருகை, புறப்பாடு, மணி நேரங்களுடன் ஒரு விரிதாள்.", "downloadCsv": "CSV பதிவிறக்கு",
  "correction": {"NONE": "—", "PENDING": "காத்திருக்கிறது", "APPROVED": "ஒப்புதல்", "REJECTED": "ஒப்புதல் இல்லை"}, "tab": {"today": "இன்று", "corrections": "திருத்தங்கள்", "roster": "ஷிப்ட் அட்டவணை", "report": "மாத அறிக்கை"}},
 "crew": {"title": "இந்த லாரியில் பணியாற்றியவர்கள்", "help": "அறிக்கைகளுக்கு மட்டும். வாடிக்கையாளர் கட்டணத்தை மாற்றாது.", "onDuty": "பணியில்", "saved": "சேமிக்கப்பட்டது", "noStaff": "இந்தக் கிடங்கில் ஊழியர்கள் இல்லை."},
 "managers": {"manage": "மேலாளர்கள்", "title": "{{name}} மேலாளர்கள்", "none": "இந்தக் கிடங்கிற்கு மேலாளர் இல்லை.", "remove": "நீக்கு", "removed": "மேலாளர் நீக்கப்பட்டார்", "lastWarning": "இவர் கடைசி மேலாளர். ஆவணங்களை அங்கீகரிக்க யாரும் இருக்க மாட்டார்கள்.", "removeAnyway": "இருந்தாலும் நீக்கு", "pick": "மேலாளரைத் தேர்வு செய்க", "assign": "நியமி"},
 "gate": {"counted": "எண்ணியது"},
 "offline": {
  "title": "இந்த போனில் காத்திருப்பவை", "statusLabel": "ஒத்திசைவு நிலை", "offline": "இணையம் இல்லை · {{count}} காத்திருக்கிறது", "syncing": "அனுப்புகிறது...", "needsYou": "{{count}} உங்கள் முடிவுக்காக", "waitingCount": "{{count}} காத்திருக்கிறது", "syncNow": "இப்போது அனுப்பு", "empty": "எதுவும் காத்திருக்கவில்லை.",
  "explain": "சிக்னல் இல்லாமல் செய்த பதிவுகள் இங்கே இருக்கும்; இணையம் வந்ததும் வரிசையாக அனுப்பப்படும். உங்களிடம் கேட்காமல் எதுவும் மேலெழுதப்படாது.", "waiting": "அனுப்ப காத்திருக்கிறது", "savedOnPhone": "சிக்னல் இல்லை. இந்த போனில் சேமிக்கப்பட்டது.", "savedNoPhoto": "சிக்னல் இல்லை. போனில் சேமிக்கப்பட்டது (படம் சேமிக்கப்படவில்லை; பிறகு சேர்க்கவும்).",
  "gateQueued": "லாரி இந்த போனில் சேமிக்கப்பட்டது. இணையம் வந்ததும் அனுப்பப்படும்.", "scanQueued": "{{slot}} க்கான ஸ்கேன் இந்த போனில் சேமிக்கப்பட்டது.", "changedMeanwhile": "இதற்கிடையில் வேறொருவர் மாற்றினார். மீண்டும் ஏற்றப்பட்டது: சரிபார்த்து மீண்டும் பதிவிடுங்கள்.",
  "conflict": "வேறொருவர் இதை மாற்றியுள்ளார். சர்வரில் உள்ளது: {{value}}", "yours": "உங்களுடையது: {{value}}", "keepServer": "அவருடையதை வை", "useMine": "என்னுடையதைப் பயன்படுத்து", "refused": "சர்வர் இதை ஏற்கவில்லை: {{reason}}", "retry": "மீண்டும் முயல்", "discard": "நீக்கு",
  "kind": {"gate_entry": "நுழைவாயில் பதிவு", "count": "எண்ணிக்கை", "manual_reading": "வெப்பநிலை", "scan": "ஸ்கேன்", "attendance": "வருகை"}},
 "dash": {
  "adminTitle": "நிர்வாகி கண்ணோட்டம்", "managerTitle": "மேலாளர் கண்ணோட்டம்", "revenueMonth": "இந்த மாத வருவாய்", "rent": "வாடகை", "labour": "தொழிலாளர்", "other": "மற்றவை", "outstanding": "நிலுவை", "expiring": "காலாவதியாகும் சரக்கு", "withinDays": "{{days}} நாட்களுக்குள்",
  "openAlerts": "திறந்த எச்சரிக்கைகள்", "critical": "{{count}} அவசரம்", "sensorsOffline": "இணைப்பில்லா சென்சார்கள்", "maintenance": "பராமரிப்பு நிலுவை", "next14": "அடுத்த 14 நாட்கள்", "occupancyByWarehouse": "கிடங்கு வாரியாக இடப் பயன்பாடு", "occupancyByZone": "மண்டலம் வாரியாக இடப் பயன்பாடு", "occupied": "நிரம்பியது", "slots": "பிரிகேடுகள்",
  "topClients": "முன்னணி வாடிக்கையாளர்கள் (90 நாட்கள்)", "noInvoices": "இன்னும் விலைப்பட்டியல் இல்லை.", "revenueSplit": "வாடகை மற்றும் தொழிலாளர்", "changeRequests": "வாடிக்கையாளர் விவர மாற்றம்(கள்) ஒப்புதலுக்காக", "jobFailed": "முடிக்கவில்லை: {{error}}", "jobStale": "உரிய நேரத்தில் இயங்கவில்லை",
  "noManager": "மேலாளர் இல்லை: {{list}}.", "assign": "ஒருவரை நியமி", "lorriesToday": "இன்றைய லாரிகள்", "pendingReceipts": "பெற காத்திருப்பவை", "pendingDispatches": "திறந்த அனுப்புதல்கள்", "onShift": "ஷிப்டில் உள்ளவர்கள்", "corrections": "{{count}} திருத்தம்", "tasks": "இந்த வார பணிகள்", "tickets": "{{count}} டிக்கெட்",
  "expectedLorries": "இன்று எதிர்பார்ப்பவை", "noLorries": "லாரிகள் எதிர்பார்க்கப்படவில்லை.", "staffOnShift": "இப்போது பணியில்", "nobody": "யாரும் வருகை பதிவு செய்யவில்லை."},
 "docs": {"title": "என் ஆவணங்கள்", "subtitle": "ரசீதுகள், சலான்கள், விலைப்பட்டியல்கள், கடன் குறிப்புகள், வெப்பநிலை அறிக்கைகள் PDF ஆக.", "kind": "வகை", "none": "இந்தக் காலத்தில் ஆவணங்கள் இல்லை.", "downloadZip": "அனைத்தையும் ({{count}}) ZIP ஆக பதிவிறக்கு", "preparing": "தயாராகிறது",
  "kinds": {"RECEIPT": "ரசீது", "CHALLAN": "சலான்", "INVOICE": "விலைப்பட்டியல்", "CREDIT_NOTE": "கடன் குறிப்பு", "TEMP_REPORT": "வெப்பநிலை அறிக்கை"}},
 "portal": {"brigadesHeld": "உங்கள் பிரிகேடுகள்", "openTickets": "திறந்த உதவிக் கோரிக்கைகள்", "profileRequests": "காத்திருக்கும் விவர மாற்றங்கள்", "alertsTitle": "{{count}} வெப்பநிலை எச்சரிக்கை உங்கள் சரக்கைப் பாதிக்கிறது", "seeTempReport": "வெப்பநிலை அறிக்கையைப் பார்", "stockByBand": "வெப்பநிலை வகை வாரியாக சரக்கு", "noStock": "இப்போது கிடங்கில் சரக்கு இல்லை.", "lines": "வரிகள்", "openStock": "சரக்கைத் திற",
  "expiring": "விரைவில் காலாவதி", "noExpiring": "எதுவும் காலாவதியாகப் போவதில்லை.", "recentDocs": "சமீபத்திய ஆவணங்கள்", "allDocs": "அனைத்து ஆவணங்கள்"},
 "support": {"title": "உதவி", "subtitleClient": "உங்கள் சரக்கு, அனுப்புதல், விலைப்பட்டியல் பற்றி எதையும் கேளுங்கள்.", "subtitleStaff": "வாடிக்கையாளர் கேள்விகள்.", "new": "புதிய கோரிக்கை", "none": "கோரிக்கைகள் இல்லை.", "subject": "தலைப்பு", "message": "செய்தி", "attach": "படங்கள் அல்லது PDF இணை", "attachHint": "5 கோப்புகள் வரை, ஒவ்வொன்றும் 10 MB.", "send": "அனுப்பு", "sent": "உங்கள் கோரிக்கை அனுப்பப்பட்டது",
  "reply": "பதில்", "close": "கோரிக்கையை மூடு", "trail": "செய்திகள் மற்றும் நிலை", "you": "நீங்கள்", "staff": "கிடங்குக் குழு", "attachment": "(இணைப்பு)", "filter": {"open": "திறந்தவை", "all": "அனைத்தும்"}},
 "profile": {"title": "என் விவரங்கள்", "subtitle": "நிறுவன விவர மாற்றத்தைக் கேளுங்கள். ஒவ்வொரு மாற்றத்தையும் நாங்கள் சரிபார்த்து ஒப்புதல் அளிப்போம்.", "askChange": "இந்த மாற்றத்தைக் கேள்", "requestSent": "அனுப்பப்பட்டது. ஒப்புதல் ஆனதும் தெரிவிப்போம்.", "pending": "{{date}} அன்று நீங்கள் கேட்ட மாற்றம் ஒப்புதலுக்காகக் காத்திருக்கிறது.",
  "contacts": "வெப்பநிலை எச்சரிக்கை தெரிவிக்க வேண்டியவர்கள்", "contactsHelp": "உங்கள் சரக்கு பாதிக்கப்பட்டால் (எங்கள் மேலாளர் செய்தியை ஒப்புக்கொண்ட பின்) இவர்களுக்கு மின்னஞ்சல் செல்லும்.", "getsAlerts": "எச்சரிக்கை பெறுபவர்", "noContacts": "கூடுதல் தொடர்புகள் இல்லை.", "addContact": "சேர்",
  "fields": {"company_name": "நிறுவனப் பெயர்", "gstin": "GSTIN", "pan": "PAN", "address_line1": "முகவரி வரி 1", "address_line2": "முகவரி வரி 2", "city": "நகரம்", "district": "மாவட்டம்", "state": "மாநிலம்", "pincode": "அஞ்சல் எண்", "contact_name": "தொடர்பு நபர்", "phone": "தொலைபேசி", "email": "மின்னஞ்சல்"}},
 "notices": {"title": "அறிவிப்புகள்", "subtitle": "சரக்கு பெறல், அனுப்புதல், விலைப்பட்டியல், பணம், நினைவூட்டல், பதில்கள்.", "none": "இன்னும் எதுவும் இல்லை.", "markAll": "அனைத்தையும் படித்ததாகக் குறி"},
 "billing": {"payOnline": "ஆன்லைனில் செலுத்து"},
 "imports": {"title": "தரவு இறக்குமதி", "subtitle": "உண்மையான தரவுடன் தொடங்குங்கள்: வாடிக்கையாளர்கள், நிறுவனங்கள், தொடக்க சரக்கு, தொடக்க நிலுவை.", "what": "எதை இறக்குமதி செய்கிறீர்கள்?", "template": "வார்ப்புருவைப் பதிவிறக்கு", "chooseFile": "CSV கோப்பைத் தேர்வு செய்", "rowsFound": "{{count}} வரிசை(கள்) கிடைத்தன", "check": "கோப்பைச் சரிபார்", "run": "இறக்குமதி செய்",
  "allGood": "கோப்பு சரியாக உள்ளது", "hasErrors": "{{count}} பிழை(கள்)", "imported": "இறக்குமதி ஆனது", "summary": "{{rows}} வரிசைகள், {{valid}} சரி", "nothingSaved": "இன்னும் எதுவும் சேமிக்கப்படவில்லை.", "row": "வரிசை", "column": "நெடுவரிசை", "problem": "பிரச்சினை", "errorReport": "பிழைப் பட்டியலைப் பதிவிறக்கு", "missingColumn": "கோப்பில் {{name}} என்ற நெடுவரிசை வேண்டும்", "done": "{{count}} வரிசை(கள்) இறக்குமதி ஆனது",
  "kinds": {"clients": "வாடிக்கையாளர்கள்", "companies": "நிறுவன முதன்மைப் பட்டியல் (அனுப்புநர், பெறுநர்)", "opening_stock": "தொடக்க சரக்கு (ஸ்லாட், பேட்ச் வாரியாக)", "opening_balances": "தொடக்க நிலுவை (வாடிக்கையாளர் வாரியாக)"},
  "help": {"clients": "ஒரு வாடிக்கையாளருக்கு ஒரு வரிசை. company_name கட்டாயம். தொகைகள் ரூபாயில்.", "companies": "ஒரு அனுப்புநர்/பெறுநருக்கு ஒரு வரிசை. client_code ஏற்கனவே இருக்க வேண்டும்.", "opening_stock": "ஒரு ஸ்லாட்டில் ஒரு பேட்சுக்கு ஒரு வரிசை. ஸ்லாட் காலியாக அல்லது அதே வாடிக்கையாளரின் சரக்குடன் இருக்க வேண்டும்; வெப்பநிலைக்கு ஏற்ற மண்டலத்தில் இருக்க வேண்டும்.", "opening_balances": "ஒரு வாடிக்கையாளருக்கு ஒரு வரிசை: நேர்மறை = வாடிக்கையாளர் தர வேண்டும், எதிர்மறை = முன்பணம். தேதி YYYY-MM-DD."}},
 "ops": {"title": "அமைப்பு நிலை", "subtitle": "திட்டமிட்ட பணிகள், காப்புப் பிரதிகள், உள்நுழைவு பாதுகாப்பு, பதிவுகள் வைத்திருக்கும் காலம்.", "cronTitle": "திட்டமிட்ட பணிகள்", "cronHelp": "இரவு ஸ்னாப்ஷாட், விலைப்பட்டியல் ஓட்டம், எச்சரிக்கைகள், காப்புப் பிரதி. தோல்வியடைந்த அல்லது நேரத்தில் இயங்காத பணி இங்கும் உங்கள் முகப்பிலும் சிவப்பில் தெரியும்.",
  "job": "பணி", "lastOk": "கடைசி வெற்றிகர ஓட்டம்", "runs": "ஓட்டங்கள்", "ok": "சரி", "failed": "தோல்வி", "notRunning": "இயங்கவில்லை", "backupTitle": "இரவு காப்புப் பிரதி", "backupHelp": "முக்கிய அட்டவணைகளின் இரண்டாவது நகல், தனியார் சேமிப்பில் 14 நாட்கள். Supabase இன் சொந்த காப்புகள் தனி.", "backupNow": "இப்போது காப்பெடு",
  "backupDone": "{{folder}} இல் காப்பு சேமிக்கப்பட்டது", "noBackups": "இன்னும் காப்பு இல்லை.", "latest": "சமீபத்தியது", "files": "{{count}} கோப்புகள்", "securityTitle": "உள்நுழைவு பாதுகாப்பு", "mfaHelp": "நிர்வாகி உள்நுழையும் ஒவ்வொரு முறையும் அங்கீகார செயலியின் குறியீடு கேட்கப்படும்.", "mfaEnrolled": "அங்கீகார செயலி அமைக்கப்பட்டது", "mfaNotEnrolled": "அங்கீகார செயலி அமைக்கப்படவில்லை",
  "mfaVerifyFirst": "செயலியின் குறியீட்டை ஒருமுறை உள்ளிடுங்கள்; பிறகு இதை இயக்கலாம்.", "mfaEnrolFirst": "முதலில் செயலியை அமைக்கவும்.", "mfaRequire": "நிர்வாகிக்கு இரண்டு-படி உள்நுழைவு கட்டாயம்", "passwordRules": "கடவுச்சொல் குறைந்தது 10 எழுத்துகள்: பெரிய எழுத்து, சிறிய எழுத்து, எண் வேண்டும்.",
  "retentionTitle": "பதிவுகள் வைத்திருக்கும் காலம்", "retentionHelp": "பழைய அறிவிப்புகள், அனுப்பிய மின்னஞ்சல்கள், பணிப் பதிவுகள் இத்தனை நாட்களுக்குப் பின் அழிக்கப்படும்.", "retentionFinancial": "விலைப்பட்டியல், பணம், ரசீது, சலான் ஒருபோதும் அழிக்கப்படாது.",
  "retention": {"notifications_days": "படித்த அறிவிப்புகள் (நாட்கள்)", "outbox_days": "அனுப்பிய மின்னஞ்சல்கள் (நாட்கள்)", "cron_runs_days": "பணி வரலாறு (நாட்கள்)", "soft_deleted_days": "நீக்கிய தொடர்புகள் (நாட்கள்)"}},
 "mfa": {"title": "இரண்டாவது படி", "required": "தொடர அங்கீகார செயலியின் குறியீடு தேவை.", "enrolHelp": "அங்கீகார செயலியைப் பயன்படுத்துங்கள் (Google Authenticator, Microsoft Authenticator போன்றவை).", "setUp": "அமை", "scan": "உங்கள் அங்கீகார செயலியில் இதை ஸ்கேன் செய்யுங்கள்.", "qrAlt": "அங்கீகார செயலிக்கான QR குறியீடு", "orType": "அல்லது இந்த விசையை உள்ளிடுங்கள்:",
  "code": "6 இலக்கக் குறியீடு", "codeHint": "செயலியில் இருந்து", "verify": "சரிபார்", "verified": "சரிபார்க்கப்பட்டது", "wrongCode": "அந்தக் குறியீடு செல்லவில்லை. புதியதை முயலுங்கள்.", "failed": "அமைப்பைத் தொடங்க முடியவில்லை."},
 "audit": {"anyone": "யாரும்", "maskedNote": "வங்கி விவரம், அடையாளச் சான்று, சாதன விசைகள் இங்கே எழுதப்படாது: *** என்று காட்டும்."},
}

def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict): merge(dst.setdefault(k, {}), v)
        else: dst[k] = v

for lang, data in (('en', EN), ('ta', TA)):
    p = f'src/i18n/locales/{lang}.json'
    j = json.load(open(p, encoding='utf-8'))
    merge(j, data)
    json.dump(j, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(p, 'a').write('\n')
print('merged')
