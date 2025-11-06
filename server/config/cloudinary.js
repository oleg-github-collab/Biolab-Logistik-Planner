const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('../utils/logger');

// Configure Cloudinary
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  logger.info('Cloudinary configured successfully');
} else {
  logger.warn('Cloudinary credentials not found - using local storage fallback');
}

// Storage for profile photos (avatars)
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'biolab-logistik/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' }
    ],
    public_id: (req, file) => {
      const userId = req.params.userId || req.user?.id || Date.now();
      return `avatar-${userId}-${Date.now()}`;
    }
  }
});

// Storage for stories (24h auto-delete via expiration)
const storyStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'biolab-logistik/stories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'],
    resource_type: 'auto',
    transformation: [
      { width: 1080, height: 1920, crop: 'limit' },
      { quality: 'auto:good' }
    ],
    public_id: (req, file) => {
      const userId = req.params.userId || req.user?.id || Date.now();
      return `story-${userId}-${Date.now()}`;
    }
  }
});

/**
 * Delete old avatar when uploading new one
 * @param {string} publicId - Cloudinary public_id of the old avatar
 */
const deleteOldAvatar = async (publicId) => {
  if (!isCloudinaryConfigured || !publicId) return;

  try {
    // Extract public_id from URL if needed
    let extractedId = publicId;
    if (publicId.includes('cloudinary.com')) {
      const urlParts = publicId.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex !== -1) {
        extractedId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
      }
    }

    await cloudinary.uploader.destroy(extractedId);
    logger.info('Old avatar deleted from Cloudinary', { publicId: extractedId });
  } catch (error) {
    logger.error('Failed to delete old avatar from Cloudinary', { error: error.message, publicId });
  }
};

/**
 * Delete story from Cloudinary
 * @param {string} publicId - Cloudinary public_id or URL of the story
 */
const deleteStory = async (publicId) => {
  if (!isCloudinaryConfigured || !publicId) return;

  try {
    // Extract public_id from URL if needed
    let extractedId = publicId;
    if (publicId.includes('cloudinary.com')) {
      const urlParts = publicId.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex !== -1) {
        extractedId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
      }
    }

    // Try both image and video resource types
    try {
      await cloudinary.uploader.destroy(extractedId, { resource_type: 'image' });
    } catch (err) {
      await cloudinary.uploader.destroy(extractedId, { resource_type: 'video' });
    }

    logger.info('Story deleted from Cloudinary', { publicId: extractedId });
  } catch (error) {
    logger.error('Failed to delete story from Cloudinary', { error: error.message, publicId });
  }
};

/**
 * Bulk delete expired stories from Cloudinary
 * @param {Array<string>} publicIds - Array of Cloudinary public_ids or URLs
 */
const bulkDeleteStories = async (publicIds) => {
  if (!isCloudinaryConfigured || !publicIds || publicIds.length === 0) return;

  const deletePromises = publicIds.map(id => deleteStory(id));
  await Promise.allSettled(deletePromises);

  logger.info('Bulk delete stories completed', { count: publicIds.length });
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  profilePhotoStorage,
  storyStorage,
  deleteOldAvatar,
  deleteStory,
  bulkDeleteStories
};
