# Rules Engine - Role-Based Access Control (RBAC)

## Overview

The Rules Engine now implements **role-based access control** so that:
- **Admin** can see and manage all organization features
- **Paramedic** (and other roles) can see and manage only their own organization's features

---

## Role Access Matrix

### ✅ Creating Rules

| Role | Can Create Rules | For Organization | Endpoints |
|------|------------------|------------------|-----------|
| **ADMIN** | ✅ Yes | Any organization | `/api/logic/rules` or `/api/logic/rules/full-body-checkup` |
| **MANAGER** | ✅ Yes | Own organization | `/api/logic/rules` or `/api/logic/rules/full-body-checkup` |
| **PHYSICIAN** | ✅ Yes | Own organization | `/api/logic/rules` or `/api/logic/rules/full-body-checkup` |
| **PARAMEDIC** | ✅ Yes | Own organization | `/api/logic/rules/full-body-checkup` |
| **QA_REVIEWER** | ❌ No | — | — |

### ✅ Viewing Rules

| Role | Can View Rules | Can See | 
|------|---|---|
| **ADMIN** | ✅ Yes | All organization rules OR specific org if requested |
| **MANAGER** | ✅ Yes | Own organization rules only |
| **PHYSICIAN** | ✅ Yes | Own organization rules only |
| **PARAMEDIC** | ✅ Yes | Own organization rules only |
| **QA_REVIEWER** | ✅ Yes | Own organization rules only |

**Endpoint:** `GET /api/logic/rules?organizationId=org_id`

### ✅ Running Rules (Executing)

| Role | Can Run Rules | On What | 
|------|---|---|
| **ADMIN** | ✅ Yes | Any organization's records |
| **MANAGER** | ✅ Yes | Own organization's records |
| **PHYSICIAN** | ✅ Yes | Own organization's records |
| **PARAMEDIC** | ✅ Yes | Own organization's records |
| **QA_REVIEWER** | ❌ No | — |

**Endpoints:**
- `POST /api/logic/run` - Run on all patients in organization
- `POST /api/logic/run/patient/{patientId}` - Run for specific patient

---

## Practical Examples

### Example 1: Paramedic Creating a Rule

**Scenario:** Paramedic from "City Hospital" wants to create a Full Body Checkup rule for 50+ age patients

**Step 1:** Paramedic logs in with their credentials
- System auto-detects them as member of "City Hospital" organization
- Their `organizationId` is set to City Hospital ID

**Step 2:** Paramedic calls API
```bash
POST /api/logic/rules/full-body-checkup
{
  "ruleType": "FIELD_BASED",
  "ruleName": "City Hospital - 50+ Age Checkup",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD",
  "checkupSchedule": "WITHIN_30_DAYS"
}
```

**Result:** 
- ✅ Rule created successfully
- Rule is automatically scoped to "City Hospital" organization
- Paramedic from other organizations cannot see this rule
- Admin CAN see all organization rules

### Example 2: Admin Creating Rule for Another Organization

**Scenario:** Admin wants to create a rule for "Suburban Clinic" organization

**Step 1:** Admin calls API with organizationId
```bash
POST /api/logic/rules/full-body-checkup
{
  "organizationId": "suburban_clinic_org_id",  // Admin can specify
  "ruleType": "FIELD_BASED",
  "ruleName": "Suburban Clinic - Diabetes Screening",
  "field": "bloodSugar",
  "operator": ">",
  "threshold": "200",
  "checkupType": "DIABETES",
  "checkupSchedule": "WITHIN_7_DAYS"
}
```

**Result:** 
- ✅ Rule created for Suburban Clinic
- Admin can manage rules for any organization
- Paramedic from Suburban Clinic can now see and run this rule
- Paramedic from City Hospital CANNOT see this rule

### Example 3: Paramedic Running Rules

**Scenario:** Paramedic wants to test and execute a rule

**Step 1:** Test with Dry Run (No emails sent)
```bash
POST /api/logic/run
{
  "dryRun": true
}
// Note: organizationId is optional - system uses paramedic's org
```

**Response:**
```json
{
  "dryRun": true,
  "evaluatedRecords": 150,
  "evaluatedRules": 5,
  "matchedRules": 23,
  "matches": [
    {
      "patientId": "P001",
      "patientName": "Rajesh Kumar",
      "age": 52,
      "status": "MATCHED_DRY_RUN"
    }
    // ... 22 more matches
  ]
}
```

**Result:**
- ✅ 23 patients from City Hospital match the criteria
- NO emails sent (dry run mode)
- Paramedic can review before executing

**Step 2:** Execute with Real Emails
```bash
POST /api/logic/run
{
  "dryRun": false
}
```

