import BusyTime from "../model/busyTime.model.js";
import Event from "../model/event.model.js";
import { User } from "../model/user.model.js";
import { Notification } from "../model/notification.model.js";

import Agenda from 'agenda';

import { sendMailToConcernedMembers, sendUpdatedEventEmail } from "./sendMailToConcernedMembers.js";
import { getIO } from "../socket.js";
import sendCancelledEventMail from "./sendCancelledEventMail.js";
import mongoose from "mongoose";

export const agenda = new Agenda({
  db: { address: process.env.MONGO_URL, collection: 'agendaJobs' },
  processEvery: '5 seconds'
});

// Create event
export const createEvent = async (req, res, next) => {
  const userIdRaw = req?.user?.userId;
  if (!userIdRaw)
    return next(Object.assign(new Error("Unauthorized: User ID not found"), { statusCode: 401 }));

  const userId = new mongoose.Types.ObjectId(userIdRaw);

  try {
    const { title, startTime, endTime, venue, concernedMembers = [], reminder = false, reminderTime, vaName } = req.body;

    // 1️⃣ Basic validation
    if (!title || !startTime || !endTime || !venue || !vaName) {
      return next(
        Object.assign(
          new Error("Title, start time, end time, venue, and VA name are required"),
          { statusCode: 400 }
        )
      );
    }

    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start) || isNaN(end))
      return next(Object.assign(new Error("Invalid date format"), { statusCode: 400 }));
    if (start < now)
      return next(Object.assign(new Error("Event start time cannot be in the past"), { statusCode: 400 }));
    if (end <= start)
      return next(Object.assign(new Error("End time must be after start time"), { statusCode: 400 }));

    if (reminder) {
      if (!reminderTime)
        return next(
          Object.assign(new Error("Reminder time is required when reminder is enabled"), { statusCode: 400 })
        );
      const reminderDate = new Date(reminderTime);
      if (reminderDate <= now || reminderDate >= end)
        return next(
          Object.assign(new Error("Reminder time must be in the future and before event end"), { statusCode: 400 })
        );
    }

    // 2️⃣ Check busy time conflicts
    const conflict = await BusyTime.findOne({
      userId,
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    const formatDate = (date) =>
      new Date(date).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    if (conflict)
      return next(
        Object.assign(
          new Error(
            `Time conflict detected. Busy time: ${formatDate(conflict.startTime)} → ${formatDate(conflict.endTime)}`
          ),
          { statusCode: 400 }
        )
      );

    // 3️⃣ Generate names from email if not existing SmartVA user
    const processedMembers = await Promise.all(
      concernedMembers
        .filter((m) => m?.email?.trim())
        .map(async (m) => {
          const email = m.email.trim().toLowerCase();
          const existingUser = await User.findOne({ email });

          let name = "";
          if (existingUser?.fullName) {
            name = existingUser.fullName;
          } else {
            // fallback: take part before @ and capitalize first letter
            const rawName = email.split("@")[0].replace(/[._]/g, " ");
            name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          }

          return { email, name };
        })
    );

    // 4️⃣ Create event
    const event = await Event.create({
      title,
      startTime: start,
      endTime: end,
      venue,
      concernedMembers: processedMembers,
      reminder,
      reminderTime: reminder ? reminderTime : null,
      vaName,
      userId,
    });

    // 5️⃣ Block creator time
    await BusyTime.create({ userId, title, startTime: start, endTime: end });

    // 6️⃣ Notify concerned members (emails + notifications)
    const io = getIO();
    await Promise.all(
      processedMembers.map(async (member) => {
        try {
          const memberUser = await User.findOne({ email: member.email });

          // Create notification only if user exists in DB
          if (memberUser?._id) {
            const notificationMessage = `You have been added to the event "${title}". 🕒 ${formatDate(
              start
            )} → ${formatDate(end)} 📍 Venue: ${venue}`;

            await Notification.create({ userId: memberUser._id, message: notificationMessage });
            io.to(memberUser._id.toString()).emit("new-notification", { message: notificationMessage });
          }

          // Send email regardless of SmartVA registration
          try {
            await sendMailToConcernedMembers(
              event._id,
              member.email,
              member.name,
              title,
              start,
              end,
              venue,
              vaName
            );
          } catch (err) {
            console.error("Failed to send email to member:", member.email, err.message);
          }
        } catch (err) {
          console.error("Failed to notify member:", member.email, err.message);
        }
      })
    );

    // 7️⃣ Schedule reminders if enabled (only for registered users)
    if (reminder && reminderTime) {
      await Promise.all(
        processedMembers.map(async (member) => {
          try {
            const memberUser = await User.findOne({ email: member.email });
            if (!memberUser?._id) return;

            if (new Date(reminderTime).getTime() > Date.now()) {
              await agenda.schedule(reminderTime, "send email reminder", {
                eventId: event._id,
                email: member.email,
                title,
                startTime: start,
                vaName,
              });
              await agenda.schedule(reminderTime, "create reminder notification", {
                email: member.email,
                message: `Reminder: "${title}" starts soon.`,
                userId: memberUser._id,
              });
            }
          } catch (err) {
            console.error("Failed to schedule reminder for member:", member.email, err.message);
          }
        })
      );
    }

    // 8️⃣ Auto-delete after event ends
    await agenda.schedule(end, "delete expired event", { eventId: event._id });

    // 9️⃣ Return success
    res.status(201).json({ message: "Event created successfully", event });
  } catch (error) {
    next(error);
  }
};

