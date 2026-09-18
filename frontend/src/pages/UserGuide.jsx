import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  BookOpen, ShieldCheck, LifeBuoy, CheckCircle2, User, 
  FileText, ClipboardList, Zap, HelpCircle as HelpIcon,
  Sparkles, ChevronDown, ChevronUp, Mic, Lock, Clipboard, Layers
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectRole } from '../store/slices/authSlice';
import { ROLE_MENU } from '../constants/permissions';

const ROLE_DETAILS = {
  ADMIN: {
    title: 'System Administrator',
    color: 'border-rose-500 text-rose-600 bg-rose-50',
    description: 'Manage full oversight and system-wide administration of the platform.',
    tasks: [
      'Create, update, and manage staff accounts and user security roles',
      'Monitor system-wide HIPAA logs and security audit trails',
      'Configure workflow paths, deployments, and organization parameters',
      'Address and resolve technical support tickets submitted by staff'
    ]
  },
  MANAGER: {
    title: 'Operations Manager',
    color: 'border-blue-500 text-blue-600 bg-blue-50',
    description: 'Design medical and administrative workflows, operations, and templates.',
    tasks: [
      'Design templates for patient intake and clinical assessments',
      'Build and assign evaluation templates and QA forms for reviewers',
      'Construct automated validation rules (QA Rules) for clinical compliance',
      'Review operational analytics, performance reports, and compliance scores'
    ]
  },
  PARAMEDIC: {
    title: 'Emergency Paramedic',
    color: 'border-amber-500 text-amber-600 bg-amber-50',
    description: 'Provide emergency care on-scene and perform initial patient charting.',
    tasks: [
      'Complete and submit Electronic Patient Care Records (EPCR) in the field',
      'Log baseline patient vitals, incident timeline, and drugs administered',
      'Review QA auditor feedback and correct any rejected chart errors',
      'Monitor critical post-discharge follow-up protocols'
    ]
  },
  QA_REVIEWER: {
    title: 'Clinical QA Reviewer',
    color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
    description: 'Verify the accuracy and protocol compliance of submitted clinical charts.',
    tasks: [
      'Inspect automated warning flags and validation warnings on records',
      'Complete audit checklists and assign clinical quality compliance scores',
      'Approve valid records (locking them for billing) or reject records needing revision',
      'Open feedback chat threads to resolve protocol questions with paramedics'
    ]
  },
  PHYSICIAN: {
    title: 'Clinical Oversight Physician',
    color: 'border-violet-500 text-violet-600 bg-violet-50',
    description: 'Review specialized clinical timelines, perform expert audits, and approve patient data amendments.',
    tasks: [
      'Examine comprehensive patient history, diagnostics, and clinical timelines',
      'Review Gemini AI diagnostic suggestions, concerns, and clinical Q&A logs',
      'Evaluate and approve patient requests to amend or correct medical records',
      'Oversee critical follow-up registries and high-risk case reports'
    ]
  },
  VIEWER: {
    title: 'Guest / Auditor Viewer',
    color: 'border-slate-400 text-slate-600 bg-slate-50 border-dashed',
    description: 'Read-only access to basic dashboards, support tickets, system-wide notifications, and incident discussions.',
    tasks: [
      'Monitor clinical compliance rates and active case volume via the Dashboard',
      'Read system-wide notifications and alerts',
      'Review support tickets submitted by staff members',
      'View paramedic-to-QA feedback threads for general auditing'
    ]
  },
  PATIENT: {
    title: 'Patient Portal Account',
    color: 'border-teal-500 text-teal-600 bg-teal-50',
    description: 'Access and download personal medical records, manage data sharing, and specify privacy preferences.',
    tasks: [
      'Download and review signed HIPAA consent authorization documents',
      'Monitor data disclosure history and track who has viewed personal charts',
      'Submit formal amendment requests to correct errors in personal medical history',
      'Set strict privacy and data sharing preferences (opt-in/opt-out settings)'
    ]
  }
};

