const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const crypto = require('crypto');
const emailService = require('../services/emailService');
require('dotenv').config();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const verification_token = crypto.randomBytes(32).toString('hex');

        const [result] = await db.query(
            'INSERT INTO users (username, email, password_hash, verification_token) VALUES (?, ?, ?, ?)',
            [username, email, password_hash, verification_token]
        );

        // Send verification email
        try {
            await emailService.sendVerificationEmail(email, username, verification_token);
            console.log(`[Auth] Verification email triggered for: ${email}`);
        } catch (emailErr) {
            console.error('[Auth] Failed to trigger verification email:', emailErr);
            // We still registered the user, but they might need a "resend" button later
        }

        res.status(201).json({ 
            message: 'Registration successful! Please check your email to verify your account.', 
            user: { id: result.insertId, username, email } 
        });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ 
            error: 'Database error', 
            details: err.message,
            code: err.code 
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];

        // Check verification status
        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email address before logging in.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Email verification route
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Missing token' });

        const [users] = await db.query('SELECT id FROM users WHERE verification_token = ?', [token]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const userId = users[0].id;
        await db.query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [userId]);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; min-height: 100vh;">
                <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <h1 style="color: #6366f1;">Email Verified Successfully!</h1>
                    <p style="color: #475569; font-size: 16px;">Your account is now active. You can close this window and log in to the app.</p>
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Return to Login</a>
                </div>
            </div>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});


// Manual verification route (Emergency bypass for troubleshooting)
router.get('/manual-verify', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: 'Missing email' });

        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await db.query('UPDATE users SET is_verified = 1, verification_token = NULL WHERE email = ?', [email]);
        
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #ecfdf5; min-height: 100vh;">
                <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <h1 style="color: #059669;">Manual Verification Success!</h1>
                    <p style="color: #065f46; font-size: 16px;">The account for <b>${email}</b> is now verified.</p>
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Go to Login</a>
                </div>
            </div>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Return success even if not found to prevent email enumeration
            return res.json({ message: 'If that email is registered, we have sent a password reset link.' });
        }

        const user = users[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await db.query('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [resetToken, expiry, user.id]);

        try {
            await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
        } catch (emailErr) {
            console.error('Failed to send reset email:', emailErr);
            return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
        }

        res.json({ message: 'If that email is registered, we have sent a password reset link.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const [users] = await db.query('SELECT id, reset_token_expiry FROM users WHERE reset_token = ?', [token]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = users[0];
        if (new Date() > new Date(user.reset_token_expiry)) {
            return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [password_hash, user.id]);

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
