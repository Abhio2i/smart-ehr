# Rules Engine - Full Body Checkup (Hinglish Guide)

## Overview (समझिए)

**Rules Engine** एक smart system है जो doctors को automated emails bhej sakta hai patients ko.

**Use Case:**
- Doctor: "Jo bhi patient 50 saal se zyada ho, unhe full body checkup email bhej do"
- System: Automatically sabhi eligible patients ko email bhej dega

## How It Works (कैसे काम करता है?)

### Type 1: PATIENT_SPECIFIC (एक खास patient को)

```
Doctor + Patient Selection
        ↓
System sends Full Body Checkup invitation email
        ↓
Patient receives email at their email address
```

**Example:**
```
Doctor to System: "Rajesh Kumar (patient ID: P123) ko full body checkup invite kar"

System:
1. Rajesh का email ढूंढ लेता है
2. Email भेजता है: "You are invited for PREMIUM Full Body Checkup ASAP"
3. Rajesh अपने patient portal में जाकर appointment book कर सकता है
```

### Type 2: FIELD_BASED (Health criteria के base पर)

```
Define Rule (e.g., Age > 50)
        ↓
System scans ALL patients matching criteria
        ↓
Doctor selects patients from preview
        ↓
Send emails to selected matching patients
```

**Example 1 - Age Based:**
```
Rule: "Age > 50 को Full Body Checkup invite करना"

System automaticaly checks:
✓ Patient 1: Age 52 → Email भेज दो ✓
✓ Patient 2: Age 48 → Skip (rule match नहीं किया)
✓ Patient 3: Age 65 → Email भेज दो ✓
```

**Example 2 - Blood Pressure Based:**
```
Rule: "Systolic BP > 140 को Cardiac Checkup"

System automatically checks:
✓ Patient 1: SBP 145 → Cardiac checkup email भेज दो ✓
✓ Patient 2: SBP 120 → Skip
✓ Patient 3: SBP 160 → Cardiac checkup email भेज दो ✓
```

**Example 3 - Blood Sugar Based:**
```
Rule: "Blood Sugar > 200 को Diabetes Screening"

System automatically checks:
✓ Patient 1: BS 220 → Diabetes checkup email भेज दो ✓
✓ Patient 2: BS 150 → Skip
✓ Patient 3: BS 250 → Diabetes checkup email भेज दो ✓
```

## Available Fields (कौन से health criteria use kar sakte ho?)

**Basic Health Metrics:**
- `age` = उम्र (years में)
- `systolicBp` = बड़ा blood pressure (e.g., 140)
- `diastolicBp` = छोटा blood pressure (e.g., 90)
- `heartRate` = दिल की धड़कन (beats per minute)
- `respirationRate` = सांस की speed
- `temperature` = बुखार
- `weight` = वजन
- `height` = कद
- `spo2` = ऑक्सीजन level (%)
- `bloodSugar` = ब्लड शुगर की मात्रा
- `hemoglobin` = खून में हीमोग्लोबिन

**Patient Info:**
- `patientName` = रोगी का नाम
- `age` = उम्र
- `email` = ईमेल address
- `bloodGroup` = खून का ग्रुप

**Medical History:**
- `comorbidity` = कोई और बीमारी है या नहीं
- `allergy` = किसी चीज़ से एलर्जी है या नहीं

**Incident Info:**
- `incidentType` = किस तरह की सेवा दी गई (Cardiac, Trauma, etc.)
- `primaryImpression` = मुख्य समस्या क्या थी

## Operators (तुलना के संकेत)

| Operator | Matlab | Example |
|----------|--------|---------|
| `>` | से ज्यादा | Age > 50 (50 से ज्यादा उम्र) |
| `<` | से कम | Age < 25 (25 से कम उम्र) |
| `>=` | से ज्यादा या बराबर | Age >= 50 |
| `<=` | से कम या बराबर | Age <= 50 |
| `=` | बराबर है | Age = 50 |
| `!=` | बराबर नहीं है | Age != 50 |

## Checkup Types (कौन से checkup options हैं?)

```
- STANDARD    = सामान्य checkup
- PREMIUM     = विशेष checkup (ज्यादा tests)
- CARDIAC     = दिल की जांच
- GENERAL     = सामान्य स्वास्थ्य
- DIABETES    = शुगर की जांच
```

## Schedule Options (कब करवाना है?)

```
- ASAP              = तुरंत/अभी (आज ही)
- WITHIN_7_DAYS     = 7 दिन में
- WITHIN_30_DAYS    = 30 दिन में
```

## API Endpoints (Postman में कैसे use करें?)

### 1️⃣ Specific Patient को Checkup भेजो

**Endpoint:**
```
POST /api/logic/rules/full-body-checkup
```

**Body (JSON):**
```json
{
  "ruleType": "PATIENT_SPECIFIC",
  "ruleName": "Rajesh Kumar को Premium Checkup",
  "patientId": "patient_123_id_here",
  "checkupType": "PREMIUM",
  "checkupSchedule": "ASAP"
}
```

