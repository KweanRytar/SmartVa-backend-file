// visitor.model.js
import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: { type: Date, default: Date.now, expires: '90d'}
});

visitorSchema.index({ userId: 1 });
visitorSchema.index({ createdAt: 1, userId: 1 });

export const Visitor = mongoose.model('Visitor', visitorSchema);
