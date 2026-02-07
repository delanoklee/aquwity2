-- ============================================
-- ACUITY DATABASE SCHEMA (v2)
-- Run this in Supabase SQL Editor
-- supabase.com → your project → SQL Editor
-- ============================================

-- ============================================
-- 1. OBSERVATIONS
-- Every 1-second check: what task, what they were
-- actually doing, and whether it counts as on-task
-- ============================================
CREATE TABLE observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task TEXT NOT NULL,
  activity TEXT NOT NULL,
  on_task BOOLEAN NOT NULL,
  observed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_observations_user_time
  ON observations(user_id, observed_at DESC);

-- ============================================
-- 2. COMPLETED TASKS
-- When a user finishes a task, store the totals:
-- how long they were focused vs distracted
-- ============================================
CREATE TABLE completed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task TEXT NOT NULL,
  focused_ms BIGINT NOT NULL DEFAULT 0,
  distracted_ms BIGINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_completed_tasks_user_time
  ON completed_tasks(user_id, completed_at DESC);

-- ============================================
-- 3. USER SETTINGS
-- Lean for now. current_task survives page
-- refreshes and crashes. Expand later as needed.
-- ============================================
CREATE TABLE user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  current_task TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Users can ONLY access their own data.
-- ============================================

ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- OBSERVATIONS policies
CREATE POLICY "Users can view own observations"
  ON observations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observations"
  ON observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own observations"
  ON observations FOR DELETE
  USING (auth.uid() = user_id);

-- COMPLETED TASKS policies
CREATE POLICY "Users can view own completed tasks"
  ON completed_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own completed tasks"
  ON completed_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own completed tasks"
  ON completed_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- USER SETTINGS policies
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);
