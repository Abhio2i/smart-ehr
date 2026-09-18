// Role → Menu map — aligned with verified backend permission matrix
export const ROLE_MENU = {
  ADMIN:       ['Dashboard','Organizations','Users','Tickets','EPCR','Record Shares','Emergency Tracking','QA Forms','QA Reviews','QA Rules','Rules Engine','Form Templates','Workflows','Deployments','Reports','Audit Logs','Feedback','Notifications','HIPAA Consent','HIPAA Disclosure','Patient Portal','Patient History','Break-Glass','Business Associates','De-Identification','Critical Follow-Ups','User Guide','System Settings','Medications','Medical Travel','Bed Management','Patient Scheduling','Waitlist Management','TB Case Management','Retention & Archiving','Ontario Health Integrations','Healthcare Registration','Home Care Dispatch','Surgical Care','Ophthalmology','Dental Care','Long-Term Care','Mental Health','Child & Family Services','Rehabilitation Services','Claims Management','Provider Payments','Quick Pay','Ambulatory Referrals','Lab & Diagnostic Orders','Discharge Management','Non-Medication Orders'],
  MANAGER:     ['Dashboard','EPCR','Organizations','Users','Tickets','Record Shares','Emergency Tracking','QA Forms','QA Reviews','QA Rules','Rules Engine','Form Templates','Workflows','Reports','Feedback','Notifications','HIPAA Consent','HIPAA Disclosure','Patient Portal','Patient History','Break-Glass','Business Associates','De-Identification','Critical Follow-Ups','User Guide','Medications','Medical Travel','Bed Management','Patient Scheduling','Waitlist Management','TB Case Management','Retention & Archiving','Ontario Health Integrations','Healthcare Registration','Home Care Dispatch','Surgical Care','Ophthalmology','Dental Care','Long-Term Care','Mental Health','Child & Family Services','Rehabilitation Services','Claims Management','Provider Payments','Quick Pay','Ambulatory Referrals','Lab & Diagnostic Orders','Discharge Management','Non-Medication Orders'],
  PARAMEDIC:   ['Dashboard','EPCR','Record Shares','Emergency Tracking','Tickets','Feedback','Notifications','Patient History','Rules Engine','Critical Follow-Ups','User Guide','Medications','Medical Travel','Bed Management','Patient Scheduling','Waitlist Management','Ontario Health Integrations','Healthcare Registration','My HC Schedule','Ophthalmology','Dental Care','Long-Term Care','Mental Health','Child & Family Services','Rehabilitation Services','Provider Payments','Quick Pay','Lab & Diagnostic Orders','Discharge Management','Non-Medication Orders'],
  PHYSICIAN:   ['Dashboard','EPCR','Record Shares','Emergency Tracking','Tickets','QA Reviews','Reports','Feedback','Notifications','Patient History','Critical Follow-Ups','User Guide','Medications','Medical Travel','Bed Management','Patient Scheduling','Waitlist Management','TB Case Management','Ontario Health Integrations','Healthcare Registration','Home Care Dispatch','Surgical Care','Ophthalmology','Dental Care','Long-Term Care','Mental Health','Child & Family Services','Rehabilitation Services','Provider Payments','Quick Pay','Ambulatory Referrals','Lab & Diagnostic Orders','Discharge Management','Non-Medication Orders'],
  QA_REVIEWER: ['Dashboard','EPCR','Record Shares','Emergency Tracking','Tickets','QA Reviews','QA Rules','Rules Engine','Reports','Feedback','Notifications','User Guide','Medications','Medical Travel','Ontario Health Integrations','Healthcare Registration','Ophthalmology','Dental Care','Long-Term Care','Mental Health','Child & Family Services','Rehabilitation Services','Lab & Diagnostic Orders','Discharge Management','Non-Medication Orders'],
  THERAPIST:   ['Dashboard','EPCR','Emergency Tracking','Patient History','Rehabilitation Services','Patient Scheduling','Notifications','User Guide','Non-Medication Orders'],
  VIEWER:      ['Dashboard','EPCR','Emergency Tracking','Tickets','Feedback','Notifications','User Guide'],
  PATIENT:     ['Patient Portal', 'Emergency Tracking', 'Notifications', 'User Guide', 'Waitlist Management']
};

