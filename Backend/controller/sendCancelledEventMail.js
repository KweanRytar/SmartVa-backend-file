
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API)

// Create transporter once for reuse
// const transporter = nodemailer.createTransport({
//  host: process.env.TURBO_HOST,
//   port: process.env.TURBO_PORT,
//   secure: process.env.TURBO_PORT == 465, // true for 465, false for other ports
//   auth: {
//     user: process.env.TURBO_USER,
//     pass: process.env.TURBO_PASS
//   }, // increase timeouts
//   connectionTimeout: 60000, // 
//   greetingTimeout: 30000,
//   socketTimeout: 120000,
//   logger: true,
//   debug: true
// });

// Helper to format dates consistently
const formatEventDate = (date) =>
  new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const sendCancelledEventMail = async (email, name, title, startTime, endTime, venue, vaName) => {
  try {
    const {data, error } = await resend.emails.send({
      from: `"SmartVA" <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `Event Cancelled: ${title}`,
      html: `
        <div style="background-color: #fff; padding: 20px; border-left: 4px solid #f44336; font-family: Arial, sans-serif; color: #333;">
          <h2>Hello ${name || "there"},</h2>
          <p>We regret to inform you that the following event has been cancelled:</p>
          <table cellpadding="6">
            <tr><td><strong>Event:</strong></td><td>${title}</td></tr>
            <tr>
              <td><strong>Date & Time:</strong></td>
              <td>${formatEventDate(startTime)} → ${formatEventDate(endTime)}</td>
            </tr>
            <tr><td><strong>Venue:</strong></td><td>${venue}</td></tr>
            <tr><td><strong>Organized by:</strong></td><td>${vaName}</td></tr>
          </table>
          <p>We apologize for any inconvenience this may cause. If you have any questions, please contact the VA handling this event.</p>
          <p>Best regards,<br/>SmartVA Team</p>
        </div>
      `,
    });
    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    // success handling 
    const successResponse = {
      success: true,
      status: 'sent',
      message: `Cancellation email sent to ${email}`,
      details: {
        messageId: data.id,
        recipient: email,
        event: title,
        sentAt: new Date().toISOString(),
      }
    }
    return successResponse.message;

  } catch (error) {
    // In production, replace with proper logging


    throw new Error(`Failed to send cancelled event email: ${error.message}`);
  }
};

export default sendCancelledEventMail;
