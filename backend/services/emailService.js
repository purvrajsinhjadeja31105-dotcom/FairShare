const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
    port: process.env.EMAIL_PORT || 2525,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendVerificationEmail = async (email, username, token) => {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const verificationUrl = `${backendUrl}/api/auth/verify?token=${token}`;

    const mailOptions = {
        from: '"SplitWise Clone" <noreply@splitwiseclone.com>',
        to: email,
        subject: 'Verify your Email - SplitWise Clone',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #6366f1; margin-bottom: 20px;">Welcome to SplitWise Clone, ${username}!</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    To start splitting expenses with your friends and family, please verify your email address by clicking the button below:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Verify Email Address
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    If the button above doesn't work, copy and paste this link into your browser:<br>
                    <a href="${verificationUrl}" style="color: #6366f1;">${verificationUrl}</a>
                </p>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 20px;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, username, token) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
        from: '"SplitWise Clone" <noreply@splitwiseclone.com>',
        to: email,
        subject: 'Reset your Password - SplitWise Clone',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #6366f1; margin-bottom: 20px;">Password Reset Request</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    Hello ${username},<br><br>
                    We received a request to reset your password. Click the button below to choose a new password:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    This link will expire in 1 hour. If the button above doesn't work, copy and paste this link into your browser:<br>
                    <a href="${resetUrl}" style="color: #6366f1;">${resetUrl}</a>
                </p>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 20px;">
                    If you didn't request a password reset, you can safely ignore this email. Your password will not change.
                </p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};
