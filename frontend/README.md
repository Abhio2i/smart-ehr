<div align="center">

# 🚑 MedEPCR — Electronic Patient Care Records

**A production-grade healthcare web application for EMS professionals**

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Redux](https://img.shields.io/badge/Redux_Toolkit-2-764ABC?style=for-the-badge&logo=redux&logoColor=white)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Role-Based Access](#-role-based-access)
- [API Integration](#-api-integration)
- [Deployment](#-deployment)
- [Screenshots](#-screenshots)

---

## 🌟 Overview

**MedEPCR** is a full-featured Electronic Patient Care Record (ePCR) system designed for Emergency Medical Services (EMS) organizations. It provides a modern, role-aware interface for paramedics to document patient care, quality assurance reviewers to assess records, managers to track performance, and administrators to manage the entire platform.

> Backend: Spring Boot 3 + MongoDB | Frontend: React 19 + Vite + Tailwind CSS

---

## ✨ Features

### 📄 Patient Care Records (ePCR)
- Multi-step form to create detailed patient care records
- Dynamic form fields powered by **Workflow Form Engine**
- Submit, edit, delete records with status tracking
- Server-side pagination with "Load More"

### 🔍 QA Review Module
- Create and complete QA reviews linked to ePCR records
- Auto-flag engine — rules trigger flags on record submission
- Paginated reviews with role-aware filtering (My Reviews / All / Pending)
- Score, pass/fail, and feedback system

### 📊 Analytics Dashboard
- 6-Month QA Pass Rate (Line Chart)
- Top Incident Locations (Bar Chart)
- Average Review Turnaround Time (KPI)
- Role-restricted — visible to Admin & Manager only

### ⚙️ Workflow & Form Engine
- Visual **Form Builder** — drag-and-drop style field creation
- Field types: Text, Number, Yes/No, Dropdown, Date, Long Text
- Workflows deployed across multiple organizations
- Dynamic Step 4 in Create Record renders active workflow fields

### 🔒 Audit Logs
- Centralized audit trail for all key actions
- AOP-based automatic logging (no scattered save calls)
- Paginated with Load More

### 🔔 Notifications
- Per-user notification center
- Mark as read / mark all as read

### 💬 Feedback Threads
- Threaded discussion per patient care record
- Open / Closed / Resolved status management

### 🏢 Organization & User Management
- Multi-organization support
- Full CRUD for users and organizations
- Role assignment and activation control

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 |
| **Build Tool** | Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **State Management** | Redux Toolkit + React Redux |
| **HTTP Client** | Axios with JWT interceptors |
| **Routing** | React Router v7 |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Animations** | Framer Motion |
| **UI Components** | Custom (Glass morphism dark theme) |

---

## 📁 Project Structure

```
src/
├── api/
│   └── client.js              # Axios instance with auth interceptors
├── components/
│   ├── dashboard/
│   │   └── AnalyticsCharts.jsx  # Recharts dashboard widgets
│   ├── forms/
│   │   ├── FormBuilder.jsx       # Visual workflow form editor
│   │   └── DynamicFormRenderer.jsx # Runtime form renderer
│   └── layout/
│       ├── AppLayout.jsx         # Sidebar + header shell
│       └── ProtectedRoute.jsx    # Role-based route guard
├── pages/
│   ├── AuditLogs.jsx            # Admin audit trail viewer
│   ├── CreateRecord.jsx          # Multi-step ePCR creation
│   ├── Dashboard.jsx             # Role-specific dashboard
│   ├── FeedbackThreads.jsx       # Messaging per record
│   ├── Login.jsx                 # Auth page
│   ├── Notifications.jsx         # Notification center
│   ├── Organizations.jsx         # Org CRUD
│   ├── QaForms.jsx               # QA form builder
│   ├── QaReviews.jsx             # QA review management
│   ├── RecordsList.jsx           # ePCR list + view/edit
│   ├── Register.jsx              # User registration
│   ├── Reports.jsx               # Advanced reporting
│   ├── Settings.jsx              # User settings
│   ├── Users.jsx                 # User management
│   └── Workflows.jsx             # Workflow + deploy manager
├── store/
│   └── slices/
│       ├── authSlice.js          # Auth state + JWT
│       ├── epcrSlice.js          # Records state
│       └── uiSlice.js            # Toast notifications
└── main.jsx                     # App entry point
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+
- MedEPCR Backend running (Spring Boot on port `9091`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/medepcr-frontend.git
cd medepcr-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

App opens at **http://localhost:5173**

---

## 🔑 Environment Variables

Create a `.env.local` file (never commit this):

```env
VITE_API_BASE_URL=http://147.93.108.99:2612
```

For production, update `.env.production`:

```env
VITE_API_BASE_URL=https://your-api.yourdomain.com
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend Spring Boot API base URL | `http://147.93.108.99:2612` |

---

## 👥 Role-Based Access

| Role | Dashboard | Records | QA Reviews | Workflows | Audit Logs | Users/Orgs |
|---|---|---|---|---|---|---|
| **ADMIN** | Full Analytics | All Records | All Reviews | Full CRUD | ✅ | Full CRUD |
| **MANAGER** | Full Analytics | Org Records | Org Reviews | View/Edit | ❌ | Org Users |
| **PARAMEDIC** | Own Stats | Own Records | ❌ | ❌ | ❌ | ❌ |
| **QA_REVIEWER** | ❌ | View Only | My Reviews | ❌ | ❌ | ❌ |
| **PHYSICIAN** | ❌ | View Only | ❌ | ❌ | ❌ | ❌ |
| **VIEWER** | ❌ | View Only | ❌ | ❌ | ❌ | ❌ |

---

## 🔌 API Integration

All API calls go through `src/api/client.js`:

- **Base URL**: configured via `VITE_API_BASE_URL`
- **Auth**: JWT Bearer token attached automatically from Redux store / localStorage
- **401**: Auto logout + redirect to `/login`
- **403**: Toast error "Access Denied"
- **5xx**: Toast error with message
- **Network Error**: Toast "Check your connection"

### Key Endpoints Used

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/login` | Login |
| `GET /api/epcr/records?page=0&size=20` | Paginated records |
| `POST /api/epcr/records` | Create record |
| `GET /api/qa/reviews?page=0&size=20` | Paginated QA reviews |
| `PUT /api/qa/reviews/{id}/complete` | Complete a review |
| `GET /api/reports/dashboard-metrics` | Analytics data |
| `GET /api/audit/logs?page=0&size=20` | Audit trail |
| `GET /api/workflows/organization/{id}` | Org workflows |
| `POST /api/workflows` | Create workflow |

---

## 📦 Deployment

### Build for Production

```bash
npm run build
# Output in dist/
```

### Netlify / Vercel

1. Set env var: `VITE_API_BASE_URL=https://your-api.com`
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add redirect rule for SPA routing:
   - **Netlify** → create `public/_redirects`: `/* /index.html 200`
   - **Vercel** → `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

### Docker + Nginx

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://your-api.com \
  -t medepcr-frontend .

docker run -p 80:80 medepcr-frontend
```

### Bundle Size (Gzip)
| Chunk | Gzip Size |
|---|---|
| vendor (React + Router) | 70 KB |
| app code | 49 KB |
| charts (Recharts) | 115 KB |
| ui (Lucide + Framer) | 5 KB |
| **Total** | **~247 KB** ✅ |

---

## 📸 Screenshots

> *Login → Dashboard → Create Record → QA Review → Audit Logs*

The app features a **dark glassmorphism design** with teal accent colors, smooth animations, and responsive layouts optimized for desktop and tablet use in clinical environments.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "feat: add your feature"`
3. Push: `git push origin feature/your-feature`
4. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<div align="center">
Built with ❤️ for EMS professionals | MedEPCR © 2026
</div>
