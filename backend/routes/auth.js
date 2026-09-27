const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const db = require('../config/db');
const { hashToken, createToken, expiresIn, isExpired, HOUR } = require('../utils/tokens');
const emailService = require('../services/emailService');
const { frontendUrl } = require('../config/urls');
const { validateBody } = require('../middleware/validate');
const { loginLimiter, emailLimiter } = require('../middleware/rateLimiters');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/authValidation');
require('dotenv').config({ quiet: true });

const VERIFICATION_TTL = 24 * HOUR;
const RESET_TTL = HOUR;

/**
 * Finds the user holding a one-time token. Tokens are stored hashed; the raw-value
 * fallback keeps links that were emailed before hashing was introduced working.
 */
const findUserByToken = async (field, token) => {
    for (const value of [hashToken(token), token]) {
        const snapshot = await db.collection('users').where(field, '==', value).limit(1).get();
        if (!snapshot.empty) return snapshot.docs[0];
    }
    return null;
};

router.post('/register', emailLimiter, validateBody(registerSchema), async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!usersSnapshot.empty) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const verification = createToken();

        const newUserRef = await db.collection('users').add({
            username,
            email,
            password_hash,
            verification_token: verification.hash,
            verification_token_expiry: expiresIn(VERIFICATION_TTL),
            is_verified: false,
            created_at: new Date()
        });

        // Send verification email
        let emailSent = true;
        try {
            await emailService.sendVerificationEmail(email, username, verification.token);
            console.log(`[Auth] Verification email triggered for: ${email}`);
        } catch (emailErr) {
            console.error('[Auth] Failed to trigger verification email:', emailErr);
            emailSent = false;
        }

        res.status(201).json({ 
            message: emailSent 
                ? 'Registration successful! Please check your email to verify your account.' 
                : 'Registration successful, but email delivery failed. Please click "Resend Verification" on the login page.', 
            user: { id: newUserRef.id, username, email },
            emailSent
        });
    } catch (err) {
        next(err);
    }
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const userDoc = usersSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Checked after the password so this message doesn't reveal which emails have accounts
        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email address before logging in.' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email, upi_id: user.upi_id || null } });
    } catch (err) {
        next(err);
    }
});

// Email verification route
router.get('/verify', async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token' });

        const userDoc = await findUserByToken('verification_token', token);
        if (!userDoc || isExpired(userDoc.data().verification_token_expiry)) {
            return res.status(400).json({ error: 'Invalid or expired verification link. Please request a new one from the login page.' });
        }

        await userDoc.ref.update({
            is_verified: true,
            verification_token: null,
            verification_token_expiry: null
        });

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; min-height: 100vh;">
                <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <h1 style="color: #6366f1;">Email Verified Successfully!</h1>
                    <p style="color: #475569; font-size: 16px;">Your account is now active. You can close this window and log in to the app.</p>
                    <a href="${frontendUrl()}/login" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Return to Login</a>
                </div>
            </div>
        `);
    } catch (err) {
        next(err);
    }
});

// Resend verification email route
router.post('/resend-verification', emailLimiter, async (req, res, next) => {
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

        // Only hashes are stored, so every resend issues a fresh token (which also invalidates the old link)
        const verification = createToken();
        await userDoc.ref.update({
            verification_token: verification.hash,
            verification_token_expiry: expiresIn(VERIFICATION_TTL)
        });

        await emailService.sendVerificationEmail(email, user.username, verification.token);
        res.json({ message: 'Verification email sent! Please check your inbox (including spam folder).' });
    } catch (err) {
        console.error('[Auth] Resend verification error:', err);
        res.status(500).json({ error: 'Failed to send verification email. Please try again later.' });
    }
});


router.post('/forgot-password', emailLimiter, validateBody(forgotPasswordSchema), async (req, res, next) => {
    try {
        const { email } = req.body;

        const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) {
            // Return success even if not found to prevent email enumeration
            return res.json({ message: 'If that email is registered, we have sent a password reset link.' });
        }

        const userDoc = usersSnapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };
        const reset = createToken();

        await userDoc.ref.update({
            reset_token: reset.hash,
            reset_token_expiry: expiresIn(RESET_TTL)
        });

        try {
            await emailService.sendPasswordResetEmail(user.email, user.username, reset.token);
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

        const userDoc = await findUserByToken('reset_token', token);
        if (!userDoc) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = userDoc.data();

        if (!user.reset_token_expiry || isExpired(user.reset_token_expiry)) {
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
