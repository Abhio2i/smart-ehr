# 🚀 Beginner's Step-by-Step Guide: How to Create & Activate Razorpay & RazorpayX Account
### *Complete Guide for Hospitals, Clinics, and Healthcare Administrators*

---

## 🎯 What You Will Achieve:
By following this guide, your hospital will have an active **Razorpay Payment Gateway** (to receive payments from patients) and a **RazorpayX Payout Account** (to automatically send agreed payments to doctors' UPI IDs).

---

## 📋 5 Simple Steps Overview

```
[ Step 1: Sign Up (2 min) ] ──► [ Step 2: Fill Business Profile (3 min) ] ──► [ Step 3: Complete KYC (5 min) ] ──► [ Step 4: Enable RazorpayX (3 min) ] ──► [ Step 5: Get Keys (2 min) ]
```

---

### 1️⃣ STEP 1: Sign Up on Razorpay (2 Minutes)
1. Go to [https://razorpay.com](https://razorpay.com) on your mobile or computer.
2. Click the **Sign Up** button (top right corner).
3. Enter your **Mobile Number** $\rightarrow$ You will receive an OTP on SMS. Enter the OTP.
4. Enter your **Work/Hospital Email ID** and create a strong Password.
5. Select your role as **Business / Healthcare Organization**.

---

### 2️⃣ STEP 2: Fill Hospital / Business Profile (3 Minutes)
Razorpay will ask a few simple questions about your business:
1. **Business Type**: Select your organization type:
   * *Proprietorship* (if single doctor clinic)
   * *Private Limited / Partnership / Trust / NGO* (for hospitals)
2. **Business Category**: Select **`Healthcare`** $\rightarrow$ Sub-category: **`Hospitals / Clinics / Doctors`**.
3. **Business Name**: Enter your official Registered Hospital or Clinic Name.
4. **Website / App**: If you have a website, paste the link. If not, select *"I don't have a website (App / In-person billing)"*.

---

### 3️⃣ STEP 3: Complete KYC (Keep Documents Ready - 5 Minutes)
To receive real money, Razorpay requires standard government verification (KYC):

#### 📄 Documents Needed:
* 🪪 **PAN Card**: Hospital Business PAN or Owner Doctor's PAN Card.
* 📜 **Address Proof**: Aadhaar Card, Passport, or Voter ID of the owner.
* 🏦 **Hospital Bank Account**: Bank Passbook photo or Cancelled Cheque (where patient payments will arrive).
* 🩺 **Medical Registration Certificate**: Clinic registration or Doctor's Medical Council Certificate.

#### 📤 How to Upload:
1. Click **Activate Account** on the Razorpay dashboard.
2. Upload the photos/PDFs of your PAN, Aadhaar, and Bank Cheque.
3. Click **Submit for Verification**.
   > 💡 *Note: Verification usually takes 24 to 48 hours. However, you can test system in Test/Simulated Mode immediately!*

---

### 4️⃣ STEP 4: Activate RazorpayX Payouts (3 Minutes)
RazorpayX is the engine that sends instant agreed payment money to doctors' UPI IDs.

1. Once logged into Razorpay Dashboard, look at the left sidebar menu and click **RazorpayX (Payouts)** or go directly to [https://x.razorpay.com](https://x.razorpay.com).
2. Click **Activate RazorpayX Payouts**.
3. RazorpayX will provide a **Virtual Current Account Number** (e.g. `23344556677`).
4. **Deposit Float Funds**: Transfer initial money (e.g. ₹2,000 or ₹5,000) from your hospital bank account into this RazorpayX Current Account via NEFT/IMPS/UPI so that there is balance to pay doctor agreed payments instantly!

---

### 5️⃣ STEP 5: Generate & Copy API Credentials (2 Minutes)
This is the final step to connect RazorpayX with Smart-eHR!

1. In RazorpayX ([x.razorpay.com](https://x.razorpay.com)), click **My Account & Settings** (bottom left corner).
2. Click **Developer Controls / API Keys**.
3. Click **Generate Key** (or *Generate Live Key*).
4. A popup will show 3 credentials. Copy and save them safely:
   * 🔑 **Key ID**: `rzp_live_xxxxxxxxxxxx`
   * 🔒 **Key Secret**: `xxxxxxxxxxxxxxxxxxxxxxxx`
   * 🏦 **Account Number**: `23344556677`

---

## 🔗 Connect Credentials with Smart-eHR

Now take your 3 credentials to Smart-eHR:
1. Open Smart-eHR $\rightarrow$ **Provider Payout Ledger** $\rightarrow$ **Org Gateway & Accounts** tab.
2. Paste `Key ID`, `Key Secret`, and `Account Number`.
3. Turn ON **Activate Gateway** $\rightarrow$ Click **Save Gateway Config**.

🎉 **Congratulations!** Your Razorpay & RazorpayX account setup is complete and fully integrated with Smart-eHR!
