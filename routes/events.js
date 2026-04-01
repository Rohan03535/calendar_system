const express = require('express');
const pool = require('../db/db');
const oracledb = require('oracledb');
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const { user_id } = req.query; 

        // Oracle query for exact layout matching and handling grouping
        const query = `
            SELECT i.instance_id, i.instance_start, i.instance_end, 
                   e.event_id, e.title, e.location, e.description, e.event_type, e.creator_id,
                   u.full_name AS creator_name, c.category_name, c.color_code
            FROM EVENT_INSTANCES i
            JOIN EVENTS e ON i.event_id = e.event_id
            JOIN USERS u ON e.creator_id = u.user_id
            LEFT JOIN EVENT_CATEGORIES c ON e.category_id = c.category_id
            LEFT JOIN EVENT_PARTICIPANTS p ON e.event_id = p.event_id
            WHERE (e.creator_id = :1 OR (p.user_id = :2 AND p.rsvp_status = 'accepted'))
              AND i.is_cancelled = 0
            GROUP BY i.instance_id, i.instance_start, i.instance_end, 
                   e.event_id, e.title, e.location, e.description, e.event_type, e.creator_id,
                   u.full_name, c.category_name, c.color_code
            ORDER BY i.instance_start ASC
        `;
        
        const [instances] = await pool.query(query, [user_id, user_id]);
        res.json(instances);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    let conn;
    try {
        // We use manual connection for Transactions
        conn = await pool.getConnection();

        const { creator_id, category_id, title, description, start_time, end_time, location, event_type, is_recurring, r_frequency, r_end_date, invitees } = req.body;
        
        // 1. Insert Base Event mapped with TO_TIMESTAMP and catching the Returning ID
        const eventRes = await conn.execute(
            `INSERT INTO EVENTS (creator_id, category_id, title, description, start_time, end_time, location, event_type, is_recurring) 
             VALUES (:1, :2, :3, :4, TO_TIMESTAMP(:5, 'YYYY-MM-DD"T"HH24:MI'), TO_TIMESTAMP(:6, 'YYYY-MM-DD"T"HH24:MI'), :7, :8, :9)
             RETURNING event_id INTO :10`,
            [
                creator_id, category_id || null, title, description, start_time, end_time, location, event_type, 
                is_recurring ? 1 : 0, 
                { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            ]
        );
        const newEventId = eventRes.outBinds[0][0];

        // 2. Handle Invitations using ExecuteMany
        if (invitees && invitees.length > 0) {
            const participantValues = invitees.map(uid => ({
                e: newEventId, 
                u: uid, 
                s: 'pending'
            }));
            
            await conn.executeMany(
                `INSERT INTO EVENT_PARTICIPANTS (event_id, user_id, rsvp_status) VALUES (:e, :u, :s)`,
                participantValues
            );
        }

        // 3. Handle Recurrence
        if (is_recurring && r_frequency) {
            await conn.execute(
                `INSERT INTO RECURRENCE_RULES (event_id, frequency, recurrence_start, recurrence_end) 
                 VALUES (:1, :2, TO_DATE(:3, 'YYYY-MM-DD'), TO_DATE(:4, 'YYYY-MM-DD'))`,
                [newEventId, r_frequency, start_time.split('T')[0], r_end_date]
            );
            
            const instancesMap = [];
            let curr = new Date(start_time);
            let endPatternDate = new Date(r_end_date + 'T23:59:59');
            let baseEnd = new Date(end_time);
            let duration_ms = baseEnd - curr; 
            
            while (curr <= endPatternDate) {
                instancesMap.push({
                    ev_id: newEventId,
                    start_ts: curr.toISOString().slice(0, 19).replace('T', ' '),
                    end_ts: new Date(curr.getTime() + duration_ms).toISOString().slice(0, 19).replace('T', ' ')
                });
                
                if (r_frequency === 'daily') curr.setDate(curr.getDate() + 1);
                else if (r_frequency === 'weekly') curr.setDate(curr.getDate() + 7);
                else if (r_frequency === 'monthly') curr.setMonth(curr.getMonth() + 1);
                else break; 
            }
            
            if (instancesMap.length > 0) {
                await conn.executeMany(
                    `INSERT INTO EVENT_INSTANCES (event_id, instance_start, instance_end) 
                     VALUES (:ev_id, TO_TIMESTAMP(:start_ts, 'YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP(:end_ts, 'YYYY-MM-DD HH24:MI:SS'))`,
                    instancesMap
                );
            }
        }
        
        await conn.commit();
        res.json({ message: 'Event fully created', event_id: newEventId });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch(e) {}
        }
        
        // Let Oracle DB enforce rules natively: intercept SQLSTATE native exceptions!
        if (err.message && err.message.includes('ORA-20001')) {
            return res.status(400).json({ error: 'Database Constraint Triggered: End Time must occur chronologically after Start Time.' });
        }
        
        next(err);
    } finally {
        if (conn) {
            try { await conn.close(); } catch(e) {}
        }
    }
});

router.put('/:id', async (req, res, next) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const { id } = req.params;
        const { title, location, description } = req.body;
        
        // 1. Execute the custom Oracle Stored Procedure (Updates title, location, & Auto-Generates Shared Notifications!)
        await conn.execute(
            `BEGIN UpdateEventAndNotify(:1, :2, :3); END;`,
            [Number(id), title, location]
        );
        
        // 2. Add description explicitly missing from original schema procedure
        if (description !== undefined) {
             await conn.execute(
                 `UPDATE EVENTS SET description = :1 WHERE event_id = :2`,
                 [description, Number(id)]
             );
        }
        
        await conn.commit();
        res.json({ message: 'Event successfully updated' });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch(e) {}
        }
        next(err);
    } finally {
        if (conn) {
            try { await conn.close(); } catch(e) {}
        }
    }
});

module.exports = router;
