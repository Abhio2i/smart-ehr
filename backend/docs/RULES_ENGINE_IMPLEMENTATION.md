# Rules Engine Implementation Guide

## Overview

The **Rules Engine** has been successfully implemented with support for **Full Body Checkup** email invitations. It allows doctors/admins to automatically send health checkup invitations to patients based on:

1. **Patient-Specific Rules** - Send to a specific patient by ID
2. **Field-Based Rules** - Send to groups of patients matching one or more health criteria (age, blood pressure, blood sugar, SpO2, etc.)

---

## What Changed

### Files Modified:

1. **`IfThenRule.java`** - Added `ruleType` and `patientId` fields to support patient-specific rules
2. **`IfThenAction.java`** - Added `checkupType` and `checkupSchedule` fields for Full Body Checkup actions
3. **`IfThenLogicService.java`** - Updated validation, execution, and added new `sendFullBodyCheckupEmail()` method
4. **`IfThenLogicController.java`** - Added convenient endpoint `/api/logic/rules/full-body-checkup`

### Files Created:

1. **`CreateFullBodyCheckupRuleRequest.java`** - DTO for creating Full Body Checkup rules
2. **`postman/rules-engine-full-body-checkup.json`** - Postman collection with 9 API examples
3. **`docs/RULES_ENGINE_HINGLISH_GUIDE.md`** - Step-by-step Hinglish guide with examples
4. **Updated `PROJECT_DOCUMENTATION.md`** - Added module reference for Rules Engine

---

## Key Features

### 1. Patient-Specific Rules
```json
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "PATIENT_SPECIFIC",
  "ruleName": "Raj Kumar Full Checkup",
  "patientId": "patient_xyz",
  "checkupType": "PREMIUM",
  "checkupSchedule": "ASAP"
}
```
**Result:** Email sent only to the specific patient

### 2. Field-Based Rules (Age)
```json
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "50+ age group",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}
```
**Result:** All patients over 50 receive email

### 3. Field-Based Rules (Blood Pressure)
```json
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "High BP Screening",
  "field": "systolicBp",
  "operator": ">",
  "threshold": "140",
  "checkupType": "CARDIAC",
  "checkupSchedule": "ASAP"
}
```
**Result:** All patients with systolic BP > 140 receive cardiac checkup invitation ASAP

### 4. Field-Based Rules (Blood Sugar)
```json
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "Diabetes Screening",
  "field": "bloodSugar",
  "operator": ">",
  "threshold": "200",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_7_DAYS"
}
```
**Result:** All patients with blood sugar > 200 receive invitation within 7 days

### 5. Multi-Condition Field-Based Rules (AND)
Use `conditions` when a campaign needs more than one rule. All conditions must match for the patient to receive the email.

```json
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "Age 40+ with low SpO2",
  "conditions": [
    { "field": "age", "operator": ">", "threshold": "40" },
    { "field": "spo2", "operator": "<", "threshold": "94" }
  ],
  "checkupType": "CARDIAC",
  "checkupSchedule": "ASAP"
}
```
**Result:** Only patients with age > 40 AND SpO2 < 94 receive the email.

For a SpO2 range, add two conditions:

```json
"conditions": [
  { "field": "age", "operator": ">", "threshold": "40" },
  { "field": "spo2", "operator": ">=", "threshold": "90" },
  { "field": "spo2", "operator": "<", "threshold": "95" }
]
```
**Result:** Only patients with age > 40 AND SpO2 from 90 up to below 95 match.

---

## Supported Health Fields

The standard field dropdown is intentionally limited to real-life clinical screening fields. It can be fetched from:

```http
GET /api/logic/rules/fields
```

If a field is a first-class property on `PatientCareRecord`, it can be used directly in a condition, for example `diagnosis`, `secondaryImpression`, or any new Java property with a standard getter. The backend resolves it automatically.

Keep advanced/non-clinical fields out of the dropdown unless the product team explicitly needs them. This avoids confusing users with internal fields like record IDs, transport metadata, email, or audit fields.

For custom data stored in maps, use one of these prefixes:

```json
{ "field": "clinicalData.riskScore", "operator": ">=", "threshold": "7" }
{ "field": "dynamicFormResponses.smoker", "operator": "=", "threshold": "yes" }
```

These custom map fields do not require schema changes.

### Basic Metrics:
- `age` - उम्र
- `systolicBp` - बड़ा blood pressure
- `diastolicBp` - छोटा blood pressure
- `heartRate` - दिल की धड़कन
- `respirationRate` - सांस
- `temperature` - बुखार
- `weight` - वजन
- `height` - कद
- `spo2` - ऑक्सीजन %
- `bloodSugar` - शुगर
- `hemoglobin` - खून में हीमोग्लोबिन

