# -*- coding: utf-8 -*-
# Adds the Phase 4 (cold chain) strings to en.json and ta.json. Safe to re-run.
import json

EN = {
 "nav": {"coldChain": "Live Cold Chain", "manualReading": "Manual Reading", "alerts": "Alerts", "sensors": "Sensors", "alertRules": "Alert Rules", "equipment": "Equipment", "coldReports": "Temperature Reports"},
 "cold": {
  "liveTitle": "Live cold chain", "liveSubtitle": "Current temperature of every zone. Figures update by themselves; each shows when it was last updated.", "noZones": "No zones in this warehouse.",
  "gapNote": "A gap in a line means no data was received for that time.", "target": "Target", "noData": "No data", "neverReported": "Never reported", "updated": "Updated", "ago": "ago", "staleWarning": "data is stale", "lastSeen": "Last seen", "offline": "Offline",
  "openAlerts": "{{count}} open alert(s)", "openAlertsTitle": "Open alerts", "needsAttention": "Sensors needing attention", "allSensorsOk": "All sensors are reporting and calibrated.", "calibrationDue": "Calibration due",
  "status": {"OK": "OK", "WARNING": "Warning", "CRITICAL": "Critical", "OFFLINE": "Offline", "NO_SENSOR": "No sensor"},
  "kind": {"TEMP_HIGH": "Temperature too high", "TEMP_LOW": "Temperature too low", "OFFLINE": "Sensor offline", "DOOR_OPEN": "Door open too long", "POWER_FAILURE": "Power failure", "COMPRESSOR_FAULT": "Compressor fault", "HUMIDITY": "Humidity out of range", "CALIBRATION_DUE": "Calibration due", "BATTERY_LOW": "Battery low"},
  "severity": {"WARNING": "Warning", "CRITICAL": "Critical"}, "alertStatus": {"OPEN": "Open", "ACKNOWLEDGED": "Acknowledged", "RESOLVED": "Resolved"}, "noticeStatus": {"DRAFT": "Waiting for approval", "APPROVED": "Approved and sent", "REJECTED": "Not sent"},
  "view": {"open": "Open alerts", "all": "All alerts"}, "recovered": "Back in range", "noAlerts": "No alerts.", "since": "Since", "peak": "peak", "stillActive": "still active", "acknowledge": "Acknowledge", "acknowledged": "Alert acknowledged",
  "resolve": "Resolve", "resolved": "Alert resolved", "resolveTitle": "Resolve alert", "resolveHelp": "Write what caused it and what was done. This stays in the record.", "cause": "Cause", "actionTaken": "Action taken",
  "linkEquipment": "Equipment at fault", "linkEquipmentHelp": "If a machine caused it, link it so its service history shows the fault.", "createTask": "Create a repair task", "dueDate": "Due date",
  "alertsTitle": "Alerts", "alert": "Alert", "timeline": "Timeline", "evStart": "Event start (first reading out of range)", "evOpened": "Alert opened", "evEscalated": "Escalated (level {{level}})", "evAck": "Acknowledged", "evRecovered": "Readings back in range", "evResolved": "Resolved",
  "peakValue": "Peak value", "peakDeviation": "Beyond the limit by", "duration": "Duration", "limit": "Limit", "affectedStock": "Affected stock", "noAffected": "No client stock was in this zone during the event.",
  "clientNotices": "Client notices", "reviewApprove": "Review and approve", "rejectNotice": "Do not send", "approveSend": "Approve and send", "subject": "Subject", "message": "Message", "noticeHelp": "A client is told only when its stock was affected, and only after a manager approves the wording.",
  "evidencePack": "Evidence pack (PDF)",
  "zone": "Zone", "badRange": "The end must be after the start.", "noDataRange": "No data for this period.", "legendBand": "Allowed range", "legendDoor": "Door open", "legendAlert": "Alert", "alertsInRange": "Alerts in this period",
  "sensorsTitle": "Sensors", "addSensor": "Add sensor", "editSensor": "Edit sensor", "serial": "Serial number", "serialHelp": "The code the device sends (printed on it).", "sensorType": "Type", "installedOn": "Installed on", "noSensors": "No sensors yet.", "manualSensor": "Manual readings",
  "type": {"TEMPERATURE": "Temperature", "HUMIDITY": "Humidity", "DOOR": "Door", "POWER": "Power", "COMPRESSOR": "Compressor"}, "sensorStatus": {"ACTIVE": "Active", "OFFLINE": "Offline", "FAULTY": "Faulty", "RETIRED": "Retired"},
  "keys": "Keys", "deviceKeys": "Device keys", "newSensorKey": "New key for this sensor", "newGatewayKey": "New gateway key (whole warehouse)", "keyShownOnce": "Copy this key now. It is shown only once and cannot be recovered.", "keyLabel": "Label", "keyPrefix": "Key", "scope": "Valid for",
  "thisSensor": "This sensor", "wholeWarehouse": "Whole warehouse", "lastUsed": "Last used", "revoked": "Revoked", "rotate": "Rotate", "revoke": "Revoke", "keyRevoked": "Key revoked", "noKeys": "No keys yet.",
  "calibration": "Calibration", "calibrate": "Calibrate", "calibrationHelp": "Compare the sensor with a reference thermometer. The difference is applied to every new reading; the raw value is kept too.", "currentOffset": "Current offset", "nextDue": "Next calibration due", "nextDueHelp": "Blank = one year after this date (setting).",
  "referenceReading": "Reference thermometer (°C)", "sensorReading": "Sensor shows (°C)", "rawHelp": "The raw value the sensor reports.", "offsetApplied": "Offset applied", "certificate": "Certificate", "calibrationSaved": "Calibration saved",
  "manualTitle": "Manual temperature reading", "manualHelp": "Use this while sensors are not installed. It feeds alerts and reports like a sensor.", "temperature": "Temperature", "minusHelp": "Tap − for temperatures below zero.", "toggleMinus": "Below zero",
  "impossibleValue": "That temperature is not possible (−60 to 80 °C).", "outsideRangeWarn": "This is outside the zone's range. Saving it will raise an alert.", "photo": "Photo", "takePhoto": "Take or choose a photo", "saveReading": "Save reading", "readingSaved": "Reading saved", "recentManual": "Recent manual readings",
  "rulesTitle": "Alert rules", "rulesHelp": "Tolerance, delays and levels for each zone. Blank fields use the defaults.", "zoneRange": "Zone range", "rulesDefaultNote": "Blank limits use the zone's own range.", "default": "default", "from": "From", "to": "To",
  "rule": {"enabled": "Alerts enabled for this zone", "minTemp": "Lowest allowed (°C)", "maxTemp": "Highest allowed (°C)", "fromZone": "Blank = the zone's own limit", "off": "off", "tolerance": "Tolerance", "delay": "Delay before an alert", "criticalDeviation": "CRITICAL beyond limit by",
   "criticalAfter": "CRITICAL after", "recovery": "Back in range for (to close)", "offlineAfter": "Sensor offline after", "doorOpen": "Door open longer than", "humidityMin": "Humidity minimum", "humidityMax": "Humidity maximum", "humidityDelay": "Humidity delay", "battery": "Battery low below", "calWarn": "Calibration warning", "ackMin": "Escalate if not acknowledged within"},
  "defrostTitle": "Defrost windows", "defrostHelp": "High readings inside these India-time windows are ignored.", "noDefrost": "No defrost windows.", "addWindow": "Add window",
  "equipmentTitle": "Equipment and maintenance", "tab": {"tasks": "Maintenance tasks", "equipment": "Equipment"}, "addEquipment": "Add equipment", "editEquipment": "Edit equipment", "equipType": "Type", "equipment": "Equipment",
  "equipTypes": {"CHILLER": "Chiller", "COMPRESSOR": "Compressor", "GENERATOR": "Generator", "FORKLIFT": "Forklift", "RACK": "Rack", "OTHER": "Other"}, "vendor": "Vendor", "vendorPhone": "Vendor phone", "warrantyEnd": "Warranty ends", "serviceInterval": "Service every (days)", "serviceIntervalHelp": "The next task is scheduled when one is completed.",
  "lastService": "Last service", "nextService": "Next service", "history": "History", "noEquipment": "No equipment yet.", "addTask": "Add task", "taskTitle": "Task", "assignedTo": "Assigned to", "noTasks": "No maintenance tasks.",
  "taskStatus": {"OPEN": "Open", "IN_PROGRESS": "In progress", "DONE": "Done", "CANCELLED": "Cancelled"}, "fromAlert": "From an alert", "overdue": "Overdue", "startTask": "Start", "markDone": "Mark done", "completeTask": "Complete task", "taskDone": "Task completed", "photos": "Photos",
  "reportsTitle": "Temperature reports", "reportTab": {"client": "Client temperature", "excursions": "Excursions", "daily": "Daily log sheet", "calibration": "Calibration register", "alerts": "Alert register"},
  "runReport": "Run report", "clientReportHelp": "Shows only the zones and days this client's stock was stored there. Out of range is measured against the zone limits.", "zonesAndTemps": "Zones and temperatures", "stockThere": "Stock there", "outOfRange": "Out of range", "coverage": "Data coverage",
  "noStockPeriod": "No stock was stored in any zone in this period.", "lorryTemps": "Lorry temperatures", "arrival": "arrival", "dispatch": "dispatch", "noLorry": "No lorry temperatures in this period.", "hour": "Hour",
  "notifications": "Notifications", "noNotifications": "No notifications."
 }
}
TA = {
 "nav": {"coldChain": "நேரடி குளிர் சங்கிலி", "manualReading": "கைமுறை அளவீடு", "alerts": "எச்சரிக்கைகள்", "sensors": "உணரிகள்", "alertRules": "எச்சரிக்கை விதிகள்", "equipment": "உபகரணங்கள்", "coldReports": "வெப்பநிலை அறிக்கைகள்"},
 "cold": {
  "liveTitle": "நேரடி குளிர் சங்கிலி", "liveSubtitle": "ஒவ்வொரு மண்டலத்தின் தற்போதைய வெப்பநிலை. எண்கள் தானாகப் புதுப்பிக்கப்படும்; ஒவ்வொன்றும் கடைசியாகப் புதுப்பித்த நேரத்தைக் காட்டும்.", "noZones": "இந்தக் கிடங்கில் மண்டலங்கள் இல்லை.",
  "gapNote": "கோட்டில் இடைவெளி என்றால் அந்த நேரத்துக்குத் தரவு வரவில்லை.", "target": "இலக்கு", "noData": "தரவு இல்லை", "neverReported": "இதுவரை தகவல் இல்லை", "updated": "புதுப்பிப்பு", "ago": "முன்", "staleWarning": "தரவு பழையது", "lastSeen": "கடைசியாகப் பார்த்தது", "offline": "இணைப்பில்லை",
  "openAlerts": "{{count}} திறந்த எச்சரிக்கை(கள்)", "openAlertsTitle": "திறந்த எச்சரிக்கைகள்", "needsAttention": "கவனம் தேவைப்படும் உணரிகள்", "allSensorsOk": "அனைத்து உணரிகளும் தகவல் அனுப்புகின்றன, அளவுதிருத்தம் சரி.", "calibrationDue": "அளவுதிருத்தம் தேவை",
  "status": {"OK": "சரி", "WARNING": "எச்சரிக்கை", "CRITICAL": "அவசரம்", "OFFLINE": "இணைப்பில்லை", "NO_SENSOR": "உணரி இல்லை"},
  "kind": {"TEMP_HIGH": "வெப்பநிலை அதிகம்", "TEMP_LOW": "வெப்பநிலை குறைவு", "OFFLINE": "உணரி இணைப்பில்லை", "DOOR_OPEN": "கதவு நீண்ட நேரம் திறந்துள்ளது", "POWER_FAILURE": "மின்தடை", "COMPRESSOR_FAULT": "கம்ப்ரசர் கோளாறு", "HUMIDITY": "ஈரப்பதம் வரம்பு மீறல்", "CALIBRATION_DUE": "அளவுதிருத்தம் தேவை", "BATTERY_LOW": "பேட்டரி குறைவு"},
  "severity": {"WARNING": "எச்சரிக்கை", "CRITICAL": "அவசரம்"}, "alertStatus": {"OPEN": "திறந்தது", "ACKNOWLEDGED": "ஏற்கப்பட்டது", "RESOLVED": "தீர்க்கப்பட்டது"}, "noticeStatus": {"DRAFT": "ஒப்புதலுக்குக் காத்திருக்கிறது", "APPROVED": "ஒப்புதல் அளித்து அனுப்பப்பட்டது", "REJECTED": "அனுப்பப்படவில்லை"},
  "view": {"open": "திறந்த எச்சரிக்கைகள்", "all": "அனைத்து எச்சரிக்கைகள்"}, "recovered": "வரம்புக்குத் திரும்பியது", "noAlerts": "எச்சரிக்கைகள் இல்லை.", "since": "முதல்", "peak": "உச்சம்", "stillActive": "இன்னும் நீடிக்கிறது", "acknowledge": "ஏற்றுக்கொள்", "acknowledged": "எச்சரிக்கை ஏற்கப்பட்டது",
  "resolve": "தீர்", "resolved": "எச்சரிக்கை தீர்க்கப்பட்டது", "resolveTitle": "எச்சரிக்கையைத் தீர்", "resolveHelp": "காரணம் என்ன, என்ன செய்யப்பட்டது என எழுதவும். இது பதிவில் இருக்கும்.", "cause": "காரணம்", "actionTaken": "எடுத்த நடவடிக்கை",
  "linkEquipment": "கோளாறான உபகரணம்", "linkEquipmentHelp": "இயந்திரம் காரணம் என்றால் இணைக்கவும்; அதன் சேவை வரலாற்றில் கோளாறு தெரியும்.", "createTask": "பழுதுநீக்கும் பணியை உருவாக்கு", "dueDate": "செய்ய வேண்டிய தேதி",
  "alertsTitle": "எச்சரிக்கைகள்", "alert": "எச்சரிக்கை", "timeline": "காலவரிசை", "evStart": "நிகழ்வு தொடக்கம் (வரம்பு மீறிய முதல் அளவீடு)", "evOpened": "எச்சரிக்கை திறக்கப்பட்டது", "evEscalated": "மேல்நிலைக்கு அனுப்பப்பட்டது (நிலை {{level}})", "evAck": "ஏற்கப்பட்டது", "evRecovered": "அளவீடுகள் வரம்புக்குத் திரும்பின", "evResolved": "தீர்க்கப்பட்டது",
  "peakValue": "உச்ச மதிப்பு", "peakDeviation": "வரம்பை மீறியது", "duration": "கால அளவு", "limit": "வரம்பு", "affectedStock": "பாதிக்கப்பட்ட இருப்பு", "noAffected": "நிகழ்வின் போது இந்த மண்டலத்தில் வாடிக்கையாளர் இருப்பு இல்லை.",
  "clientNotices": "வாடிக்கையாளர் அறிவிப்புகள்", "reviewApprove": "சரிபார்த்து ஒப்புதல் அளி", "rejectNotice": "அனுப்ப வேண்டாம்", "approveSend": "ஒப்புதல் அளித்து அனுப்பு", "subject": "பொருள்", "message": "செய்தி", "noticeHelp": "இருப்பு பாதிக்கப்பட்ட வாடிக்கையாளருக்கு மட்டுமே, மேலாளர் வாசகத்தை ஒப்புதல் அளித்த பின்னரே தெரிவிக்கப்படும்.",
  "evidencePack": "சான்று தொகுப்பு (PDF)",
  "zone": "மண்டலம்", "badRange": "முடிவு, தொடக்கத்துக்குப் பின் இருக்க வேண்டும்.", "noDataRange": "இந்தக் காலத்துக்குத் தரவு இல்லை.", "legendBand": "அனுமதிக்கப்பட்ட வரம்பு", "legendDoor": "கதவு திறந்துள்ளது", "legendAlert": "எச்சரிக்கை", "alertsInRange": "இந்தக் காலத்தின் எச்சரிக்கைகள்",
  "sensorsTitle": "உணரிகள்", "addSensor": "உணரியைச் சேர்", "editSensor": "உணரியைத் திருத்து", "serial": "வரிசை எண்", "serialHelp": "சாதனம் அனுப்பும் குறியீடு (அதில் அச்சிடப்பட்டிருக்கும்).", "sensorType": "வகை", "installedOn": "நிறுவிய தேதி", "noSensors": "இன்னும் உணரிகள் இல்லை.", "manualSensor": "கைமுறை அளவீடுகள்",
  "type": {"TEMPERATURE": "வெப்பநிலை", "HUMIDITY": "ஈரப்பதம்", "DOOR": "கதவு", "POWER": "மின்சாரம்", "COMPRESSOR": "கம்ப்ரசர்"}, "sensorStatus": {"ACTIVE": "செயலில்", "OFFLINE": "இணைப்பில்லை", "FAULTY": "பழுது", "RETIRED": "ஓய்வு"},
  "keys": "சாவிகள்", "deviceKeys": "சாதனச் சாவிகள்", "newSensorKey": "இந்த உணரிக்குப் புதிய சாவி", "newGatewayKey": "புதிய நுழைவாயில் சாவி (முழு கிடங்கு)", "keyShownOnce": "இந்தச் சாவியை இப்போதே நகலெடுக்கவும். இது ஒரே முறைதான் காட்டப்படும்; மீட்க முடியாது.", "keyLabel": "பெயர்", "keyPrefix": "சாவி", "scope": "செல்லுபடியாகும் இடம்",
  "thisSensor": "இந்த உணரி", "wholeWarehouse": "முழு கிடங்கு", "lastUsed": "கடைசிப் பயன்பாடு", "revoked": "ரத்து", "rotate": "மாற்று", "revoke": "ரத்து செய்", "keyRevoked": "சாவி ரத்து செய்யப்பட்டது", "noKeys": "இன்னும் சாவிகள் இல்லை.",
  "calibration": "அளவுதிருத்தம்", "calibrate": "அளவுதிருத்து", "calibrationHelp": "உணரியை ஒரு குறிப்பு வெப்பமானியுடன் ஒப்பிடவும். வித்தியாசம் ஒவ்வொரு புதிய அளவீட்டுக்கும் சேர்க்கப்படும்; மூல மதிப்பும் சேமிக்கப்படும்.", "currentOffset": "தற்போதைய வித்தியாசம்", "nextDue": "அடுத்த அளவுதிருத்தம்", "nextDueHelp": "காலியாக இருந்தால் இந்தத் தேதியிலிருந்து ஓராண்டு (அமைப்பு).",
  "referenceReading": "குறிப்பு வெப்பமானி (°C)", "sensorReading": "உணரி காட்டுவது (°C)", "rawHelp": "உணரி அனுப்பும் மூல மதிப்பு.", "offsetApplied": "சேர்க்கப்பட்ட வித்தியாசம்", "certificate": "சான்றிதழ்", "calibrationSaved": "அளவுதிருத்தம் சேமிக்கப்பட்டது",
  "manualTitle": "கைமுறை வெப்பநிலை அளவீடு", "manualHelp": "உணரிகள் நிறுவப்படாத போது இதைப் பயன்படுத்தவும். உணரியைப் போலவே எச்சரிக்கைகளுக்கும் அறிக்கைகளுக்கும் செல்லும்.", "temperature": "வெப்பநிலை", "minusHelp": "பூஜ்ஜியத்துக்குக் கீழ் என்றால் − அழுத்தவும்.", "toggleMinus": "பூஜ்ஜியத்துக்குக் கீழ்",
  "impossibleValue": "இந்த வெப்பநிலை சாத்தியமில்லை (−60 முதல் 80 °C).", "outsideRangeWarn": "இது மண்டல வரம்புக்கு வெளியே உள்ளது. சேமித்தால் எச்சரிக்கை எழும்.", "photo": "புகைப்படம்", "takePhoto": "புகைப்படம் எடுக்கவும் அல்லது தேர்ந்தெடுக்கவும்", "saveReading": "அளவீட்டைச் சேமி", "readingSaved": "அளவீடு சேமிக்கப்பட்டது", "recentManual": "சமீபத்திய கைமுறை அளவீடுகள்",
  "rulesTitle": "எச்சரிக்கை விதிகள்", "rulesHelp": "ஒவ்வொரு மண்டலத்துக்கும் சகிப்பு, தாமதம், நிலைகள். காலியாக விட்டால் இயல்புகள் பயன்படும்.", "zoneRange": "மண்டல வரம்பு", "rulesDefaultNote": "காலி வரம்புகள் மண்டலத்தின் சொந்த வரம்பைப் பயன்படுத்தும்.", "default": "இயல்பு", "from": "முதல்", "to": "வரை",
  "rule": {"enabled": "இந்த மண்டலத்துக்கு எச்சரிக்கைகள் இயக்கத்தில்", "minTemp": "குறைந்தபட்சம் (°C)", "maxTemp": "அதிகபட்சம் (°C)", "fromZone": "காலி = மண்டலத்தின் சொந்த வரம்பு", "off": "இல்லை", "tolerance": "சகிப்பு", "delay": "எச்சரிக்கைக்கு முன் தாமதம்", "criticalDeviation": "வரம்பை இவ்வளவு மீறினால் அவசரம்",
   "criticalAfter": "இதற்குப் பின் அவசரம்", "recovery": "மூட, வரம்புக்குள் இருக்க வேண்டிய நேரம்", "offlineAfter": "இதற்குப் பின் உணரி இணைப்பில்லை", "doorOpen": "கதவு இதைவிட அதிகம் திறந்தால்", "humidityMin": "ஈரப்பதம் குறைந்தபட்சம்", "humidityMax": "ஈரப்பதம் அதிகபட்சம்", "humidityDelay": "ஈரப்பதத் தாமதம்", "battery": "பேட்டரி இதற்குக் கீழ்", "calWarn": "அளவுதிருத்த எச்சரிக்கை", "ackMin": "இதற்குள் ஏற்காவிட்டால் மேல்நிலைக்கு"},
  "defrostTitle": "பனி நீக்க நேரங்கள்", "defrostHelp": "இந்திய நேரத்தில் இந்த நேரங்களுக்குள் உயர் அளவீடுகள் புறக்கணிக்கப்படும்.", "noDefrost": "பனி நீக்க நேரங்கள் இல்லை.", "addWindow": "நேரத்தைச் சேர்",
  "equipmentTitle": "உபகரணமும் பராமரிப்பும்", "tab": {"tasks": "பராமரிப்புப் பணிகள்", "equipment": "உபகரணங்கள்"}, "addEquipment": "உபகரணம் சேர்", "editEquipment": "உபகரணத்தைத் திருத்து", "equipType": "வகை", "equipment": "உபகரணம்",
  "equipTypes": {"CHILLER": "சில்லர்", "COMPRESSOR": "கம்ப்ரசர்", "GENERATOR": "ஜெனரேட்டர்", "FORKLIFT": "ஃபோர்க்லிஃப்ட்", "RACK": "ரேக்", "OTHER": "மற்றவை"}, "vendor": "விற்பனையாளர்", "vendorPhone": "விற்பனையாளர் தொலைபேசி", "warrantyEnd": "உத்தரவாதம் முடிவு", "serviceInterval": "ஒவ்வொரு (நாட்கள்) சேவை", "serviceIntervalHelp": "ஒன்றை முடித்ததும் அடுத்த பணி தானாக அமைக்கப்படும்.",
  "lastService": "கடைசி சேவை", "nextService": "அடுத்த சேவை", "history": "வரலாறு", "noEquipment": "இன்னும் உபகரணங்கள் இல்லை.", "addTask": "பணியைச் சேர்", "taskTitle": "பணி", "assignedTo": "ஒதுக்கப்பட்டவர்", "noTasks": "பராமரிப்புப் பணிகள் இல்லை.",
  "taskStatus": {"OPEN": "திறந்தது", "IN_PROGRESS": "நடைபெறுகிறது", "DONE": "முடிந்தது", "CANCELLED": "ரத்து"}, "fromAlert": "எச்சரிக்கையிலிருந்து", "overdue": "காலம் கடந்தது", "startTask": "தொடங்கு", "markDone": "முடிந்தது எனக் குறி", "completeTask": "பணியை முடி", "taskDone": "பணி முடிந்தது", "photos": "புகைப்படங்கள்",
  "reportsTitle": "வெப்பநிலை அறிக்கைகள்", "reportTab": {"client": "வாடிக்கையாளர் வெப்பநிலை", "excursions": "வரம்பு மீறல்கள்", "daily": "தினசரிப் பதிவுத்தாள்", "calibration": "அளவுதிருத்தப் பதிவேடு", "alerts": "எச்சரிக்கைப் பதிவேடு"},
  "runReport": "அறிக்கையை இயக்கு", "clientReportHelp": "இந்த வாடிக்கையாளரின் இருப்பு சேமிக்கப்பட்ட மண்டலங்களையும் நாட்களையும் மட்டுமே காட்டும். வரம்பு மீறல் மண்டல வரம்புகளை வைத்து அளக்கப்படும்.", "zonesAndTemps": "மண்டலங்களும் வெப்பநிலைகளும்", "stockThere": "அங்கிருந்த இருப்பு", "outOfRange": "வரம்புக்கு வெளியே", "coverage": "தரவு உள்ளடக்கம்",
  "noStockPeriod": "இந்தக் காலத்தில் எந்த மண்டலத்திலும் இருப்பு சேமிக்கப்படவில்லை.", "lorryTemps": "லாரி வெப்பநிலைகள்", "arrival": "வருகை", "dispatch": "அனுப்புதல்", "noLorry": "இந்தக் காலத்தில் லாரி வெப்பநிலைகள் இல்லை.", "hour": "மணி",
  "notifications": "அறிவிப்புகள்", "noNotifications": "அறிவிப்புகள் இல்லை."
 }
}

def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict): merge(dst.setdefault(k, {}), v)
        else: dst[k] = v

for lang, data in (("en", EN), ("ta", TA)):
    p = f"src/i18n/locales/{lang}.json"
    cur = json.load(open(p, encoding="utf-8"))
    merge(cur, data)
    json.dump(cur, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(p, "a").write("\n")
print("merged")