const ROLE_DETAILS_FR = {
  ADMIN: {
    title: 'Administrateur système (ADMIN)',
    color: 'border-rose-500 text-rose-600 bg-rose-50',
    description: 'Gestion complète de la plateforme et administration globale du système.',
    tasks: [
      'Créer, mettre à jour et gérer les comptes du personnel et les rôles de sécurité',
      'Surveiller les journaux HIPAA et la piste d\'audit de sécurité',
      'Configurer les flux de travail, déploiements et paramètres d\'organisation',
      'Traiter et résoudre les billets de support technique soumis par le personnel'
    ]
  },
  MANAGER: {
    title: 'Gestionnaire des opérations (MANAGER)',
    color: 'border-blue-500 text-blue-600 bg-blue-50',
    description: 'Conception des flux de travail médicaux, opérationnels et des modèles.',
    tasks: [
      'Concevoir des modèles pour la prise en charge des patients et les évaluations cliniques',
      'Créer et assigner des formulaires d\'assurance qualité (AQ) pour les réviseurs',
      'Construire des règles de validation automatique (règles AQ) pour la conformité',
      'Examiner les analyses opérationnelles, rapports de performance et scores de conformité'
    ]
  },
  PARAMEDIC: {
    title: 'Paramédic d\'urgence (PARAMEDIC)',
    color: 'border-amber-500 text-amber-600 bg-amber-50',
    description: 'Fournir des soins d\'urgence sur le terrain et consigner les premiers dossiers.',
    tasks: [
      'Remplir et soumettre des dossiers de soins électroniques (ePCR) sur le terrain',
      'Enregistrer les signes vitaux de base, le chronogramme et les médicaments administrés',
      'Consulter les retours des réviseurs AQ et corriger les erreurs de dossier',
      'Surveiller les protocoles de suivi critiques post-libération'
    ]
  },
  QA_REVIEWER: {
    title: 'Réviseur qualité clinique (QA_REVIEWER)',
    color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
    description: 'Vérifier la précision et la conformité aux protocoles des dossiers cliniques.',
    tasks: [
      'Inspecter les avertissements automatiques et drapeaux de validation sur les dossiers',
      'Remplir les listes de contrôle d\'audit et attribuer des scores de qualité',
      'Approuver les dossiers valides ou rejeter ceux nécessitant des révisions',
      'Ouvrir des fils de discussion avec les paramédics pour résoudre les questions'
    ]
  },
  PHYSICIAN: {
    title: 'Médecin superviseur (PHYSICIAN)',
    color: 'border-violet-500 text-violet-600 bg-violet-50',
    description: 'Examiner les chronologies cliniques spécialisées et approuver les modifications de données.',
    tasks: [
      'Examiner l\'historique complet des patients, les diagnostics et les courbes vitales',
      'Examiner les suggestions d\'IA Gemini, préoccupations et journaux de questions',
      'Évaluer et approuver les demandes de modification des dossiers médicaux',
      'Superviser les registres de suivis critiques et cas à haut risque'
    ]
  },
  VIEWER: {
    title: 'Observateur / Auditeur invité (VIEWER)',
    color: 'border-slate-400 text-slate-600 bg-slate-50 border-dashed',
    description: 'Accès en lecture seule aux tableaux de bord, billets de support et notifications.',
    tasks: [
      'Surveiller les taux de conformité et le volume de cas actifs via le tableau de bord',
      'Lire les notifications et alertes système',
      'Examiner les billets de support soumis par le personnel',
      'Consulter les discussions entre paramédics et réviseurs AQ'
    ]
  },
  PATIENT: {
    title: 'Compte portail patient (PATIENT)',
    color: 'border-teal-500 text-teal-600 bg-teal-50',
    description: 'Accéder aux dossiers médicaux personnels, les télécharger et gérer la confidentialité.',
    tasks: [
      'Télécharger et consulter les documents d\'autorisation HIPAA signés',
      'Surveiller l\'historique de divulgation des données personnelles',
      'Soumettre des demandes de modification formelles pour corriger des erreurs',
      'Définir des préférences de confidentialité et de partage de données'
    ]
  }
};

