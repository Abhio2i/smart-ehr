# ⚡ 3-Step Simple Integration Guide for Hospital / Organization Admin
### *Smart-eHR Automated Doctor Agreed Payment & Payout Setup*

---

## 🎯 Goal
Set up automatic doctor agreed payment transfers so that whenever a patient pays a bill, the doctor receives their agreed payment instantly on their UPI ID (GPay / PhonePe / Paytm).

---

## 📋 Step-by-Step Setup Checklist (10 Minutes Total)

```
[ Step 1: Get RazorpayX Keys (5 min) ] ──► [ Step 2: Paste Keys in Smart-eHR (2 min) ] ──► [ Step 3: Add Doctor UPI & % (3 min) ] ──► 🎉 DONE!
```

---

### 1️⃣ STEP 1: Get Your RazorpayX Keys (5 Minutes)
1. Open [x.razorpay.com](https://x.razorpay.com) and log in to your Hospital account.
2. Click **My Account & Settings** (left sidebar bottom) $\rightarrow$ Go to **API Keys / Developer Controls**.
3. Copy these 3 values:
   * 🔑 **Key ID** (e.g., `rzp_live_abcdef123456`)
   * 🔒 **Key Secret** (e.g., `xyz789secretkey`)
   * 🏦 **RazorpayX Account Number** (e.g., `23344556677`)

---

### 2️⃣ STEP 2: Connect Keys in Smart-eHR (2 Minutes)
1. Open **Smart-eHR Portal** $\rightarrow$ Click **Provider Payout Ledger** in the main menu.
2. Click the **Org Gateway & Accounts** tab.
3. Under **Payment Gateway Configuration**, fill in:
   * **Provider**: Select `RAZORPAY`
   * **API Key ID**: Paste your `Key ID`
   * **API Key Secret**: Paste your `Key Secret`
   * **RazorpayX Account Number**: Paste your `Account Number`
4. Toggle **Activate Gateway** to **`ON`**.
5. Click **Save Payment Gateway Config** button.

---

### 3️⃣ STEP 3: Add Doctor UPI IDs & Agreed Payment Rate (3 Minutes)
1. On the same page (**Org Gateway & Accounts**), scroll down to **Doctor Agreed Payment Accounts**.
2. Click **+ Add Doctor Account** button.
3. Fill out the simple form:
   * 👨‍⚕️ **Select Doctor**: Choose doctor name (e.g., `Dr. Kshitiz`)
   * 💳 **Account Type**: Select `UPI` *(Recommended)*
   * 📱 **UPI ID**: Enter Doctor's active UPI ID (e.g., `9876543210@paytm`, `doctor@okicici`, `gpay@ybl`)
   * 🏷️ **Agreed Payment Rate (%)**: Enter agreed percentage (e.g., `20%`)
   * 🟢 **Active**: Ensure checkbox is checked.
4. Click **Save Doctor Account**.

---

## 🎉 Congratulations! Your Integration is Live!

### ⚡ What Happens Now (Automatic Flow):
1. **Patient Pays Bill**: Patient settles medical bill online or via QR code.
2. **Instant Transfer**: Smart-eHR automatically calculates agreed payment (e.g., ₹2,000 bill $\times$ 20% = **₹400**) and sends it to the Doctor's UPI ID within 0 seconds.
3. **Receipt & Audit**: Doctor gets an instant email receipt, and the transaction is permanently recorded in the **RazorpayX Instant Doctor Payout Transactions (Audit Ledger)**.

---

## 🔍 Need Help / Quick Verification?
Check the **Audit Ledger** table at the bottom of the **Org Gateway & Accounts** tab to see real-time payment settlement logs anytime!