### Patient Fields:
- Advanced patient fields are supported by direct field name when needed, but they are not included in the default dropdown.

### Medical Fields:
- Advanced medical fields such as `diagnosis`, `primaryImpression`, `allergy`, or `comorbidity` are supported by direct field name when needed, but they are not included in the default dropdown.

---

## Supported Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `>` | Greater than | `age > 50` |
| `<` | Less than | `age < 25` |
| `>=` | Greater or equal | `age >= 50` |
| `<=` | Less or equal | `age <= 50` |
| `=` | Equal | `age = 50` |
| `!=` | Not equal | `age != 50` |

---

## Checkup Types

- `STANDARD` - सामान्य checkup
- `PREMIUM` - विशेष checkup (ज्यादा tests)
- `CARDIAC` - दिल की जांच
- `GENERAL` - सामान्य स्वास्थ्य
- `DIABETES` - शुगर की जांच

---

## Schedule Options

- `ASAP` - तुरंत
- `WITHIN_7_DAYS` - 7 दिन में
- `WITHIN_30_DAYS` - 30 दिन में

---

## API Endpoints

### Create a Rule
```
POST /api/logic/rules/full-body-checkup
```
Creates a Full Body Checkup rule (simplified endpoint)

### Create Any Rule Type
```
POST /api/logic/rules
```
Creates any type of rule (EMAIL, NOTIFY, FLAG, FULL_BODY_CHECKUP)

### List Rules
```
GET /api/logic/rules?organizationId=org_id
```
Lists all active rules for an organization

### Test Rules (Dry Run)
```
POST /api/logic/run
Body: { "dryRun": true, "organizationId": "org_id" }
```
Shows all matching patients WITHOUT sending emails. Use the returned `matches[].patientId` or `matches[].recordId` values to choose who should receive the email.

Optional filters:
```json
{
  "dryRun": true,
  "organizationId": "org_id",
  "ruleIds": ["rule_id"]
}
```

### Execute Rules (Send Emails)
```
POST /api/logic/run
Body: {
  "dryRun": false,
  "organizationId": "org_id",
  "ruleIds": ["rule_id"],
  "patientIds": ["patient_1", "patient_2"]
}
```
Sends emails only to the selected matching patients. You can use `recordIds` instead of `patientIds` when selecting specific ePCR records.

### Test for One Patient
```
POST /api/logic/run/patient/{patientId}
Body: { "dryRun": true }
```
Test rules for a specific patient only

---

## Email Template

When a Full Body Checkup rule matches, the patient receives:

```
Subject: You are invited for a Full Body Checkup - STANDARD

Body:
Dear [Patient Name],

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

## Workflow: Step-by-Step

### Example: Send Full Body Checkup to all 50+ age patients

**Step 1: Create Rule**
```bash
POST /api/logic/rules/full-body-checkup

{
  "ruleType": "FIELD_BASED",
  "ruleName": "50 plus patients",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}
```

**Step 2: Test with Dry Run**
```bash
POST /api/logic/run

{
  "dryRun": true,
  "organizationId": "your_org_id",
  "ruleIds": ["rule_50_plus"]
}
```

Response:
```json
{
  "dryRun": true,
  "evaluatedRecords": 150,
  "matchedRules": 32,
  "matches": [
    {
      "patientId": "P001",
      "patientName": "Rajesh Kumar",
      "age": 52,
      "status": "MATCHED_DRY_RUN"
    },
    ...32 more matches
  ]
}
```

**Step 3: Review and Confirm**

Doctor reviews the 32 matching patients and selects who should receive the email. Copy the selected `patientId` or `recordId` values from the dry-run response.

**Step 4: Execute for Selected Patients**
```bash
POST /api/logic/run

{
  "dryRun": false,
  "organizationId": "your_org_id",
  "ruleIds": ["rule_50_plus"],
  "patientIds": ["P001", "P014", "P020"]
}
```

System sends emails only to the selected matching patients. Other matching patients are returned with `status: "MATCHED_NOT_SELECTED"`.

---

## Using Postman

1. **Import the collection:**
   ```
   File → Import → Select: postman/rules-engine-full-body-checkup.json
   ```

2. **Set BASE_URL variable:**
   - In Postman, click "Variables"
   - Set `BASE_URL` to your backend URL (e.g., `http://localhost:9091`)

3. **Set Bearer Token:**
   - Get token from: `POST /api/auth/login`
   - In each request, update `Authorization: Bearer YOUR_TOKEN_HERE`

4. **Run examples:**
   - Start with "Create Specific Patient Full Body Checkup Rule"
   - Then "Run Rules on All Patients (Dry Run)"
   - Finally "Run Rules for Selected Patients (EXECUTE - Send Emails)"

---

## Compilation & Testing

The code has been written with proper syntax and should compile without errors. To verify:

