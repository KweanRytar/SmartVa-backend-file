// models/eventModel.js
import mongoose from "mongoose";

const concernedMemberSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
});

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    vaName: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    venue: { type: String, required: true },
    concernedMembers: [concernedMemberSchema],
    reminder: { type: Boolean, default: false },
    reminderTime: { type: Date, default: null },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

/* 🔑 Indexes */

// Fast lookup of all user events
eventSchema.index({ userId: 1, startTime: 1 });

// Ensure unique event title per user (optional, remove if duplicates allowed)
eventSchema.index({ title: 1, userId: 1 }, { unique: false });

// For querying expired/active events
eventSchema.index({ endTime: 1 });

// For reminder scheduling
eventSchema.index({ reminderTime: 1, userId: 1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
