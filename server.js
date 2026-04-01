require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

const pool = require('./db/db');
const { sendEmailNotification } = require('./utils/mailer');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/participants', require('./routes/participants'));
app.use('/api/reminders', require('./routes/reminders'));

// Basic Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Something broke on the server!' });
});

// --- Background Notification Mailer ---
// This acts as a background chron-job perfectly syncing with your Oracle Triggers
setInterval(async () => {
    try {
        const [pendingNotifs] = await pool.query(
            `SELECT n.notification_id, n.message_content, u.email 
             FROM NOTIFICATIONS n
             JOIN USERS u ON n.user_id = u.user_id
             WHERE n.status = 'pending'`
        );
        
        for (let notif of pendingNotifs) {
            // 1. Send the Mock Email via NodeMailer
            const previewUrl = await sendEmailNotification(
                notif.email, 
                "New Event Calendar Activity", 
                notif.message_content
            );
            
            // Append the clickable email link
            let updatedMessage = notif.message_content;
            if (previewUrl) {
                updatedMessage += ` <br/><a href="${previewUrl}" target="_blank" style="color:#00BFFF; font-weight:bold; text-decoration:underline;">[View Sent Email]</a>`;
            }

            // 2. Mark as completed in Oracle DB and update the message with the HTML link
            await pool.query(
                `UPDATE NOTIFICATIONS SET status = 'sent', sent_time = CURRENT_TIMESTAMP, message_content = :1 WHERE notification_id = :2`,
                [updatedMessage, notif.notification_id],
                { autoCommit: true }
            );
        }
    } catch (err) {
        // Silently catch so we don't crash server if DB is busy
        // console.error("Mail Poller:", err.message);
    }
}, 5000); // Checks every 5 seconds

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Calendar System Server running on http://localhost:${PORT}`);
});
