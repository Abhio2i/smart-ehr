# Innovixa Health Platform - User & Menu Guide (with Real-Life Examples)

This document explains every section and menu of the Innovixa Health Platform in plain, everyday language. Each explanation includes a **Real-Life Example** showing how the menu is used in the day-to-day operations of an emergency medical service or clinic.

---

## 📂 1. Dashboard (Main Board)
* **What it is**: The system's home screen.
* **What it is used for**: It displays visual graphs, counters, and statistics showing the active state of the organization. You can see how many records are in draft, how many are waiting for QA reviews, compliance ratings, and active alerts.
* **Access Level**: Accessible by all roles (including Guest Viewers).
* **Real-Life Example**: A supervisor logs in at 8:00 AM and checks the Dashboard. They notice a chart showing 12 unresolved QA reviews and a warning that 3 urgent cases are pending approval. This helps them prioritize their work for the day.

---

## 📝 2. Records Section
*Where patient care records are created, updated, and validated.*

### 📄 EPCR (Electronic Patient Care Records)
* **What it is**: The digital patient file cabinet.
* **What it is used for**: Paramedics use this page to create **New Records** and fill in emergency incident details (vitals, medical history, treatments, scene assessments, and transport destinations). You can search for existing patients, edit drafts, and see the automated **Clinical Tags** (like "Cardiac Arrest" or "Fracture") computed for each record.
* **Access Level**: Paramedics, QA Reviewers, Physicians, and Admins.
* **Real-Life Example**: A paramedic responds to a patient with a broken leg. After transporting them to the hospital, the paramedic opens the EPCR screen and logs the patient's name, heart rate (95), and the splint treatment provided. Based on the notes, the system automatically assigns the clinical tag **"Fracture"**.

### 📋 QA Forms (Quality Check Templates)
* **What it is**: Review checklists.
* **What it is used for**: Standardized checklists and forms used by the quality control team. When reviewing a patient care record, reviewers use these forms to check off requirements, ensuring all fields are filled out correctly according to medical guidelines.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: A QA reviewer needs to audit a cardiac emergency report. They select the "Cardiac Audit Form," which guides them through standard checks: *"Was ECG documented?"*, *"Was Aspirin administered?"*, and *"Was pulse rate recorded?"*

### 🗳️ QA Reviews (Audit Evaluations)
* **What it is**: The record evaluation panel.
* **What it is used for**: Where the QA team reviews submitted records. Reviewers can approve valid records, send records back to paramedics with notes if details are missing, or flag potential issues.
* **Access Level**: QA Reviewers, Physicians, Managers, and Admins.
* **Real-Life Example**: A reviewer finds that a paramedic forgot to record the patient's heart rate. Under QA Reviews, the reviewer marks the record as "Rejected" and leaves a comment: *"Please add the missing baseline heart rate."* The paramedic sees this rejection and updates the record.

### 🛡️ QA Rules (Data Requirements)
* **What it is**: Automatic checks for incoming records.
* **What it is used for**: Rules that check for completeness. For example: *"If a case is marked as Chest Pain, an ECG reading must be uploaded."* If these rules are not met, the system flags the record automatically.
* **Access Level**: Managers, QA Reviewers, and Admins.
* **Real-Life Example**: A paramedic tries to submit a report for a patient with chest pain but leaves the ECG section blank. The QA Rules instantly block the submission and alert the paramedic that an ECG is required.

### 🎛️ Rules Engine (Automated Routing)
* **What it is**: Behind-the-scenes logic coordinator.
* **What it is used for**: Lets administrators set up automated "If-Then" instructions to manage records automatically.
* **Access Level**: Managers, Paramedics, QA Reviewers, and Admins.
* **Real-Life Example**: A manager wants to ensure all pediatric cases are reviewed by the head pediatrician. They set a rule in the engine: *"If patient age is under 12, then assign the QA review to Dr. Kumar."* The system routes these files automatically.

### 🛠️ Form Templates (Form Layout Designer)
* **What it is**: A drag-and-drop form builder.
* **What it is used for**: Allows administrators to customize the layout of medical forms—adding new input fields, checklists, or text areas so paramedics can log details easily.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: The medical director decides that paramedics must start logging blood sugar levels for all diabetic incidents. An admin goes to Form Templates, adds a "Blood Glucose Level" input field to the digital form, and it instantly goes live for all paramedics.

---

