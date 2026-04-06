const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.get('/:user_id', async (req, res, next) => {
    try {
        const [notifs] = await pool.query(
            `SELECT n.notification_id, n.event_id, n.notification_type, n.message_content, n.status,
                    TO_CHAR(n.scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_time, 
                    TO_CHAR(e.start_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS event_start, p.rsvp_status
             FROM NOTIFICATIONS n
             JOIN EVENTS e ON n.event_id = e.event_id
             LEFT JOIN EVENT_PARTICIPANTS p ON n.event_id = p.event_id AND n.user_id = p.user_id
             WHERE n.user_id = $1 
               AND n.status IN ('pending', 'sent')
               AND n.scheduled_time > CURRENT_TIMESTAMP - INTERVAL '7 days'
             ORDER BY n.scheduled_time DESC`,
            [req.params.user_id]
        );
        res.json(notifs);
    } catch (err) {
        next(err);
    }
});

router.put('/:id/rsvp', async (req, res, next) => {
    let conn;
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        conn = await pool.getConnection();
        await conn.query('BEGIN');

        // 1. Get Notification details
        const notifRes = await conn.query(
            `SELECT user_id, event_id FROM NOTIFICATIONS WHERE notification_id = $1`,
            [Number(id)]
        );

        if (notifRes.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const { user_id, event_id } = notifRes.rows[0];

        // 2. Update RSVP status in participants table
        await conn.query(
            `UPDATE EVENT_PARTICIPANTS SET rsvp_status = $1, responded_at = CURRENT_TIMESTAMP WHERE event_id = $2 AND user_id = $3`,
            [status, event_id, user_id]
        );

        // 3. Update notification status based on RSVP
        const notifStatus = status === 'declined' ? 'cancelled' : 'sent';
        await conn.query(
            `UPDATE NOTIFICATIONS SET status = $1 WHERE notification_id = $2`,
            [notifStatus, Number(id)]
        );

        await conn.query('COMMIT');
        res.json({ message: 'RSVP updated successfully' });
    } catch (err) {
        if (conn) try { await conn.query('ROLLBACK'); } catch(e) {}
        next(err);
    } finally {
        if (conn) try { conn.release(); } catch(e) {}
    }
});

// Dismiss/mark-read a notification
router.put('/:id/dismiss', async (req, res, next) => {
    try {
        await pool.query(
            `UPDATE NOTIFICATIONS SET status = 'cancelled' WHERE notification_id = $1`,
            [Number(req.params.id)]
        );
        res.json({ message: 'Notification dismissed' });
    } catch (err) {
        next(err);
    }
});

// Dismiss ALL notifications for a user
router.put('/user/:user_id/dismiss-all', async (req, res, next) => {
    try {
        await pool.query(
            `UPDATE NOTIFICATIONS SET status = 'cancelled' WHERE user_id = $1 AND status IN ('pending', 'sent')`,
            [Number(req.params.user_id)]
        );
        res.json({ message: 'All notifications dismissed' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
