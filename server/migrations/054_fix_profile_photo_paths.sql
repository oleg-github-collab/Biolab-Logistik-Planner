-- Migration 054: Fix profile_photo paths (remove app/ prefix)

-- Update paths that start with '/app/' (e.g. /app/uploads/...)
UPDATE users
SET profile_photo = regexp_replace(profile_photo, '^/app/', '/', 'i')
WHERE profile_photo LIKE '/app/%';

-- Update paths that start with 'app/' without leading slash
UPDATE users
SET profile_photo = '/' || regexp_replace(profile_photo, '^app/', '', 'i')
WHERE profile_photo LIKE 'app/%';

-- Also fix any paths that don't start with / and aren't http/https URLs
UPDATE users
SET profile_photo = '/' || profile_photo
WHERE profile_photo IS NOT NULL
  AND profile_photo NOT LIKE 'http%'
  AND profile_photo NOT LIKE '/%';
