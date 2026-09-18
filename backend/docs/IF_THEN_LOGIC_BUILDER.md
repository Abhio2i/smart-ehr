# Doctor Full Body Checkup Email Flow

## Goal

Doctor/physician ek condition choose kare:

```text
age < any number
age > any number
age <= any number
age >= any number
```

Phir backend matching patients ko email bheje:

```text
"Hi {patientName}, Dr. {doctorName} recommends a full body checkup..."
```

Same rule specific patient ke liye bhi run ho sakta hai. Specific patient search ke liye existing API use hoti hai:

```http
GET /api/admin/patients/search?phone={{patientPhone}}&limit=10
```

## Postman Variables

Set these variables:

```text
ageOperator = <
ageThreshold = 60
doctorEmail = doctor@example.com
doctorName = Smith
patientPhone = 555123
```

Examples:

```text
ageOperator=<  ageThreshold=40
ageOperator=>  ageThreshold=60
ageOperator=>= ageThreshold=75
```

## Step 1: Create Doctor Email Rule

```http
POST /api/logic/rules
```

Body:

```json
{
  "organizationId": "{{organizationId}}",
  "name": "Doctor Full Body Checkup Email",
  "field": "age",
  "operator": "{{ageOperator}}",
  "threshold": "{{ageThreshold}}",
  "action": {
    "type": "EMAIL",
    "sendToPatient": true,
    "toEmails": ["{{doctorEmail}}"],
    "subject": "Full body checkup reminder for {patientName}",
    "body": "Hi {patientName}, Dr. {{doctorName}} recommends a full body checkup. Your age is {age}. Patient ID: {patientId}."
  },
  "active": true
}
```

Hinglish: is rule ka matlab hai, jis patient ki age selected condition match karegi, us patient ko email jayega. Doctor ko bhi copy email jayega via `toEmails`.

## Step 2A: Preview Matching Patients

```http
POST /api/logic/run
```

Body:

```json
{
  "organizationId": "{{organizationId}}",
  "dryRun": true
}
```

Response me `matches` list aayegi. Doctor selected `patientId` ya `recordId` choose kar sakta hai. `dryRun: true` me email send nahi hota.

## Step 2B: Send To Selected Matching Patients

```http
POST /api/logic/run
```

Body:

```json
{
  "organizationId": "{{organizationId}}",
  "dryRun": false,
  "patientIds": ["{{patientId}}"]
}
```

Optional: `ruleIds` pass karo agar sirf specific rule run karna hai. `recordIds` pass kar sakte ho agar same patient ke specific ePCR record ko select karna hai. Non-selected matching patients response me `MATCHED_NOT_SELECTED` status ke saath dikhenge.

## Step 2C: Specific Patient By Phone

Search patient using existing API:

```http
GET /api/admin/patients/search?phone={{patientPhone}}&limit=10
```

Postman test script first result ka `patientId` variable me set karta hai.

Then run same rule only for that patient:

```http
POST /api/logic/run/patient/{{patientId}}
```

Body:

```json
{
  "dryRun": false
}
```

## Notes

- No separate API is created for phone search.
- Same one rule works for less-than and greater-than conditions.
- Use `dryRun: true` to view all matching patients, then execute with selected `patientIds` or `recordIds`.
- Email sending uses backend `EmailService`.
- Doctor/physician, admin, manager, paramedic roles can use this flow according to security config.
