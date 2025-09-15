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

module.exports = router;