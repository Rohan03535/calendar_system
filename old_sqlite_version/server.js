const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// --- HELPER FUNCTIONS ---

// Send simulated email
const sendEmail = (to, subject, body) => {
    console.log(`\n[EMAIL NOTIFICATION]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}\n`);
};

// --- ROUTES ---

// 1. REGISTER
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    const sql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
    db.run(sql, [username, email, password], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, username, email });
    });
});

// 2. LOGIN
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT * FROM users WHERE email = ? AND password = ?`;
    db.get(sql, [email, password], (err, row) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Invalid credentials' });
        res.json(row);
    });
});

// 3. GET USERS (for invitations)
app.get('/api/users', (req, res) => {
    db.all(`SELECT id, username, email FROM users`, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// 4. CREATE EVENT (with invitations)
app.post('/api/events', (req, res) => {
    const { creator_id, title, description, start_time, end_time, recurrence_rule, invitees } = req.body;

    // Insert Event
    const sql = `INSERT INTO events (creator_id, title, description, start_time, end_time, recurrence_rule) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [creator_id, title, description, start_time, end_time, recurrence_rule || 'NONE'], function (err) {
        if (err) return res.status(400).json({ error: err.message });

        const eventId = this.lastID;

        // Loop through invitees and add them to event_attendees
        if (invitees && invitees.length > 0) {
            const stmt = db.prepare(`INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)`);
            invitees.forEach(userId => {
                stmt.run(eventId, userId);

                // Fetch user email for notification
                db.get(`SELECT email FROM users WHERE id = ?`, [userId], (err, row) => {
                    if (row) {
                        sendEmail(row.email, `New Event Invite: ${title}`, `You have been invited to ${title} on ${start_time}.`);
                    }
                });
            });
            stmt.finalize();
        }

        // Also add creator as ACCEPTED attendee? Or just rely on creator_id?
        // Let's add creator as ACCEPTED ensuring they see it in the query
        db.run(`INSERT INTO event_attendees (event_id, user_id, status) VALUES (?, ?, 'ACCEPTED')`, [eventId, creator_id]);

        res.json({ id: eventId, message: 'Event created' });
    });
});

// 5. GET EVENTS (Multiuser + Recurring logic)
app.get('/api/events', (req, res) => {
    const { user_id } = req.query; // Authenticated user
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    // Logic: Get all events where user is an attendee (includes own events if we add creator as attendee)
    // Also including recurrence rule in output
    const sql = `
        SELECT e.*, ea.status 
        FROM events e 
        JOIN event_attendees ea ON e.id = ea.event_id 
        WHERE ea.user_id = ?
    `;

    db.all(sql, [user_id], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// 6. UPDATE EVENT (Shared updates reflected to all)
app.put('/api/events/:id', (req, res) => {
    const { title, description, start_time, end_time } = req.body;
    const eventId = req.params.id;

    const sql = `UPDATE events SET title = ?, description = ?, start_time = ?, end_time = ? WHERE id = ?`;
    db.run(sql, [title, description, start_time, end_time, eventId], function (err) {
        if (err) return res.status(400).json({ error: err.message });

        // Notify all attendees of update
        db.all(`SELECT u.email FROM users u JOIN event_attendees ea ON u.id = ea.user_id WHERE ea.event_id = ?`, [eventId], (err, rows) => {
            rows.forEach(row => {
                sendEmail(row.email, `Event Updated: ${title}`, `The event ${title} has been updated.`);
            });
        });

        res.json({ message: 'Event updated' });
    });
});

// 7. RESPOND TO INVITE
app.post('/api/events/:id/respond', (req, res) => {
    const { user_id, status } = req.body; // status: 'ACCEPTED', 'DECLINED'
    const eventId = req.params.id;

    const sql = `UPDATE event_attendees SET status = ? WHERE event_id = ? AND user_id = ?`;
    db.run(sql, [status, eventId, user_id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: 'Status updated' });
    });
});

// 8. REMINDER WEB SERVICE (Extra Credit)
// Returns events starting in the next 30 minutes
app.get('/api/reminders', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    const now = new Date();
    const thirtyOnesFromNow = new Date(now.getTime() + 30 * 60000);

    const sql = `
        SELECT e.* 
        FROM events e 
        JOIN event_attendees ea ON e.id = ea.event_id 
        WHERE ea.user_id = ? 
        AND e.start_time BETWEEN ? AND ?
    `;

    db.all(sql, [user_id, now.toISOString(), thirtyOnesFromNow.toISOString()], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
