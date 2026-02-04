import mongoose from "mongoose";

// =========================
// Delegate Schema
// =========================
const delegateSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false,
    // removed index: true to prevent duplicate index warning
  },
  
  name: { type: String, required: false },
  email: { type: String, required: true }, // removed index: true
});

// lowercase emails before saving
delegateSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase();
  next();
});

// =========================
// Subtask Schema
// =========================
const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  delegate: [delegateSchema],
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  }
});

subtaskSchema.pre('save', function (next) {
  if (!this._id) {
    this._id = new mongoose.Types.ObjectId();
  }
  next();
});

// =========================
// Task Schema
// =========================
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  delegate: [delegateSchema],
  priority:  {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    // removed inline index
  },
  subTasks: [subtaskSchema]
});

// =========================
// Schema-level Indexes
// =========================
taskSchema.index({ userId: 1 });
taskSchema.index({ 'delegate.email': 1 });
taskSchema.index({ 'delegate.userId': 1 });
taskSchema.index({ priority: 1, userId: 1 });
taskSchema.index({ status: 1, userId: 1 });
taskSchema.index({ 'subTasks.delegate.email': 1 });

export const Task = mongoose.model('Task', taskSchema);