const MENU_DESCRIPTIONS = {
  Dashboard: 'The main dashboard displaying real-time compliance rates, draft/pending QA charts count, response times, and active system alerts.',
  Organizations: 'Management pane to create, configure, and monitor clinic branches, ambulance fleets, and external agency partners.',
  Users: 'Staff account directory to invite crew members, reset passwords, update personal details, and configure RBAC roles.',
  Tickets: 'Internal helpdesk tracking platform issues, bugs, and feedback tickets submitted by paramedics or other staff.',
  EPCR: 'Digital charting portal where paramedics write new emergency records, input patient details, vitals, drugs, and submit to QA.',
  'QA Forms': 'Template creator to design clinical checklists and compliance rubrics for specific emergencies (e.g., Cardiac, Stroke).',
  'QA Reviews': 'Evaluations portal where auditors inspect submitted EPCRs, grade clinical performance, and approve/reject charts.',
  'QA Rules': 'Validation engine interface where managers declare logical rules (e.g., "ECG required if chest pain is selected").',
  'Rules Engine': 'Logical router that automatically executes backend actions (e.g., auto-routing reviews or issuing automated patient emails).',
  'Form Templates': 'Custom drag-and-drop form builder to layout inputs, toggles, and sections for the electronic medical chart.',
  Workflows: 'Process manager mapping out the strict step-by-step lifecycle flow of medical files from draft to archive.',
  Deployments: 'Release pane displaying live workflow versions running across the organization.',
  Reports: 'Analytics console generating performance statistics, response times, and enabling CSV/PDF clinical exports.',
  'Audit Logs': 'Comprehensive, immutable database logging every user login, page view, and record access to satisfy federal HIPAA audits.',
  Feedback: 'Secure real-time chat workspace connecting paramedics and QA reviewers to coordinate corrections on rejected charts.',
  Notifications: 'Inbox highlighting active tasks, chart status approvals, support updates, and emergency overrides.',
  'HIPAA Consent': 'Protected storage displaying signed digital agreements proving patients authorized data storage.',
  'HIPAA Disclosure': 'Release logs documenting every transmission of patient records to external systems (e.g., insurance companies).',
  'Patient Portal': 'Patient-facing portal where patients securely review their charts, sign consents, and track access disclosures.',
  'Patient History': 'Aggregated health records timeline combining history, allergies, medications, and vitals trend charts.',
  'Break-Glass': 'Emergency security bypass enabling immediate viewing of restricted files, with automatic compliance triggers.',
  'Business Associates': 'Directory tracking signed contracts (BAAs) with external vendors to verify legal HIPAA compliance.',
  'De-Identification': 'Data scrubber that anonymizes clinical datasets by removing PII (names, SSNs) before research export.',
  'Critical Follow-Ups': 'Safety registry tracking high-risk patients post-discharge to verify continuity of emergency treatment.',
  'User Guide': 'Interactive platform manual describing roles, workflows, permissions, and voice/AI features instructions.'
};

const MENU_DESCRIPTIONS_FR = {
  Dashboard: 'Tableau de bord principal affichant le taux de conformité en temps réel, le nombre de dossiers AQ en attente, le temps de réponse et les alertes.',
  Organizations: 'Volet de gestion pour créer, configurer et surveiller les succursales cliniques, ambulances et partenaires externes.',
  Users: 'Répertoire du personnel pour inviter les membres d\'équipage, réinitialiser les mots de passe et configurer les rôles d\'accès.',
  Tickets: 'Centre d\'assistance interne pour le suivi des problèmes de plateforme et des billets de commentaires.',
  EPCR: 'Portail de saisie numérique où les paramédics créent des dossiers d\'urgence, saisissent les constantes vitales et les soumettent à l\'AQ.',
  'QA Forms': 'Créateur de modèles pour concevoir des listes de contrôle cliniques et des grilles de conformité pour les urgences spécifiques.',
  'QA Reviews': 'Portail d\'évaluation où les auditeurs inspectent les ePCR soumis, évaluent la performance et approuvent ou rejettent les dossiers.',
  'QA Rules': 'Interface du moteur de validation où les gestionnaires déclarent les règles logiques de conformité.',
  'Rules Engine': 'Routeur logique qui exécute automatiquement des actions backend.',
  'Form Templates': 'Générateur de formulaires personnalisés à glisser-déposer pour concevoir les champs du dossier médical.',
  Workflows: 'Gestionnaire de processus traçant le cycle de vie étape par étape des dossiers médicaux.',
  Deployments: 'Volet d\'affichage des versions de flux de travail en direct.',
  Reports: 'Console d\'analyse générant des statistiques de performance et permettant les exportations cliniques CSV/PDF.',
  'Audit Logs': 'Base de données immuable enregistrant chaque connexion, affichage de page et accès aux dossiers pour la conformité HIPAA.',
  Feedback: 'Espace de discussion en temps réel reliant paramédics et réviseurs AQ pour corriger les dossiers rejetés.',
  Notifications: 'Boîte de réception soulignant les tâches actives, approbations et alertes d\'urgence.',
  'HIPAA Consent': 'Stockage protégé affichant les autorisations numériques signées par les patients.',
  'HIPAA Disclosure': 'Journaux de divulgation documentant chaque transmission de dossiers vers des systèmes externes.',
  'Patient Portal': 'Portail patient où les patients consultent en toute sécurité leurs dossiers et signent des consentements.',
  'Patient History': 'Chronologie agrégée des dossiers de santé combinant antécédents, allergies et courbes des constantes vitales.',
  'Break-Glass': 'Déverrouillage d\'urgence de sécurité permettant la consultation immédiate des dossiers restreints.',
  'Business Associates': 'Répertoire assurant le suivi des contrats signés (BAA) avec des fournisseurs externes.',
  'De-Identification': 'Module d\'anonymisation des données cliniques en supprimant les identifiants personnels.',
  'Critical Follow-Ups': 'Registre de sécurité assurant le suivi des patients à haut risque après la libération.',
  'User Guide': 'Manuel interactif décrivant les rôles, flux de travail, autorisations et instructions sur les fonctionnalités vocales et IA.'
};

