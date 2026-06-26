-- JobAlert Initial Schema
-- Applied via Supabase MCP. This file is the canonical reference.
-- See README.md for setup instructions.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- COMPANIES
-- =============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10','11-50','51-200','201-500','501-1000','1001-5000','5000+')),
  founded_year INTEGER,
  location TEXT,
  linkedin_url TEXT,
  glassdoor_rating DECIMAL(2,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

-- =============================================
-- JOBS
-- =============================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  title TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  location TEXT,
  country TEXT,
  remote_type TEXT CHECK (remote_type IN ('remote','hybrid','onsite','unknown')) DEFAULT 'unknown',
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  salary_period TEXT CHECK (salary_period IN ('hour','day','month','year')) DEFAULT 'year',
  url TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  skills TEXT[] DEFAULT '{}',
  experience_level TEXT CHECK (experience_level IN ('intern','junior','mid','senior','lead','principal','unknown')) DEFAULT 'unknown',
  job_type TEXT CHECK (job_type IN ('fulltime','parttime','contract','freelance','internship','unknown')) DEFAULT 'fulltime',
  date_posted TIMESTAMPTZ,
  date_expires TIMESTAMPTZ,
  source TEXT NOT NULL,
  source_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  apply_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(company_name, '') || ' ' ||
      coalesce(description, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url)
);

CREATE INDEX jobs_search_idx ON jobs USING GIN (search_vector);
CREATE INDEX jobs_skills_idx ON jobs USING GIN (skills);
CREATE INDEX jobs_source_idx ON jobs (source);
CREATE INDEX jobs_active_idx ON jobs (is_active, date_posted DESC);
CREATE INDEX jobs_company_idx ON jobs (company_name);

-- =============================================
-- USER PROFILES
-- =============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  headline TEXT,
  degree TEXT DEFAULT 'MSc Computer Science',
  experience_years INTEGER DEFAULT 0,
  skills TEXT[] DEFAULT ARRAY['JavaScript','React','Java','Python','C','C++','SQL','HTML','CSS','Node.js','Git'],
  preferred_titles TEXT[] DEFAULT ARRAY['Software Developer','Full Stack Developer','Backend Developer','Frontend Developer'],
  preferred_locations TEXT[] DEFAULT '{}',
  remote_preference TEXT CHECK (remote_preference IN ('any','remote','hybrid','onsite')) DEFAULT 'any',
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  experience_levels TEXT[] DEFAULT ARRAY['junior','mid'],
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  resume_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USER JOBS
-- =============================================
CREATE TABLE user_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('viewed','saved','applied','interviewing','offered','rejected','withdrawn')) DEFAULT 'viewed',
  match_score INTEGER CHECK (match_score BETWEEN 0 AND 100),
  match_reasons JSONB DEFAULT '[]',
  missing_skills TEXT[] DEFAULT '{}',
  resume_tips TEXT[] DEFAULT '{}',
  why_fit TEXT,
  notes TEXT,
  applied_at TIMESTAMPTZ,
  interview_date TIMESTAMPTZ,
  offer_amount INTEGER,
  salary_negotiated INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX user_jobs_user_idx ON user_jobs (user_id, status);
CREATE INDEX user_jobs_score_idx ON user_jobs (user_id, match_score DESC);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('new_job','status_update','reminder','system')) DEFAULT 'new_job',
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  sent_push BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications (user_id, is_read, created_at DESC);

-- =============================================
-- USER SETTINGS
-- =============================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN DEFAULT FALSE,
  email_enabled BOOLEAN DEFAULT TRUE,
  email_frequency TEXT CHECK (email_frequency IN ('instant','daily','weekly')) DEFAULT 'daily',
  push_subscription JSONB,
  min_match_score INTEGER DEFAULT 60,
  notify_new_jobs BOOLEAN DEFAULT TRUE,
  notify_status_changes BOOLEAN DEFAULT TRUE,
  notify_reminders BOOLEAN DEFAULT TRUE,
  providers_enabled TEXT[] DEFAULT ARRAY['linkedin','indeed','glassdoor','greenhouse','lever','wellfound','ziprecruiter'],
  scan_frequency_hours INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SCAN LOGS
-- =============================================
CREATE TABLE scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  status TEXT CHECK (status IN ('running','success','partial','failed')) DEFAULT 'running',
  jobs_found INTEGER DEFAULT 0,
  jobs_new INTEGER DEFAULT 0,
  jobs_updated INTEGER DEFAULT 0,
  jobs_expired INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =============================================
-- SAVED SEARCHES
-- =============================================
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  alert_enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_self" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "user_jobs_self" ON user_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notifications_self" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_settings_self" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "saved_searches_self" ON saved_searches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "jobs_read" ON jobs FOR SELECT USING (true);
CREATE POLICY "jobs_service_write" ON jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "companies_read" ON companies FOR SELECT USING (true);
CREATE POLICY "companies_service_write" ON companies FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "scan_logs_read" ON scan_logs FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- =============================================
-- TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_ua BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_jobs_ua BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_profiles_ua BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_jobs_ua BEFORE UPDATE ON user_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_settings_ua BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
