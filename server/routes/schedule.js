const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const ScheduleService = require('../services/scheduleService');
const router = express.Router();

// @route   POST /api/schedule/generate-week
// @desc    Generate automatic schedule for current week (admin only)
router.post('/generate-week', [auth, adminAuth], async (req, res) => {
  try {
    const result = await ScheduleService.generateWeeklyScheduleForAllVollzeit();
    res.json({ message: result });
  } catch (error) {
    console.error('Error generating weekly schedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/schedule/generate-user
// @desc    Generate automatic schedule for specific user and period (admin only)
router.post('/generate-user', [auth, adminAuth], async (req, res) => {
  const { userId, startDate, endDate } = req.body;

  try {
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: 'User ID, start date, and end date are required' });
    }

    const events = await ScheduleService.generateVollzeitSchedule(
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      message: `Generated ${events.length} automatic work events`,
      events: events.length
    });
  } catch (error) {
    console.error('Error generating user schedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/schedule/absence
// @desc    Create absence event (Urlaub, Krankheit, Überstundenabbau)
router.post('/absence', auth, async (req, res) => {
  const { title, description, start_date, end_date, type, is_all_day, start_time, end_time } = req.body;

  try {
    // Validate required fields
    if (!title || !start_date || !end_date || !type) {
      return res.status(400).json({ error: 'Title, start date, end date, and type are required' });
    }

    // Validate absence type
    const validTypes = ['Urlaub', 'Krankheit', 'Überstundenabbau'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid absence type' });
    }

    // Check if user has permission to create absence for this period
    const userEmployment = await ScheduleService.getUserEmploymentInfo(req.user.id);
    if (!userEmployment) {
      return res.status(404).json({ error: 'User employment information not found' });
    }

    const absenceData = {
      title,
      description: description || '',
      start_date,
      end_date,
      type,
      is_all_day: is_all_day !== false, // Default to true
      start_time: is_all_day ? null : start_time,
      end_time: is_all_day ? null : end_time
    };

    const eventId = await ScheduleService.createAbsenceEvent(req.user.id, absenceData);

    res.json({
      message: 'Absence event created successfully',
      eventId,
      type
    });
  } catch (error) {
    console.error('Error creating absence event:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/schedule/employment-info
// @desc    Get current user's employment information
router.get('/employment-info', auth, async (req, res) => {
  try {
    const userEmployment = await ScheduleService.getUserEmploymentInfo(req.user.id);
    if (!userEmployment) {
      return res.status(404).json({ error: 'Employment information not found' });
    }

    res.json(userEmployment);
  } catch (error) {
    console.error('Error fetching employment info:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/schedule/work-events/:startDate/:endDate
// @desc    Delete work events in a specific period (for manual schedule adjustment)
router.delete('/work-events/:startDate/:endDate', auth, async (req, res) => {
  const { startDate, endDate } = req.params;

  try {
    const deletedCount = await ScheduleService.deleteWorkEventsInPeriod(
      req.user.id,
      startDate,
      endDate
    );

    res.json({
      message: `Deleted ${deletedCount} work events`,
      deletedCount
    });
  } catch (error) {
    console.error('Error deleting work events:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