const VISIT_STEPS = [
  {
    role: 'PARAMEDIC',
    title: '1. Incident & Charting',
    desc: 'Patient John has an acute reaction. Paramedic Sarah responds, treats him, and creates an ePCR draft. She dictates notes using Voice-to-ePCR, and clicks Submit.',
    tip: 'Tip: Use Voice-to-ePCR to speak details naturally to auto-fill fields.'
  },
  {
    role: 'SYSTEM',
    title: '2. Auto-Validation',
    desc: 'The Rules Engine immediately scans the submitted record. If vital metrics or required fields (like ECG for chest pain) are missing, it tags the record with warning flags.',
    tip: 'Tip: Rules ensure HIPAA compliance and clinical protocol completion.'
  },
  {
    role: 'QA_REVIEWER',
    title: '3. Quality Audit',
    desc: 'QA Reviewer Dr. Miller accesses the pending queue, reviews the ePCR against compliance rubrics, gives a score (e.g., 95%), and approves the chart.',
    tip: 'Tip: Approved records are instantly locked for billing.'
  },
  {
    role: 'SYSTEM',
    title: '4. Notification',
    desc: 'The platform triggers an automated SMS/alert. Patient John receives a notification on his phone, and a red badge displays on the bell icon in his portal.',
    tip: 'Tip: Patients access their portal securely using OTP login.'
  },
  {
    role: 'PATIENT',
    title: '5. Patient Review',
    desc: 'John logs into the Patient Portal. He reviews his vitals tracking chart showing stabilization, downloads his official PDF, and reviews signed consent forms.',
    tip: 'Tip: Full transparency builds patient confidence.'
  },
  {
    role: 'PATIENT',
    title: '6. Amendment Request',
    desc: 'John remembers a pre-existing allergy. He submits an Amendment Request to correct his historical health record in the database.',
    tip: 'Tip: Patients can specify privacy levels (opt-out of external disclosures).'
  },
  {
    role: 'PHYSICIAN',
    title: '7. Medical Sign-off',
    desc: 'Physician Dr. Smith receives the amendment request. He verifies John\'s clinical timeline, checks the AI suggestion warnings, and approves the change.',
    tip: 'Tip: Approving updates the master patient history timeline securely.'
  },
  {
    role: 'ADMIN',
    title: '8. Security Audit',
    desc: 'Every single step—logins, record views, AI suggestions, and edits—is logged in the immutable Audit Logs page, ensuring 100% HIPAA audit compliance.',
    tip: 'Tip: This keeps the clinic safe from federal regulatory penalties.'
  }
];

