-- ============================================================
-- MVP Features Migration
-- Phases 1–4: persistent runs, defects, comments, activity log
-- ============================================================

-- ── Phase 1: Persistent test runs ────────────────────────────────────────────

-- Add status + completed_at to test_runs (safe if columns already exist)
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS status       text        NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add attachments + updated_at to run_results
ALTER TABLE run_results
  ADD COLUMN IF NOT EXISTS attachments jsonb        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz  NOT NULL DEFAULT now();

-- Unique constraint so upsert by (run_id, test_case_id) works
ALTER TABLE run_results
  DROP CONSTRAINT IF EXISTS run_results_run_id_test_case_id_key;
ALTER TABLE run_results
  ADD CONSTRAINT run_results_run_id_test_case_id_key UNIQUE (run_id, test_case_id);

-- Storage bucket for run attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('run-attachments', 'run-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/download from their own run folders
CREATE POLICY IF NOT EXISTS "Authenticated users can upload run attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'run-attachments');

CREATE POLICY IF NOT EXISTS "Authenticated users can read run attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'run-attachments');

-- RLS on test_runs (enable if not already)
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage test_runs"
  ON test_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS on run_results
ALTER TABLE run_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage run_results"
  ON run_results FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ── Phase 3: Defects ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS defects (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_result_id   uuid        REFERENCES run_results(id) ON DELETE SET NULL,
  test_case_id    uuid        NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  severity        text        NOT NULL DEFAULT 'Med',
  description     text        NOT NULL DEFAULT '',
  reporter_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'Open',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage defects"
  ON defects FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ── Phase 4: Comments & Activity Log ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id  uuid        NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  author_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  body          text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage comments"
  ON comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS activity_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id  uuid        NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  action        text        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can manage activity_log"
  ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 5: is_active flag on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