// Get all events within a date range
export const getAllEvents = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: "Start and end dates are required" });

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ message: "Invalid start or end date format" });

    const userIdRaw = req.user.userId;
    if (!userIdRaw) return res.status(401).json({ message: "Unauthorized: User ID not found" });

    const userId = new mongoose.Types.ObjectId(userIdRaw);

    const [events, total] = await Promise.all([
      // Event.find({ userId, startTime: { $gte: startDate }, endTime: { $lte: endDate } }).lean(),
      // Event.countDocuments({ userId })
Event.find({
  userId,
  $or: [
    { startTime: { $gte: startDate, $lte: endDate } }, // starts in range
    { endTime: { $gte: startDate, $lte: endDate } },   // ends in range
    { startTime: { $lte: startDate }, endTime: { $gte: endDate } } // spans entire range
  ]
}).lean(),
      Event.countDocuments({ userId })


    ]);

    res.status(200).json({ message: "All events retrieved successfully", totalEvents: total, events });
  } catch (error) {
    next(error);
  }
};

// Get all events without filter
export const getEvents = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const events = await Event.find({ userId }).lean();
    if (!events || events.length === 0) return res.status(202).json({ message: "No events found for the user" });

    res.status(200).json({ message: "Events retrieved successfully", events });
  } catch (error) {
    next(error);
  }
};

// Get event by ID
export const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const event = await Event.findOne({ _id: id, userId });
    if (!event) return next(Object.assign(new Error(`Event with ID ${id} not found or not authorized`), { statusCode: 404 }));

    res.status(200).json({ message: `Event with ID ${id} retrieved successfully`, event });
  } catch (error) {
    next(error);
  }
};

// Update event
export const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updatedEvent = { ...req.body, reminder: Boolean(req.body.reminder) };
    if (!updatedEvent.reminder) updatedEvent.reminderTime = null;

    const oldEvent = await Event.findOne({ _id: id, userId });
    
    
    if (!oldEvent) return res.status(404).json({ message: "Event not found or unauthorized" });

    const event = await Event.findOneAndUpdate({ _id: id, userId }, updatedEvent, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ message: "Event not found or unauthorized" });

    await BusyTime.findOneAndUpdate({ _id: id, userId }, { startTime: event.startTime, endTime: event.endTime, title: event.title });

    await Promise.all(event.concernedMembers.map(async member => {
  const user = await User.findOne({ email: member.email });
  if (user) {
    await Notification.create({ 
      userId: user._id, 
      message: `The event "${oldEvent.title}" has been updated. Please check SmartVA for details.` 
    });

    const io = getIO();
    io.to(user._id.toString()).emit('new-notification', { 
      message: `The event "${oldEvent.title}" has been updated. Please check event tab for details.` 
    });

    await sendUpdatedEventEmail(member.email, member.name, oldEvent, event);
   
  } else {
    console.warn(`User with email ${member.email} not found. Skipping notification.`);
  }
}));

   

    res.status(200).json({ message: "Event updated successfully", event });
  } catch (error) {
    next(error);
  }
};

// Cancel event
export const cancelEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const event = await Event.findOneAndDelete({ _id: id, userId });
    if (!event) return next(Object.assign(new Error(`Event with ID ${id} not found or not authorized`), { statusCode: 404 }));

    await BusyTime.findOneAndDelete({ _id: id, userId });

    // check if start time is in the future before sending notifications
    if (new Date(event.startTime) <= new Date()) {
      return res.status(200).json({ message: `${event.title} deleted successfully` });
    }

    // send notification if event start time is in the future

    await Promise.all(event.concernedMembers.map(async member => {
      const memberUser = await User.findOne({ email: member.email });
      if (memberUser) await Notification.create({ userId: memberUser._id, message: `The event "${event.title}" scheduled on ${new Date(event.startTime).toLocaleString()} has been cancelled.` });

// emit real-time notification via socket.io
      const io = getIO();
      io.to(memberUser._id.toString()).emit('new-notification', { message: `The event "${event.title}" scheduled on ${new Date(event.startTime).toLocaleString()} has been cancelled.` });

      await sendCancelledEventMail(member.email, member.name, event.title, event.startTime, event.endTime, event.venue, event.vaName);
    }));

    res.status(200).json({ message: `${event.title} deleted successfully` });
  } catch (error) {
    next(error);
  }
};

// Get event by name
export const getEventByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    const userId = req.user.userId;
    const event = await Event.findOne({ title: { $regex: new RegExp(`^${name}$`, 'i') }, userId });
    if (!event) return res.status(404).json({ message: `Event with name ${name} not found` });

    res.status(200).json({ message: `Event with name ${name} retrieved successfully`, event });
  } catch (error) {
    next(error);
  }
};

// Get today's events
export const getEventFortheDay = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const events = await Event.find({
      userId,
      $or: [
        { startTime: { $gte: today, $lt: tomorrow } },
        { endTime: { $gte: today, $lt: tomorrow } },
        { startTime: { $lt: today }, endTime: { $gt: tomorrow } }
      ]
    }).lean();

    res.status(200).json({ message: "Today's events retrieved successfully", events });
  } catch (error) {
    next(error);
  }
};

// Get dashboard notifications
export const getDashboardNotifications = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    console.log("Fetching notifications for userId:", userId);
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ message: "Dashboard notifications retrieved successfully", notifications });
  } catch (error) {
    next(error);
  }
};

// Get busy times
export const getBusyTime = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const busyTimes = await BusyTime.find({ userId, startTime: { $gte: new Date() } }).lean();
    res.status(200).json({ message: "Busy times retrieved successfully", busyTimes });
  } catch (error) {
    next(error);
  }
};
