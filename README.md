# QA Test Case Management System

A collaborative, real-time test case management tool built for QA, UAT, and BAT teams. Organize test suites, manage test cases with custom attributes, execute structured test runs, and track results across multiple testing phases — all in a clean, modern interface with full light/dark mode support.

**Live app:** https://qa-test-manager-kappa.vercel.app

---

## Features

### Test Suites
- Create and manage test suites with name, description, JIRA ticket number, and owner
- Define **custom attributes** per suite (text, select, or boolean) that attach to every test case in that suite
- Show/hide suites to keep the workspace clean
- Suite-level stats: total cases, pass rate, QA/UAT/BAT breakdown

### Test Cases
- Create test cases with ID, title, description, preconditions, test data, and structured steps
- Multi-column sorting with Shift+Click (priority-numbered sort indicators)
- Filter by suite, priority, QA/UAT/BAT status, or relationship type
- Custom attribute values per test case, inherited from the suite definition
- Inline attribute expansion row in the grid
- Duplicate, import via CSV, and export to CSV

### Parent–Child Relationships
- Designate any test case as a **parent** with multiple linked children
- Each child independently selects which fields to inherit: **Preconditions**, **Test Data**, **Steps**, and/or **Attribute Values**
- Saving a parent propagates changes to all inheriting children (with confirmation)
- Inherited fields are locked in the child with a visible purple badge and disabled input
- Flat hierarchy enforced — no chaining (one level only)
- Grid shows `⎇` icon on parents (click to expand child list) and `↳` icon on children
- Filter grid by: All Types / Parents Only / Children Only / Standalone Only
- Orphan guard: warns before deleting a parent that still has linked children

### Test Runner Wizard
A multi-step guided execution flow:

1. **Suite Selection** — pick one or more suites; cards show name, JIRA number, and case count
2. **Executor Assignment** — assign a team member and choose a role: QA Tester, UAT Tester, or BAT Tester
3. **Execution Grid** — table of all test cases in selected suites with multi-column sort, CSV export, and per-row View / Execute actions
4. **Test Execution** — step-by-step execution interface with Pass/Fail per step and a final status (Pass / Fail / Blocked / Skipped); result saves to the correct field (`qaStatus`, `uatStatus`, or `batStatus`) based on the assigned role

### User Management
- Add users with name, email, and one or more roles: BSA, Dev, QA, UAT, BAT
- Users appear in the executor dropdown in the Test Runner

### Dashboard
- Overview cards: total suites, test cases, pass rate, active runs
- Per-suite progress bars and recent test cases table

### Light / Dark Mode
- Toggle between light and dark themes via the Sun/Moon button in the sidebar footer
- Preference persisted to `localStorage`
- Flash-of-wrong-theme prevented by an inline script in `<head>` before React loads
- Falls back to `prefers-color-scheme` on first visit

### Real-Time Collaboration
- All changes sync instantly across connected users via **Supabase Realtime**
- No page refresh needed — edits by teammates appear live

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS v3 (`darkMode: 'class'`) |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Icons | lucide-react |
| CSV | papaparse |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone the repo

```bash
git clone https://github.com/xozai/qa-test-manager.git
cd qa-test-manager
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values are found in your Supabase project under **Settings → API**.

### 3. Run the database migrations

Open the **SQL Editor** in your Supabase dashboard and run the following scripts in order:

#### Core schema

```sql
-- Users
CREATE TABLE users (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  roles TEXT[] NOT NULL DEFAULT '{}'
);

-- Test Suites
CREATE TABLE test_suites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  jira_number TEXT NOT NULL DEFAULT '',
  is_hidden   BOOLEAN NOT NULL DEFAULT false,
  attributes  JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Test Cases
CREATE TABLE test_cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id     TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  preconditions    TEXT NOT NULL DEFAULT '',
  test_data        TEXT NOT NULL DEFAULT '',
  steps            JSONB NOT NULL DEFAULT '[]',
  qa_status        TEXT NOT NULL DEFAULT 'Not Run',
  uat_status       TEXT NOT NULL DEFAULT 'Not Run',
  bat_status       TEXT NOT NULL DEFAULT 'Not Run',
  priority         TEXT NOT NULL DEFAULT 'Med',
  test_suite_id    UUID REFERENCES test_suites(id) ON DELETE CASCADE,
  attribute_values JSONB NOT NULL DEFAULT '{}',
  parent_id        UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Test Runs
CREATE TABLE test_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  suite_ids   UUID[] NOT NULL DEFAULT '{}',
  executor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tester_role TEXT NOT NULL DEFAULT 'QA',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Run Results
CREATE TABLE run_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'Not Run',
  notes        TEXT NOT NULL DEFAULT ''
);
```

#### Parent–child inheritance

```sql
CREATE TABLE test_case_inheritance (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id              UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  parent_id             UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  inherit_preconditions BOOLEAN NOT NULL DEFAULT false,
  inherit_test_data     BOOLEAN NOT NULL DEFAULT false,
  inherit_steps         BOOLEAN NOT NULL DEFAULT false,
  inherit_attributes    BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id)
);
```

#### Row Level Security

```sql
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases             ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_results            ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_case_inheritance  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON users                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON test_suites           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON test_cases            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON test_runs             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON run_results           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON test_case_inheritance FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 4. Configure email (optional but recommended)

Supabase requires an SMTP provider to send signup confirmation emails.

1. Go to **Supabase → Authentication → SMTP Settings**
2. Add your SMTP credentials (e.g., [Resend](https://resend.com), SendGrid, Postmark)
3. Set a **Sender email** from a verified domain

### 5. Start the dev server

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Deployment (Vercel)

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Set **Framework Preset** to `Vite`
5. Deploy — Vercel auto-deploys on every push to `main`

---

## Project Structure

```
src/
├── components/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── common/
│   │   ├── Badge.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── Modal.tsx
│   ├── dashboard/
│   │   └── Dashboard.tsx
│   ├── layout/
│   │   └── Sidebar.tsx
│   ├── testcases/
│   │   ├── TestCaseGrid.tsx       # Grid with sort, filter, relationship icons
│   │   └── TestCaseModal.tsx      # Create/edit modal with Relationships tab
│   ├── testrunner/
│   │   └── TestRunner.tsx         # Multi-step execution wizard
│   ├── testsuites/
│   │   ├── TestSuiteList.tsx
│   │   └── TestSuiteModal.tsx
│   └── users/
│       └── UserManagement.tsx
├── hooks/
│   └── useTheme.ts                # Light/dark mode with localStorage
├── lib/
│   └── supabase.ts                # Supabase client
├── store/
│   └── store.ts                   # All data fetching, state, and Supabase actions
├── types/
│   └── index.ts                   # Shared TypeScript interfaces
└── App.tsx
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |

---

## License

MIT
