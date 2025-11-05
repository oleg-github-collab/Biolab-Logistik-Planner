const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const STORIES_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'stories');

const ensureUploadDir = async () => {
  if (!fs.existsSync(STORIES_UPLOAD_DIR)) {
    await fs.promises.mkdir(STORIES_UPLOAD_DIR, { recursive: true });
  }
};

const removeFileIfExists = async (filePath) => {
  if (!filePath) return;
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(__dirname, '..', filePath);
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('Failed to delete story media', { error: error.message, filePath });
    }
  }
};

const mapStoryRow = (row, viewerId = null) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userPhoto: row.user_photo,
  mediaUrl: row.media_url,
  mediaType: row.media_type,
  caption: row.caption || '',
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  views: Number(row.views_count) || 0,
  viewers: row.viewers || [],
  viewerHasSeen: viewerId ? row.viewers_ids?.includes(viewerId) : false
});

const cleanupExpiredStories = async () => {
  const client = await pool.connect();
  try {
    const expired = await client.query(
      `SELECT id, media_path FROM user_stories WHERE expires_at <= NOW()`
    );

    if (expired.rows.length > 0) {
      const ids = expired.rows.map((row) => row.id);
      await client.query('DELETE FROM user_story_views WHERE story_id = ANY($1)', [ids]);
      await client.query('DELETE FROM user_stories WHERE id = ANY($1)', [ids]);

      await Promise.all(expired.rows.map((row) => removeFileIfExists(row.media_path)));

      logger.info('Expired stories cleaned up', { count: expired.rows.length });
    }
  } catch (error) {
    logger.error('Failed to cleanup expired stories', { error: error.message });
  } finally {
    client.release();
  }
};

const getActiveStories = async (viewerId = null) => {
  await cleanupExpiredStories();

  const result = await pool.query(
    `SELECT
       us.*,
       u.name AS user_name,
       u.profile_photo AS user_photo,
       COUNT(usv.viewer_id)::INT AS views_count,
       json_agg(
         DISTINCT jsonb_build_object(
           'userId', viewer.user_id,
           'viewedAt', viewer.viewed_at
         )
       ) FILTER (WHERE viewer.viewer_id IS NOT NULL) AS viewers,
       array_remove(array_agg(usv.viewer_id), NULL) AS viewers_ids
     FROM user_stories us
     LEFT JOIN users u ON us.user_id = u.id
     LEFT JOIN user_story_views usv ON us.id = usv.story_id
     LEFT JOIN user_story_views viewer ON us.id = viewer.story_id
     WHERE us.expires_at > NOW()
     GROUP BY us.id, u.name, u.profile_photo
     ORDER BY us.created_at DESC`
  );

  return result.rows.map((row) => mapStoryRow(row, viewerId));
};

const getUserStories = async (userId, viewerId = null) => {
  await cleanupExpiredStories();

  const result = await pool.query(
    `SELECT
       us.*,
       u.name AS user_name,
       u.profile_photo AS user_photo,
       COUNT(usv.viewer_id)::INT AS views_count,
       json_agg(
         DISTINCT jsonb_build_object(
           'userId', viewer.user_id,
           'viewedAt', viewer.viewed_at
         )
       ) FILTER (WHERE viewer.viewer_id IS NOT NULL) AS viewers,
       array_remove(array_agg(usv.viewer_id), NULL) AS viewers_ids
     FROM user_stories us
     LEFT JOIN users u ON us.user_id = u.id
     LEFT JOIN user_story_views usv ON us.id = usv.story_id
     LEFT JOIN user_story_views viewer ON us.id = viewer.story_id
     WHERE us.user_id = $1 AND us.expires_at > NOW()
     GROUP BY us.id, u.name, u.profile_photo
     ORDER BY us.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => mapStoryRow(row, viewerId));
};

const addStory = async ({ userId, file, caption }) => {
  await ensureUploadDir();

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const relativePath = file.path.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/');
  const mediaUrl = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  const result = await pool.query(
    `INSERT INTO user_stories (id, user_id, media_path, media_url, media_type, caption, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      parseInt(userId, 10),
      file.path,
      mediaUrl,
      file.mimetype || 'image',
      caption || '',
      expiresAt
    ]
  );

  const story = result.rows[0];
  logger.info('Profile story added', { userId: story.user_id, storyId: story.id });
  return mapStoryRow({ ...story, views_count: 0, viewers: [], viewers_ids: [] });
};

const markStoryViewed = async ({ storyId, viewerId }) => {
  await cleanupExpiredStories();

  const result = await pool.query(
    `SELECT * FROM user_stories WHERE id = $1`,
    [storyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  await pool.query(
    `INSERT INTO user_story_views (story_id, viewer_id)
     VALUES ($1, $2)
     ON CONFLICT (story_id, viewer_id) DO NOTHING`,
    [storyId, parseInt(viewerId, 10)]
  );

  const refreshed = await pool.query(
    `SELECT
       us.*,
       u.name AS user_name,
       u.profile_photo AS user_photo,
       COUNT(usv.viewer_id)::INT AS views_count,
       json_agg(
         DISTINCT jsonb_build_object(
           'userId', viewer.user_id,
           'viewedAt', viewer.viewed_at
         )
       ) FILTER (WHERE viewer.viewer_id IS NOT NULL) AS viewers,
       array_remove(array_agg(usv.viewer_id), NULL) AS viewers_ids
     FROM user_stories us
     LEFT JOIN users u ON us.user_id = u.id
     LEFT JOIN user_story_views usv ON us.id = usv.story_id
     LEFT JOIN user_story_views viewer ON us.id = viewer.story_id
     WHERE us.id = $1
     GROUP BY us.id, u.name, u.profile_photo`,
    [storyId]
  );

  return refreshed.rows.length ? mapStoryRow(refreshed.rows[0], viewerId) : null;
};

module.exports = {
  getActiveStories,
  getUserStories,
  addStory,
  markStoryViewed,
  cleanupExpiredStories
};