const VISIT_STEPS_FR = [
  {
    role: 'PARAMEDIC',
    title: '1. Incident et saisie du dossier',
    desc: 'Le patient Jean a une réaction aiguë. La paramédic Sarah intervient, le traite et crée un projet ePCR. Elle dicte les notes avec la saisie vocale et clique sur Soumettre.',
    tip: 'Conseil : Utilisez la dictée vocale ePCR pour dicter les détails naturellement.'
  },
  {
    role: 'SYSTEM',
    title: '2. Validation automatique',
    desc: 'Le moteur de règles analyse immédiatement le dossier soumis. Si des constantes importantes ou des champs requis (comme un ECG) sont manquants, il ajoute des avertissements.',
    tip: 'Conseil : Les règles garantissent la conformité HIPAA et le respect des protocoles.'
  },
  {
    role: 'QA_REVIEWER',
    title: '3. Audit de qualité',
    desc: 'Le réviseur AQ accède à la file d\'attente, évalue l\'ePCR par rapport aux grilles de conformité, attribue une note (ex. 95 %) et approuve le dossier.',
    tip: 'Conseil : Les dossiers approuvés sont immédiatement verrouillés pour la facturation.'
  },
  {
    role: 'SYSTEM',
    title: '4. Notification automatique',
    desc: 'La plateforme déclenche une alerte/SMS automatique. Le patient Jean reçoit une notification sur son téléphone et un badge apparaît sur l\'icône de cloche.',
    tip: 'Conseil : Les patients accèdent en toute sécurité à leur portail avec une connexion OTP.'
  },
  {
    role: 'PATIENT',
    title: '5. Consultation par le patient',
    desc: 'Jean se connecte au portail patient. Il consulte le graphique de suivi de ses constantes, télécharge son PDF officiel et revoit les formulaires signés.',
    tip: 'Conseil : Une transparence totale renforce la confiance des patients.'
  },
  {
    role: 'PATIENT',
    title: '6. Demande de modification',
    desc: 'Jean se rappelle d\'une allergie préexistante. Il soumet une demande de modification pour corriger son dossier de santé dans la base de données.',
    tip: 'Conseil : Les patients peuvent définir leurs niveaux de confidentialité.'
  },
  {
    role: 'PHYSICIAN',
    title: '7. Validation médicale',
    desc: 'Le médecin reçoit la demande de modification. Il vérifie la chronologie clinique du patient, consulte les avertissements de l\'IA et approuve la modification.',
    tip: 'Conseil : L\'approbation met à jour la chronologie historique du patient en toute sécurité.'
  },
  {
    role: 'ADMIN',
    title: '8. Audit de sécurité',
    desc: 'Chaque étape (connexions, vues de dossiers, suggestions d\'IA et modifications) est consignée dans la page d\'audit immuable, garantissant 100 % de conformité.',
    tip: 'Conseil : Cela protège l\'établissement contre les sanctions réglementaires.'
  }
];

const FAQ_ITEMS = [
  {
    question: 'How does the Patient Record (EPCR) validation rules flow work?',
    answer: 'Managers define validation rules (e.g., if transport mode is Emergency, care level must be ALS). When a paramedic submits a record, the engine scans the data. If a rule is violated, the system stamps an auto-flag (Critical Warning) on the record and alerts the QA Reviewer.'
  },
  {
    question: 'How do I complete a QA Review?',
    answer: 'The auditor opens a pending record in the QA Reviews queue and clicks "Complete Review". This renders the questions from the active QA Form. After answering the questions, assigning a score, and toggling PASS/FAIL, saving the review locks the record and marks it as approved for billing.'
  },
  {
    question: 'How does the Gemini Clinical AI Suggestion & Voice Q&A work?',
    answer: 'In the physician portal, the Gemini suggestions panel analyzes the record to display risk scores, clinical findings, concerns, and missing data warnings. In the "Ask Doctor Q&A" tab, you can click the mic icon to ask questions by voice. The system records continuously and auto-submits after 2.5 seconds of silence. Clicking the speaker icon reads the AI response out loud.'
  },
  {
    question: 'What is the Break-Glass override protocol?',
    answer: 'In critical emergencies, restricted patient charts can be opened by clicking the "Break-Glass" button and entering a justification. Access is granted immediately, and a high-priority audit log notification is sent to the compliance team.'
  }
];

