const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const { user_id } = req.query; 

        const query = `
            SELECT i.instance_id, 
                   TO_CHAR(i.instance_start, 'YYYY-MM-DD"T"HH24:MI:SS') as instance_start, 
                   TO_CHAR(i.instance_end, 'YYYY-MM-DD"T"HH24:MI:SS') as instance_end, 
                   e.event_id, e.title, e.location, e.description, e.event_type, e.creator_id,
                   u.full_name AS creator_name, c.category_name, c.color_code,
                   p.rsvp_status,
                   (CASE WHEN e.creator_id = $1 THEN 'HOST' ELSE COALESCE(p.rsvp_status, 'pending') END) AS instance_status
            FROM EVENT_INSTANCES i
            JOIN EVENTS e ON i.event_id = e.event_id
            JOIN USERS u ON e.creator_id = u.user_id
            LEFT JOIN EVENT_CATEGORIES c ON e.category_id = c.category_id
            LEFT JOIN EVENT_PARTICIPANTS p ON e.event_id = p.event_id AND p.user_id = $2
            LEFT JOIN PARTICIPANT_OVERRIDES po ON i.instance_id = po.instance_id AND po.user_id = $3
            WHERE (e.creator_id = $4 OR (p.user_id = $5 AND p.rsvp_status != 'declined'))
              AND i.is_cancelled = 0
              AND (po.status IS NULL OR po.status != 'declined')
            ORDER BY i.instance_start ASC
        `;
        
        const [instances] = await pool.query(query, [user_id, user_id, user_id, user_id, user_id]);
        res.json(instances);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('BEGIN');

        const { creator_id, category_id, title, description, start_time, end_time, location, event_type, is_recurring, r_frequency, r_end_date, invitees } = req.body;
        
        // 1. Insert Base Event
        const eventRes = await conn.query(
            `INSERT INTO EVENTS (creator_id, category_id, title, description, start_time, end_time, location, event_type, is_recurring) 
             VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamp, $7, $8, $9)
             RETURNING event_id`,
            [creator_id, category_id || null, title, description, start_time, end_time, location, event_type, is_recurring ? 1 : 0]
        );
        const newEventId = eventRes.rows[0].event_id;

        // 2. Handle Invitations
        if (invitees && invitees.length > 0) {
            for (const uid of invitees) {
                await conn.query(
                    `INSERT INTO EVENT_PARTICIPANTS (event_id, user_id, rsvp_status) VALUES ($1, $2, $3)`,
                    [newEventId, uid, 'pending']
                );
            }
        }

        // 3. Handle Recurrence
        if (is_recurring && r_frequency) {
            await conn.query(
                `INSERT INTO RECURRENCE_RULES (event_id, frequency, recurrence_start, recurrence_end) 
                 VALUES ($1, $2, $3::date, $4::date)`,
                [newEventId, r_frequency, start_time.split('T')[0], r_end_date]
            );
            
            const instancesMap = [];
            let curr = new Date(start_time);
            let endPatternDate = new Date(r_end_date + 'T23:59:59');
            let baseEnd = new Date(end_time);
            let duration_ms = baseEnd - curr; 
            
            while (curr <= endPatternDate) {
                instancesMap.push({
                    start_ts: curr.toISOString().slice(0, 19).replace('T', ' '),
                    end_ts: new Date(curr.getTime() + duration_ms).toISOString().slice(0, 19).replace('T', ' ')
                });
                
                if (r_frequency === 'daily') curr.setDate(curr.getDate() + 1);
                else if (r_frequency === 'weekly') curr.setDate(curr.getDate() + 7);
                else if (r_frequency === 'monthly') curr.setMonth(curr.getMonth() + 1);
                else break; 
            }
            
            if (instancesMap.length > 0) {
                for (const inst of instancesMap) {
                    await conn.query(
                        `INSERT INTO EVENT_INSTANCES (event_id, instance_start, instance_end) 
                         VALUES ($1, $2::timestamp, $3::timestamp)`,
                        [newEventId, inst.start_ts, inst.end_ts]
                    );
                }
            }
        }
        
        await conn.query('COMMIT');
        res.json({ message: 'Event fully created', event_id: newEventId });
    } catch (err) {
        if (conn) {
            try { await conn.query('ROLLBACK'); } catch(e) {}
        }
        
        // Oracle threw ORA-20001, PG throws EXCEPTION from our trigger
        if (err.message && err.message.includes('Event End Time must be exactly chronologically after Start Time')) {
            return res.status(400).json({ error: 'Database Constraint Triggered: End Time must occur chronologically after Start Time.' });
        }
        
        next(err);
    } finally {
        if (conn) {
            try { conn.release(); } catch(e) {}
        }
    }
});

router.put('/:id', async (req, res, next) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('BEGIN');
        const { id } = req.params;
        const { title, location, description } = req.body;
        
        // Execute the custom PL/pgSQL Function
        await conn.query(
            `SELECT UpdateEventAndNotify($1, $2, $3)`,
            [Number(id), title, location]
        );
        
        if (description !== undefined) {
             await conn.query(
                 `UPDATE EVENTS SET description = $1 WHERE event_id = $2`,
                 [description, Number(id)]
             );
        }
        
        await conn.query('COMMIT');
        res.json({ message: 'Event successfully updated' });
    } catch (err) {
        if (conn) {
            try { await conn.query('ROLLBACK'); } catch(e) {}
        }
        next(err);
    } finally {
        if (conn) {
            try { conn.release(); } catch(e) {}
        }
    }
});

// New Feature: Cancel Event
router.post('/:id/cancel', async (req, res, next) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('BEGIN');
        const { id } = req.params;
        const { user_id, instance_id } = req.body;
        
        // Call PL/pgSQL Function
        await conn.query(
            `SELECT sp_cancel_event($1, $2, $3)`,
            [Number(id), instance_id ? Number(instance_id) : null, Number(user_id)]
        );
        
        await conn.query('COMMIT');
        res.json({ message: 'Meeting cancellation processed successfully' });
    } catch (err) {
        if (conn) try { await conn.query('ROLLBACK'); } catch(e) {}
        next(err);
    } finally {
        if (conn) try { conn.release(); } catch(e) {}
    }
});

// Cursor Implementation Trigger
router.post('/maintenance/cleanup', async (req, res, next) => {
    try {
        const result = await pool.query(`SELECT sp_auto_decline_past_invites() AS count`);
        const count = result[0][0].count || 0;
        res.json({ message: `Cleanup Complete! The cursor processed and auto-declined ${count} expired invitations.` });
    } catch (err) {
        next(err);
    }
});

router.get('/report/attendance', async (req, res, next) => {
    try {
        const query = `SELECT * FROM vw_user_attendance_stats ORDER BY attendance_rate DESC`;
        const [stats] = await pool.query(query);
        res.json(stats);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
