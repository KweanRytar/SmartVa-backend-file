import { Resend } from "resend";
import mongoose from "mongoose";

import Event from "../model/event.model.js";

/* ------------------ MAIL TRANSPORTER ------------------ */
const resend = new Resend(process.env.RESEND_API);

/* ------------------ DATE FORMATTER ------------------ */
const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

/* =====================================================
   SEND MAIL WHEN MEMBER IS ADDED TO EVENT
===================================================== */
export const sendMailToConcernedMembers = async (
  eventId,
  email,
  name,
  title,
  startTime,
  endTime,
  venue,
  vaName
) => {
  try {
    if (!email || !title || !startTime || !endTime || !venue) {
    throw new Error("Missing required data to send email");
  }

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw new Error("Invalid eventId");
  }

  const eventExists = await Event.findById(eventId);
  if (!eventExists || new Date(eventExists.endTime) <= new Date()) {
    throw new Error("Event deleted or expired, cannot send email");
  }

  const {data, error} = await resend.emails.send({
    from: `"SmartVA" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `You’ve been added to an event: ${title}`,
    html: `
      <div style="background-color:#fff;padding:20px;border-left:4px solid #4CAF50;font-family:Arial,sans-serif;color:#333;">
        <h2>Hello ${name || "there"},</h2>
        <p>You have been added as a <strong>participant</strong> in the following event:</p>
        <table cellpadding="6">
          <tr><td><strong>Event:</strong></td><td>${title}</td></tr>
          <tr><td><strong>Date & Time:</strong></td><td>${formatDate(startTime)} → ${formatDate(endTime)}</td></tr>
          <tr><td><strong>Venue:</strong></td><td>${venue}</td></tr>
          <tr><td><strong>Organized by:</strong></td><td>${vaName}</td></tr>
        </table>
        <p>Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
  if(error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
  return `Notification email sent to ${email}`;
  } catch (error) {
    throw new Error(`Failed to send notification email: ${error.message}`);
  }
};

/* =====================================================
   SEND MAIL WHEN EVENT IS UPDATED
===================================================== */
export const sendUpdatedEventEmail = async (email, name, updatedEvent) => {
  try {
    if (!email || !updatedEvent?.title) {
    throw new Error("Missing required data to send update email");
  }

  const title = updatedEvent.title || "Scheduled Event";

 const {data, error} = await resend.emails.send({
    from: `"SmartVA" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `Updated Event Details: ${title}`,
    html: `
      <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
        <h2 style="color:#4CAF50;">Event Updated: ${title}</h2>
        <p>Dear ${name || "there"},</p>
        <p>The details for the event "<strong>${title}</strong>" have been updated.</p>
        <table cellpadding="6">
          <tr><td><strong>Date & Time:</strong></td><td>${formatDate(updatedEvent.startTime)} → ${formatDate(updatedEvent.endTime)}</td></tr>
          <tr><td><strong>Venue:</strong></td><td>${updatedEvent.venue || "Not specified"}</td></tr>
          <tr><td><strong>Organized by:</strong></td><td>${updatedEvent.vaName || "SmartVA"}</td></tr>
        </table>
        <p style="margin-top:12px;">Please <strong>log in to SmartVA</strong> to view full details.</p>
        <p style="margin-top:30px;">Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
  return `Updated event email sent to ${email}`;
  } catch (error) {
    throw new Error(`Failed to send updated event email: ${error.message}`);
  }
};

// SEND MAIL TO DELEGATES OF A TASK
export const sendMailToDelegatesOfTask = async (
  email,
  name, 
  taskTitle,
  taskDescription,
  dueDate,
  vaName
) => {
 try {
   if (!email || !taskTitle || !dueDate) {
    throw new Error("Missing required data to send task email");
  }
  const {data, error} = await resend.emails.send({
    from: `"SmartVA" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `New Task Assigned: ${taskTitle}`,
    html: `
      <div style="background-color:#fff;padding:20px;border-left:4px solid #2196F3;font-family:Arial,sans-serif;color:#333;">
        <h2>Hello ${name || "there"},</h2>
        <p>You have been assigned a new task:</p>
        <table cellpadding="6">
          <tr><td><strong>Task:</strong></td><td>${taskTitle}</td></tr>
          <tr><td><strong>Description:</strong></td><td>${taskDescription || "N/A"}</td></tr>
          <tr><td><strong>Due Date:</strong></td><td>${formatDate(dueDate)}</td></tr>
          <tr><td><strong>Assigned by:</strong></td><td>${vaName}</td></tr>
        </table>
        <p>Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
  return `Task assignment email sent to ${email}`;
 } catch (error) {
  throw new Error(`Failed to send task assignment email: ${error.message}`);
 }
}

// SEND MAIL TO DELEGATES WHEN TASK IS UPDATED
export const sendUpdatedTaskEmail = async (email, name, oldEvent, updatedTask) => {
 try {
   if (!email || !updatedTask?.title) {
    throw new Error("Missing required data to send updated task email");
  }

  const title = oldEvent.title || "Assigned Task";

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

 const {data, error}= await resend.emails.send({
    from: `"SmartVA" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `Updated Task Details: ${title}`,
    html: `
      <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #2196F3;">
        <h2 style="color:#2196F3;margin-bottom:10px;">Task Updated: ${title}</h2>
        <p>Dear ${name || "there"},</p>
        <p>The details for the task "<strong>${title}</strong>" have been updated. Please review the changes below:</p>

        <table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:15px;">
          <tr style="background-color:#e0f0ff;">
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Field</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">Before</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ccc;">After</th>
          </tr>

          <tr>
            <td style="padding:8px;border-bottom:1px solid #ccc;"><strong>Description</strong></td>
            <td style="padding:8px;border-bottom:1px solid #ccc;">${oldEvent?.description || "N/A"}</td>
            <td style="padding:8px;border-bottom:1px solid #ccc;">${updatedTask.description || "N/A"}</td>
          </tr>

          <tr>
            <td style="padding:8px;border-bottom:1px solid #ccc;"><strong>Due Date</strong></td>
            <td style="padding:8px;border-bottom:1px solid #ccc;">${formatDate(oldEvent?.dueDate)}</td>
            <td style="padding:8px;border-bottom:1px solid #ccc;">${formatDate(updatedTask.dueDate)}</td>
          </tr>

          <tr>
            <td style="padding:8px;border-bottom:1px solid #ccc;"><strong>Assigned by</strong></td>
            <td style="padding:8px;border-bottom:1px solid #ccc;">${oldEvent?.vaName || "SmartVA"}</td>
            <td style="padding:8px;border-bottom:1px solid #ccc;">${updatedTask.vaName || "SmartVA"}</td>
          </tr>
        </table>

        <p style="margin-top:12px;">Please <strong>log in to SmartVA</strong> to view full details and manage the task.</p>
        <p style="margin-top:30px;">Best regards,<br/><strong>SmartVA Team</strong></p>
      </div>
    `
  });
  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
  return `Updated task email sent to ${email}`;
 } catch (error) {
  throw new Error(`Failed to send updated task email: ${error.message}`);
 }
};
