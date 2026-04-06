const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.get('/:user_id', async (req, res, next) => {
    try {
        const { user_id } = req.params;
        
        const [reminders] = await pool.query(
            `SELECT i.instance_id, 
                    TO_CHAR(i.instance_start, 'YYYY-MM-DD"T"HH24:MI:SS') AS instance_start, 
                    TO_CHAR(i.instance_end, 'YYYY-MM-DD"T"HH24:MI:SS') AS instance_end, 
                   e.title, e.location, e.description, u.full_name AS creator_name
            FROM EVENT_INSTANCES i
            JOIN EVENTS e ON i.event_id = e.event_id
            JOIN USERS u ON e.creator_id = u.user_id
            LEFT JOIN EVENT_PARTICIPANTS p ON e.event_id = p.event_id
            WHERE (e.creator_id = $1 OR (p.user_id = $2 AND p.rsvp_status != 'declined'))
              AND i.is_cancelled = 0
              AND i.instance_start >= CURRENT_TIMESTAMP - INTERVAL '1 day'
            ORDER BY i.instance_start ASC
            LIMIT 10`,
            [user_id, user_id]
        );
        res.json(reminders);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