## ⚙️ 3. Operations Section
*Handles backend workflows, reports, and team collaboration.*

### 🗺️ Workflows (Process Paths)
* **What it is**: Flowcharts defining a record's lifecycle.
* **What it is used for**: It lists the path a record must follow, such as starting as a paramedic draft, moving to automated QA checks, passing to a reviewer, and then being exported for billing.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: The billing department notices a delay in receiving records. The manager opens the Workflows page to check the step-by-step path a record takes, verifying that records are correctly held in the "QA Review" stage before being unlocked for billing.

### 🚀 Deployments (Active Workflows)
* **What it is**: Active process tracks.
* **What it is used for**: Tracks which version of a workflow is currently live and running in the system.
* **Access Level**: Admins only.
* **Real-Life Example**: The admin team updates the QA review process to include an insurance verification check. They package this as "Workflow Version 2.4" and deploy it using the Deployments screen, activating the new process immediately.

### 📈 Reports (Performance Analytics)
* **What it is**: Statistical summaries and exporting.
* **What it is used for**: Where you generate charts and download reports (CSV/PDF) about team performance, average response times, incident types, and dispatch statistics.
* **Access Level**: Managers, Physicians, QA Reviewers, and Admins.
* **Real-Life Example**: The chief of operations needs to show the city council that response times have improved. They go to Reports, filter for "May 2026," and download a PDF showing that the average transport time was 14 minutes.

### 💬 Feedback (Paramedic-to-QA Chat)
* **What it is**: A secure communication workspace.
* **What it is used for**: Direct chat threads between paramedics and reviewers. If a record is rejected or needs corrections, both parties can discuss the case directly here to clarify clinical details.
* **Access Level**: All staff roles (including Guest Viewers).
* **Real-Life Example**: Paramedic John receives a rejection notification for a record. He opens the Feedback page and chats with QA Reviewer Sarah: *"The patient refused an ECG, should I write that in the notes?"* Sarah replies: *"Yes, just upload the signed refusal form."*

### 🔔 Notifications (System Alerts)
* **What it is**: The platform's inbox.
* **What it is used for**: Displays immediate alerts like: *"New QA Review Assigned"*, *"Record Approved"*, or *"Support Ticket Updated"*.
* **Access Level**: Accessible by all roles.
* **Real-Life Example**: Paramedic Emily Davis logs in and sees a red badge on the bell icon. Clicking it reveals: *"Record #10432 has been approved by QA."*

---

## 🔑 4. Admin Section
*For system administration, user management, and user support.*

### 🏢 Organizations (Clinic Directory)
* **What it is**: Sub-account management.
* **What it is used for**: Managing different hospital branches, dispatch units, or ambulance companies operating under the platform.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: The ambulance service merges with a nearby clinic in Sector 4. The administrator goes to Organizations and adds "Innovixa Sector 4 Branch" to allow Sector 4 staff to use the system.

### 👥 Users (Staff Accounts)
* **What it is**: The team directory.
* **What it is used for**: Managing profiles for paramedics, physicians, QA reviewers, and administrators. Administrators use this to invite new team members, edit emails/passwords, assign user roles, and revoke access.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: A new paramedic joins the crew. The administrator opens the Users menu, clicks "Create User," enters their email, and assigns them the "PARAMEDIC" role so they can log in and write records.

### 🎫 Tickets (Support Helpdesk)
* **What it is**: Application helpdesk panel.
* **What it is used for**: A ticket board that tracks bugs, design errors, or login access requests reported by users via the Support button.
* **Access Level**: Accessible by all roles.
* **Real-Life Example**: A paramedic clicks the floating "Support" button because their photo upload keeps failing. They write a ticket. The administrator sees this ticket under the Tickets menu, updates its status to "In Progress," and resolves the server issue.

### 🖥️ Audit Logs (HIPAA Security Trail)
* **What it is**: System security footprint history.
* **What it is used for**: A timeline logging every single action taken on the system. It records who logged in, who viewed a specific patient chart, and what was modified. This keeps the application fully compliant with federal HIPAA audits.
* **Access Level**: Admins only.
* **Real-Life Example**: A health inspector conducts a HIPAA audit and asks: *"Who viewed Patient John Doe's file on June 15th?"* The security administrator searches John Doe's record ID in the Audit Logs and shows the log proving only the authorized physician, Dr. Kumar, accessed it.

---

## 🔒 5. Compliance Section
*Strict controls to protect patient privacy and comply with health regulations (HIPAA).*

