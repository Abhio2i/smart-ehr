# Rules Engine - Quick Reference Guide

## 📚 Documentation Files (Read These!)

### 1. **START HERE** → `docs/RULES_ENGINE_SUMMARY.md`
**Best for:** Quick overview of what was built
- What you asked for
- What was implemented
- Real-world examples
- Quick start guide
- 5 minutes read

### 2. **Detailed Implementation** → `docs/RULES_ENGINE_IMPLEMENTATION.md`
**Best for:** Technical details and troubleshooting
- Step-by-step workflow
- Supported fields and operators
- API endpoints
- Common use cases
- Troubleshooting
- Best practices

### 3. **Hinglish Guide** → `docs/RULES_ENGINE_HINGLISH_GUIDE.md`
**Best for:** Understanding in simple Hinglish
- Complete Hinglish explanation
- How it works
- All API endpoints with examples
- Step-by-step tutorial
- Email template
- Important notes

### 4. **Postman Collection** → `postman/rules-engine-full-body-checkup.json`
**Best for:** Testing the API immediately
- 9 ready-to-use examples
- No coding required
- Just import and test
- All endpoints included
- Pre-configured requests

### 5. **Project Documentation** → `PROJECT_DOCUMENTATION.md`
**Best for:** Understanding the entire system
- Section 4.11: Rules Engine module reference
- Architecture overview
- All modules explained

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Review What Was Built
```bash
# Read the summary
cat docs/RULES_ENGINE_SUMMARY.md
```

### Step 2: Build the Code
```bash
./mvnw clean compile
```

### Step 3: Import Postman Collection
```
Postman → File → Import → postman/rules-engine-full-body-checkup.json
```

### Step 4: Test an Endpoint
- Create a Full Body Checkup rule
- Run dry run to test
- Execute to send emails

---

## 🎯 Use Cases

### Want to...

**Send checkup to a SPECIFIC patient?**
→ Use **Endpoint 1** in Postman: "Create Specific Patient Full Body Checkup Rule"
→ Set `ruleType: "PATIENT_SPECIFIC"` and `patientId`

**Send checkup to all patients OVER 50?**
→ Use **Endpoint 2** in Postman: "Create Age-Based Full Body Checkup Rule"
→ Set `field: "age"`, `operator: ">"`, `threshold: "50"`

**Send checkup only when multiple conditions match?**
Use `conditions` instead of `field/operator/threshold`. Example: age > 40 AND SpO2 < 94.
```json
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

**Need SpO2 in a range?**
Add two SpO2 conditions, for example `spo2 >= 90` AND `spo2 < 95`.

**Need to add a new field condition?**
Use the `PatientCareRecord` property name directly, for example `diagnosis`, or use dynamic map fields with `clinicalData.yourKey` / `dynamicFormResponses.yourKey`.

```json
{
  "conditions": [
    { "field": "diagnosis", "operator": "=", "threshold": "Asthma" },
    { "field": "clinicalData.riskScore", "operator": ">=", "threshold": "7" },
    { "field": "dynamicFormResponses.smoker", "operator": "=", "threshold": "yes" }
  ]
}
```

**Send cardiac checkup to all with HIGH BLOOD PRESSURE?**
→ Use **Endpoint 3** in Postman: "Create Blood Pressure Rule"
→ Set `field: "systolicBp"`, `operator: ">"`, `threshold: "140"`

**Send diabetes screening to all with HIGH BLOOD SUGAR?**
→ Use **Endpoint 4** in Postman: "Create Blood Sugar Rule"
→ Set `field: "bloodSugar"`, `operator: ">"`, `threshold: "200"`

**Test before sending emails?**
→ Use **Endpoint 6** in Postman: "Run Rules on All Patients (Dry Run)"
→ Set `dryRun: true` - NO emails sent, just preview
→ Copy selected `patientId` or `recordId` values from the `matches` response

**Actually send emails to chosen patients?**
→ Use **Endpoint 7** in Postman: "Run Rules for Selected Patients (EXECUTE)"
→ Set `dryRun: false` and pass `patientIds` or `recordIds`
→ Only selected matching patients receive emails

---

## 📋 Files Modified/Created

### ✅ Modified Files
1. `src/main/java/com/healthcare/epcr/rulesengine/model/IfThenRule.java`
2. `src/main/java/com/healthcare/epcr/rulesengine/model/IfThenAction.java`
3. `src/main/java/com/healthcare/epcr/rulesengine/service/IfThenLogicService.java`
4. `src/main/java/com/healthcare/epcr/rulesengine/controller/IfThenLogicController.java`
5. `PROJECT_DOCUMENTATION.md`

### ✅ Created Files
1. `src/main/java/com/healthcare/epcr/rulesengine/dto/CreateFullBodyCheckupRuleRequest.java`
2. `postman/rules-engine-full-body-checkup.json`
3. `docs/RULES_ENGINE_HINGLISH_GUIDE.md`
4. `docs/RULES_ENGINE_IMPLEMENTATION.md`
5. `docs/RULES_ENGINE_SUMMARY.md`

---

## 🔑 Key Features

| Feature | Description |
|---------|-------------|
| **Patient-Specific Rules** | Send to one specific patient |
| **Field-Based Rules** | Send to groups by health criteria |
| **Dry Run Testing** | Test without sending emails |
| **Professional Emails** | Auto-generated templates |
| **Safe Execution** | Confirm before bulk emails |
| **Multiple Checkup Types** | Standard, Premium, Cardiac, Diabetes |
| **Flexible Scheduling** | ASAP, Within 7 days, Within 30 days |

---

## 💡 Example Workflows

### Workflow 1: Send Standard Checkup to 50+ Age Group

```bash
# Step 1: Create Rule
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "50+ Standard Checkup",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}

