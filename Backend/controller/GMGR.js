import { Resend } from "resend";
import { agenda } from "./event.controller.js";
import { User } from "../model/user.model.js";

const resend = new Resend(process.env.RESEND_API);

/* ===============================
   SEND GENERAL MESSAGE
================================ */
export const GeneralMessage = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Fetch sender from DB
    const user = await User.findById(userId).select("fullName");

    if (!user) {
      return res.status(404).json({ message: "Sender not found" });
    }

    const senderName = user.fullName;

    const { message, email, title } = req.body;

    if (!message || !email || !title) {
      return res
        .status(400)
        .json({ message: "Please provide all required details" });
    }

    // Send Email using Resend
    await resend.emails.send({
      from: `Smartva <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: title,
      html: `
           <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
          
          <h2 style="color:#4CAF50;margin-bottom:20px;">✉️ ${title}</h2>
          
          <p style="font-size:16px;margin-bottom:20px;">Hello,</p>
          
          <div style="background-color:#fff;padding:20px;border-radius:8px;border:1px solid #ddd;margin-bottom:25px;">
            <p style="font-size:16px;line-height:1.8;margin:0;color:#333;white-space:pre-wrap;">
${message}
            </p>
          </div>
          
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:30px 0;">
          
          <div style="margin-top:30px;">
            <p style="margin-bottom:5px;">Best regards,</p>
            <p style="margin:0;"><strong>${senderName}</strong></p>
            <p style="margin:5px 0 0 0;font-size:13px;color:#888;">via SmartVA</p>
          </div>

        </div>
      `,
    });

    console.log("Message sent successfully");

    return res.status(200).json({
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error sending message:", error);
    next(error);
  }
};

/* ===============================
   SEND GENERAL REMINDER
================================ */
export const GeneralReminder = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Fetch sender from DB
    const user = await User.findById(userId).select("fullName");

    if (!user) {
      return res.status(404).json({ message: "Sender not found" });
    }

    const senderName = user.fullName;

    const { reason, time, receiverEmail, receiverName } = req.body;

    if (!reason || !time || !receiverEmail) {
      return res.status(400).json({
        message: "Please provide all required details",
      });
    }

    // Convert time safely to Date object
    const scheduledTime = new Date(time);

    if (isNaN(scheduledTime.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Schedule reminder with Agenda
    await agenda.schedule(scheduledTime, "general reminder", {
      reason,
      senderName,
      receiverEmail,
      receiverName,
    });

    console.log("Reminder scheduled successfully");

    return res
      .status(200)
      .json({ message: "Reminder scheduled successfully" });
  } catch (error) {
    console.error("Error scheduling reminder:", error);
    next(error);
  }
};