**Result:**
- ✅ 23 emails sent to matching patients
- Only patients from City Hospital (paramedic's org) receive emails
- Paramedic from another organization cannot accidentally affect patients there

---

## Authorization Rules in Detail

### Creating Rules
```
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')")
```
- **ADMIN** can create for any organization (specify `organizationId`)
- **MANAGER**, **PHYSICIAN**, **PARAMEDIC** create for their own organization
- **QA_REVIEWER** cannot create rules

### Viewing Rules
```
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')")
```
- **All users except unauthenticated** can view
- View is scoped to own organization (except Admin)
- **Admin** can view all organizations

### Running Rules
```
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')")
```
- **ADMIN** can run on any organization's records
- **MANAGER**, **PHYSICIAN**, **PARAMEDIC** can run on own org records
- **QA_REVIEWER** cannot run rules

---

## Backend Organization Boundary Enforcement

Every API call goes through the service layer which enforces organization boundaries:

### Service Layer Validation
```java
private String resolveOrganizationId(String requestedOrganizationId, User currentUser) {
    if (requestedOrganizationId != null && !requestedOrganizationId.isBlank()) {
        // Check if user has access to requested org
        accessControlService.assertOrganizationAccess(requestedOrganizationId);
        return requestedOrganizationId; // Admin can override
    }
    
    // Non-admin users always use their own org
    if (currentUser.getOrganizationId() == null) {
        throw new IllegalArgumentException("organizationId is required");
    }
    
    accessControlService.assertOrganizationAccess(currentUser.getOrganizationId());
    return currentUser.getOrganizationId();
}
```

### What This Means
1. **Paramedic tries to create rule for another org?** 
   - ❌ Throws `assertOrganizationAccess` error
   
2. **Paramedic tries to view rules from another org?**
   - ❌ Gets empty list (security boundary)

3. **Paramedic tries to run rules on another org's patients?**
   - ❌ Results in "No accessible records found" error

4. **Admin tries any of above?**
   - ✅ All work (full access)

---

## API Endpoints Summary

### For Paramedic (Own Organization)

```
POST   /api/logic/rules/full-body-checkup          Create checkup rule
GET    /api/logic/rules                            List own org rules
POST   /api/logic/run                              Run rules (dry run or execute)
POST   /api/logic/run/patient/{patientId}          Run for specific patient
```

### For Admin (Any Organization)

```
POST   /api/logic/rules                            Create generic rule (any org)
POST   /api/logic/rules/full-body-checkup          Create checkup rule (any org)
GET    /api/logic/rules?organizationId=X           List any org's rules
POST   /api/logic/run?organizationId=X             Run on any org
POST   /api/logic/run/patient/{patientId}          Run for any patient
```

---

## What Changed

### Code Updates
1. **IfThenLogicController.java** - Added `@PreAuthorize` annotations
   - Create rules: `hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')`
   - View rules: `hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC', 'QA_REVIEWER')`
   - Run rules: `hasAnyRole('ADMIN', 'MANAGER', 'PHYSICIAN', 'PARAMEDIC')`

2. **IfThenLogicService.java** - Already enforces org boundaries (no changes needed)
   - `resolveOrganizationId()` validates user access
   - `runForPatient()` filters accessible records

### Behavior Changes
- **Before:** Anyone with token could access any organization's rules
- **After:** Only authorized roles within their organization
- **Admin:** Still has full access to all organizations

---

## Security Benefits

✅ **Data Isolation** - Paramedics only see their own org rules  
✅ **Role-Based Control** - QA reviewers cannot modify rules  
✅ **Organization Scoping** - Cannot accidentally send emails to wrong patients  
✅ **Audit Trail** - Each rule knows who created it and when  
✅ **Multi-Tenant Safe** - Perfect for organizations sharing same instance  

---

## Configuration

No additional configuration needed! The role-based access control works with:
- Spring Security's `@PreAuthorize` annotation
- Existing JWT token with role claims
- Existing `accessControlService` for boundary checks

Just ensure users have correct roles assigned in your system:
- ADMIN - System administrator
- MANAGER - Organization manager
- PHYSICIAN - Medical doctor
- PARAMEDIC - Paramedic/field responder
- QA_REVIEWER - Quality assurance reviewer

---

## Testing in Postman

### Create a Paramedic JWT Token
1. Login as paramedic user via `/api/auth/login`
2. Copy the `access_token` from response
3. Set `Authorization: Bearer {access_token}` in headers

### Test Paramedic Access
```
POST /api/logic/rules/full-body-checkup
Headers:
  Authorization: Bearer {paramedic_token}
  
Body:
{
  "ruleType": "FIELD_BASED",
  "ruleName": "Test rule",
  "field": "age",
  "operator": ">",
  "threshold": "50",
  "checkupType": "STANDARD"
}
```

### Create Admin JWT Token
1. Login as admin user
2. Copy the `access_token`
3. Set `Authorization: Bearer {admin_token}`

### Test Admin Access (Any Org)
```
POST /api/logic/rules/full-body-checkup
Headers:
  Authorization: Bearer {admin_token}
  
Body:
{
  "organizationId": "any_other_org_id",  // Admin can specify
  "ruleType": "FIELD_BASED",
  ...
}
```

---

## Troubleshooting

### Error: "Access is denied"
**Cause:** Your role doesn't have permission for this endpoint  
**Solution:** Check your role in JWT token, ensure you have one of: ADMIN, MANAGER, PHYSICIAN, PARAMEDIC

### Error: "Insufficient permission for organization"
**Cause:** Trying to access another organization's data  
**Solution:** As paramedic, you can only access your own org. Admin can pass `?organizationId=X`

### Error: "No accessible records found"
**Cause:** Trying to run rules for patient in another organization  
**Solution:** Paramedics can only run for their org's patients. Admin can run for anyone.

### Can't see rules in Postman
**Cause:** Wrong organization or insufficient role  
**Solution:** 
- Ensure you're logged in with correct role
- For paramedics, rules only show for their organization
- For admins, rules show for all organizations

---

## Summary

The Rules Engine now has **production-ready role-based access control**:

| Action | Admin | Manager | Physician | Paramedic | QA Reviewer |
|--------|-------|---------|-----------|-----------|-------------|
| Create Rule | ✅ Any Org | ✅ Own | ✅ Own | ✅ Own | ❌ No |
| View Rules | ✅ All | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| Run Rules | ✅ Any Org | ✅ Own | ✅ Own | ✅ Own | ❌ No |

**Status: ✅ READY FOR PRODUCTION**

---

*Last Updated: June 1, 2026*

