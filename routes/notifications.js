const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.get('/:user_id', async (req, res, next) => {
    try {
        const [notifs] = await pool.query(
            `SELECT n.notification_id, n.event_id, n.notification_type, n.message_content, n.scheduled_time, n.status,
                    TO_CHAR(e.start_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS event_start, p.rsvp_status
             FROM NOTIFICATIONS n
             JOIN EVENTS e ON n.event_id = e.event_id
             JOIN EVENT_PARTICIPANTS p ON n.event_id = p.event_id AND n.user_id = p.user_id
             WHERE n.user_id = :1 
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

        // 1. Get Notification details
        const notifRes = await conn.execute(
            `SELECT user_id, event_id FROM NOTIFICATIONS WHERE notification_id = :1`,
            [Number(id)]
        );

        if (notifRes.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const [userId, eventId] = notifRes.rows[0];

        // 2. Update RSVP status in participants table
        await conn.execute(
            `UPDATE EVENT_PARTICIPANTS SET rsvp_status = :1 WHERE event_id = :2 AND user_id = :3`,
            [status, eventId, userId]
        );

        // 3. Update notification status based on RSVP
        // Clear if declined, keep visible if accepted
        const notifStatus = status === 'declined' ? 'cancelled' : 'sent';
        await conn.execute(
            `UPDATE NOTIFICATIONS SET status = :1 WHERE notification_id = :2`,
            [notifStatus, Number(id)]
        );

        await conn.commit();
        res.json({ message: 'RSVP updated successfully' });
    } catch (err) {
        if (conn) await conn.rollback();
        next(err);
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
