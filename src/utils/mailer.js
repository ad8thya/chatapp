// src/utils/mailer.js
// Email utility using nodemailer with Ethereal for dev
// For production, configure real SMTP credentials in .env

const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize email transporter
 * In dev: uses Ethereal (creates test account automatically)
 * In prod: uses SMTP from .env
 */
async function initMailer() {
  if (transporter) return transporter;

  const useEthereal = !process.env.SMTP_HOST || process.env.SMTP_HOST.includes('ethereal');

  if (useEthereal) {
    // Create Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Ethereal email configured:');
    console.log('   User:', testAccount.user);
    console.log('   Pass:', testAccount.pass);
    console.log('   View emails at: https://ethereal.email');
  } else {
    // Production SMTP
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('📧 SMTP configured:', process.env.SMTP_HOST);
  }

  return transporter;
}

/**
 * Send verification email
 */
async function sendVerificationEmail(email, verificationToken) {
  try {
    const mailer = await initMailer();
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    const info = await mailer.sendMail({
      from: '"ChatApp" <noreply@chatapp.com>',
      to: email,
      subject: 'Verify your email address',
      html: `
        <h2>Welcome to ChatApp!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
        <p>Or copy this link: <code>${verificationUrl}</code></p>
        <p>This link expires in 24 hours.</p>
      `,
      text: `Verify your email: ${verificationUrl}`,
    });

    if (process.env.SMTP_HOST?.includes('ethereal') || !process.env.SMTP_HOST) {
      console.log('📧 Verification email sent. Preview:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
}

module.exports = {
  initMailer,
  sendVerificationEmail,
};

