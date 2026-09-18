# GNWT EHR Billing & Administration Implementation Blueprint

This document outlines the architecture, database designs, and implementation steps required to build the missing **Billing & Administration** components in the MedEPCR system. 

It covers the three admin modules currently flagged as **Not Implemented**:
1. **External Billing (NWT Claims, reciprocal billing, and NIHB federal coverage)**
2. **Provider Payment (Physician Fee-for-Service and shift allocations)**
3. **External Payments (Payment gateway integration for self-pay patients)**

---

## 1. Current Architecture & Foundations

The system already has a basic database structure and a registration screen for tracking patient healthcare coverage. 

### 1.1 Existing Backend Foundation
The model [HealthCareCoverage.java](file:///d:/healthCare/src/main/java/com/healthcare/epcr/registration/model/HealthCareCoverage.java) stores coverage information for patients:
*   `nwtPlanNumber` (Encrypted PHI)
*   `coverageType` (NWT_HEALTH_CARE_PLAN, PROVINCIAL_OHIP, etc.)
*   `verificationStatus` (PENDING, VERIFIED, FAILED)
*   `homeJurisdictionHealthCardNumber` (Reciprocal provincial billing support)
*   `nihbClientId` (Federal Non-Insured Health Benefits tracking for First Nations & Inuit)
*   `payerId` (NWT_GOVT, NIHB, SELF_PAY, HOME_PROVINCE)

### 1.2 Existing Frontend Foundation
The view [HealthcareRegistration.jsx](file:///d:/HealthCareFrontEnd/src/pages/HealthcareRegistration.jsx) provides the clinical UI to:
*   Search for patients and view their coverage details.
*   Edit/enroll patients in NWT Health Care plans or reciprocal provinces.
*   Input NIHB (Non-Insured Health Benefits) registration parameters.
*   Link claims billing metadata (`payerId`, `claimReferenceNumber`, `estimatedCoveragePercentage`).

---

## 2. Component 1: External Billing (Claims Engine)

### 2.1 Technical Context (NWT/Canadian Healthcare Billing)
In Canada, health services are publicly funded. When a service is rendered (such as an emergency ambulance transport or clinic visit):
1.  **NWT Residents:** Billed directly to the NWT Government (Department of Health and Social Services) via standard ICD-10 diagnostic codes and service codes.
2.  **Reciprocal Billing (Out-of-Territory Residents):** Billed to the patient's home province/territory registry (e.g. Alberta Health Care, Ontario OHIP) via the Interprovincial Health Insurance Agreements.
3.  **NIHB (First Nations & Inuit):** Billed to the Federal Government (Indigenous Services Canada) for dental, vision, pharmacy, or medical transportation.

### 2.2 Database Design

#### A. Billing Service Codes (`BillingServiceCode.java`)
Stores the master list of payable procedures and their dollar rates.
```java
package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "billing_service_codes")
@Data
public class BillingServiceCode {
    @Id
    private String id;
    private String code;         // E.g., "AMB-01" (Standard Ambulance), "OR-02" (Minor Surgery)
    private String description;
    private Double rate;         // Base dollar cost of service
    private String category;     // AMBULANCE, CLINIC, SURGERY, DENTAL
    private Boolean active;
}
```

#### B. Health Care Claims (`HealthCareClaim.java`)
Represents the actual claims generated for submission.
```java
package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "healthcare_claims")
@Data
public class HealthCareClaim {
    @Id
    private String id;
    
    @Indexed
    private String patientId;
    
    @Indexed
    private String patientCareRecordId; // Linked clinical incident
    
    private String claimNumber;        // Unique reference (e.g., CLM-1002345)
    private String payerId;             // NWT_GOVT, NIHB, SELF_PAY, HOME_PROVINCE
    private String payerDetails;        // Home province code, NIHB client ID, etc.
    
    private List<ClaimItem> items;
    private Double totalAmount;
    private Double estimatedCoverageAmount;
    
    private String status;              // DRAFT, SUBMITTED, PAID, REJECTED, ADJUSTED
    private String rejectionReason;
    
    private String batchId;             // For reciprocal batch transfer files
    private LocalDateTime submittedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
}

@Data
class ClaimItem {
    private String serviceCode;
    private String description;
    private Integer quantity;
    private Double unitPrice;
    private Double total;
}
```

### 2.3 Backend Service Pipeline (`BillingClaimsService.java`)
You must implement a service to automate the claim creation:
1.  **Trigger:** When a Patient Care Record (ePCR) is signed/QA approved (e.g., in [QAService.java](file:///d:/healthCare/src/main/java/com/healthcare/epcr/qa/service/QAService.java)), auto-generate a `HealthCareClaim` in `DRAFT` status.
2.  **Validation:** Verify that `nwtPlanNumber` or `reciprocalBillingCode` matches basic regex formats before allowing submission.
3.  **Submission Generator:** Create a service that compiles selected claims into a standardized submission file (commonly XML or text-based reciprocal billing formats) for batch transfer.

### 2.4 Frontend Dashboard Proposed Design (`src/pages/ClaimsManagement.jsx`)
Create a claims admin workspace:
*   **Stats Panels:** Total Claims Outstanding, Submitted Claims (Pending), Paid amount, Rejected Claims Count.
*   **Claims Table:** Showing `Claim Number`, `Patient Name`, `Payer`, `Total Charge`, `Status`, `Created Date`.
*   **Submission Action:** Multi-select claims in `DRAFT` status and click **"Generate Submission Batch"** (triggers batch file output).

---

## 3. Component 2: Provider Payment (Fee-For-Service / Salary)

### 3.1 Technical Context
Physicians in the NWT are compensated either by salary, daily/shift rates, or fee-for-service (billing the government for each procedure performed). Paramedics are compensated based on worked shift hours.

### 3.2 Database Design

#### A. Provider Payment Rates (`ProviderPaymentRate.java`)
Defines payment rules for each provider type or specific doctor.
```java
package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "provider_payment_rates")
@Data
public class ProviderPaymentRate {
    @Id
    private String id;
    private String providerId;       // Link to User model
    private String providerRole;     // PHYSICIAN, PARAMEDIC, SPECIALIST
    private String paymentType;      // FEE_FOR_SERVICE, SHIFT_RATE, HOURLY
    private Double baseRate;         // Base pay per hour/shift/service
}
```

#### B. Provider Payout logs (`ProviderPayout.java`)
Calculates payment items per shift or procedure.
```java
package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "provider_payouts")
@Data
public class ProviderPayout {
    @Id
    private String id;
    
    @Indexed
    private String providerId;
    private String providerName;
    
    private LocalDate payrollPeriodStart;
    private LocalDate payrollPeriodEnd;
    
    private Double totalHoursWorked;
    private Double totalProcedureEarnings; // For Fee-for-service
    private Double totalPayout;
    
    private String approvalStatus;          // PENDING_REVIEW, APPROVED, PAID
    private String approvedBy;
    private LocalDateTime paidAt;
}
```

### 3.3 Integration Logic
*   **Shift/Schedule Tracking:** Link directly to [AppointmentSlot.java](file:///d:/healthCare/src/main/java/com/healthcare/epcr/scheduling/model/AppointmentSlot.java) and [SurgicalCase](file:///d:/healthCare/src/main/java/com/healthcare/epcr/surgical/service/SurgicalCareService.java) to track how many hours were allocated and surgical operations completed.
*   **Calculation Engine:** Create a scheduler (similar to [AppointmentReminderJob.java](file:///d:/healthCare/src/main/java/com/healthcare/epcr/scheduling/scheduler/AppointmentReminderJob.java)) that runs at the end of each pay period, gathers all approved procedures, and logs a summary `ProviderPayout` entry.

---

## 4. Component 3: External Payments (Merchant / Credit Card Payments)

### 4.1 Technical Context
For non-residents (uninsured visitors, foreign tourists) or services not covered under NWT/Provincial plans (e.g. optional transport services, cosmetic dental procedures), direct self-pay is required. A credit card processor gateway (e.g. Stripe, Moneris) must be integrated.

### 4.2 Database Design

#### A. Patient Invoice (`PatientInvoice.java`)
```java
package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "patient_invoices")
@Data
public class PatientInvoice {
    @Id
    private String id;
    
    @Indexed
    private String patientId;
    private String patientName;
    private String patientEmail;
    
    private String linkedClaimId;       // Link to HealthCareClaim
    private Double amountDue;
    private Double amountPaid;
    private String status;               // UNPAID, PARTIALLY_PAID, PAID, VOIDED
    
    private String stripePaymentIntentId; // Payment Gateway ID
    private String paymentReceiptUrl;
    
    private LocalDateTime issuedAt;
    private LocalDateTime paidAt;
}
```

### 4.3 Payment Gateway Integration Plan
1.  **Stripe/Moneris Integration:** Include Stripe Java dependency (`stripe-java`) in the backend backend `pom.xml`.
2.  **API Endpoint (`/api/billing/payment-intent`):**
    *   Parameters: `invoiceId`
    *   Creates a Stripe `PaymentIntent` with the amount from `PatientInvoice`.
    *   Returns the client secret to the frontend.
3.  **Frontend Checkout Integration:**
    *   Implement `@stripe/stripe-js` on the frontend.
    *   Render a checkout form modal allowing the patient/admin to enter card details.
    *   Execute `stripe.confirmCardPayment` and update invoice status to `PAID` via webhook.

---

## 5. Implementation Roadmap (Phased Plan)

### Phase 1: Core Claim Setup (Week 1)
*   Deploy backend models `BillingServiceCode` and `HealthCareClaim`.
*   Establish billing service code master registry (pre-populate with standard NWT transport and clinic rates).
*   Add billing endpoints in the backend to fetch/update claims.

### Phase 2: Claims Automation & Frontend Dashboard (Week 2)
*   Integrate automatic claim generation when an ePCR is QA approved.
*   Build the frontend **Claims Management Dashboard** (`src/pages/ClaimsManagement.jsx`) with table view and batch generation button.

### Phase 3: Self-Pay Invoicing & Stripe Integration (Week 3)
*   Create backend `PatientInvoice` model.
*   Integrate Stripe API client on the backend to issue payment intents.
*   Build checkout form overlay inside the patient portal page [PatientPortal.jsx](file:///d:/HealthCareFrontEnd/src/pages/PatientPortal.jsx).

### Phase 4: Provider Payments (Week 4)
*   Deploy `ProviderPaymentRate` and `ProviderPayout` models.
*   Write service engine to compute payouts from shifts and appointments.
*   Add a simple **Earnings / Payout Ledger** view inside Settings or User profile page.
