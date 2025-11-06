const multer = require('multer');
const {
  isCloudinaryConfigured,
  profilePhotoStorage,
  storyStorage
} = require('../config/cloudinary');

// Fallback to local storage if Cloudinary is not configured
const { uploadSingle: localUploadSingle } = require('./fileService');

/**
 * Upload single file to Cloudinary or local storage (fallback)
 * @param {string} fieldName - Form field name
 * @param {string} type - 'avatar' or 'story'
 */
function uploadSingleCloudinary(fieldName, type = 'avatar') {
  if (!isCloudinaryConfigured) {
    // Fallback to local storage
    return localUploadSingle(fieldName);
  }

  const storage = type === 'avatar' ? profilePhotoStorage : storyStorage;

  const uploader = multer({
    storage: storage,
    limits: {
      fileSize: type === 'avatar' ? 5 * 1024 * 1024 : 50 * 1024 * 1024 // 5MB for avatars, 50MB for stories
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = type === 'avatar'
        ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        : ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type for ${type}. Allowed: ${allowedMimes.join(', ')}`));
      }
    }
  });

  return uploader.single(fieldName);
}

module.exports = {
  uploadSingleCloudinary,
  isCloudinaryConfigured
};
