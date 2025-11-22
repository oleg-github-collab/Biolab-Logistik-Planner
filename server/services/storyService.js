const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { deleteStory: deleteCloudinaryStory, bulkDeleteStories } = require('../config/cloudinary');

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

const normalizeUrl = (value) => {
  if (!value) return null;
  const normalized = value.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const mapStoryRow = (row, viewerId = null) => {
  const numericViewerId = viewerId !== null && viewerId !== undefined ? Number(viewerId) : null;

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userPhoto: normalizeUrl(row.user_photo),
    mediaUrl: normalizeUrl(row.media_url),
    mediaType: row.media_type,
    caption: row.caption || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    views: Number(row.views_count) || 0,
    viewers: row.viewers || [],
    viewerHasSeen: numericViewerId !== null
      ? Array.isArray(row.viewers_ids) && row.viewers_ids.includes(numericViewerId)
      : false
  };
};

const isMissingRelationError = (error) => error?.code === '42P01';

const cleanupExpiredStories = async () => {
  const client = await pool.connect();
  try {
    const expired = await client.query(
      `SELECT id, media_path, media_url FROM user_stories WHERE expires_at <= NOW()`
    );

    if (expired.rows.length > 0) {
      const ids = expired.rows.map((row) => row.id);

      // Delete from database
      await client.query('DELETE FROM user_story_views WHERE story_id = ANY($1)', [ids]);
      await client.query('DELETE FROM user_stories WHERE id = ANY($1)', [ids]);

      // Delete from Cloudinary (if URLs are from Cloudinary)
      const cloudinaryUrls = expired.rows
        .map(row => row.media_url)
        .filter(url => url && url.includes('cloudinary.com'));

      if (cloudinaryUrls.length > 0) {
        await bulkDeleteStories(cloudinaryUrls);
      }

      // Delete local files (if any)
      await Promise.all(
        expired.rows
          .filter(row => row.media_path && !row.media_url.includes('cloudinary.com'))
          .map((row) => removeFileIfExists(row.media_path))
      );

      logger.info('Expired stories cleaned up', {
        count: expired.rows.length,
        cloudinary: cloudinaryUrls.length,
        local: expired.rows.length - cloudinaryUrls.length
      });
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('user_stories table not available yet, skipping cleanup');
    } else {
      logger.error('Failed to cleanup expired stories', { error: error.message });
    }
  } finally {
    client.release();
  }
};

const getActiveStories = async (viewerId = null) => {
  try {
    await cleanupExpiredStories();

    const result = await pool.query(
      `SELECT
         us.*,
         u.name AS user_name,
         u.profile_photo AS user_photo,
         COUNT(usv.viewer_id)::INT AS views_count,
         json_agg(
           DISTINCT jsonb_build_object(
             'userId', viewer.viewer_id,
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
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('Story tables missing, returning empty feed');
      return [];
    }
    logger.error('Failed to load active stories', { error: error.message });
    throw error;
  }
};

const getUserStories = async (userId, viewerId = null) => {
  try {
    await cleanupExpiredStories();

    const result = await pool.query(
      `SELECT
         us.*,
         u.name AS user_name,
         u.profile_photo AS user_photo,
         COUNT(usv.viewer_id)::INT AS views_count,
         json_agg(
           DISTINCT jsonb_build_object(
             'userId', viewer.viewer_id,
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
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('Story tables missing, returning empty user stories', { userId });
      return [];
    }
    logger.error('Failed to load user stories', { error: error.message, userId });
    throw error;
  }
};

const addStory = async ({ userId, file, caption, isCloudinary = false }) => {
  await ensureUploadDir();

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Cloudinary returns full URL in file.path, local storage returns file path
  let mediaUrl, mediaPath;
  if (isCloudinary) {
    mediaUrl = file.path; // Full Cloudinary URL
    mediaPath = file.path; // Store URL as path for reference
  } else {
    // Extract relative path from absolute filesystem path
    // file.path is like: /app/uploads/images/123.png or /Users/.../server/uploads/images/123.png
    // We need: /uploads/images/123.png
    let relativePath = file.path;

    // Remove server directory prefix
    const serverDir = path.join(__dirname, '..');
    if (relativePath.startsWith(serverDir)) {
      relativePath = relativePath.substring(serverDir.length);
    }

    // Also handle Railway production paths like /app/uploads/...
    if (relativePath.startsWith('/app/uploads/')) {
      relativePath = relativePath.substring(4); // Remove '/app' prefix
    }

    // Normalize path separators and ensure leading slash
    relativePath = relativePath.replace(/\\/g, '/');
    mediaUrl = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    mediaPath = file.path;
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_stories (id, user_id, media_path, media_url, media_type, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        parseInt(userId, 10),
        mediaPath,
        mediaUrl,
        file.mimetype || 'image',
        caption || '',
        expiresAt
      ]
    );

    const story = result.rows[0];
    logger.info('Profile story added', {
      userId: story.user_id,
      storyId: story.id,
      cloudinary: isCloudinary
    });
    return mapStoryRow({ ...story, views_count: 0, viewers: [], viewers_ids: [] });
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('Story tables missing, skipping persist and returning synthetic story');
      return mapStoryRow({
        id,
        user_id: parseInt(userId, 10),
        user_name: null,
        user_photo: null,
        media_url: mediaUrl,
        media_type: file.mimetype || 'image',
        caption: caption || '',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        views_count: 0,
        viewers: [],
        viewers_ids: []
      });
    }
    logger.error('Failed to add story', { error: error.message, userId });
    throw error;
  }
};

const markStoryViewed = async ({ storyId, viewerId }) => {
  try {
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
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('Story tables missing, skipping markStoryViewed');
      return null;
    }
    logger.error('Failed to mark story viewed', { error: error.message, storyId, viewerId });
    throw error;
  }
};

module.exports = {
  getActiveStories,
  getUserStories,
  addStory,
  markStoryViewed,
  cleanupExpiredStories
};
