CREATE TABLE IF NOT EXISTS clients (
  profile_url       TEXT PRIMARY KEY,
  name              TEXT,
  country_code      TEXT,
  payment_verified  BOOLEAN DEFAULT FALSE,
  rating            NUMERIC(3,2),
  projects_published INT DEFAULT 0,
  projects_paid     INT DEFAULT 0,
  member_since      TEXT,
  last_login        TEXT,
  is_scam           BOOLEAN DEFAULT FALSE,
  scam_note         TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  slug              TEXT PRIMARY KEY,
  url               TEXT NOT NULL,
  title             TEXT,
  budget            TEXT,
  full_description  TEXT,
  category          TEXT,
  subcategory       TEXT,
  status            TEXT,
  skills            TEXT[],
  published_at      TEXT,
  client_profile_url TEXT REFERENCES clients(profile_url) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_jobs (
  id                SERIAL PRIMARY KEY,
  client_profile_url TEXT NOT NULL REFERENCES clients(profile_url) ON DELETE CASCADE,
  slug              TEXT,
  title             TEXT,
  url               TEXT,
  budget            TEXT,
  published_at      TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_profile_url, slug)
);

CREATE TABLE IF NOT EXISTS freelancer_reviews (
  id                SERIAL PRIMARY KEY,
  client_profile_url TEXT NOT NULL REFERENCES clients(profile_url) ON DELETE CASCADE,
  job_title         TEXT,
  job_url           TEXT,
  freelancer_name   TEXT,
  freelancer_url    TEXT,
  rating            NUMERIC(3,2),
  comment           TEXT,
  time_ago          TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_profile_url, job_url, freelancer_url)
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_profile_url);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_jobs_client ON client_jobs(client_profile_url);
CREATE INDEX IF NOT EXISTS idx_reviews_client ON freelancer_reviews(client_profile_url);