const FAQ_ITEMS_FR = [
  {
    question: 'Comment fonctionne le flux de règles de validation des dossiers patients (ePCR) ?',
    answer: 'Les gestionnaires définissent des règles de validation (ex. si le mode de transport est Urgence, le niveau de soins doit être ALS). Lorsqu\'un paramédic soumet un dossier, le moteur analyse les données. Si une règle est enfreinte, le système appose un drapeau d\'avertissement critique et alerte le réviseur AQ.'
  },
  {
    question: 'Comment effectuer une révision d\'assurance qualité (AQ) ?',
    answer: 'L\'auditeur ouvre un dossier en attente dans la file d\'attente des révisions AQ et clique sur "Effectuer la révision". Cela affiche le formulaire d\'AQ actif. Après avoir répondu aux questions, attribué une note et sélectionné SUCCÈS/ÉCHEC, l\'enregistrement verrouille le dossier et le marque comme approuvé pour la facturation.'
  },
  {
    question: 'Comment fonctionnent les suggestions de l\'IA médicale Gemini et les Q&R vocales ?',
    answer: 'Dans le portail médecin, le panneau de suggestions Gemini analyse le dossier pour afficher les scores de risque, constatations cliniques, préoccupations et données manquantes. Dans l\'onglet "Questions au médecin", vous pouvez cliquer sur l\'icône du micro pour poser des questions à la voix. Le système enregistre et soumet automatiquement après 2,5 secondes de silence.'
  },
  {
    question: 'Qu\'est-ce que le protocole de déverrouillage d\'urgence (Break-Glass) ?',
    answer: 'Lors d\'urgences vitales critiques, les dossiers médicaux restreints peuvent être ouverts en cliquant sur le bouton "Accès d\'urgence (Break-Glass)" et en saisissant une justification. L\'accès est accordé immédiatement et une alerte prioritaire est transmise à l\'équipe de conformité.'
  }
];

