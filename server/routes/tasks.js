const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const { getIO } = require('../websocket');
const router = express.Router();

// @route   GET /api/tasks
// @desc    Get all tasks (shared for all users)
router.get('/', auth, (req, res) => {
  try {
    const { status } = req.query;

    let query = `SELECT t.*,
      u.name as assignee_name,
      updater.name as last_updated_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users updater ON t.last_updated_by = updater.id`;
    const params = [];

    if (status) {
      query += " WHERE t.status = ?";
      params.push(status);
    }

    query += " ORDER BY t.priority DESC, t.due_date ASC";

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      // Parse tags from JSON
      const tasks = rows.map(row => ({
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : []
      }));

      res.json(tasks);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
router.post('/', auth, (req, res) => {
  try {
    const { 
      title, 
      description, 
      status = 'todo',
      priority = 'medium',
      assigneeId,
      dueDate,
      tags = []
    } = req.body;
    
    // Validate inputs
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Validate status
    const validStatuses = ['todo', 'inprogress', 'review', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Validate priority
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    
    db.run(
      `INSERT INTO tasks (
        title, description, status, priority, assignee_id, due_date, tags, last_updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        status,
        priority,
        assigneeId || null,
        dueDate ? new Date(dueDate).toISOString().slice(0, 19).replace('T', ' ') : null,
        JSON.stringify(tags),
        req.user.id
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }

        db.get(
          `SELECT t.*,
            u.name as assignee_name,
            updater.name as last_updated_by_name
           FROM tasks t
           LEFT JOIN users u ON t.assignee_id = u.id
           LEFT JOIN users updater ON t.last_updated_by = updater.id
           WHERE t.id = ?`,
          [this.lastID],
          (err, task) => {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }

            const formattedTask = {
              ...task,
              tags: task.tags ? JSON.parse(task.tags) : []
            };

            // Broadcast to all connected clients via WebSocket
            const io = getIO();
            if (io) {
              io.emit('task:created', {
                task: formattedTask,
                user: {
                  id: req.user.id,
                  name: req.user.name
                }
              });
            }

            res.status(201).json(formattedTask);
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
router.put('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      status,
      priority,
      assigneeId,
      dueDate,
      tags
    } = req.body;
    
    // First, verify the task exists
    db.get(
      "SELECT id FROM tasks WHERE id = ?",
      [id],
      (err, task) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (title !== undefined) {
          updates.push("title = ?");
          values.push(title);
        }
        
        if (description !== undefined) {
          updates.push("description = ?");
          values.push(description || null);
        }
        
        if (status !== undefined) {
          const validStatuses = ['todo', 'inprogress', 'review', 'done'];
          if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
          }
          updates.push("status = ?");
          values.push(status);
        }
        
        if (priority !== undefined) {
          const validPriorities = ['low', 'medium', 'high'];
          if (!validPriorities.includes(priority)) {
            return res.status(400).json({ error: 'Invalid priority' });
          }
          updates.push("priority = ?");
          values.push(priority);
        }
        
        if (assigneeId !== undefined) {
          updates.push("assignee_id = ?");
          values.push(assigneeId || null);
        }
        
        if (dueDate !== undefined) {
          updates.push("due_date = ?");
          values.push(dueDate ? new Date(dueDate).toISOString().slice(0, 19).replace('T', ' ') : null);
        }
        
        if (tags !== undefined) {
          updates.push("tags = ?");
          values.push(JSON.stringify(tags));
        }

        updates.push("updated_at = CURRENT_TIMESTAMP");
        updates.push("last_updated_by = ?");
        values.push(req.user.id);

        if (updates.length === 2) { // Only updated_at and last_updated_by were added
          return res.status(400).json({ error: 'No fields to update' });
        }

        const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);

        db.run(query, values, function(err) {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }

          db.get(
            `SELECT t.*,
              u.name as assignee_name,
              updater.name as last_updated_by_name
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             LEFT JOIN users updater ON t.last_updated_by = updater.id
             WHERE t.id = ?`,
            [id],
            (err, updatedTask) => {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }

              const formattedTask = {
                ...updatedTask,
                tags: updatedTask.tags ? JSON.parse(updatedTask.tags) : []
              };

              // Broadcast to all connected clients via WebSocket
              const io = getIO();
              if (io) {
                // Determine the type of update
                let updateType = 'task:updated';
                if (status !== undefined && task.status !== status) {
                  updateType = 'task:moved';
                }

                io.emit(updateType, {
                  task: formattedTask,
                  user: {
                    id: req.user.id,
                    name: req.user.name
                  },
                  previousStatus: task.status
                });
              }

              res.json(formattedTask);
            }
          );
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
router.delete('/:id', auth, (req, res) => {
  try {
    const { id } = req.params;

    // First, verify the task exists and get its data
    db.get(
      `SELECT t.*,
        u.name as assignee_name,
        updater.name as last_updated_by_name
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users updater ON t.last_updated_by = updater.id
       WHERE t.id = ?`,
      [id],
      (err, task) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }

        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }

        db.run(
          "DELETE FROM tasks WHERE id = ?",
          [id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Server error' });
            }

            // Broadcast to all connected clients via WebSocket
            const io = getIO();
            if (io) {
              io.emit('task:deleted', {
                taskId: id,
                task: {
                  ...task,
                  tags: task.tags ? JSON.parse(task.tags) : []
                },
                user: {
                  id: req.user.id,
                  name: req.user.name
                }
              });
            }

            res.json({ message: 'Task deleted successfully' });
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;