### ✍️ HIPAA Consent (Digital Consent Sheets)
* **What it is**: Patient privacy agreements.
* **What it is used for**: Stores signed digital consent forms showing that patients agreed to treatment and let the platform store their health data.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: An emergency patient is conscious and signs the tablet during treatment. The HIPAA Consent menu stores this electronic signature, proving the patient agreed to let the clinic store their medical records.

### 📢 HIPAA Disclosure (Data Release Registry)
* **What it is**: Records of shared medical data.
* **What it is used for**: A log of every instance where patient data was shared with external systems (like insurers or hospital systems), ensuring that patient data releases are fully documented.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: The billing department sends a patient's treatment summary to Blue Cross Insurance. The system automatically logs this in HIPAA Disclosure, documenting exactly when and why the record was sent outside the platform.

### 🤝 Business Associates (Vendor Compliance Contracts)
* **What it is**: Partner agreement management.
* **What it is used for**: Tracks legal contracts with external companies (like billing servers or cloud hosters) to confirm they conform to HIPAA guidelines.
* **Access Level**: Managers and Admins.
* **Real-Life Example**: The organization contracts a cloud backup vendor. They enter the vendor's details under Business Associates and link the signed Business Associate Agreement (BAA) to verify the data backup is legally secure under HIPAA.

### 🧼 De-Identification (Data Cleaner)
* **What it is**: Privacy-focused data exporter.
* **What it is used for**: If medical data needs to be exported for statistical research or teaching, this tool automatically strips away identifying factors (like names, phone numbers, and SSNs) to keep patients anonymous.
* **Access Level**: Admins only.
* **Real-Life Example**: A university researcher requests data on last month's asthma cases. The administrator uses the De-Identification tool to export 120 records, automatically wiping out names, exact birthdates, and SSNs. The researcher receives the data safely without violating patient privacy.

### 👤 Patient Portal (Patient Dashboard)
* **What it is**: A patient-only login portal.
* **What it is used for**: A portal for patients to view their medical records, download disclosure logs, or manage their own HIPAA consent settings.
* **Access Level**: Patients, Managers, and Admins.
* **Real-Life Example**: Patient John Doe wants to review his medical records after being discharged. He logs into the Patient Portal, downloads his official ePCR PDF, and views a history of which doctors accessed his records.

### 🧬 Patient History (Unified Medical Timelines)
* **What it is**: An all-in-one patient health summary.
* **What it is used for**: Combines a patient's historical vitals, previous visits, medications, allergies, and clinical trends into one secure timeline.
* **Access Level**: Paramedics, Physicians, Managers, and Admins.
* **Real-Life Example**: An emergency crew responds to a repeat patient. Using Patient History, they look up the patient's record and instantly see their baseline vitals from last month and a list of their pre-existing medications, helping them treat the patient safely.

### 🚨 Break-Glass (Emergency Overrides)
* **What it is**: Emergency file bypass.
* **What it is used for**: In life-or-death situations where a paramedic must access a restricted patient record immediately, they can "break the glass" to force open the file. This automatically registers an urgent report to compliance administrators to prevent abuse.
* **Access Level**: Paramedics, Physicians, and Admins.
* **Real-Life Example**: A patient is brought in unconscious and has no ID. Paramedic John needs to check their medical allergies urgently. Because John is not the assigned physician, he clicks "Break-Glass" to override the access block. He views the allergies, and the compliance officer is immediately alerted to verify it was a genuine emergency.

### ⚠️ Critical Follow-Ups (Post-Emergency Monitor)
* **What it is**: Emergency follow-up tracker.
* **What it is used for**: Monitors high-risk cases (like stroke or cardiac arrests) to track their progress and ensure they receive proper post-discharge care.
* **Access Level**: Paramedics, Physicians, and Admins.
* **Real-Life Example**: A patient with severe chest pain is transported to the hospital. The system automatically places them on the Critical Follow-Ups list. The next day, the clinic staff contacts the hospital to confirm the patient was admitted to the cardiology ward, ensuring continuous care.

---

## 📖 6. Help Center

### 📘 User Guide (Responsibilities & Help)
* **What it is**: An interactive, role-based platform manual.
* **What it is used for**: Explains user roles, tasks, the lifecycle flow of patient care records, and provides the demo credentials sandbox and details on using speech-to-text / AI tools.
* **Access Level**: Accessible by all roles.
