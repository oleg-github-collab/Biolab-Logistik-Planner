-- Add JSONB time_blocks column to weekly_schedules and backfill data
ALTER TABLE weekly_schedules
  ADD COLUMN IF NOT EXISTS time_blocks JSONB DEFAULT '[]'::jsonb;

UPDATE weekly_schedules
   SET time_blocks =
     CASE
       WHEN notes IS NOT NULL AND notes <> '' THEN
         COALESCE(
           (notes::jsonb -> 'timeBlocks'),
           CASE
             WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
               jsonb_build_array(jsonb_build_object(
                 'start', to_char(start_time, 'HH24:MI'),
                 'end', to_char(end_time, 'HH24:MI')
               ))
             ELSE '[]'::jsonb
           END
         )
       WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
         jsonb_build_array(jsonb_build_object(
           'start', to_char(start_time, 'HH24:MI'),
           'end', to_char(end_time, 'HH24:MI')
         ))
       ELSE '[]'::jsonb
     END
 WHERE true;

ALTER TABLE weekly_schedules
  ALTER COLUMN time_blocks DROP DEFAULT;

-- Ensure time blocks column never stays null
UPDATE weekly_schedules
   SET time_blocks = '[]'::jsonb
 WHERE time_blocks IS NULL;
