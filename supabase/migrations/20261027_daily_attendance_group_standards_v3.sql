-- V3 additive migration: per-attendance-code display colors.
-- Does not modify existing rows, RLS, or attendance values.
ALTER TABLE public.daily_attendance_codes
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#e8f8f1';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_attendance_codes_color_format_check' AND conrelid = 'public.daily_attendance_codes'::regclass) THEN
    ALTER TABLE public.daily_attendance_codes
      ADD CONSTRAINT daily_attendance_codes_color_format_check
      CHECK (color ~ '^#[0-9A-Fa-f]{6}$') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.daily_attendance_codes
  VALIDATE CONSTRAINT daily_attendance_codes_color_format_check;
