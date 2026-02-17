-- Migration 067: Fix user role and employment_type CHECK constraints
-- The role CHECK only allowed employee/admin/superadmin but app supports 'observer'
-- The employment_type CHECK only allowed Vollzeit/Werkstudent but 'Teilzeit' also needed

-- Fix role CHECK constraint to include 'observer'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'admin', 'superadmin', 'observer'));

-- Fix employment_type CHECK constraint to allow NULL and 'Teilzeit'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employment_type_check;
ALTER TABLE users ADD CONSTRAINT users_employment_type_check CHECK (employment_type IS NULL OR employment_type IN ('Vollzeit', 'Werkstudent', 'Teilzeit'));