// Menu item → route path
export const ROUTE_MAP = {
  Dashboard:           '/dashboard',
  Organizations:       '/organizations',
  Users:               '/users',
  Tickets:             '/tickets',
  EPCR:                '/epcr',
  'Record Shares':     '/shares',
  'QA Forms':          '/qa/forms',
  'QA Reviews':        '/qa/reviews',
  'QA Rules':          '/qa/rules',
  'Rules Engine':      '/rules-engine',
  'Form Templates':    '/form-templates',
  'Workflows':          '/workflows',
  Deployments:         '/deployments',
  Reports:             '/reports',
  'Audit Logs':        '/audit-logs',
  Feedback:            '/feedback',
  Notifications:       '/notifications',
  'HIPAA Consent':     '/hipaa/consent',
  'HIPAA Disclosure':  '/hipaa/disclosure',
  'Patient Portal':    '/patient-portal',
  'Patient History':   '/patient-history',
  'Break-Glass':       '/break-glass',
  'Business Associates': '/hipaa/baa',
  'De-Identification': '/hipaa/deid',
  'Critical Follow-Ups': '/critical-follow-ups',
  'User Guide':        '/user-guide',
  'System Settings':   '/settings',
  'Medications':       '/medications',
  'Medical Travel':    '/medical-travel',
  'Bed Management':    '/beds',
  'Patient Scheduling': '/scheduling',
  'Waitlist Management': '/waitlist',
  'TB Case Management':  '/tb-cases',
  'Retention & Archiving': '/retention',
  'Ontario Health Integrations': '/ontario-integration',
  'Healthcare Registration': '/registration',
  'Home Care Dispatch': '/homecare/dispatch',
  'My HC Schedule':    '/homecare/schedule',
  'Surgical Care':     '/surgical/or-board',
  'Ophthalmology':    '/ophthalmology',
  'Dental Care':      '/dental',
  'Long-Term Care':   '/ltc',
  'Mental Health':    '/mental-health',
  'Child & Family Services': '/child-family-services',
  'Rehabilitation Services': '/rehab',
  'Claims Management': '/billing/claims',
  'Provider Payments': '/billing/payouts',
  'Quick Pay':         '/billing/quick-pay',
  'Ambulatory Referrals': '/ambulatory-referrals',
  'Emergency Tracking': '/ed-tracking',
  'Lab & Diagnostic Orders': '/clinical/labs',
  'Discharge Management': '/clinical/discharge',
  'Non-Medication Orders': '/clinical/non-med-orders',
};

export const hasMenuAccess = (role, menuItem) =>
  ROLE_MENU[role]?.includes(menuItem) ?? false;

export const canAccess = (role, ...items) =>
  items.every(item => hasMenuAccess(role, item));

export const ROLES = {
  ADMIN:       'ADMIN',
  MANAGER:     'MANAGER',
  PARAMEDIC:   'PARAMEDIC',
  PHYSICIAN:   'PHYSICIAN',
  QA_REVIEWER: 'QA_REVIEWER',
  VIEWER:      'VIEWER',
  PATIENT:     'PATIENT',
};

// Demo credentials — only available in development builds (stripped from production by Vite)
export const DEMO_CREDENTIALS = import.meta.env.DEV ? [
  { role: 'ADMIN',       email: 'admin@metroems.com',        password: 'Password@123' },
  { role: 'MANAGER',     email: 'manager@metroems.com',      password: 'Password@123' },
  { role: 'PARAMEDIC',   email: 'john.smith@metroems.com',    password: 'Password@123' },
  { role: 'PARAMEDIC',   email: 'emily.davis@metroems.com',   password: 'Password@123' },
  { role: 'PARAMEDIC',   email: 'robert.wilson@metroems.com', password: 'Password@123' },
  { role: 'PARAMEDIC',   email: 'jessica.brown@metroems.com', password: 'Password@123' },
  { role: 'PHYSICIAN',   email: 'dr.kumar@metroems.com',     password: 'Password@123' },
  { role: 'QA_REVIEWER', email: 'qa.reviewer1@metroems.com', password: 'Password@123' },
  { role: 'QA_REVIEWER', email: 'qa.reviewer2@metroems.com', password: 'Password@123' },
  { role: 'VIEWER',      email: 'viewer@metroems.com',       password: 'Password@123' },
  { role: 'VIEWER',      email: 'viewer2@metroems.com',      password: 'Password@123' },
] : [];
