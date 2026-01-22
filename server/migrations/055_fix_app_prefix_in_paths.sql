-- Migration 055: Fix /app/ prefix in profile_photo paths

-- Update paths that start with '/app/' (e.g. /app/uploads/...)
UPDATE users
SET profile_photo = regexp_replace(profile_photo, '^/app/', '/', 'i')
WHERE profile_photo LIKE '/app/%';
