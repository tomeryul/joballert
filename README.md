# JobAlert — AI-Powered Job Hunting App

A production-ready, AI-powered job aggregation and tracking web application. Deployed as a static site on GitHub Pages with Supabase as the entire backend (PostgreSQL, Auth, Edge Functions, Realtime).

## Live Demo

Deploy to GitHub Pages by following the [Deployment Guide](#github-pages-deployment) below.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Pages (Static)                      │
│                                                                 │
│  index.html       dashboard.html     jobs.html                  │
│  recommended.html applied.html       saved.html                 │
│  notifications.html companies.html  settings.html               │
│                                                                 │
│  js/config.js          js/supabase-client.js                    │
│  js/ai-matcher.js      js/auth.js                               │
│  js/jobs.js            js/app.js                                │
│  js/notifications.js   js/utils.js                              │
│  js/providers/         css/main.css  css/components.css         │
│  sw.js (Service Worker / PWA)                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS (Supabase JS SDK)
┌────────────────────────▼────────────────────────────────────────┐
│                    Supabase Platform                             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │  PostgreSQL  │  │    Auth     │  │    Realtime          │   │
│  │             │  │             │  │                      │   │
│  │  companies  │  │  Email/Pass │  │  jobs channel        │   │
│  │  jobs       │  │  GitHub     │  │  notifications chan  │   │
│  │  user_jobs  │  │  Google     │  │                      │   │
│  │  user_profs │  │  OAuth      │  └──────────────────────┘   │
│  │  notifs     │  └─────────────┘                              │
│  │  settings   │                                               │
│  │  scan_logs  │  ┌──────────────────────────────────────┐    │
│  │  saved_srch │  │         Edge Functions (Deno)         │    │
│  └─────────────┘  │                                      │    │
│                   │  job-scanner    → ATS APIs            │    │
│                   │  cron-trigger   → hourly scheduler    │    │
│                   │  ai-matcher     → batch scoring       │    │
│                   │  send-notif     → notification CRUD   │    │
│                   └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   Greenhouse API   Lever API      (Extensible)
   (12 companies)   (8 companies)  Ashby / Wellfound
```

---

## Database ERD

```
auth.users (Supabase managed)
    │
    ├──► user_profiles (1:1)
    │      id, email, full_name, skills[], preferred_titles[]
    │      experience_levels[], remote_preference, resume_text
    │
    ├──► user_settings (1:1)
    │      push_enabled, email_enabled, min_match_score
    │      providers_enabled[], scan_frequency_hours
    │
    ├──► user_jobs (1:many)  ◄──── jobs (many:many bridge)
    │      status, match_score, match_reasons
    │      missing_skills[], resume_tips[], applied_at
    │
    ├──► notifications (1:many)
    │      type, title, body, is_read, sent_push
    │
    └──► saved_searches (1:many)
           name, filters{}, alert_enabled

companies (standalone)
    │
    └──► jobs.company_id (optional FK)

jobs
    id, title, company_name, location, remote_type
    salary_min/max, skills[], experience_level, job_type
    url (UNIQUE), source, is_active
    search_vector TSVECTOR (GIN indexed, generated column)

scan_logs
    provider, status, jobs_found, jobs_new, completed_at
```

---

## Features

- **Job Aggregation** — Scans Greenhouse (12 companies) and Lever (8 companies) public APIs every hour via scheduled Edge Function; deduplicates by URL, marks expired jobs inactive after 30 days.
- **AI Match Engine** — Weighted client-side scoring: skills (40%), experience level (20%), remote preference (15%), base (25%). Includes skill aliases (js↔JavaScript) and related-skill partial credit (TypeScript→JavaScript).
- **Application Pipeline** — Kanban board with statuses: viewed → saved → applied → interviewing → offered → rejected / withdrawn.
- **Realtime Updates** — Supabase Realtime `postgres_changes` channels push new jobs and notifications to the browser instantly.
- **Push Notifications** — Web Push API with Service Worker; per-user subscription stored in `user_settings.push_subscription`.
- **PWA** — Installable via `display: standalone`, offline-capable static assets via Service Worker cache-first strategy.
- **Full-Text Search** — PostgreSQL `tsvector` GIN index on title + company + description; exposed via `?search=` URL param.
- **Dark Glassmorphism UI** — CSS `backdrop-filter`, rgba backgrounds, animated score rings (SVG `stroke-dashoffset`).

---

## Project Structure

```
joballert/
├── index.html              # Auth page (sign in / sign up / OAuth)
├── dashboard.html          # Stats, top matches, scan logs
├── jobs.html               # Browse all jobs with filters
├── recommended.html        # AI-sorted by match score
├── applied.html            # Kanban application tracker
├── saved.html              # Saved jobs grid
├── notifications.html      # Notification history
├── companies.html          # Company browser
├── settings.html           # Profile, skills, preferences
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── css/
│   ├── main.css            # Layout, variables, base components
│   └── components.css      # Job cards, kanban, modals, AI panel
├── js/
│   ├── config.js           # App config, match weights, default profile
│   ├── supabase-client.js  # DB singleton — all Supabase queries
│   ├── ai-matcher.js       # Client-side match scoring engine
│   ├── auth.js             # Auth singleton, session management
│   ├── jobs.js             # Job card / detail / modal rendering
│   ├── app.js              # Sidebar, topbar, shared UI
│   ├── notifications.js    # Toasts, push init, realtime notif listener
│   ├── utils.js            # Event bus, localStorage helpers, debounce
│   └── providers/
│       ├── base-provider.js      # Abstract base: normalize, detect, extract
│       ├── greenhouse.js         # Greenhouse ATS (12 companies)
│       ├── lever.js              # Lever ATS (8 companies)
│       ├── ashby.js              # Ashby ATS (extensible)
│       ├── wellfound.js          # Wellfound (extensible)
│       └── provider-registry.js  # Registry singleton
└── supabase/
    ├── migrations/
    │   └── 001_initial_schema.sql   # Full schema (canonical reference)
    └── functions/
        ├── job-scanner/index.ts     # Scans ATS APIs, upserts jobs
        ├── cron-trigger/index.ts    # Hourly orchestrator + notifications
        ├── ai-matcher/index.ts      # Server-side batch scoring
        └── send-notification/index.ts  # Notification CRUD
```

---

## GitHub Pages Deployment

### Prerequisites

- A GitHub account with this repo forked or cloned
- A free Supabase project (see [Supabase Setup](#supabase-setup) below)

### Steps

1. **Fork / clone** this repository to your GitHub account.

2. **Update `js/config.js`** with your Supabase credentials:
   ```js
   SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
   SUPABASE_ANON_KEY: 'your-anon-key-here',
   ```

3. **Enable GitHub Pages** in your repo:
   - Go to **Settings → Pages**
   - Source: **Deploy from a branch** → branch: `main`, folder: `/ (root)`
   - Click **Save**

4. Your app will be live at `https://YOUR_USERNAME.github.io/joballert/`

> **Note:** GitHub Pages serves static files only. All dynamic logic runs in Supabase Edge Functions or in the browser via JavaScript.

---

## Supabase Setup

### 1. Create a Project

1. Sign up at [supabase.com](https://supabase.com) (free tier is sufficient)
2. Create a new project — note the **Project URL** and **anon public key** from **Settings → API**

### 2. Run the Database Migration

In the Supabase Dashboard, go to **SQL Editor** and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, indexes, RLS policies, and triggers.

### 3. Configure Auth

In **Authentication → Providers**:

- **Email** — enable, disable email confirmation for development
- **GitHub** — create an OAuth App at github.com/settings/developers, set callback URL to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- **Google** — create credentials at console.cloud.google.com, same callback URL

In **Authentication → URL Configuration**:
- Site URL: `https://YOUR_USERNAME.github.io/joballert`
- Redirect URLs: add `https://YOUR_USERNAME.github.io/joballert/dashboard.html`

### 4. Deploy Edge Functions

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy job-scanner --no-verify-jwt
supabase functions deploy cron-trigger --no-verify-jwt
supabase functions deploy ai-matcher --no-verify-jwt
supabase functions deploy send-notification --no-verify-jwt
```

### 5. Schedule the Hourly Scan

In the Supabase Dashboard, go to **Database → Extensions** and enable `pg_cron`.

Then in **SQL Editor**:

```sql
SELECT cron.schedule(
  'hourly-job-scan',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-trigger',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Replace `YOUR_SERVICE_ROLE_KEY` with the value from **Settings → API → service_role key** (keep this secret — only used in pg_cron, never in frontend code).

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `SUPABASE_URL` | `js/config.js` | Your project URL, e.g. `https://abc.supabase.co` |
| `SUPABASE_ANON_KEY` | `js/config.js` | Public anon key (safe to commit) |
| `SUPABASE_SERVICE_ROLE_KEY` | pg_cron / CLI only | Secret key — never put in frontend code |

Edge Functions automatically receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables injected by Supabase.

---

## Security Considerations

### Row Level Security (RLS)

All user-scoped tables enforce RLS. Users can only read/write their own rows:

```sql
CREATE POLICY "user_jobs_self" ON user_jobs
  FOR ALL USING (auth.uid() = user_id);
```

Jobs and companies are publicly readable but only writable by service_role (Edge Functions).

### API Keys

- The `anon` key is safe to expose in frontend code — it's scoped by RLS policies.
- The `service_role` key bypasses RLS and must **never** appear in client-side code. It is used only in Edge Functions (injected automatically) and pg_cron.

### Content Security

- Job descriptions from ATS APIs are HTML-stripped via `cleanText()` before storage and display.
- All user input is handled through parameterized Supabase queries (no SQL injection risk).
- CORS is restricted in Edge Functions; client-side CORS proxy (`allorigins.win`) is used for browser-side ATS fetches only.

### Auth

- Supabase Auth issues JWTs verified on every API call.
- OAuth tokens are never stored client-side; only the Supabase session token is kept.
- `requireAuth()` in `js/auth.js` redirects unauthenticated users to `index.html` on every protected page.

---

## Cost Estimation — 10,000 Users

Supabase free tier supports 500MB database and 500K Edge Function invocations/month. At 10,000 active users:

| Resource | Usage Estimate | Supabase Pro Cost |
|---|---|---|
| Database storage | ~2–5 GB (jobs + user data) | $0.125/GB → ~$1/mo |
| Database rows | ~500K jobs + 10M user_jobs | Included |
| Edge Function invocations | 720 cron + 10K user-triggered/day ≈ 320K/mo | Included (2M free) |
| Realtime connections | ~500 concurrent (5% DAU) | $10/mo (Pro) |
| Auth MAU | 10,000 | $0.00325/MAU over 50K free → $0 |
| Bandwidth | ~50GB/mo | $0.09/GB → ~$4.50/mo |

**Estimated total: ~$25–35/month** on Supabase Pro ($25 base + usage overages).

GitHub Pages hosting is **free** for public repositories.

For 10,000 users the main cost driver is Realtime connections. Disabling Realtime and using polling instead would keep costs at the $25 Pro base tier.

---

## Future Roadmap

### Phase 2 — More Job Sources
- [ ] Ashby ATS integration (companies: Notion, Linear, Vercel, Stripe)
- [ ] Wellfound (AngelList) scraping for startup jobs
- [ ] LinkedIn Jobs via RapidAPI
- [ ] Indeed job feed RSS parsing
- [ ] Google Jobs structured data scraping

### Phase 3 — AI Enhancements
- [ ] Claude API integration for richer "why you fit" explanations
- [ ] Resume PDF upload and text extraction
- [ ] Cover letter generation based on job + user profile
- [ ] Interview question prediction per job

### Phase 4 — Notifications
- [ ] Email digests via Resend or SendGrid (daily/weekly summary)
- [ ] VAPID key setup for real Web Push delivery
- [ ] Telegram / Discord bot notifications
- [ ] Slack app integration

### Phase 5 — Analytics
- [ ] Application funnel analytics dashboard
- [ ] Salary range tracker per skill/location
- [ ] Response rate tracking (applied vs. heard back)
- [ ] Skills gap analysis vs. target role market

### Phase 6 — Social
- [ ] Referral network — tag connections at companies
- [ ] Shared job boards for cohorts / bootcamps
- [ ] Anonymous salary sharing per company

---

## Local Development

No build step required — this is plain HTML/CSS/JS.

```bash
# Serve locally (Python)
python3 -m http.server 8080

# Or with Node
npx serve .
```

Open `http://localhost:8080` — sign in with your Supabase credentials.

For Edge Functions local development:

```bash
supabase start          # starts local Supabase stack
supabase functions serve job-scanner --env-file .env.local
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / ES2022 |
| UI Style | Glassmorphism dark theme, CSS custom properties |
| Backend | Supabase (PostgreSQL 17, Auth, Realtime, Edge Functions) |
| Edge Runtime | Deno (TypeScript) |
| Job Sources | Greenhouse API, Lever API (public, no auth required) |
| Full-Text Search | PostgreSQL `tsvector` with GIN index |
| PWA | Service Worker, Web App Manifest |
| Hosting | GitHub Pages |
