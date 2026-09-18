# 🏥 Doctor & Hospital RazorpayX Payout Onboarding & Integration Guide
### *Smart-eHR Automated Doctor Agreed Payment & Payout Engine*

---

## 📌 Executive Summary
This document provides a step-by-step guide for **Doctors** and **Hospital Administrators** to configure RazorpayX and link payout accounts in **Smart-eHR**. Once set up, patient bill payments are automatically split, and doctor agreed payments are instantly transferred directly to the doctor's bank account or UPI ID.

---

## 📑 Process Overview Flowchart

```
[Patient Settle Bill (₹2,000)]
               │
               ▼
[Smart-eHR Webhook Capture (payment.captured)]
               │
               ▼
[System Identifies Treating Doctor & Agreed Payment % (20%)]
               │
               ▼
[Instant RazorpayX Payout Executed (₹400)] ──► [Doctor Bank / UPI Account (doctor@upi)]
               │
               ▼
[Doctor Receives Email Receipt + Audit Trail Logged in Smart-eHR]
```

---

## 🚀 STEP 1: Hospital Admin Gateway Setup (RazorpayX Account)

### A. Registering RazorpayX Account:
1. Go to [https://x.razorpay.com](https://x.razorpay.com) and click **Sign Up**.
2. Complete Organization KYC (Hospital / Clinic Business PAN, GST/Registration certificate, Bank Account details).
3. Once approved, navigate to **My Account & Settings** $\rightarrow$ **Developer Controls / API Keys**.

### B. Extract API Credentials:
Copy the following 3 values from the RazorpayX Dashboard:
* `Key ID` (e.g., `rzp_live_xxxxxxxxxxxx`)
* `Key Secret` (e.g., `xxxxxxxxxxxxxxxxxxxxxxxx`)
* `RazorpayX Account Number` (e.g., `2334455667788`)

### C. Configure API Keys in Smart-eHR:
1. Log in to Smart-eHR as **Hospital Admin**.
2. Open **Provider Payout Ledger** from the main menu.
3. Click on the **Org Gateway & Accounts** tab.
4. Fill in the **Payment Gateway Configuration**:
   * **Gateway Provider**: `RAZORPAY`
   * **API Key ID**: `rzp_live_xxxxxxxxxxxx`
   * **API Key Secret**: `••••••••••••••••`
   * **RazorpayX Account Number**: `2334455667788`
5. Toggle **Activate Gateway Status** to `ON` and click **Save Payment Gateway Config**.

---

## 👨‍⚕️ STEP 2: Doctor Account Registration & UPI Linking

Every doctor associated with the hospital must have their payout details configured in Smart-eHR.

### A. How Doctor/Admin Adds Payout Details in Smart-eHR:
1. In Smart-eHR, navigate to **Provider Payout Ledger** $\rightarrow$ **Org Gateway & Accounts**.
2. Scroll to **Doctor Agreed Payment & Payout Accounts** and click **+ Add Doctor Account**.
3. Fill out the Doctor Payout Form:
   * **Select Doctor**: Choose doctor from user list (e.g., `Dr. Kshitiz`).
   * **Account Type**: Select `UPI` *(Recommended)* or `BANK_ACCOUNT` or `RAZORPAY_ROUTE`.
   * **UPI ID**: Enter active UPI VPA (e.g., `doctorname@okicici`, `9876543210@paytm`, `doctor@ybl`).
   * **Bank Details** *(If using Bank Account)*: Enter Account Number and IFSC Code.
   * **Agreed Payment Rate (%)**: Set agreed agreed payment percentage (e.g., `15.0%` or `20.0%`).
   * **Account Status**: Ensure `Active` checkbox is checked.
4. Click **Save Doctor Account**.

---

## ⚙️ STEP 3: How Automated Agreed Payment Split Works

Once Step 1 & Step 2 are completed, the system operates **100% automatically**:

1. **Patient Bill Settlement**:
   When a patient pays their medical bill (e.g., `₹2,000`) online or at checkout, Smart-eHR receives a `payment.captured` webhook.

2. **Automated Calculation & Fraud Prevention**:
   * Smart-eHR reads the verified bill amount from the database (`₹2,000`).
   * The server calculates the exact agreed payment: $\text{Bill} \times \text{Agreed Payment \%} = ₹2,000 \times 20\% = ₹400$.

3. **Instant Transfer to Doctor UPI**:
   * Smart-eHR triggers RazorpayX Instant Payout API with a unique **Idempotency Key**.
   * The doctor receives `₹400` directly into their UPI / Bank account within seconds.

4. **Email Receipt & Audit Log**:
   * An automated HTML Email Receipt is sent to the doctor with total bill, agreed payment breakdown, and transaction reference.
   * A permanent record is stored in the **RazorpayX Instant Doctor Payout Transactions (Audit Ledger)**.

---

## 📑 STEP 4: Live Audit Ledger & Verification

Hospital Admins and Doctors can verify payout history anytime:

1. Go to **Provider Payout Ledger** $\rightarrow$ **Org Gateway & Accounts**.
2. View **RazorpayX Instant Doctor Payout Transactions (Audit Ledger)**.
3. The table displays:
   * **Claim #** (e.g., `CLM-2026-000123`)
   * **Doctor Name & UPI ID** (e.g., `Dr. Kshitiz` — `doctor@upi`)
   * **Patient Bill Total (₹)** (e.g., `₹2,000.00`)
   * **Agreed Payment %** (e.g., `20.0%`)
   * **Doctor Earned Amount (₹)** (e.g., `₹400.00`)
   * **Payout Status** (`PROCESSED` ✅ / `SIMULATED` ⚡)
   * **Razorpay Payout Reference ID** & Timestamp.

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: Does the Doctor need to create a Razorpay account?
**No!** Doctors only need a normal active **UPI ID** (GPay, PhonePe, Paytm, or BHIM) or Bank Account. The Hospital's RazorpayX account handles payouts directly to any UPI ID.

### Q2: What happens if a patient payment fails or is refunded?
If a patient payment fails, no webhook is fired, and no doctor payout is triggered.

### Q3: How is double-payout prevented?
Every payout uses a database-backed **Idempotency Key** (`organizationId + claimNumber + doctorAccountId`). If the system or webhook fires twice, RazorpayX blocks the duplicate transfer automatically.

---

## 📞 Support & Integration Verification
For technical assistance or system audits, contact the **Smart-eHR Systems Administrator**.
