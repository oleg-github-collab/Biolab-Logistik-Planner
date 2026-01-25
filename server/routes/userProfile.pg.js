const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { uploadSingleCloudinary, isCloudinaryConfigured } = require('../services/cloudinaryUpload');
const { deleteOldAvatar } = require('../config/cloudinary');
const { getIO, getOnlineUsers } = require('../websocket');
const logger = require('../utils/logger');
const storyService = require('../services/storyService');

const router = express.Router();

// @route   GET /api/profile/:userId
// @desc    Get user profile
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.email, u.role, u.employment_type,
        u.weekly_hours_quota, u.profile_photo, u.status, u.status_message,
        u.bio, u.position_description, u.phone, u.phone_mobile,
        u.emergency_contact, u.emergency_phone, u.address,
        u.date_of_birth, u.hire_date, u.last_seen_at,
        u.timezone, u.language, u.theme, u.created_at, u.is_active,
        up.email_notifications, up.push_notifications, up.desktop_notifications,
        up.sound_enabled, up.notify_messages, up.notify_tasks,
        up.notify_mentions, up.notify_reactions, up.notify_calendar,
        up.compact_view, up.show_avatars, up.message_preview,
        up.quiet_hours_enabled, up.quiet_hours_start, up.quiet_hours_end
      FROM users u
      LEFT JOIN user_preferences up ON u.id = up.user_id
      WHERE u.id = $1 AND u.is_active = TRUE`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error fetching user profile', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/profile/:userId/complete-setup
// @desc    Complete first login setup (change password, set employment info)
router.post('/:userId/complete-setup', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow users to complete their own setup
    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const {
      password,
      employment_type,
      weekly_hours_quota,
      default_start_time,
      default_end_time
    } = req.body;

    const bcrypt = require('bcryptjs');

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль повинен містити мінімум 6 символів' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user with new password and settings
    const updateFields = ['password = $1', 'first_login_completed = TRUE', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [hashedPassword];
    let paramIndex = 2;

    if (employment_type) {
      const allowedTypes = ['Vollzeit', 'Werkstudent'];
      if (!allowedTypes.includes(employment_type)) {
        return res.status(400).json({ error: 'Невірний тип зайнятості' });
      }
      updateFields.push(`employment_type = $${paramIndex}`);
      updateValues.push(employment_type);
      paramIndex++;

      // Auto-set auto_schedule
      updateFields.push(`auto_schedule = $${paramIndex}`);
      updateValues.push(employment_type === 'Vollzeit');
      paramIndex++;
    }

    if (weekly_hours_quota) {
      const hours = parseFloat(weekly_hours_quota);
      if (isNaN(hours) || hours <= 0 || hours > 168) {
        return res.status(400).json({ error: 'Години повинні бути від 0 до 168' });
      }
      updateFields.push(`weekly_hours_quota = $${paramIndex}`);
      updateValues.push(hours);
      paramIndex++;
    }

    if (default_start_time) {
      updateFields.push(`default_start_time = $${paramIndex}`);
      updateValues.push(default_start_time);
      paramIndex++;
    }

    if (default_end_time) {
      updateFields.push(`default_end_time = $${paramIndex}`);
      updateValues.push(default_end_time);
      paramIndex++;
    }

    updateValues.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, email, role, employment_type, weekly_hours_quota,
                 default_start_time, default_end_time, first_login_completed`,
      updateValues
    );

    logger.info('User completed first login setup', { userId });

    res.json({
      message: 'Налаштування профілю завершено',
      user: result.rows[0]
    });

  } catch (error) {
    logger.error('Error completing first login setup', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/profile/:userId
// @desc    Update user profile
router.put('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // CRITICAL SECURITY: Users can ONLY edit their own profile
    if (parseInt(userId) !== req.user.id) {
      logger.warn('Unauthorized profile edit attempt', {
        attemptedUserId: userId,
        requestingUserId: req.user.id,
        requestingUserRole: req.user.role
      });
      return res.status(403).json({ error: 'Ви можете редагувати лише свій власний профіль' });
    }

    const {
      name, status, status_message, bio, position_description,
      phone, phone_mobile, emergency_contact, emergency_phone,
      address, date_of_birth, timezone, language, theme
    } = req.body;

    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        status = COALESCE($2, status),
        status_message = $3,
        bio = $4,
        position_description = $5,
        phone = $6,
        phone_mobile = $7,
        emergency_contact = $8,
        emergency_phone = $9,
        address = $10,
        date_of_birth = $11,
        timezone = COALESCE($12, timezone),
        language = COALESCE($13, language),
        theme = COALESCE($14, theme),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *`,
      [
        name, status, status_message, bio, position_description,
        phone, phone_mobile, emergency_contact, emergency_phone,
        address, date_of_birth, timezone, language, theme, userId
      ]
    );

    // Broadcast status update
    if (status) {
      const io = getIO();
      if (io) {
        io.emit('user:status_changed', {
          userId: parseInt(userId),
          status,
          status_message
        });
      }
    }

    logger.info('User profile updated', { userId, updatedBy: req.user.id });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error updating user profile', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/profile/:userId/photo
// @desc    Upload profile photo (Cloudinary or local fallback)
router.post('/:userId/photo', auth, uploadSingleCloudinary('photo', 'avatar'), async (req, res) => {
  try {
    const { userId } = req.params;

    // CRITICAL SECURITY: Users can ONLY upload their own photo
    if (parseInt(userId) !== req.user.id) {
      logger.warn('Unauthorized photo upload attempt', {
        attemptedUserId: userId,
        requestingUserId: req.user.id
      });
      return res.status(403).json({ error: 'Ви можете завантажувати лише свою фотографію' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get old profile photo to delete from Cloudinary
    const oldPhotoResult = await pool.query(
      'SELECT profile_photo FROM users WHERE id = $1',
      [userId]
    );
    const oldPhotoUrl = oldPhotoResult.rows[0]?.profile_photo;

    // Cloudinary returns req.file.path as the full URL
    let photoUrl = req.file.path;
    if (!isCloudinaryConfigured) {
      // Remove 'app/' prefix if exists and ensure leading slash
      photoUrl = photoUrl.replace(/\\/g, '/').replace(/^app\//, '/');
      if (!photoUrl.startsWith('/')) {
        photoUrl = `/${photoUrl}`;
      }
    }

    // Update user profile_photo
    const result = await pool.query(
      `UPDATE users SET
        profile_photo = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING profile_photo`,
      [photoUrl, userId]
    );

    // Delete old avatar from Cloudinary if exists
    if (oldPhotoUrl && isCloudinaryConfigured) {
      await deleteOldAvatar(oldPhotoUrl);
    }

    logger.info('Profile photo uploaded', {
      userId,
      cloudinary: isCloudinaryConfigured,
      url: photoUrl
    });

    res.json({
      success: true,
      photo_url: result.rows[0].profile_photo
    });

  } catch (error) {
    logger.error('Error uploading profile photo', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/profile/:userId/preferences
// @desc    Update user preferences
router.put('/:userId/preferences', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const {
      email_notifications, push_notifications, desktop_notifications,
      sound_enabled, notify_messages, notify_tasks, notify_mentions,
      notify_reactions, notify_calendar, compact_view, show_avatars,
      message_preview, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
    } = req.body;

    const result = await pool.query(
      `INSERT INTO user_preferences (
        user_id, email_notifications, push_notifications, desktop_notifications,
        sound_enabled, notify_messages, notify_tasks, notify_mentions,
        notify_reactions, notify_calendar, compact_view, show_avatars,
        message_preview, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (user_id) DO UPDATE SET
        email_notifications = EXCLUDED.email_notifications,
        push_notifications = EXCLUDED.push_notifications,
        desktop_notifications = EXCLUDED.desktop_notifications,
        sound_enabled = EXCLUDED.sound_enabled,
        notify_messages = EXCLUDED.notify_messages,
        notify_tasks = EXCLUDED.notify_tasks,
        notify_mentions = EXCLUDED.notify_mentions,
        notify_reactions = EXCLUDED.notify_reactions,
        notify_calendar = EXCLUDED.notify_calendar,
        compact_view = EXCLUDED.compact_view,
        show_avatars = EXCLUDED.show_avatars,
        message_preview = EXCLUDED.message_preview,
        quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId, email_notifications, push_notifications, desktop_notifications,
        sound_enabled, notify_messages, notify_tasks, notify_mentions,
        notify_reactions, notify_calendar, compact_view, show_avatars,
        message_preview, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
      ]
    );

    logger.info('User preferences updated', { userId });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error updating user preferences', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/profile/contacts
// @desc    Get all users as contacts (all registered users visible)
router.get('/contacts/all', auth, async (req, res) => {
  try {
    const { search, role, status } = req.query;

    // Включаємо BL_Bot та всіх користувачів крім поточного
    let query = `
      SELECT
        u.id, u.name, u.email, u.role, u.profile_photo,
        u.status, u.status_message, u.position_description,
        u.last_seen_at, u.created_at, u.is_system_user,
        CASE
          WHEN u.email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de') THEN TRUE
          ELSE FALSE
        END as is_bot
      FROM users u
      WHERE u.is_active = TRUE
        AND u.id != $1
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      query += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // BL_Bot завжди перший, потім всі інші за алфавітом
    query += ` ORDER BY
      CASE
        WHEN u.email IN ('bl_bot@biolab.de', 'entsorgungsbot@biolab.de') THEN 0
        ELSE 1
      END,
      u.name ASC`;

    const result = await pool.query(query, params);

    // Get online users from WebSocket activeUsers
    let onlineSet = new Set();
    try {
      const onlineUsers = getOnlineUsers(); // Synchronous, returns array of userId strings
      if (Array.isArray(onlineUsers) && onlineUsers.length > 0) {
        // Convert string userIds to integers
        onlineSet = new Set(onlineUsers.map(userId => parseInt(userId, 10)));
        logger.debug(`Online users count: ${onlineSet.size}`, { onlineUsers });
      }
    } catch (error) {
      logger.warn('Could not load online status from WebSocket', { error: error.message });
    }

    // Add online status to contacts
    const contacts = result.rows.map((user) => ({
      ...user,
      online: user.is_system_user ? true : onlineSet.has(user.id) // System users (bots) always online
    }));

    res.json({ data: contacts });

  } catch (error) {
    logger.error('Error fetching contacts', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/profile/contacts/:contactId
// @desc    Add/update contact settings
router.post('/contacts/:contactId', auth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { nickname, notes, is_favorite, groups, is_blocked, is_muted } = req.body;

    const result = await pool.query(
      `INSERT INTO user_contacts (
        user_id, contact_user_id, nickname, notes, is_favorite,
        groups, is_blocked, is_muted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, contact_user_id) DO UPDATE SET
        nickname = EXCLUDED.nickname,
        notes = EXCLUDED.notes,
        is_favorite = EXCLUDED.is_favorite,
        groups = EXCLUDED.groups,
        is_blocked = EXCLUDED.is_blocked,
        is_muted = EXCLUDED.is_muted,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [req.user.id, contactId, nickname, notes, is_favorite, groups, is_blocked, is_muted]
    );

    logger.info('Contact settings updated', { userId: req.user.id, contactId });

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Error updating contact settings', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/profile/online-users
// @desc    Get currently online users
router.get('/online-users/list', auth, async (req, res) => {
  try {
    // Users active in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await pool.query(
      `SELECT
        id, name, profile_photo, status, status_message, role,
        last_seen_at
      FROM users
      WHERE is_active = TRUE
        AND last_seen_at > $1
      ORDER BY last_seen_at DESC`,
      [fiveMinutesAgo]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching online users', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stories Endpoints

router.get('/stories/feed', auth, async (req, res) => {
  try {
    const stories = await storyService.getActiveStories(req.user.id);
    res.json({ stories });
  } catch (error) {
    logger.error('Error fetching stories feed', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:userId/stories', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const stories = await storyService.getUserStories(userId, req.user.id);
    res.json({ stories });
  } catch (error) {
    logger.error('Error fetching user stories', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:userId/stories', auth, uploadSingleCloudinary('storyMedia', 'story'), async (req, res) => {
  try {
    const { userId } = req.params;
    const caption = req.body?.caption || '';

    if (parseInt(userId, 10) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const story = await storyService.addStory({
      userId,
      file: req.file,
      caption,
      isCloudinary: isCloudinaryConfigured
    });

    res.json({ story });
  } catch (error) {
    logger.error('Error uploading story', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/stories/:storyId/view', auth, async (req, res) => {
  try {
    const { storyId } = req.params;
    const story = await storyService.markStoryViewed({
      storyId,
      viewerId: req.user.id
    });

    if (!story) {
      return res.status(404).json({ error: 'Story nicht gefunden' });
    }

    res.json({ story });
  } catch (error) {
    logger.error('Error marking story view', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
