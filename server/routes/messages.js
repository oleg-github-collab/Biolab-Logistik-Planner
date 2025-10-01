const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/messages
// @desc    Get message history for user
router.get('/', auth, (req, res) => {
  try {
    // Get all messages involving the user (sent or received)
    const query = `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.is_group,
        m.read_status,
        m.created_at,
        sender.name as sender_name,
        receiver.name as receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.created_at DESC
      LIMIT 100
    `;
    
    db.all(query, [req.user.id, req.user.id], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      
      // Mark received messages as read
      db.run(
        "UPDATE messages SET read_status = 1 WHERE receiver_id = ? AND read_status = 0",
        [req.user.id],
        (err) => {
          if (err) {
            console.error('Error marking messages as read:', err.message);
          }
        }
      );
      
      res.json(rows);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get count of unread messages
router.get('/unread-count', auth, (req, res) => {
  try {
    db.get(
      "SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read_status = 0",
      [req.user.id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ unreadCount: row.count });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages
// @desc    Send a message
router.post('/', auth, (req, res) => {
  const { receiverId, message, isGroup } = req.body;
  
  try {
    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    // For private messages, validate receiver
    if (!isGroup && (!receiverId || receiverId == req.user.id)) {
      return res.status(400).json({ error: 'Invalid receiver' });
    }
    
    // Insert message
    db.run(
      "INSERT INTO messages (sender_id, receiver_id, message, is_group, read_status) VALUES (?, ?, ?, ?, 0)",
      [req.user.id, isGroup ? null : receiverId, message, isGroup ? 1 : 0],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        // Get the inserted message with user info
        const query = `
          SELECT 
            m.id,
            m.sender_id,
            m.receiver_id,
            m.message,
            m.is_group,
            m.read_status,
            m.created_at,
            sender.name as sender_name,
            receiver.name as receiver_name
          FROM messages m
          JOIN users sender ON m.sender_id = sender.id
          LEFT JOIN users receiver ON m.receiver_id = receiver.id
          WHERE m.id = ?
        `;
        
        db.get(query, [this.lastID], (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          
          res.json(row);
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/users
// @desc    Get all users for messaging
router.get('/users', auth, (req, res) => {
  try {
    db.all(
      "SELECT id, name, email FROM users WHERE id != ?",
      [req.user.id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json(rows);
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get all conversations for a user
router.get('/conversations', auth, (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        CASE
          WHEN m.sender_id = ? THEN m.receiver_id
          ELSE m.sender_id
        END as user_id,
        u.name as user_name,
        u.email as user_email,
        MAX(m.created_at) as last_message_time,
        (SELECT message FROM messages WHERE
          (sender_id = ? AND receiver_id = u.id) OR
          (sender_id = u.id AND receiver_id = ?)
          ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages WHERE
          sender_id = u.id AND receiver_id = ? AND read_status = 0) as unread_count
      FROM messages m
      JOIN users u ON (
        (m.sender_id = ? AND m.receiver_id = u.id) OR
        (m.receiver_id = ? AND m.sender_id = u.id)
      )
      WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.is_group = 0
      GROUP BY u.id, u.name, u.email
      ORDER BY last_message_time DESC
    `;

    db.all(query, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      const conversations = rows.map(row => ({
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        lastMessage: row.last_message,
        lastMessageTime: row.last_message_time,
        unreadCount: row.unread_count || 0
      }));

      res.json(conversations);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/conversation/:userId
// @desc    Get messages in a conversation with a specific user
router.get('/conversation/:userId', auth, (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.created_at,
        m.read_status,
        sender.name as sender_name,
        receiver.name as receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      WHERE
        (m.sender_id = ? AND m.receiver_id = ?) OR
        (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `;

    db.all(query, [req.user.id, userId, userId, req.user.id], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      // Mark messages as read
      db.run(
        "UPDATE messages SET read_status = 1 WHERE sender_id = ? AND receiver_id = ? AND read_status = 0",
        [userId, req.user.id],
        (err) => {
          if (err) {
            console.error('Error marking messages as read:', err);
          }
        }
      );

      res.json(rows);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/start
// @desc    Start a conversation with a user
router.post('/start', auth, (req, res) => {
  const { receiver_id } = req.body;

  try {
    // Check if receiver exists
    db.get("SELECT id, name, email FROM users WHERE id = ?", [receiver_id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return conversation info
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        lastMessage: null,
        lastMessageTime: null,
        unreadCount: 0
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/send
// @desc    Send a message to a user
router.post('/send', auth, (req, res) => {
  const { receiver_id, message } = req.body;

  try {
    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (!receiver_id || receiver_id == req.user.id) {
      return res.status(400).json({ error: 'Invalid receiver' });
    }

    // Insert message
    db.run(
      "INSERT INTO messages (sender_id, receiver_id, message, is_group, read_status, created_at) VALUES (?, ?, ?, 0, 0, datetime('now'))",
      [req.user.id, receiver_id, message.trim()],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        // Get the inserted message with user info
        db.get(
          `SELECT
            m.id,
            m.sender_id,
            m.receiver_id,
            m.message,
            m.created_at,
            m.read_status,
            sender.name as sender_name,
            receiver.name as receiver_name
          FROM messages m
          JOIN users sender ON m.sender_id = sender.id
          LEFT JOIN users receiver ON m.receiver_id = receiver.id
          WHERE m.id = ?`,
          [this.lastID],
          (err, message) => {
            if (err) {
              console.error('Error fetching message:', err);
              return res.status(500).json({ error: 'Message sent but failed to fetch details' });
            }

            res.json(message);
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