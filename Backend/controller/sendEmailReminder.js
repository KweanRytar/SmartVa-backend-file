import nodemailer from 'nodemailer';

import { getIO } from "../socket.js";
import { agenda } from './event.controller.js';
import { Notification } from '../model/notification.model.js';
import Event from '../model/event.model.js';

// Create transporter once for reuse
const transporter = nodemailer.createTransport({
 host: process.env.TURBO_HOST,
  port: process.env.TURBO_PORT,
  secure: process.env.TURBO_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.TURBO_USER,
    pass: process.env.TURBO_PASS
  }
});

// Helper for consistent date formatting
const formatDate = (date) =>
  new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

// =========================
// Notification Job
// =========================
export const sendNotifications = () => {
  agenda.define('create event notification', async (job) => {
    const { userId, message } = job.attrs.data;
    if (userId && message) {
      await Notification.create({ userId, message });
    }
  });

  // emit socket notification
  const io = getIO();
  agenda.on('success', async (job) => {
    if (job.attrs.name === 'create event notification') {
      const { userId, message } = job.attrs.data;
      if (userId && message) {
        io.to(userId.toString()).emit('newNotification', { message });
      }
    }
  });

};

// =========================
// Reminder Email Job
// =========================
export const sendEmail = () => {
  agenda.define('send email reminder', async (job) => {
    const { eventId, email, title, vaName } = job.attrs.data;

    const event = await Event.findById(eventId);
    if (!event || new Date(event.endTime) <= new Date()) return;

    try {
      await transporter.sendMail({
        from: `"${vaName}" <${process.env.TURBO_FROM}>`,
        to: email,
        subject: `Reminder for ${title}`,
        html: `
          <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
            <h2 style="color:#4CAF50;margin-bottom:20px;">Upcoming Event Reminder</h2>
            <p>Dear Smart Assistant,</p>
            <p>This is a friendly reminder that you are scheduled to participate in the following event:</p>
            <table cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:15px;margin-bottom:20px;">
              <tr><td style="font-weight:bold;width:35%;">Event:</td><td>${title}</td></tr>
              <tr><td style="font-weight:bold;">Date & Time:</td><td>${formatDate(event.startTime)} → ${formatDate(event.endTime)}</td></tr>
              <tr><td style="font-weight:bold;">Venue:</td><td>${event.venue}</td></tr>
              <tr><td style="font-weight:bold;">Organized by:</td><td>${event.vaName}</td></tr>
            </table>
            <p style="margin-top:10px;">Please <a href="#" style="color:#4CAF50;text-decoration:none;font-weight:bold;">log in to SmartVA</a> to view full details, update your participation, or add notes.</p>
            <p style="margin-top:30px;">Best regards,<br/><strong>SmartVA Team</strong></p>
          </div>
        `
      });

      await Notification.create({
        message: `Reminder email for "${title}" has been sent to ${email}`
      });

    } catch (error) {
      throw new Error(`Failed to send reminder email: ${error.message}`);
    }
  });
};

// send mail to delegates when assigned task is updated
export const sendTaskUpdateEmail = async (email, taskTitle, vaName) => {
  await transporter.sendMail({
    from: `"${vaName}" <${process.env.TURBO_FROM}>`,
    to: email,
    subject: `Task Updated: ${taskTitle}`,
    html: `
      <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
        <h2 style="color:#4CAF50;margin-bottom:20px;">Task Update Notification</h2>
        <p>Dear Smart Assistant,</p>
        <p>The task "<strong>${taskTitle}</strong>" assigned to you by <strong>${vaName}</strong> has been updated. Please log in to SmartVA to view the latest details and any changes made.</p>
        <p style="margin-top:30px;">Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
}

// =========================
// Verification Email
// =========================
export const sendVerifyEmail = async (email, verifyToken) => {
  await transporter.sendMail({
    from: `"SmartVA" <${process.env.TURBO_FROM}>`,
    to: email,
    subject: `Verify your email`,
    html: `
      <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
        <h2 style="color:#4CAF50;margin-bottom:20px;">Email Verification</h2>
        <p>Dear User,</p>
        <p>Thank you for registering with SmartVA! To complete your registration, please use the following six-digit verification code:</p>
        <div style="background-color:#e0f7e9;padding:15px;text-align:center;border-radius:5px;font-size:24px;font-weight:bold;letter-spacing:4px;margin:20px 0;">
          ${verifyToken}
        </div>
        <p>Enter this code in the SmartVA app to verify your email address and activate your account.</p>
        <p>If you did not request this verification, please ignore this email.</p>
        <p style="margin-top:30px;">Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
};

// =========================
// Reset Password Email
// =========================
export const sendResetPasswordEmail = async (email, resetToken) => {
  await transporter.sendMail({
    from: `"SmartVA" <${process.env.TURBO_FROM}>`,
    to: email,
    subject: `Reset your password`,
    html: `
      <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
        <h2 style="color:#4CAF50;margin-bottom:20px;">Password Reset Request</h2>
        <p>Dear User,</p>
        <p>We received a request to reset your SmartVA account password. Please use the following six-digit code to proceed:</p>
        <div style="background-color:#e0f7e9;padding:15px;text-align:center;border-radius:5px;font-size:24px;font-weight:bold;letter-spacing:4px;margin:20px 0;">
          ${resetToken}
        </div>
        <p>Enter this code in the SmartVA app to reset your password. If you did not request a password reset, please ignore this email.</p>
        <p style="margin-top:30px;">Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
};