**क्या होगा:**
- Patient (Rajesh) को email जाएगा
- Subject: "You are invited for a Full Body Checkup - PREMIUM"
- Body: Checkup details + appointment booking link

---

### 2️⃣ Age > 50 वाले सभी patients को भेजो

**Endpoint:**
```
POST /api/logic/rules/full-body-checkup
```

**Body (JSON):**
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "Age 50+ को Standard Checkup",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}
```

**क्या होगा:**
- System database में सभी patients को check करेगा
- जिनकी age > 50, उन सभी को email भेजेगा

---

### 3️⃣ High Blood Pressure वाले को Cardiac Checkup

**Endpoint:**
```
POST /api/logic/rules/full-body-checkup
```

**Body (JSON):**
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "High BP को Cardiac Checkup",
  "field": "systolicBp",
  "operator": ">",
  "threshold": "140",
  "checkupType": "CARDIAC",
  "checkupSchedule": "ASAP"
}
```

**क्या होगा:**
- Systolic BP > 140 वाले सभी patients को email
- Type: CARDIAC (दिल की विस्तृत जांच)
- Schedule: ASAP (तुरंत करवाइए)

---

### 4️⃣ High Blood Sugar वाले को Diabetes Screening

**Endpoint:**
```
POST /api/logic/rules/full-body-checkup
```

**Body (JSON):**
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "High Blood Sugar को Diabetes Screening",
  "field": "bloodSugar",
  "operator": ">",
  "threshold": "200",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_7_DAYS"
}
```

---

### 5️⃣ सभी rules को देखो

**Endpoint:**
```
GET /api/logic/rules
```

**Query Parameter:**
```
organizationId = आपके hospital/clinic की ID
```

**Response मिलेगा:**
```json
[
  {
    "id": "rule_123",
    "name": "Age 50+ को Standard Checkup",
    "ruleType": "FIELD_BASED",
    "field": "age",
    "operator": ">",
    "threshold": "50",
    "action": {
      "type": "FULL_BODY_CHECKUP",
      "checkupType": "STANDARD",
      "checkupSchedule": "WITHIN_30_DAYS"
    },
    "active": true
  }
]
```

---

### 6️⃣ Test करो FIRST - Dry Run (कोई email नहीं जाएंगे)

**Endpoint:**
```
POST /api/logic/run
```

**Body (JSON):**
```json
{
  "dryRun": true,
  "organizationId": "your_org_id",
  "ruleIds": ["rule_123"]
}
```

**क्या होगा:**
- System सभी patients को check करेगा
- कौन से patients match करेंगे, दिखाएगा
- `matches` response से selected `patientId` या `recordId` choose कर सकते हो
- **कोई email नहीं** भेजेगा (सिर्फ preview)

**Response:**
```json
{
  "dryRun": true,
  "evaluatedRecords": 150,
  "evaluatedRules": 4,
  "matchedRules": 23,
  "matches": [
    {
      "ruleId": "rule_123",
      "ruleName": "Age 50+ को Standard Checkup",
      "patientId": "P001",
      "patientName": "Rajesh Kumar",
      "field": "age",
      "value": 52,
      "operator": ">",
      "threshold": "50",
      "actionType": "FULL_BODY_CHECKUP",
      "status": "MATCHED_DRY_RUN"
    }
  ]
}
```

---

### 7️⃣ EXECUTE करो - Selected Patients को Emails भेज दो!

**Endpoint:**
```
POST /api/logic/run
```

**Body (JSON):**
```json
{
  "dryRun": false,
  "organizationId": "your_org_id",
  "ruleIds": ["rule_123"],
  "patientIds": ["P001", "P014"]
}
```

**⚠️ WARNING:**
```
यह API सिर्फ selected matching patients को
ACTUAL EMAILS भेजेगा!

हमेशा पहले dryRun=true से test करो
फिर selected patientIds/recordIds के साथ dryRun=false से execute करो!
```

**Response:**
```json
{
  "dryRun": false,
  "evaluatedRecords": 150,
  "evaluatedRules": 4,
  "matchedRules": 23,
  "matches": [
    {
      "ruleId": "rule_123",
      "ruleName": "Age 50+ को Standard Checkup",
      "patientId": "P001",
      "patientName": "Rajesh Kumar",
      "actionType": "FULL_BODY_CHECKUP",
      "actionExecuted": true,
      "status": "EXECUTED"
    },
    {
      "ruleId": "rule_123",
      "ruleName": "Age 50+ को Standard Checkup",
      "patientId": "P002",
      "patientName": "Neha Sharma",
      "actionType": "FULL_BODY_CHECKUP",
      "actionExecuted": false,
      "status": "MATCHED_NOT_SELECTED"
    }
  ]
}
```

---

### 8️⃣ एक Specific Patient के लिए test करो

**Endpoint:**
```
POST /api/logic/run/patient/{patientId}
```

**Example:**
```
POST /api/logic/run/patient/P001
```

**Body (JSON):**
```json
{
  "dryRun": true
}
```

**क्या होगा:**
- सिर्फ patient P001 के लिए सभी rules check होंगे
- कौन से rules match करते हैं, दिखेगा

---

## Step by Step Example (व्यावहारिक उदाहरण)

### Scenario: Doctor चाहते हैं कि 50+ उम्र वाले सभी patients को checkup invitation दो

**Step 1: Rule बनाओ (Dry Run)**
```
POST /api/logic/rules/full-body-checkup

