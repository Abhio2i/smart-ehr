# 🏥 SMART-eHR MASTER INTEGRATION & ONBOARDING GUIDE
### *Complete Single-Source Reference for Doctors, Hospital Admins, and Systems Managers*

---

## 📑 Master Table of Contents
1. [CHAPTER 1: 🚀 Razorpay & RazorpayX Account Creation (Beginner's Guide)](#chapter-1--razorpay--razorpayx-account-creation-beginners-guide)
2. [CHAPTER 2: ⚡ 3-Step Quick Integration Guide for Hospital Admin](#chapter-2--3-step-quick-integration-guide-for-hospital-admin)
3. [CHAPTER 3: 🏥 Doctor Onboarding & Automated Payout Architecture](#chapter-3--doctor-onboarding--automated-payout-architecture)
4. [CHAPTER 4: ❓ Frequently Asked Questions (FAQ) & System Reference](#chapter-4--faq--system-reference)

---

# CHAPTER 1: 🚀 Razorpay & RazorpayX Account Creation (Beginner's Guide)

### 🎯 Goal:
Set up a **Razorpay Payment Gateway** (to receive payments from patients) and a **RazorpayX Payout Account** (to automatically send agreed payments to doctors' UPI IDs).

### 📋 5 Simple Steps Overview
```
[ Step 1: Sign Up (2 min) ] ──► [ Step 2: Business Profile (3 min) ] ──► [ Step 3: Complete KYC (5 min) ] ──► [ Step 4: Enable RazorpayX (3 min) ] ──► [ Step 5: Get Keys (2 min) ]
```

#### 1️⃣ STEP 1: Sign Up on Razorpay (2 Minutes)
1. Go to [https://razorpay.com](https://razorpay.com) on your computer or mobile.
2. Click **Sign Up** (top right corner).
3. Enter your **Mobile Number** $\rightarrow$ Enter OTP received on SMS.
4. Enter your **Hospital/Clinic Email ID** and create a strong Password.

#### 2️⃣ STEP 2: Fill Hospital Profile (3 Minutes)
1. **Business Type**: Select *Proprietorship* (single doctor clinic) or *Private Limited / Partnership / Trust / NGO* (for hospitals).
2. **Business Category**: Select **`Healthcare`** $\rightarrow$ Sub-category: **`Hospitals / Clinics / Doctors`**.
3. **Business Name**: Enter official Registered Hospital or Clinic Name.

#### 3️⃣ STEP 3: Complete KYC (5 Minutes)
Keep these documents ready:
* 🪪 **PAN Card**: Hospital Business PAN or Owner Doctor's PAN.
* 📜 **Address Proof**: Aadhaar Card, Passport, or Voter ID.
* 🏦 **Hospital Bank Account**: Bank Passbook or Cancelled Cheque.
* 🩺 **Medical Registration Certificate**: Clinic registration or Doctor's Medical Council Certificate.

Upload the photos/PDFs and click **Submit for Verification**. *(Takes 24-48 hours for live activation; test mode works instantly!)*

#### 4️⃣ STEP 4: Activate RazorpayX Payouts (3 Minutes)
1. On the left sidebar menu, click **RazorpayX (Payouts)** or visit [https://x.razorpay.com](https://x.razorpay.com).
2. Click **Activate RazorpayX Payouts**.
3. RazorpayX provides a **Virtual Current Account Number** (e.g. `23344556677`).
4. Transfer initial money (e.g. ₹2,000 or ₹5,000) from your hospital bank account into this RazorpayX Current Account via NEFT/IMPS/UPI so there is balance to pay doctor agreed payments instantly.

#### 5️⃣ STEP 5: Generate & Copy API Credentials (2 Minutes)
1. In RazorpayX ([x.razorpay.com](https://x.razorpay.com)), click **My Account & Settings** (bottom left).
2. Click **Developer Controls / API Keys**.
3. Click **Generate Key**. Copy these 3 credentials:
   * 🔑 **Key ID**: `rzp_live_xxxxxxxxxxxx`
   * 🔒 **Key Secret**: `xxxxxxxxxxxxxxxxxxxxxxxx`
   * 🏦 **Account Number**: `23344556677`

---

# CHAPTER 2: ⚡ 3-Step Quick Integration Guide for Hospital Admin

### 1️⃣ STEP 1: Get Keys from RazorpayX (5 Minutes)
Copy `Key ID`, `Key Secret`, and `Account Number` from RazorpayX Dashboard ([x.razorpay.com](https://x.razorpay.com)).

### 2️⃣ STEP 2: Paste Keys in Smart-eHR (2 Minutes)
1. Open **Smart-eHR Portal** $\rightarrow$ Click **Provider Payout Ledger** in main menu.
2. Click **Org Gateway & Accounts** tab.
3. Under **Payment Gateway Configuration**:
   * **Provider**: Select `RAZORPAY`
   * **API Key ID**: Paste your `Key ID`
   * **API Key Secret**: Paste your `Key Secret`
   * **RazorpayX Account Number**: Paste your `Account Number`
4. Toggle **Activate Gateway** to **`ON`**.
5. Click **Save Payment Gateway Config**.

### 3️⃣ STEP 3: Add Doctor UPI IDs & Agreed Payment % (3 Minutes)
1. On the same page (**Org Gateway & Accounts**), scroll to **Doctor Agreed Payment Accounts**.
2. Click **+ Add Doctor Account**.
3. Fill in:
   * 👨‍⚕️ **Select Doctor**: Choose doctor name (e.g., `Dr. Kshitiz`).
   * 💳 **Account Type**: Select `UPI`.
   * 📱 **UPI ID**: Enter Doctor's UPI ID (e.g., `9876543210@paytm`, `doctor@okicici`).
   * 🏷️ **Agreed Payment Rate (%)**: Enter percentage (e.g., `20%`).
   * 🟢 **Active**: Ensure checked.
4. Click **Save Doctor Account**.

---

# CHAPTER 3: 🏥 Doctor Onboarding & Automated Payout Architecture

### 📑 Process Flowchart

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

### ⚡ Automatic Execution Rules:
1. **No Manual Buttons Needed**: Payout happens 100% automatically when patient pays.
2. **Specific Doctor Targeting**: Smart-eHR matches claim's treating doctor (`doctorUserId`) and pays only that doctor's linked UPI ID.
3. **Double-Payment Prevention**: Idempotency Key (`organizationId + claimNumber + doctorAccountId`) ensures no duplicate payouts even if network retries happen.

---

# CHAPTER 4: ❓ Frequently Asked Questions (FAQ) & System Reference

### Q1: Does the Doctor need to open a Razorpay account?
**No!** Doctors only need a standard personal UPI ID (GPay, PhonePe, Paytm, BHIM) or Bank Account. The hospital's RazorpayX account transfers money directly to any doctor UPI.

### Q2: How is financial security guaranteed in agreed payment calculations?
Agreed Payment amounts are **calculated server-side** using database-stored total bill and agreed payment percentage. Client payload amounts are strictly ignored.

### Q3: What happens if third-party API times out?
The transaction record is marked as `FAILED` in `DoctorPayoutTransaction`. Retries verify idempotency keys to ensure zero chance of double payout.

### Q4: Where can admins track all payout history?
In **Provider Payout Ledger** $\rightarrow$ **Org Gateway & Accounts** $\rightarrow$ **RazorpayX Instant Doctor Payout Transactions (Audit Ledger)** table.
