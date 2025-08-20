// /backend/src/services/email.service.js
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: parseInt(config.email.port || '587', 10),
  secure: parseInt(config.email.port || '587', 10) === 465,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

class EmailService {
  /**
   * Sends a verification email to a new user.
   * @param {string} to - The recipient's email address.
   * @param {string} token - The verification token.
   * @returns {Promise<void>}
   */
  static async sendVerificationEmail(to, token) {
    const verificationLink = `${config.frontendUrl}/verify-email?token=${token}`;
    const mailOptions = {
      from: config.email.from,
      to: to,
      subject: `Verify Your ${config.brand.shortName} Account`,
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px;">
            <h1 style="color: #333;">Welcome to ${config.brand.shortName}!</h1>
            <p style="font-size: 16px; color: #555;">Please click the button below to verify your email address and activate your account.</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; margin: 20px 0; font-size: 16px; color: white; background-color: #28a745; text-decoration: none; border-radius: 5px;">Verify Account</a>
            <p style="font-size: 14px; color: #777;">If you did not create an account, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Verification email sent to ${to}`);
    } catch (error) {
      logger.error({ err: error, email: to }, 'Failed to send verification email');
      throw new Error('Could not send verification email.');
    }
  }

  /**
   * Sends a password reset email.
   * @param {string} to - The recipient's email address.
   * @param {string} token - The password reset token.
   * @returns {Promise<void>}
   */
  static async sendPasswordResetEmail(to, token) {
    const resetLink = `${config.frontendUrl}/reset-password?token=${token}`;
    const mailOptions = {
      from: config.email.from,
      to: to,
      subject: `${config.brand.shortName} Password Reset Request`,
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px;">
            <h1 style="color: #333;">Password Reset</h1>
            <p style="font-size: 16px; color: #555;">You are receiving this email because a password reset was requested for your account. Please click the button below to set a new password.</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; margin: 20px 0; font-size: 16px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p style="font-size: 14px; color: #777;">This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
      logger.error({ err: error, email: to }, 'Failed to send password reset email');
      throw new Error('Could not send password reset email.');
    }
  }
}

module.exports = EmailService;
