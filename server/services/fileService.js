const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');

let sharp;
let sharpAvailable = true;

try {
  sharp = require('sharp');
} catch (error) {
  sharpAvailable = false;
  logger.warn('Image processing library (sharp) not available. Continuing without image resizing.', {
    error: error.message
  });
  console.warn('⚠️  Image processing disabled: sharp module failed to load.', error);
}

// File upload configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB default

// Allowed file types
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
};

// Ensure upload directories exist
async function ensureDirectories() {
  const dirs = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, 'images'),
    path.join(UPLOAD_DIR, 'videos'),
    path.join(UPLOAD_DIR, 'documents'),
    path.join(UPLOAD_DIR, 'audio'),
    path.join(UPLOAD_DIR, 'thumbnails'),
    path.join(UPLOAD_DIR, 'temp'),
    path.join(UPLOAD_DIR, 'stories')
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

// Initialize directories on startup
ensureDirectories();

// Generate unique filename
function generateFilename(originalname) {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalname);
  return `${timestamp}-${randomString}${ext}`;
}

// Determine file type category
function getFileTypeCategory(mimetype) {
  for (const [category, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimetype)) {
      return category;
    }
  }
  return 'document'; // Default to document
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const fileType = getFileTypeCategory(file.mimetype);
      const dest = path.join(UPLOAD_DIR, `${fileType}s`);
      await fs.mkdir(dest, { recursive: true });
      cb(null, dest);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const filename = generateFilename(file.originalname);
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat();

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

// Create multer upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Generate thumbnail for images
async function generateImageThumbnail(imagePath, width = 300, height = 300) {
  if (!sharpAvailable) {
    return null;
  }

  try {
    const thumbnailFilename = `thumb_${path.basename(imagePath)}`;
    const thumbnailPath = path.join(UPLOAD_DIR, 'thumbnails', thumbnailFilename);

    await sharp(imagePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return `/uploads/thumbnails/${thumbnailFilename}`;
  } catch (error) {
    logger.error('Error generating thumbnail:', error);
    return null;
  }
}

// Get image dimensions
async function getImageDimensions(imagePath) {
  if (!sharpAvailable) {
    return { width: null, height: null };
  }

  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    logger.error('Error getting image dimensions:', error);
    return { width: null, height: null };
  }
}

// Process uploaded file
async function processUploadedFile(file, userId) {
  const fileType = getFileTypeCategory(file.mimetype);
  const relativePath = path.relative(UPLOAD_DIR, file.path);

  let thumbnail = null;
  let dimensions = { width: null, height: null };

  // Generate thumbnail and get dimensions for images
  if (fileType === 'image') {
    thumbnail = await generateImageThumbnail(file.path);
    dimensions = await getImageDimensions(file.path);
  }

  return {
    filename: file.filename,
    originalFilename: file.originalname,
    filePath: relativePath,
    fileSize: file.size,
    mimeType: file.mimetype,
    fileType,
    width: dimensions.width,
    height: dimensions.height,
    thumbnailPath: thumbnail,
    uploadedBy: userId
  };
}

// Delete file from filesystem
async function deleteFile(filePath) {
  try {
    const fullPath = path.join(UPLOAD_DIR, filePath);
    await fs.unlink(fullPath);

    // Also delete thumbnail if it exists
    const filename = path.basename(filePath);
    const thumbnailPath = path.join(UPLOAD_DIR, 'thumbnails', `thumb_${filename}`);
    try {
      await fs.unlink(thumbnailPath);
    } catch (error) {
      // Thumbnail might not exist, ignore error
    }

    logger.info('File deleted:', filePath);
    return true;
  } catch (error) {
    logger.error('Error deleting file:', error);
    return false;
  }
}

// Get file info
async function getFileInfo(filePath) {
  try {
    const fullPath = path.join(UPLOAD_DIR, filePath);
    const stats = await fs.stat(fullPath);

    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    return { exists: false };
  }
}

// Clean up old temporary files
async function cleanupTempFiles(olderThanHours = 24) {
  try {
    const tempDir = path.join(UPLOAD_DIR, 'temp');
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const cutoff = olderThanHours * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtimeMs > cutoff) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} temporary files`);
    }

    return deletedCount;
  } catch (error) {
    logger.error('Error cleaning up temp files:', error);
    return 0;
  }
}

// Get total storage usage
async function getStorageUsage() {
  try {
    const categories = ['images', 'videos', 'documents', 'audio'];
    const usage = {};
    let total = 0;

    for (const category of categories) {
      const dir = path.join(UPLOAD_DIR, category);
      const files = await fs.readdir(dir);
      let categorySize = 0;

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        categorySize += stats.size;
      }

      usage[category] = categorySize;
      total += categorySize;
    }

    usage.total = total;
    usage.totalMB = (total / (1024 * 1024)).toFixed(2);
    usage.totalGB = (total / (1024 * 1024 * 1024)).toFixed(2);

    return usage;
  } catch (error) {
    logger.error('Error calculating storage usage:', error);
    return null;
  }
}

// Validate file before upload
function validateFile(file) {
  const errors = [];

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Check mime type
  const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat();
  if (!allAllowedTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} is not allowed`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Create optimized image versions (webp)
async function createOptimizedImage(imagePath) {
  try {
    const ext = path.extname(imagePath);
    const webpPath = imagePath.replace(ext, '.webp');

    await sharp(imagePath)
      .webp({ quality: 85 })
      .toFile(webpPath);

    return webpPath;
  } catch (error) {
    logger.error('Error creating optimized image:', error);
    return null;
  }
}

// Batch file upload
function uploadMultiple(fieldName, maxCount = 10) {
  return upload.array(fieldName, maxCount);
}

// Single file upload
function uploadSingle(fieldName) {
  return upload.single(fieldName);
}

// File fields upload (multiple fields)
function uploadFields(fields) {
  return upload.fields(fields);
}

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  processUploadedFile,
  deleteFile,
  getFileInfo,
  cleanupTempFiles,
  getStorageUsage,
  validateFile,
  generateImageThumbnail,
  getImageDimensions,
  createOptimizedImage,
  UPLOAD_DIR,
  ALLOWED_MIME_TYPES
};
