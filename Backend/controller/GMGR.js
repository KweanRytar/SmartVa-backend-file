import { Resend } from "resend";
import { agenda } from "./event.controller.js";

const resend = new Resend(process.env.RESEND_API);

export const GeneralMessage = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // extract sender email using userid
    const senderName = await User.findById(userId).select("userName");
    if (!senderName) {
      return res.status(404).json({ message: "Sender email not found" });
    }

  

    const {  message, email, title } = req.body;

    if ( !message || !email || !title) {
      return res
        .status(400)
        .json({ message: "Please provide all required details" });
    }

    // Send Email
await resend.emails.send({
      from: `${senderName} <${process.env.EMAIL_FROM}>`, // dynamic sender
      to: email,
      subject: title,
      html: `
        <div style="background-color:#f9f9f9;padding:30px;font-family:Arial,sans-serif;color:#333;line-height:1.6;border-radius:8px;max-width:600px;margin:auto;border-left:6px solid #4CAF50;">
          
          <h2 style="color:#4CAF50;margin-bottom:20px;">${title}</h2>
          
          <p style="padding:15px;background-color:#fff;border-radius:6px;border:1px solid #ddd;font-size:16px;line-height:1.8;margin-bottom:20px;">
            ${message}
          </p>

          <div style="margin-top:30px;">
            <p>Best regards,</p>
            <strong>SmartVA Team</strong>
          </div>

        </div>
      `,
    });

    console.log("Message sent successfully");

    if (error) {
      return res.status(500).json({ message: "Email failed", error });
    }

    return res.status(200).json({
      message: "Message sent successfully",
      
    });
  } catch (error) {
    next(error);
  }
};

// function to send email reminderex
export const GeneralReminder = async (req, res, next) =>{
try {
  // get userid from request
const userId = req.user.userId;

if (!userId) {
  return res.status(401).json({ message: "Not authorized" });


}

// extract sender email using userid
const senderEmail = await User.findById(userId).select("email");
if (!senderEmail) {
  return res.status(404).json({ message: "Sender email not found" });
}

const {reason, time,  receiverEmail, receiverName} = req.body;

if (!reason || !time || !receiverEmail) {
  return res.status(400).json({ message: "Please provide all required details" });
}

// schedule reminder with agenda
await agenda.schedule(time, "general reminder", {
  userId,
  reason,
  senderEmail,
  receiverEmail,
  receiverName

});

console.log("Reminder scheduled successfully");

return res.status(200).json({ message: "Reminder scheduled successfully" });

} catch (error) {
  next(error);
}

}