const express = require('express');
const pool = require('../db/db');
const router = express.Router();

// EXTRA CREDIT: Web Service Endpoint for Native Client Reminders
router.get('/:user_id', async (req, res, next) => {
    try {
        const { user_id } = req.params;
        
        // Oracle Query fetching events happening in exactly the next 24 hours
        const [reminders] = await pool.query(
            `SELECT i.instance_id, i.instance_start, i.instance_end, 
                   e.title, e.location, e.description, u.full_name AS creator_name
            FROM EVENT_INSTANCES i
            JOIN EVENTS e ON i.event_id = e.event_id
            JOIN USERS u ON e.creator_id = u.user_id
            LEFT JOIN EVENT_PARTICIPANTS p ON e.event_id = p.event_id
            WHERE (e.creator_id = :1 OR (p.user_id = :2 AND p.rsvp_status != 'declined'))
              AND i.is_cancelled = 0
              AND i.instance_start >= CURRENT_TIMESTAMP - INTERVAL '1' DAY
            ORDER BY i.instance_start ASC
            FETCH NEXT 10 ROWS ONLY`,
            [user_id, user_id]
        );
        res.json(reminders);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
