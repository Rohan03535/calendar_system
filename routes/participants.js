const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.put('/:event_id/rsvp', async (req, res, next) => {
    try {
        const { event_id } = req.params;
        const { user_id, rsvp_status } = req.body; 
        
        await pool.query(
            `UPDATE EVENT_PARTICIPANTS SET rsvp_status = :1, responded_at = CURRENT_TIMESTAMP WHERE event_id = :2 AND user_id = :3`,
            [rsvp_status, event_id, user_id],
            { autoCommit: true }
        );
        res.json({ message: 'RSVP status updated successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
