# MetroEMS Platform: Role-Based User Guide

This guide explains the specific workflows, responsibilities, and access levels for every role within the MetroEMS ecosystem, and outlines sandbox test parameters and advanced AI & Voice features.

---


## 👥 Platform Roles & Responsibilities

### 1. 🛡️ System Administrator (ADMIN)
The Administrator oversees the entire platform and organization structure.
*   **Key Responsibilities:**
    *   **User Management:** Create, update, and deactivate accounts for all staff members.
    *   **Audit Logs:** Monitor every action taken in the system for security and compliance (HIPAA).
    *   **System Settings:** Configure global security policies, backup pathways, and organization profiles.
    *   **Access Level:** Unrestricted view of all system controls and audit history.

### 2. 🏢 Organization Manager (MANAGER)
Managers handle the operational efficiency of their specific organization.
*   **Key Responsibilities:**
    *   **Workflow Management:** Design the lifecycle paths for medical records (e.g., Draft -> review -> billing).
    *   **Form Template Editor:** Customize the fields, layout, and sections of the ePCR and QA forms.
    *   **Reporting:** Access analytics on operational response times, QA score trends, and transport statistics.
    *   **Access Level:** Complete administrative and configuration settings for their business unit.

### 3. 🚑 Paramedic (PARAMEDIC)
Paramedics are the primary creators of data in the system.
*   **Key Responsibilities:**
    *   **EPCR Creation:** Fill out Electronic Patient Care Records during or after an emergency call.
    *   **Vitals Tracking:** Log patient heart rate, blood pressure, treatments, and drug administration.
    *   **Record Submission:** Submit records to the QA queue once complete.
    *   **Voice-to-ePCR:** Dictate clinical narratives to automatically fill forms.

### 4. ⚖️ QA Reviewer (QA_REVIEWER)
Quality Assurance Reviewers ensure the clinical data meets medical standards.
*   **Key Responsibilities:**
    *   **Reviewing Records:** Score paramedics based on documentation quality and care protocol adherence.
    *   **Approval/Rejection:** Approve records to finalize them for billing or reject them for paramedic corrections.
    *   **Feedback:** Provide direct chat feedback to paramedics regarding needed revisions.

### 5. 👨‍⚕️ Physician (PHYSICIAN)
Physicians provide clinical oversight and handle high-level medical requests.
*   **Key Responsibilities:**
    *   **Medical Oversight:** Review complex clinical records and QA compliance trends.
    *   **Amendment Approval:** Review and approve requests from patients wishing to correct their historical records.
    *   **AI Clinical Assistant:** Ask patient-specific questions using the Gemini clinical Q&A helper.

### 6. 🔍 Guest Viewer (VIEWER)
Auditors or supervisors who require read-only verification access.
*   **Key Responsibilities:**
    *   **Dashboard Overview:** Monitor high-level system activity and compliance rates.
    *   **Tickets & Feedback:** Read support tickets and review clinical comments threads.
    *   **Notifications:** Receive system-wide alerts.

### 7. 👤 Patient (PATIENT)
Patients access their medical profiles through a dedicated, simplified portal.
*   **Key Responsibilities:**
    *   **Access Records:** View and download signed patient care records.
    *   **HIPAA Consent & Disclosures:** Review consent authorizations and check who has viewed their file.
    *   **Request Amendments:** Request changes to correct pre-existing medical history.

---

## 🎙️ Advanced Voice & Clinical AI features

The platform utilizes advanced speech-to-text and AI capabilities to streamline workflows:

### 1. Voice Search (Alt+V Shortcut)
*   **How it works:** Press `Alt+V` on your keyboard (or click the floating blue mic icon in the lower right) to activate voice search.
*   **Usage:** Say a patient's name clearly (e.g. *"Open record for Emily Davis"*). The system will search patient logs. If one match is found, it will open the record immediately. If multiple match, a selection picker appears.

### 2. Voice-to-ePCR Form Dictation
*   **How it works:** In the ePCR creation/edit form, click **Voice-to-ePCR** next to the microphone icon. 
*   **Usage:** Speak clinical findings naturally (e.g. *"Patient is a 55 year old male with chest pain. Baseline pulse is 88, blood pressure is 140 over 90. No allergies."*). The AI extracts information and highlights fields:
    *   **Green border:** Fields successfully auto-filled.
    *   **Yellow border (Suggestion):** Suggested values. Click the checkmark to accept or dismiss the suggestion.

### 3. Gemini Physician Q&A (Clinical Assistant)
*   **How it works:** In the Patient History page, physicians can view the Gemini panel.
*   **Usage:** Go to the Q&A tab. Press the mic icon to voice-dictate questions (e.g., *"What is this patient's cardiovascular risk history?"*). The system records and automatically queries the clinical knowledge model. Click the speaker icon next to the response to have the clinical details read out loud.

### 4. Emergency Break-Glass Override
*   **How it works:** If a paramedic or physician must view a restricted record in an emergency, they can click the **Break-Glass** button and enter a clinical justification. Access is granted instantly, and a high-priority audit log record is created for HIPAA compliance checking.

---

## 🔄 The Life Cycle of a Record
1.  **PARAMEDIC** creates and saves an ePCR draft. Can dictate notes using Voice-to-ePCR.
2.  **PARAMEDIC** submits the record, which runs through the automated **Rules Engine** (detecting flags).
3.  **QA_REVIEWER** audits the record using a template, inputs compliance scores, and clicks Approve (or Reject with Feedback).
4.  **SYSTEM** locks the approved record for billing and triggers automated notifications.
5.  **PATIENT** logs in via OTP to review the record, sign HIPAA disclosures, or request history amendments.
6.  **PHYSICIAN** reviews patient clinical timelines and approves any patient-requested amendments.
7.  **ADMIN** reviews system security trails in the audit logs.
