const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const STORIES_DIR = path.join(__dirname, '..', 'uploads', 'stories');
const STORIES_DB_PATH = path.join(STORIES_DIR, 'stories.json');

const ensureStorage = async () => {
  if (!fs.existsSync(STORIES_DIR)) {
    await mkdir(STORIES_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORIES_DB_PATH)) {
    await writeFile(STORIES_DB_PATH, JSON.stringify([]), 'utf-8');
  }
};

const readStories = async () => {
  await ensureStorage();
  try {
    const raw = await readFile(STORIES_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('Failed to read stories storage', { error: error.message });
    return [];
  }
};

const writeStories = async (stories) => {
  await ensureStorage();
  try {
    await writeFile(STORIES_DB_PATH, JSON.stringify(stories, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to write stories storage', { error: error.message });
  }
};

const isExpired = (story) => {
  if (!story || !story.expiresAt) return true;
  return new Date(story.expiresAt).getTime() <= Date.now();
};

const cleanupExpiredStories = async () => {
  const stories = await readStories();
  const activeStories = [];

  for (const story of stories) {
    if (isExpired(story)) {
      if (story.mediaPath) {
        const absolutePath = path.isAbsolute(story.mediaPath)
          ? story.mediaPath
          : path.join(__dirname, '..', story.mediaPath);
        fs.promises.unlink(absolutePath).catch(() => {});
      }
    } else {
      activeStories.push(story);
    }
  }

  if (activeStories.length !== stories.length) {
    await writeStories(activeStories);
  }

  return activeStories;
};

const mapStoryForResponse = (story) => ({
  id: story.id,
  userId: story.userId,
  mediaUrl: story.mediaUrl,
  mediaType: story.mediaType,
  caption: story.caption || '',
  createdAt: story.createdAt,
  expiresAt: story.expiresAt,
  views: Array.isArray(story.views) ? story.views.length : 0,
  viewers: story.viewers || []
});

const getActiveStories = async () => {
  const stories = await cleanupExpiredStories();
  return stories.map(mapStoryForResponse);
};

const getUserStories = async (userId) => {
  const stories = await cleanupExpiredStories();
  return stories
    .filter((story) => story.userId === parseInt(userId, 10))
    .map(mapStoryForResponse);
};

const addStory = async ({ userId, file, caption }) => {
  const stories = await cleanupExpiredStories();

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const relativePath = file.path.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/');

  const story = {
    id,
    userId: parseInt(userId, 10),
    mediaPath: file.path,
    mediaUrl: relativePath.startsWith('/') ? relativePath : `/${relativePath}`,
    mediaType: file.mimetype || 'application/octet-stream',
    caption: caption || '',
    createdAt: new Date().toISOString(),
    expiresAt,
    views: [],
    viewers: []
  };

  stories.push(story);
  await writeStories(stories);

  logger.info('Profile story added', { userId: story.userId, storyId: story.id });
  return mapStoryForResponse(story);
};

const markStoryViewed = async ({ storyId, viewerId }) => {
  const stories = await cleanupExpiredStories();
  const idx = stories.findIndex((story) => story.id === storyId);
  if (idx === -1) {
    return null;
  }

  const story = stories[idx];
  const viewer = parseInt(viewerId, 10);
  story.views = Array.isArray(story.views) ? story.views : [];
  story.viewers = Array.isArray(story.viewers) ? story.viewers : [];

  if (!story.views.includes(viewer)) {
    story.views.push(viewer);
  }

  if (!story.viewers.some((entry) => entry && entry.userId === viewer)) {
    story.viewers.push({ userId: viewer, viewedAt: new Date().toISOString() });
  }

  stories[idx] = story;
  await writeStories(stories);
  return mapStoryForResponse(story);
};

module.exports = {
  getActiveStories,
  getUserStories,
  addStory,
  markStoryViewed,
  cleanupExpiredStories
};
