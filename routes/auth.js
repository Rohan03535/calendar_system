const express = require('express');
const pool = require('../db/db');
const router = express.Router();

router.post('/login', async (req, res, next) => {
    try {
        const { email } = req.body;
        // Oracle bind variables use :1 syntax
        const [users] = await pool.query('SELECT user_id, email, full_name, timezone FROM USERS WHERE email = :1', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found. Try alice@student.uni.edu or bob@student.uni.edu' });
        }
        
        res.json({ message: 'Login successful', user: users[0] });
    } catch (err) {
        next(err);
    }
});

router.get('/users', async (req, res, next) => {
    try {
        const [users] = await pool.query('SELECT user_id, email, full_name FROM USERS ORDER BY full_name');
        res.json(users);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