{
  "ruleType": "FIELD_BASED",
  "ruleName": "50 plus age patients",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}

Response:
{
  "id": "rule_abc123",
  "name": "50 plus age patients",
  "active": true
  ...
}
```

**Step 2: Test करो (कोई email नहीं)**
```
POST /api/logic/run

{
  "dryRun": true,
  "organizationId": "org_xyz"
}

Response:
{
  "dryRun": true,
  "evaluatedRecords": 150,
  "matchedRules": 32,  ← 32 patients match करते हैं
  "matches": [
    {
      "patientId": "P001",
      "patientName": "Rajesh Kumar",
      "age": 52,
      "status": "MATCHED_DRY_RUN"
    },
    {
      "patientId": "P002",
      "patientName": "Priya Singh",
      "age": 55,
      "status": "MATCHED_DRY_RUN"
    },
    ...
  ]
}
```

**Step 3: Confirm कर लो कि सही patients matching हैं**

अगर सब ठीक है, तो:

**Step 4: EXECUTE करो (emails भेज दो)**
```
POST /api/logic/run

{
  "dryRun": false,
  "organizationId": "org_xyz"
}

System automatically sends emails to all 32 matching patients:

Email 1 to rajesh@email.com:
  Subject: You are invited for a Full Body Checkup - STANDARD
  Body: ...checkup details...
  
Email 2 to priya@email.com:
  Subject: You are invited for a Full Body Checkup - STANDARD
  Body: ...checkup details...

... (30 more emails)
```

---

## Email Template (Email कैसा दिखेगा?)

```
Dear Rajesh Kumar,

We are pleased to invite you for a comprehensive Full Body Checkup.

Checkup Type: STANDARD
Recommended Schedule: Within 30 days

A Full Body Checkup includes:
- Complete Blood Test
- Physical Examination
- Vital Signs Assessment
- Health Consultation with our Medical Team

To schedule your appointment, please:
1. Log in to the ePCR Patient Portal
2. Navigate to "Health Checkups" section
3. Select your preferred date and time

If you have any questions or need assistance, 
please contact our customer support team.

Best regards,
Healthcare ePCR Team
```

---

## Important Notes (ध्यान दिए जाने वाली बातें)

### ✅ करो:
1. **हमेशा dry run से पहले test करो** (dryRun=true)
2. **सही field names use करो** (age, systolicBp, etc.)
3. **सही operators लगाओ** (>, <, =, !=, etc.)
4. **realistic thresholds रखो** (Age > 150 obviously wrong है)

### ❌ मत करो:
1. सीधे dryRun=false न करो बिना testing के
2. गलत field names न use करो
3. सभी patients को random checkup न भेजो (spam लगेगा)

---

## Multi-Condition Rules (Multiple conditions के साथ rule)

**Future Enhancement:** अगर आप चाहते हो कि multiple conditions के साथ rule बना सको:
```
"Age > 50 AND Systolic BP > 140" 
→ तो Cardiac Checkup भेज दो
```

यह अभी advanced feature है, लेकिन add किया जा सकता है।

---

## Support / Troubleshooting

### Problem: Rule बनाने में error आ रहा है

**Solution:**
```
1. Check करो कि field name सही है
2. Operator correct है (>, <, >=, <=, =, !=)
3. Threshold एक valid number/value है
```

### Problem: Dry run shows 0 matches

**Possible Reasons:**
1. कोई भी patient rule criteria को satisfy नहीं कर रहा
2. Field name गलत है
3. Threshold बहुत strict है

### Problem: Emails नहीं जा रहे हैं

**Check करो:**
1. Patient का email address registered है या नहीं
2. Email service properly configured है या नहीं
3. Organization ID सही है या नहीं

---

## Summary

**Rules Engine से क्या कर सकते हो:**

| Scenario | कैसे करो |
|----------|----------|
| 1 specific patient को invitation | PATIENT_SPECIFIC rule बना |
| सभी 50+ age patients को | Age > 50 का rule banaao |
| High BP वाले को Cardiac checkup | systolicBp > 140 rule बनाओ |
| High sugar patients | bloodSugar > 200 rule बनाओ |
| Multiple ages को | अलग अलग rules बनाओ (e.g., 30-40, 40-50, 50+) |

**Key Points:**
1. 🎯 Target specific patients OR health-based criteria
2. 📧 Automated emails भेजो
3. ✅ Dry run से पहले test करो
4. ⚠️ फिर execute करो
5. 📊 Results track करो

Happy rule making! 🎉