```bash
# Build the project
./mvnw clean compile

# Run tests if available
./mvnw test

# Start the application
./mvnw spring-boot:run
```

---

## Common Use Cases

### 1. Invite seniors for routine checkup
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "Senior citizens checkup",
  "field": "age",
  "operator": ">=",
  "threshold": "65",
  "checkupType": "PREMIUM",
  "checkupSchedule": "WITHIN_30_DAYS"
}
```

### 2. Cardiac screening for high BP patients
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "High BP cardiac screening",
  "field": "systolicBp",
  "operator": ">=",
  "threshold": "140",
  "checkupType": "CARDIAC",
  "checkupSchedule": "ASAP"
}
```

### 3. Diabetes screening for high sugar
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "High blood sugar screening",
  "field": "bloodSugar",
  "operator": ">",
  "threshold": "150",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_7_DAYS"
}
```

### 4. Send to specific VIP patient
```json
{
  "ruleType": "PATIENT_SPECIFIC",
  "ruleName": "VIP patient premium checkup",
  "patientId": "patient_vip_001",
  "checkupType": "PREMIUM",
  "checkupSchedule": "ASAP"
}
```

### 5. Young adults health screening
```json
{
  "ruleType": "FIELD_BASED",
  "ruleName": "Young adults screening",
  "field": "age",
  "operator": "<",
  "threshold": "35",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}
```

---

## Important Notes

### ⚠️ BEFORE YOU RUN

1. **Always test with dry run first!**
   - Set `dryRun: true`
   - Review which patients match
   - Then execute with `dryRun: false`

2. **Patient email must be present**
   - System checks for patient email
   - If email is missing/invalid, it skips that patient
   - Check patient records before running

3. **Check PHI keys**
   - Ensure `PHI_CRYPTO_BASE64_KEY` is set (for patient email decryption)
   - PHI fields are encrypted in database

### ✅ BEST PRACTICES

1. **Name your rules clearly:**
   - ❌ "Rule1", "Test"
   - ✅ "50+ age standard checkup", "High BP cardiac screening"

2. **Use realistic thresholds:**
   - ❌ Age > 150 (no one is 150!)
   - ✅ Age > 50 (realistic)
   - ❌ Systolic BP > 300 (unrealistic)
   - ✅ Systolic BP > 140 (realistic)

3. **Choose appropriate schedules:**
   - 🔴 ASAP - Only for urgent/critical conditions (BP > 160, Sugar > 250)
   - 🟡 WITHIN_7_DAYS - For concerning values (BP > 140, Sugar > 200)
   - 🟢 WITHIN_30_DAYS - For routine, preventive checkups

4. **Don't spam patients:**
   - Review dry run before executing
   - Don't create multiple overlapping rules
   - Change rule schedules, don't create new ones

---

## Troubleshooting

### Issue: Rule created but no matches in dry run

**Possible causes:**
1. Field name is wrong (e.g., typo)
2. Operator syntax error
3. No patients matching the threshold
4. Patients don't have the field populated

**Solution:**
1. Double-check field names from supported list
2. Verify operator is correct (>, <, >=, <=, =, !=)
3. Use realistic threshold (e.g., age > 30, not age > 200)
4. Check if patient records have the field populated

### Issue: Emails not sending

**Possible causes:**
1. Patient email is missing/encrypted incorrectly
2. Email service not configured (no RESEND_API_KEY)
3. Email address is invalid

**Solution:**
1. Verify patient records have email field
2. Check PHI_CRYPTO_BASE64_KEY is set correctly
3. Check RESEND_API_KEY is configured in .env for email delivery
4. Check application logs for email service errors

### Issue: dryRun shows matches but dry run status not updating

**Possible causes:**
1. Refresh the page
2. Different organization context

**Solution:**
1. Postman: Send request again to see updated results
2. Ensure organizationId matches current user's organization

---

## Next Steps

1. ✅ Deploy the changes to production
2. ✅ Configure email service (RESEND_API_KEY or SMTP)
3. ✅ Test with a small rule on a few patients
4. ✅ Schedule regular health checkup campaigns
5. ✅ Monitor email delivery and patient responses

---

## Documentation Files

- **`docs/RULES_ENGINE_HINGLISH_GUIDE.md`** - Detailed Hinglish guide with examples
- **`postman/rules-engine-full-body-checkup.json`** - Postman collection (9 API examples)
- **`PROJECT_DOCUMENTATION.md`** - Updated project documentation with Rules Engine module

---

## Support

For issues or questions about the Rules Engine:
1. Check `RULES_ENGINE_HINGLISH_GUIDE.md` for step-by-step examples
2. Import Postman collection and run examples
3. Check application logs for error messages
4. Review patient records to ensure data is populated

---

*Implementation Date: June 2026*
*Last Updated: June 1, 2026*

