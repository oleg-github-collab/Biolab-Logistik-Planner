const { pool } = require('../config/database');
const logger = require('../utils/logger');

const createCalendarEvent = async (client, { title, description, keepUntil, createdBy, tags = [] }) => {
  const startTime = new Date(`${keepUntil}T10:00:00`);
  const endTime = new Date(`${keepUntil}T11:00:00`);

  const result = await client.query(
    `INSERT INTO calendar_events (
       title, description, start_time, end_time, all_day, event_type,
       category, status, reminder, tags, created_by
     ) VALUES ($1, $2, $3, $4, FALSE, 'inspection', 'logistics', 'confirmed', 60, $5, $6)
     RETURNING *`,
    [
      title,
      description,
      startTime.toISOString(),
      endTime.toISOString(),
      JSON.stringify(tags),
      createdBy
    ]
  );

  return result.rows[0];
};

const createKanbanTask = async (client, { title, description, dueDate, createdBy, tags = [] }) => {
  const taskResult = await client.query(
    `INSERT INTO tasks (title, description, status, priority, due_date, category, tags, created_by)
     VALUES ($1, $2, 'todo', 'high', $3, 'kisten', $4, $5)
     RETURNING *`,
    [title, description, dueDate, JSON.stringify(tags), createdBy]
  );

  return taskResult.rows[0];
};

const updateCalendarEventDetails = async (client, eventId, { title, description, keepUntil, tags = [] }) => {
  if (!eventId) return null;
  const startTime = new Date(`${keepUntil}T10:00:00`);
  const endTime = new Date(`${keepUntil}T11:00:00`);

  const result = await client.query(
    `UPDATE calendar_events
        SET title = $1,
            description = $2,
            start_time = $3,
            end_time = $4,
            tags = $5,
            status = 'confirmed',
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
    [
      title,
      description,
      startTime.toISOString(),
      endTime.toISOString(),
      JSON.stringify(tags),
      eventId
    ]
  );

  return result.rows[0] || null;
};

const updateKanbanTaskDetails = async (client, taskId, { title, description, dueDate, tags = [] }) => {
  if (!taskId) return null;
  const result = await client.query(
    `UPDATE tasks
        SET title = $1,
            description = $2,
            due_date = $3,
            tags = $4,
            status = 'todo',
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *`,
    [title, description, dueDate, JSON.stringify(tags), taskId]
  );

  return result.rows[0] || null;
};

const insertStorageBinAudit = async (client, storageBinId, action, details, userId) => {
  await client.query(
    `INSERT INTO storage_bin_audit (storage_bin_id, action, details, created_by)
     VALUES ($1, $2, $3, $4)`,
    [storageBinId, action, details ? JSON.stringify(details) : '{}', userId]
  );
};

const enrichStorageBins = async () => {
  const result = await pool.query(
    `SELECT
       sb.*,
       u.name AS created_by_name,
       t.status AS task_status,
       ce.start_time AS calendar_start,
       ce.end_time AS calendar_end
     FROM storage_bins sb
     LEFT JOIN users u ON sb.created_by = u.id
     LEFT JOIN tasks t ON sb.task_id = t.id
     LEFT JOIN calendar_events ce ON sb.calendar_event_id = ce.id
     ORDER BY sb.status ASC, sb.keep_until ASC, sb.created_at DESC`
  );

  return result.rows.map((row) => ({
    ...row,
    is_overdue: row.status === 'pending' && row.keep_until && new Date(row.keep_until) < new Date().setHours(0, 0, 0, 0),
    calendar:
      row.calendar_start && row.calendar_end
        ? {
            start: row.calendar_start,
            end: row.calendar_end
          }
        : null,
    task_status: row.task_status || null
  }));
};

const getAdminUserIds = async (client) => {
  const adminsRes = await client.query(
    `SELECT id FROM users WHERE role IN ('admin', 'superadmin') AND is_active = TRUE`
  );
  return adminsRes.rows.map((row) => row.id);
};

const getPendingBinsDue = async (client) => {
  const result = await client.query(
    `SELECT sb.*
       FROM storage_bins sb
      WHERE sb.status = 'pending'
        AND sb.keep_until <= CURRENT_DATE
      ORDER BY sb.keep_until ASC`
  );
  return result.rows;
};

const getBinsRemindedToday = async (client) => {
  const result = await client.query(
    `SELECT storage_bin_id
       FROM storage_bin_audit
      WHERE action = 'reminder'
        AND DATE(created_at) = CURRENT_DATE`
  );
  return new Set(result.rows.map((row) => row.storage_bin_id));
};

const autoCompleteBinsWithDoneTasks = async (client) => {
  const result = await client.query(
    `UPDATE storage_bins sb
        SET status = 'completed',
            completed_by = COALESCE(sb.completed_by, t.assigned_to),
            completed_at = COALESCE(sb.completed_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
       FROM tasks t
      WHERE sb.task_id = t.id
        AND t.status = 'done'
        AND sb.status <> 'completed'
      RETURNING sb.id, sb.code, sb.completed_by`
  );

  if (result.rows.length > 0) {
    await Promise.all(
      result.rows.map((row) =>
        insertStorageBinAudit(
          client,
          row.id,
          'auto_completed',
          { reason: 'kanban_task_completed', code: row.code },
          row.completed_by || null
        )
      )
    );
  }

  return result.rows;
};

module.exports = {
  createCalendarEvent,
  createKanbanTask,
  updateCalendarEventDetails,
  updateKanbanTaskDetails,
  insertStorageBinAudit,
  enrichStorageBins,
  getAdminUserIds,
  getPendingBinsDue,
  getBinsRemindedToday,
  autoCompleteBinsWithDoneTasks
};