const UserGuide = () => {
  const currentRole = useSelector(selectRole);
  const { t, lang } = useLanguage();
  const [selectedRole, setSelectedRole] = useState(ROLE_DETAILS[currentRole] ? currentRole : 'PARAMEDIC');
  const [openFaq, setOpenFaq] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const isFr = lang === 'fr';
  const roleMap = isFr ? ROLE_DETAILS_FR : ROLE_DETAILS;
  const activeRoleData = roleMap[selectedRole] || ROLE_DETAILS[selectedRole];
  const menuDescMap = isFr ? MENU_DESCRIPTIONS_FR : MENU_DESCRIPTIONS;
  const visitSteps = isFr ? VISIT_STEPS_FR : VISIT_STEPS;
  const faqItems = isFr ? FAQ_ITEMS_FR : FAQ_ITEMS;

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-6xl mx-auto px-4 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-[#EEF2FF] rounded-2xl flex items-center justify-center text-brand-blue shadow-md">
          <BookOpen size={24} />
        </div>
        <div>
          <p className="section-label mb-0.5">{isFr ? "CENTRE D'AIDE DE L'APPLICATION" : "APPLICATION HELP CENTER"}</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            {isFr ? "Guide de l'utilisateur et " : "User Guide & "}
            <span className="text-brand-blue">{isFr ? "responsabilités" : "Responsibilities"}</span>
          </h1>
          <p className="text-xs text-[#8A97B0]">
            {isFr ? "Règles de la plateforme, guide des fonctionnalités et flux opérationnels cliniques" : "Platform rules, features guide, and clinical operational workflows"}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar Controls */}
        <div className="space-y-4">
          
          {/* Role Selector */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={13} className="text-brand-blue" /> {isFr ? "CHOSIR LE RÔLE DU PERSONNEL" : "CHOOSE STAFF ROLE"}
            </h3>
            <div className="space-y-2">
              {Object.keys(ROLE_DETAILS).map(roleKey => {
                const isActive = selectedRole === roleKey;
                const rTitle = (roleMap[roleKey] || ROLE_DETAILS[roleKey]).title;
                return (
                  <button
                    key={roleKey}
                    onClick={() => setSelectedRole(roleKey)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive 
                        ? 'border-brand-blue bg-[#EEF2FF] text-brand-blue font-bold shadow-sm' 
                        : 'border-[#DDE3F0] hover:border-brand-blue hover:bg-slate-50 text-[#4B5A7A]'
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider">{rTitle}</span>
                    {isActive && <CheckCircle2 size={13} className="text-brand-blue" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Help Links */}
          <div className="card p-5 bg-gradient-to-br from-[#1A3C8F] to-[#0F2660] text-white">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mb-3">
              <LifeBuoy size={16} />
            </div>
            <h3 className="font-black text-sm mb-1 text-white">{isFr ? "Besoin d'aide en direct ?" : "Need Live Help?"}</h3>
            <p className="text-[10px] text-white/70 leading-relaxed mb-4">
              {isFr ? "Si vous rencontrez des problèmes techniques sur la plateforme, cliquez ci-dessous pour soumettre un billet de support interne." : "If you encounter any technical issues on the platform, click below to submit an internal support ticket."}
            </p>
            <a href="/tickets" className="btn-primary bg-brand-red hover:bg-brand-red-dark w-full justify-center py-2 text-xs">
              {isFr ? "Aller aux billets de support" : "Go to Support Tickets"}
            </a>
          </div>
        </div>

        {/* Roles & Tasks Detail View */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Role Description Card */}
          <div className="card p-6 space-y-5 animate-slide-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0F4FC] pb-4">
              <div>
                <span className={`badge ${activeRoleData.color} text-[9px] font-black tracking-widest`}>
                  {isFr ? `RÔLE ${selectedRole}` : `${selectedRole} ROLE`}
                </span>
                <h2 className="text-lg font-black text-[#0F1A3A] mt-1">{activeRoleData.title}</h2>
              </div>
              {currentRole === selectedRole && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  <CheckCircle2 size={11} /> {isFr ? "Votre rôle assigné" : "Your Assigned Role"}
                </span>
              )}
            </div>

            <p className="text-xs font-medium text-[#4B5A7A] leading-relaxed">{activeRoleData.description}</p>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">
                {isFr ? "Responsabilités clés" : "Key Responsibilities"}
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {activeRoleData.tasks.map((task, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl border border-[#DDE3F0] bg-[#F8FAFF]">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[9px] font-black shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs text-[#0F1A3A] font-semibold leading-relaxed">{task}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Menu & Page Access Explorer */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
              <Layers size={14} className="text-brand-blue" />
              <h3 className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">
                {isFr ? "PAGES ACCESSIBLES ET GUIDE DES OUTILS" : "Accessible Pages & Tool Guide"}
              </h3>
            </div>
            <p className="text-xs text-[#8A97B0]">
              {isFr ? (
                <>Sous le rôle sélectionné <span className="font-bold text-[#0F1A3A]">{selectedRole}</span>, vous avez accès aux {ROLE_MENU[selectedRole]?.length || 0} pages suivantes :</>
              ) : (
                <>Under the selected <span className="font-bold text-[#0F1A3A]">{selectedRole}</span> role, you have access to the following {ROLE_MENU[selectedRole]?.length || 0} platform pages:</>
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {ROLE_MENU[selectedRole]?.map(menu => (
                <div key={menu} className="p-3 rounded-xl border border-[#DDE3F0] bg-white hover:border-brand-blue/30 transition-all flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F1A3A] flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue shrink-0"></span>
                      {t(menu) || menu}
                    </h4>
                    <p className="text-[10px] text-[#4B5A7A] leading-relaxed">
                      {menuDescMap[menu] || 'Détail de l\'écran de la plateforme.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clickable Patient Visit Timeline */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
              <Sparkles size={14} className="text-violet-600" />
              <h3 className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">
                {isFr ? "Cycle de vie interactif des soins aux patients" : "Interactive Patient Care Lifecycle"}
              </h3>
            </div>
            <p className="text-xs text-[#8A97B0]">
              {isFr ? "Cliquez sur les étapes ci-dessous pour voir comment les différents rôles collaborent dans un scénario réel de soins aux patients :" : "Click through the steps below to see how different roles work together in a real-life patient care scenario:"}
            </p>
            
            {/* Timeline circles */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-[#F0F4FC] scrollbar-thin">
              {visitSteps.map((step, idx) => {
                const isActive = activeStep === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={`flex flex-col items-center min-w-[90px] cursor-pointer transition-all duration-200 p-1.5 rounded-lg ${
                      isActive ? 'scale-105 font-bold text-brand-blue bg-[#EEF2FF]' : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mb-1 ${
                      isActive ? 'bg-brand-blue text-white shadow' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-wider text-center line-clamp-1 max-w-[80px]">
                      {step.role}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Step Details */}
            <div className="p-4.5 rounded-xl border border-slate-100 bg-[#FAFBFF] space-y-2.5 animate-slide-up">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-[#0F1A3A]">
                  {visitSteps[activeStep].title}
                </h4>
                <span className="badge border-blue-500 text-blue-600 bg-blue-50 text-[9px] font-black tracking-widest uppercase">
                  {isFr ? `Rôle : ${visitSteps[activeStep].role}` : `Role: ${visitSteps[activeStep].role}`}
                </span>
              </div>
              <p className="text-xs text-[#4B5A7A] leading-relaxed">
                {visitSteps[activeStep].desc}
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-start gap-2">
                <CheckCircle2 size={12} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-[10px] font-semibold text-emerald-800 leading-relaxed m-0">
                  {visitSteps[activeStep].tip}
                </p>
              </div>
            </div>
          </div>

          {/* Voice & AI Assistant Help Guides */}
          <div className="card p-6 space-y-5">
            <h3 className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider border-b border-[#F0F4FC] pb-3 flex items-center gap-1.5">
              <Mic size={13} className="text-brand-blue animate-pulse" /> {isFr ? "Fonctionnalités avancées de voix et d'IA" : "Advanced Voice & AI Features"}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(isFr ? [
                { 
                  title: 'Recherche vocale (Alt+V)', 
                  icon: Mic, 
                  desc: 'Appuyez sur Alt+V ou cliquez sur le bouton microphone flottant en bas à droite. Énoncez le nom d\'un patient pour trouver immédiatement ses dossiers ePCR.', 
                  color: 'text-blue-600 bg-blue-50' 
                },
                { 
                  title: 'Dictée vocale ePCR', 
                  icon: FileText, 
                  desc: 'Dans le formulaire ePCR, cliquez sur Dictée vocale et énoncez les observations du patient. L\'IA les analyse pour remplir automatiquement les champs.', 
                  color: 'text-emerald-600 bg-emerald-50' 
                },
                { 
                  title: 'Assistant Q&R Gemini', 
                  icon: Sparkles, 
                  desc: 'Dans le portail médecin, posez des questions à la voix sur les diagnostics du patient. Écoutez les réponses traitées lues à haute voix.', 
                  color: 'text-violet-600 bg-violet-50' 
                },
                { 
                  title: 'Accès d\'urgence Break-Glass', 
                  icon: Lock, 
                  desc: 'Déverrouillez instantanément l\'accès aux dossiers lors de soins d\'urgence vitale. Déclenche des alertes prioritaires et des journaux d\'audit.', 
                  color: 'text-rose-600 bg-rose-50' 
                }
              ] : [
                { 
                  title: 'Voice Search (Alt+V)', 
                  icon: Mic, 
                  desc: 'Press Alt+V or click the floating microphone button in the lower right. Say a patient\'s name to immediately find and open their EPCR records.', 
                  color: 'text-blue-600 bg-blue-50' 
                },
                { 
                  title: 'Voice-to-ePCR Dictation', 
                  icon: FileText, 
                  desc: 'Inside the EPCR creation form, click Voice-to-ePCR and dictate patient metrics/observations. AI parses this to auto-fill fields with color-coded feedback.', 
                  color: 'text-emerald-600 bg-emerald-50' 
                },
                { 
                  title: 'Gemini Q&A Assistant', 
                  icon: Sparkles, 
                  desc: 'In the physician portal, speak or type queries about patient diagnostics. Hear processed answers read aloud using the text-to-speech option.', 
                  color: 'text-violet-600 bg-violet-50' 
                },
                { 
                  title: 'Emergency Break-Glass', 
                  icon: Lock, 
                  desc: 'Instantly bypass file access locks during critical life-saving care. Triggers high-priority notifications and generates audits for compliance oversight.', 
                  color: 'text-rose-600 bg-rose-50' 
                }
              ]).map((item, i) => (
                <div key={i} className="p-4 rounded-xl border border-[#DDE3F0] hover:border-brand-blue/30 transition-all space-y-2 bg-[#FAFBFF]">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${item.color}`}>
                      <item.icon size={13} />
                    </div>
                    <h4 className="text-xs font-bold text-[#0F1A3A]">{item.title}</h4>
                  </div>
                  <p className="text-[10px] text-[#4B5A7A] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Accordion FAQ Guide */}
          <div className="card p-6 space-y-4">
            <h3 className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider border-b border-[#F0F4FC] pb-3 flex items-center gap-1.5">
              <HelpIcon size={13} className="text-brand-blue" /> {isFr ? "Foire aux questions opérationnelles (FAQ)" : "Operational FAQs"}
            </h3>
            <div className="space-y-2">
              {faqItems.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className="rounded-xl border border-[#DDE3F0] overflow-hidden transition-all bg-[#FAFBFF]">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-xs font-bold text-[#0F1A3A] pr-4">{faq.question}</span>
                      <span className="text-[#A0AECB] shrink-0">
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#F0F4FC] bg-white">
                        <p className="text-xs text-[#4B5A7A] leading-relaxed pt-2">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default UserGuide;
