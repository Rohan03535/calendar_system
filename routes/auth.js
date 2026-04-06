const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.post('/login', async (req, res, next) => {
    try {
        const { email } = req.body;
        const [users] = await pool.query('SELECT user_id, email, full_name, timezone FROM USERS WHERE email = $1', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found. Use alice@student.uni.edu, bob@student.uni.edu, or charlie@student.uni.edu' });
        }
        
        // Map user_id to id and full_name to username for frontend compatibility
        const user = { 
            ...users[0], 
            id: users[0].user_id, 
            username: users[0].full_name,
            full_name: users[0].full_name
        };
        res.json(user);
    } catch (err) {
        next(err);
    }
});

router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        
        // PostgreSQL insert with RETURNING
        const [rows, result] = await pool.query(
            `INSERT INTO USERS (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id`,
            [username, email, password]
        );
        
        const newId = rows[0].user_id;
        res.json({ id: newId, username, email });
    } catch (err) {
        next(err);
    }
});

router.get('/users', async (req, res, next) => {
    try {
        const [users] = await pool.query('SELECT user_id, email, full_name FROM USERS ORDER BY full_name');
        const mapped = users.map(u => ({
            ...u,
            id: u.user_id,
            username: u.full_name
        }));
        res.json(mapped);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
