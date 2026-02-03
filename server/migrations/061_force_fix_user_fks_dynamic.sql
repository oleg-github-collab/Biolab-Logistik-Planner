-- Force fix all user FK constraints with dynamic approach
-- This migration will work even if constraint names are different

DO $$
DECLARE
  fk_record RECORD;
  drop_sql TEXT;
  add_sql TEXT;
  delete_rule TEXT;
BEGIN
  -- Get all FK constraints pointing to users table
  FOR fk_record IN
    SELECT
      tc.constraint_name,
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      COALESCE(rc.delete_rule, 'NO ACTION') as current_delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND tc.table_schema = 'public'
      AND tc.table_name != 'users'
  LOOP
    -- Determine appropriate delete rule
    IF fk_record.table_name IN ('calendar_events', 'stories', 'time_entries') THEN
      delete_rule := 'CASCADE';
    ELSE
      delete_rule := 'SET NULL';
    END IF;

    -- Skip if already has correct delete rule
    IF fk_record.current_delete_rule = delete_rule THEN
      RAISE NOTICE 'Skipping %.% - already has % rule',
        fk_record.table_name, fk_record.column_name, delete_rule;
      CONTINUE;
    END IF;

    -- Drop existing constraint
    drop_sql := format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      fk_record.table_schema,
      fk_record.table_name,
      fk_record.constraint_name
    );

    RAISE NOTICE 'Dropping: %', drop_sql;
    EXECUTE drop_sql;

    -- Add new constraint with proper delete rule
    add_sql := format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE %s',
      fk_record.table_schema,
      fk_record.table_name,
      fk_record.constraint_name,
      fk_record.column_name,
      delete_rule
    );

    RAISE NOTICE 'Adding: %', add_sql;
    EXECUTE add_sql;

    RAISE NOTICE 'Fixed: %.% -> ON DELETE %',
      fk_record.table_name, fk_record.column_name, delete_rule;
  END LOOP;

  RAISE NOTICE 'Migration 061 completed successfully!';
END $$;
