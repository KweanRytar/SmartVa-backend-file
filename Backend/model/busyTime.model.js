import mongoose
 from "mongoose";

 const busyTimeSchema = new mongoose.Schema({
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  title: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

// Compound unique index (startTime + userId must be unique together)
busyTimeSchema.index({ userId: 1, startTime: 1 }, { unique: true });

const BusyTime = mongoose.model('BusyTime', busyTimeSchema);

export default BusyTime;
    