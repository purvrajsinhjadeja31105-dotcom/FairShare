const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/authValidation');
require('dotenv').config();

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!usersSnapshot.empty) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const verification_token = crypto.randomBytes(32).toString('hex');

        const newUserRef = await db.collection('users').add({
            username,
            email,
            password_hash,
            verification_token,
            is_verified: false,
            created_at: new Date()
        });

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
            user: { id: newUserRef.id, username, email } 
        });
    } catch (err) {
        next(err);
    }
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const userDoc = usersSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };

        // Check verification status
        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email address before logging in.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email, upi_id: user.upi_id || null } });
    } catch (err) {
        next(err);
    }
});

// Email verification route
router.get('/verify', async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Missing token' });

        const usersSnapshot = await db.collection('users').where('verification_token', '==', token).limit(1).get();
        if (usersSnapshot.empty) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const userDoc = usersSnapshot.docs[0];
        await userDoc.ref.update({
            is_verified: true,
            verification_token: null
        });

        const rawFrontend = process.env.FRONTEND_URL;
        const frontendUrl = (rawFrontend && !rawFrontend.includes('localhost'))
            ? rawFrontend
            : (process.env.NODE_ENV === 'production' ? 'https://fair-share-sage.vercel.app' : (rawFrontend || 'http://localhost:5173'));

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; min-height: 100vh;">
                <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <h1 style="color: #6366f1;">Email Verified Successfully!</h1>
                    <p style="color: #475569; font-size: 16px;">Your account is now active. You can close this window and log in to the app.</p>
                    <a href="${frontendUrl}/login" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Return to Login</a>
                </div>
            </div>
        `);
    } catch (err) {
        next(err);
    }
});

// Resend verification email route
router.post('/resend-verification', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) {
            return res.json({ message: 'If that email is registered and unverified, a verification email has been sent.' });
        }

        const userDoc = usersSnapshot.docs[0];
        const user = userDoc.data();

        if (user.is_verified) {
            return res.status(400).json({ error: 'This account is already verified. Please log in.' });
        }

        let token = user.verification_token;
        if (!token) {
            token = crypto.randomBytes(32).toString('hex');
            await userDoc.ref.update({ verification_token: token });
        }

        await emailService.sendVerificationEmail(email, user.username, token);
        res.json({ message: 'Verification email sent! Please check your inbox (including spam folder).' });
    } catch (err) {
        console.error('[Auth] Resend verification error:', err);
        res.status(500).json({ error: 'Failed to send verification email. Please try again later.' });
    }
});


router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
    try {
        const { email } = req.body;

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) {
            // Return success even if not found to prevent email enumeration
            return res.json({ message: 'If that email is registered, we have sent a password reset link.' });
        }

        const userDoc = usersSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await userDoc.ref.update({
            reset_token: resetToken,
            reset_token_expiry: expiry.toISOString()
        });

        try {
            await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
        } catch (emailErr) {
            console.error('Failed to send reset email:', emailErr);
            return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
        }

        res.json({ message: 'If that email is registered, we have sent a password reset link.' });
    } catch (err) {
        next(err);
    }
});

router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        const usersSnapshot = await db.collection('users').where('reset_token', '==', token).limit(1).get();
        if (usersSnapshot.empty) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const userDoc = usersSnapshot.docs[0];
        const user = userDoc.data();
        
        if (new Date() > new Date(user.reset_token_expiry)) {
            return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        await userDoc.ref.update({
            password_hash: password_hash,
            reset_token: null,
            reset_token_expiry: null
        });

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