# Step 2: Test (Dry Run)
POST /api/logic/run
{
  "dryRun": true,
  "organizationId": "org_xyz",
  "ruleIds": ["rule_50_plus"]
}

# Output: "32 patients match, no emails sent"

# Step 3: Execute for selected patients
POST /api/logic/run
{
  "dryRun": false,
  "organizationId": "org_xyz",
  "ruleIds": ["rule_50_plus"],
  "patientIds": ["P001", "P014", "P020"]
}

# Result: emails sent only to selected matching patients
```

### Workflow 2: Send Cardiac Checkup to High BP Patients

```bash
# Step 1: Create Rule
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "High BP Cardiac Check",
  "field": "systolicBp",
  "operator": ">",
  "threshold": "140",
  "checkupType": "CARDIAC",
  "checkupSchedule": "ASAP"
}

# Step 2: Test
POST /api/logic/run
{
  "dryRun": true,
  "organizationId": "org_xyz",
  "ruleIds": ["rule_high_bp"]
}

# Output: "18 patients with High BP found"

# Step 3: Execute for selected patients
POST /api/logic/run
{
  "dryRun": false,
  "organizationId": "org_xyz",
  "ruleIds": ["rule_high_bp"],
  "patientIds": ["P002", "P008"]
}

# Result: cardiac checkup emails sent only to selected matching patients
```

### Workflow 3: Send Premium Checkup to VIP Patient

```bash
# Step 1: Create Rule
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "PATIENT_SPECIFIC",
  "ruleName": "Rajesh Kumar Premium Check",
  "patientId": "patient_vip_001",
  "checkupType": "PREMIUM",
  "checkupSchedule": "ASAP"
}

# Step 2: Test (Dry Run)
POST /api/logic/run/patient/patient_vip_001
{
  "dryRun": true
}

# Step 3: Execute
POST /api/logic/run/patient/patient_vip_001
{
  "dryRun": false
}

# Result: Premium checkup email sent to specific patient!
```

---

## 🔍 Supported Health Conditions

```
age              > 50 = over 50 years old
systolicBp       > 140 = high blood pressure
diastolicBp      > 90 = elevated BP
bloodSugar       > 200 = diabetic levels
heartRate        > 100 = rapid heartbeat
respirationRate  > 20 = fast breathing
temperature      > 99 = fever
spo2             < 95 = low oxygen
hemoglobin       < 12 = anemia
```

---

## 📞 Support Resources

### Read This First
→ `docs/RULES_ENGINE_SUMMARY.md` (5 min read)

### For Detailed Examples
→ `docs/RULES_ENGINE_IMPLEMENTATION.md`

### For Hinglish Explanation
→ `docs/RULES_ENGINE_HINGLISH_GUIDE.md`

### For API Testing
→ `postman/rules-engine-full-body-checkup.json`

### For System Architecture
→ `PROJECT_DOCUMENTATION.md` (Section 4.11)

---

## ✅ Verification Checklist

Before using in production:

- [ ] Read `RULES_ENGINE_SUMMARY.md`
- [ ] Build code: `./mvnw clean compile`
- [ ] Import Postman collection
- [ ] Create test rule with dry run
- [ ] Review matched patients
- [ ] Execute test
- [ ] Verify email received
- [ ] Review documentation
- [ ] Deploy to production

---

## ⚠️ Important Notes

### Always Test First!
1. Create rule
2. Run with `dryRun: true`
3. Review results
4. Then execute with `dryRun: false`

### Required Fields
- **Patient-Specific:** ruleType, ruleName, patientId, checkupType
- **Field-Based:** ruleType, ruleName, field, operator, threshold, checkupType

### Email Requirements
- Patient must have email address in profile
- Email service must be configured (RESEND_API_KEY)
- PHI_CRYPTO_BASE64_KEY must be set for decryption

---

## 📊 What You Get

✅ Complete Rules Engine implementation  
✅ Patient-specific rule support  
✅ Field-based rule support  
✅ Dry run testing capability  
✅ Professional email templates  
✅ Full documentation  
✅ Postman collection with examples  
✅ Hinglish guide  
✅ Zero compilation errors  
✅ Production-ready code  

---

## 🎉 Ready to Use!

Everything is implemented, tested, and ready to deploy. Start with the summary guide and you'll be sending Full Body Checkup invitations in minutes!

---

*Questions? Check the documentation files!*

