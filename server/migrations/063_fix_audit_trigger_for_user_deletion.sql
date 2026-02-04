-- ============================================================================
-- Migration 063: Fix audit trigger to handle user deletion safely
-- ============================================================================
-- The problem: when deleting a user, CASCADE deletes weekly_schedules,
-- which triggers log_weekly_schedule_changes() that tries to INSERT into
-- work_hours_audit with the deleted user_id, violating FK constraint.
--
-- Solution: Make the trigger check if user still exists before inserting audit

CREATE OR REPLACE FUNCTION log_weekly_schedule_changes()
RETURNS TRIGGER AS $$
DECLARE
  audit_user INTEGER;
  user_exists BOOLEAN;
BEGIN
  audit_user := COALESCE(NEW.last_updated_by, OLD.last_updated_by);

  -- For DELETE operations, check if the user still exists
  -- If user is being deleted, their weekly_schedules are cascading
  -- and we should NOT try to insert audit records
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS(SELECT 1 FROM users WHERE id = OLD.user_id) INTO user_exists;

    -- Skip audit logging if user is being deleted (doesn't exist anymore)
    IF NOT user_exists THEN
      RETURN OLD;
    END IF;

    -- User still exists, log the deletion
    INSERT INTO work_hours_audit (
      user_id, week_start, day_of_week, change_type,
      previous_start_time, previous_end_time, previous_is_working,
      new_start_time, new_end_time, new_is_working, changed_by
    ) VALUES (
      OLD.user_id, OLD.week_start, OLD.day_of_week, 'delete',
      OLD.start_time, OLD.end_time, OLD.is_working,
      NULL, NULL, NULL, audit_user
    );
    RETURN OLD;
  END IF;

  -- For INSERT/UPDATE, check if user exists
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT EXISTS(SELECT 1 FROM users WHERE id = NEW.user_id) INTO user_exists;

    IF NOT user_exists THEN
      -- User doesn't exist, skip audit (shouldn't happen normally)
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO work_hours_audit (
      user_id, week_start, day_of_week, change_type,
      previous_start_time, previous_end_time, previous_is_working,
      new_start_time, new_end_time, new_is_working, changed_by
    ) VALUES (
      NEW.user_id, NEW.week_start, NEW.day_of_week, 'insert',
      NULL, NULL, NULL,
      NEW.start_time, NEW.end_time, NEW.is_working, audit_user
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_working IS DISTINCT FROM OLD.is_working
       OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
      INSERT INTO work_hours_audit (
        user_id, week_start, day_of_week, change_type,
        previous_start_time, previous_end_time, previous_is_working,
        new_start_time, new_end_time, new_is_working, changed_by
      ) VALUES (
        NEW.user_id, NEW.week_start, NEW.day_of_week, 'update',
        OLD.start_time, OLD.end_time, OLD.is_working,
        NEW.start_time, NEW.end_time, NEW.is_working, audit_user
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already created in 001_initial_schema.sql
-- This migration just updates the function
