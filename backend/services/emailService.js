const nodemailer = require('nodemailer');
const dns = require('dns');
require('dotenv').config({ quiet: true });

// Force IPv4-first DNS resolution to avoid ENETUNREACH IPv6 errors on cloud platforms like Render
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

/**
 * Delivery modes (EMAIL_MODE):
 *   console - local development: print links in the terminal, send nothing
 *   brevo   - Brevo HTTP API (works on hosts that block outbound SMTP, e.g. Render free tier)
 *   smtp    - nodemailer over SMTP (Gmail or EMAIL_HOST)
 * Defaults to brevo when BREVO_API_KEY is set, otherwise smtp.
 */
const EMAIL_MODE = process.env.EMAIL_MODE || (process.env.BREVO_API_KEY ? 'brevo' : 'smtp');
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'FairShare';
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

let smtpTransporter = null;
const getSmtpTransporter = () => {
    if (smtpTransporter) return smtpTransporter;

    const auth = {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : ''
    };
    const shared = { auth, debug: process.env.NODE_ENV !== 'production', logger: true, tls: { rejectUnauthorized: false } };

    smtpTransporter = nodemailer.createTransport(process.env.EMAIL_HOST ? {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 465,
        secure: Number(process.env.EMAIL_PORT) === 465 || !process.env.EMAIL_PORT,
        ...shared
    } : { service: 'gmail', ...shared });
    return smtpTransporter;
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const sendViaBrevo = async ({ to, subject, html }) => {
    if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY is not set');
    if (!FROM_EMAIL) throw new Error('EMAIL_FROM is not set (must be a sender verified in Brevo)');

    const response = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            sender: { name: FROM_NAME, email: FROM_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html
        }),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(`Brevo API error ${response.status}: ${data.message || response.statusText}`);
        error.code = data.code;
        error.status = response.status;
        throw error;
    }
    return { messageId: data.messageId };
};

const sendViaSmtp = async ({ to, subject, html }) => {
    const info = await getSmtpTransporter().sendMail({ from: `"${FROM_NAME}" <${FROM_EMAIL}>`, to, subject, html });
    return { messageId: info.messageId };
};

/** Sends one email using the configured mode. `link` is printed in console mode. */
const deliver = async ({ to, subject, html, label, link }) => {
    if (EMAIL_MODE === 'console') {
        console.log(`\n[Email] ${label} for ${to}:\n  ${link}\n`);
        return { messageId: 'console' };
    }

    console.log(`[Email] Sending "${subject}" to ${to} via ${EMAIL_MODE}`);
    try {
        const info = EMAIL_MODE === 'brevo' ? await sendViaBrevo({ to, subject, html }) : await sendViaSmtp({ to, subject, html });
        console.log(`[Email] Sent successfully via ${EMAIL_MODE}:`, info.messageId);
        return info;
    } catch (error) {
        console.error(`[Email] CRITICAL: Failed to send "${subject}" via ${EMAIL_MODE}:`, {
            message: error.message,
            code: error.code,
            status: error.status,
            response: error.response
        });
        throw error;
    }
};

console.log(`[Email] Delivery mode: ${EMAIL_MODE}${EMAIL_MODE === 'console' ? ' (links are printed here, nothing is sent)' : ''}`);

const layout = (title, bodyHtml, url, buttonText, footer) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #6366f1; margin-bottom: 20px;">${title}</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">${bodyHtml}</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${url}"
               style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                ${buttonText}
            </a>
        </div>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            If the button above doesn't work, copy and paste this link into your browser:<br>
            <a href="${url}" style="color: #6366f1;">${url}</a>
        </p>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 20px;">${footer}</p>
    </div>
`;

const sendVerificationEmail = async (email, username, token) => {
    const rawBackend = process.env.BACKEND_URL;
    const backendUrl = (rawBackend && !rawBackend.includes('localhost'))
        ? rawBackend
        : (process.env.NODE_ENV === 'production' ? 'https://fairshare-backend-9bgf.onrender.com' : (rawBackend || 'http://localhost:5000'));
    const verificationUrl = `${backendUrl}/api/auth/verify?token=${token}`;

    return deliver({
        to: email,
        subject: 'Verify your Email - FairShare',
        label: 'Verification link',
        link: verificationUrl,
        html: layout(
            `Welcome to FairShare, ${escapeHtml(username)}!`,
            'To start splitting expenses with your friends and family, please verify your email address by clicking the button below:',
            verificationUrl,
            'Verify Email Address',
            "If you didn't create an account, you can safely ignore this email."
        )
    });
};

const sendPasswordResetEmail = async (email, username, token) => {
    const rawFrontend = process.env.FRONTEND_URL;
    const frontendUrl = (rawFrontend && !rawFrontend.includes('localhost'))
        ? rawFrontend
        : (process.env.NODE_ENV === 'production' ? 'https://fair-share-sage.vercel.app' : (rawFrontend || 'http://localhost:5173'));
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    return deliver({
        to: email,
        subject: 'Reset your Password - FairShare',
        label: 'Password reset link',
        link: resetUrl,
        html: layout(
            'Password Reset Request',
            `Hello ${escapeHtml(username)},<br><br>We received a request to reset your password. Click the button below to choose a new password:`,
            resetUrl,
            'Reset Password',
            "This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will not change."
        )
    });
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    escapeHtml
};
