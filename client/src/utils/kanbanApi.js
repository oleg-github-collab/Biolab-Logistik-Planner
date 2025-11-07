import api from './api';

// ============================================
// KANBAN TASKS API
// ============================================

/**
 * Fetch all kanban tasks
 * @returns {Promise} Array of tasks with attachments and comments count
 */
export const fetchTasks = async () => {
  try {
    const response = await api.get('/kanban/tasks');
    return response.data;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

/**
 * Fetch single task with full details
 * @param {number} taskId - Task ID
 * @returns {Promise} Task with attachments, comments, and activity log
 */
export const fetchTaskById = async (taskId) => {
  try {
    const response = await api.get(`/kanban/tasks/${taskId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching task:', error);
    throw error;
  }
};

/**
 * Create new task
 * @param {Object} taskData - Task data
 * @returns {Promise} Created task
 */
export const createTask = async (taskData) => {
  try {
    const response = await api.post('/kanban/tasks', taskData);
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

/**
 * Update existing task
 * @param {number} taskId - Task ID
 * @param {Object} taskData - Updated task data
 * @returns {Promise} Updated task
 */
export const updateTask = async (taskId, taskData) => {
  try {
    const response = await api.put(`/kanban/tasks/${taskId}`, taskData);
    return response.data;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

/**
 * Delete task
 * @param {number} taskId - Task ID
 * @returns {Promise} Success response
 */
export const deleteTask = async (taskId) => {
  try {
    const response = await api.delete(`/kanban/tasks/${taskId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// ============================================
// ATTACHMENTS API
// ============================================

/**
 * Upload attachment to task
 * @param {number} taskId - Task ID
 * @param {File} file - File to upload
 * @param {string} fileType - File type (image/audio/document)
 * @returns {Promise} Created attachment
 */
export const uploadAttachment = async (taskId, file, fileType = 'document') => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);

    const response = await api.post(`/kanban/tasks/${taskId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading attachment:', error);
    throw error;
  }
};

/**
 * Delete attachment
 * @param {number} attachmentId - Attachment ID
 * @returns {Promise} Success response
 */
export const deleteAttachment = async (attachmentId) => {
  try {
    const response = await api.delete(`/kanban/attachments/${attachmentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    throw error;
  }
};

// ============================================
// COMMENTS API
// ============================================

/**
 * Fetch comments for a task
 * @param {number} taskId - Task ID
 * @returns {Promise} Array of comments
 */
export const fetchComments = async (taskId) => {
  try {
    const response = await api.get(`/kanban/tasks/${taskId}/comments`);
    return response.data;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

/**
 * Add comment to task
 * @param {number} taskId - Task ID
 * @param {string} commentText - Comment text
 * @param {Array} attachments - Array of files to attach
 * @param {number} parentCommentId - Parent comment ID for threading
 * @returns {Promise} Created comment
 */
export const addComment = async (taskId, commentText, attachments = [], parentCommentId = null) => {
  try {
    const formData = new FormData();
    if (commentText) {
      formData.append('comment_text', commentText);
    }
    if (parentCommentId) {
      formData.append('parent_comment_id', parentCommentId);
    }

    // Append multiple attachments
    attachments.forEach((file) => {
      formData.append('attachments', file);
    });

    const response = await api.post(`/kanban/tasks/${taskId}/comments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

/**
 * Delete comment
 * @param {number} commentId - Comment ID
 * @returns {Promise} Success response
 */
export const deleteComment = async (commentId) => {
  try {
    const response = await api.delete(`/kanban/comments/${commentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// ============================================
// ACTIVITY LOG API
// ============================================

/**
 * Fetch activity log for a task
 * @param {number} taskId - Task ID
 * @returns {Promise} Array of activity log entries
 */
export const fetchActivityLog = async (taskId) => {
  try {
    const response = await api.get(`/kanban/tasks/${taskId}/activity`);
    return response.data;
  } catch (error) {
    console.error('Error fetching activity log:', error);
    throw error;
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Map priority value from DB to German label
 * @param {string} priority - Priority value (low/medium/high)
 * @returns {string} German label
 */
export const getPriorityLabel = (priority) => {
  const priorityMap = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Dringend',
  };
  return priorityMap[priority] || 'Mittel';
};

/**
 * Get priority color class
 * @param {string} priority - Priority value (low/medium/high)
 * @returns {string} Tailwind CSS classes
 */
export const getPriorityColorClass = (priority) => {
  const colorMap = {
    low: 'bg-green-100 text-green-700 border-green-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    high: 'bg-red-100 text-red-700 border-red-300',
  };
  return colorMap[priority] || colorMap.medium;
};

/**
 * Map status value to German label
 * @param {string} status - Status value
 * @returns {string} German label
 */
export const getStatusLabel = (status) => {
  const statusMap = {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'In Arbeit',
    review: 'Review',
    done: 'Erledigt',
  };
  return statusMap[status] || status;
};

export default {
  fetchTasks,
  fetchTaskById,
  createTask,
  updateTask,
  deleteTask,
  uploadAttachment,
  deleteAttachment,
  fetchComments,
  addComment,
  deleteComment,
  fetchActivityLog,
  getPriorityLabel,
  getPriorityColorClass,
  getStatusLabel,
};
