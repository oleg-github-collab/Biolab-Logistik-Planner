const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const contextDirectories = {
  message: 'messages',
  calendar: 'calendar',
  task: 'tasks',
  general: 'general'
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const context = req.body.context && contextDirectories[req.body.context]
      ? contextDirectories[req.body.context]
      : contextDirectories.general;

    const destPath = path.join(__dirname, '..', '..', 'uploads', context);
    ensureDir(destPath);
    cb(null, destPath);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  }
});

const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4'
];

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter(req, file, cb) {
    if (ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

const mapFileToPayload = (file, extra = {}) => {
  const url = `/uploads/${path.basename(file.destination)}/${file.filename}`;
  const type = file.mimetype.startsWith('image/') ? 'image' : file.mimetype.startsWith('audio/') ? 'audio' : 'file';

  return {
    id: uuid(),
    url,
    type,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    ...extra
  };
};

router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }

  try {
    const context = req.body.context || 'general';
    const payload = mapFileToPayload(req.file, {
      context,
      conversationId: req.body.conversationId ? Number(req.body.conversationId) : undefined,
      eventId: req.body.eventId ? Number(req.body.eventId) : undefined
    });

    logger.info('File uploaded', {
      userId: req.user.id,
      context,
      mimeType: payload.mimeType,
      size: payload.size
    });

    res.status(201).json(payload);
  } catch (error) {
    logger.error('File upload failed', { error: error.message });
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload fehlgeschlagen' });
  }
});

module.exports = router;
